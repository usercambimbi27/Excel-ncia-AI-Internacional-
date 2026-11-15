import { useEffect, useState } from "react";
import { Menu, Lock, Palette, Bell } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getUserKey, setUserKey, isUnlocked, setUnlocked, onAccessChange } from "@/lib/excelencia/access";
import type { AppStore, Theme } from "@/lib/excelencia/state";
import { REMINDER_PRESETS, requestReminderPermission } from "@/lib/excelencia/reminder";
import { verifyUnlock, validateGroqKey } from "@/lib/excelencia/access.functions";

export function AppMenu({ store }: { store: AppStore }) {
  const { state, update } = store;
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [unlocked, setUnlockedState] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const unlock = useServerFn(verifyUnlock);
  const validate = useServerFn(validateGroqKey);

  useEffect(() => {
    const sync = () => {
      setUnlockedState(isUnlocked());
      setHasKey(!!getUserKey());
    };
    sync();
    return onAccessChange(sync);
  }, []);

  const tryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { ok } = await unlock({ data: { password: pw } });
    setBusy(false);
    setPwErr(!ok);
    if (ok) { setUnlocked(true); setPw(""); }
  };

  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await validate({ data: { key: key.trim() } }).catch(() => ({ ok: false, status: 0 }));
    setBusy(false);
    if (r.ok) { setUserKey(key.trim()); setKey(""); setMsg("Chave guardada. Já podes usar o app."); }
    else if (r.status === 429) setMsg("A Groq está em limite de pedidos. Tenta daqui a pouco.");
    else setMsg("Chave inválida. Confirma e cola outra vez.");
  };

  const setTheme = (theme: Theme) => update({ theme });
  const setReminder = (patch: Partial<AppStore["state"]["reminder"]>) =>
    update((s) => ({ reminder: { ...s.reminder, ...patch } }));
  const toggleReminder = async (enabled: boolean) => {
    setReminder({ enabled });
    if (enabled) setNotifBlocked((await requestReminderPermission()) === "denied");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label="Menu" className="fixed bottom-24 right-3 z-40 flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 text-sm text-foreground shadow-soft backdrop-blur">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto bg-background text-foreground">
        <SheetHeader><SheetTitle className="text-foreground">Menu</SheetTitle></SheetHeader>

        <section className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><Palette className="h-4 w-4" /> Aparência</h3>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
            {([["dark", "Escuro"], ["light", "Claro"]] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={state.theme === id} onClick={() => setTheme(id)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  state.theme === id ? "border-primary bg-primary/15" : "border-border bg-card"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" /> Lembrete diário</h3>
          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold">Lembrar-me de praticar</span>
            <Switch checked={state.reminder.enabled} onCheckedChange={(v) => void toggleReminder(v)} />
          </label>
          {state.reminder.enabled && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {REMINDER_PRESETS.map((t) => (
                  <button key={t} onClick={() => setReminder({ time: t })}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                      state.reminder.time === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
                <span className="text-sm">Outra hora</span>
                <input type="time" value={state.reminder.time}
                  onChange={(e) => e.target.value && setReminder({ time: e.target.value })}
                  className="bg-transparent text-base font-bold outline-none" />
              </label>
              {notifBlocked && (
                <p className="text-xs text-destructive">
                  As notificações estão bloqueadas no teu telemóvel. Ativa-as nas definições do navegador para receberes o aviso.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Se a app estiver fechada, o aviso aparece quando a abrires depois desta hora.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Palavra-passe</h3>
          {!unlocked ? (
            <form onSubmit={tryUnlock} className="space-y-2">
              <Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(false); }} autoComplete="off" />
              {pwErr && <p className="text-sm text-destructive">Palavra-passe incorreta</p>}
              <Button type="submit" disabled={busy || !pw} className="w-full">Entrar</Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {hasKey ? "A tua chave Groq está ativa. Podes trocá-la abaixo." : "Cola a tua chave Groq para ativar o app."}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Abre console.groq.com e entra com o teu email.</li>
                <li>Vai a "API Keys" e toca em "Create API Key".</li>
                <li>Copia a chave (começa por gsk_) e cola aqui.</li>
              </ol>
              <form onSubmit={saveKey} className="space-y-2">
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_..." autoComplete="off" />
                <Button type="submit" disabled={busy || key.trim().length < 10} className="w-full">Testar e guardar</Button>
              </form>
              {msg && <p className="text-sm">{msg}</p>}
              <div className="flex gap-2">
                {hasKey && <Button variant="outline" className="flex-1" onClick={() => setUserKey("")}>Remover chave</Button>}
                <Button variant="ghost" className="flex-1" onClick={() => setUnlocked(false)}>Bloquear</Button>
              </div>
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
