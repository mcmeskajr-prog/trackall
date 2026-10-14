import { useState } from "react";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { StarRating } from "./StarRating";
import { gradientFor } from "../lib/utils";
import { t } from "../translations";
import { useLang } from "../contexts/LangContext";
import { useTheme } from "../contexts/ThemeContext";
import { TypeIcon } from "./TypeIcon";

export function RatingOverlay({ item, library, onDone }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [rating, setRating] = useState(0);
  const textColor = (() => {
    const r=parseInt(accent.slice(1,3),16)/255, g=parseInt(accent.slice(3,5),16)/255, b=parseInt(accent.slice(5,7),16)/255;
    return 0.2126*r+0.7152*g+0.0722*b > 0.45 ? "#111" : "#fff";
  })();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => onDone(0)}>
      <div onClick={e => e.stopPropagation()} style={{ background: darkMode ? `radial-gradient(circle at 85% 0%, ${accent}1f, transparent 45%), #0e1014` : "#ffffff", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, borderRadius: 24, padding: 24, width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, textAlign: "left" }}>
          {(item.cover || item.thumbnailUrl)
            ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0, boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }} />
            : <div style={{ width: 48, height: 68, borderRadius: 8, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}><TypeIcon id={item.type} /></div>
          }
          <div>
            <div style={{ display: "inline-block", fontSize: 11, color: "#34d399", fontWeight: 700, marginBottom: 6, padding: "3px 10px", borderRadius: 99, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>✓ {lang === "en" ? "Marked as complete" : "Marcado como completo"}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0f172a", lineHeight: 1.2 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}</div>
          </div>
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b949e", marginBottom: 8 }}>{lang === "en" ? "Want to rate it?" : "Queres dar uma avaliação?"}</p>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, paddingTop: 34 }}>
            <StarRating value={rating} onChange={setRating} size={isMobileDevice ? 22 : 26} />
          </div>
          {rating > 0 && (
            <button onClick={() => onDone(rating)} style={{ width: "100%", padding: "13px 0", borderRadius: 14, background: accent, border: "none", color: textColor, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 8px 24px ${accent}55` }}>
              {lang === "en" ? "Confirm" : "Confirmar"} ★ {rating}
            </button>
          )}
        </div>
        <button onClick={() => onDone(0)} style={{ width: "100%", padding: "11px", borderRadius: 14, background: "transparent", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
          {lang === "en" ? "Skip rating" : "Saltar avaliação"}
        </button>
      </div>
    </div>
  );
}
