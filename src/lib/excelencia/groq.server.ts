/**
 * Ligação à Groq, só no servidor. A chave é sempre a do próprio aluno,
 * passada explicitamente por quem chama (server function ou rota).
 */
import { naturalizeSpeech } from "./speech";

export const GROQ_URL = "https://api.groq.com/openai/v1";
export const CHAT_MODEL = "openai/gpt-oss-120b";
export const STT_MODEL = "whisper-large-v3-turbo";
export const TTS_MODEL = "canopylabs/orpheus-v1-english";
export const TTS_VOICE = "daniel";

/** Sotaques disponíveis para a voz do Alex. */
export const ACCENT_VOICE = {
  angolano: "troy",
  britanico: "daniel",
  americano: "austin",
} as const;
export type AccentId = keyof typeof ACCENT_VOICE;

export class GroqError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

export function missingKeyError() {
  return new GroqError("Indisponível de momento. Ativa a tua chave no Menu.", 401);
}

function friendly(status: number, detail: string): GroqError {
  console.error(`Groq ${status}: ${detail.slice(0, 300)}`);
  if (status === 429) return new GroqError("O Alex está com muitos pedidos. Espera uns segundos e tenta de novo.", 429);
  if (status === 401 || status === 403) return new GroqError("A tua chave deixou de funcionar. Troca-a no Menu.", 401);
  if (status === 413) return new GroqError("A conversa ficou grande demais. Começa uma nova conversa.", 413);
  return new GroqError("O Alex não conseguiu responder agora. Tenta outra vez.", 502);
}

type ChatBody = Record<string, unknown>;

/** Valores por omissão: raciocínio escondido e espaço de sobra para pensar E responder. */
const withDefaults = (body: ChatBody): ChatBody => ({
  model: CHAT_MODEL,
  reasoning_effort: "low",
  reasoning_format: "hidden",
  ...body,
});

/** Pedido simples (sem fluxo). Nunca devolve o raciocínio interno ao aluno. */
export async function groqChat(key: string, body: ChatBody): Promise<string> {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(withDefaults(body)),
  });
  if (!res.ok) throw friendly(res.status, await res.text());
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Pedido em fluxo: chama onDelta a cada pedacinho de texto que chega. */
export async function groqStream(
  key: string,
  body: ChatBody,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; finish: string }> {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(withDefaults({ ...body, stream: true })),
    signal,
  });
  if (!res.ok) throw friendly(res.status, await res.text());
  const reader = res.body?.getReader();
  if (!reader) throw new GroqError("O Alex não devolveu resposta.", 502);
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let finish = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          error?: { message?: string };
        };
        if (j.error) throw new GroqError("O Alex perdeu o fio à meada. Tenta outra vez.", 502);
        const c = j.choices?.[0];
        if (c?.finish_reason) finish = c.finish_reason;
        const d = c?.delta?.content;
        if (d) {
          full += d;
          onDelta(d);
        }
      } catch (e) {
        if (e instanceof GroqError) throw e;
        /* linha a meio, chega no próximo pedaço */
      }
    }
  }
  return { text: full.trim(), finish };
}

const toBase64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

export interface TtsResult {
  audio: string;
  error?: string;
}

/** Cache de voz para frases repetidas (máx. 40, sai o mais antigo). */
const VOICE_CACHE_MAX = 40;
const voiceCache = new Map<string, string>();

/** Gera um pedaço de voz pela Groq, com cache e novas tentativas em caso de limite. */
export async function ttsBytes(
  key: string,
  text: string,
  voice: string,
  speed: number,
  signal?: AbortSignal,
): Promise<TtsResult> {
  const input = naturalizeSpeech(text).slice(0, 1200);
  if (!input) return { audio: "" };
  const cacheKey = `${voice}|${speed}|${input}`;
  const cached = voiceCache.get(cacheKey);
  if (cached) return { audio: cached };

  const body = JSON.stringify({ model: TTS_MODEL, voice, input, speed, response_format: "wav" });
  let lastStatus = 0;
  let lastDetail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) return { audio: "" };
    const res = await fetch(`${GROQ_URL}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
      signal,
    });
    if (res.ok) {
      const audio = toBase64(new Uint8Array(await res.arrayBuffer()));
      if (voiceCache.size >= VOICE_CACHE_MAX) {
        const oldest = voiceCache.keys().next().value;
        if (oldest) voiceCache.delete(oldest);
      }
      voiceCache.set(cacheKey, audio);
      return { audio };
    }
    lastStatus = res.status;
    lastDetail = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 4000) : 600 * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    break;
  }
  console.error(`Groq TTS ${lastStatus}: ${lastDetail.slice(0, 200)}`);
  return {
    audio: "",
    error:
      lastStatus === 429
        ? "A voz do Alex atingiu o limite de pedidos. Uso a voz de reserva por agora."
        : "A voz do Alex falhou. Uso a voz de reserva por agora.",
  };
}
