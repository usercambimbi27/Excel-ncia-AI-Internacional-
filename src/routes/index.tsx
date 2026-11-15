import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppMenu } from "@/components/excelencia/AppMenu";
import { applyTheme } from "@/lib/excelencia/theme";
import { isPastReminderTime, showWebReminder, syncNativeReminder } from "@/lib/excelencia/reminder";
import { today, useAppState } from "@/lib/excelencia/state";
import { Onboarding } from "@/components/excelencia/Onboarding";
import { BottomNav, type TabId } from "@/components/excelencia/BottomNav";
import { HomeTab } from "@/components/excelencia/HomeTab";
import { ChatTab } from "@/components/excelencia/ChatTab";
import { ProgressTab } from "@/components/excelencia/ProgressTab";
import { RankingTab } from "@/components/excelencia/RankingTab";
import { TutorTab } from "@/components/excelencia/TutorTab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Excelência AI English — Professor de inglês para angolanos" },
      {
        name: "description",
        content:
          "Aprende inglês com o Alex, professor angolano com inteligência artificial. Conversa por texto ou voz, ganha XP e sobe de nível.",
      },
      { property: "og:title", content: "Excelência AI English" },
      {
        property: "og:description",
        content: "O teu professor de inglês angolano com IA: chat, modo voz, missões e ranking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
  ssr: false,
});

function App() {
  const store = useAppState();
  const { state, hydrated, update } = store;
  const [tab, setTab] = useState<TabId>("home");
  const [chatVoice, setChatVoice] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tema claro/escuro.
  useEffect(() => {
    if (hydrated) applyTheme(state.theme);
  }, [hydrated, state.theme]);

  // Relógio leve para saber quando chega a hora do lembrete.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const practicedToday = state.missionsDone.length > 0;
  const reminderDue =
    hydrated &&
    state.onboarded &&
    state.reminder.enabled &&
    !practicedToday &&
    isPastReminderTime(state.reminder.time, new Date(now));

  // Notificação do navegador: uma vez por dia, só se o aluno ainda não praticou.
  useEffect(() => {
    if (!reminderDue || state.reminder.lastDay === today()) return;
    void showWebReminder(state.name, state.streak);
    update((s) => ({ reminder: { ...s.reminder, lastDay: today() } }));
  }, [reminderDue, state.reminder.lastDay, state.name, state.streak, update]);

  // App nativa: agenda o lembrete diário no sistema.
  useEffect(() => {
    if (!hydrated || !state.onboarded) return;
    void syncNativeReminder(state.reminder, state.name, state.streak);
  }, [hydrated, state.onboarded, state.reminder.enabled, state.reminder.time, state.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (!state.onboarded) {
    return (
      <Onboarding
        initialTheme={state.theme}
        onThemeChange={(theme) => update({ theme })}
        onDone={(r) => update({ ...r, onboarded: true })}
      />
    );
  }

  const openChat = (voice = false) => {
    setChatVoice(voice);
    setTab("chat");
  };
  const changeTab = (t: TabId) => {
    setChatVoice(false);
    setTab(t);
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background">
      {tab === "home" && <HomeTab store={store} onOpenChat={openChat} reminderDue={reminderDue} />}
      {tab === "chat" && <ChatTab store={store} startVoice={chatVoice} />}
      {tab === "progress" && <ProgressTab store={store} />}
      {tab === "ranking" && <RankingTab name={state.name} xp={state.xp} />}
      {tab === "tutor" && <TutorTab store={store} />}
      <AppMenu store={store} />
      <BottomNav active={tab} onChange={changeTab} />
    </div>
  );
}
