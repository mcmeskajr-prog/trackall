import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";

// ─── Estatísticas do perfil: tiles de números (com mini-distribuição na média). No telemóvel mantém o cartão de ratings. ───
export function ProfileStats({ items, panelBg, stacked, onFilter }) {
  const { accent, darkMode, isMobileDevice, panelBg: ctxPanelBg } = useTheme();
  const { lang } = useLang();

  const data = useMemo(() => {
    const list = items || [];
    const rated = list.filter(i => i.userRating > 0);
    const avg = rated.length ? (rated.reduce((a, i) => a + i.userRating, 0) / rated.length).toFixed(1) : "—";
    const completed = list.filter(i => i.userStatus === "completo").length;
    // 20 barras: 0.5, 1, 1.5 … 10 (meias estrelas incluídas)
    const hist = Array.from({ length: 20 }, () => 0);
    rated.forEach(i => { const b = Math.min(20, Math.max(1, Math.round(i.userRating * 2))); hist[b - 1] += 1; });
    // 10 barras (notas inteiras; meias estrelas contam para a nota seguinte)
    const h10 = Array.from({ length: 10 }, () => 0);
    rated.forEach(i => { h10[Math.min(10, Math.max(1, Math.ceil(i.userRating))) - 1] += 1; });
    return { total: list.length, rated: rated.length, avg, completed, hist, histMax: Math.max(1, ...hist), h10, h10Max: Math.max(1, ...h10) };
  }, [items]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const muted = darkMode ? "#8b949e" : "#64748b";
  // Mesmo vidro do ProfileCard; só usa panelBg quando o utilizador personalizou os painéis
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || ctxPanelBg || glass, borderRadius: 18, border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)"}`, padding: "16px 18px", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" };
  const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 12 };

  // Cada número abre a Biblioteca já filtrada
  const go = (f) => onFilter && onFilter(f);
  const tiles = [
    { n: data.total, l: lang === "en" ? "items" : "itens", f: {} },
    { n: data.completed, l: lang === "en" ? "completed" : "completados", f: { status: "completo" } },
    { n: data.avg, l: lang === "en" ? "average rating" : "média de rating", f: { rating: "rated", sort: "rating" }, mini: true },
    { n: data.rated, l: lang === "en" ? "rated" : "avaliados", f: { rating: "rated" } },
  ];
  const fmtR = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const reset = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: onFilter ? "pointer" : "default" };

  return (
    <div style={{ margin: stacked ? 0 : (isMobileDevice ? "0 0 22px" : "0 16px 28px"), display: "flex", flexDirection: "column", gap: 14, color: text }}>
      <style>{`
        .st-int { transition: transform .15s ease, background-color .15s ease, border-color .15s ease, filter .15s ease; }
        @media (hover:hover) { .st-tile:hover { transform: translateY(-2px); border-color: ${accent}88 !important; }
          .st-chip:hover { color: ${text} !important; transform: translateY(-1px); }
          .st-seg:hover { filter: brightness(1.25); } .st-bar:hover { filter: brightness(1.35); } }
        .st-mb { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; }
        .st-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(4px); opacity: 0; pointer-events: none; white-space: nowrap; padding: 6px 10px; border-radius: 9px; background: #14171d; border: 1px solid rgba(255,255,255,.16); color: #e6edf3; font-size: 11px; font-weight: 700; box-shadow: 0 10px 20px -8px rgba(0,0,0,.8); transition: opacity .14s ease, transform .14s ease; z-index: 6; }
        @media (hover:hover) { .st-mb:hover .st-tip { opacity: 1; transform: translateX(-50%); } .st-mb:hover .st-fill { filter: brightness(1.3); } }
        .st-int:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(3, minmax(0,1fr))" : stacked ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: isMobileDevice ? 10 : 14 }}>
        {(isMobileDevice ? tiles.slice(0, 3) : tiles).map(t => (
          <button key={t.l} type="button" className="st-int st-tile" onClick={() => go(t.f)} style={{ ...reset, ...card, padding: isMobileDevice ? 12 : 18, borderRadius: isMobileDevice ? 14 : 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
              <div>
                <div style={{ fontSize: isMobileDevice ? 24 : 28, fontWeight: 800, lineHeight: 1.1 }}>{t.n}</div>
                <div style={{ fontSize: isMobileDevice ? 11 : 12, color: sub, marginTop: 2 }}>{t.l}</div>
              </div>
              {t.mini && !isMobileDevice && data.rated > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <div style={{ display: "flex", gap: 3, width: 92, height: 36, alignItems: "flex-end" }}>
                    {data.h10.map((n, i) => (
                      <span key={i} className="st-mb">
                        <span className="st-tip">{lang === "en" ? `Rating ${i + 1} · ${n} items · ${Math.round((n / data.rated) * 100)}%` : `Nota ${i + 1} · ${n} itens · ${Math.round((n / data.rated) * 100)}%`}</span>
                        <span className="st-fill" style={{ width: "100%", height: `${Math.max(6, (n / data.h10Max) * 100)}%`, borderRadius: "2px 2px 0 0", background: accent, opacity: 0.38 + 0.6 * (n / data.h10Max) }} />
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", width: 92, fontSize: 9, color: muted }}><span>1</span><span>10</span></div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {(isMobileDevice || stacked) && (
      <div style={{ display: "flex", flexDirection: (isMobileDevice || stacked) ? "column" : "row", gap: isMobileDevice ? 10 : 14 }}>
        <div style={{ ...card, width: (isMobileDevice || stacked) ? "auto" : 300, flexShrink: 0, ...(isMobileDevice ? { padding: 14, borderRadius: 14 } : {}) }}>
          <div style={eyebrow}>{lang === "en" ? "Ratings" : "Distribuição de ratings"}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: isMobileDevice ? 52 : 76 }}>
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
      )}
    </div>
  );
}
