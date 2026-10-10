import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MediaCard } from "./MediaCard";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES } from "../config/constants";

export function RecoCarousel({ title, icon, items, library, onOpen, loading, isPersonal }) {
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

// parsePaperbackBackup — ver lib/importParsers.js
// parseLetterboxdCSV — ver lib/importParsers.js
// PaperbackImportModal — ver components/PaperbackImportModal.jsx
// LetterboxdImportModal — ver components/LetterboxdImportModal.jsx
