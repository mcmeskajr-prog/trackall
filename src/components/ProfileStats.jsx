import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import dragon9 from "../assets/dragons/tribal-9.svg";
import dragon31 from "../assets/dragons/tribal-31.svg";
import dragon22 from "../assets/dragons/tribal-22.svg";
import dragonWinged from "../assets/dragons/winged.svg";

// Flor de sakura (a mesma do badge do Hall of Fame), na cor do cartão
function Flower({ col, size, rot = 0, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", transform: `rotate(${rot}deg)`, ...style }} aria-hidden="true">
      {[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="12" cy="6.2" rx="3.6" ry="5.6" transform={`rotate(${r} 12 12)`} fill={col} />)}
      <circle cx="12" cy="12" r="2.3" fill="rgba(255,255,255,0.9)" />
    </svg>
  );
}
// Cores dos cartões: parte da cor de destaque e flutua um pouco à volta dela (matiz ±15–30°), para ficar sempre em harmonia com o tema
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return [340, 0.7, 0.58];
  const n = parseInt(m[1], 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function tilePalette(accent) {
  const [h, s0, l0] = hexToHsl(accent);
  const s = Math.min(0.85, Math.max(0.5, s0)), l = Math.min(0.66, Math.max(0.58, l0));
  return [accent, hslToHex(h + 15, s, l), hslToHex(h + 30, s, l), hslToHex(h - 15, s, l)];
}
const MASK = (src) => ({ WebkitMaskImage: `url(${JSON.stringify(src)})`, maskImage: `url(${JSON.stringify(src)})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "right center", maskPosition: "right center", WebkitMaskSize: "contain", maskSize: "contain" });
const FADE = "linear-gradient(90deg, rgba(0,0,0,0.05) 42%, #000 84%)";

// ─── Estatísticas do perfil: tiles de números (com mini-distribuição na média). No telemóvel mantém o cartão de ratings. ───
export function ProfileStats({ items, panelBg, stacked, onFilter }) {
  const { accent, darkMode: pageDark, panelDark, isMobileDevice, panelBg: ctxPanelBg } = useTheme();
  const darkMode = panelDark ?? pageDark;
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
    const inProgress = list.filter(i => i.userStatus === "assistindo").length;
    const now = new Date();
    const newThisMonth = list.filter(i => { if (!i.addedAt) return false; const d = new Date(i.addedAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).length;
    const completedPct = list.length ? Math.round((completed / list.length) * 100) : 0;
    const latest = list.filter(i => i.userStatus === "assistindo" && i.title).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0];
    return { total: list.length, rated: rated.length, avg, completed, inProgress, hist, histMax: Math.max(1, ...hist), h10, h10Max: Math.max(1, ...h10), newThisMonth, completedPct, latestTitle: latest ? latest.title : "" };
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
  const en = lang === "en";
  const pal = useMemo(() => tilePalette(accent), [accent]);
  const tiles = [
    { n: data.total, l: en ? "items" : "itens", f: {}, col: pal[0], icon: "grid", art: { src: dragon9, w: 78, h: 78, r: -14, t: -26, o: 0.5 }, chip: data.newThisMonth > 0 ? (en ? `+${data.newThisMonth} this month` : `+${data.newThisMonth} este mês`) : "" },
    { n: data.completed, l: en ? "completed" : "completados", f: { status: "completo" }, col: pal[1], icon: "check", art: { src: dragon31, w: 80, h: 69, r: -18, t: -14, o: 0.5 }, chip: data.total ? `${data.completedPct}% ${en ? "of library" : "da biblioteca"}` : "" },
    { n: data.avg, l: en ? "average rating" : "média de rating", f: { rating: "rated", sort: "rating" }, mini: true, col: pal[2], icon: "star", art: { src: dragon22, w: 69, h: 69, r: -14, t: -18, o: 0.5 }, chip: "" },
    { n: data.inProgress, l: en ? "in progress" : "em curso", f: { status: "assistindo" }, col: pal[3], icon: "play", art: { src: dragonWinged, w: 62, h: 76, r: -8, t: -4, o: 0.45 }, chip: data.latestTitle ? (data.latestTitle.length > 16 ? data.latestTitle.slice(0, 15) + "…" : data.latestTitle) : "" },
  ];
  const ICONS = {
    grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
    check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
    star: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" /></svg>,
    play: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>,
  };
  const fmtR = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const reset = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: onFilter ? "pointer" : "default" };

  return (
    <div style={{ margin: stacked ? 0 : (isMobileDevice ? "0 0 22px" : "0 16px 18px"), display: "flex", flexDirection: "column", gap: 14, color: text }}>
      <style>{`
        .st-int { transition: transform .15s ease, background-color .15s ease, border-color .15s ease, filter .15s ease; }
        @media (hover:hover) { .st-tile:hover { transform: translateY(-2px); }
          .st-chip:hover { color: ${text} !important; transform: translateY(-1px); }
          .st-seg:hover { filter: brightness(1.25); } .st-bar:hover { filter: brightness(1.35); } }
        .st-mb { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; }
        .st-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(4px); opacity: 0; pointer-events: none; white-space: nowrap; padding: 6px 10px; border-radius: 9px; background: #14171d; border: 1px solid rgba(255,255,255,.16); color: #e6edf3; font-size: 11px; font-weight: 700; box-shadow: 0 10px 20px -8px rgba(0,0,0,.8); transition: opacity .14s ease, transform .14s ease; z-index: 6; }
        @media (hover:hover) { .st-mb:hover .st-tip { opacity: 1; transform: translateX(-50%); } .st-mb:hover .st-fill { filter: brightness(1.3); } }
        .st-int:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(3, minmax(0,1fr))" : stacked ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: isMobileDevice ? 10 : 14 }}>
        {isMobileDevice ? tiles.slice(0, 3).map(t => (
          <button key={t.l} type="button" className="st-int st-tile" onClick={() => go(t.f)} style={{ ...reset, ...card, padding: 12, borderRadius: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{t.n}</div>
            <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>{t.l}</div>
          </button>
        )) : tiles.map(t => (
          <button key={t.l} type="button" className="st-int st-tile" onClick={() => go(t.f)}
            style={{ ...reset, position: "relative", display: "block", containerType: "inline-size", minHeight: 112, boxSizing: "border-box", padding: "14px 16px", borderRadius: 18, margin: 4,
              background: `linear-gradient(180deg, ${t.col}${darkMode ? "24" : "1c"}, ${darkMode ? "rgba(12,10,12,0.92)" : "rgba(255,255,255,0.7)"} 75%), ${darkMode ? "#14121a" : "#ffffff"}`,
              boxShadow: `0 0 0 1px ${t.col}cc, 0 0 0 4px ${t.col}2e, 0 14px 28px -10px ${t.col}80`, color: text }}>
            <span aria-hidden="true" style={{ position: "absolute", left: "14%", right: "14%", top: 0, height: 2, background: `linear-gradient(90deg, transparent, ${t.col}, transparent)`, zIndex: 3, pointerEvents: "none" }} />
            <span aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit", pointerEvents: "none", WebkitMaskImage: FADE, maskImage: FADE }}>
              <span style={{ position: "absolute", right: `${t.art.r}cqw`, top: t.art.t, width: `${t.art.w}cqw`, height: `${t.art.h}cqw`, background: t.col, opacity: t.art.o, ...MASK(t.art.src) }} />
              <Flower col={t.col} size={13} rot={14} style={{ right: "9cqw", top: 12, opacity: 0.9 }} />
              <Flower col={t.col} size={9} rot={-20} style={{ right: "19cqw", top: 30, opacity: 0.75 }} />
              <Flower col={t.col} size={7} rot={40} style={{ right: "6cqw", top: 44, opacity: 0.65 }} />
            </span>
            <span style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: `${t.col}38`, color: t.col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ICONS[t.icon]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 28, fontWeight: 800, lineHeight: 1.05, color: text }}>{t.n}</span>
                <span style={{ display: "block", fontSize: 12, color: sub, marginTop: 3 }}>{t.l}</span>
              </span>
            </span>
            <span style={{ position: "relative", zIndex: 2, display: "block", marginTop: 12, minHeight: 22 }}>
              {t.mini && data.rated > 0 ? (
                <span style={{ display: "flex", gap: 3, width: 96, height: 24, alignItems: "flex-end" }}>
                  {data.h10.map((n, i) => (
                    <span key={i} className="st-mb">
                      <span className="st-tip">{en ? `Rating ${i + 1} · ${n} items · ${Math.round((n / data.rated) * 100)}%` : `Nota ${i + 1} · ${n} itens · ${Math.round((n / data.rated) * 100)}%`}</span>
                      <span className="st-fill" style={{ width: "100%", height: `${Math.max(8, (n / data.h10Max) * 100)}%`, borderRadius: "2px 2px 0 0", background: t.col, opacity: 0.38 + 0.6 * (n / data.h10Max) }} />
                    </span>
                  ))}
                </span>
              ) : t.chip ? (
                <span style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: t.col, background: `${t.col}29`, borderRadius: 99, padding: "2px 9px" }}>{t.chip}</span>
              ) : null}
            </span>
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
