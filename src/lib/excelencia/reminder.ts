// Lembrete diário para praticar.
// - Na app nativa (Capacitor com o plugin LocalNotifications) o lembrete agenda-se no sistema
//   e toca todos os dias, mesmo com a app fechada.
// - No navegador/PWA só dispara com a app aberta ou em segundo plano; quando o aluno abre a app
//   depois da hora, aparece o aviso no ecrã Início.
export type Reminder = { enabled: boolean; time: string; lastDay: string | null };

export const REMINDER_PRESETS = ["07:00", "12:30", "19:00", "21:00"];

const NOTIF_ID = 1001;

type NativePlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (o: unknown) => Promise<unknown>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<unknown>;
};

function native(): NativePlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.LocalNotifications as NativePlugin | undefined) ?? null;
}

const parse = (time: string) => {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 19, minute: Number.isFinite(m) ? m : 0 };
};

/** True se já passou a hora do lembrete de hoje. */
export function isPastReminderTime(time: string, now = new Date()) {
  const { hour, minute } = parse(time);
  return now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute;
}

export function reminderCopy(name: string, streak: number) {
  const who = name ? `${name}, ` : "";
  return {
    title: `${who}5 minutos com o Alex?`,
    body: streak > 0 ? `A tua sequência de ${streak} dia${streak === 1 ? "" : "s"} espera por ti.` : "Pratica hoje e começa a tua sequência.",
  };
}

/** Pede permissão. Chamar sempre a partir de um toque do aluno. */
export async function requestReminderPermission(): Promise<"granted" | "denied" | "unsupported"> {
  try {
    const n = native();
    if (n) return (await n.requestPermissions()).display === "granted" ? "granted" : "denied";
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return (await Notification.requestPermission()) === "granted" ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/** Agenda (ou cancela) o lembrete diário na app nativa. No navegador não faz nada. */
export async function syncNativeReminder(r: Reminder, name: string, streak: number) {
  const n = native();
  if (!n) return;
  try {
    await n.cancel({ notifications: [{ id: NOTIF_ID }] });
    if (!r.enabled) return;
    const { hour, minute } = parse(r.time);
    const { title, body } = reminderCopy(name, streak);
    await n.schedule({
      notifications: [{ id: NOTIF_ID, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true } }],
    });
  } catch {
    /* sem suporte nativo */
  }
}

/** Mostra a notificação no navegador (só se a permissão já foi dada). */
export async function showWebReminder(name: string, streak: number) {
  if (native() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const { title, body } = reminderCopy(name, streak);
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "excelencia-lembrete" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    /* ignorar */
  }
}
