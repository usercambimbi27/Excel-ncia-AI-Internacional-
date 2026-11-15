import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { buildAlexSystemPrompt, MEMORY_PROMPT } from "./alex-prompt";
import {
  ACCENT_VOICE,
  GROQ_URL,
  STT_MODEL,
  TTS_VOICE,
  groqChat as groqChatWithKey,
  missingKeyError,
  ttsBytes as ttsBytesWithKey,
} from "./groq.server";

/** Chave pessoal do aluno, enviada pelo aparelho dele em cada pedido. */
const key = () => {
  const k = getRequestHeader("x-user-ai-key")?.trim();
  if (!k) throw missingKeyError();
  return k;
};

const groqChat = (body: Record<string, unknown>) => groqChatWithKey(key(), body);
const ttsBytes = (text: string, voice: string, speed: number) => ttsBytesWithKey(key(), text, voice, speed);

const levelSchema = z.enum(["A1", "A2", "B1", "B2"]);

export interface ExerciseQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  audioText?: string;
}

export interface Exercise {
  title: string;
  intro: string;
  questions: ExerciseQuestion[];
}

const exerciseSchema = z.object({
  title: z.string(),
  intro: z.string(),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        answer: z.number(),
        explanation: z.string(),
        audioText: z.string().optional(),
      }),
    )
    .min(1),
});

const BASE_EXERCISE_PROMPT =
  'És o Alex, professor angolano de inglês. Crias exercícios de inglês para alunos angolanos. Respondes SEMPRE em JSON válido com este formato: {"title": string, "intro": string em português de Angola, "questions": [{"question": string, "options": [4 strings], "answer": índice 0-3 da opção correta, "explanation": string curta em português}]}. Cria exatamente 5 perguntas. Usa contextos angolanos (Luanda, candongueiro, mercado, kizomba, funge).';

const LISTENING_EXERCISE_PROMPT =
  'És o Alex, professor angolano de inglês. Crias exercícios de LISTENING (compreensão oral) para alunos angolanos. O aluno NÃO lê a frase em inglês — só a ouve. Respondes SEMPRE em JSON válido com este formato: {"title": string, "intro": string em português de Angola, "questions": [{"audioText": frase ou mini-diálogo em INGLÊS que vai ser lido em voz alta (1 a 2 frases, natural, sem escrever entre aspas), "question": pergunta em português de Angola sobre o que foi ouvido (NUNCA repitas a frase em inglês dentro da pergunta), "options": [4 strings em português], "answer": índice 0-3 da opção correta, "explanation": string curta em português que já pode mostrar a frase em inglês}]}. Cria exatamente 5 perguntas, todas com audioText obrigatório. Nada de exercícios de escrita, de completar espaços ou de gramática escrita. Usa contextos angolanos (Luanda, candongueiro, mercado, kizomba, funge).';

