import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";

// ─── Secção "Estatísticas" do perfil (PC): distribuição de ratings + números-chave ───
export function ProfileEstatisticas({ items, panelBg }) {
  const { accent, darkMode, panelBg: ctxPanelBg } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";

  const d = useMemo(() => {
    const list = items || [];
    const rated = list.filter(i => i.userRating > 0);
    const bins = Array.from({ length: 10 }, () => 0);
    rated.forEach(i => { bins[Math.min(10, Math.max(1, Math.ceil(i.userRating))) - 1] += 1; });
    const max = Math.max(1, ...bins);
    const modeIdx = rated.length ? bins.indexOf(max) : -1;
    const avg = rated.length ? rated.reduce((a, i) => a + i.userRating, 0) / rated.length : null;
    const high = rated.filter(i => i.userRating >= 8).length;
    return { total: list.length, rated: rated.length, bins, max, modeIdx, avg, highPct: rated.length ? Math.round((high / rated.length) * 100) : 0 };
  }, [items]);

  if (!d.rated) return null;

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)";
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || ctxPanelBg || glass, borderRadius: 22, border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)"}`, padding: "22px 26px", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", display: "flex", gap: 36, color: text };

  const kpi = (value, label, extra) => (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${line}` }}>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: sub, marginTop: 4 }}>{label}</div>
      {extra}
    </div>
  );
  const fmt = (n) => n.toFixed(1).replace(".", ",");
  const pct = (n) => Math.round((n / d.rated) * 100);

  return (
    <div style={card}>
      <style>{`
        .pe-bar { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
        .pe-fill { transition: filter .15s ease; }
        .pe-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(4px); opacity: 0; pointer-events: none; white-space: nowrap; padding: 6px 10px; border-radius: 9px; background: #14171d; border: 1px solid rgba(255,255,255,.16); color: #e6edf3; font-size: 11px; font-weight: 700; box-shadow: 0 10px 20px -8px rgba(0,0,0,.8); transition: opacity .14s ease, transform .14s ease; z-index: 6; }
        @media (hover:hover) { .pe-bar:hover .pe-tip { opacity: 1; transform: translateX(-50%); } .pe-bar:hover .pe-fill { filter: brightness(1.3); } }
      `}</style>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{en ? "Statistics" : "Estatísticas"}</div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: muted }}>{en ? "Ratings distribution" : "Distribuição de ratings"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, height: 170, alignItems: "flex-end", paddingTop: 20 }}>
          {d.bins.map((n, i) => (
            <div key={i} className="pe-bar">
              <div className="pe-tip">{en ? `Rating ${i + 1} · ${n} items · ${pct(n)}%` : `Nota ${i + 1} · ${n} itens · ${pct(n)}%`}</div>
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i === d.modeIdx ? text : muted, marginBottom: 4 }}>{n}</div>
              <div className="pe-fill" style={{ height: `${Math.max(3, (n / d.max) * 100)}%`, borderRadius: "6px 6px 0 0", background: accent, opacity: 0.34 + 0.66 * (n / d.max) }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {d.bins.map((_, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: muted, fontWeight: i === d.modeIdx ? 800 : 500 }}>{i + 1}</div>)}
        </div>
      </div>
      <div style={{ width: 240, flexShrink: 0 }}>
        {kpi(fmt(d.avg), en ? "average rating" : "média de rating")}
        {kpi(d.modeIdx + 1, en ? "most given rating" : "nota mais dada", <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{d.bins[d.modeIdx]} {en ? "items" : "itens"} · {pct(d.bins[d.modeIdx])}%</div>)}
        {kpi(`${d.highPct}%`, en ? "rated 8 or higher" : "com nota 8 ou mais")}
        <div style={{ paddingTop: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{d.rated}<span style={{ fontSize: 14, color: muted, fontWeight: 600 }}> / {d.total}</span></div>
          <div style={{ fontSize: 12, color: sub, marginTop: 4 }}>{en ? "items rated" : "itens avaliados"}</div>
          <div style={{ height: 5, borderRadius: 3, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((d.rated / Math.max(1, d.total)) * 100)}%`, height: "100%", background: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}
