import { useEffect, useState } from "react";

// Texto mostrado por baixo do logo. Altera aqui se precisares.
const CREDITO = "by KwanzaTECH Startup";

const MOSTRAR_MS = 2200;
const DESVANECER_MS = 500;

export function Splash() {
  const [fase, setFase] = useState<"visivel" | "saindo" | "fora">("visivel");

  useEffect(() => {
    const a = window.setTimeout(() => setFase("saindo"), MOSTRAR_MS);
    const b = window.setTimeout(() => setFase("fora"), MOSTRAR_MS + DESVANECER_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);

  if (fase === "fora") return null;

  return (
    <div
      role="status"
      aria-label={CREDITO}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#0a0a0a",
        color: "#ffffff",
        opacity: fase === "saindo" ? 0 : 1,
        transition: `opacity ${DESVANECER_MS}ms ease`,
        pointerEvents: fase === "saindo" ? "none" : "auto",
        textAlign: "center",
        padding: 24,
      }}
    >
      <img src="/kwanzatech-logo.png" alt="KwanzaTECH" width={140} height={140} />
      <div style={{ fontSize: 15, opacity: 0.8, letterSpacing: 0.6 }}>{CREDITO}</div>
    </div>
  );
}
