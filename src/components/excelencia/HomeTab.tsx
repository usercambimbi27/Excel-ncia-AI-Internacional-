import { useState } from "react";
import { Bell, BookOpen, Check, Flame, Headphones, MessageCircle, Mic, PenLine } from "lucide-react";
import type { AppStore } from "@/lib/excelencia/state";
import { levelOf, xpInLevel } from "@/lib/excelencia/state";
import { ExerciseModal } from "./ExerciseModal";
import { SpeakingDrill } from "./SpeakingDrill";

const missions = [
  { id: "chat5", label: "Trocar 5 mensagens com o Alex", xp: 30 },
  { id: "voice1", label: "Falar 1 minuto no modo voz", xp: 50 },
  { id: "exercise1", label: "Completar um exercício", xp: 40 },
];

const modules = [
  { id: "vocabulario", label: "Vocabulário", icon: BookOpen, skill: "reading" as const, color: "#4f7cff" },
  { id: "gramatica", label: "Gramática", icon: PenLine, skill: "grammar" as const, color: "#1fae6b" },
  { id: "listening", label: "Listening", icon: Headphones, skill: "listening" as const, color: "#d99a00" },
  { id: "speaking", label: "Speaking", icon: Mic, skill: "speaking" as const, color: "#ef5f4b" },
];

const topics = ["o teu dia", "a tua família", "comida e restaurantes", "o teu trabalho ou estudos", "música e kizomba", "planos para o fim de semana"];
const DAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];


function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
}

