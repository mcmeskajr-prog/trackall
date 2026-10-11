import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, STATUS_OPTIONS, mediaLabel, statusLabel } from "../config/constants";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { MediaCard } from "../components/MediaCard";
import { VirtualGrid } from "../components/VirtualGrid";
import { LibGroupedList } from "../components/LibGroupedList";

// ─── Vista da Biblioteca ───
// Estado (filtros, ordenação, modo de vista) vive no TrackAll; items/filteredLib/sortedLib são calculados lá.
export function LibraryView({ view, setView, items, filteredLib, sortedLib, library, activeTab, setActiveTab, filterStatus, setFilterStatus, filterRating = null, setFilterRating, libSearch, setLibSearch, libSort, setLibSort, libViewMode, setLibViewModePersist, searchQuery, doSearch, setSelectedItem }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  return (
    <div style={{ display: view === "library" ? "block" : "none" }}>
        {/* ── LIBRARY ── */}
          <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 28px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900 }}>{useT("library")}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Search input */}
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#484f58", fontSize: 12, pointerEvents: "none" }}>🔍</span>
                  <input
                    value={libSearch}
                    onChange={e => setLibSearch(e.target.value)}
                    placeholder={useT("filterPlaceholder")}
                    style={{ padding: "6px 10px 6px 28px", fontSize: 13, width: isMobileDevice ? 110 : 160, borderRadius: 8 }}
                  />
                  {libSearch && <button onClick={() => setLibSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>}
                </div>
                {/* Type counters — PC only */}
                {!isMobileDevice && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
                    {MEDIA_TYPES.slice(1).filter(t => filteredLib.some(i => i.type === t.id)).map(t => (
                      <span key={t.id} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 13 }}>{t.icon}</span>
                        <span style={{ color: darkMode ? "#8b949e" : "#64748b", fontWeight: 700, fontSize: 11 }}>{filteredLib.filter(i => i.type === t.id).length}</span>
                      </span>
                    ))}
                    <span style={{ flexShrink: 0, color: darkMode ? "#484f58" : "#94a3b8", fontSize: 11, marginLeft: 2 }}>· {filteredLib.length}</span>
                  </div>
                )}
                <div style={{ display: "flex", background: darkMode ? "#21262d" : "#e8e0d5", borderRadius: 8, padding: 2 }}>
                  {[{id:"grid",icon:"▦"},{id:"large",icon:"◻"},{id:"list",icon:"☰"}, ...(isMobileDevice ? [] : [{id:"compact",icon:"⊟"}])].map(m => (
                    <button key={m.id} onClick={() => setLibViewModePersist(m.id)} title={m.id === "compact" ? "Compacto" : m.id === "large" ? "Grande" : undefined} style={{ width: 28, height: 26, borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, background: libViewMode === m.id ? (darkMode ? "#30363d" : "#fff") : "transparent", color: libViewMode === m.id ? accent : "#8b949e", transition: "all 0.15s" }}>{m.icon}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="tabs-scroll" style={{ marginBottom: 14 }}>
              {MEDIA_TYPES.map((t) => {
                const isActive = activeTab === t.id;
                const count = t.id === "all" ? items.length : items.filter((i) => i.type === t.id).length;
                return (
                  <button key={t.id} className={`tab-btn${isActive ? " active" : ""}`} onClick={() => {
                      setActiveTab(t.id);
                      if (view === "search" && searchQuery.trim()) doSearch(searchQuery, t.id);
                    }}>
                    {t.icon} {mediaLabel(t, lang)}
                    <span style={{ background: isActive ? "rgba(255,255,255,0.25)" : (darkMode ? "#30363d" : "#e2e8f0"), color: isActive ? "white" : "#8b949e", borderRadius: 999, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Layout: sidebar desktop / stack mobile */}
            <div className="lib-layout">

              {/* SIDEBAR — desktop only */}
              <aside className="lib-sidebar">
                <p style={{ fontSize: 11, fontWeight: 800, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{useT("status")}</p>
                {[{ id: "all", emoji: "▤", label: "Todos", color: accent }, ...STATUS_OPTIONS].map((s) => (
                  <button key={s.id} onClick={() => setFilterStatus(s.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8, border: "none", textAlign: "left",
                    background: filterStatus === s.id ? `${s.color}18` : "transparent",
                    color: filterStatus === s.id ? s.color : "#8b949e",
                    borderLeft: filterStatus === s.id ? `3px solid ${s.color}` : "3px solid transparent",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: filterStatus === s.id ? 700 : 500,
                    marginBottom: 2,
                  }}>
                    <span>{s.emoji}</span> {s.id === "all" ? useT("all") : statusLabel(s, lang)}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: filterStatus === s.id ? s.color : "#484f58" }}>
                      {s.id === "all" ? filteredLib.length : items.filter(i => i.userStatus === s.id && (activeTab === "all" || i.type === activeTab)).length}
                    </span>
                  </button>
                ))}
                <div style={{ height: 1, background: "#21262d", margin: "12px 0" }} />
                <p style={{ fontSize: 11, fontWeight: 800, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{lang === "en" ? "Sort" : "Ordenar"}</p>
                {[{id:"date",label: lang === "en" ? "Date" : "Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★ Rating"}].map(s => (
                  <button key={s.id} onClick={() => setLibSort(s.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8, border: "none", textAlign: "left",
                    background: libSort === s.id ? `${accent}18` : "transparent",
                    color: libSort === s.id ? accent : "#8b949e",
                    borderLeft: libSort === s.id ? `3px solid ${accent}` : "3px solid transparent",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: libSort === s.id ? 700 : 500,
                    marginBottom: 2,
                  }}>
                    {s.label}
                  </button>
                ))}
              </aside>

              {/* MAIN CONTENT */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {filterRating !== null && setFilterRating && (
                  <button onClick={() => setFilterRating(null)} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "5px 12px", borderRadius: 999, border: `1px solid ${accent}`, background: `${accent}22`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                    {filterRating === "rated" ? (lang === "en" ? "Rated only" : "Só avaliados") : `★ ${filterRating}`} <span aria-hidden="true">✕</span>
                  </button>
                )}

                {/* Mobile-only: filtros + sort compactos */}
                <div className="lib-mobile-controls">
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                    <button onClick={() => setFilterStatus("all")} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === "all" ? accent : "#30363d"}`, background: filterStatus === "all" ? accent : "transparent", color: filterStatus === "all" ? "white" : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>{useT("all")}</button>
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s.id} onClick={() => setFilterStatus(s.id)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === s.id ? s.color : "#30363d"}`, background: filterStatus === s.id ? `${s.color}22` : "transparent", color: filterStatus === s.id ? s.color : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                        {s.emoji} {statusLabel(s, lang)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", justifyContent: "flex-end" }}>
                    {[{id:"date",label: lang === "en" ? "Date" : "Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★"}].map(s => (
                      <button key={s.id} onClick={() => setLibSort(s.id)} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${libSort === s.id ? accent : "#30363d"}`, background: libSort === s.id ? `${accent}22` : "transparent", color: libSort === s.id ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, WebkitTapHighlightColor: "transparent" }}>{s.label}</button>
                    ))}
                  </div>
                </div>

                {sortedLib.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#8b949e" }}>{lang === "en" ? "Nothing here yet" : "Nada aqui ainda"}</p>
                    <p style={{ fontSize: 14, marginBottom: 20 }}>{lang === "en" ? "Use search to add media!" : "Usa a pesquisa para adicionar mídias!"}</p>
                    <button className="btn-accent" style={{ padding: "12px 24px" }} onClick={() => { setView("search"); }}>{useT("search")}</button>
                  </div>
                ) : libViewMode === "list" ? (
                  <LibGroupedList
                    items={sortedLib}
                    library={library}
                   
                   
                    onOpen={setSelectedItem}
                  />
                ) : libViewMode === "compact" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6 }}>
                    {sortedLib.map(item => {
                      const libItem = findLibraryEntry(library, item.id, item.type)?.item;
                      const coverSrc = libItem?.customCover || item.cover || item.thumbnailUrl;
                      const status = STATUS_OPTIONS.find(s => s.id === libItem?.userStatus);
                      return (
                        <div key={item.id} className="recent-card" onClick={() => setSelectedItem(item)} style={{ cursor: "pointer", position: "relative" }}>
                          <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 6, overflow: "hidden", position: "relative", background: gradientFor(item.id) }}>
                            {coverSrc && <img src={coverSrc} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            {status && <span style={{ position: "absolute", top: 3, right: 3, fontSize: 9, background: `${status.color}cc`, color: "white", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>{status.emoji}</span>}
                            {libItem?.userRating > 0 && <span style={{ position: "absolute", bottom: 3, left: 3, fontSize: 9, background: "rgba(0,0,0,0.85)", color: "#f59e0b", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>★{libItem.userRating}</span>}
                            <div className="recent-hover-overlay no-tc" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)", opacity: 0, transition: "opacity 0.2s", display: "flex", alignItems: "flex-end", padding: "20px 5px 5px" }}>
                              <p style={{ fontSize: 9, color: "white", fontWeight: 700, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{item.title}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <VirtualGrid
                    key={`${filterStatus}-${activeTab}-${libSort}-${libViewMode}-${filterRating}`}
                    items={sortedLib}
                    library={library}
                    onOpen={setSelectedItem}
                    accent={accent}
                    columns={typeof window !== 'undefined' && window.innerWidth < 480 ? 3 : 5}
                    size={libViewMode === "large" ? "large" : "normal"}
                  />
                )}
              </div>
            </div>
          </div>

    </div>
  );
}
