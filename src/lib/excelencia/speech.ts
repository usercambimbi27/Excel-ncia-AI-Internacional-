/**
 * Utilitários de fala partilhados pelo servidor e pelo navegador
 * (sem segredos, sem dependências de servidor).
 */

/** Etiquetas de emoção que a voz interpreta (ri, suspira, ofega...). */
const SPEECH_TAG_RE = /<\/?(?:laugh|chuckle|sigh|cough|sniffle|groan|yawn|gasp)>/gi;

/** Tira as etiquetas de emoção do texto que se mostra no ecrã. */
export function stripSpeechTags(raw: string): string {
  return raw
    .replace(SPEECH_TAG_RE, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Prepara o texto para soar humano: tira símbolos que a voz leria mal
 * e deixa a pontuação marcar as respirações.
 */
export function naturalizeSpeech(raw: string): string {
  const tags: string[] = [];
  const masked = raw.replace(SPEECH_TAG_RE, (t) => {
    tags.push(t.toLowerCase());
    return `\u0000${tags.length - 1}\u0000`;
  });
  const cleaned = masked
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`>|]/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s*\(([^)]*)\)\s*/g, ", $1, ")
    .replace(/\s+[-–—]\s+/g, ", ")
    .replace(/\.{2,}|…/g, ",")
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s*:\s+/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
    .replace(/([^.!?,])$/, "$1.");
  return cleaned.replace(/\u0000(\d+)\u0000/g, (_, i) => tags[Number(i)] ?? " ");
}

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "sr", "sra", "prof", "st", "vs", "etc", "e.g", "i.e", "no", "nº",
]);

/**
 * Corta o texto que vai chegando em frases completas, prontas para virar voz.
 * Só corta quando já chegou o espaço depois da pontuação, para não partir
 * "3.5" ou "Mr. Silva" a meio. Devolve as frases prontas e o resto por fechar.
 */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;
  for (;;) {
    const re = /[.!?…]+["')\]]*\s+/g;
    let cut = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const before = rest.slice(0, m.index);
      const lastWord = (before.match(/([\p{L}.º]+)$/u)?.[1] ?? "").toLowerCase();
      if (rest[m.index] === "." && ABBREVIATIONS.has(lastWord)) continue;
      cut = m.index + m[0].length;
      break;
    }
    if (cut === -1) {
      // frase enorme sem ponto: corta na última vírgula para a voz não esperar demasiado
      if (rest.length > 220) {
        const comma = rest.lastIndexOf(", ", 200);
        if (comma > 40) {
          sentences.push(rest.slice(0, comma + 1).trim());
          rest = rest.slice(comma + 2);
          continue;
        }
      }
      break;
    }
    const s = rest.slice(0, cut).trim();
    if (s) sentences.push(s);
    rest = rest.slice(cut);
  }
  return { sentences, rest };
}

/** Frases que o Whisper inventa no silêncio ou no ruído — nunca são fala real. */
const WHISPER_ALWAYS_GHOSTS = [
  /amara\.org/i,
  /^legendas? (pela|por) /i,
  /subtitles? (by|from)/i,
  /^\[?\(?(m[uú]sica|music|silence|sil[eê]ncio|applause|aplausos|risos|laughter)\)?\]?[.!]?$/i,
  /thanks? for watching/i,
  /obrigad[oa] por assistir/i,
];

/** Fantasmas que também podem ser fala real: só se descartam com áudio curtíssimo. */
const WHISPER_SHORT_GHOSTS = [
  /^(thank you|thanks)( (so much|very much))?[.!]?$/i,
  /^(obrigad[oa]|muito obrigad[oa])[.!]?$/i,
  /^you[.!]?$/i,
];

/** Diz se a transcrição é lixo (silêncio, ruído ou "fantasma" típico do Whisper). */
export function isGhostTranscript(text: string, speechMs = 0): boolean {
  const t = text.trim();
  if (t.length < 2 || /^[\s.?!,…-]*$/.test(t)) return true;
  if (WHISPER_ALWAYS_GHOSTS.some((re) => re.test(t))) return true;
  return speechMs > 0 && speechMs < 600 && WHISPER_SHORT_GHOSTS.some((re) => re.test(t));
}
