import { createFileRoute } from "@tanstack/react-router";
import { alexVoiceSchema, type AlexStreamEvent } from "@/lib/excelencia/alex-schema";
import { buildAlexSystemPrompt, selectHistory } from "@/lib/excelencia/alex-prompt";
import { takeSentences } from "@/lib/excelencia/speech";

/**
 * Um turno da chamada de voz, à maneira do modo de voz do ChatGPT: cada frase
 * é enviada ao aparelho assim que a sua voz fica pronta, enquanto o Alex ainda
 * "escreve" as seguintes. A primeira frase começa a tocar muito antes do fim.
 */
export const Route = createFileRoute("/api/alex/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("x-user-ai-key")?.trim();
        if (!key) return Response.json({ error: "Ativa a tua chave no Menu para ligares ao Alex." }, { status: 401 });

        const parsed = alexVoiceSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || (!parsed.data.opening && !parsed.data.text.trim())) {
          return Response.json({ error: "Pedido inválido." }, { status: 400 });
        }
        const data = parsed.data;
        const { groqStream, ttsBytes, ACCENT_VOICE, TTS_VOICE, GroqError } = await import(
          "@/lib/excelencia/groq.server"
        );

        const notes: { role: string; content: string }[] = [];
        if (data.interrupted) {
          notes.push({
            role: "system",
            content: `O aluno interrompeu-te e não ouviu esta parte do que ias dizer: "${data.interrupted}". Responde primeiro ao que ele acabou de dizer. Só retomas essa parte se ainda fizer sentido, e em poucas palavras, sem repetir do início.`,
          });
        }
        const userTurn = data.opening
          ? {
              role: "user",
              content:
                "[A chamada acabou de ligar. Cumprimenta o aluno de forma calorosa e curta, pelo nome se o souberes. Se as tuas notas tiverem algo recente e relevante (um objetivo, um acontecimento, o último tema), menciona-o com naturalidade. Termina com uma pergunta aberta e simples.]",
            }
          : { role: "user", content: data.text.trim() };

        const messages = [
          {
            role: "system",
            content: buildAlexSystemPrompt({
              level: data.level,
              name: data.name,
              lang: data.lang,
              mode: "voice",
              memory: data.memory,
            }),
          },
          ...selectHistory(data.history, { maxChars: 10000 }),
          ...notes,
          userTurn,
        ];

        const voice = ACCENT_VOICE[data.accent] ?? TTS_VOICE;
        const upstream = new AbortController();
        request.signal?.addEventListener("abort", () => upstream.abort());
        const enc = new TextEncoder();

        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (e: AlexStreamEvent) => {
              try {
                controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
              } catch {
                /* cliente já saiu */
              }
            };

            // frases por ordem; cada uma é enviada quando a sua voz e a de todas as anteriores estão prontas
            const slots: { text: string; audio: string; err?: string; ready: boolean }[] = [];
            let nextOut = 0;
            const flush = () => {
              while (nextOut < slots.length && slots[nextOut].ready) {
                const s = slots[nextOut];
                send({ t: "seg", i: nextOut, text: s.text, audio: s.audio, mime: "audio/wav", err: s.err });
                nextOut++;
              }
            };
            // duas faixas em paralelo: a frase seguinte sintetiza enquanto a anterior toca
            const lanes: Promise<void>[] = [Promise.resolve(), Promise.resolve()];
            const enqueue = (sentence: string) => {
              const idx = slots.length;
              const slot = { text: sentence, audio: "", ready: false } as (typeof slots)[number];
              slots.push(slot);
              const lane = idx % lanes.length;
              lanes[lane] = lanes[lane].then(async () => {
                try {
                  const r = await ttsBytes(key, sentence, voice, 0.94, upstream.signal);
                  slot.audio = r.audio;
                  slot.err = r.error;
                } catch {
                  slot.err = "A voz falhou nesta frase.";
                }
                slot.ready = true;
                flush();
              });
            };

            // a primeira frase sai logo; as seguintes juntam frases curtinhas para soar mais humano
            let hold = "";
            const emit = (sentence: string, final = false) => {
              const s = sentence.trim();
              if (s) hold = hold ? `${hold} ${s}` : s;
              const min = slots.length === 0 ? 12 : 50;
              if (hold && (final || hold.length >= min)) {
                enqueue(hold);
                hold = "";
              }
            };

            try {
              let acc = "";
              const { text } = await groqStream(
                key,
                {
                  messages,
                  reasoning_effort: "low",
                  temperature: 0.8,
                  top_p: 0.95,
                  max_completion_tokens: 1500,
                },
                (d) => {
                  acc += d;
                  const { sentences, rest } = takeSentences(acc);
                  acc = rest;
                  for (const s of sentences) emit(s);
                },
                upstream.signal,
              );
              emit(acc, true);
              if (!text) {
                send({ t: "error", message: "O Alex ficou sem palavras. Fala outra vez." });
              } else {
                await Promise.all(lanes);
                flush();
                send({ t: "done", text });
              }
            } catch (e) {
              if (!upstream.signal.aborted) {
                send({
                  t: "error",
                  message: e instanceof GroqError ? e.message : "A chamada falhou por um instante.",
                  status: e instanceof GroqError ? e.status : 500,
                });
              }
            } finally {
              try {
                controller.close();
              } catch {
                /* já fechado */
              }
            }
          },
          cancel() {
            upstream.abort();
          },
        });

        return new Response(body, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
