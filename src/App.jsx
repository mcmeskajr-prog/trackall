import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync, createPortal } from "react-dom";
import { createClient } from '@supabase/supabase-js';
import { StarRating } from './components/StarRating';
import { Notification } from './components/Notification';
import { MediaCard } from './components/MediaCard';
import { VirtualGrid } from './components/VirtualGrid';
import { TiltCard } from './components/TiltCard';
import { CropModal } from './components/CropModal';
import { CollectionModal } from './components/CollectionModal';
import { CoverEditModal } from './components/CoverEditModal';
import { DetailModal } from './components/DetailModal';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { FriendsView } from './components/FriendsView';
import { FeedTab } from './components/FeedTab';
import { ProfileView } from './components/ProfileView';
import { ProfileTabCompletos } from './components/ProfileTabCompletos';
import { ProfileTabDiario } from './components/ProfileTabDiario';
import { TierListCard } from './components/TierListCard';
import { CollectionCard } from './components/CollectionCard';
import { RecentSection } from './components/RecentSection';
import { MihonImportModal } from './components/MihonImportModal';
import { PaperbackImportModal } from './components/PaperbackImportModal';
import { LetterboxdImportModal } from './components/LetterboxdImportModal';
import { parseMihonBackup, parsePaperbackBackup, parseLetterboxdCSV } from './lib/importParsers';
import { t, detectLang, saveLang } from './translations';
// ─── Config imports ───────────────────────────────────────────────────────────
import { MEDIA_TYPES, STATUS_OPTIONS, TIER_LEVELS, TYPE_COLORS, MONTH_PT, MONTH_EN, mediaLabel, getMediaTypeLabel, statusLabel } from './config/constants';
import { ACCENT_PRESETS, BG_PRESETS, isColorDark, accentShade, accentVariant } from './config/theme';
import { supabase, supa } from './config/supabase';

// ─── Lib imports ──────────────────────────────────────────────────────────────
import { normalizeMediaId, mediaIdCandidates, findLibraryEntry, normalizeMediaItem } from './lib/mediaIds';
import { getConsumptionTime } from './lib/consumptionTime';
import { shuffle, gradientFor, compressImage } from './lib/utils';

// ─── API imports ──────────────────────────────────────────────────────────────
import { searchAniList, fetchAniListSafe, fetchTrendingAnime, fetchTrendingManga } from './api/anilist';
import { searchTMDB, fetchTrendingMovies, fetchTrendingSeries } from './api/tmdb';
import { searchIGDB, searchSteam, fetchTrendingGames } from './api/igdb';
import { searchGoogleBooks } from './api/books';
import { searchComicVine } from './api/comicvine';
import { fetchMediaDetails } from './api/details';
import { fetchPersonalizedRecos } from './api/recommendations';
import { smartSearch, CACHE, cacheKey } from './api/smartSearch';

// ─── Contexts ─────────────────────────────────────────────────────────────────
import { ThemeContext, useTheme, useAccent, useDarkMode, useIsMobile } from './contexts/ThemeContext';
import { LangContext, useLang } from './contexts/LangContext';

// ─── Configurações padrão ────────────────────────────────────────────────────
const DEFAULT_TMDB_KEY = ""; // Chave movida para o Cloudflare Worker (variável TMDB_KEY)
const DEFAULT_WORKER_URL = "https://trackall-proxy.mcmeskajr.workers.dev";

// Wrapper simples para manter compatibilidade com o resto do código

// ─── Theme Context ────────────────────────────────────────────────────────────
// ─── Storage (Claude artifact + localStorage para APK/Capacitor) ──────────────
const DB = {
  async get(key) {
    // Tenta window.storage (Claude artifact)
    try {
      if (window.storage) {
        const r = await window.storage.get(key);
        if (r?.value != null) return r.value;
      }
    } catch {}
    // Fallback localStorage (APK / browser normal)
    try { return localStorage.getItem(key); } catch {}
    return null;
  },
  async set(key, val) {
    let ok = false;
    // Tenta window.storage primeiro
    try {
      if (window.storage) {
        const result = await window.storage.set(key, val);
        if (result) ok = true;
      }
    } catch {}
    // localStorage sempre (como backup e para APK)
    try { localStorage.setItem(key, val); ok = true; } catch {}
    return ok;
  },
};


function normalizeAniListType(type) {
  if (!type) return "";
  if (type === "ANIME" || type === "anime") return "anime";
  if (type === "MANGA" || type === "manga" || type === "manhwa" || type === "lightnovels") return "manga";
  return "";
}


// ─── APIs ─────────────────────────────────────────────────────────────────────

// 1. AniList — ver src/api/anilist.js (searchAniList, fetchAniListSafe, fetchTrendingAnime, fetchTrendingManga)

// 2. TMDB — ver src/api/tmdb.js (searchTMDB, fetchTrendingMovies, fetchTrendingSeries)

// fetchMediaDetails — ver src/api/details.js
// 3. Google Books — ver src/api/books.js (searchGoogleBooks)

// 4. IGDB, Steam — ver src/api/igdb.js (searchIGDB, searchSteam, fetchTrendingGames)

// 5. ComicVine — ver src/api/comicvine.js (searchComicVine)

// smartSearch, CACHE, cacheKey — ver src/api/smartSearch.js

// ─── Placeholder Gradients ─────────────────────────────────────────────────────
// GRADIENTS, gradientFor — ver src/lib/utils.js
// StarRating — ver components/StarRating.jsx

// Notification — ver components/Notification.jsx

// ─── Image utils ───────────────────────────────────────────────────────────────
// Compresses an image File to a base64 JPEG ≤ 300 KB (portrait 400×600)
// compressImage, compressBanner — ver src/lib/utils.js

// ─── Mihon Backup Parser ──────────────────────────────────────────────────────

// parseMihonBackup — ver lib/importParsers.js
// ─── Google Drive OAuth helper ────────────────────────────────────────────────
// Client ID criado em console.cloud.google.com — o utilizador tem de inserir o seu
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// MihonImportModal — ver components/MihonImportModal.jsx



// CropModal — ver components/CropModal.jsx

// CoverEditModal — ver components/CoverEditModal.jsx
// DetailModal — ver components/DetailModal.jsx
// ─── Media Card ────────────────────────────────────────────────────────────────
// VirtualGrid — ver components/VirtualGrid.jsx

// TiltCard — ver components/TiltCard.jsx

// MediaCard — ver components/MediaCard.jsx

