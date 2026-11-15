import { useTheme } from "../../contexts/ThemeContext";
import { homeLine, homeMuted } from "./homeUtils";

// Cabeçalho único para todas as secções da Home: rótulo, linha fina e ação. `fill`: o conteúdo estica até ao fundo (colunas lado a lado ficam iguais).
export function HomeSection({ title, action, onAction, children, style, fill }) {
  const { accent, darkMode } = useTheme();
  return (
    <section style={{ padding: "0 0 28px", ...(fill ? { display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" } : null), ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: homeMuted(darkMode), margin: 0, whiteSpace: "nowrap" }}>{title}</h2>
        <span style={{ flex: 1, height: 1, background: homeLine(darkMode), minWidth: 12 }} />
        {action && (
          <button onClick={onAction} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "4px 0", whiteSpace: "nowrap", flexShrink: 0 }}>{action}</button>
        )}
      </div>
      {fill ? <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div> : children}
    </section>
  );
}
