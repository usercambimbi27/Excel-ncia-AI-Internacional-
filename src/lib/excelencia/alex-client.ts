import type { AlexStreamEvent, AlexTurnInput, AlexVoiceInput } from "./alex-schema";
import { getUserKey } from "./access";

export class AlexError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

/** Lê uma resposta em fluxo (uma linha JSON por evento) e entrega cada evento. */
async function readStream(
  url: string,
  payload: unknown,
  onEvent: (e: AlexStreamEvent) => void,
  signal?: AbortSignal,
): Promise<{ text: string; finish?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-ai-key": getUserKey() },
    body: JSON.stringify(payload),
    signal,
  }).catch((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new AlexError("Sem ligação à internet. Verifica a rede e tenta outra vez.");
  });
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AlexError(j?.error ?? "O Alex não conseguiu responder agora. Tenta outra vez.", res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: { text: string; finish?: string } | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let e: AlexStreamEvent;
    try {
      e = JSON.parse(line) as AlexStreamEvent;
    } catch {
      return;
    }
    if (e.t === "error") throw new AlexError(e.message, e.status ?? 0);
    if (e.t === "done") result = { text: e.text, finish: e.finish };
    onEvent(e);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) handle(l);
  }
  handle(buf);
  if (!result) throw new AlexError("A resposta do Alex chegou cortada. Tenta outra vez.");
  return result;
}

/** Chat escrito: entrega o texto à medida que o Alex o escreve. */
export function streamAlexChat(
  payload: AlexTurnInput,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
) {
  return readStream("/api/alex/chat", payload, (e) => e.t === "delta" && onDelta(e.v), signal);
}

export interface VoiceSeg {
  i: number;
  text: string;
  audio: string;
  mime: string;
  err?: string;
}

/** Chamada de voz: entrega cada frase já com a voz pronta, por ordem. */
export function streamAlexVoice(
  payload: AlexVoiceInput,
  onSegment: (seg: VoiceSeg) => void,
  signal?: AbortSignal,
) {
  return readStream("/api/alex/voice", payload, (e) => e.t === "seg" && onSegment(e), signal);
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
