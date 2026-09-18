import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";

export function CollectionModal({ initialData, library, onSave, onClose, workerUrl }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [visibility, setVisibility] = useState(initialData?.visibility || "public");
  const [showNumbers, setShowNumbers] = useState(initialData?.show_numbers || false);
  const [colItems, setColItems] = useState(initialData?.items || []);
  const [saving, setSaving] = useState(false);

  // Search
  const [searchQ, setSearchQ] = useState("");
  const [searchType, setSearchType] = useState("library"); // library | character | person | comicchar
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchTimer = useRef(null);

  const searchTypeOpts = [
    { id: "library", label: "📚 Biblioteca" },
    { id: "character", label: "⛩️ Personagem" },
    { id: "person", label: "🎬 Ator/Realizador" },
    { id: "comicchar", label: "💬 Comic Char" },
  ];

  useEffect(() => {
    if (!searchQ.trim() || searchQ.trim().length < 2) { setSearchResults([]); setSearchError(false); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(searchQ.trim()), 600);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ, searchType]);

  const doSearch = async (q) => {
    setSearchLoading(true);
    setSearchError(false);
    try {
      if (searchType === "library") {
        const lower = q.toLowerCase();
        const res = (library || []).filter(i => (i.title || "").toLowerCase().includes(lower)).slice(0, 20);
        setSearchResults(res.map(i => ({ id: i.id, title: i.title, cover: i.cover, type: i.type, itemType: "media" })));
      } else if (searchType === "character") {
        const aniHeaders = { "Content-Type": "application/json", "Accept": "application/json" };
        const charQuery = `query($q:String){Page(perPage:15){characters(search:$q){id name{full}image{large}media{nodes{id title{romaji}type}}}}}`;
        const charBody = JSON.stringify({ query: charQuery, variables: { q } });
        const tryFetchChar = async (url) => {
          try {
            const r = await fetch(url, { method: "POST", headers: aniHeaders, body: charBody });
            if (!r.ok) return null;
            const d = await r.json();
            if (d.errors || !d?.data?.Page?.characters?.length) return null;
            return d;
          } catch { return null; }
        };
        const charResults = await Promise.allSettled([
          tryFetchChar(wUrl + "/anilist"),
          tryFetchChar("https://graphql.anilist.co"),
        ]);
        const data = charResults.find(r => r.status === "fulfilled" && r.value)?.value;
        if (!data) throw new Error("Não foi possível ligar ao AniList. Tenta novamente.");
        const chars = (data?.data?.Page?.characters || []).map(c => {
          const firstMedia = c.media?.nodes?.[0];
          return {
            id: `alchar-${c.id}`,
            title: c.name?.full,
            cover: c.image?.large,
            subtitle: firstMedia?.title?.romaji || "",
            mediaId: firstMedia ? `al-${firstMedia.type === "MANGA" ? "manga" : "anime"}-${firstMedia.id}` : null,
            mediaType: firstMedia?.type === "MANGA" ? "manga" : "anime",
            itemType: "character",
          };
        });
        setSearchResults(chars);
      } else if (searchType === "person") {
        const resp = await fetch(`${wUrl}/tmdb?endpoint=/search/person&query=${encodeURIComponent(q)}&language=pt-PT`);
        const data = await resp.json();
        const people = data?.results || [];
        setSearchResults(people.slice(0, 12).map(p => ({
          id: `tmdbperson-${p.id}`, title: p.name,
          cover: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
          subtitle: p.known_for_department === "Acting" ? "Ator/Atriz" : p.known_for_department || "",
          itemType: "person",
        })));
      } else if (searchType === "comicchar") {
        const resp = await fetch(`${wUrl}/comicvine-char?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        const chars = data?.results || [];
        setSearchResults(chars.slice(0, 12).map(c => ({
          id: `cvchar-${c.id}`, title: c.name,
          cover: c.image?.medium_url || null,
          subtitle: c.publisher?.name || "",
          itemType: "comicchar",
        })));
      }
    } catch (e) { console.error("[CollectionSearch]", e); setSearchResults([]); setSearchError(true); }
    setSearchLoading(false);
  };

  const addItem = (item) => {
    if (colItems.find(i => i.id === item.id)) return;
    setColItems(prev => [...prev, { ...item, note: "", order: prev.length }]);
    setSearchQ("");
    setSearchResults([]);
  };

  const removeItem = (id) => setColItems(prev => prev.filter(i => i.id !== id));

  const moveItem = (idx, dir) => {
    setColItems(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const updateNote = (id, note) => setColItems(prev => prev.map(i => i.id === id ? { ...i, note } : i));
  const updateRating = (id, rating) => setColItems(prev => prev.map(i => i.id === id ? { ...i, rating: i.rating === rating ? 0 : rating } : i));

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), visibility, show_numbers: showNumbers, items: colItems });
      onClose();
    } catch (e) { setSaving(false); }
  };

  const itemTypeIcon = { media: "🎬", character: "👤", person: "🎭", comicchar: "💬" };

  return createPortal(
    <div className="modal-bg" onClick={onClose} style={isMobileDevice ? { paddingBottom: 64 } : {}}>
      <div className="modal fade-in cover-modal modal-glass" style={{ maxWidth: 560, padding: 0, display: "flex", flexDirection: "column", width: "100%" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, flexShrink: 0 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
            {initialData ? "✏️ Editar Coleção" : "📋 Nova Coleção"}
          </h3>
          <input
            placeholder="Nome da coleção..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: darkMode ? "#0d1117" : "#f8fafc", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 14, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }}
          />
          <textarea
            placeholder="Descrição (opcional)..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: darkMode ? "#0d1117" : "#f8fafc", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 13, fontFamily: "inherit", resize: "none", marginBottom: 10, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {["public", "friends", "private"].map(v => (
              <button key={v} onClick={() => setVisibility(v)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: visibility === v ? accent : "transparent",
                border: `1px solid ${visibility === v ? accent : "#30363d"}`,
                color: visibility === v ? "#fff" : "#8b949e",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {v === "public" ? "🌐 Pública" : v === "friends" ? "👥 Amigos" : "🔒 Privada"}
              </button>
            ))}
            <button onClick={() => setShowNumbers(v => !v)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: showNumbers ? `${accent}22` : "transparent",
              border: `1px solid ${showNumbers ? accent : "#30363d"}`,
              color: showNumbers ? accent : "#8b949e",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              # Números
            </button>
          </div>
        </div>

        {/* Body scrollável */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
              {searchTypeOpts.map(opt => (
                <button key={opt.id} onClick={() => { setSearchType(opt.id); setSearchQ(""); setSearchResults([]); }} style={{
                  flexShrink: 0, padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: searchType === opt.id ? accent : "transparent",
                  border: `1px solid ${searchType === opt.id ? accent : "#30363d"}`,
                  color: searchType === opt.id ? "#fff" : "#8b949e",
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
              ))}
            </div>
            <input
              placeholder={searchType === "library" ? "Pesquisar na biblioteca..." : searchType === "character" ? "Nome do personagem ou da série/anime..." : searchType === "person" ? "Nome do ator ou realizador..." : "Nome do personagem comic..."}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: darkMode ? "#0d1117" : "#f8fafc", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            {/* Results */}
            {(searchLoading || searchResults.length > 0 || (searchQ.trim() && !searchLoading && searchError) || (searchQ.trim() && !searchLoading && !searchError && searchResults.length === 0)) && (
              <div style={{ marginTop: 6, background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 10, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, maxHeight: 200, overflowY: "auto" }}>
                {searchLoading ? (
                  <div style={{ padding: "12px 16px", color: "#8b949e", fontSize: 13 }}>A pesquisar...</div>
                ) : searchError ? (
                  <div style={{ padding: "12px 16px", color: "#ef4444", fontSize: 13 }}>Erro ao pesquisar. Verifica a ligação.</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "12px 16px", color: "#8b949e", fontSize: 13 }}>Nenhum resultado para "{searchQ}"</div>
                ) : searchResults.map(r => {
                  const already = colItems.some(i => i.id === r.id);
                  return (
                    <div key={r.id} onClick={() => !already && addItem(r)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      cursor: already ? "default" : "pointer", opacity: already ? 0.5 : 1,
                      borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
                    }}
                      onMouseEnter={e => { if (!already) e.currentTarget.style.background = darkMode ? "#21262d" : "#e2e8f0"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                    >
                      <div style={{ width: 32, height: 44, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "#21262d" }}>
                        {r.cover ? <img src={r.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{itemTypeIcon[r.itemType]}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? "#e6edf3" : "#0d1117", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize: 11, color: "#8b949e" }}>{r.subtitle}</div>}
                      </div>
                      {already ? <span style={{ fontSize: 11, color: accent }}>✓ Adicionado</span> : <span style={{ fontSize: 18, color: accent }}>+</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Items list */}
          {colItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#484f58" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <p style={{ fontSize: 13 }}>Pesquisa e adiciona itens à coleção</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 12 }}>
              {colItems.map((item, idx) => (
                <div key={item.id} className="col-item-card" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: "#21262d" }}>
                    {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{itemTypeIcon[item.itemType]}</span>}
                    {showNumbers && <span style={{ position: "absolute", top: 4, left: 4, background: accent, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 4, padding: "1px 5px" }}>{idx + 1}</span>}
                    {/* Overlay de controlo — só no hover */}
                    <div className="col-item-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", opacity: 0, transition: "opacity 0.15s", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 4 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={() => removeItem(item.id)} style={{ background: "rgba(0,0,0,0.6)", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} style={{ background: "rgba(0,0,0,0.6)", border: "none", color: idx === 0 ? "#484f58" : "#fff", cursor: idx === 0 ? "default" : "pointer", fontSize: 12, width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === colItems.length - 1} style={{ background: "rgba(0,0,0,0.6)", border: "none", color: idx === colItems.length - 1 ? "#484f58" : "#fff", cursor: idx === colItems.length - 1 ? "default" : "pointer", fontSize: 12, width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</div>
                  <input
                    placeholder="Nota (opcional)..."
                    value={item.note || ""}
                    onChange={e => updateNote(item.id, e.target.value)}
                    style={{ width: "100%", padding: "3px 6px", fontSize: 10, borderRadius: 5, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: "transparent", color: "#8b949e", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`.col-item-card:hover .col-item-overlay { opacity: 1; }`}</style>

        {/* Footer */}
        <div style={{ padding: "12px 24px", paddingBottom: isMobileDevice ? 24 : 14, borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn-accent" style={{ flex: 1, padding: "12px" }} onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "A guardar..." : "💾 Guardar Coleção"}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: darkMode ? "#21262d" : "#e2e8f0", border: "none", borderRadius: 10, color: darkMode ? "#e6edf3" : "#0d1117", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
