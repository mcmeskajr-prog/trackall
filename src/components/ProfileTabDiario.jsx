import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, MONTH_PT, MONTH_EN } from "../config/constants";

export function ProfileTabDiario({ items, accent, darkMode, isMobileDevice, lang, onOpen }) {
  const completados = items.filter(i => i.userStatus === "completo" && i.addedAt).sort((a,b) => b.addedAt - a.addedAt);
  if (completados.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 16px", color: "#484f58" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
      <p>{lang === "en" ? "Complete items to see your diary" : "Completa itens para ver o teu diário"}</p>
    </div>
  );
  const groups = {};
  completados.forEach(item => {
    const d = new Date(item.addedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    if (!groups[key]) groups[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
    groups[key].items.push({ ...item, _day: d.getDate() });
  });
  const sortedGroups = Object.values(groups).sort((a,b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
  const typeIcon = (type) => MEDIA_TYPES.find(t => t.id === type)?.icon || "◉";
  return (
    <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
      <p style={{ fontSize: 13, color: "#484f58", marginBottom: 24 }}>{completados.length} {lang === "en" ? "entries" : "entradas"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {sortedGroups.map((group, gi) => (
          <div key={gi}>
            {/* Header do mês */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 12, overflow: "hidden", textAlign: "center", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, flexShrink: 0, minWidth: 56 }}>
                <div style={{ background: accent, padding: "4px 0", fontSize: 9, fontWeight: 800, color: "white", letterSpacing: 1 }}>{group.year}</div>
                <div style={{ padding: "6px 8px 8px", fontSize: 18, fontWeight: 900, color: darkMode ? "#e6edf3" : "#111827" }}>{(lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}</div>
              </div>
              <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
              <span style={{ fontSize: 12, color: darkMode ? "#484f58" : "#57606a", fontWeight: 700, background: darkMode ? "#21262d" : "#e8ecf0", padding: "3px 10px", borderRadius: 20 }}>{group.items.length}</span>
            </div>
            {/* Lista de itens */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.sort((a,b) => b._day - a._day).map((item, idx, arr) => {
                const cover = item.customCover || item.cover || item.thumbnailUrl;
                return (
                  <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "8px 10px",
                    borderRadius: 10, cursor: "pointer", transition: "background 0.12s",
                    borderBottom: idx < arr.length-1 ? `1px solid ${darkMode ? "#21262d44" : "#e2e8f044"}` : "none",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#ffffff08" : "#00000005"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Dia em destaque */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}33`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: accent, lineHeight: 1 }}>{item._day}</span>
                    </div>
                    {/* Capa */}
                    <div style={{ width: 36, height: 52, borderRadius: 6, overflow: "hidden", background: gradientFor(item.id), flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                      {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 11, color: darkMode ? "#484f58" : "#57606a" }}>{typeIcon(item.type)} {item.type}</p>
                    </div>
                    {/* Rating */}
                    {item.userRating > 0 && (
                      <div style={{ flexShrink: 0, background: darkMode ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: "#f59e0b", fontWeight: 800 }}>★{item.userRating}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
