import { z } from "zod";

/** Pedido de conversa com o Alex (chat escrito e chamada de voz). */
export const alexTurnSchema = z.object({
  history: z
    .array(z.object({ role: z.enum(["user", "model", "assistant"]), text: z.string().max(8000) }))
    .max(200)
    .default([]),
  text: z.string().max(4000).default(""),
  level: z.enum(["A1", "A2", "B1", "B2"]),
  name: z.string().max(80).default(""),
  lang: z.enum(["pt", "en"]).default("pt"),
  memory: z.string().max(3000).default(""),
});

export const alexVoiceSchema = alexTurnSchema.extend({
  accent: z.enum(["angolano", "britanico", "americano"]).default("angolano"),
  /** parte da fala do Alex que o aluno cortou a meio */
  interrupted: z.string().max(600).default(""),
  /** início da chamada: o Alex abre a conversa */
  opening: z.boolean().default(false),
});

export type AlexTurnInput = z.input<typeof alexTurnSchema>;
export type AlexVoiceInput = z.input<typeof alexVoiceSchema>;

/** Eventos enviados em fluxo (uma linha JSON por evento). */
export type AlexStreamEvent =
  | { t: "delta"; v: string }
  | { t: "seg"; i: number; text: string; audio: string; mime: string; err?: string }
  | { t: "done"; text: string; finish?: string }
  | { t: "error"; message: string; status?: number };
