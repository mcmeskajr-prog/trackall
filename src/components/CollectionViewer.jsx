import { useState } from "react";
import { fetchAniListSafe } from "../api/anilist";
import { useLang } from "../contexts/LangContext";
import { useTheme } from "../contexts/ThemeContext";

export function CollectionViewer({ col, onClose, onLike, liked, currentUserId, onEdit, onOpenMedia, workerUrl }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
  const items = col.items || [];
  const itemTypeIcon = { media: "🎬", character: "👤", person: "🎭", comicchar: "💬" };
  const [colSize, setColSize] = useState(() => { try { return localStorage.getItem("trackall_col_size") || "medium"; } catch { return "medium"; } });
  const setColSizePersist = (s) => { setColSize(s); try { localStorage.setItem("trackall_col_size", s); } catch {} };
  const colMinWidth = colSize === "small" ? 100 : colSize === "large" ? 190 : 140;
  const [selectedChar, setSelectedChar] = useState(null);
  const [charData, setCharData] = useState(null);
  const [charLoading, setCharLoading] = useState(false);

  const cleanDesc = (text) => {
    if (!text) return "";
    return text
      .replace(/~![\s\S]*?!~/g, "")             // ~!spoiler!~ → remove
      .replace(/__([^_]+)__/g, "$1")             // __bold__ → bold
      .replace(/\*\*([^*]+)\*\*/g, "$1")         // **bold** → bold
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // [text](url) → text
      .replace(/<br\s*\/?>/gi, " ")              // <br> → espaço
      .replace(/<[^>]*>/g, "")                   // outras html tags
      .replace(/\n{2,}/g, " • ")                 // parágrafos → bullet
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const handleItemClick = (item) => {
    if (item.itemType === "media" || (!item.itemType && item.id)) {
      onOpenMedia && onOpenMedia(item);
    } else if (item.itemType === "character" || item.itemType === "person" || item.itemType === "comicchar") {
      setSelectedChar(item);
      setCharData(null);
      // Fetch AniList character data if it's an AniList character
      const alCharId = item.id?.startsWith("alchar-") ? item.id.replace("alchar-", "") : null;
      if (alCharId) {
        setCharLoading(true);
        const charQuery = `query($id:Int){Character(id:$id){description(asHtml:false) age gender dateOfBirth{year month day} media(perPage:6,sort:POPULARITY_DESC){nodes{id title{romaji}coverImage{medium}type format}}}}`;
        const charBody = JSON.stringify({ query: charQuery, variables: { id: parseInt(alCharId) } });
        fetchAniListSafe(["https://graphql.anilist.co", wUrl + "/anilist"], charBody)
          .then(d => {
            setCharData(d?.data?.Character || null);
            setCharLoading(false);
          }).catch(() => setCharLoading(false));
      }
    }
  };

  return (
    <div className="fade-in view-transition" style={{ minHeight: "100vh", background: "transparent" }}>
      {/* Header */}
      <div style={{
        padding: isMobileDevice ? "16px 16px 12px" : "24px 32px 16px",
        borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Back + actions row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: accent,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 4,
          }}>← {isMobileDevice ? "" : "Voltar"}</button>
          <h2 style={{ flex: 1, fontSize: isMobileDevice ? 18 : 22, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", lineHeight: 1.2, margin: 0 }}>{col.title}</h2>
          {currentUserId === col.user_id && (
            <button onClick={() => onEdit(col)} style={{
              background: "transparent", border: `1px solid ${accent}`, color: accent,
              borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>✏️ Editar</button>
          )}
        </div>
        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => onLike(col.id)} style={{
            background: liked ? `${accent}22` : "transparent",
            border: `1px solid ${liked ? accent : "#30363d"}`,
            color: liked ? accent : "#8b949e",
            borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>♥ {col.likes_count || 0}</button>
          <span style={{ fontSize: 12, color: "#8b949e" }}>{items.length} {items.length === 1 ? "item" : "itens"}</span>
          <span style={{ fontSize: 11, color: "#8b949e" }}>{col.visibility === "private" ? "🔒 Privada" : col.visibility === "friends" ? "👥 Amigos" : "🌐 Pública"}</span>
          <div style={{ display: "flex", gap: 2, marginLeft: "auto", background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 8, padding: 2 }}>
            {[{ id: "small", label: "P" }, { id: "medium", label: "M" }, { id: "large", label: "G" }].map(s => (
              <button key={s.id} onClick={() => setColSizePersist(s.id)} title={s.id === "small" ? "Pequeno" : s.id === "large" ? "Grande" : "Médio"} style={{ width: 26, height: 24, borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: colSize === s.id ? (darkMode ? "#30363d" : "#fff") : "transparent", color: colSize === s.id ? accent : "#8b949e" }}>{s.label}</button>
            ))}
          </div>
        </div>
        {col.description ? <p style={{ fontSize: 13, color: "#8b949e", margin: 0, lineHeight: 1.5 }}>{col.description}</p> : null}
      </div>

      {/* Grid */}
      <div style={{ padding: isMobileDevice ? "12px 10px" : "20px 32px", paddingBottom: isMobileDevice ? 90 : 32 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14 }}>Esta coleção está vazia</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobileDevice ? Math.max(colMinWidth - 40, 90) : colMinWidth}px, 1fr))`, gap: isMobileDevice ? 6 : 10 }}>
            {items.map((item, idx) => {
              const isChar = item.itemType === "character" || item.itemType === "person" || item.itemType === "comicchar";
              const clickable = true;
              return (
                <div key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{ display: "flex", flexDirection: "column", gap: 5, cursor: "pointer" }}
                >
                  <div style={{
                    aspectRatio: "2/3",
                    borderRadius: 8, overflow: "hidden", background: "#21262d", position: "relative",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    transition: "transform 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                  >
                    {item.cover
                      ? <img src={item.cover} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} onError={e => { e.target.style.display = "none"; }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{itemTypeIcon[item.itemType] || "🎬"}</div>
                    }
                    {col.show_numbers && (
                      <div style={{
                        position: "absolute", bottom: 5, left: 5,
                        background: "rgba(0,0,0,0.75)", color: "#fff",
                        borderRadius: "50%", width: 20, height: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800,
                      }}>{idx + 1}</div>
                    )}
                  </div>
                  <div style={{ fontSize: isMobileDevice ? 10 : 11, fontWeight: 700, color: darkMode ? "#c9d1d9" : "#374151", lineHeight: 1.3, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
                  {item.subtitle && <div style={{ fontSize: isMobileDevice ? 9 : 10, color: accent, textAlign: "center", fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.subtitle}</div>}
                  {item.note && <div style={{ fontSize: 9, color: "#8b949e", textAlign: "center", fontStyle: "italic", lineHeight: 1.3 }}>{item.note}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de personagem */}
      {selectedChar && (
        <div className="modal-bg" onClick={() => { setSelectedChar(null); setCharData(null); }} style={{ zIndex: 200 }}>
          <div className="modal fade-in modal-glass" style={{ maxWidth: 420, width: "95%", padding: 0, overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            {/* Header com imagem + nome */}
            <div style={{ display: "flex", gap: 0, position: "relative", background: "#0d1117", flexShrink: 0 }}>
              {/* Imagem */}
              <div style={{ width: 120, minHeight: 160, flexShrink: 0, background: "#21262d" }}>
                {selectedChar.cover
                  ? <img src={selectedChar.cover} alt={selectedChar.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
                  : <div style={{ width: "100%", height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>👤</div>
                }
              </div>
              {/* Info direita */}
              <div style={{ flex: 1, padding: "16px 16px 16px 16px", display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#e6edf3", lineHeight: 1.2 }}>{selectedChar.title}</div>
                {selectedChar.subtitle && <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{selectedChar.subtitle}</div>}
                {charData?.age && <div style={{ fontSize: 11, color: "#8b949e" }}>{lang === "en" ? "Age" : "Idade"}: {charData.age}</div>}
                {charData?.gender && <div style={{ fontSize: 11, color: "#8b949e" }}>{lang === "en" ? "Gender" : "Género"}: {charData.gender}</div>}
                {selectedChar.note && <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic", lineHeight: 1.4, marginTop: 4 }}>"{selectedChar.note}"</div>}
              </div>
              <button onClick={() => { setSelectedChar(null); setCharData(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Body scrollável */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {charLoading ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#8b949e", fontSize: 13 }}>
                  <span className="spin" style={{ fontSize: 20, display: "inline-block" }}>◌</span>
                </div>
              ) : (
                <>
                  {/* Descrição */}
                  {charData?.description && (
                    <div style={{ padding: "14px 16px 0" }}>
                      <p style={{ fontSize: 12, color: darkMode ? "#8b949e" : "#64748b", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {cleanDesc(charData.description)}
                      </p>
                    </div>
                  )}

                  {/* Obras */}
                  {charData?.media?.nodes?.length > 0 && (
                    <div style={{ padding: "14px 16px 20px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{lang === "en" ? "Appears in" : "Aparece em"}</div>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {charData.media.nodes.map(m => {
                          const mType = m.type === "MANGA" ? "manga" : "anime";
                          const mId = `al-${mType}-${m.id}`;
                          return (
                            <div key={m.id} onClick={() => { setSelectedChar(null); setCharData(null); onOpenMedia && onOpenMedia({ id: mId, title: m.title?.romaji, type: mType, cover: m.coverImage?.medium }); }} style={{ flexShrink: 0, width: 80, cursor: "pointer" }}>
                              <div style={{ width: 80, height: 112, borderRadius: 7, overflow: "hidden", background: "#21262d", marginBottom: 5 }}>
                                {m.coverImage?.medium
                                  ? <img src={m.coverImage.medium} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎬</div>
                                }
                              </div>
                              <div style={{ fontSize: 10, color: darkMode ? "#c9d1d9" : "#374151", lineHeight: 1.3, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{m.title?.romaji}</div>
                              <div style={{ fontSize: 9, color: accent, textAlign: "center", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{m.format?.replace("_", " ")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sem dados AniList — só para personagens não-AniList */}
                  {!charData && !charLoading && !selectedChar.id?.startsWith("alchar-") && (
                    <div style={{ padding: "20px 16px", color: "#8b949e", fontSize: 12, textAlign: "center" }}>
                      {selectedChar.subtitle && <p>De: {selectedChar.subtitle}</p>}
                    </div>
                  )}
                  {/* AniList mas sem dados — retry link */}
                  {!charData && !charLoading && selectedChar.id?.startsWith("alchar-") && (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#484f58", marginBottom: 8 }}>
                        {lang === "en" ? "Could not load character data." : "Não foi possível carregar dados do personagem."}
                      </p>
                      <a href={`https://anilist.co/character/${selectedChar.id.replace("alchar-","")}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: accent, fontWeight: 700 }}>
                        Ver no AniList →
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
