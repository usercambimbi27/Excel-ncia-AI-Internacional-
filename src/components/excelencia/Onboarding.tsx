import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, BellOff, Check, GraduationCap } from "lucide-react";
import type { Accent, Level, Reminder, Theme } from "@/lib/excelencia/state";
import { REMINDER_PRESETS, requestReminderPermission } from "@/lib/excelencia/reminder";

const levels: { id: Level; title: string; desc: string }[] = [
  { id: "A1", title: "Iniciante", desc: "Estou a começar do zero" },
  { id: "A2", title: "Básico", desc: "Digo frases simples do dia-a-dia" },
  { id: "B1", title: "Intermédio", desc: "Já converso, mas com erros" },
  { id: "B2", title: "Avançado", desc: "Falo bem, quero fluência total" },
];

const accents: { id: Accent; title: string; desc: string; code: string }[] = [
  { id: "angolano", title: "Angolano", desc: "Voz próxima, à nossa maneira", code: "AO" },
  { id: "britanico", title: "Britânico", desc: "Inglês do Reino Unido", code: "UK" },
  { id: "americano", title: "Americano", desc: "Inglês dos Estados Unidos", code: "US" },
];

const TOTAL = 5;

export interface OnboardingResult {
  name: string;
  level: Level;
  accent: Accent;
  theme: Theme;
  reminder: Reminder;
}

