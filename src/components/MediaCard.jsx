import { useState, memo } from "react";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, STATUS_OPTIONS, mediaLabel, statusLabel } from "../config/constants";

export const MediaCard = memo(function MediaCard({ item, library, onOpen, accent }) {
  const { lang, useT } = useLang();
  const libItem = findLibraryEntry(library, item.id, item.type)?.item;
  const inLib = !!libItem;
  const coverSrc = libItem?.customCover || libItem?.cover || libItem?.thumbnailUrl || item.cover || item.thumbnailUrl;
  const status = STATUS_OPTIONS.find((s) => s.id === libItem?.userStatus);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleError = (e) => {
    if (item.coverFallback && e.currentTarget.src !== item.coverFallback) {
      e.currentTarget.src = item.coverFallback;
    } else {
      setImgError(true);
    }
  };

  return (
    <div className="card" onClick={() => onOpen(item)} style={{ cursor: "pointer" }}>
      <div className="media-thumb" style={{ width: "100%", aspectRatio: "2/3", background: gradientFor(item.id) }}>
        {coverSrc && !imgError ? (
          <img
            src={coverSrc}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={handleError}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 1, display: "block" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center", gap: 6 }}>
            <span style={{ fontSize: 28 }}>{MEDIA_TYPES.find((t) => t.id === item.type)?.icon}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, lineHeight: 1.3 }}>{(item.title || "Sem título").slice(0, 40)}</span>
          </div>
        )}
        {/* Badges — status + score sem ícone de tipo */}
        <div style={{ position: "absolute", top: 6, left: 6, right: 6, display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: 3 }}>
          {!inLib && item.score && (
            <span style={{ background: "rgba(0,0,0,0.75)", borderRadius: 6, padding: "2px 6px", fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>
              ★ {item.score}
            </span>
          )}
          {status && status.id !== "completo" && (
            <span style={{ background: `${status.color}cc`, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "white" }}>
              {status.emoji}
            </span>
          )}
        </div>
        {/* Hover rating overlay — desktop rico */}
        <div className="rating-hover no-tc">
          <div style={{ textAlign: "center", padding: "0 8px", width: "100%" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6, opacity: 0.9 }}>{item.title}</p>
            {libItem?.userRating > 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 16, color: "#f59e0b" }}>★</span>
                <span style={{ fontSize: 18, color: "#f59e0b", fontWeight: 900 }}>{libItem.userRating}</span>
              </div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>★ sem nota</span>
              </div>
            )}
            {status && (
              <span style={{ fontSize: 10, background: `${status.color}cc`, color: "white", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                {status.emoji} {statusLabel(status, lang)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="card-info" style={{ padding: "6px 8px 8px" }}>
        <p className="card-info-title card-title-text" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
        <p className="card-info-meta" style={{ fontSize: 11, color: "#484f58" }}>
          {MEDIA_TYPES.find((t) => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}{item.year ? ` · ${item.year}` : ""}
        </p>
        {libItem?.lastChapter && libItem?.userStatus === 'assistindo' && (
          <p style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📖 {libItem.lastChapter}
          </p>
        )}
        {!inLib && (
          <div style={{ marginTop: 8, padding: "5px 0", borderTop: "1px solid #21262d", fontSize: 11, color: accent, fontWeight: 600 }}>+ Adicionar</div>
        )}
      </div>
    </div>
  );
}); // end memo(MediaCard)
