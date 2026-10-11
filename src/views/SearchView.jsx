import { useTheme } from "../contexts/ThemeContext";
import { PosterGridSkeleton } from '../components/Skeleton';
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { MediaCard } from "../components/MediaCard";

// ─── Vista de Pesquisa ───
// O estado vive no TrackAll (a pesquisa tem de sobreviver à troca de separador);
// esta vista só mostra e dispara doSearch.
export function SearchView({ view, activeTab, setActiveTab, searchQuery, setSearchQuery, doSearch, isSearching, searchError, searchResultsByType, searchHistory, setSearchHistory, library, setSelectedItem }) {
  const { accent, darkMode } = useTheme();
  const { lang, useT } = useLang();
  return (
    <div style={{ display: view === "search" ? "block" : "none" }}>
          <div style={{ padding: "20px 16px" }}>
            <div className="tabs-scroll" style={{ marginBottom: 20 }}>
              {MEDIA_TYPES.map((t) => (
                <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => {
                  setActiveTab(t.id);
                  if (searchQuery.trim()) doSearch(searchQuery, t.id);
                }}>
                  {t.icon} {mediaLabel(t, lang)}
                </button>
              ))}
            </div>
            {isSearching && <div style={{ padding: "8px 0" }}><PosterGridSkeleton count={12} /></div>}
            {searchError && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>😶</div>
                <p style={{ color: "#ef4444", marginBottom: 12 }}>{searchError}</p>
                <p style={{ color: "#484f58", fontSize: 12, lineHeight: 1.6 }}>
                  Se estás a testar no Claude.ai, as chamadas de rede externas são bloqueadas.<br />
                  A pesquisa funciona corretamente no browser normal ou no APK Android.
                </p>
              </div>
            )}
            {(() => {
              if (isSearching || searchError) return null;
              const seen = new Set();
              const currentResults = activeTab === "all"
                ? Object.values(searchResultsByType).flat().filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
                : (searchResultsByType[activeTab] || []);
              const hasAnyResults = Object.values(searchResultsByType).some(arr => arr && arr.length > 0);
              if (!hasAnyResults) {
                return (
                  <div style={{ color: "#484f58" }}>
                    {searchHistory.length > 0 && !searchQuery && (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b949e" }}>{useT("recentSearches")}</p>
                          <button onClick={() => { setSearchHistory([]); try { localStorage.removeItem("trackall_search_history"); } catch {} }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>{useT("clearHistory")}</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {searchHistory.map((h, i) => (
                            <button key={i} onClick={() => { setSearchQuery(h); doSearch(h, activeTab); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: darkMode ? "#161b22" : "#f8fafc", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 13, WebkitTapHighlightColor: "transparent" }}>
                              <span style={{ color: "#484f58", fontSize: 13 }}>↩</span> {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!searchQuery ? (
                      <div style={{ textAlign: "center", padding: "32px 0" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                        <p style={{ marginBottom: 8 }}>{lang === "en" ? "Search something above!" : "Pesquisa algo acima!"}</p>
                        <p style={{ fontSize: 12, color: "#30363d" }}>{lang === "en" ? "Anime · Manga · Series · Movies · Games · Books · and more" : "Anime · Manga · Séries · Filmes · Jogos · Livros · e mais"}</p>
                      </div>
                    ) : Object.keys(searchResultsByType).length > 0 && (
                      <p style={{ textAlign: "center", padding: "32px 0", fontSize: 13 }}>Nenhum resultado encontrado. Tenta outro termo ou seleciona um tipo específico.</p>
                    )}
                  </div>
                );
              }
              return (
                <>
                  <p style={{ color: "#484f58", fontSize: 13, marginBottom: 16 }}>{currentResults.length} resultados{activeTab !== "all" ? ` em ${mediaLabel(MEDIA_TYPES.find(t=>t.id===activeTab), lang)}` : ""} para "<strong style={{ color: darkMode ? "#e6edf3" : "#0d1117" }}>{searchQuery}</strong>"</p>
                  {currentResults.length === 0 ? (
                    <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", marginTop: 40 }}>Sem resultados para este tipo. Tenta "All".</p>
                  ) : (
                    <div className="media-grid">
                      {currentResults.map((item) => <MediaCard key={item.id} item={item} library={library} onOpen={setSelectedItem} accent={accent} />)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
    </div>
  );
}
