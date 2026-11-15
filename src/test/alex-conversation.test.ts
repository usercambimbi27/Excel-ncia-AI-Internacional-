import { describe, expect, it } from "vitest";
import { detectLangSwitch } from "@/lib/excelencia/lang";
import { isGhostTranscript, takeSentences } from "@/lib/excelencia/speech";
import { selectHistory } from "@/lib/excelencia/alex-prompt";

describe("mudança de idioma só quando o aluno pede", () => {
  it.each([
    ["Alex fala português", "pt"],
    ["Alex, speak English", "en"],
    ["fala inglês", "en"],
    ["podes falar em inglês comigo?", "en"],
    ["vamos falar português", "pt"],
    ["let's speak English", "en"],
    ["Can you speak Portuguese?", "pt"],
    ["switch to English please", "en"],
  ])("'%s' muda para %s", (text, lang) => {
    expect(detectLangSwitch(text)).toBe(lang);
  });

  it.each([
    "o meu irmão fala inglês muito bem",
    'como se diz "speak English"?',
    "I want to speak English better",
    "eu gosto de português e inglês",
  ])("'%s' não muda o idioma", (text) => {
    expect(detectLangSwitch(text)).toBeNull();
  });
});

describe("voz frase a frase", () => {
  it("não parte números decimais nem abreviaturas", () => {
    expect(takeSentences("It costs 3.5 kwanzas. Mr. Silva is here. Next")).toEqual({
      sentences: ["It costs 3.5 kwanzas.", "Mr. Silva is here."],
      rest: "Next",
    });
  });

  it("espera pelo espaço depois do ponto antes de cortar", () => {
    expect(takeSentences("I have 3.")).toEqual({ sentences: [], rest: "I have 3." });
  });
});

describe("transcrições fantasma do microfone", () => {
  it("descarta legendas inventadas no silêncio", () => {
    expect(isGhostTranscript("Legendas pela comunidade Amara.org", 2000)).toBe(true);
  });
  it("mantém um 'thank you' dito de verdade", () => {
    expect(isGhostTranscript("Thank you.", 900)).toBe(false);
  });
  it("descarta um 'thank you' de ruído curtíssimo", () => {
    expect(isGhostTranscript("Thank you.", 350)).toBe(true);
  });
});

describe("memória da conversa", () => {
  it("guarda mais do que as antigas 14 mensagens quando cabem", () => {
    const msgs = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 ? "model" : "user") as "user" | "model",
      text: `mensagem ${i}`,
    }));
    const out = selectHistory(msgs);
    expect(out).toHaveLength(40);
    expect(out.at(-1)?.content).toBe("mensagem 39");
  });

  it("corta pelas mais antigas quando passa o orçamento", () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, text: "x".repeat(1000) + i }));
    const out = selectHistory(msgs, { maxChars: 3500 });
    expect(out).toHaveLength(3);
    expect(out.at(-1)?.content.endsWith("9")).toBe(true);
  });
});