// ─── Profile / Settings View ──────────────────────────────────────────────────
function DiaryPanel({ completados, onOpen }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [showAll, setShowAll] = useState(false);
  if (!completados || !completados.length) return null;
  const groups = {};
  completados.forEach(item => {
    const d = item.addedAt ? new Date(item.addedAt) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}` : "0000-00";
    if (!groups[key]) groups[key] = { key, year: d ? d.getFullYear() : 0, month: d ? d.getMonth() : 0, items: [] };
    groups[key].items.push({ ...item, _day: d ? d.getDate() : 0 });
  });
  const sorted = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
  if (!sorted.length) return null;
  const visible = showAll ? sorted : sorted.slice(0, 3);
  const hiddenCount = sorted.slice(3).reduce((s,g) => s + g.items.length, 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("diary").toUpperCase()}</h3>
        <span style={{ fontSize: 11, color: "#484f58" }}>{completados.length} entradas</span>
      </div>
      {visible.map(group => (
        <div key={group.key} style={{ display: "flex", marginBottom: 20 }}>
          <div style={{ flexShrink: 0, width: 56, marginRight: 12 }}>
            <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
              <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#e6edf3", letterSpacing: 1 }}>
                {group.key === "0000-00" ? "—" : group.year}
              </div>
              <div style={{ padding: "5px 0 6px", fontSize: group.key === "0000-00" ? 11 : 17, fontWeight: 900, color: "#e6edf3" }}>
                {group.key === "0000-00" ? "Sem data" : (lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
              <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 4px",
                borderBottom: idx < arr.length-1 ? "1px solid #21262d" : "none",
                cursor: "pointer", borderRadius: 4,
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#484f58", width: 14, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                {(item.customCover || item.cover || item.thumbnailUrl)
                  ? <img src={item.customCover || item.cover || item.thumbnailUrl} alt="" style={{ width: 24, height: 36, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                  : <div style={{ width: 24, height: 36, borderRadius: 3, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                }
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#e6edf3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                {item.userRating > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, flexShrink: 0 }}>★ {item.userRating}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {sorted.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} style={{ width: "100%", padding: "8px", borderRadius: 8, background: "#21262d", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
          {showAll ? "↑ Mostrar menos" : `Ver mais — ${hiddenCount} entr${hiddenCount===1?"ada":"adas"}`}
        </button>
      )}
    </div>
  );
}

// RecentSection — ver components/RecentSection.jsx
// ─── Tier List Components ─────────────────────────────────────────────────────

// ─── Collection Components ────────────────────────────────────────────────────

// CollectionCard — ver components/CollectionCard.jsx
// CollectionModal — ver components/CollectionModal.jsx

function CollectionViewer({ col, onClose, onLike, liked, currentUserId, onEdit, onOpenMedia, workerUrl }) {
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

// TierListCard — ver components/TierListCard.jsx
function TierListEditor({ initialData, library, onSave, onClose, workerUrl, tmdbKey }) {
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

function TierListViewer({ tl, onClose, onLike, liked, currentUserId, onEdit, onOpenItem }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in modal-glass" style={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", flex: 1, marginRight: 12 }}>{tl.title}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
          {tl.profiles && <p style={{ fontSize: 12, color: "#484f58", marginBottom: 12 }}>por @{tl.profiles.username || tl.profiles.name}</p>}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => onLike && onLike(tl.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: liked ? `${accent}22` : "none", border: `1px solid ${liked ? accent : "#30363d"}`, borderRadius: 20, padding: "6px 16px", color: liked ? accent : "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              ♥ {tl.likes_count || 0} gostos
            </button>
            {currentUserId === tl.user_id && onEdit && (
              <button onClick={() => { onClose(); onEdit(tl); }} style={{ background: "none", border: "1px solid #30363d", borderRadius: 20, padding: "6px 16px", color: "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                ✏ Editar
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          {TIER_LEVELS.map(tier => {
            const items = tl.tiers[tier.id] || [];
            return (
              <div key={tier.id} style={{ display: "flex", minHeight: 96, borderRadius: 10, overflow: "hidden", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                <div style={{ width: 52, background: tier.color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 3 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "white" }}>{tier.id}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>{items.length}</span>
                </div>
                <div style={{ flex: 1, background: darkMode ? "#0d1117" : "#f8fafc", display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center" }}>
                  {items.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#484f58" }}>Vazio</span>
                  ) : items.map(item => {
                    const cover = item.customCover || item.cover || item.thumbnailUrl;
                    return (
                      <div key={item.id} title={item.title} onClick={() => onOpenItem && onOpenItem(item)} style={{ flexShrink: 0, cursor: onOpenItem ? "pointer" : "default" }}>
                        <div style={{ width: 62, height: 90, borderRadius: 7, overflow: "hidden", background: gradientFor(item.id) }}>
                          {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ProfileTabCompletos — ver components/ProfileTabCompletos.jsx
// ProfileTabDiario — ver components/ProfileTabDiario.jsx
// ProfileView — ver components/ProfileView.jsx
// FeedTab — ver components/FeedTab.jsx
// FriendsView — ver components/FriendsView.jsx
// ─── Auth Screen ──────────────────────────────────────────────────────────────
// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_LIBRARY = {
  "al-1": { id: "al-1", title: "Attack on Titan", type: "anime", userStatus: "completo", userRating: 10, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg", addedAt: Date.now() - 86400000 * 2 },
  "al-2": { id: "al-2", title: "Demon Slayer", type: "anime", userStatus: "assistindo", userRating: 9, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg", addedAt: Date.now() - 86400000 * 4 },
  "al-3": { id: "al-3", title: "Tokyo Ghoul", type: "manga", userStatus: "completo", userRating: 9, cover: "https://cdn.myanimelist.net/images/manga/3/258224l.jpg", addedAt: Date.now() - 86400000 * 6 },
  "al-4": { id: "al-4", title: "Jujutsu Kaisen", type: "anime", userStatus: "planeado", userRating: 0, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg", addedAt: Date.now() - 86400000 * 8 },
  "al-5": { id: "al-5", title: "One Piece", type: "manga", userStatus: "assistindo", userRating: 10, cover: "https://cdn.myanimelist.net/images/manga/2/253146l.jpg", addedAt: Date.now() - 86400000 * 10 },
  "al-6": { id: "al-6", title: "Chainsaw Man", type: "manga", userStatus: "completo", userRating: 9, cover: "https://cdn.myanimelist.net/images/manga/3/216464l.jpg", addedAt: Date.now() - 86400000 * 12 },
  "tmdb-1": { id: "tmdb-1", title: "Oppenheimer", type: "filmes", userStatus: "completo", userRating: 9, cover: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", addedAt: Date.now() - 86400000 * 3 },
  "tmdb-2": { id: "tmdb-2", title: "Breaking Bad", type: "series", userStatus: "completo", userRating: 10, cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", addedAt: Date.now() - 86400000 * 5 },
  "tmdb-3": { id: "tmdb-3", title: "Dune: Part Two", type: "filmes", userStatus: "completo", userRating: 9, cover: "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg", addedAt: Date.now() - 86400000 * 1 },
  "tmdb-4": { id: "tmdb-4", title: "The Last of Us", type: "series", userStatus: "completo", userRating: 10, cover: "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", addedAt: Date.now() - 86400000 * 11 },
  "game-1": { id: "game-1", title: "Elden Ring", type: "jogos", userStatus: "completo", userRating: 10, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg", addedAt: Date.now() - 86400000 * 7 },
  "game-2": { id: "game-2", title: "Hollow Knight", type: "jogos", userStatus: "completo", userRating: 9, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg", addedAt: Date.now() - 86400000 * 14 },
};
const DEMO_PROFILE = { name: "Demo User", bio: "A explorar o TrackAll ✨", avatar: "", accent: "#f97316", favorites: [
  { id: "al-1", title: "Attack on Titan", type: "anime", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg" },
  { id: "tmdb-2", title: "Breaking Bad", type: "series", cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
  { id: "game-1", title: "Elden Ring", type: "jogos", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg" },
], hallOfFame: [
  { id: "al-1", title: "Attack on Titan", type: "anime", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg" },
  { id: "tmdb-2", title: "Breaking Bad", type: "series", cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
]};
const DEMO_FEED = [
  { user: "mrdk", avatar: "", action: "completou", item: "Chainsaw Man", type: "manga", rating: 9, time: "há 2h" },
  { user: "shutw", avatar: "", action: "adicionou à biblioteca", item: "Frieren", type: "anime", rating: 0, time: "há 5h" },
  { user: "wmans", avatar: "", action: "completou", item: "The Last of Us", type: "series", rating: 10, time: "há 1d" },
  { user: "mrdk", avatar: "", action: "avaliou", item: "Oppenheimer", type: "filmes", rating: 8, time: "há 1d" },
];

// LandingPage — ver components/LandingPage.jsx
// ─── Recommendations ──────────────────────────────────────────────────────────
// fetchAniListSafe, fetchTrendingAnime, fetchTrendingManga — ver src/api/anilist.js

// fetchTrendingMovies, fetchTrendingSeries — ver src/api/tmdb.js

// fetchTrendingGames — ver src/api/igdb.js

// fetchPersonalizedRecos — ver src/api/recommendations.js

// ─── Recommendation Carousel ──────────────────────────────────────────────────
function RecoCarousel({ title, icon, items, library, onOpen, loading, isPersonal }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  // Skeleton só se loading E sem dados ainda — se já há dados, mostra mesmo durante refresh
  if (loading && !isPersonal && (!items || items.length === 0)) return (
    <div style={{ padding: "0 16px 28px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{icon} {title}</h2>
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flexShrink: 0, width: 100, height: 148, borderRadius: 10, background: "#161b22", animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    </div>
  );
  if (!items || items.length === 0) return null;

  // Filter out items already in library — as user adds, new ones slide in
  const toShow = items.filter(i => !findLibraryEntry(library, i.id, i.type));
  if (toShow.length === 0) return null;

  return (
    <div style={{ padding: "0 16px 28px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{icon} {title}</h2>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {toShow.map(item => (
          <div key={item.id}
            onClick={() => onOpen(item)}
            style={{ flexShrink: 0, width: 100, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            onMouseEnter={e => { const img = e.currentTarget.querySelector(".reco-img"); if(img) img.style.transform="scale(1.05)"; const ov = e.currentTarget.querySelector(".reco-overlay"); if(ov) ov.style.opacity="1"; }}
            onMouseLeave={e => { const img = e.currentTarget.querySelector(".reco-img"); if(img) img.style.transform="scale(1)"; const ov = e.currentTarget.querySelector(".reco-overlay"); if(ov) ov.style.opacity="0"; }}>
            <div style={{ width: 100, height: 148, borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), marginBottom: 6, position: "relative" }}>
              {item.cover
                ? <img className="reco-img" src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s ease", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, pointerEvents: "none" }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
              }
              <div className="reco-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s", borderRadius: 10, pointerEvents: "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                </div>
              </div>
              {(() => {
                const libItem = findLibraryEntry(library, item.id, item.type)?.item;
                const score = libItem?.userRating > 0 ? libItem.userRating : item.score;
                return score > 0 ? (
                  <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.75)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700, pointerEvents: "none" }}>
                    ★ {score}
                  </div>
                ) : null;
              })()}
            </div>
            <p style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </div>
  );
}

// ─── Library Grouped List (modo lista agrupado por tipo) ─────────────────────
function LibGroupedList({ items, library, onOpen }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();

  const [collapsed, setCollapsed] = useState({});
  const toggle = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const groups = MEDIA_TYPES.slice(1)
    .map(t => ({ type: t, items: items.filter(i => i.type === t.id) }))
    .filter(g => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map(({ type: t, items: gItems }) => (
        <div key={t.id}>
          <button onClick={() => toggle(t.id)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: "none", border: "none", cursor: "pointer", padding: "4px 0 8px",
            fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: darkMode ? "#8b949e" : "#64748b" }}>{mediaLabel(t, lang)}</span>
            <span style={{ fontSize: 10, color: accent, background: `${accent}18`, padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{gItems.length}</span>
            <span style={{ marginLeft: "auto", color: "#484f58", fontSize: 13, transform: collapsed[t.id] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
          </button>
          {!collapsed[t.id] && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {gItems.map(item => {
                const libItem = findLibraryEntry(library, item.id, item.type)?.item;
                const status = STATUS_OPTIONS.find(s => s.id === libItem?.userStatus);
                const coverSrc = libItem?.customCover || item.cover || item.thumbnailUrl;
                return (
                  <div key={item.id} onClick={() => onOpen(item)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "7px 10px",
                    borderRadius: 8, cursor: "pointer",
                    background: darkMode ? "#161b22" : "rgba(255,252,247,0.8)",
                    border: `1px solid ${darkMode ? "#21262d" : "#e8e0d5"}`,
                    transition: "background 0.12s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1c2128" : "#fffcf7"}
                    onMouseLeave={e => e.currentTarget.style.background = darkMode ? "#161b22" : "rgba(255,252,247,0.8)"}>
                    <div style={{ width: 34, height: 48, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: gradientFor(item.id) }}>
                      {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: darkMode ? "#e6edf3" : "#1a1a2e" }}>{item.title}</p>
                      {item.year && <p style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>{item.year}</p>}
                    </div>
                    {status && <span style={{ fontSize: 12, flexShrink: 0 }}>{status.emoji}</span>}
                    {libItem?.userRating > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 800, flexShrink: 0 }}>★ {libItem.userRating}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// parsePaperbackBackup — ver lib/importParsers.js
// parseLetterboxdCSV — ver lib/importParsers.js
// PaperbackImportModal — ver components/PaperbackImportModal.jsx
// LetterboxdImportModal — ver components/LetterboxdImportModal.jsx
// ─── Main App ──────────────────────────────────────────────────────────────────
function RatingOverlay({ item, library, onDone }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [rating, setRating] = useState(0);
  const textColor = (() => {
    const r=parseInt(accent.slice(1,3),16)/255, g=parseInt(accent.slice(3,5),16)/255, b=parseInt(accent.slice(5,7),16)/255;
    return 0.2126*r+0.7152*g+0.0722*b > 0.45 ? "#111" : "#fff";
  })();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => onDone(0)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#161b22", border: `1px solid ${accent}44`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, textAlign: "left" }}>
          {(item.cover || item.thumbnailUrl)
            ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 48, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            : <div style={{ width: 48, height: 68, borderRadius: 8, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
          }
          <div>
            <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>✓ Marcado como completo!</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e6edf3" }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#8b949e", marginBottom: 16 }}>{lang === "en" ? "Want to rate it?" : "Queres dar uma avaliação?"}</p>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <StarRating value={rating} onChange={setRating} size={isMobileDevice ? 22 : 26} />
          </div>
          {rating > 0 && (
            <button onClick={() => onDone(rating)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: accent, border: "none", color: textColor, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              Confirmar ★ {rating}
            </button>
          )}
        </div>
        <button onClick={() => onDone(0)} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "#21262d", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          Saltar avaliação
        </button>
      </div>
    </div>
  );
}

// AuthScreen — ver components/AuthScreen.jsx
// ─── Sidebar Search ───────────────────────────────────────────────────────────
function SidebarSearch({ accent, darkMode, activeTab, doSearch, setSearchQuery, setView, useT }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const submit = () => {
    if (!q.trim()) return;
    setSearchQuery(q);
    setView("search");
    doSearch(q, activeTab);
    setOpen(false); setQ("");
  };
  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)} className="ds-nav-btn" style={{ padding: "11px 16px" }}>
          <span className="ds-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/>
              <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          {useT("search")}
        </button>
      ) : (
        <div ref={containerRef} style={{ margin: "2px 8px", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 10, border: `1px solid ${accent}55`, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="10.5" cy="10.5" r="6.5" stroke={accent} strokeWidth="2"/>
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setOpen(false); setQ(""); }
            }}
            placeholder={useT("search") + "..."}
            style={{ flex: 1, background: "transparent", border: "none", color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 13, outline: "none", padding: 0, minWidth: 0 }} />
          <button onClick={() => { setOpen(false); setQ(""); }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0, padding: 0 }}>✕</button>
        </div>
      )}
    </>
  );
}

export default function TrackAll() {
  const [lang, setLang] = useState(() => detectLang());
  const useT = (key) => t(key, lang);
  const changeLang = (newLang) => { setLang(newLang); saveLang(newLang); };
  const [accent, setAccent] = useState("#f97316");
  const [bgColor, setBgColor] = useState("#0d1117");
  const [bgColorMobile, setBgColorMobile] = useState(""); // "" = igual ao PC
  const [sidebarColor, setSidebarColor] = useState(""); // "" = igual ao bgColor
  const [textContrast, setTextContrast] = useState(100);
  const [textContrastMobile, setTextContrastMobile] = useState(100);
  const [savedThemes, setSavedThemes] = useState(() => { try { return JSON.parse(localStorage.getItem("trackall_themes") || "[]"); } catch { return []; } });
  const [panelBg, setPanelBg] = useState("");
  const [panelOpacity, setPanelOpacity] = useState(100);

  const [bgImage, setBgImage] = useState("");
  const [bgImageMobile, setBgImageMobile] = useState("");
  const [bgSeparateDevices, setBgSeparateDevices] = useState(false);
  const [bgOverlay, setBgOverlay] = useState("rgba(0,0,0,0.55)");
  const [bgBlur, setBgBlur] = useState(0);
  const [bgParallax, setBgParallax] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState({ name: "", bio: "", avatar: "", hallOfFame: [] });
  const [library, setLibrary] = useState({});
  const [tmdbKey, setTmdbKey] = useState(DEFAULT_TMDB_KEY);
  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [view, setView] = useState("home");
  const [activeTab, setActiveTab] = useState("all");
  const [homeFilter, setHomeFilter] = useState([]);
  const [homeCollapsedCurso, setHomeCollapsedCurso] = useState(false);

  // ── PWA: Register service worker + inject manifest meta tags ──
  useEffect(() => {
    // Bloquear zoom no mobile
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    // Inject manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }
    // Theme color meta — segue a cor de fundo do dispositivo atual
    const isMobile = window.innerWidth < 768;
    const activeColor = (bgSeparateDevices && isMobile)
      ? (bgColorMobile || "#0d1117")  // mobile: usa cor mobile, nunca herda PC
      : bgColor;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.content = activeColor;
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = activeColor;
      document.head.appendChild(meta);
    }
    // Apple mobile web app
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m1 = document.createElement('meta');
      m1.name = 'apple-mobile-web-app-capable';
      m1.content = 'yes';
      document.head.appendChild(m1);
      const m2 = document.createElement('meta');
      m2.name = 'apple-mobile-web-app-status-bar-style';
      m2.content = 'black-translucent';
      document.head.appendChild(m2);
      const m3 = document.createElement('meta');
      m3.name = 'apple-mobile-web-app-title';
      m3.content = 'TrackAll';
      document.head.appendChild(m3);
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/icon-192.png';
      document.head.appendChild(icon);
      // Favicon SVG inline — evita o globo do browser
      if (!document.querySelector('link[rel="icon"]')) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/svg+xml';
        favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23f97316'/><text x='16' y='23' text-anchor='middle' font-size='20' font-weight='900' font-family='Arial,sans-serif' fill='white'>T</text></svg>`;
        document.head.appendChild(favicon);
      }
    }
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => console.log('[PWA] SW registered:', reg.scope))
        .catch(err => console.log('[PWA] SW failed:', err));
    }
    // Capture install prompt
    const onPrompt = (e) => { e.preventDefault(); setPwaPrompt(e); };
    const onInstalled = () => { setPwaInstalled(true); setPwaPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Check if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) setPwaInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [bgColor, bgColorMobile, bgSeparateDevices]);

  // Attach mouse-wheel → horizontal scroll on all .recents-row elements
  // + keyboard arrow keys when hovering ANY horizontal scroll container
  useEffect(() => {
    let hoveredRow = null;

    const onKeyDown = (e) => {
      if (!hoveredRow) return;
      if (hoveredRow.scrollWidth <= hoveredRow.clientWidth) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); hoveredRow.scrollLeft -= 200; }
      if (e.key === "ArrowRight") { e.preventDefault(); hoveredRow.scrollLeft += 200; }
    };
    document.addEventListener('keydown', onKeyDown);

    // Selector que cobre todos os scrolls horizontais
    const SCROLL_SEL = '.recents-row, .tabs-scroll, [style*="overflowX: auto"], [style*="overflow-x: auto"]';

    const attachEl = (el) => {
      if (el._scrollKeyOk) return;
      el._scrollKeyOk = true;
      // wheel
      if (!el._wheelOk) {
        el._wheelOk = true;
        el.addEventListener('wheel', (e) => {
          if (el.scrollWidth <= el.clientWidth) return;
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }, { passive: false });
      }
      // keyboard hover
      el.addEventListener('mouseenter', () => { hoveredRow = el; });
      el.addEventListener('mouseleave', () => { if (hoveredRow === el) hoveredRow = null; });
    };

    const attach = () => {
      document.querySelectorAll(SCROLL_SEL).forEach(attachEl);
    };

    attach();
    const obs = new MutationObserver(attach);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); document.removeEventListener('keydown', onKeyDown); };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsByType, setSearchResultsByType] = useState({});
  const searchSeqRef = useRef(0);
  const searchQueryRef = useRef("");
  const [searchHistory, setSearchHistory] = useState(() => { try { return JSON.parse(localStorage.getItem("trackall_search_history") || "[]"); } catch { return []; } });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [notif, setNotif] = useState(null);
  const [pwaPrompt, setPwaPrompt] = useState(null); // deferred install prompt
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [libSort, setLibSort] = useState("date");
  const [libSearch, setLibSearch] = useState("");
  const [libViewMode, setLibViewMode] = useState(() => { 
    try { 
      const saved = localStorage.getItem("trackall_lib_view") || "grid";
      // compact não existe no mobile
      if (saved === "compact" && typeof window !== 'undefined' && window.innerWidth < 600) return "grid";
      return saved;
    } catch { return "grid"; } 
  });
  const setLibViewModePersist = (mode) => { setLibViewMode(mode); try { localStorage.setItem("trackall_lib_view", mode); } catch {} };
  const [logOpen, setLogOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  // Refs para o back handler (lê estado actual sem deps no useEffect)
  const selectedItemRef = useRef(null);
  const logOpenRef = useRef(false);
  const showTierlistEditorRef = useRef(false);
  const viewingTierlistRef = useRef(null);
  const showCollectionEditorRef = useRef(false);
  const viewingCollectionRef = useRef(null);
  const viewRef = useRef("home");
  const [logQuery, setLogQuery] = useState("");
  const [logResults, setLogResults] = useState([]);
  const [logSearching, setLogSearching] = useState(false);
  const logInputRef = useRef(null);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchType, setQuickSearchType] = useState(null);
  const [logPendingItem, setLogPendingItem] = useState(null); // item awaiting rating after log
  const [favorites, setFavorites] = useState([]);
  const [recos, setRecos] = useState({});
  const [personalRecos, setPersonalRecos] = useState([]);
  const personalRecosLoadedRef = useRef(false);
  const recoLoadIdRef = useRef(0);
  const recosFetchedRef = useRef(false);
  const [recoLoading, setRecoLoading] = useState(false);
  const [userTierlists, setUserTierlists] = useState([]);
  const [userLikes, setUserLikes] = useState([]);
  const [viewingTierlist, setViewingTierlist] = useState(null);
  const [editingTierlist, setEditingTierlist] = useState(null);
  const [showTierlistEditor, setShowTierlistEditor] = useState(false);
  const [userCollections, setUserCollections] = useState([]);
  const [userCollectionLikes, setUserCollectionLikes] = useState([]);
  const [viewingCollection, setViewingCollection] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const [showCollectionEditor, setShowCollectionEditor] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const mainSwipeRef = useRef({ tracking: false, blocked: false, isHorizontal: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const mainSwipeAnimRef = useRef(null);
  const mainSwipeContentRef = useRef(null);
  const mainSwipePeekRef = useRef(null);
  const mainSwipePeekState = useRef({ dir: 1 });
  const MAIN_SWIPE_VIEWS = ["home", "library", "friends", "profile"];

  // ── Restaurar sessão ao arrancar ──
  useEffect(() => {
    const restore = async () => {
      try {
        const user = await supa.getSession();
        if (user) {
          setUser(user);
          await loadUserData(user.id);
        } else {
          setShowLanding(true);
        }
      } catch { setShowLanding(true); }
      setAuthLoading(false);
    };
    restore();
  }, []);

  const loadUserData = async (userId) => {
    try {
      const [prof, lib] = await Promise.all([
        supa.getProfile(userId),
        supa.getLibrary(userId),
      ]);
      if (prof) {
        const _savedHall = (() => { try { const s = localStorage.getItem("trackall_hall_of_fame"); return s ? JSON.parse(s) : null; } catch { return null; } })();
        // Tentar ler Hall of Fame da library (mais fiável que coluna profiles)
        let _hallData = (prof.hall_of_fame && prof.hall_of_fame.length) ? prof.hall_of_fame : (_savedHall || []);
        try {
          const hallRow = await supabase.from("library").select("data").eq("user_id", userId).eq("media_id", "__hall_of_fame__").single();
          if (hallRow.data?.data?.hall?.length) _hallData = hallRow.data.data.hall;
        } catch {}
        setProfile({ name: prof.name || "", bio: prof.bio || "", avatar: prof.avatar || "", banner: prof.banner || "", hideEmail: prof.hide_email || false, hideBannerMobile: prof.hide_banner_mobile || false, hallOfFame: _hallData });
        if (prof.accent) setAccent(prof.accent);
        if (prof.panel_bg !== undefined) setPanelBg(prof.panel_bg || "");
        if (prof.panel_opacity !== undefined) setPanelOpacity(prof.panel_opacity ?? 100);
        if (prof.sidebar_color !== undefined) setSidebarColor(prof.sidebar_color || "");
        if (prof.text_contrast !== undefined) setTextContrast(prof.text_contrast ?? 100);
        if (prof.text_contrast_mobile !== undefined) setTextContrastMobile(prof.text_contrast_mobile ?? 100);
        if (prof.bg_color_mobile) setBgColorMobile(prof.bg_color_mobile);

        if (prof.bg_color) {
          setBgColor(prof.bg_color);
          setDarkMode(isColorDark(prof.bg_color));
        }
        if (prof.bg_image) setBgImage(prof.bg_image);
        if (prof.bg_image_mobile) setBgImageMobile(prof.bg_image_mobile);
        if (prof.bg_separate_devices) setBgSeparateDevices(true);
        if (prof.bg_overlay !== undefined) setBgOverlay(prof.bg_overlay);
        if (prof.bg_blur !== undefined) setBgBlur(prof.bg_blur);
        if (prof.bg_parallax !== undefined) setBgParallax(prof.bg_parallax);
        if (prof.tmdb_key) setTmdbKey(prof.tmdb_key);
        else setTmdbKey(DEFAULT_TMDB_KEY);
        if (prof.worker_url) setWorkerUrl(prof.worker_url);
        else setWorkerUrl(DEFAULT_WORKER_URL);
        if (prof.favorites) setFavorites(prof.favorites);
      }
      if (lib) {
        setLibrary(lib);
        // Tentar cache do sessionStorage primeiro
        if (!personalRecosLoadedRef.current) {
          try {
            const cached = sessionStorage.getItem("trackall_personal_recos");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.length) { setPersonalRecos(parsed); personalRecosLoadedRef.current = true; }
            }
          } catch {}
        }
        // Carregar recos personalizadas logo após ter a library — só uma vez
        if (!personalRecosLoadedRef.current && Object.keys(lib).length > 0) {
          personalRecosLoadedRef.current = true;
          const workerU = prof?.worker_url || DEFAULT_WORKER_URL;
          fetchPersonalizedRecos(lib, workerU).then(personal => {
            if (personal?.length) {
              setPersonalRecos(personal);
              try { sessionStorage.setItem("trackall_personal_recos", JSON.stringify(personal)); } catch {}
            }
          });
        }
      }
    } catch (err) {
      console.error('[TrackAll] Erro ao carregar dados do utilizador:', err);
    }
  };

  // Carrega recos UMA VEZ — ref garante que não repete mesmo com re-renders
  const recosInitRef = useRef(false);
  useEffect(() => {
    if (user?.id && !recosInitRef.current) {
      recosInitRef.current = true;
      loadRecos();
    }
  });  // sem dependências — corre a cada render mas a ref para depois da 1ª vez

  // Carrega tierlists/collections uma vez
  const profileInitRef = useRef(false);
  useEffect(() => {
    if (user?.id && !profileInitRef.current) {
      profileInitRef.current = true;
      loadUserTierlists();
      loadUserCollections();
    }
  });  // sem dependências — idem

  useEffect(() => () => {
    if (mainSwipeAnimRef.current) clearTimeout(mainSwipeAnimRef.current);
  }, []);

  const loadRecos = async (manual = false) => {
    if (!manual && recosFetchedRef.current) return; // já carregou, não repetir
    recosFetchedRef.current = true;
    const loadId = ++recoLoadIdRef.current;
    setRecoLoading(true);
    if (!manual) {
      // Tentar restaurar de sessionStorage antes de fazer fetch
      try {
        const cached = sessionStorage.getItem("trackall_trending_recos");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Object.keys(parsed).length > 0) {
            setRecos(parsed);
            setRecoLoading(false);
            return;
          }
        }
      } catch {}
    }
    setRecos({});
    const applyRecoChunk = (key, items) => {
      if (recoLoadIdRef.current !== loadId) return;
      if (items?.length) setRecos(r => ({ ...r, [key]: items }));
    };
    if (manual) {
      setPersonalRecos([]);
      personalRecosLoadedRef.current = false;
      recosFetchedRef.current = false;
      try { sessionStorage.removeItem("trackall_personal_recos"); } catch {}
      try { sessionStorage.removeItem("trackall_trending_recos"); } catch {}
      // Re-fetch personalRecos with current library
      if (Object.keys(library).length > 0) {
        personalRecosLoadedRef.current = true;
        fetchPersonalizedRecos(library, workerUrl).then(personal => {
          if (recoLoadIdRef.current !== loadId) return;
          if (personal?.length) {
            setPersonalRecos(personal);
            try { sessionStorage.setItem("trackall_personal_recos", JSON.stringify(personal)); } catch {}
          }
        }).catch(() => {});
      }
    }
    try {
      // Carregar progressivamente — cada categoria aparece quando fica pronta
      await Promise.allSettled([
        fetchTrendingAnime(workerUrl).then(items => applyRecoChunk("anime", items)),
        fetchTrendingManga(workerUrl).then(items => applyRecoChunk("manga", items)),
        fetchTrendingMovies(tmdbKey, workerUrl).then(items => applyRecoChunk("filmes", items)),
        fetchTrendingSeries(tmdbKey, workerUrl).then(items => applyRecoChunk("series", items)),
        fetchTrendingGames(workerUrl).then(items => applyRecoChunk("jogos", items)),
      ]);
    } catch {}
    if (recoLoadIdRef.current === loadId) {
      setRecoLoading(false);
      // Guardar trending em cache para restaurar sem reload
      if (!manual) {
        setRecos(current => {
          try { sessionStorage.setItem("trackall_trending_recos", JSON.stringify(current)); } catch {}
          return current;
        });
      }
    }
  };

  const handleSaveTierlist = async (title, tiers) => {
    if (!user) return;
    if (editingTierlist?.id) {
      await supa.updateTierlist(editingTierlist.id, title, tiers);
      setUserTierlists(prev => prev.map(tl => tl.id === editingTierlist.id ? { ...tl, title, tiers } : tl));
    } else {
      const newTl = await supa.createTierlist(user.id, title, tiers);
      if (newTl) setUserTierlists(prev => [newTl, ...prev]);
    }
    setShowTierlistEditor(false);
    setEditingTierlist(null);
  };

  const loadUserTierlists = async () => {
    if (!user) return;
    const [tls, likes] = await Promise.all([
      supa.getUserTierlists(user.id),
      supa.getUserLikes(user.id),
    ]);
    setUserTierlists(tls);
    setUserLikes(likes);
  };

  const loadUserCollections = async () => {
    if (!user) return;
    const [cols, colLikes] = await Promise.all([
      supa.getUserCollections(user.id),
      supa.getUserCollectionLikes(user.id),
    ]);
    setUserCollections(cols);
    setUserCollectionLikes(colLikes);
  };

  const likingTierlistRef = useRef(new Set());
  const handleTierlistLike = async (tierlistId) => {
    if (!user) return;
    if (likingTierlistRef.current.has(tierlistId)) return; // já em curso, ignora clique repetido
    likingTierlistRef.current.add(tierlistId);
    try {
      const isLiked = await supa.toggleTierlistLike(user.id, tierlistId);
      setUserLikes(prev => isLiked ? [...prev, tierlistId] : prev.filter(id => id !== tierlistId));
      setUserTierlists(prev => prev.map(tl => tl.id === tierlistId ? { ...tl, likes_count: Math.max(0, (tl.likes_count || 0) + (isLiked ? 1 : -1)) } : tl));
      if (viewingTierlist?.id === tierlistId) {
        setViewingTierlist(prev => ({ ...prev, likes_count: Math.max(0, (prev.likes_count || 0) + (isLiked ? 1 : -1)) }));
      }
    } finally {
      likingTierlistRef.current.delete(tierlistId);
    }
  };

  const handleDeleteTierlist = async (id) => {
    await supa.deleteTierlist(id);
    setUserTierlists(prev => prev.filter(tl => tl.id !== id));
  };

  const handleSaveCollection = async (colData) => {
    if (!user) return;
    if (editingCollection) {
      await supa.updateCollection(editingCollection.id, colData);
      setUserCollections(prev => prev.map(c => c.id === editingCollection.id ? { ...c, ...colData } : c));
      if (viewingCollection?.id === editingCollection.id) setViewingCollection(prev => ({ ...prev, ...colData }));
    } else {
      const created = await supa.createCollection(user.id, colData);
      setUserCollections(prev => [created, ...prev]);
    }
    setShowCollectionEditor(false);
    setEditingCollection(null);
  };

  const handleCollectionLike = async (collectionId) => {
    if (!user) return;
    const isLiked = await supa.toggleCollectionLike(user.id, collectionId);
    setUserCollectionLikes(prev => isLiked ? [...prev, collectionId] : prev.filter(id => id !== collectionId));
    setUserCollections(prev => prev.map(c => c.id === collectionId ? { ...c, likes_count: (c.likes_count || 0) + (isLiked ? 1 : -1) } : c));
    if (viewingCollection?.id === collectionId) setViewingCollection(prev => ({ ...prev, likes_count: (prev.likes_count || 0) + (isLiked ? 1 : -1) }));
  };

  const handleDeleteCollection = async (id) => {
    await supa.deleteCollection(id);
    setUserCollections(prev => prev.filter(c => c.id !== id));
    if (viewingCollection?.id === id) setViewingCollection(null);
  };

  const handleAuth = async (u) => {
    setUser(u);
    await loadUserData(u.id);
  };

  const handleSignOut = async () => {
    await supa.signOut();
    setUser(null);
    setLibrary({});
    setProfile({ name: "", bio: "", avatar: "", hallOfFame: [] });
    setView("home");
  };

  const showNotif = (msg, color) => { setNotif({ msg, color }); setTimeout(() => setNotif(null), Math.max(2000, Math.min(msg.length * 60, 4500))); };

  const saveLibrary = async (lib) => {
    setLibrary(lib);
    // Guarda no Supabase em background
    if (user) {
      try {
        const prev = library;
        // Items novos ou atualizados
        for (const [id, item] of Object.entries(lib)) {
          if (JSON.stringify(prev[id]) !== JSON.stringify(item)) {
            await supa.upsertLibraryItem(user.id, id, item);
          }
        }
        // Items removidos
        for (const id of Object.keys(prev)) {
          if (!lib[id]) await supa.deleteLibraryItem(user.id, id);
        }
      } catch (err) {
        console.error('[TrackAll] Erro ao guardar biblioteca:', err);
      }
    }
  };

  const getLibraryMatch = (id, type = "") => findLibraryEntry(library, id, type);

  const saveProfile = async (p) => {
    setProfile(p);
    if (user) {
      try {
        await supa.upsertProfile(user.id, {
          name: p.name || "",
          bio: p.bio || "",
          avatar: p.avatar || "",
          banner: p.banner || "",
          hide_email: p.hideEmail || false,
          hide_banner_mobile: p.hideBannerMobile || false,
        });
      } catch (err) {
        console.error('[TrackAll] Erro ao guardar perfil:', err);
        showNotif(lang === "en" ? "Error saving profile. Check your connection." : "Erro ao guardar perfil. Verifica a ligação.", "#ef4444");
      }
    }
  };

  const toggleHallOfFame = async (item) => {
    const normalizedItem = normalizeMediaItem(item);
    const currentHall = Array.isArray(profile?.hallOfFame) ? profile.hallOfFame : [];
    const hallIds = new Set(mediaIdCandidates(normalizedItem.id, normalizedItem.type));
    const exists = currentHall.some(entry => hallIds.has(entry.id));
    let nextHall;
    if (exists) {
      nextHall = currentHall.filter(entry => !hallIds.has(entry.id));
      showNotif(lang === "en" ? "Removed from Hall of Fame" : "Removido do Hall of Fame", "#8b949e");
    } else {
      if (currentHall.length >= 9) {
        showNotif(lang === "en" ? "Hall of Fame max: 5 titles" : "Hall of Fame máximo: 5 obras", "#ef4444");
        return;
      }
      const libItem = getLibraryMatch(normalizedItem.id, normalizedItem.type)?.item;
      nextHall = [...currentHall, { id: normalizedItem.id, title: normalizedItem.title, cover: normalizedItem.cover, customCover: libItem?.customCover || normalizedItem.customCover || "", type: normalizedItem.type }];
      showNotif(lang === "en" ? "Added to Hall of Fame" : "Adicionado ao Hall of Fame", "#fbbf24");
      if (navigator.vibrate) navigator.vibrate(40);
    }
    setProfile(prev => ({ ...prev, hallOfFame: nextHall }));
    try { localStorage.setItem("trackall_hall_of_fame", JSON.stringify(nextHall)); } catch {}
    if (user) try {
      // Guardar na library como item especial — coluna hall_of_fame pode não existir em profiles
      await supa.upsertLibraryItem(user.id, "__hall_of_fame__", { hall: nextHall });
    } catch {}
  };

  const saveAccent = async (c) => {
    setAccent(c);
    if (user) try { await supa.upsertProfile(user.id, { accent: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar accent:", err); }
  };
  const savePanelBg = async (c) => {
    setPanelBg(c);
    if (user) try { await supa.upsertProfile(user.id, { panel_bg: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar panel_bg:", err); }
  };
  const savePanelOpacity = async (v) => {
    setPanelOpacity(v);
    if (user) try { await supa.upsertProfile(user.id, { panel_opacity: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar panel_opacity:", err); }
  };
  const saveSidebarColor = async (c) => {
    setSidebarColor(c);
    if (user) try { await supa.upsertProfile(user.id, { sidebar_color: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar sidebar_color:", err); }
  };
  const saveSavedThemes = (themes) => {
    setSavedThemes(themes);
    try { localStorage.setItem("trackall_themes", JSON.stringify(themes)); } catch {}
  };
  const saveTextContrast = async (v) => {
    setTextContrast(v);
    if (user) try { await supa.upsertProfile(user.id, { text_contrast: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar text_contrast:", err); }
  };
  const saveTextContrastMobile = async (v) => {
    setTextContrastMobile(v);
    if (user) try { await supa.upsertProfile(user.id, { text_contrast_mobile: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar text_contrast_mobile:", err); }
  };
  const saveBgColorMobile = async (c) => {
    setBgColorMobile(c);
    if (user) try { await supa.upsertProfile(user.id, { bg_color_mobile: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_color_mobile:", err); }
  };
  const saveBg = async (c) => {
    setBgColor(c);
    setDarkMode(isColorDark(c));
    if (user) try { await supa.upsertProfile(user.id, { bg_color: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_color:", err); }
  };
  const saveBgOverlay = async (o) => {
    setBgOverlay(o);
    if (user) try { await supa.upsertProfile(user.id, { bg_overlay: o }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_overlay:", err); }
  };
  const saveBgBlur = async (v) => {
    setBgBlur(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_blur: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_blur:", err); }
  };
  const saveBgParallax = async (v) => {
    setBgParallax(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_parallax: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_parallax:", err); }
  };
  // isMobile check — calculado uma vez, estável entre renders
  const [isMobileDevice] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Sincronizar refs com estados para o back handler
  useEffect(() => { selectedItemRef.current = selectedItem; }, [selectedItem]);
  useEffect(() => { logOpenRef.current = logOpen; }, [logOpen]);
  useEffect(() => { showTierlistEditorRef.current = showTierlistEditor; }, [showTierlistEditor]);
  useEffect(() => { viewingTierlistRef.current = viewingTierlist; }, [viewingTierlist]);
  useEffect(() => { showCollectionEditorRef.current = showCollectionEditor; }, [showCollectionEditor]);
  useEffect(() => { viewingCollectionRef.current = viewingCollection; }, [viewingCollection]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // ── Android Back Button ──
  useEffect(() => {
    if (!isMobileDevice) return;
    // Empurrar estado inicial para o history
    window.history.pushState({ trackall: true }, "");
    const onPop = () => {
      // Fechar o primeiro estado aberto encontrado
      if (selectedItemRef.current) { setSelectedItem(null); window.history.pushState({ trackall: true }, ""); return; }
      if (logOpenRef.current) { setLogOpen(false); window.history.pushState({ trackall: true }, ""); return; }
      if (showTierlistEditorRef.current) { setShowTierlistEditor(false); window.history.pushState({ trackall: true }, ""); return; }
      if (viewingTierlistRef.current) { setViewingTierlist(null); window.history.pushState({ trackall: true }, ""); return; }
      if (showCollectionEditorRef.current) { setShowCollectionEditor(false); window.history.pushState({ trackall: true }, ""); return; }
      if (viewingCollectionRef.current) { setViewingCollection(null); window.history.pushState({ trackall: true }, ""); return; }
      if (viewRef.current !== "home") { setView("home"); window.history.pushState({ trackall: true }, ""); return; }
      // Nada aberto + home → sair (deixar o browser fazer pop normal)
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isMobileDevice]);

  const canUseMainSwipe = isMobileDevice
    && MAIN_SWIPE_VIEWS.includes(view)
    && !selectedItem
    && !viewingTierlist
    && !showTierlistEditor
    && !showCollectionEditor
    && !logOpen
    && !logPendingItem;

  const hasHorizontalScrollableParent = (target, dx = 0) => {
    let el = target instanceof HTMLElement ? target : null;
    while (el && el !== document.body) {
      const ox = window.getComputedStyle(el)?.overflowX || "";
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 8) {
        if (dx === 0) return true;
        if (dx > 0 && el.scrollLeft > 2) return true;
        if (dx < 0 && el.scrollLeft < el.scrollWidth - el.clientWidth - 2) return true;
      }
      el = el.parentElement;
    }
    return false;
  };
  const isMainSwipeBlockedTarget = (target, dx = 0) => {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest('input,textarea,select,[contenteditable="true"],.modal,.bottom-nav,.top-nav-bar')) return true;
    if (target.closest(".recents-row,.tabs-scroll")) return true;
    if (hasHorizontalScrollableParent(target, dx)) return true;
    return false;
  };
  const resetMainSwipe = () => { mainSwipeRef.current = { tracking: false, blocked: false, isHorizontal: false, startX: 0, startY: 0, lastX: 0, lastY: 0, startTarget: null, peekShown: false }; };
  const hidePeek = () => {
    const el = mainSwipePeekRef.current; if (!el) return;
    el.style.opacity = "0";
    el.style.display = "none";
  };
  const showPeek = (targetView, dir) => {
    const el = mainSwipePeekRef.current; if (!el) return;
    const tabInfo = { home: ["⌂","Home"], library: ["▦","Library"], friends: ["⊙","Friends"], profile: ["◉","Perfil"] };
    const [icon, label] = tabInfo[targetView] || ["",""];
    const icon_el = el.querySelector("[data-peek-icon]");
    const label_el = el.querySelector("[data-peek-label]");
    if (icon_el) icon_el.textContent = icon;
    if (label_el) { label_el.textContent = label; label_el.style.color = accent; }
    // bg e text color baseados no tema actual
    el.style.background = activeDarkMode ? "#0d1117" : "#f5f0e8";
    el.style.opacity = "0";
    el.style.transform = `translateX(${dir * -100}%)`;
    el.style.transition = "none";
    el.style.display = "block";
    // Slide in suave
    requestAnimationFrame(() => {
      el.style.transition = "opacity 180ms ease, transform 180ms ease";
      el.style.opacity = "0.92";
      el.style.transform = `translateX(${dir * -18}%)`;
    });
  };
  const applyMainSwipeStyle = (offset = 0, transition = "none") => {
    const W = window.innerWidth || 360;
    const cur = mainSwipeContentRef.current; const peek = mainSwipePeekRef.current;
    const dir = mainSwipePeekState.current.dir;
    if (cur) { cur.style.transition = transition; cur.style.transform = `translate3d(${offset}px,0,0)`; cur.style.willChange = offset !== 0 ? "transform" : "auto"; }
    // peek é overlay fixo — não segue o offset do conteúdo
  };
  const animateMainSwipeToView = (nextView, direction) => {
    const W = window.innerWidth || 360;
    if (mainSwipeAnimRef.current) clearTimeout(mainSwipeAnimRef.current);
    applyMainSwipeStyle(direction * -W, "transform 260ms cubic-bezier(0.25,0.46,0.45,0.94)");
    mainSwipeAnimRef.current = setTimeout(() => {
      // flushSync força o React a re-renderizar a nova view de forma síncrona
      // ANTES de escondermos o peek — assim nunca há flash de conteúdo vazio
      flushSync(() => { setView(nextView); });
      hidePeek();
      const cur = mainSwipeContentRef.current;
      if (cur) { cur.style.transition = "none"; cur.style.transform = "translate3d(0,0,0)"; cur.style.willChange = "auto"; }
      mainSwipeAnimRef.current = null;
    }, 260);
  };
  const handleMainSwipeStart = (e) => {
    if (!canUseMainSwipe) return;
    const touch = e.touches?.[0]; if (!touch) return;
    if (mainSwipeAnimRef.current) { clearTimeout(mainSwipeAnimRef.current); mainSwipeAnimRef.current = null; }
    hidePeek();
    const cur = mainSwipeContentRef.current; if (cur) { cur.style.transition = "none"; cur.style.transform = "translate3d(0,0,0)"; }
    mainSwipeRef.current = { tracking: true, blocked: !!(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"],.modal,.bottom-nav,.top-nav-bar')), startTarget: e.target, isHorizontal: false, peekShown: false, startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY };
  };
  const handleMainSwipeMove = (e) => {
    const state = mainSwipeRef.current;
    if (!state.tracking || state.blocked) return;
    const touch = e.touches?.[0]; if (!touch) return;
    state.lastX = touch.clientX; state.lastY = touch.clientY;
    const dx = touch.clientX - state.startX, dy = touch.clientY - state.startY;
    if (!state.isHorizontal && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 0.9) {
      if (isMainSwipeBlockedTarget(state.startTarget, dx)) { state.blocked = true; return; }
      state.isHorizontal = true;
    }
    if (state.isHorizontal) {
      const ci = MAIN_SWIPE_VIEWS.indexOf(view), atFirst = ci <= 0, atLast = ci >= MAIN_SWIPE_VIEWS.length - 1;
      if (!state.peekShown) { state.peekShown = true; if (dx < 0 && !atLast) showPeek(MAIN_SWIPE_VIEWS[ci + 1], 1); else if (dx > 0 && !atFirst) showPeek(MAIN_SWIPE_VIEWS[ci - 1], -1); }
      let off = dx * 0.98; if ((atFirst && dx > 0) || (atLast && dx < 0)) off = dx * 0.18;
      applyMainSwipeStyle(off, "none"); if (e.cancelable) e.preventDefault(); return;
    }
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { state.blocked = true; applyMainSwipeStyle(0, "transform 200ms ease"); }
  };
  const handleMainSwipeEnd = () => {
    const state = mainSwipeRef.current; resetMainSwipe();
    if (!canUseMainSwipe || !state.tracking || state.blocked || !state.isHorizontal) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    const dx = state.lastX - state.startX, dy = state.lastY - state.startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.1) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    const ci = MAIN_SWIPE_VIEWS.indexOf(view);
    if (ci === -1) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    if (dx < 0 && ci < MAIN_SWIPE_VIEWS.length - 1) animateMainSwipeToView(MAIN_SWIPE_VIEWS[ci + 1], 1);
    else if (dx > 0 && ci > 0) animateMainSwipeToView(MAIN_SWIPE_VIEWS[ci - 1], -1);
    else { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); }
  };
  const handleMainSwipeCancel = () => { resetMainSwipe(); hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); };
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  /* const mainSwipeTabs = [
    { id: "home", icon: "⌂", label: useT("home") },
    { id: "library", icon: "▤", label: useT("library") },
    { id: "friends", icon: "◔", label: useT("friends") },
    { id: "profile", icon: "◉", label: lang === "en" ? "Profile" : "Perfil" },
  ]; */
  const saveBgImage = async (img) => {
    if (bgSeparateDevices) {
      if (isMobileDevice) {
        setBgImageMobile(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image_mobile:", err); }
      } else {
        setBgImage(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image:", err); }
      }
    } else {
      setBgImage(img);
      setBgImageMobile(img);
      if (user) try { await supa.upsertProfile(user.id, { bg_image: img, bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image:", err); }
    }
  };
  const saveMobileBgImage = async (img) => {
    setBgImageMobile(img);
    if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image_mobile:", err); }
  };
  const saveBgSeparateDevices = async (val) => {
    setBgSeparateDevices(val);
    if (user) try { await supa.upsertProfile(user.id, { bg_separate_devices: val }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_separate_devices:", err); }
  };
  const saveTmdbKey = async (k) => {
    setTmdbKey(k);
    if (user) try { await supa.upsertProfile(user.id, { tmdb_key: k }); } catch (err) { console.error("[TrackAll] Erro ao guardar tmdb_key:", err); }
  };
  const saveWorkerUrl = async (k) => {
    setWorkerUrl(k);
    if (user) try { await supa.upsertProfile(user.id, { worker_url: k }); } catch (err) { console.error("[TrackAll] Erro ao guardar worker_url:", err); }
  };

  const addToLibrary = useCallback((item, status, rating = 0) => {
    const normalizedItem = normalizeMediaItem(item);
    const existing = findLibraryEntry(library, normalizedItem.id, normalizedItem.type);
    const canonicalId = normalizeMediaId(normalizedItem.id, normalizedItem.type);
    const lib = { ...library };
    if (existing?.key && existing.key !== canonicalId) delete lib[existing.key];
    lib[canonicalId] = {
      ...(existing?.item || {}),
      ...normalizedItem,
      id: canonicalId,
      userStatus: status,
      userRating: rating,
      addedAt: Date.now(),
    };
    saveLibrary(lib);
    showNotif(`"${(normalizedItem.title || "Item").slice(0, 30)}" adicionado!`, "#10b981");
    if (navigator.vibrate) navigator.vibrate(50);
  }, [library]);


  const importPaperback = async (pbItems) => {
    const lib = { ...library };
    let added = 0, updated = 0;
    const needsCover = []; // itens novos que precisam de capa
    const existingByTitle = {};
    Object.values(lib).forEach(e => { const n = (e.title||'').toLowerCase().trim(); if (n) existingByTitle[n] = e.id; });
    pbItems.forEach(item => {
      const norm = (item.title || "").toLowerCase().trim();
      const existingId = existingByTitle[norm];
      if (lib[item.id]) {
        lib[item.id] = { ...lib[item.id], userStatus: item.userStatus, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else if (existingId) {
        lib[existingId] = { ...lib[existingId], userStatus: item.userStatus, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else {
        lib[item.id] = { ...item, userRating: 0 };
        added++;
        // Marcar para enriquecimento de capa se não tiver cover fiável
        needsCover.push({ id: item.id, title: item.title, type: item.type });
      }
    });
    saveLibrary(lib);
    showNotif(`Paperback: ${added} adicionados, ${updated} atualizados ✓ — A buscar capas...`, "#10b981");

    // ── Enriquecimento de capas em background ──
    // Processa em lotes de 3 para não sobrecarregar as APIs
    const enrichCover = async (id, title, type) => {
      try {
        let cover = '';
        if (type === 'comics') {
          const results = await searchComicVine(title, workerUrl);
          if (results?.length) {
            // Tentar match exato primeiro, senão usar o primeiro resultado
            const exact = results.find(r => r.title.toLowerCase() === title.toLowerCase());
            cover = (exact || results[0]).cover;
          }
        } else {
          // manga / manhwa — usar AniList
          const results = await searchAniList(title, 'MANGA');
          if (results?.length) {
            const exact = results.find(r => r.title.toLowerCase() === title.toLowerCase());
            cover = (exact || results[0]).cover;
          }
        }
        if (cover) {
          // Usar setLibrary com callback para não perder atualizações concorrentes
          setLibrary(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev, [id]: { ...prev[id], cover } };
            // Persistir no Supabase em background
            if (user) supa.upsertLibraryItem(user.id, id, next[id]).catch(() => {});
            return next;
          });
        }
      } catch { /* silent */ }
    };

    // Processar em lotes
    for (let i = 0; i < needsCover.length; i += 3) {
      const batch = needsCover.slice(i, i + 3);
      await Promise.all(batch.map(({ id, title, type }) => enrichCover(id, title, type)));
      if (i + 3 < needsCover.length) await new Promise(r => setTimeout(r, 400)); // throttle
    }

    if (needsCover.length > 0) showNotif(`Capas atualizadas ✓`, "#10b981");
  };

  const importLetterboxd = async (lbItems) => {
    const lib = { ...library };
    let added = 0, updated = 0;
    const existingByTitle = {};
    Object.values(lib).forEach(e => { const n = (e.title||'').toLowerCase().trim(); if (n) existingByTitle[n] = e.id; });
    lbItems.forEach(item => {
      const norm = (item.title || "").toLowerCase().trim();
      const existingId = existingByTitle[norm];
      if (lib[item.id]) {
        lib[item.id] = { ...lib[item.id], userStatus: 'completo', userRating: item.userRating || lib[item.id].userRating };
        updated++;
      } else if (existingId) {
        lib[existingId] = { ...lib[existingId], userStatus: 'completo', userRating: item.userRating || lib[existingId].userRating };
        updated++;
      } else {
        lib[item.id] = { ...item };
        added++;
      }
    });
    saveLibrary(lib);
    showNotif(`Letterboxd: ${added} filmes adicionados, ${updated} atualizados ✓`, "#00e054");
  };

  const importMihon = async (items) => {
    const lib = { ...library };
    let added = 0, updated = 0, skipped = 0;

    // Build title lookup for existing library items (normalize to lowercase)
    const existingByTitle = {};
    Object.values(lib).forEach(entry => {
      const norm = (entry.title || '').toLowerCase().trim();
      if (norm) existingByTitle[norm] = entry.id;
    });

    const coversMissing = [];

    items.forEach(item => {
      const norm = item.title.toLowerCase().trim();
      const existingId = existingByTitle[norm];

      if (lib[item.id]) {
        // Exact ID match — update progress only
        lib[item.id] = { ...lib[item.id], userStatus: item.userStatus, lastChapter: item.lastChapter, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else if (existingId) {
        // Title match — update progress on existing entry, don't create duplicate
        lib[existingId] = { ...lib[existingId], userStatus: item.userStatus, lastChapter: item.lastChapter, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else {
        // New entry
        lib[item.id] = { ...item, userRating: 0, addedAt: Date.now() };
        added++;
        if (!item.thumbnailUrl || item.thumbnailUrl.includes('mangadex.org/covers')) {
          coversMissing.push(item);
        }
      }
    });

    saveLibrary(lib);
    showNotif(`Mihon: ${added} adicionados, ${updated} atualizados${skipped ? `, ${skipped} ignorados` : ''} ✓`, "#10b981");

    // Fetch missing covers from AniList
    if (!coversMissing.length) return;
    showNotif(`A buscar capas para ${coversMissing.length} mangas...`, accent);

    const chunkSize = 10;
    const updatedLib = { ...lib };
    for (let i = 0; i < coversMissing.length; i += chunkSize) {
      const chunk = coversMissing.slice(i, i + chunkSize);
      const queryParts = chunk.map((item, idx) => `
        m${idx}: Media(search: ${JSON.stringify(item.title)}, type: MANGA, sort: SEARCH_MATCH) {
          id coverImage { large medium } title { romaji english }
        }`).join('\n');
      try {
        const wUrlMihon = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrlMihon}/anilist`], JSON.stringify({ query: `query { ${queryParts} }` }));
        if (data?.data) {
          chunk.forEach((item, idx) => {
            const result = data.data[`m${idx}`];
            if (result?.coverImage) {
              const cover = result.coverImage.large || result.coverImage.medium;
              if (cover && updatedLib[item.id]) {
                updatedLib[item.id] = { ...updatedLib[item.id], cover, thumbnailUrl: cover };
              }
            }
          });
        }
      } catch {}
      if (i + chunkSize < coversMissing.length) await new Promise(r => setTimeout(r, 500));
    }
    saveLibrary(updatedLib);
    showNotif(`Capas atualizadas ✓`, "#10b981");
  };
  const removeFromLibrary = (id) => {
   const matched = findLibraryEntry(library, id);
   if (!matched) return;
   const lib = { ...library };
   delete lib[matched.key];
   saveLibrary(lib);
   showNotif("Removido da biblioteca", "#ef4444");

  };
  const updateDuration = useCallback((id, type, dur) => {
    if (!dur.episodes && !dur.chapters && !dur.runtime) return;
    const matched = findLibraryEntry(library, id, type);
    if (!matched) return;
    // Só actualiza se faltar algum campo
    if (matched.item.episodes || matched.item.chapters || matched.item.runtime) return;
    const canonicalId = normalizeMediaId(id, type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, episodes: dur.episodes || matched.item.episodes, chapters: dur.chapters || matched.item.chapters, runtime: dur.runtime || matched.item.runtime };
    saveLibrary(next);
  }, [library]);

  const updateNote = useCallback((id, note) => {
    const matched = findLibraryEntry(library, id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, userNote: note };
    saveLibrary(next);
  }, [library]);

  const updateStatus = useCallback((id, status) => {
    const matched = findLibraryEntry(library, id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const update = { ...matched.item, id: canonicalId, userStatus: status };
    // Atualizar addedAt quando muda para completo — para o diário mostrar a data correta
    if (status === "completo") {
      update.addedAt = Date.now();
      if (!update.completedAt) update.completedAt = Date.now();
    }
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = update;
    saveLibrary(next);
    showNotif(useT("statusUpdated"), accent);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [library, accent]);

  const updateLastChapter = useCallback((id, chapter) => {
    const matched = findLibraryEntry(library, id);
    if (!matched || !chapter) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, lastChapter: chapter };
    saveLibrary(next);
    showNotif(`Capítulo: ${chapter} ✓`, accent);
  }, [library, accent]);
  const updateRating = (id, rating) => {
   const matched = findLibraryEntry(library, id);
   if (!matched) return;
   const canonicalId = normalizeMediaId(id, matched.item?.type);
   const next = { ...library };
   if (matched.key !== canonicalId) delete next[matched.key];
   next[canonicalId] = { ...matched.item, id: canonicalId, userRating: rating };
   saveLibrary(next);
   showNotif(rating > 0 ? `${rating} ★` : useT("ratingRemoved"), "#f59e0b");

  };
  const updateCover = async (id, url) => {
   const matched = findLibraryEntry(library, id);
   if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, customCover: url };
    saveLibrary(next);
    // Sincronizar cover nos favoritos se este item estiver lá
    const inFavs = favorites.some(f => f.id === id || f.id === matched.key || f.id === canonicalId);
    if (inFavs) {
      const newFavs = favorites.map(f => (f.id === id || f.id === matched.key || f.id === canonicalId) ? { ...f, id: canonicalId, customCover: url } : f);
      setFavorites(newFavs);
      if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
    }
    const currentHall = Array.isArray(profile?.hallOfFame) ? profile.hallOfFame : [];
    const inHall = currentHall.some(f => f.id === id || f.id === matched.key || f.id === canonicalId);
    if (inHall) {
      const newHall = currentHall.map(f => (f.id === id || f.id === matched.key || f.id === canonicalId) ? { ...f, id: canonicalId, customCover: url } : f);
      setProfile(prev => ({ ...prev, hallOfFame: newHall }));
      if (user) try { await supa.upsertProfile(user.id, { hall_of_fame: newHall }); } catch {}
    }
    showNotif(useT("coverUpdated"), accent);
  };

  const toggleFavorite = async (item) => {
    const normalizedItem = normalizeMediaItem(item);
    const favoriteIds = new Set(mediaIdCandidates(normalizedItem.id, normalizedItem.type));
    const exists = favorites.some(f => favoriteIds.has(f.id));
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => !favoriteIds.has(f.id));
      showNotif("Removido dos favoritos", "#8b949e");
    } else {
      if (favorites.length >= 30) { showNotif("Máximo de 30 favoritos!", "#ef4444"); return; }
      const libItem = getLibraryMatch(normalizedItem.id, normalizedItem.type)?.item;
      newFavs = [...favorites, { id: normalizedItem.id, title: normalizedItem.title, cover: normalizedItem.cover, customCover: libItem?.customCover || normalizedItem.customCover || "", type: normalizedItem.type }];
      showNotif(useT("addedToFavorites"), "#f59e0b");
      if (navigator.vibrate) navigator.vibrate(50);
    }
    setFavorites(newFavs);
    if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
  };

  const doSearch = useCallback(async (q, type) => {
    if (!q.trim()) return;
    const mySeq = ++searchSeqRef.current;
    const qNorm = q.trim().toLowerCase();
    const isNewQuery = qNorm !== searchQueryRef.current;
    searchQueryRef.current = qNorm;
    setIsSearching(true); setSearchError(""); setView("search");
    if (isNewQuery) setSearchResultsByType({});
    try {
      if (type === "all") {
        const [anime, manga, manhwa, lightnovels, livros, filmes, series, jogos, comics] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manhwa", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "lightnovels", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "livros", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "jogos", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "comics", { tmdb: tmdbKey, workerUrl }),
        ]);
        const byType = {
          anime: anime.status === "fulfilled" ? anime.value || [] : [],
          manga: manga.status === "fulfilled" ? manga.value || [] : [],
          manhwa: manhwa.status === "fulfilled" ? manhwa.value || [] : [],
          lightnovels: lightnovels.status === "fulfilled" ? lightnovels.value || [] : [],
          livros: livros.status === "fulfilled" ? livros.value || [] : [],
          filmes: filmes.status === "fulfilled" ? filmes.value || [] : [],
          series: series.status === "fulfilled" ? series.value || [] : [],
          jogos: jogos.status === "fulfilled" ? jogos.value || [] : [],
          comics: comics.status === "fulfilled" ? comics.value || [] : [],
        };
        // Ignorar se entretanto já foi disparada outra pesquisa mais recente
        if (searchSeqRef.current !== mySeq) return;
        setSearchResultsByType(byType);
      } else {
        // Limpar cache para garantir resultados frescos ao trocar de tipo
        const ck = cacheKey(q, type);
        CACHE.delete(ck);
        const typeResults = (await smartSearch(q, type, { tmdb: tmdbKey, workerUrl })) || [];
        // Ignorar se entretanto já foi disparada outra pesquisa mais recente
        // (ex: trocaste de separador antes desta responder) — nunca apagar
        // os resultados já obtidos para os outros tipos.
        if (searchSeqRef.current !== mySeq) return;
        setSearchResultsByType(prev => ({ ...prev, [type]: typeResults }));
      }
      // Guardar no histórico
      if (q.trim()) {
        setSearchHistory(prev => {
          const next = [q.trim(), ...prev.filter(h => h.toLowerCase() !== q.trim().toLowerCase())].slice(0, 8);
          try { localStorage.setItem("trackall_search_history", JSON.stringify(next)); } catch {}
          return next;
        });
      }
    } catch (e) {
      if (searchSeqRef.current === mySeq) setSearchError("Erro ao pesquisar. Verifica a tua ligação à internet.");
    } finally {
      if (searchSeqRef.current === mySeq) setIsSearching(false);
    }
  }, [tmdbKey, workerUrl]);

  // Log quick-add search — respects quickSearchType filter
  const doLogSearch = useCallback(async (q) => {
    if (!q.trim()) { setLogResults([]); return; }
    setLogSearching(true);
    try {
      let results = [];
      if (quickSearchType) {
        results = await smartSearch(q, quickSearchType, { tmdb: tmdbKey, workerUrl });
      } else {
        const [anime, manga, filmes, series] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }),
        ]);
        const all = [...(anime.value||[]), ...(manga.value||[]), ...(filmes.value||[]), ...(series.value||[])];
        const seen = new Set();
        results = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      }
      setLogResults(results.slice(0, 8));
    } catch (err) {
      console.error('[QuickLog] Erro na pesquisa:', err);
      setLogResults([]);
    }
    setLogSearching(false);
  }, [tmdbKey, workerUrl, quickSearchType]);

  useEffect(() => {
    if (logOpen) setTimeout(() => logInputRef.current?.focus(), 80);
    else { setLogQuery(""); setLogResults([]); }
  }, [logOpen]);

  useEffect(() => {
    const t = setTimeout(() => { if (logQuery) doLogSearch(logQuery); else setLogResults([]); }, 600);
    return () => clearTimeout(t);
  }, [logQuery, quickSearchType]);

  const items = useMemo(() => {
    if (demoMode) return Object.values(DEMO_LIBRARY);
    return Object.values(library);
  }, [library, demoMode]);

  const activeProfile = demoMode ? DEMO_PROFILE : profile;
  const activeFavorites = demoMode ? DEMO_PROFILE.favorites : (Array.isArray(favorites) ? favorites : []);

  const stats = useMemo(() => ({
    assistindo: items.filter((i) => i.userStatus === "assistindo").length,
    completo: items.filter((i) => i.userStatus === "completo").length,
    planejado: items.filter((i) => i.userStatus === "planejado").length,
  }), [items]);

  const filteredLib = useMemo(() => items.filter((i) => {
    if (filterStatus !== "all" && i.userStatus !== filterStatus) return false;
    if (activeTab !== "all" && i.type !== activeTab) return false;
    if (libSearch.trim() && !i.title?.toLowerCase().includes(libSearch.toLowerCase().trim())) return false;
    return true;
  }), [items, filterStatus, activeTab, libSearch]);

  const sortedLib = useMemo(() => {
    const arr = [...filteredLib];
    if (libSort === "title") return arr.sort((a,b) => (a.title||"").localeCompare(b.title||""));
    if (libSort === "rating") return arr.sort((a,b) => (b.userRating||0) - (a.userRating||0));
    return arr.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
  }, [filteredLib, libSort]);

  const accentRgb = useMemo(() => `${parseInt(accent.slice(1, 3), 16)},${parseInt(accent.slice(3, 5), 16)},${parseInt(accent.slice(5, 7), 16)}`, [accent]);

  // Stat colors pré-calculados — evita accentShade() em cada render
  const homeStatColors = useMemo(() => ({
    assistindo: accentShade(accent, 0),
    completo:   accentShade(accent, 15),
    pausa:      accentShade(accent, 30),
    largado:    accentShade(accent, -20),
    planejado:  accentShade(accent, 45),
  }), [accent]);

  const homeDashboard = useMemo(() => {
    const plannedStatuses = new Set(["planejado", "planeado"]);
    const pausedStatuses = new Set(["pausado", "pausa"]);
    const watchTypes = new Set(["anime", "filmes", "series"]);
    const readTypes = new Set(["manga", "livros", "comics"]);
    const actionable = items.filter(i => i && i.userStatus !== "completo" && i.userStatus !== "largado" && i.userStatus !== "dropado");
    const withPriority = (list, extra = () => 0) => [...list].sort((a, b) => {
      const aScore = ((a.userRating || 0) * 20) + (a.score || 0) + extra(a);
      const bScore = ((b.userRating || 0) * 20) + (b.score || 0) + extra(b);
      if (bScore !== aScore) return bScore - aScore;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

    const inProgress = withPriority(actionable.filter(i => i.userStatus === "assistindo"), () => 30);
    const paused = withPriority(actionable.filter(i => pausedStatuses.has(i.userStatus)), () => 12);
    const planned = withPriority(actionable.filter(i => plannedStatuses.has(i.userStatus)), () => 4);
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const seededPick = (arr, offset = 0) => arr.length ? arr[(daySeed + offset) % arr.length] : null;

    const currentFocus = inProgress[0] || paused[0] || planned[0] || null;

    // Forgotten: mais antigo no Planejo, excluindo currentFocus
    const oldestPlanned = [...planned]
      .filter(i => i.id !== currentFocus?.id)
      .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    const forgottenPlanned = seededPick(oldestPlanned.slice(0, Math.min(8, oldestPlanned.length)), 1) || oldestPlanned[0] || null;

    // Worth Returning: pausados, excluindo currentFocus
    const pausedFiltered = paused.filter(i => i.id !== currentFocus?.id);
    const worthReturning = seededPick(pausedFiltered, 2) || pausedFiltered[0] || null;

    // Best for Today: candidatos excluindo currentFocus, forgotten e worthReturning
    // Com diversidade de tipos — não repetir o mesmo tipo que currentFocus
    const excludeIds = new Set([currentFocus?.id, forgottenPlanned?.id, worthReturning?.id].filter(Boolean));
    const bestCandidates = withPriority(actionable, (item) => {
      if (item.userStatus === "assistindo") return 28;
      if (pausedStatuses.has(item.userStatus)) return 14;
      if (watchTypes.has(item.type)) return 6;
      return 0;
    }).filter(item => !excludeIds.has(item.id));

    const prime = 31;
    const seededPickPrime = (arr, offset = 0) => arr.length ? arr[Math.abs((daySeed * prime + offset * 17)) % arr.length] : null;

    // Diversidade: para cada slot, preferir tipo diferente dos slots já preenchidos
    const pickWithDiversity = (candidates, usedTypes, seed, offset) => {
      if (!candidates.length) return null;
      // Primeiro tentar tipo não usado
      const fresh = candidates.filter(i => !usedTypes.has(i.type));
      if (fresh.length > 0) return seededPickPrime(fresh.slice(0, Math.min(10, fresh.length)), offset);
      // Fallback: qualquer candidato
      return seededPickPrime(candidates.slice(0, Math.min(10, candidates.length)), offset);
    };

    const usedTypes = new Set([currentFocus?.type].filter(Boolean));

    // Best for Today — tipo diferente do currentFocus
    const bestForToday = pickWithDiversity(bestCandidates, usedTypes, daySeed, 0) || bestCandidates[0] || null;
    if (bestForToday) usedTypes.add(bestForToday.type);

    // Forgotten — tipo diferente dos anteriores, dos mais antigos no planejo
    const forgottenDiverse = oldestPlanned.filter(i => !usedTypes.has(i.type));
    const forgottenFinal = forgottenDiverse.length > 0
      ? (seededPickPrime(forgottenDiverse.slice(0, Math.min(8, forgottenDiverse.length)), 1) || forgottenDiverse[0])
      : forgottenPlanned;
    if (forgottenFinal) usedTypes.add(forgottenFinal.type);

    // Worth Returning — tipo diferente dos anteriores
    const returnDiverse = pausedFiltered.filter(i => !usedTypes.has(i.type));
    const worthReturningFinal = returnDiverse.length > 0
      ? (seededPickPrime(returnDiverse, 2) || returnDiverse[0])
      : worthReturning;

    const quickPicks = [];
    const pushPick = (slot, item) => {
      if (!item || quickPicks.some(p => p.item?.id === item.id)) return;
      quickPicks.push({ slot, item });
    };
    if (currentFocus) pushPick("focus", currentFocus);
    pushPick("today", bestForToday);
    pushPick("forgotten", forgottenFinal || forgottenPlanned);
    pushPick("return", worthReturningFinal || worthReturning);

    return {
      currentFocus,
      quickPicks: quickPicks.slice(0, 4),
    };
  }, [items]);

  // Loading screen
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "white", fontWeight: 900, marginBottom: 16 }}>T</div>
          <div className="spin" style={{ fontSize: 28, color: accent, display: "block" }}>◌</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.7s linear infinite; display: inline-block; }`}</style>
        </div>
      </div>
    );
  }

  // Auth screen
  if (!user && !demoMode) {
    if (showLanding) return <LandingPage accent={accent} onEnter={() => setShowLanding(false)} onDemo={() => { setDemoMode(true); setShowLanding(false); }} lang={lang} useT={useT} changeLang={changeLang} />;
    return <AuthScreen onAuth={handleAuth} accent={accent} onBack={() => setShowLanding(true)} lang={lang} useT={useT} />;
  }

  // Which bg image to show based on device + separate setting
  const activeBgImage = bgSeparateDevices
    ? (isMobileDevice ? bgImageMobile : bgImage)
    : bgImage;

  // Active bg color: mobile can have different color when bgSeparateDevices is on
  const activeBgColor = (bgSeparateDevices && isMobileDevice)
    ? (bgColorMobile || "#0d1117")  // mobile sem cor = noturno por defeito, nunca herda PC
    : bgColor;

  // darkMode separado: PC usa bgColor, mobile usa bgColorMobile quando separado está ligado
  // Se bgSeparateDevices ligado e no mobile: usa bgColorMobile se tiver valor, senão mantém darkMode independente do PC
  const activeDarkMode = (bgSeparateDevices && isMobileDevice)
    ? (bgColorMobile ? isColorDark(bgColorMobile) : true)  // mobile sem cor definida = noturno por defeito
    : darkMode;

  // Computed panel bg para uso no CSS global (lib-sidebar)
  const computedPanelBgCSS = (() => {
    if (!panelBg) return activeDarkMode ? "#161b22" : "rgba(255,255,255,0.7)";
    const op = (panelOpacity ?? 100) / 100;
    try {
      const hex = panelBg.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16);
        const g = parseInt(hex.slice(2,4),16);
        const b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b},${op})`;
      }
    } catch {}
    return panelBg;
  })();

  // Active text contrast: mobile can have different value when bgSeparateDevices is on
  const activeTextContrast = (bgSeparateDevices && isMobileDevice) ? textContrastMobile : textContrast;
  const baseTextColor = activeDarkMode ? "#e6edf3" : "#0d1117";

  return (
    <ThemeContext.Provider value={{ accent, bg: activeBgColor, darkMode: activeDarkMode, isMobileDevice }}>
      <LangContext.Provider value={{ lang, useT }}>
      <div style={{
        minHeight: "100vh",
        background: activeBgColor,
        color: baseTextColor,
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        paddingBottom: 80,
        position: "relative",
        overflowX: "hidden",
      }}>
        {/* Demo mode banner */}
        {demoMode && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>👀 Modo Demonstração — os dados são fictícios</span>
            <button onClick={() => { setDemoMode(false); setShowLanding(false); }} style={{ padding: "5px 14px", borderRadius: 8, background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>{useT("landingCreateFree")}</button>
            <button onClick={() => { setDemoMode(false); setShowLanding(true); }} style={{ padding: "5px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>✕ Sair</button>
          </div>
        )}
        {activeBgImage && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 0,
            backgroundImage: `url(${activeBgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundAttachment: "scroll",
            backgroundRepeat: "no-repeat",
            filter: bgBlur > 0 ? `blur(${bgBlur}px)` : "none",
            transform: bgBlur > 0 ? "scale(1.05)" : "none",
          }} />
        )}
        {activeBgImage && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1,
            background: bgOverlay,
          }} />
        )}
        {/* ── Desktop Sidebar ── */}
        {!isMobileDevice && (() => {
          const libByType = Object.values(library);
          const navItems = [
            { id: "home", icon: "⌂", label: useT("home") },
            { id: "library", icon: "▤", label: useT("library") },
            { id: "profile", icon: "◉", label: useT("profile") },
          ];
          return (
            <aside className="desktop-sidebar">
              {/* Logo */}
              <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white", flexShrink: 0 }}>T</div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", letterSpacing: "-0.5px" }}>TrackAll</span>
                </div>
              </div>

              {/* Nav principal */}
              <div style={{ padding: "4px 0" }}>
                {navItems.map((n) => (
                  <button key={n.id} className={`ds-nav-btn${view === n.id ? " active" : ""}`}
                    onClick={() => setView(n.id)}
                    style={view === n.id ? { background: `${accent}1a`, color: accent } : {}}>
                    <span className="ds-icon" style={view === n.id ? { color: accent } : {}}>{n.icon}</span>
                    {n.label}
                  </button>
                ))}
                {/* Amigos */}
                <button className={`ds-nav-btn${view === "friends" ? " active" : ""}`}
                  onClick={() => setView("friends")}
                  style={view === "friends" ? { background: `${accent}1a`, color: accent } : {}}>
                  <span className="ds-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} />
                      <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} opacity="0.7" />
                      <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
                    </svg>
                  </span>
                  {useT("friends")}
                </button>
                <SidebarSearch accent={accent} darkMode={activeDarkMode} activeTab={activeTab} doSearch={doSearch} setSearchQuery={setSearchQuery} setView={setView} useT={useT} />
              </div>

              {/* Botão + Log Rápido */}
              <div style={{ padding: "8px 8px 4px" }}>
                <button onClick={() => { setLogOpen(v => !v); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${accent}44`, background: `${accent}12`, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: accent, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accent}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${accent}12`; }}>
                  <span style={{ fontSize: 18 }}>+</span> {useT("quickLog")}
                </button>
              </div>

              {/* Biblioteca por tipo */}
              {libByType.length > 0 && (
                <>
                  <p className="ds-section" style={{ marginTop: 6, paddingBottom: 6 }}>{useT("library")}</p>
                  {MEDIA_TYPES.slice(1).filter(t => libByType.some(i => i.type === t.id)).map((t, tIdx) => {
                    const cnt = libByType.filter(i => i.type === t.id).length;
                    const isActive = view === "library" && activeTab === t.id;
                    const typeIcons = {
                      anime: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 9.5c.5-1 1.5-1.5 2.5-1s1.5 1.5 1 2.5L9 14h5"/><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none"/></svg>,
                      manga: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="3" width="11" height="18" rx="2"/><path d="M15 3l4 2v16l-4-2"/></svg>,
                      series: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></svg>,
                      filmes: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M9 4v5M15 4v5M2 14h20M9 14v6M15 14v6"/></svg>,
                      jogos: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="12" rx="3"/><path d="M9 13h2m1 0h2M14 11v2M6 13h.01"/></svg>,
                      livros: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h7a2 2 0 012 2v13a1.5 1.5 0 00-1.5-1.5H4z"/><path d="M20 4h-7a2 2 0 00-2 2v13a1.5 1.5 0 011.5-1.5H20z"/></svg>,
                      manhwa: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h4M7 12h6M7 16h3M15 12l3-4v8"/></svg>,
                      lightnovels: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3l1.5 5h5l-4 3 1.5 5L12 13l-4 3 1.5-5-4-3h5z"/></svg>,
                      comics: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 4V5a1 1 0 011-1z"/></svg>,
                    };
                    return (
                      <div key={t.id} className="ds-type-item" onClick={() => { setView("library"); setActiveTab(t.id); }}
                        style={{ background: isActive ? `${accent}18` : undefined, borderRadius: 8, color: isActive ? accent : (darkMode ? "#8b949e" : "#64748b") }}>
                        <span style={{ display: "flex", alignItems: "center", width: 18, flexShrink: 0, color: isActive ? accent : (darkMode ? "#8b949e" : "#64748b") }}>{typeIcons[t.id] || t.icon}</span>
                        <span style={{ flex: 1, color: isActive ? accent : (darkMode ? "#c9d1d9" : "#374151"), fontWeight: isActive ? 700 : 500, fontSize: 13 }}>{mediaLabel(t, lang)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? accent : "#484f58" }}>{cnt}</span>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
                </>
              )}

              {/* Avatar + nome em baixo */}
              <div style={{ marginTop: "auto", padding: "16px", borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("profile")}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}66)`, border: `2px solid ${view === "profile" ? accent : "transparent"}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {profile.avatar ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Utilizador"}</p>
                    <p style={{ fontSize: 11, color: "#8b949e" }}>{Object.keys(library).length} {useT("inLibraryCount")}</p>
                  </div>
                </div>
              </div>
            </aside>
          );
        })()}

        <div className="desktop-main tc-zone" style={{ position: "relative", zIndex: 2, minHeight: "100vh", background: activeBgImage ? "transparent" : activeBgColor }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { overscroll-behavior: none; }
          :root { --tc: ${activeTextContrast / 100}; }
          ${(() => {
            if (activeTextContrast === 100) return '';
            const base = darkMode ? [230, 237, 243] : [13, 17, 23];
            let r, g, b;
            if (activeTextContrast < 100) {
              const t = activeTextContrast / 100;
              r = Math.round(base[0] * t); g = Math.round(base[1] * t); b = Math.round(base[2] * t);
            } else {
              const t = (activeTextContrast - 100) / 100;
              r = Math.round(base[0] + (255-base[0])*t); g = Math.round(base[1] + (255-base[1])*t); b = Math.round(base[2] + (255-base[2])*t);
            }
            const col = `rgb(${r},${g},${b})`;
            return `
          .tc-zone { color: ${col} !important; }
          .tc-zone p, .tc-zone span, .tc-zone h1, .tc-zone h2, .tc-zone h3,
          .tc-zone h4, .tc-zone h5, .tc-zone li, .tc-zone a { color: ${col} !important; }
          .tc-zone .no-tc, .tc-zone .no-tc *,
          .tc-zone .rating-hover, .tc-zone .rating-hover *,
          .tc-zone .fav-overlay, .tc-zone .fav-overlay *,
          .tc-zone .recent-hover-overlay, .tc-zone .recent-hover-overlay *,
          .tc-zone .btn-accent, .tc-zone .btn-accent * { color: unset !important; }
          `;
          })()}
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${activeDarkMode ? "#30363d" : "#cbd5e1"}; border-radius: 3px; }
          .btn-accent { background: linear-gradient(135deg, ${accent}, ${accent}cc); color: white; border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 700; transition: all 0.2s; }
          .btn-accent:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(${accentRgb},0.4); }
          .card { background: ${activeDarkMode ? "rgba(22,27,34,0.4)" : "rgba(255,252,247,0.55)"}; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid ${activeDarkMode ? "#21262d" : "#e8e0d5"}; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
          .card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); border-color: ${activeDarkMode ? "#30363d" : "#cbd5e1"}; }
          .card:hover .card-overlay { opacity: 1 !important; }
          .media-thumb { position: relative; overflow: hidden; border-radius: 10px; }
          .media-thumb .rating-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.52); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(-4px); transition: opacity 0.18s ease, transform 0.18s ease; border-radius: 10px; }
          .media-thumb:hover .rating-hover { opacity: 1; transform: translateY(0); }
          .media-thumb:hover img { transform: scale(1.04); transition: transform 0.25s ease; }
          .media-thumb img { transition: transform 0.25s ease; width: 100%; height: 100%; object-fit: cover; display: block; }
          .tab-btn { background: transparent; border: none; color: ${activeDarkMode ? "#8b949e" : "#64748b"}; cursor: pointer; padding: 7px 14px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s; }
          .tab-btn:hover { color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; background: ${activeDarkMode ? "#21262d" : "#e2e8f0"}; }
          .tab-btn.active { background: ${accent}; color: white; font-weight: 700; }
          input, select, textarea { background: ${activeDarkMode ? "#0d1117" : "#ffffff"}; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; border: 1px solid ${activeDarkMode ? "#30363d" : "#e2e8f0"}; border-radius: 10px; font-family: 'Outfit', sans-serif; transition: border-color 0.15s; }
          input::placeholder { color: ${activeDarkMode ? "#484f58" : "#94a3b8"}; }
          input:focus, select:focus { outline: none; border-color: ${accent}; box-shadow: 0 0 0 3px rgba(${accentRgb},0.1); }
          .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
          .modal { background: ${activeDarkMode ? "#161b22" : "#ffffff"}; border: 1px solid ${activeDarkMode ? "#30363d" : "#e2e8f0"}; border-radius: 16px; width: 100%; overflow: hidden; }
          .modal-glass { background: ${activeDarkMode ? "rgba(22,27,34,0.42)" : "rgba(255,255,255,0.5)"} !important; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
          .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
          @media (max-width: 480px) { .media-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
          .recents-row { -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; }
          .recents-row > * { scroll-snap-align: start; }
          img { will-change: auto; }
          .card { contain: layout style; }
          @media (max-width: 768px) {
            .card { contain: layout; border: none; border-radius: 8px; transition: none !important; backdrop-filter: none; -webkit-backdrop-filter: none; }
            .fade-in { animation: none !important; }
            .view-transition { animation: none !important; }
            .media-thumb:hover img { transform: none !important; }
            .media-thumb .rating-hover { display: none; }
            .recents-row { -webkit-overflow-scrolling: touch; }
            * { -webkit-tap-highlight-color: transparent; }
            .card-info { display: none; }
            .card-info-title { display: block; font-size: 10px; font-weight: 700; padding: 5px 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; }
            .card-info-meta { display: none; }
          }
          @media (max-width: 480px) {
            .modal-bg { backdrop-filter: none !important; background: rgba(0,0,0,0.88) !important; }
          }
          .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${activeDarkMode ? "rgba(22,27,34,0.96)" : "rgba(255,255,255,0.96)"}; backdrop-filter: blur(12px); border-top: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; display: flex; height: 64px; z-index: 50; }
          .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; transition: color 0.15s; color: ${activeDarkMode ? "#484f58" : "#94a3b8"}; }
          .nav-btn.active { color: ${accent}; }
          .nav-btn:hover { color: ${activeDarkMode ? "#8b949e" : "#64748b"}; }
          .nav-center-btn { flex: 1; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; height: 100%; position: relative; -webkit-tap-highlight-color: transparent; }
          .tabs-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .tabs-scroll::-webkit-scrollbar { display: none; }
          .lib-layout { display: flex; gap: 20px; align-items: flex-start; }
          .lib-sidebar { display: none; }
          .lib-mobile-controls { display: block; }
          @media (min-width: 768px) {
            .lib-sidebar { display: block; width: 180px; flex-shrink: 0; background: ${computedPanelBgCSS}; border: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; border-radius: 12px; padding: 14px 10px; position: sticky; top: 70px; }
            .lib-mobile-controls { display: none; }
          }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          .shimmer { background: linear-gradient(90deg, ${activeDarkMode ? "#21262d" : "#e2e8f0"} 25%, ${activeDarkMode ? "#30363d" : "#f1f5f9"} 50%, ${activeDarkMode ? "#21262d" : "#e2e8f0"} 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
          :root {
            --border: ${activeDarkMode ? "#21262d" : "#e2e8f0"};
            --border2: ${activeDarkMode ? "#30363d" : "#d0d7de"};
            --card-bg: ${activeDarkMode ? "#161b22" : "rgba(255,252,247,0.95)"};
            --card-bg2: ${activeDarkMode ? "#0d1117" : "#f6f8fa"};
            --text-primary: ${activeDarkMode ? "#e6edf3" : "#1a1a2e"};
            --text-secondary: ${activeDarkMode ? "#8b949e" : "#57606a"};
            --text-muted: ${activeDarkMode ? "#484f58" : "#8c959f"};
            --input-bg: ${activeDarkMode ? "#0d1117" : "#ffffff"};
            --hover-bg: ${activeDarkMode ? "#21262d" : "#f3f4f6"};
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes ta-pop { 0%{transform:scale(1)} 35%{transform:scale(1.28)} 65%{transform:scale(0.92)} 100%{transform:scale(1)} }
          @keyframes ta-bounce { 0%{transform:scale(1) translateY(0)} 30%{transform:scale(1.12) translateY(-3px)} 60%{transform:scale(0.96) translateY(1px)} 100%{transform:scale(1) translateY(0)} }
          @keyframes ta-star { 0%{transform:scale(1) rotate(0deg)} 40%{transform:scale(1.4) rotate(-12deg)} 70%{transform:scale(0.9) rotate(6deg)} 100%{transform:scale(1) rotate(0deg)} }
          .ta-pop { animation: ta-pop 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
          .ta-bounce { animation: ta-bounce 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
          .ta-star { animation: ta-star 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
          @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes modalSlideUp { from { opacity: 0; transform: translateY(32px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .fade-in { animation: fadeIn 0.2s ease; }
          .view-transition { animation: viewIn 0.18s ease both; }
          @keyframes viewIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .recent-card:hover > div { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.7) !important; }
          .qp-btn { transition: background 0.15s, border-color 0.15s, transform 0.1s; }
          .qp-btn:not(:disabled):hover { transform: translateY(-1px); }
          .qp-btn-primary:not(:disabled):hover { background: ${accent}35 !important; border-color: ${accent} !important; }
          .qp-btn-secondary:not(:disabled):hover { background: ${activeDarkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)"} !important; border-color: ${activeDarkMode ? "#484f58" : "#94a3b8"} !important; }
          .recent-card:hover .recent-hover-overlay { opacity: 1 !important; }
          .fav-card-wrap:hover > div { transform: translateY(-3px) scale(1.03); box-shadow: 0 8px 28px rgba(0,0,0,0.65) !important; }
          .fav-card-wrap > div { transition: transform 0.18s, box-shadow 0.18s; }
          .fav-card-wrap:hover .fav-hover-overlay { opacity: 1 !important; }
          .recent-card:hover .fav-rm { opacity: 1 !important; }
          .media-grid .card { animation: cardIn 0.22s ease both; }
          .media-grid[data-key] .card { animation: cardIn 0.22s ease both; }
          .media-grid .card:nth-child(1)  { animation-delay: 0ms; }
          .media-grid .card:nth-child(2)  { animation-delay: 25ms; }
          .media-grid .card:nth-child(3)  { animation-delay: 50ms; }
          .media-grid .card:nth-child(4)  { animation-delay: 75ms; }
          .media-grid .card:nth-child(5)  { animation-delay: 100ms; }
          .media-grid .card:nth-child(6)  { animation-delay: 125ms; }
          .media-grid .card:nth-child(n+7) { animation-delay: 150ms; }
          @media (max-width: 768px) {
            .media-grid .card { animation: none !important; }
            .modal-bg { align-items: flex-end !important; padding: 0 !important; }
            .modal { border-radius: 24px 24px 0 0 !important; max-height: 88vh !important; width: 100% !important; max-width: 100% !important; overflow-y: auto !important; }
            .cover-modal { overflow: hidden !important; display: flex !important; flex-direction: column !important; max-height: calc(88vh - 64px) !important; margin-bottom: 64px !important; }
            .modal::before { content: ""; display: block; width: 36px; height: 4px; background: #30363d; border-radius: 99px; margin: 12px auto 4px; }
            .modal-bottom-pad { padding-bottom: 80px !important; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .spin { animation: spin 0.7s linear infinite; display: inline-block; }
          .hero-gradient { background: ${activeBgImage ? "transparent" : activeBgColor}; border-bottom: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; position: relative; }
          .hero-gradient::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 60% 80% at 50% 120%, ${accent}18 0%, transparent 70%); }
          ${!activeDarkMode ? `
            .desktop-sidebar { background: rgba(255,255,255,0.95) !important; border-right: 1px solid #e2e8f0 !important; }
            .bottom-nav { background: rgba(255,255,255,0.97) !important; }
            .top-nav-bar { background: rgba(255,255,255,0.97) !important; border-bottom: 1px solid #e2e8f0 !important; }
            /* Corrigir texto muted/secondary no modo claro */
            .tc-zone span[style*="color: rgb(72, 79, 88)"],
            .tc-zone p[style*="color: rgb(72, 79, 88)"],
            .tc-zone div[style*="color: rgb(72, 79, 88)"] { color: #57606a !important; }
            .tc-zone span[style*="#484f58"],
            .tc-zone p[style*="#484f58"] { color: #57606a !important; }
            .tc-zone span[style*="#8b949e"],
            .tc-zone p[style*="#8b949e"] { color: #57606a !important; }
            /* Bordas invisíveis no modo claro */
            .tc-zone [style*="border: 1px solid rgb(33, 38, 45)"] { border-color: #e2e8f0 !important; }
            .tc-zone [style*="border: 1px solid #21262d"] { border-color: #e2e8f0 !important; }
            .tc-zone [style*="border-top: 1px solid #21262d"] { border-top-color: #e2e8f0 !important; }
            .tc-zone [style*="border-bottom: 1px solid #21262d"] { border-bottom-color: #e2e8f0 !important; }
            /* Backgrounds escuros em cards/sections */
            .tc-zone [style*="background: rgb(13, 17, 23)"],
            .tc-zone [style*="background: #0d1117"] { background: #f6f8fa !important; }
            .tc-zone [style*="background: rgb(22, 27, 34)"],
            .tc-zone [style*="background: #161b22"] { background: rgba(255,255,255,0.9) !important; }
            .tc-zone [style*="background: rgb(33, 38, 45)"],
            .tc-zone [style*="background: #21262d"] { background: #e8ecf0 !important; }
          ` : ""}

          /* ── Desktop layout ── */
          @media (min-width: 900px) {
            .bottom-nav { display: none !important; }
            .top-nav-bar { display: none !important; }
            .desktop-sidebar { display: flex !important; }
            .desktop-main { margin-left: 220px !important; padding-bottom: 24px !important; }
            .media-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)) !important; gap: 16px !important; }
            .lib-sidebar { display: block !important; }
            .profile-desktop { display: grid !important; grid-template-columns: 300px 1fr !important; gap: 24px !important; align-items: flex-start !important; }
            .profile-desktop-left { display: block !important; }
            .profile-desktop-right { display: block !important; }
            .card-title-text { display: none !important; }
            .card-info { padding: 5px 8px 7px !important; }
            .card-info-meta { font-size: 11px; color: #8b949e; }
          }

          /* ── Desktop sidebar ── */
          .desktop-sidebar {
            display: none;
            position: fixed; left: 0; top: 0; bottom: 0; width: 220px; z-index: 50;
            flex-direction: column;
            background: ${sidebarColor || activeBgColor}f5;
            border-right: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"};
            backdrop-filter: blur(20px);
            padding: 0 0 16px 0;
            overflow-y: hidden;
          }
          .ds-nav-btn {
            display: flex; align-items: center; gap: 12px;
            width: 100%; padding: 11px 16px; border: none; background: none;
            cursor: pointer; font-family: Outfit, sans-serif; font-size: 14px; font-weight: 600;
            color: ${darkMode ? "#8b949e" : "#64748b"}; border-radius: 10px; margin: 1px 8px; width: calc(100% - 16px);
            transition: all 0.15s; text-align: left;
          }
          .ds-nav-btn:hover { background: ${darkMode ? "#161b22" : "#f1f5f9"}; color: ${darkMode ? "#e6edf3" : "#0d1117"}; }
          .ds-nav-btn.active { background: ${accent}18; color: ${accent}; }
          .ds-nav-btn .ds-icon { font-size: 18px; width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
          .ds-section { font-size: 10px; font-weight: 800; color: #484f58; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 24px 4px; }
          .ds-type-item {
            display: flex; align-items: center; gap: 8px;
            padding: 4px 16px; font-size: 12px; cursor: pointer;
            color: ${darkMode ? "#8b949e" : "#64748b"}; border-radius: 8px; margin: 0 8px;
            transition: all 0.12s;
          }
          .ds-type-item:hover { background: ${darkMode ? "#161b22" : "#f1f5f9"}; }
        `}</style>

        <Notification notif={notif} />




        {/* ── Rating prompt after quick-log ── */}
        {logPendingItem && (
          <RatingOverlay
            item={logPendingItem}
           
            library={library}
            onDone={(rating) => {
              if (rating > 0) {
                const normalizedPending = normalizeMediaItem(logPendingItem);
                const matched = getLibraryMatch(normalizedPending.id, normalizedPending.type);
                const canonicalId = normalizeMediaId(normalizedPending.id, normalizedPending.type);
                const next = { ...library };
                if (matched?.key && matched.key !== canonicalId) delete next[matched.key];
                const base = matched?.item || normalizedPending;
                next[canonicalId] = { ...base, id: canonicalId, userStatus: "completo", userRating: rating };
                saveLibrary(next);
                showNotif(`"${(logPendingItem.title || "Item").slice(0, 24)}" ✓  ★ ${rating}`, accent);
              } else {
                showNotif(`"${(logPendingItem.title || "Item").slice(0, 30)}" ✓`, accent);
              }
              setLogPendingItem(null);
            }}
          />
        )}

        {/* Detail Modal */}
        {selectedItem && (
          <DetailModal
            item={selectedItem}
            library={library}
            onAdd={addToLibrary}
            onRemove={(id) => { removeFromLibrary(id); setSelectedItem(null); }}
            onUpdateStatus={updateStatus}
            onUpdateDuration={updateDuration}
            onUpdateNote={updateNote}
            onUpdateLastChapter={updateLastChapter}
            onUpdateRating={updateRating}
            onChangeCover={updateCover}
            onClose={() => setSelectedItem(null)}
            accent={accent}
            favorites={activeFavorites}
            onToggleFavorite={toggleFavorite}
            hallOfFame={activeProfile.hallOfFame || []}
            onToggleHallOfFame={toggleHallOfFame}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onOpenItem={(newItem) => setSelectedItem(newItem)}
          />
        )}

        {/* NAV TOP */}
        <nav className="top-nav-bar" style={{ background: `${activeBgColor}ee`, backdropFilter: "blur(14px)", borderBottom: `1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}`, padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 56, position: "sticky", top: 0, zIndex: 40 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white" }}>T</div>
            <span style={{ fontSize: 18, fontWeight: 900, color: activeDarkMode ? "#e6edf3" : "#0d1117", letterSpacing: "-0.5px" }}>TrackAll</span>
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#484f58", fontSize: 14, display: "flex" }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(searchQuery, activeTab); } }}
                placeholder="Pesquisar..."
                style={{ width: "100%", padding: "9px 36px 9px 36px", fontSize: 13 }}
              />
              {searchQuery && (
                <span
                  onClick={() => doSearch(searchQuery, activeTab)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b949e", fontSize: 16, padding: "2px 6px", borderRadius: 6, background: "#21262d" }}
                >⏎</span>
              )}
            </div>
          </div>

          {/* Avatar */}
          <button onClick={() => setView("profile")} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}66)`, border: `2px solid ${view === "profile" ? accent : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 16 }}>👤</span>}
            </div>
          </button>
        </nav>

        <div
          onTouchStart={handleMainSwipeStart}
          onTouchMove={handleMainSwipeMove}
          onTouchEnd={handleMainSwipeEnd}
          onTouchCancel={handleMainSwipeCancel}
          style={{
            touchAction: canUseMainSwipe ? "pan-y" : "auto",
            position: "relative",
            overflow: "hidden",
          }}
        >

        {canUseMainSwipe && (
          <div ref={mainSwipePeekRef} style={{ display: "none", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 5, pointerEvents: "none", overflow: "hidden" }}>
            <div data-peek-content style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <span data-peek-icon style={{ fontSize: 48, lineHeight: 1 }}></span>
              <span data-peek-label style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}></span>
            </div>
          </div>
        )}

        <div
          ref={mainSwipeContentRef}
          style={{
            transform: "translate3d(0, 0, 0)",
            willChange: canUseMainSwipe ? "transform" : "auto",
            backfaceVisibility: "hidden",
          }}
        >

        <div style={{ display: view === "home" ? "block" : "none" }}>
        {/* ── HOME ── */}
          <div style={{ paddingLeft: 0, paddingRight: 0 }}>
            {/* Hero — Avatar + Stats side by side */}
            <div className="hero-gradient" style={{ padding: "16px 16px 14px" }}>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                {/* Avatar + Name + Stats */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  {/* Avatar compacto */}
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                    border: `2.5px solid ${accent}`,
                    boxShadow: `0 0 0 3px ${accent}33`,
                    background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                  }}>
                    {profile.avatar
                      ? <img src={profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : "👤"}
                  </div>
                  {/* Right: nome + stats numa linha */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1.1, marginBottom: 2, background: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      {profile.name || "Utilizador"}
                    </h2>
                    <p style={{ fontSize: 12, color: darkMode ? "#6b7280" : "#94a3b8", marginBottom: 8, fontWeight: 500 }}>
                      <span style={{ color: darkMode ? "#c9d1d9" : "#475569", fontWeight: 700 }}>{items.length}</span> {useT("inLibraryCount")}
                    </p>
                    {/* Stats compactas numa linha */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { l: lang === "en" ? "Progress" : "Curso",   v: stats.assistindo, key: "assistindo" },
                        { l: useT("completo"),                        v: stats.completo,   key: "completo"   },
                        { l: lang === "en" ? "Paused" : "Pausa",     v: stats.pausa,      key: "pausa"      },
                        { l: useT("dropado"),                         v: stats.largado,    key: "largado"    },
                        { l: lang === "en" ? "Planned" : "Planej.",   v: stats.planejado,  key: "planejado"  },
                      ].filter(s => s.v > 0).map((s) => {
                        const col = homeStatColors[s.key];
                        return (
                          <div key={s.l} style={{
                            flex: "1 1 0", minWidth: 0,
                            background: `${col}14`,
                            borderLeft: `2px solid ${col}`,
                            borderRadius: "0 6px 6px 0",
                            padding: "4px 5px",
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: col, lineHeight: 1 }}>{s.v}</div>
                            <div style={{ color: "#8b949e", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 1 }}>{s.l}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Filter tags — tab style */}
                <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}` }}>
                  {MEDIA_TYPES.slice(1).map((t) => {
                    const active = homeFilter.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => {
                        setHomeFilter(prev =>
                          prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                        );
                      }} style={{
                        flexShrink: 0, background: "none", border: "none",
                        borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
                        marginBottom: -1,
                        color: active ? accent : (activeDarkMode ? "#8b949e" : "#64748b"),
                        padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        WebkitTapHighlightColor: "transparent",
                      }}>
                        {mediaLabel(t, lang)}
                      </button>
                    );
                  })}
                  {homeFilter.length > 0 && (
                    <button onClick={() => setHomeFilter([])} style={{
                      flexShrink: 0, background: "none", border: "none",
                      borderBottom: "2px solid transparent", marginBottom: -1,
                      color: "#ef4444", padding: "8px 10px",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                      WebkitTapHighlightColor: "transparent",
                    }}>✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats strip rápido ── */}
            {items.length > 0 && (() => {
              const now = new Date();
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
              const thisMonth = items.filter(i => i.addedAt && i.userStatus === "completo" && i.addedAt >= startOfMonth).length;
              const rated = items.filter(i => i.userRating > 0);
              const avgRating = rated.length ? (rated.reduce((s,i) => s + i.userRating, 0) / rated.length).toFixed(1) : null;
              const stats = [
                { label: useT("completedThisMonth"), value: thisMonth, show: thisMonth > 0, icon: "📅" },
                { label: lang === "en" ? "avg rating" : "rating médio", value: avgRating, show: !!avgRating, icon: "★" },
              ].filter(s => s.show);
              if (!stats.length) return null;
              return (
                <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", overflowX: "auto", scrollbarWidth: "none" }}>
                  {stats.map((s, si) => {
                    const c = accentVariant(accent, si);
                    return (
                      <div key={s.label} className="no-tc" style={{
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${c}18 0%, ${c}08 100%)`,
                        border: `1px solid ${c}33`,
                        borderRadius: 12, padding: "10px 16px",
                        display: "flex", flexDirection: "column", gap: 2,
                        minWidth: 110,
                      }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{s.icon === "★" ? <span style={{ fontSize: 14, marginRight: 2 }}>★</span> : null}{s.value}</span>
                        <span style={{ fontSize: 10, color: darkMode ? "#8b949e" : "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {items.length > 0 && homeDashboard.quickPicks.length > 0 && (() => {
              const picks = homeDashboard.quickPicks;
              if (picks.length === 0) return null;
              const quickCopy = {
                focus: { title: lang === "en" ? "Current Focus" : "Foco Atual", desc: lang === "en" ? "Keep going." : "Continua." },
                continue: { title: lang === "en" ? "Continue now" : "Continuar agora", desc: lang === "en" ? "Keep the momentum." : "Mantém o embalo." },
                today: { title: lang === "en" ? "Best for Today" : "Melhor para Hoje", desc: lang === "en" ? "Strongest current pick." : "Aposta mais forte do momento." },
                forgotten: { title: lang === "en" ? "Forgotten in queue" : "Esquecido na fila", desc: lang === "en" ? "Has been waiting for a while." : "Já está contigo há algum tempo." },
                return: { title: lang === "en" ? "Worth returning" : "Vale regressar", desc: lang === "en" ? "A paused title still worth your time." : "Uma pausa que ainda merece o teu tempo." },
              };


              const todayPick = picks.find(p => p.slot === "today");
              const smallPicks = picks.filter(p => p.slot !== "today");
              return (
                <div style={{ padding: "14px 16px 0" }}>
                  {/* Best for Today — card grande */}
                  {todayPick && (() => {
                    const item = todayPick.item;
                    const typeObj = MEDIA_TYPES.find(t => t.id === item.type);
                    return (
                      <div onClick={() => setSelectedItem(item)} style={{ cursor: "pointer", borderRadius: 18, overflow: "hidden", border: `1px solid ${accent}26`, background: activeDarkMode ? `linear-gradient(135deg, ${accent}12 0%, rgba(12,12,16,0.42) 58%, rgba(18,10,14,0.30) 100%)` : `linear-gradient(135deg, ${accent}0d 0%, rgba(255,255,255,0.54) 65%, rgba(255,250,250,0.36) 100%)`, boxShadow: activeDarkMode ? `0 10px 24px ${accent}10` : `0 10px 22px rgba(15,23,42,0.06)`, marginBottom: smallPicks.length > 0 ? 12 : 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "96px 1fr" : "124px 1fr", gap: 14, padding: 14, alignItems: "stretch" }}>
                          <TiltCard maxTilt={7} glare style={{ borderRadius: 14, overflow: "hidden", height: isMobileDevice ? 136 : 170, background: activeDarkMode ? "#0d1117" : "#e2e8f0", flexShrink: 0, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
                            {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", pointerEvents: "none" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 28 }}>{typeObj?.icon || "★"}</div>}
                          </TiltCard>
                          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 4 }}>{lang === "en" ? "Best for Today" : "Melhor para Hoje"}</div>
                                  <h3 style={{ fontSize: isMobileDevice ? 21 : 25, lineHeight: 1.05, fontWeight: 900, color: activeDarkMode ? "#f8fafc" : "#0f172a", marginBottom: 6 }}>{item.title}</h3>
                                </div>
                                {(item.userRating > 0 || item.score) && <div style={{ flexShrink: 0, background: activeDarkMode ? "rgba(10,10,10,0.28)" : "rgba(255,255,255,0.46)", border: `1px solid ${accent}22`, color: "#f59e0b", borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 900 }}>★ {item.userRating > 0 ? item.userRating : item.score}</div>}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 8px", borderRadius: 999, background: `${accent}1d`, color: accent }}>{getMediaTypeLabel(item.type, lang)}</span>
                              </div>
                              <p style={{ fontSize: 13, lineHeight: 1.5, color: activeDarkMode ? "#cbd5e1" : "#475569", margin: 0 }}>{lang === "en" ? "Strongest current pick." : "A aposta mais forte do momento."}</p>
                            </div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: accent, fontSize: 12, fontWeight: 800 }}>
                              <span>{lang === "en" ? "Open title" : "Abrir obra"}</span>
                              <span style={{ fontSize: 14 }}>→</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Outros quick picks — cards pequenos */}
                  {smallPicks.length > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: activeDarkMode ? "#8b949e" : "#64748b" }}>
                          {(lang === "en" ? "Quick picks" : "Escolhas rápidas").toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: "#484f58" }}>{smallPicks.length}</span>
                      </div>
                      {(() => {
                        const plannedPool = items.filter(i => i.userStatus === "planejado" || i.userStatus === "planeado");
                        const surpriseLibrary = () => { if (plannedPool.length) setSelectedItem(plannedPool[Math.floor(Math.random() * plannedPool.length)]); };
                        const surpriseNew = () => { if (personalRecos.length) setSelectedItem(personalRecos[Math.floor(Math.random() * personalRecos.length)]); };
                        return (
                          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <button className="qp-btn qp-btn-primary" onClick={surpriseLibrary} disabled={!plannedPool.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: `1px solid ${accent}70`, background: `${accent}20`, color: plannedPool.length ? (activeDarkMode ? "#fff" : "#0f172a") : "#6e7681", fontSize: 12, fontWeight: 700, cursor: plannedPool.length ? "pointer" : "default", fontFamily: "inherit", opacity: plannedPool.length ? 1 : 0.5 }}>
                              🎲 {lang === "en" ? "Surprise me" : "Surpreende-me"}
                            </button>
                            <button className="qp-btn qp-btn-secondary" onClick={surpriseNew} disabled={!personalRecos.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: `1px solid ${activeDarkMode ? "#30363d" : "#cbd5e1"}`, background: activeDarkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)", color: personalRecos.length ? (activeDarkMode ? "#e6edf3" : "#0f172a") : "#6e7681", fontSize: 12, fontWeight: 700, cursor: personalRecos.length ? "pointer" : "default", fontFamily: "inherit", opacity: personalRecos.length ? 1 : 0.5 }}>
                              ✦ {lang === "en" ? "Something new" : "Algo novo"}
                            </button>
                          </div>
                        );
                      })()}
                      <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                        {smallPicks.map(({ slot, item }) => (
                          <button key={`${slot}-${item.id}`} onClick={() => setSelectedItem(item)} style={{ textAlign: "left", border: `1px solid ${accent}26`, background: activeDarkMode ? `linear-gradient(135deg, ${accent}12 0%, rgba(12,12,16,0.42) 58%, rgba(18,10,14,0.30) 100%)` : `linear-gradient(135deg, ${accent}0d 0%, rgba(255,255,255,0.54) 65%, rgba(255,250,250,0.36) 100%)`, borderRadius: 14, padding: "12px", cursor: "pointer", fontFamily: "inherit", display: "grid", gridTemplateColumns: "54px 1fr", gap: 10 }}>
                            <div style={{ width: 54, height: 74, borderRadius: 10, overflow: "hidden", background: activeDarkMode ? "#0d1117" : "#e2e8f0" }}>
                              {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon || "★"}</div>}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: accent, marginBottom: 6 }}>{quickCopy[slot]?.title || (lang === "en" ? "Pick" : "Escolha")}</div>
                              <div style={{ fontSize: 15, lineHeight: 1.15, fontWeight: 800, color: activeDarkMode ? "#f8fafc" : "#0f172a", marginBottom: 5 }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: activeDarkMode ? "#94a3b8" : "#64748b", marginBottom: 6 }}>{quickCopy[slot]?.desc}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: activeDarkMode ? "#cbd5e1" : "#475569", fontWeight: 700 }}>{getMediaTypeLabel(item.type, lang)}</span>
                                {(item.userRating > 0 || item.score) && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 800 }}>★ {item.userRating > 0 ? item.userRating : item.score}</span>}
                                {(() => { const ct = getConsumptionTime(item); return ct ? <span style={{ fontSize: 10, fontWeight: 800, color: ct.color, background: ct.color + "18", borderRadius: 5, padding: "1px 5px" }}>{ct.emoji} {lang === "en" ? ct.labelEn : ct.label}</span> : null; })()}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Recent — filtered by homeFilter */}
            {items.length === 0 && (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🎬</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: darkMode ? "#e6edf3" : "#0d1117" }}>{lang === "en" ? "Your library is empty" : "A tua biblioteca está vazia"}</h3>
                <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 24, lineHeight: 1.5 }}>{lang === "en" ? "Start adding anime, movies, games and much more" : "Começa a adicionar animes, filmes, jogos e muito mais"}</p>
                <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 14, borderRadius: 12 }} onClick={() => setView("search")}>
                  {lang === "en" ? "+ Explore titles" : "+ Explorar títulos"}
                </button>
              </div>
            )}

            {items.length > 0 && (() => {
              const inCurso = items
                .filter(i => i.userStatus === "assistindo")
                .filter(i => homeFilter.length === 0 || homeFilter.includes(i.type))
                .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
                .slice(0, 20);

              const completados = items
                .filter(i => i.userStatus === "completo")
                .filter(i => homeFilter.length === 0 || homeFilter.includes(i.type))
                .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
                .slice(0, 20);

              if (inCurso.length === 0 && completados.length === 0 && homeFilter.length > 0) return (
                <div style={{ padding: "28px 16px", textAlign: "center", color: darkMode ? "#484f58" : "#94a3b8" }}>
                  <p style={{ fontSize: 14 }}>{lang === "en" ? "No items with this filter" : "Nenhum item com esse filtro"}</p>
                </div>
              );

              const RowSection = ({ title, icon, items: rowItems, filterBtn, collapsed, onToggleCollapse }) => rowItems.length === 0 ? null : (
                <div style={{ padding: "16px 0 8px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 12, paddingRight: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {onToggleCollapse && (
                        <button onClick={onToggleCollapse} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-flex", alignItems: "center", WebkitTapHighlightColor: "transparent" }}>▾</button>
                      )}
                      <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: homeFilter.length === 1 ? (TYPE_COLORS[homeFilter[0]] || (darkMode ? "#8b949e" : "#64748b")) : (darkMode ? "#8b949e" : "#64748b"), textTransform: "uppercase" }}>{icon} {title}</h2>
                      {homeFilter.length > 0 && (
                        <span style={{ fontSize: 10, color: accent, background: `${accent}22`, padding: "2px 6px", borderRadius: 20, fontWeight: 700 }}>
                          {homeFilter.map(f => MEDIA_TYPES.find(t => t.id === f)?.icon).join(" ")}
                        </span>
                      )}
                    </div>
                    {filterBtn}
                  </div>
                  {!collapsed && <div className="recents-row" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                    {rowItems.map((item) => (
                      <div key={item.id} style={{ flexShrink: 0, width: "clamp(90px, 26vw, 130px)" }}>
                        <MediaCard item={item} library={library} onOpen={setSelectedItem} accent={accent} />
                      </div>
                    ))}
                  </div>}
                </div>
              );

              return (
                <>
                  <RowSection
                    title={useT("completedLabel")}
                    icon="✓"
                    items={completados}
                    filterBtn={
                      <button onClick={() => { setView("library"); setFilterStatus("completo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>{useT("verTudo")}</button>
                    }
                  />


                </>
              );
            })()}


            {/* ── Quando consumir? ── */}
            {(() => {
              const plannedStatuses = new Set(["planejado","planeado"]);
              const planned = items.filter(i => i && plannedStatuses.has(i.userStatus));
              if (planned.length === 0) return null;
              const groups = { hoje: [], fimdesemana: [], ferias: [] };
              planned.forEach(i => {
                const ct = getConsumptionTime(i);
                if (ct) groups[ct.slot].push({ item: i, ct });
              });
              const hasAny = groups.hoje.length > 0 || groups.fimdesemana.length > 0 || groups.ferias.length > 0;
              if (!hasAny) return null;
              const nowD = new Date();
              const isWeekend = nowD.getDay() === 0 || nowD.getDay() === 6;
              const daySeed = nowD.getFullYear() * 10000 + (nowD.getMonth()+1) * 100 + nowD.getDate();
              const monday = new Date(nowD); monday.setDate(nowD.getDate() - ((nowD.getDay()+6)%7));
              const weekSeed = monday.getFullYear() * 10000 + (monday.getMonth()+1) * 100 + monday.getDate();
              const seededPicks = (arr, seed, n) => {
                if (!arr.length) return [];
                const picks = [];
                for (let i = 0; i < n && i < arr.length; i++) picks.push(arr[(seed + i) % arr.length]);
                return picks;
              };
              const picksHoje = seededPicks(groups.hoje, daySeed, 2);
              const picksFds = seededPicks(groups.fimdesemana, weekSeed + 1, 2);
              const picksFerias = seededPicks(groups.ferias, weekSeed, 2);
              const slots = [
                picksHoje.length > 0 && { key: "hoje", emoji: "⚡", label: "Para hoje", labelEn: "For today", color: "#10b981", picks: picksHoje, all: groups.hoje, total: groups.hoje.length },
                picksFds.length > 0 && { key: "fimdesemana", emoji: "📅", label: "Fim de semana", labelEn: "Weekend", color: "#06b6d4", picks: picksFds, all: groups.fimdesemana, total: groups.fimdesemana.length },
                picksFerias.length > 0 && { key: "ferias", emoji: "🏖️", label: "Para as férias", labelEn: "For holidays", color: "#f59e0b", picks: picksFerias, all: groups.ferias, total: groups.ferias.length },
              ].filter(Boolean);
              if (slots.length === 0) return null;
              return (
                <div style={{ margin: "20px 0 4px", padding: "0 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: activeDarkMode ? "#8b949e" : "#64748b", marginBottom: 10 }}>
                    {lang === "en" ? "When to consume?" : "Quando consumir?"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {slots.map(({ key, emoji, label, labelEn, color, picks, all, total }) => (
                      <div key={key} style={{ background: activeDarkMode ? "rgba(12,12,16,0.30)" : "rgba(255,255,255,0.28)", border: `1px solid ${color}30`, borderRadius: 14, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                          {lang === "en" ? labelEn : label}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {picks.map((p, pi) => (
                            <button key={p.item.id + pi} onClick={() => setSelectedItem(p.item)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 0", textAlign: "left", width: "100%" }}>
                              <div style={{ width: 34, height: 48, borderRadius: 6, overflow: "hidden", background: activeDarkMode ? "#0d1117" : "#e2e8f0", flexShrink: 0 }}>
                                {p.item.cover ? <img src={p.item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 14 }}>{MEDIA_TYPES.find(t => t.id === p.item.type)?.icon || "★"}</div>}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: activeDarkMode ? "#f0f6fc" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.item.title}</div>
                                <div style={{ fontSize: 11, color: activeDarkMode ? "#8b949e" : "#64748b" }}>
                                  {getMediaTypeLabel(p.item.type, lang)}{p.item.episodes ? ` · ${p.item.episodes} ep` : p.item.chapters ? ` · ${p.item.chapters} cap` : ""}
                                </div>
                              </div>
                            </button>
                          ))}

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Provavelmente nunca vais consumir ── */}
            {(() => {
              const SIX_MONTHS = 1000 * 60 * 60 * 24 * 180;
              const now = Date.now();
              const recentCompleted = items.filter(i => i?.userStatus === "completo").sort((a,b) => (b.addedAt||0)-(a.addedAt||0)).slice(0,20);
              const genreCounts = {};
              recentCompleted.forEach(i => (i.genres||[]).forEach(g => { genreCounts[g] = (genreCounts[g]||0)+1; }));
              const topGenres = new Set(Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([g])=>g));
              const graveyard = items.filter(i => {
                if (!i) return false;
                if (i.userStatus !== "planejado" && i.userStatus !== "planeado") return false;
                return (now - (i.addedAt || now)) > SIX_MONTHS;
              }).map(i => {
                const outOfPattern = topGenres.size > 0 && !(i.genres||[]).some(g => topGenres.has(g));
                const monthsOld = Math.floor((now-(i.addedAt||now))/(1000*60*60*24*30));
                const reason = outOfPattern ? (lang==="en" ? "out of your pattern" : "fora do teu padrão") : (lang==="en" ? `forgotten for ${monthsOld}m` : `esquecido há ${monthsOld}m`);
                return { ...i, reason, monthsOld };
              }).sort((a,b) => b.monthsOld-a.monthsOld);
              if (graveyard.length === 0) return null;
              const open = graveyardOpen;
              const visible = open ? graveyard : graveyard.slice(0,3);
              const removeItem = async (item) => {
                const cat = item.type+"s";
                setLibrary(prev => { const next={...prev}; if(next[cat]){next[cat]={...next[cat]};delete next[cat][item.id];} return next; });
                if (user) try { await supa.removeFromLibrary(user.id, item.id, item.type); } catch {}
              };
              return (
                <div style={{ margin: "20px 0 4px", padding: "0 16px" }}>
                  <div style={{ background: activeDarkMode ? "rgba(12,12,16,0.30)" : "rgba(255,255,255,0.28)", border: "1px solid #e74c3c30", borderRadius: 14, padding: "10px 12px 4px", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div>
                        <h3 style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e74c3c", marginBottom: 2 }}>
                          {lang==="en" ? "Probably never consuming this" : "Provavelmente nunca vais consumir"}
                        </h3>
                        <div style={{ fontSize: 11, color: "#8b949e" }}>{graveyard.length} {lang==="en" ? "titles · added 6+ months ago" : "títulos · adicionados há 6+ meses"}</div>
                      </div>
                    </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {visible.map(item => {
                      const cover = item.customCover || item.cover;
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "0.5px solid rgba(231,76,60,0.15)" }}>
                          <div onClick={() => setSelectedItem(item)} style={{ width: 52, height: 74, borderRadius: 6, overflow: "hidden", background: "#161b22", cursor: "pointer", flexShrink: 0 }}>
                            {cover ? <img src={cover} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={e=>e.currentTarget.style.display="none"}/> : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#484f58",fontSize:18 }}>?</div>}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 2 }}>{getMediaTypeLabel(item.type, lang)}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: activeDarkMode ? "#f8fafc" : "#0f172a", marginBottom: 4, lineHeight: 1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                            <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 5 }}>{lang==="en" ? `Added ${item.monthsOld}m ago` : `Adicionado há ${item.monthsOld}m`}</div>
                            <span style={{ fontSize: 10, color: "#e2a84a", background: "rgba(226,168,74,0.12)", padding: "2px 7px", borderRadius: 4 }}>{item.reason}</span>
                          </div>
                          <button onClick={() => removeItem(item)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "0.5px solid rgba(231,76,60,0.4)", background: "transparent", color: "#e74c3c", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {lang==="en" ? "remove" : "remover"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {graveyard.length > 3 && (
                    <button onClick={() => setGraveyardOpen(v=>!v)} style={{ display:"block",width:"100%",padding:"10px 0",background:"none",border:"none",borderTop:"0.5px solid rgba(231,76,60,0.15)",color:"#8b949e",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"center" }}>
                      {open ? (lang==="en" ? "show less" : "mostrar menos") : `${lang==="en" ? "see all" : "ver todos"} (${graveyard.length})`}
                    </button>
                  )}
                  </div>
                </div>
              );
            })()}

            {/* Divider */}
            <div style={{ borderTop: "1px solid #21262d", margin: "0 16px 28px" }} />

            {/* ── Mini Insights ── */}
            {(() => {
              const now = new Date();
              const daySeed = now.getFullYear() * 10000 + (now.getMonth()+1) * 100 + now.getDate();
              const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
              const completed = items.filter(i => i?.userStatus === "completo");
              const completedPct = items.length > 0 ? Math.round((completed.length / items.length) * 100) : 0;
              const genreCount = {};
              completed.forEach(i => (i.genres||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
              const topGenre = Object.entries(genreCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
              const typeCount = {};
              completed.forEach(i => { if(i.type) typeCount[i.type] = (typeCount[i.type]||0)+1; });
              const topType = Object.entries(typeCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
              const topTypeLabel = topType ? (MEDIA_TYPES.find(t=>t.id===topType)?.label || topType) : null;
              const SIX_MONTHS = 1000*60*60*24*180;
              const graveyardCount = items.filter(i => i && (i.userStatus==="planejado"||i.userStatus==="planeado") && (Date.now()-(i.addedAt||Date.now()))>SIX_MONTHS).length;
              const ratedThisMonth = completed.filter(i => (i.addedAt||0) >= thisMonthStart && i.userRating > 0);
              const avgThisMonth = ratedThisMonth.length > 0 ? (ratedThisMonth.reduce((s,i)=>s+i.userRating,0)/ratedThisMonth.length).toFixed(1) : null;
              const pool = [
                completedPct > 0 && { icon: "■", text: lang==="en" ? `You've completed ${completedPct}% of your library` : `Já completaste ${completedPct}% da tua biblioteca` },
                topGenre && { icon: "◆", text: lang==="en" ? `Your top genre is ${topGenre}` : `O teu género favorito é ${topGenre}` },
                topTypeLabel && { icon: "▲", text: lang==="en" ? `You consume most ${topTypeLabel}` : `Consomes mais ${topTypeLabel}` },
                graveyardCount > 0 && { icon: "●", text: lang==="en" ? `${graveyardCount} title${graveyardCount>1?"s":""} forgotten in your queue for 6+ months` : `${graveyardCount} obra${graveyardCount>1?"s":""} esquecida${graveyardCount>1?"s":""} no Planejo há 6+ meses` },
                avgThisMonth && { icon: "★", text: lang==="en" ? `Your avg rating this month: ${avgThisMonth}` : `Média de rating este mês: ${avgThisMonth}` },
                completed.length > 0 && { icon: "◉", text: lang==="en" ? `${completed.length} titles completed overall` : `${completed.length} obras completadas no total` },
              ].filter(Boolean);
              if (pool.length === 0) return null;
              const pick1 = pool[daySeed % pool.length];
              const pick2 = pool[(daySeed + 3) % pool.length];
              const picks = pick1 === pick2 ? [pick1] : [pick1, pick2];
              return (
                <div style={{ margin: "0 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {picks.map((insight, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: `${accent}0d`, border: `1px solid ${accent}30`, borderRadius: 12, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, flexShrink: 0, color: accent, fontWeight: 900, width: 20, textAlign: "center" }}>{insight.icon}</span>
                      <span style={{ fontSize: 13, color: activeDarkMode ? "#8b949e" : "#64748b", fontWeight: 600, lineHeight: 1.4 }}>{insight.text}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Recommendations */}
            <div style={{ paddingBottom: 8 }}>
              <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", background: `linear-gradient(90deg, ${accent}, ${accentShade(accent, 40)})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{lang === "en" ? "Featured" : "Em Destaque"}</h3>
                <button onClick={() => loadRecos(true)} disabled={recoLoading} style={{
                  background: "none", border: "none", color: recoLoading ? "#484f58" : accent,
                  cursor: recoLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: 0,
                }}>
                  <span style={{ display: "inline-block", animation: recoLoading ? "spin 0.7s linear infinite" : "none", fontSize: 14 }}>↻</span>
                  {recoLoading ? useT("loading") : useT("refresh")}
                </button>
              </div>
              <RecoCarousel title={lang === "en" ? "For You" : "Para Ti"} icon="✦" items={personalRecos} library={library} onOpen={setSelectedItem} loading={recoLoading} isPersonal={true} />
              <RecoCarousel title={useT("animeTrending")} icon="⛩️" items={recos.anime} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("mangaTrending")} icon="📖" items={recos.manga} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("moviesWeek")} icon="🎬" items={recos.filmes} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("seriesWeek")} icon="📺" items={recos.series} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("topGames")} icon="🎮" items={recos.jogos} library={library} onOpen={setSelectedItem} loading={recoLoading} />
            </div>
          </div>
        </div>
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
            {isSearching && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e" }}>
                <div className="spin" style={{ fontSize: 40, display: "block", marginBottom: 12 }}>◌</div>
                <p>{lang === "en" ? "Searching" : "A pesquisar"}{activeTab !== "all" ? ` in ${mediaLabel(MEDIA_TYPES.find(t=>t.id===activeTab), lang)}` : (lang === "en" ? " across all types" : " em todos os tipos")}...</p>
              </div>
            )}
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
                  <p style={{ color: "#484f58", fontSize: 13, marginBottom: 16 }}>{currentResults.length} resultados{activeTab !== "all" ? ` em ${mediaLabel(MEDIA_TYPES.find(t=>t.id===activeTab), lang)}` : ""} para "<strong style={{ color: activeDarkMode ? "#e6edf3" : "#0d1117" }}>{searchQuery}</strong>"</p>
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
                    key={`${filterStatus}-${activeTab}-${libSort}-${libViewMode}`}
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
        <div style={{ display: view === "friends" ? "block" : "none" }}>
        {/* ── FRIENDS ── */}
          {demoMode || !user ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{lang === "en" ? "Friends are waiting!" : "Os teus amigos estão à espera!"}</h3>
              <p style={{ fontSize: 14, color: darkMode ? "#8b949e" : "#64748b", marginBottom: 24, maxWidth: 300, lineHeight: 1.6 }}>{lang === "en" ? "Create a free account to add friends and share your library." : "Cria uma conta gratuita para adicionar amigos e partilhar a tua biblioteca."}</p>
              <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 15, borderRadius: 12 }} onClick={() => { setDemoMode(false); setShowLanding(false); }}>
                {lang === "en" ? "Create free account" : "Criar conta grátis"}
              </button>
            </div>
          ) : (
            <FriendsView user={user} accent={accent} darkMode={activeDarkMode} isMobileDevice={isMobileDevice} library={library} />
          )}
        </div>
        <div style={{ display: view === "profile" ? "block" : "none" }}>
          <div className="profile-desktop-wrap" style={{ padding: 0, background: activeBgImage ? "transparent" : activeBgColor, minHeight: "100vh" }}>
          <ProfileView
            profile={activeProfile}
            library={library}
            accent={accent}
            bgColor={bgColor}
            bgColorMobile={bgColorMobile}
            bgImage={bgImage}
            bgOverlay={bgOverlay}
            bgBlur={bgBlur}
            bgParallax={bgParallax}
            darkMode={activeDarkMode}
            onUpdateProfile={saveProfile}
            onAccentChange={saveAccent}
            onBgChange={saveBg}
            onBgImage={saveBgImage}
            bgImageMobile={bgImageMobile}
            bgSeparateDevices={bgSeparateDevices}
            onBgSeparateDevices={saveBgSeparateDevices}
            onBgImageMobile={saveMobileBgImage}
            onBgColorMobile={saveBgColorMobile}
            isMobileDevice={isMobileDevice}
            onBgOverlay={saveBgOverlay}
            onBgBlur={saveBgBlur}
            onBgParallax={saveBgParallax}
            panelBg={panelBg}
            panelOpacity={panelOpacity}
            onPanelBg={savePanelBg}
            onPanelOpacity={savePanelOpacity}
            textContrast={textContrast}
            onTextContrast={saveTextContrast}
            textContrastMobile={textContrastMobile}
            onTextContrastMobile={saveTextContrastMobile}
            sidebarColor={sidebarColor}
            onSidebarColor={saveSidebarColor}
            lang={lang}
            useT={useT}
            onChangeLang={changeLang}
            userTierlists={userTierlists}
            userLikes={userLikes}
            currentUserId={user?.id}
            onCreateTierlist={() => { setEditingTierlist(null); setShowTierlistEditor(true); }}
            onViewTierlist={setViewingTierlist}
            onLikeTierlist={handleTierlistLike}
            onDeleteTierlist={handleDeleteTierlist}
            userCollections={userCollections}
            userCollectionLikes={userCollectionLikes}
            onCreateCollection={() => { setEditingCollection(null); setShowCollectionEditor(true); }}
            onViewCollection={(col) => { setViewingCollection(col); setView("collection"); }}
            onLikeCollection={handleCollectionLike}
            onDeleteCollection={handleDeleteCollection}
            onSavedThemes={{ themes: savedThemes, save: saveSavedThemes }}
            onTmdbKey={saveTmdbKey}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onWorkerUrl={saveWorkerUrl}
            onSignOut={handleSignOut}
            userEmail={user?.email || ""}
            favorites={activeFavorites}
            onToggleFavorite={toggleFavorite}
            hallOfFame={activeProfile.hallOfFame || []}
            onToggleHallOfFame={toggleHallOfFame}
            onImportMihon={importMihon}
            onImportPaperback={importPaperback}
            onImportLetterboxd={importLetterboxd}
            onOpen={setSelectedItem}
            diaryPanel={null}
          />
          </div>
        </div>
        <div style={{ display: view === "collection" ? "block" : "none" }}>
          {viewingCollection && (
            <div style={{ background: activeBgImage ? "transparent" : activeBgColor, minHeight: "100vh" }}>
              <CollectionViewer
                col={viewingCollection}
                onClose={() => { setViewingCollection(null); setView("profile"); }}
                onLike={handleCollectionLike}
                liked={userCollectionLikes.includes(viewingCollection.id)}
                currentUserId={user?.id}
                workerUrl={workerUrl}
                onEdit={(col) => { setEditingCollection(col); setShowCollectionEditor(true); }}
                onOpenMedia={(item) => {
                  const libItem = findLibraryEntry(library, item.id, item.type || item.mediaType || "anime")?.item;
                  if (libItem) { setSelectedItem(libItem); } else { setSelectedItem({ id: item.id, title: item.title, type: item.type || item.mediaType || "anime", cover: item.cover }); }
                }}
              />
            </div>
          )}
        </div>

        </div>
        </div>

        {/* TierList Viewer */}
        {viewingTierlist && (
          <TierListViewer
            tl={viewingTierlist}
            onClose={() => setViewingTierlist(null)}
            onLike={handleTierlistLike}
            liked={userLikes.includes(viewingTierlist.id)}
            currentUserId={user?.id}
            onEdit={(tl) => { setViewingTierlist(null); setEditingTierlist(tl); setShowTierlistEditor(true); }}
            onOpenItem={(item) => setSelectedItem(item)}
          />
        )}

        {/* TierList Editor */}
        {showTierlistEditor && (
          <TierListEditor
            initialData={editingTierlist}
            library={library}
            onSave={handleSaveTierlist}
            onClose={() => { setShowTierlistEditor(false); setEditingTierlist(null); }}
            workerUrl={workerUrl}
            tmdbKey={tmdbKey}
          />
        )}

        {/* Collection Editor */}
        {showCollectionEditor && (
          <CollectionModal
            initialData={editingCollection}
            library={Object.values(library)}
            onSave={handleSaveCollection}
            onClose={() => { setShowCollectionEditor(false); setEditingCollection(null); }}
            workerUrl={workerUrl}
          />
        )}

        {/* PWA Install Banner — mobile only */}
        {pwaPrompt && !pwaInstalled && isMobileDevice && (
          <div style={{ position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 60, background: '#161b22', border: `1px solid ${accent}44`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 28 }}>📲</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{useT("installApp")}</p>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{useT("installDesc")}</p>
            </div>
            <button onClick={async () => { pwaPrompt.prompt(); const r = await pwaPrompt.userChoice; if (r.outcome === 'accepted') setPwaInstalled(true); setPwaPrompt(null); }} style={{ background: accent, border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{useT("install")}</button>
            <button onClick={() => setPwaPrompt(null)} style={{ background: 'none', border: 'none', color: '#484f58', fontSize: 18, cursor: 'pointer', padding: '4px', flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* LOG BOTTOM SHEET */}
        {logOpen && (
          <>
            <div onClick={() => { setLogOpen(false); setLogQuery(""); setLogResults([]); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }} />
            <div style={{ position: "fixed", bottom: isMobileDevice ? 64 : "auto", top: isMobileDevice ? "auto" : "50%", left: isMobileDevice ? 0 : "50%", right: isMobileDevice ? 0 : "auto", transform: isMobileDevice ? "none" : "translate(-50%, -50%)", width: isMobileDevice ? "auto" : 480, zIndex: 100, background: darkMode ? "#161b22" : "#fff", borderRadius: isMobileDevice ? "20px 20px 0 0" : 16, borderTop: isMobileDevice ? `2px solid ${accent}55` : "none", border: isMobileDevice ? undefined : `1px solid ${accent}44`, padding: "16px 16px 8px", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)", maxHeight: "70vh", overflowY: "auto" }}>
              {/* Handle */}
              <div style={{ width: 36, height: 4, background: "#30363d", borderRadius: 99, margin: "0 auto 16px" }} />
              {/* Type filter pills */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none", marginBottom: 10 }}>
                {[{ id: null, icon: "🔍", label: "Todos" }, ...MEDIA_TYPES.filter(t => t.id !== "all")].map(t => (
                  <button key={t.id || "all"} onClick={() => setQuickSearchType(t.id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, background: quickSearchType === t.id ? accent : (darkMode ? "#21262d" : "#f1f5f9"), border: `1px solid ${quickSearchType === t.id ? accent : "transparent"}`, color: quickSearchType === t.id ? "white" : (darkMode ? "#8b949e" : "#64748b"), cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                    <span>{t.icon}</span> {mediaLabel(t, lang) || useT("all")}
                  </button>
                ))}
              </div>
              <input ref={logInputRef} type="text" value={logQuery} onChange={e => setLogQuery(e.target.value)}
                placeholder={quickSearchType ? `Pesquisar ${MEDIA_TYPES.find(t => t.id === quickSearchType)?.label || ""}...` : "Pesquisar qualquer título..."}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: darkMode ? "#0d1117" : "#f8fafc", border: `1.5px solid ${accent}44`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
              {logSearching && <p style={{ fontSize: 12, color: "#484f58", marginTop: 10 }}>{useT("searching")}</p>}
              {!logQuery && !logSearching && (
                <p style={{ fontSize: 12, color: "#484f58", marginTop: 10, textAlign: "center" }}>{lang === "en" ? "Type to search · tap to mark as complete" : "Escreve para pesquisar · toca para marcar como completo"}</p>
              )}
              {logResults.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {logResults.map(item => (
                    <div key={item.id} onClick={() => {
                      if (findLibraryEntry(library, item.id, item.type)) updateStatus(item.id, "completo");
                      else addToLibrary(item, "completo");
                      setLogOpen(false); setLogQuery(""); setLogResults([]); setLogPendingItem(item);
                    }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: darkMode ? "#21262d" : "#f1f5f9", cursor: "pointer" }}>
                      {(item.cover || item.thumbnailUrl)
                        ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 50, borderRadius: 6, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}{item.year ? ` · ${item.year}` : ""}</p>
                      </div>
                      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        </div>

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">
          {[
            { id: "home", icon: "⌂", label: useT("home") },
            { id: "library", icon: "▤", label: useT("library") },
          ].map((n) => (
            <button key={n.id} className={`nav-btn${view === n.id ? " active" : ""}`} onClick={() => setView(n.id)} style={{ color: view === n.id ? accent : undefined }}>
              <span style={{ fontSize: 22 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {/* Botão + central flutuante */}
          <button className="nav-center-btn" onClick={() => { setLogOpen(v => !v); setView("home"); }}>
            <div style={{
              width: 52, height: 52,
              borderRadius: "50%",
              background: logOpen ? `linear-gradient(135deg, ${accent}dd, ${accent})` : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 20px ${accent}66`,
              transform: logOpen ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 28, color: "white", lineHeight: 1, fontWeight: 300, marginTop: -2 }}>+</span>
            </div>
          </button>

          <button className={`nav-btn${view === "friends" ? " active" : ""}`} onClick={() => setView("friends")} style={{ color: view === "friends" ? accent : undefined }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
              <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? accent : "#8b949e"} />
              <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? accent : "#8b949e"} opacity="0.7" />
              <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? accent : "#8b949e"} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? accent : "#8b949e"} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
            </svg>
            {useT("friends")}
          </button>
          <button className={`nav-btn${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")} style={{ color: view === "profile" ? accent : undefined }}>
            <span style={{ fontSize: 22 }}>◉</span>
            Perfil
          </button>
        </nav>
      </div>
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
