import { useState } from "react";
import { createPortal } from "react-dom";
import { TIER_LEVELS } from "../config/constants";
import { fetchAniListSafe } from "../api/anilist";
import { gradientFor } from "../lib/utils";
import { t } from "../translations";
import { useTheme } from "../contexts/ThemeContext";

export function TierListEditor({ initialData, library, onSave, onClose, workerUrl, tmdbKey }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const [title, setTitle] = useState(initialData?.title || "");
  const [tiers, setTiers] = useState(initialData?.tiers || { S: [], A: [], B: [], C: [], D: [] });
  const [search, setSearch] = useState("");
  const [poolTab, setPoolTab] = useState("biblioteca"); // biblioteca | pesquisar
  const [extSearch, setExtSearch] = useState("");
  const [extResults, setExtResults] = useState([]);
  const [extSearching, setExtSearching] = useState(false);
  const [extType, setExtType] = useState("anime");
  const [dragItem, setDragItem] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickingTierFor, setPickingTierFor] = useState(null); // item a adicionar via clique

  const items = Object.values(library || {});
  const rankedIds = new Set(Object.values(tiers).flat().map(i => i.id));
  const unranked = items.filter(i =>
    !rankedIds.has(i.id) &&
    (search === "" || (i.title || "").toLowerCase().includes(search.toLowerCase()))
  );

  const searchExternal = async () => {
    if (!extSearch.trim()) return;
    setExtSearching(true);
    setExtResults([]);
    try {
      let results = [];
      const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
      if (extType === "anime" || extType === "manga") {
        const aniType = extType === "anime" ? "ANIME" : "MANGA";
        const q = `{ Page(perPage:15) { media(search:"${extSearch.trim().replace(/"/g,"'")}",type:${aniType}) { id title{romaji} coverImage{large} averageScore description(asHtml:false) } } }`;
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrl}/anilist`], JSON.stringify({ query: q }));
        results = (data?.data?.Page?.media || []).map(m => ({
          id: `al-${extType}-${m.id}`, title: m.title?.romaji || "", cover: m.coverImage?.large || "",
          type: extType, score: m.averageScore || 0,
          synopsis: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/\n+/g, " ").trim() : ""
        }));
      } else if (extType === "filmes") {
        const url = `${wUrl}/tmdb?endpoint=/search/movie&query=${encodeURIComponent(extSearch.trim())}&language=en-US`;
        const res = await fetch(url);
        const data = await res.json();
        results = (data?.results || []).slice(0, 15).map(m => ({
          id: `tmdb-filmes-${m.id}`, title: m.title || "", cover: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "",
          type: "filmes", score: m.vote_average || 0
        }));
      } else if (extType === "series") {
        const url = `${wUrl}/tmdb?endpoint=/search/tv&query=${encodeURIComponent(extSearch.trim())}&language=en-US`;
        const res = await fetch(url);
        const data = await res.json();
        results = (data?.results || []).slice(0, 15).map(m => ({
          id: `tmdb-series-${m.id}`, title: m.name || "", cover: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "",
          type: "series", score: m.vote_average || 0
        }));
      }
      setExtResults(results.filter(r => !rankedIds.has(r.id)));
    } catch (e) { console.error(e); }
    setExtSearching(false);
  };

  const addToTier = (item, tierId) => {
    setTiers(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = next[k].filter(i => i.id !== item.id); });
      next[tierId] = [...next[tierId], item];
      return next;
    });
  };

  const removeFromTier = (item, tierId) => {
    setTiers(prev => ({ ...prev, [tierId]: prev[tierId].filter(i => i.id !== item.id) }));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(title.trim(), tiers);
    setSaving(false);
  };

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in modal-glass" style={{ maxWidth: 660, maxHeight: "94vh", overflowY: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, position: "sticky", top: 0, background: darkMode ? "#161b22" : "#fff", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117" }}>
              {initialData ? "Editar Tier List" : "Nova Tier List"}
            </h2>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título da tier list..."
            style={{ width: "100%", padding: "10px 14px", fontSize: 14, fontWeight: 700, borderRadius: 10, boxSizing: "border-box", background: darkMode ? "#0d1117" : "#f8fafc", border: `1.5px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit" }}
          />
        </div>

        {/* Tiers */}
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          {TIER_LEVELS.map(tier => (
            <div key={tier.id}
              style={{ display: "flex", minHeight: 56, borderRadius: 10, overflow: "hidden", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragItem) { addToTier(dragItem, tier.id); setDragItem(null); setDragFrom(null); } }}
            >
              <div style={{ width: 44, background: tier.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "white" }}>{tier.id}</span>
              </div>
              <div style={{ flex: 1, background: darkMode ? "#0d1117" : "#f8fafc", display: "flex", flexWrap: "wrap", gap: 5, padding: 6, alignContent: "flex-start", minHeight: 56 }}>
                {(tiers[tier.id] || []).map(item => {
                  const cover = item.customCover || item.cover || item.thumbnailUrl;
                  return (
                    <div key={item.id} title={item.title}
                      draggable
                      onDragStart={() => { setDragItem(item); setDragFrom(tier.id); }}
                      style={{ position: "relative", cursor: "grab" }}
                    >
                      <div style={{ width: 34, height: 50, borderRadius: 4, overflow: "hidden", background: gradientFor(item.id) }}>
                        {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />}
                      </div>
                      <button onClick={() => removeFromTier(item, tier.id)} style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>✕</button>
                    </div>
                  );
                })}
                {(tiers[tier.id] || []).length === 0 && (
                  <span style={{ fontSize: 11, color: "#484f58", alignSelf: "center", paddingLeft: 4 }}>Arrasta aqui</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pool */}
        <div style={{ padding: "0 20px 16px" }}>
          {/* Tabs do pool */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
            <button onClick={() => setPoolTab("biblioteca")} style={{ flex: 1, padding: "8px", background: "none", border: "none", borderBottom: poolTab === "biblioteca" ? `2px solid ${accent}` : "2px solid transparent", color: poolTab === "biblioteca" ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, marginBottom: -1 }}>
              📚 Biblioteca ({unranked.length})
            </button>
            <button onClick={() => setPoolTab("pesquisar")} style={{ flex: 1, padding: "8px", background: "none", border: "none", borderBottom: poolTab === "pesquisar" ? `2px solid ${accent}` : "2px solid transparent", color: poolTab === "pesquisar" ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, marginBottom: -1 }}>
              🔍 Pesquisar
            </button>
          </div>

          {/* Tab biblioteca */}
          {poolTab === "biblioteca" && (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar..." style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8, marginBottom: 10, boxSizing: "border-box", background: darkMode ? "#0d1117" : "#f8fafc", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {unranked.slice(0, 80).map(item => {
                  const cover = item.customCover || item.cover || item.thumbnailUrl;
                  return (
                    <div key={item.id} title={item.title} draggable onDragStart={() => { setDragItem(item); setDragFrom(null); }} style={{ cursor: "grab" }}>
                      <div style={{ width: 38, height: 55, borderRadius: 5, overflow: "hidden", background: gradientFor(item.id), border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                        {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                      </div>
                    </div>
                  );
                })}
                {unranked.length === 0 && <p style={{ fontSize: 12, color: "#484f58" }}>Todos os itens completos já estão na lista!</p>}
              </div>
            </>
          )}

          {/* Tab pesquisa externa */}
          {poolTab === "pesquisar" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {[{id:"anime",label:"Anime"},{id:"manga",label:"Manga"},{id:"filmes",label:"Filmes"},{id:"series",label:"Séries"}].map(t => (
                  <button key={t.id} onClick={() => setExtType(t.id)} style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 20, border: `1px solid ${extType===t.id?accent:"#30363d"}`, background: extType===t.id?`${accent}22`:"transparent", color: extType===t.id?accent:"#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>{t.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input value={extSearch} onChange={e => setExtSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchExternal()} placeholder="Pesquisar título..." style={{ flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 8, boxSizing: "border-box", background: darkMode ? "#0d1117" : "#f8fafc", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit" }} />
                <button onClick={searchExternal} disabled={extSearching} style={{ padding: "8px 14px", borderRadius: 8, background: accent, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {extSearching ? "..." : "🔍"}
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {extResults.map(item => {
                  const alreadyIn = rankedIds.has(item.id);
                  return (
                    <div key={item.id} title={item.title} draggable={!alreadyIn} onDragStart={() => { if (!alreadyIn) { setDragItem(item); setDragFrom(null); } }} style={{ cursor: alreadyIn ? "default" : "grab", opacity: alreadyIn ? 0.4 : 1 }}>
                      <div style={{ width: 38, height: 55, borderRadius: 5, overflow: "hidden", background: gradientFor(item.id), border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                        {item.cover && <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                      </div>
                    </div>
                  );
                })}
                {!extSearching && extResults.length === 0 && extSearch && <p style={{ fontSize: 12, color: "#484f58" }}>Sem resultados.</p>}
                {!extSearching && extResults.length === 0 && !extSearch && <p style={{ fontSize: 12, color: "#484f58" }}>Pesquisa qualquer título acima.</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 20px", borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, display: "flex", gap: 10, position: "sticky", bottom: 0, background: darkMode ? "#161b22" : "#fff" }}>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-accent" style={{ flex: 2, padding: "12px", fontSize: 14, opacity: !title.trim() ? 0.5 : 1 }}>
            {saving ? "A guardar..." : "Guardar Tier List"}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: darkMode ? "#21262d" : "#f1f5f9", border: "none", borderRadius: 10, color: darkMode ? "#e6edf3" : "#0d1117", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
