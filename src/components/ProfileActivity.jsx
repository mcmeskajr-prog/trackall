import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MONTH_PT, MONTH_EN } from "../config/constants";

// Atividade (estilo GitHub): cada quadrado é um dia, a intensidade é o nº de obras completadas.
// Usa a mesma data do Diário (`addedAt` dos itens completos). PC: 53 semanas; telemóvel: 26 semanas.
const DAY = 86400000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const keyOf = (t) => startOfDay(t);

export function ProfileActivity({ items, accent = "#dc2626", darkMode = true, isMobile = false, lang = "pt", panelBg = null, onOpen }) {
  const weeks = isMobile ? 26 : 53;
  const en = lang === "en";
  // dia selecionado: hover mostra pré-visualização; clique "fixa" o painel (obras clicáveis)
  const [sel, setSel] = useState(null); // { t, x, y, below, pinned }
  const popRef = useRef(null);

  const data = useMemo(() => {
    const counts = new Map();
    const byDay = new Map();
    (items || []).forEach(i => {
      if (i.userStatus !== "completo" || !i.addedAt) return;
      const k = keyOf(i.addedAt);
      counts.set(k, (counts.get(k) || 0) + 1);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(i);
    });
    const today = startOfDay(Date.now());
    const dow = (new Date(today).getDay() + 6) % 7; // segunda = 0
    const lastMonday = today - dow * DAY;
    const firstMonday = lastMonday - (weeks - 1) * 7 * DAY;
    const cells = [];
    let total = 0;
    for (let c = 0; c < weeks; c++) for (let r = 0; r < 7; r++) {
      // setHours evita saltos nas mudanças de hora (DST)
      const d = new Date(firstMonday); d.setDate(d.getDate() + c * 7 + r);
      const t = startOfDay(d.getTime());
      const future = t > today;
      const n = future ? 0 : (counts.get(t) || 0);
      total += n;
      cells.push({ t, n, future });
    }
    // sequência atual: dias seguidos com pelo menos 1 completado (hoje conta se já houve; senão começa ontem)
    let streak = 0;
    let t = counts.get(today) ? today : today - DAY;
    while (counts.get(startOfDay(t))) { streak++; const d = new Date(t); d.setDate(d.getDate() - 1); t = startOfDay(d.getTime()); }
    // rótulos dos meses: na 1.ª semana em que o mês aparece
    const months = [];
    let lastM = -1;
    for (let c = 0; c < weeks; c++) {
      const m = new Date(cells[c * 7].t).getMonth();
      if (m !== lastM) { months.push({ c, m }); lastM = m; }
    }
    // o 1.º mês costuma estar cortado: sem espaço para o rótulo, omite-o
    if (months.length > 1 && months[1].c < 3) months.shift();
    return { cells, total, streak, months, byDay };
  }, [items, weeks]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#9aa6b2" : "#64748b";
  const empty = darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)";
  const level = (n) => n === 0 ? empty : n === 1 ? `${accent}55` : n <= 3 ? `${accent}99` : n <= 6 ? `${accent}cc` : accent;
  const MONTHS = en ? MONTH_EN : MONTH_PT;
  const gap = isMobile ? 3 : 3;

  const pin = sel && sel.pinned;
  useEffect(() => {
    if (!pin) return;
    const close = () => setSel(null);
    const onDown = (e) => { if (popRef.current && popRef.current.contains(e.target)) return; if (e.target.closest && e.target.closest("[data-act-cell]")) return; close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [pin]);

  const openCell = (e, t, pinned) => {
    const r = e.currentTarget.getBoundingClientRect();
    // painel de 280px: centrado no quadrado, mas sempre dentro do ecrã (nas últimas semanas abre para a esquerda)
    const w = Math.min(280, window.innerWidth - 24);
    const x = Math.min(Math.max(r.left + r.width / 2 - w / 2, 12), window.innerWidth - w - 12);
    setSel({ t, x, y: r.top < 260 ? r.bottom : r.top, below: r.top < 260, pinned });
  };
  const fmtDay = (t) => { const f = new Date(t).toLocaleDateString(en ? "en-GB" : "pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); return f.charAt(0).toUpperCase() + f.slice(1); };
  const selItems = sel ? (data.byDay.get(sel.t) || []) : [];

  const stats = (
    <div style={isMobile ? { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 } : { width: 170, flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: muted, textTransform: "uppercase" }}>
          {isMobile ? (en ? "Last 6 months" : "Últimos 6 meses") : (en ? "Last 12 months" : "Últimos 12 meses")}
        </div>
        <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, lineHeight: 1, marginTop: isMobile ? 8 : 6, color: text }}>
          {data.total}<span style={{ fontSize: 13, color: muted, fontWeight: 700 }}> {en ? "completed" : "completados"}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: muted, marginTop: isMobile ? 0 : 6, textAlign: isMobile ? "right" : "left" }}>
        {en ? "current streak" : "sequência atual"} <b style={{ color: data.streak > 0 ? accent : muted }}>{data.streak} {en ? (data.streak === 1 ? "day" : "days") : (data.streak === 1 ? "dia" : "dias")}</b>
      </div>
    </div>
  );

  const grid = (
    <div style={{ flex: 1, minWidth: 0, ...(isMobile ? {} : { maxWidth: weeks * 12, marginLeft: "auto" }) }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap, marginBottom: isMobile ? 5 : 4, height: isMobile ? 12 : 11 }}>
        {data.months.map(({ c, m }) => (
          <span key={c} style={{ gridColumn: `${c + 1} / span 4`, fontSize: 9.5, color: muted, whiteSpace: "nowrap", overflow: "visible", lineHeight: isMobile ? "12px" : "11px" }}>{MONTHS[m]}</span>
        ))}
      </div>
      <div role="img" aria-label={en ? "Completed items per day" : "Obras completadas por dia"} style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap }}>
        {data.cells.map(({ t, n, future }) => {
          const on = n > 0 && !future;
          const active = sel && sel.t === t;
          return (
            <div key={t} data-act-cell={on ? "1" : undefined}
              role={on ? "button" : undefined} tabIndex={on ? 0 : undefined}
              aria-label={on ? `${fmtDay(t)}: ${n} ${en ? "completed" : "completados"}` : undefined}
              title={future || on ? undefined : new Date(t).toLocaleDateString(en ? "en-GB" : "pt-PT", { day: "numeric", month: "short", year: "numeric" })}
              onMouseEnter={on && !isMobile ? (e) => { if (!(sel && sel.pinned)) openCell(e, t, false); } : undefined}
              onMouseLeave={on && !isMobile ? () => { if (!(sel && sel.pinned)) setSel(null); } : undefined}
              onClick={on ? (e) => { if (active && sel.pinned) setSel(null); else openCell(e, t, true); } : undefined}
              onKeyDown={on ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } : undefined}
              style={{ aspectRatio: "1", borderRadius: 3, background: future ? "transparent" : level(n), cursor: on ? "pointer" : "default", outline: active ? `1.5px solid ${text}` : "none", outlineOffset: 1, transition: "transform .12s", }} />
          );
        })}
      </div>
      {isMobile && <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 8, fontSize: 10, color: muted }}>
        {en ? "Less" : "Menos"}
        {[0, 1, 2, 4, 7].map(n => <span key={n} style={{ width: 10, height: 10, borderRadius: 2.5, background: level(n) }} />)}
        {en ? "More" : "Mais"}
      </div>}
    </div>
  );

  return (
    <div style={{
      marginBottom: isMobile ? 6 : 0, borderRadius: 20, padding: isMobile ? "16px 16px 14px" : "10px 22px",
      background: panelBg || (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"),
      border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`,
      ...(isMobile ? {} : { display: "flex", alignItems: "center", gap: 22, flex: "1 1 auto" }),
    }}>
      {stats}{grid}
      {sel && selItems.length > 0 && createPortal(
        <div ref={popRef} style={{
          position: "fixed", left: sel.x, top: sel.y, transform: `translateY(${sel.below ? "8px" : "calc(-100% - 8px)"})`,
          zIndex: 300, width: 280, maxWidth: "calc(100vw - 24px)", borderRadius: 14, padding: 12,
          background: darkMode ? "rgba(18,18,22,0.97)" : "rgba(255,255,255,0.98)", color: text,
          border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)"}`, boxShadow: "0 18px 40px -10px rgba(0,0,0,0.7)",
          pointerEvents: sel.pinned ? "auto" : "none",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted }}>{fmtDay(sel.t)}</div>
          <div style={{ fontSize: 13, fontWeight: 800, margin: "2px 0 8px" }}>{selItems.length} {en ? (selItems.length === 1 ? "completed" : "completed") : (selItems.length === 1 ? "completado" : "completados")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {selItems.map(it => {
              const src = it.customCover || it.cover;
              return (
                <div key={`${it.type}-${it.id}`} onClick={sel.pinned && onOpen ? () => { setSel(null); onOpen(it); } : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: 4, borderRadius: 8, cursor: sel.pinned && onOpen ? "pointer" : "default", background: sel.pinned ? (darkMode ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)") : "transparent" }}>
                  <div style={{ width: 30, height: 44, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" }}>
                    {src && <img src={src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{it.title}</div>
                    {it.userRating > 0 && <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>★ {it.userRating}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {!sel.pinned && !isMobile && <div style={{ fontSize: 10, color: muted, marginTop: 8 }}>{en ? "Click to open the list" : "Clica para abrir a lista"}</div>}
        </div>,
        document.body
      )}
    </div>
  );
}
