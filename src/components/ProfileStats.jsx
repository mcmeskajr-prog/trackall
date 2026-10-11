import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, STATUS_OPTIONS, TYPE_COLORS, mediaLabel, statusLabel } from "../config/constants";

// ─── Estatísticas do perfil (Fase 2): números, barra por tipo, ratings e estados ───
export function ProfileStats({ items, panelBg, stacked }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();

  const data = useMemo(() => {
    const list = items || [];
    const rated = list.filter(i => i.userRating > 0);
    const avg = rated.length ? (rated.reduce((a, i) => a + i.userRating, 0) / rated.length).toFixed(1) : "—";
    const completed = list.filter(i => i.userStatus === "completo").length;
    const byType = MEDIA_TYPES.slice(1)
      .map(t => ({ t, n: list.filter(i => i.type === t.id).length }))
      .filter(x => x.n > 0);
    const hist = Array.from({ length: 10 }, () => 0);
    rated.forEach(i => { const b = Math.min(10, Math.max(1, Math.round(i.userRating))); hist[b - 1] += 1; });
    const byStatus = STATUS_OPTIONS.map(s => ({ s, n: list.filter(i => i.userStatus === s.id).length }));
    return { total: list.length, rated: rated.length, avg, completed, byType, hist, histMax: Math.max(1, ...hist), byStatus };
  }, [items]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const muted = darkMode ? "#8b949e" : "#64748b";
  // Mesmo vidro do ProfileCard; só usa panelBg quando o utilizador personalizou os painéis
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || glass, borderRadius: 18, border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)"}`, padding: "16px 18px", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" };
  const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 12 };

  const tiles = [
    { n: data.total, l: lang === "en" ? "items" : "itens" },
    { n: data.completed, l: lang === "en" ? "completed" : "completados" },
    { n: data.avg, l: lang === "en" ? "average rating" : "média de rating" },
    { n: data.rated, l: lang === "en" ? "rated" : "avaliados" },
  ];

  return (
    <div style={{ margin: stacked ? 0 : "0 16px 28px", display: "flex", flexDirection: "column", gap: 14, color: text }}>
      <div style={{ display: "grid", gridTemplateColumns: (isMobileDevice || stacked) ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: isMobileDevice ? 10 : 14 }}>
        {tiles.map(t => (
          <div key={t.l} style={{ ...card, padding: isMobileDevice ? 14 : 18 }}>
            <div style={{ fontSize: isMobileDevice ? 24 : 28, fontWeight: 800, lineHeight: 1.1 }}>{t.n}</div>
            <div style={{ fontSize: isMobileDevice ? 11 : 12, color: sub, marginTop: 2 }}>{t.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: (isMobileDevice || stacked) ? "column" : "row", gap: isMobileDevice ? 10 : 14 }}>
        <div style={{ ...card, flex: 1, minWidth: 0 }}>
          <div style={eyebrow}>{lang === "en" ? "By type" : "Por tipo"}</div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 3 }}>
            {data.byType.map(({ t, n }) => (
              <div key={t.id} title={`${mediaLabel(t, lang)}: ${n}`} style={{ flexGrow: n, background: TYPE_COLORS[t.id] || accent, borderRadius: 3 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 12 }}>
            {data.byType.map(({ t, n }) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: sub }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLORS[t.id] || accent, flexShrink: 0 }} />
                {mediaLabel(t, lang)} <b style={{ color: text }}>{n}</b>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)", margin: "14px 0 12px" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
            {data.byStatus.map(({ s, n }) => (
              <div key={s.id} style={{ fontSize: 12, color: sub }}>
                <span style={{ color: s.color, fontWeight: 800, fontSize: 14, marginRight: 5 }}>{n}</span>{statusLabel(s, lang)}
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, width: (isMobileDevice || stacked) ? "auto" : 270, flexShrink: 0 }}>
          <div style={eyebrow}>{lang === "en" ? "Ratings" : "Distribuição de ratings"}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 76 }}>
            {data.hist.map((n, i) => (
              <div key={i} title={`${i + 1}: ${n}`} style={{ flex: 1, height: `${Math.max(4, (n / data.histMax) * 100)}%`, borderRadius: "3px 3px 0 0", background: accent, opacity: n ? 0.45 + 0.55 * (n / data.histMax) : 0.15 }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: muted, marginTop: 4 }}><span>1</span><span>10</span></div>
        </div>
      </div>
    </div>
  );
}