export function HomeTab({
  store,
  onOpenChat,
  reminderDue = false,
}: {
  store: AppStore;
  onOpenChat: (voice?: boolean) => void;
  reminderDue?: boolean;
}) {
  const { state, update, addXp, completeMission } = store;
  const [open, setOpen] = useState<(typeof modules)[number] | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const finishSpeaking = (avg: number, tasks: number) => {
    if (!tasks) return;
    addXp(20 + Math.round((avg / 100) * 50));
    completeMission("exercise1", 40);
    update((s) => ({
      lessonsDone: s.lessonsDone + 1,
      minutes: s.minutes + 5,
      skills: {
        ...s.skills,
        speaking: Math.min(100, s.skills.speaking + Math.round((avg / 100) * 10) + 2),
        listening: Math.min(100, s.skills.listening + 2),
      },
    }));
  };

  const finishExercise = (correct: number, total: number) => {
    const mod = open;
    if (!mod) return;
    const ratio = total ? correct / total : 0;
    addXp(10 + Math.round(ratio * 40));
    completeMission("exercise1", 40);
    update((s) => ({
      lessonsDone: s.lessonsDone + 1,
      minutes: s.minutes + 3,
      skills: {
        ...s.skills,
        [mod.skill]: Math.min(100, s.skills[mod.skill] + Math.round(ratio * 8) + 2),
      },
    }));
  };

  const lvl = levelOf(state.xp);
  const inLevel = xpInLevel(state.xp);
  const pct = Math.round((inLevel / 500) * 100);
  const doneCount = state.missionsDone.length;
  const topic = topics[new Date().getDate() % topics.length];

  // Semana de segunda a domingo: os dias da sequência ficam marcados.
  const dow = (new Date().getDay() + 6) % 7;
  const week = DAY_LABELS.map((label, i) => {
    const ago = dow - i;
    return { label, today: ago === 0, on: ago >= 0 && ago < state.streak };
  });

  return (
    <div className="flex flex-col gap-5 px-4 pb-28 pt-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting()}</p>
          <h1 className="truncate font-display text-[26px] font-extrabold leading-tight tracking-tight">
            {state.name || "Estudante"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2">
          <Flame className="h-4 w-4 text-coral" />
          <span className="text-sm font-bold">
            {state.streak} {state.streak === 1 ? "dia" : "dias"}
          </span>
        </div>
      </header>

      {reminderDue && (
        <button
          onClick={() => onOpenChat()}
          className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-left active:scale-[0.99]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Bell className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">Está na hora de praticar</span>
            <span className="block text-xs text-muted-foreground">Cinco minutos com o Alex chegam.</span>
          </span>
        </button>
      )}

      <section className="relative overflow-hidden rounded-[26px] bg-hero p-[18px] text-white shadow-soft">
        <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-goldgrad font-display text-lg font-extrabold text-navy-deep">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight">Alex</p>
            <p className="flex items-center gap-1.5 text-xs opacity-85">
              <span className="h-[7px] w-[7px] rounded-full bg-green" /> Pronto para conversar
            </p>
          </div>
          <div aria-hidden className="flex h-7 items-center gap-[3px]">
            {[8, 16, 24, 12, 20, 28, 14, 22, 10, 18].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-white/65" style={{ height: h }} />
            ))}
          </div>
        </div>
        <p className="relative mt-3.5 rounded-[4px_18px_18px_18px] bg-navy-deep/40 p-3.5 text-[15px] leading-relaxed">
          Vamos praticar 5 minutos? Hoje podemos falar sobre {topic}.
        </p>
        <div className="relative mt-3.5 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => onOpenChat(false)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-green px-4 py-3.5 text-sm font-bold text-navy-deep active:scale-[0.98]"
          >
            <MessageCircle className="h-[18px] w-[18px]" /> Escrever
          </button>
          <button
            onClick={() => onOpenChat(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-navy-deep/50 px-4 py-3.5 text-sm font-bold active:scale-[0.98]"
          >
            <Mic className="h-[18px] w-[18px]" /> Falar
          </button>
        </div>
      </section>

      <section className="rounded-[20px] border border-border bg-card">
        <div className="grid grid-cols-3 divide-x divide-border py-4">
          {[
            { v: state.xp.toLocaleString("pt-PT"), l: "XP total" },
            { v: `${lvl} · ${state.level}`, l: "Nível atual" },
            { v: `${doneCount}/${missions.length}`, l: "Missões feitas" },
          ].map((x) => (
            <div key={x.l} className="px-3.5">
              <p className="font-display text-[22px] font-extrabold leading-none tracking-tight">{x.v}</p>
              <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{x.l}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3.5">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Nível {lvl}</span>
            <span>
              <b className="text-foreground">{500 - inLevel} XP</b> para o nível {lvl + 1}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-goldgrad transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3.5 flex justify-between">
            {week.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ${
                    d.on ? "bg-nav-active" : "bg-secondary"
                  } ${d.today ? "ring-2 ring-nav-active ring-offset-2 ring-offset-card" : ""}`}
                >
                  {d.on && <Check className="h-3.5 w-3.5 text-background" strokeWidth={3.5} />}
                </span>
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 flex items-baseline justify-between font-display text-[17px] font-bold">
          Missões de hoje
          <small className="text-xs font-semibold text-muted-foreground">
            {doneCount} de {missions.length}
          </small>
        </h2>
        <div className="flex flex-col gap-2">
          {missions.map((m) => {
            const done = state.missionsDone.includes(m.id);
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                    done ? "border-green bg-green text-navy-deep" : "border-border"
                  }`}
                >
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                </span>
                <p className={`min-w-0 flex-1 truncate text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                  {m.label}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    done ? "bg-green/20 text-green" : "bg-secondary text-nav-active"
                  }`}
                >
                  {done ? "Feito" : `+${m.xp} XP`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 flex items-baseline justify-between font-display text-[17px] font-bold">
          Módulos de estudo
          <small className="text-xs font-semibold text-muted-foreground">O teu progresso</small>
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {modules.map((m) => {
            const Icon = m.icon;
            const value = Math.min(100, Math.round(state.skills[m.skill]));
            return (
              <button
                key={m.id}
                onClick={() => (m.id === "speaking" ? setSpeaking(true) : setOpen(m))}
                className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-3.5 text-left active:scale-[0.98]"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${m.color} 18%, transparent)`, color: m.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display text-sm font-bold">{m.label}</span>
                    <span className="text-[11px] text-muted-foreground">{value}%</span>
                  </span>
                </span>
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full rounded-full" style={{ width: `${value}%`, background: m.color }} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {open && (
        <ExerciseModal
          tipo={open.id}
          label={open.label}
          level={state.level}
          accent={state.accent}
          onClose={() => setOpen(null)}
          onFinish={finishExercise}
        />
      )}

      {speaking && (
        <SpeakingDrill
          level={state.level}
          name={state.name}
          accent={state.accent}
          onClose={() => setSpeaking(false)}
          onFinish={finishSpeaking}
        />
      )}

    </div>
  );
}
