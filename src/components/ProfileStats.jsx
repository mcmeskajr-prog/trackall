import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, STATUS_OPTIONS, TYPE_COLORS, mediaLabel, statusLabel } from "../config/constants";

// ─── Estatísticas do perfil (Fase 2): números, barra por tipo, ratings e estados ───
export function ProfileStats({ items, panelBg, stacked, onFilter }) {
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
    // 20 barras: 0.5, 1, 1.5 … 10 (meias estrelas incluídas)
    const hist = Array.from({ length: 20 }, () => 0);
    rated.forEach(i => { const b = Math.min(20, Math.max(1, Math.round(i.userRating * 2))); hist[b - 1] += 1; });
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

  // Cada número abre a Biblioteca já filtrada
  const go = (f) => onFilter && onFilter(f);
  const tiles = [
    { n: data.total, l: lang === "en" ? "items" : "itens", f: {} },
    { n: data.completed, l: lang === "en" ? "completed" : "completados", f: { status: "completo" } },
    { n: data.avg, l: lang === "en" ? "average rating" : "média de rating", f: { rating: "rated", sort: "rating" } },
    { n: data.rated, l: lang === "en" ? "rated" : "avaliados", f: { rating: "rated" } },
  ];
  const fmtR = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const reset = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: onFilter ? "pointer" : "default" };

  return (
    <div style={{ margin: stacked ? 0 : "0 16px 28px", display: "flex", flexDirection: "column", gap: 14, color: text }}>
      <style>{`
        .st-int { transition: transform .15s ease, background-color .15s ease, border-color .15s ease, filter .15s ease; }
        @media (hover:hover) { .st-tile:hover { transform: translateY(-2px); border-color: ${accent}88 !important; }
          .st-chip:hover { color: ${text} !important; transform: translateY(-1px); }
          .st-seg:hover { filter: brightness(1.25); } .st-bar:hover { filter: brightness(1.35); } }
        .st-int:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: (isMobileDevice || stacked) ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: isMobileDevice ? 10 : 14 }}>
        {tiles.map(t => (
          <button key={t.l} type="button" className="st-int st-tile" onClick={() => go(t.f)} style={{ ...reset, ...card, padding: isMobileDevice ? 14 : 18 }}>
            <div style={{ fontSize: isMobileDevice ? 24 : 28, fontWeight: 800, lineHeight: 1.1 }}>{t.n}</div>
            <div style={{ fontSize: isMobileDevice ? 11 : 12, color: sub, marginTop: 2 }}>{t.l}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: (isMobileDevice || stacked) ? "column" : "row", gap: isMobileDevice ? 10 : 14 }}>
        <div style={{ ...card, flex: 1, minWidth: 0 }}>
          <div style={eyebrow}>{lang === "en" ? "By type" : "Por tipo"}</div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 3 }}>
            {data.byType.map(({ t, n }) => (
              <button key={t.id} type="button" className="st-int st-seg" aria-label={`${mediaLabel(t, lang)}: ${n}`} onClick={() => go({ type: t.id })} title={`${mediaLabel(t, lang)}: ${n}`} style={{ ...reset, flexGrow: n, background: TYPE_COLORS[t.id] || accent, borderRadius: 3 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 12 }}>
            {data.byType.map(({ t, n }) => (
              <button key={t.id} type="button" className="st-int st-chip" onClick={() => go({ type: t.id })} style={{ ...reset, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: sub }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLORS[t.id] || accent, flexShrink: 0 }} />
                {mediaLabel(t, lang)} <b style={{ color: text }}>{n}</b>
              </button>
            ))}
          </div>
          <div style={{ height: 1, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)", margin: "14px 0 12px" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
            {data.byStatus.map(({ s, n }) => (
              <button key={s.id} type="button" className="st-int st-chip" onClick={() => go({ status: s.id })} style={{ ...reset, fontSize: 12, color: sub }}>
                <span style={{ color: s.color, fontWeight: 800, fontSize: 14, marginRight: 5 }}>{n}</span>{statusLabel(s, lang)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...card, width: (isMobileDevice || stacked) ? "auto" : 300, flexShrink: 0 }}>
          <div style={eyebrow}>{lang === "en" ? "Ratings" : "Distribuição de ratings"}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 76 }}>
            {data.hist.map((n, i) => {
              const r = (i + 1) / 2;
              return (
                <button key={i} type="button" className="st-int st-bar" disabled={!n} onClick={() => go({ rating: r })}
                  title={`★ ${fmtR(r)}: ${n}`} aria-label={`★ ${fmtR(r)}: ${n}`}
                  style={{ ...reset, flex: 1, height: `${Math.max(4, (n / data.histMax) * 100)}%`, borderRadius: "3px 3px 0 0", background: accent, opacity: n ? 0.45 + 0.55 * (n / data.histMax) : 0.15, cursor: n && onFilter ? "pointer" : "default" }} />
              );
            })}
          </div>
          <div style={{ position: "relative", height: 14, marginTop: 4, fontSize: 10, color: muted }}>
            {[[1, "1"], [5, "5"], [10, "10"]].map(([r, l]) => (
              <span key={l} style={{ position: "absolute", left: `${((r * 2 - 1 + 0.5) / 20) * 100}%`, transform: "translateX(-50%)" }}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
