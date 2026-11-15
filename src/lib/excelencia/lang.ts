export type TalkLang = "pt" | "en";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Quem pede: início da mensagem, "Alex", "por favor", "podes", "vamos", "let's", "can you"... */
const ASK = String.raw`(?:^|\balex\W+|\bpor favor\W+|\bagora\W+|\bpodes\W+|\bpode\W+|\bvamos\W+|\blet'?s\W+|\bcan you\W+|\bcould you\W+|\bplease\W+)`;
const VERB = String.raw`(?:fala|falar|fale|speak|talk|switch|muda|mudar|volta|voltar|responde|responder)\b`;
const PT_RE = new RegExp(`${ASK}${VERB}[^.?!]{0,25}\\b(?:portugues|portuguese)\\b`);
const EN_RE = new RegExp(`${ASK}${VERB}[^.?!]{0,25}\\b(?:ingles|english)\\b`);

/**
 * Deteta pedidos do tipo "Alex fala português" / "Alex, speak English".
 * Frases que só mencionam a língua ("o meu irmão fala inglês") ou citações
 * entre aspas ("como se diz "speak English"?") não mudam o idioma.
 */
export function detectLangSwitch(text: string): TalkLang | null {
  const t = norm(text)
    .replace(/["“”«»][^"“”«»]*["“”«»]/g, " ")
    .trim();
  if (PT_RE.test(t)) return "pt";
  if (EN_RE.test(t)) return "en";
  return null;
}

export const langLabel = (lang: TalkLang) => (lang === "pt" ? "português" : "inglês");