export const generateExercise = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ level: levelSchema, tipo: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<Exercise> => {
    const isListening = data.tipo.toLowerCase().includes("listening");
    const raw = await groqChat({
      temperature: 0.7,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: isListening ? LISTENING_EXERCISE_PROMPT : BASE_EXERCISE_PROMPT,
        },
        {
          role: "user",
          content: isListening
            ? `Cria um exercício de listening (só áudio) para o nível ${data.level}.`
            : `Cria um exercício de ${data.tipo} para o nível ${data.level}.`,
        },
      ],
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Não consegui gerar o exercício agora. Tenta outra vez.");
    }
    const result = exerciseSchema.safeParse(parsed);
    if (!result.success) throw new Error("O exercício veio com um formato estranho. Tenta outra vez.");
    const questions = result.data.questions.map((q) => ({
      ...q,
      options: q.options.slice(0, 4),
      answer: Math.min(Math.max(q.answer, 0), Math.max(q.options.length - 1, 0)),
    }));
    return { ...result.data, questions };
  });

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        audio: z.string().min(1),
        mimeType: z.string().default("audio/webm"),
        /** última fala do Alex: ajuda o Whisper a perceber o contexto */
        context: z.string().max(400).default(""),
        lang: z.enum(["pt", "en"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const bin = atob(data.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = data.mimeType.includes("wav")
      ? "wav"
      : data.mimeType.includes("mp4")
        ? "mp4"
        : data.mimeType.includes("ogg")
          ? "ogg"
          : "webm";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mimeType }), `audio.${ext}`);
    form.append("model", STT_MODEL);
    form.append("temperature", "0");
    form.append("response_format", "text");
    const base =
      data.lang === "pt"
        ? "Conversa com o professor Alex, em português de Angola, com algumas palavras em inglês."
        : "Aula de inglês em Angola. O aluno fala inglês com sotaque angolano e às vezes mistura português de Angola (Luanda, kwanza, candongueiro, mano).";
    // o Whisper usa o prompt como "texto anterior": a última fala do Alex dá-lhe contexto
    form.append("prompt", `${base} ${data.context ? `Alex: ${data.context.slice(-300)}` : ""}`.trim());
    const res = await fetch(`${GROQ_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}` },
      body: form,
    });
    if (!res.ok) {
      console.error(`Groq STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
      throw new Error(res.status === 429 ? "Muitos pedidos de áudio. Espera uns segundos." : "Não percebi o áudio. Tenta outra vez.");
    }
    return { text: (await res.text()).trim() };
  });

/** Voz do Alex gerada pela Groq (não pelo navegador). */
export const speakWithGroq = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(1200),
        accent: z.enum(["angolano", "britanico", "americano"]).default("angolano"),
        speed: z.number().min(0.5).max(1.5).default(0.94),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ audio: string; mimeType: string; error?: string }> => {
    const voice = ACCENT_VOICE[data.accent] ?? TTS_VOICE;
    const r = await ttsBytes(data.text, voice, data.speed);
    return { audio: r.audio, mimeType: "audio/wav", error: r.error };
  });

/**
 * Memória de longo prazo: o Alex atualiza o seu caderno de notas sobre o aluno
 * com base na conversa recente. As notas ficam só no aparelho do aluno.
 */
export const updateAlexMemory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        memory: z.string().max(3000).default(""),
        recent: z
          .array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) }))
          .min(1)
          .max(30),
        name: z.string().max(80).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ memory: string }> => {
    const transcript = data.recent
      .map((m) => `${m.role === "user" ? data.name || "Aluno" : "Alex"}: ${m.text}`)
      .join("\n");
    const text = await groqChat({
      temperature: 0.2,
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: MEMORY_PROMPT },
        {
          role: "user",
          content: `NOTAS ATUAIS:\n${data.memory || "(vazio)"}\n\nCONVERSA RECENTE:\n${transcript}`,
        },
      ],
    });
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .slice(0, 12);
    // se a resposta vier estranha, mantém as notas antigas
    return { memory: lines.length ? lines.join("\n").slice(0, 1500) : data.memory };
  });

export const generateLesson = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ level: levelSchema, topic: z.string().min(1).max(200), name: z.string().default("") })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const text = await groqChat({
      temperature: 0.7,
      reasoning_effort: "medium",
      max_completion_tokens: 4000,
      messages: [
        {
          role: "system",
          content: buildAlexSystemPrompt({ level: data.level, name: data.name, lang: "pt", mode: "lesson" }),
        },
        { role: "user", content: `Dá-me uma aula sobre: ${data.topic}. Nível ${data.level}.` },
      ],
    });
    if (!text) throw new Error("Não consegui preparar a aula agora. Tenta outra vez.");
    return { text };
  });

export interface SpeakingTask {
  /** "repeat" = repetir a frase; "answer" = responder à pergunta em inglês */
  type: "repeat" | "answer";
  /** frase-modelo em inglês (a dizer, ou uma boa resposta possível) */
  target: string;
  /** pergunta/instrução em inglês quando type === "answer" */
  cue: string;
  /** tradução/contexto em português de Angola */
  translation: string;
  /** dica de pronúncia em português de Angola */
  tip: string;
}

export interface SpeakingDrill {
  title: string;
  intro: string;
  tasks: SpeakingTask[];
}

const speakingSchema = z.object({
  title: z.string(),
  intro: z.string(),
  tasks: z
    .array(
      z.object({
        type: z.enum(["repeat", "answer"]).default("repeat"),
        target: z.string().min(1),
        cue: z.string().default(""),
        translation: z.string().default(""),
        tip: z.string().default(""),
      }),
    )
    .min(1),
});

const SPEAKING_PROMPT =
  'És o Alex, professor angolano de inglês. Crias treinos de SPEAKING (falar em voz alta) para alunos angolanos. NUNCA crias perguntas de escolha múltipla nem exercícios de escrita. Respondes SEMPRE em JSON válido: {"title": string, "intro": string curta em português de Angola, "tasks": [{"type": "repeat" ou "answer", "target": frase em INGLÊS que o aluno deve dizer (5 a 14 palavras, natural, sem aspas), "cue": se type for "answer", a pergunta em INGLÊS que o aluno ouve; se for "repeat", string vazia, "translation": tradução em português de Angola, "tip": dica curta de pronúncia em português de Angola (sons difíceis para angolanos, como th, r final, -ed, h aspirado)}]}. Cria exatamente 5 tasks: 3 do tipo "repeat" e 2 do tipo "answer". Contextos angolanos do dia-a-dia (Luanda, candongueiro, mercado, trabalho, escola, kizomba).';

export const generateSpeakingDrill = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ level: levelSchema, name: z.string().default("") }).parse(input),
  )
  .handler(async ({ data }): Promise<SpeakingDrill> => {
    const raw = await groqChat({
      temperature: 0.8,
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SPEAKING_PROMPT },
        {
          role: "user",
          content: `Cria um treino de speaking para o nível ${data.level}${data.name ? ` do aluno ${data.name}` : ""}.`,
        },
      ],
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Não consegui preparar o treino de fala. Tenta outra vez.");
    }
    const result = speakingSchema.safeParse(parsed);
    if (!result.success) throw new Error("O treino veio com um formato estranho. Tenta outra vez.");
    return { ...result.data, tasks: result.data.tasks.slice(0, 6) };
  });

const scoreSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  better: z.string().default(""),
});

/** Compara o que o aluno disse com a frase-alvo e devolve nota + correção do Alex. */
export const scoreSpeaking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        target: z.string().min(1),
        cue: z.string().default(""),
        said: z.string().min(1),
        type: z.enum(["repeat", "answer"]).default("repeat"),
        level: levelSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ score: number; feedback: string; better: string }> => {
    const raw = await groqChat({
      temperature: 0.3,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'És o Alex, professor angolano de inglês. Avalias a FALA de um aluno angolano a partir da transcrição do áudio dele. Sê justo e encorajador: pequenos erros de transcrição não devem baixar muito a nota. Respondes SEMPRE em JSON: {"score": número 0-100 de quão perto ficou do inglês correto, "feedback": 1 ou 2 frases em português de Angola a dizer o que esteve bem e o que corrigir na pronúncia ou nas palavras (sem listas, sem markdown), "better": a versão em inglês bem dita que o aluno deve treinar}.',
        },
        {
          role: "user",
          content:
            data.type === "answer"
              ? `Nível ${data.level}. Pergunta em inglês: "${data.cue}". Resposta-modelo: "${data.target}". O aluno disse: "${data.said}". Avalia a resposta dele (pode ser diferente da modelo desde que faça sentido em inglês).`
              : `Nível ${data.level}. Frase a repetir: "${data.target}". O aluno disse: "${data.said}". Avalia quão perto ficou.`,
        },
      ],
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Não consegui avaliar a tua fala agora. Tenta outra vez.");
    }
    const result = scoreSchema.safeParse(parsed);
    if (!result.success) throw new Error("A avaliação veio estranha. Tenta outra vez.");
    return {
      score: Math.max(0, Math.min(100, Math.round(result.data.score))),
      feedback: result.data.feedback,
      better: result.data.better,
    };
  });
