import { useState, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, MONTH_PT, MONTH_EN } from "../config/constants";
import { TypeIcon } from "./TypeIcon";

export function RecentSection({ items, onOpen, showDiary = true }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [showAllCurso, setShowAllCurso] = useState(false);
  const [showAllCompleto, setShowAllCompleto] = useState(false);
  const [showDiaryAll, setShowDiaryAll] = useState(false);

  const inCurso = useMemo(() => [...items].filter(i => i.userStatus === "assistindo").sort((a, b) => b.addedAt - a.addedAt), [items]);
  const completados = useMemo(() => [...items].filter(i => i.userStatus === "completo" && i.addedAt).sort((a, b) => b.addedAt - a.addedAt), [items]);

  const ItemGrid = ({ list, showAll, maxPreview = 10 }) => {
    const visible = showAll ? list : list.slice(0, maxPreview);
    return (
      <div className={showAll ? "" : "recents-row"} style={{
        display: showAll ? "grid" : "flex",
        gridTemplateColumns: showAll ? "repeat(auto-fill, minmax(72px, 1fr))" : undefined,
        gap: 10, overflowX: showAll ? "visible" : "auto",
        paddingBottom: 4, scrollbarWidth: "none",
      }}>
        {visible.map((item) => {
          const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
          return (
            <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{ flexShrink: 0, width: showAll ? undefined : 72, cursor: "pointer" }}>
              <div className="ec-card" style={{ width: showAll ? "100%" : 72, height: 104, borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), border: "none", marginBottom: 4, position: "relative" }}>
                {coverSrc
                  ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.currentTarget.style.display = "none"} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}><TypeIcon id={item.type} /></div>
                }
                {item.userRating > 0 && (
                  <div style={{ position: "absolute", bottom: 3, left: 3, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "1px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>★ {item.userRating}</div>
                )}
                <div className="ec-act" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 6, pointerEvents: "none" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>▶ {lang === "en" ? "Continue" : "Continuar"}</span>
                </div>
                {item.lastChapter && item.userStatus === "assistindo" && (
                  <div style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "1px 4px", fontSize: 9, color: accent, fontWeight: 700, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.lastChapter.replace(/chapter /i, 'Ch.').replace(/vol\.\d+\s*/i, '')}
                  </div>
                )}
              </div>
              <p style={{ fontSize: 10, color: darkMode ? "#8b949e" : "#64748b", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Completados — tamanho igual aos Favoritos */}
      {completados.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={isMobileDevice ? { fontSize: 18, fontWeight: 800, margin: 0, color: darkMode ? "#e6edf3" : "#0f172a" } : { fontSize: 11, fontWeight: 800, color: darkMode ? "#8b949e" : "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>{isMobileDevice ? (lang === "en" ? "Recent" : "Recentes") : (lang === "en" ? "Recent" : "Recentes").toUpperCase()}</h3>
            {completados.length > (isMobileDevice ? 4 : 7) && (
              <button onClick={() => setShowAllCompleto(v => !v)} style={{ background: "none", border: isMobileDevice ? "none" : `1px solid ${accent}44`, color: accent, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                {showAllCompleto ? "↑ Menos" : `Ver todos (${completados.length})`}
              </button>
            )}
          </div>
          <div
                        style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(4, minmax(0, 1fr))" : "repeat(7, minmax(0, 1fr))", gap: isMobileDevice ? 10 : 14 }}>
            {(showAllCompleto ? completados : completados.slice(0, isMobileDevice ? 4 : 7)).map((item) => {
              const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
              const days = item.addedAt ? Math.floor((Date.now() - item.addedAt) / 86400000) : null;
              const when = days === null ? "" : days <= 0 ? (lang === "en" ? "Today" : "Hoje") : days === 1 ? (lang === "en" ? "Yesterday" : "Ontem") : days < 14 ? (lang === "en" ? `${days} days ago` : `Há ${days} dias`) : days < 60 ? (lang === "en" ? `${Math.floor(days / 7)} weeks ago` : `Há ${Math.floor(days / 7)} semanas`) : new Date(item.addedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <div key={item.id} className="recent-card" style={{ minWidth: 0, flexShrink: 0, cursor: "pointer" }} onClick={() => onOpen && onOpen(item)}>
                  <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: isMobileDevice ? 10 : 12, overflow: "hidden", position: "relative", background: gradientFor(item.id), border: "none", boxShadow: "0 12px 22px -10px rgba(0,0,0,0.75)" }}>
                    {coverSrc
                      ? <img src={coverSrc} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}><TypeIcon id={item.type} /></div>
                    }
                    {item.userRating > 0 && (
                      <div style={isMobileDevice ? { position: "absolute", left: 4, bottom: 4, padding: "1px 5px", borderRadius: 6, background: "rgba(0,0,0,0.7)", color: "#f59e0b", fontSize: 10, fontWeight: 800, pointerEvents: "none" } : { position: "absolute", top: 7, right: 7, padding: "2px 7px", borderRadius: 7, background: "rgba(0,0,0,0.62)", color: "white", fontSize: 10, fontWeight: 800, pointerEvents: "none" }}>★ {item.userRating}</div>
                    )}
                    <div className="recent-hover-overlay no-tc" style={{ display: isMobileDevice ? "none" : "flex", position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)", opacity: 0, transition: "opacity 0.2s", flexDirection: "column", justifyContent: "flex-end", padding: "40px 10px 10px" }}>
                      <p style={{ fontSize: 12, color: "white", fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", margin: 0 }}>{item.title}</p>
                    </div>
                  </div>
                  {when && <div style={{ fontSize: 10, color: darkMode ? "#8b949e" : "#64748b", marginTop: 6 }}>{when}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DIARY — Letterboxd style, grouped by month (só mobile; PC usa DiaryPanel na coluna direita) */}
      {showDiary && completados.length > 0 && (() => {
        // Group by month — only items WITH addedAt appear in the diary
        const groups = {};
        completados.filter(item => item.addedAt).forEach(item => {
          const d = new Date(item.addedAt);
          const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
          if (!groups[key]) groups[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
          groups[key].items.push({ ...item, _day: d.getDate() });
        });
        const sortedGroups = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
        if (!sortedGroups.length) return null;

        // Show 2 most recent months; rest collapses
        const visibleGroups = showDiaryAll ? sortedGroups : sortedGroups.slice(0, 2);
        const hiddenCount = sortedGroups.slice(2).reduce((s,g) => s + g.items.length, 0);

        const renderGroup = (group) => (
          <div key={group.key} style={{ display: "flex", gap: 0, marginBottom: 24 }}>
            {/* Month/Year block */}
            <div style={{ flexShrink: 0, width: 68, marginRight: 16 }}>
              <div style={{ background: "#21262d", borderRadius: 10, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
                  <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#e6edf3", letterSpacing: 1 }}>
                    {group.key === "0000-00" ? "—" : group.year}
                </div>
                <div style={{ padding: "6px 0 8px", fontSize: group.key === "0000-00" ? 13 : 22, fontWeight: 900, color: "#e6edf3" }}>
                    {group.key === "0000-00" ? "Sem data" : (lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}
                </div>
              </div>
            </div>
            {/* Entries sorted by day desc */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
                <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  borderBottom: idx < arr.length - 1 ? "1px solid #21262d" : "none",
                  cursor: "pointer", minWidth: 0,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#484f58", width: 16, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                  {(item.customCover || item.cover || item.thumbnailUrl)
                    ? <img src={item.customCover || item.cover || item.thumbnailUrl} alt="" style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    : <div style={{ width: 28, height: 40, borderRadius: 4, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}><TypeIcon id={item.type} /></div>
                  }
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#e6edf3", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{item.title}</span>
                  {item.userRating > 0 && (
                    <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>★ {item.userRating}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

        return (
          <div style={{ marginBottom: 24, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("diary").toUpperCase()}</h3>
              <span style={{ fontSize: 12, color: "#484f58" }}>{completados.length} entradas</span>
            </div>
            {visibleGroups.map(renderGroup)}
            {sortedGroups.length > 2 && (
              <button onClick={() => setShowDiaryAll(v => !v)} style={{
                width: "100%", padding: "10px", borderRadius: 10,
                background: "#21262d", border: "1px solid #30363d",
                color: "#8b949e", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600,
              }}>
                {showDiaryAll
                  ? "↑ Mostrar menos"
                  : `Ver mais — ${hiddenCount} entr${hiddenCount === 1 ? "ada" : "adas"} em ${sortedGroups.length - 2} mes${sortedGroups.length - 2 === 1 ? "" : "es"} anteriores`}
              </button>
            )}
          </div>
        );
      })()}

      {/* Em Curso — small cards with chapter info */}
      {inCurso.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("inProgressLabel").toUpperCase()}</h3>
            {inCurso.length > 10 && (
              <button onClick={() => setShowAllCurso(v => !v)} style={{ background: "none", border: `1px solid ${accent}44`, color: accent, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                {showAllCurso ? "↑ Menos" : `Ver todos (${inCurso.length})`}
              </button>
            )}
          </div>
          <ItemGrid list={inCurso} showAll={showAllCurso} />
        </div>
      )}
    </>
  );
}
