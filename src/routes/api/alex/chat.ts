import { createFileRoute } from "@tanstack/react-router";
import { alexTurnSchema, type AlexStreamEvent } from "@/lib/excelencia/alex-schema";
import { buildAlexSystemPrompt, selectHistory } from "@/lib/excelencia/alex-prompt";

/**
 * Chat escrito com o Alex, em fluxo: o texto aparece palavra a palavra,
 * como no ChatGPT. Usa sempre a chave pessoal do aluno (cabeçalho x-user-ai-key).
 */
export const Route = createFileRoute("/api/alex/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("x-user-ai-key")?.trim();
        if (!key) return Response.json({ error: "Ativa a tua chave no Menu para falares com o Alex." }, { status: 401 });

        const parsed = alexTurnSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || !parsed.data.text.trim()) {
          return Response.json({ error: "Mensagem inválida." }, { status: 400 });
        }
        const data = parsed.data;
        const { groqStream, GroqError } = await import("@/lib/excelencia/groq.server");

        const messages = [
          {
            role: "system",
            content: buildAlexSystemPrompt({
              level: data.level,
              name: data.name,
              lang: data.lang,
              mode: "text",
              memory: data.memory,
            }),
          },
          ...selectHistory(data.history),
          { role: "user", content: data.text.trim() },
        ];

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
            try {
              const { text, finish } = await groqStream(
                key,
                {
                  messages,
                  // pensa um pouco antes de responder: respostas mais certeiras e humanas
                  reasoning_effort: "medium",
                  temperature: 0.8,
                  top_p: 0.95,
                  max_completion_tokens: 4096,
                },
                (d) => send({ t: "delta", v: d }),
                upstream.signal,
              );
              if (!text) send({ t: "error", message: "O Alex ficou sem palavras. Tenta outra vez." });
              else send({ t: "done", text, finish });
            } catch (e) {
              if (!upstream.signal.aborted) {
                send({
                  t: "error",
                  message: e instanceof GroqError ? e.message : "O Alex não conseguiu responder agora. Tenta outra vez.",
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
