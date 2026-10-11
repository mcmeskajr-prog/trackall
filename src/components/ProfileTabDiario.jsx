import { useState, useMemo } from "react";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, MONTH_PT, MONTH_EN, TYPE_COLORS, mediaLabel } from "../config/constants";

// ─── Diário (v2): resumo do ano, atividade por mês, filtros por tipo e entradas por mês ───
export function ProfileTabDiario({ items, accent, darkMode, isMobileDevice, lang, onOpen }) {
  const [filter, setFilter] = useState("all");

  const completados = useMemo(
    () => (items || []).filter(i => i.userStatus === "completo" && i.addedAt).sort((a, b) => b.addedAt - a.addedAt),
    [items]
  );
  const types = useMemo(() => MEDIA_TYPES.slice(1).filter(t => completados.some(i => i.type === t.id)), [completados]);
  const activeFilter = filter === "all" || types.some(t => t.id === filter) ? filter : "all";
  const list = useMemo(() => (activeFilter === "all" ? completados : completados.filter(i => i.type === activeFilter)), [completados, activeFilter]);

  const now = new Date();
  const year = now.getFullYear();
  const months = lang === "en" ? MONTH_EN : MONTH_PT;

  const stats = useMemo(() => {
    const thisYear = list.filter(i => new Date(i.addedAt).getFullYear() === year);
    const thisMonth = thisYear.filter(i => new Date(i.addedAt).getMonth() === now.getMonth());
    const rated = thisYear.filter(i => i.userRating > 0);
    const avg = rated.length ? (rated.reduce((a, i) => a + i.userRating, 0) / rated.length).toFixed(1) : "—";
    // maior sequência de dias seguidos com pelo menos um registo
    const days = [...new Set(list.map(i => { const d = new Date(i.addedAt); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000; }))].sort((a, b) => a - b);
    let best = 0, run = 0;
    days.forEach((d, idx) => { run = idx > 0 && d === days[idx - 1] + 1 ? run + 1 : 1; if (run > best) best = run; });
    const perMonth = Array.from({ length: 12 }, () => 0);
    thisYear.forEach(i => { perMonth[new Date(i.addedAt).getMonth()] += 1; });
    const hist = Array.from({ length: 10 }, () => 0);
    rated.forEach(i => { hist[Math.min(10, Math.max(1, Math.round(i.userRating))) - 1] += 1; });
    const byType = MEDIA_TYPES.slice(1).map(t => ({ t, n: thisYear.filter(i => i.type === t.id).length })).filter(x => x.n > 0);
    const bestOfMonth = [...thisMonth].filter(i => i.userRating > 0).sort((a, b) => b.userRating - a.userRating)[0] || null;
    return { thisYear: thisYear.length, thisMonth: thisMonth.length, avg, best, perMonth, perMonthMax: Math.max(1, ...perMonth), hist, histMax: Math.max(1, ...hist), byType, bestOfMonth };
  }, [list, year]);

  const groups = useMemo(() => {
    const g = {};
    list.forEach(item => {
      const d = new Date(item.addedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!g[key]) g[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
      g[key].items.push({ ...item, _day: d.getDate() });
    });
    return Object.values(g).sort((a, b) => b.key.localeCompare(a.key));
  }, [list]);

  if (completados.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 16px", color: "#484f58" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
      <p>{lang === "en" ? "Complete items to see your diary" : "Completa itens para ver o teu diário"}</p>
    </div>
  );

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)";
  const card = { background: darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)", borderRadius: 18, border: `1px solid ${line}`, padding: "16px 18px", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" };
  const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted };

  const tiles = [
    { n: stats.thisYear, l: lang === "en" ? "entries this year" : "registos este ano" },
    { n: stats.thisMonth, l: lang === "en" ? "this month" : "este mês" },
    { n: stats.avg, l: lang === "en" ? "year average" : "média do ano" },
    { n: `${stats.best} ${lang === "en" ? (stats.best === 1 ? "day" : "days") : (stats.best === 1 ? "dia" : "dias")}`, l: lang === "en" ? "longest streak" : "maior sequência" },
  ];

  const filterBar = (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
      {[{ id: "all" }, ...types].map(t => {
        const on = activeFilter === t.id;
        return (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            flexShrink: 0, minHeight: 36, padding: "0 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            border: `1px solid ${on ? accent : line}`, background: on ? accent : "transparent", color: on ? "white" : sub,
          }}>{t.id === "all" ? (lang === "en" ? "All" : "Tudo") : mediaLabel(t, lang)}</button>
        );
      })}
    </div>
  );

  const activity = (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={eyebrow}>{lang === "en" ? `Activity in ${year}` : `Atividade em ${year}`}</div>
        <div style={{ fontSize: 12, color: sub }}>{stats.thisYear} {lang === "en" ? "entries this year" : "registos este ano"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: isMobileDevice ? 5 : 8, height: isMobileDevice ? 56 : 72 }}>
        {stats.perMonth.map((n, i) => (
          <div key={i} title={`${months[i]}: ${n}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5, height: "100%" }}>
            <div style={{ width: "100%", height: `${Math.max(4, (n / stats.perMonthMax) * 78)}%`, borderRadius: "5px 5px 0 0", background: accent, opacity: n ? 0.45 + 0.55 * (n / stats.perMonthMax) : 0.15 }} />
            <div style={{ fontSize: 9, color: muted }}>{String(months[i] || "").charAt(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const side = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 12 }}>{lang === "en" ? "Ratings" : "Distribuição de ratings"}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80 }}>
          {stats.hist.map((n, i) => (
            <div key={i} title={`${i + 1}: ${n}`} style={{ flex: 1, height: `${Math.max(4, (n / stats.histMax) * 100)}%`, borderRadius: "3px 3px 0 0", background: accent, opacity: n ? 0.45 + 0.55 * (n / stats.histMax) : 0.15 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: muted, marginTop: 4 }}><span>1</span><span>10</span></div>
      </div>
      {stats.byType.length > 0 && (
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>{lang === "en" ? "This year by type" : "Este ano por tipo"}</div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 3 }}>
            {stats.byType.map(({ t, n }) => <div key={t.id} title={`${mediaLabel(t, lang)}: ${n}`} style={{ flexGrow: n, background: TYPE_COLORS[t.id] || accent, borderRadius: 3 }} />)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12 }}>
            {stats.byType.map(({ t, n }) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: sub }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: TYPE_COLORS[t.id] || accent }} />{mediaLabel(t, lang)} <b style={{ color: text }}>{n}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.bestOfMonth && (
        <div onClick={() => onOpen && onOpen(stats.bestOfMonth)} style={{ ...card, cursor: "pointer", background: `linear-gradient(120deg, ${accent}2e, rgba(255,255,255,0.03))` }}>
          <div style={eyebrow}>{lang === "en" ? "Best of the month" : "Melhor do mês"}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: text }}>{stats.bestOfMonth.title}</div>
          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>★ {stats.bestOfMonth.userRating} · {(() => { const td = MEDIA_TYPES.find(t => t.id === stats.bestOfMonth.type); return td ? mediaLabel(td, lang) : stats.bestOfMonth.type; })()}</div>
        </div>
      )}
    </div>
  );

  const entries = (
    <div>
      {groups.length === 0 && <p style={{ fontSize: 13, color: muted, padding: "20px 0" }}>{lang === "en" ? "No entries of this type." : "Sem entradas deste tipo."}</p>}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: isMobileDevice ? 18 : 20, fontWeight: 800, color: text }}>{months[group.month]} {group.year}</div>
            <div style={{ fontSize: 12, color: sub }}>{group.items.length}</div>
          </div>
          {[...group.items].sort((a, b) => b.addedAt - a.addedAt).map(item => {
            const cover = item.customCover || item.cover || item.thumbnailUrl;
            const t = MEDIA_TYPES.find(x => x.id === item.type);
            return (
              <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                display: "flex", alignItems: "center", gap: isMobileDevice ? 12 : 18, padding: isMobileDevice ? 12 : "14px 16px", marginTop: 10, borderRadius: 16, cursor: "pointer",
                background: darkMode ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.04)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
              }}>
                <div style={{ width: isMobileDevice ? 34 : 44, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: isMobileDevice ? 9 : 10, letterSpacing: "0.1em", textTransform: "uppercase", color: muted }}>{String(months[group.month] || "").slice(0, 3)}</div>
                  <div style={{ fontSize: isMobileDevice ? 20 : 24, fontWeight: 800, color: text }}>{item._day}</div>
                </div>
                <div style={{ width: isMobileDevice ? 40 : 46, height: isMobileDevice ? 58 : 68, borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), flexShrink: 0 }}>
                  {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobileDevice ? 14 : 16, fontWeight: 800, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{t ? mediaLabel(t, lang) : item.type}</div>
                </div>
                {item.userRating > 0 && (
                  <div style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 9, background: "rgba(0,0,0,0.5)", color: "white", fontSize: 12, fontWeight: 800 }}>★ {item.userRating}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px", color: text }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: isMobileDevice ? 10 : 14, marginBottom: 14 }}>
        {tiles.map(t => (
          <div key={t.l} style={{ ...card, padding: isMobileDevice ? 14 : 18 }}>
            <div style={{ fontSize: isMobileDevice ? 24 : 28, fontWeight: 800, lineHeight: 1.1 }}>{t.n}</div>
            <div style={{ fontSize: isMobileDevice ? 11 : 12, color: sub, marginTop: 2 }}>{t.l}</div>
          </div>
        ))}
      </div>
      {activity}
      <div style={{ margin: "22px 0 8px" }}>{filterBar}</div>
      {isMobileDevice ? (
        <>
          {entries}
          {side}
        </>
      ) : (
        <div style={{ display: "flex", gap: 36, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>{entries}</div>
          <div style={{ width: 300, flexShrink: 0 }}>{side}</div>
        </div>
      )}
    </div>
  );
}
