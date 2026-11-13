import { useTheme } from "../../contexts/ThemeContext";
import { homeLine, homeMuted } from "./homeUtils";

// Cabeçalho único para todas as secções da Home: rótulo, linha fina e ação.
export function HomeSection({ title, action, onAction, children, style }) {
  const { accent, darkMode } = useTheme();
  return (
    <section style={{ padding: "0 0 28px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: homeMuted(darkMode), margin: 0, whiteSpace: "nowrap" }}>{title}</h2>
        <span style={{ flex: 1, height: 1, background: homeLine(darkMode) }} />
        {action && (
          <button onClick={onAction} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: 0, whiteSpace: "nowrap" }}>{action}</button>
        )}
      </div>
      {children}
    </section>
  );
}
