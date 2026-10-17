import { useMemo } from "react";
import { MONTH_PT, MONTH_EN } from "../config/constants";

// Atividade (estilo GitHub): cada quadrado é um dia, a intensidade é o nº de obras completadas.
// Usa a mesma data do Diário (`addedAt` dos itens completos). PC: 53 semanas; telemóvel: 26 semanas.
const DAY = 86400000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const keyOf = (t) => startOfDay(t);

export function ProfileActivity({ items, accent = "#dc2626", darkMode = true, isMobile = false, lang = "pt", panelBg = null }) {
  const weeks = isMobile ? 26 : 53;
  const en = lang === "en";

  const data = useMemo(() => {
    const counts = new Map();
    (items || []).forEach(i => {
      if (i.userStatus !== "completo" || !i.addedAt) return;
      const k = keyOf(i.addedAt);
      counts.set(k, (counts.get(k) || 0) + 1);
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
    return { cells, total, streak, months };
  }, [items, weeks]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#9aa6b2" : "#64748b";
  const empty = darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)";
  const level = (n) => n === 0 ? empty : n === 1 ? `${accent}55` : n <= 3 ? `${accent}99` : n <= 6 ? `${accent}cc` : accent;
  const MONTHS = en ? MONTH_EN : MONTH_PT;
  const gap = isMobile ? 3 : 3;

  const stats = (
    <div style={isMobile ? { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 } : { width: 170, flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: muted, textTransform: "uppercase" }}>
          {isMobile ? (en ? "Last 6 months" : "Últimos 6 meses") : (en ? "Last 12 months" : "Últimos 12 meses")}
        </div>
        <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, lineHeight: 1, marginTop: 8, color: text }}>
          {data.total}<span style={{ fontSize: 13, color: muted, fontWeight: 700 }}> {en ? "completed" : "completados"}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: muted, marginTop: isMobile ? 0 : 6, textAlign: isMobile ? "right" : "left" }}>
        {en ? "current streak" : "sequência atual"} <b style={{ color: data.streak > 0 ? accent : muted }}>{data.streak} {en ? (data.streak === 1 ? "day" : "days") : (data.streak === 1 ? "dia" : "dias")}</b>
      </div>
    </div>
  );

  const grid = (
    <div style={{ flex: 1, minWidth: 0, ...(isMobile ? {} : { maxWidth: weeks * 17, marginLeft: "auto" }) }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap, marginBottom: 5, height: 12 }}>
        {data.months.map(({ c, m }) => (
          <span key={c} style={{ gridColumn: `${c + 1} / span 4`, fontSize: 9.5, color: muted, whiteSpace: "nowrap", overflow: "visible", lineHeight: "12px" }}>{MONTHS[m]}</span>
        ))}
      </div>
      <div role="img" aria-label={en ? "Completed items per day" : "Obras completadas por dia"} style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap }}>
        {data.cells.map(({ t, n, future }) => (
          <div key={t} title={future ? undefined : `${n} ${en ? "completed" : "completados"} · ${new Date(t).toLocaleDateString(en ? "en-GB" : "pt-PT", { day: "numeric", month: "short", year: "numeric" })}`}
            style={{ aspectRatio: "1", borderRadius: 3, background: future ? "transparent" : level(n) }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 8, fontSize: 10, color: muted }}>
        {en ? "Less" : "Menos"}
        {[0, 1, 2, 4, 7].map(n => <span key={n} style={{ width: 10, height: 10, borderRadius: 2.5, background: level(n) }} />)}
        {en ? "More" : "Mais"}
      </div>
    </div>
  );

  return (
    <div style={{
      marginBottom: 28, borderRadius: 20, padding: isMobile ? "16px 16px 14px" : "20px 22px",
      background: panelBg || (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"),
      border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`,
      ...(isMobile ? {} : { display: "flex", alignItems: "center", gap: 22 }),
    }}>
      {stats}{grid}
    </div>
  );
}