function OptionCard({
  active,
  tag,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  tag: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
        active
          ? "border-primary bg-primary/15 ring-4 ring-primary/15"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold tracking-wide transition ${
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
        }`}
      >
        {tag}
      </span>
      <span className="flex-1">
        <span className="block font-display text-base font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <Check className={`h-5 w-5 text-primary transition ${active ? "opacity-100" : "opacity-0"}`} />
    </button>
  );
}

/** Mini pré-visualização do ecrã nos dois temas (cores fixas, não dependem do tema ativo). */
function ThemePreview({ mode, active, onClick }: { mode: Theme; active: boolean; onClick: () => void }) {
  const dark = mode === "dark";
  const c = dark
    ? { bg: "#141a3a", card: "#242b55", line: "#3a4278", text: "#f2f4ff", accent: "#4f63e6" }
    : { bg: "#f3f5fb", card: "#ffffff", line: "#dde2f2", text: "#14183a", accent: "#4f63e6" };
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
        active
          ? "border-primary bg-primary/15 ring-4 ring-primary/15"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <span
        className="block rounded-xl p-3"
        style={{ background: c.bg, border: `1px solid ${c.line}` }}
        aria-hidden
      >
        <span className="block h-2 w-10 rounded-full" style={{ background: c.text, opacity: 0.85 }} />
        <span className="mt-2 block h-9 rounded-lg" style={{ background: c.accent }} />
        <span className="mt-2 block h-5 rounded-md" style={{ background: c.card, border: `1px solid ${c.line}` }} />
        <span className="mt-1.5 block h-5 rounded-md" style={{ background: c.card, border: `1px solid ${c.line}` }} />
      </span>
      <span className="flex items-center justify-between px-1">
        <span className="font-display text-sm font-bold">{dark ? "Escuro" : "Claro"}</span>
        <Check className={`h-4 w-4 text-primary transition ${active ? "opacity-100" : "opacity-0"}`} />
      </span>
    </button>
  );
}

export function Onboarding({
  initialTheme = "dark",
  onThemeChange,
  onDone,
}: {
  initialTheme?: Theme;
  onThemeChange?: (t: Theme) => void;
  onDone: (r: OnboardingResult) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("A1");
  const [accent, setAccent] = useState<Accent>("angolano");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [remindOn, setRemindOn] = useState(true);
  const [time, setTime] = useState("19:00");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanName = name.trim();
  const firstName = cleanName.split(/\s+/)[0] ?? "";

  useEffect(() => {
    if (step === 0) inputRef.current?.focus({ preventScroll: true });
  }, [step]);

  const chooseTheme = (t: Theme) => {
    setTheme(t);
    onThemeChange?.(t);
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    if (remindOn) await requestReminderPermission();
    onDone({
      name: cleanName,
      level,
      accent,
      theme,
      reminder: { enabled: remindOn, time, lastDay: null },
    });
  };

  const next = () => {
    if (step < TOTAL - 1) setStep(step + 1);
    else void finish();
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const cta =
    step === 0 ? (cleanName ? "Continuar" : "Saltar") : step === TOTAL - 1 ? "Entrar na aula" : "Continuar";

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden px-6 pb-8 pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--gradient-hero)" }}
      />

      <header className="relative z-10 flex items-center gap-4">
        <button
          onClick={back}
          disabled={step === 0}
          aria-label="Voltar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card/60 text-foreground transition active:scale-95 disabled:pointer-events-none disabled:opacity-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={step + 1}
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: i <= step ? "100%" : "0%" }}
              />
            </span>
          ))}
        </div>
        <span className="w-10 text-right text-xs font-semibold text-muted-foreground">
          {step + 1}/{TOTAL}
        </span>
      </header>

      <main
        key={step}
        className="relative z-10 flex flex-1 flex-col pt-8 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-goldgrad shadow-soft">
              <GraduationCap className="h-8 w-8 text-navy-deep" />
            </div>
            <h1 className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight">
              Olá! Eu sou o Alex.
            </h1>
            <p className="mt-3 max-w-[34ch] text-base leading-relaxed text-muted-foreground">
              O teu professor de inglês, sempre no bolso. Como te devo chamar?
            </p>
            <div className="mt-8">
              <label htmlFor="exc-name" className="sr-only">
                O teu nome
              </label>
              <input
                id="exc-name"
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
                placeholder="O teu nome"
                autoComplete="given-name"
                autoCapitalize="words"
                maxLength={40}
                className="w-full rounded-2xl border border-input bg-card px-5 py-4 text-lg font-semibold outline-none transition placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Podes saltar este passo. O nome só serve para o Alex falar contigo.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              {firstName ? `${firstName}, qual é o teu nível?` : "Qual é o teu nível?"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Isto ajuda o Alex a falar contigo na medida certa. Podes mudar depois.
            </p>
            <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label="Nível de inglês">
              {levels.map((l) => (
                <OptionCard
                  key={l.id}
                  active={level === l.id}
                  tag={l.id}
                  title={l.title}
                  desc={l.desc}
                  onClick={() => setLevel(l.id)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              Com que voz queres aprender?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              É o sotaque com que o Alex fala inglês contigo. Podes mudar depois.
            </p>
            <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label="Sotaque do Alex">
              {accents.map((a) => (
                <OptionCard
                  key={a.id}
                  active={accent === a.id}
                  tag={a.code}
                  title={a.title}
                  desc={a.desc}
                  onClick={() => setAccent(a.id)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              Como preferes o ecrã?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Escolhe o tema que for mais confortável para os teus olhos. Podes mudar no menu.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tema">
              <ThemePreview mode="dark" active={theme === "dark"} onClick={() => chooseTheme("dark")} />
              <ThemePreview mode="light" active={theme === "light"} onClick={() => chooseTheme("light")} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-1 flex-col">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              A que horas queres praticar?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              O Alex lembra-te todos os dias. Cinco minutos chegam para manter o ritmo.
            </p>

            <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label="Lembrete diário">
              <OptionCard
                active={remindOn}
                tag="ON"
                title="Lembrar-me todos os dias"
                desc="Recebes um aviso à hora que escolheres"
                onClick={() => setRemindOn(true)}
              />
              <OptionCard
                active={!remindOn}
                tag="OFF"
                title="Agora não"
                desc="Podes ativar mais tarde no menu"
                onClick={() => setRemindOn(false)}
              />
            </div>

            <div
              className={`mt-6 transition ${remindOn ? "opacity-100" : "pointer-events-none opacity-40"}`}
              aria-hidden={!remindOn}
            >
              <div className="flex flex-wrap gap-2">
                {REMINDER_PRESETS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                      time === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label
                htmlFor="exc-time"
                className="mt-4 flex items-center justify-between rounded-2xl border border-input bg-card px-5 py-3"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  {remindOn ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
                  Outra hora
                </span>
                <input
                  id="exc-time"
                  type="time"
                  value={time}
                  onChange={(e) => e.target.value && setTime(e.target.value)}
                  className="bg-transparent text-lg font-bold outline-none"
                />
              </label>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 pt-6">
        <button
          onClick={next}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-soft transition active:scale-[0.98] disabled:opacity-60"
        >
          {cta}
          <ArrowRight className="h-5 w-5" />
        </button>
      </footer>
    </div>
  );
}
