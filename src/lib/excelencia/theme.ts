// Tema do app: escuro (padrão) ou claro. Aplica-se com a classe "light" no <html>.
export type Theme = "dark" | "light";

const COLORS: Record<Theme, string> = { dark: "#1a1f3a", light: "#f3f5fb" };

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("light", theme === "light");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", COLORS[theme]);
}
