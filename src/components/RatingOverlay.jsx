import { Component, useState } from "react";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { StarRating } from "./StarRating";
import { gradientFor } from "../lib/utils";
import { useLang } from "../contexts/LangContext";
import { useTheme } from "../contexts/ThemeContext";
import { TypeIcon } from "./TypeIcon";

function RatingOverlayInner({ item, library, onDone, again = false, revCount = 0, isFavorite = false, isHallOfFame = false, canHallOfFame = true }) {
  const { accent: _acc, darkMode, isMobileDevice } = useTheme();
  const accent = /^#[0-9a-f]{6}$/i.test(_acc || "") ? _acc : "#6366f1";

  const { lang } = useLang();
  const [rating, setRating] = useState(0);
  const [when, setWhen] = useState("today"); // today | yesterday | custom | none
  const [customAt, setCustomAt] = useState(() => Date.now());
  const [fav, setFav] = useState(false);
  const [hof, setHof] = useState(false);
  const en = lang === "en";
  const DAYMS = 86400000;
  const isoOf = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const atValue = () => when === "none" ? null : when === "yesterday" ? Date.now() - DAYMS : when === "custom" ? customAt : Date.now();
  const line = darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const chip = (on, label, onClick) => (
    <button type="button" onClick={onClick} style={{ padding: "7px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
      border: `1px solid ${on ? accent : line}`, background: on ? `${accent}26` : "transparent", color: on ? accent : (darkMode ? "#c3ccd6" : "#475569") }}>{label}</button>
  );
  const lab = (t) => <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b949e", margin: "16px 0 8px", textAlign: "left" }}>{t}</p>;
  const textColor = (() => {
    const r=parseInt(accent.slice(1,3),16)/255, g=parseInt(accent.slice(3,5),16)/255, b=parseInt(accent.slice(5,7),16)/255;
    return 0.2126*r+0.7152*g+0.0722*b > 0.45 ? "#111" : "#fff";
  })();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => onDone(0, null)}>
      <div onClick={e => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto", background: darkMode ? `radial-gradient(circle at 85% 0%, ${accent}1f, transparent 45%), #0e1014` : "#ffffff", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, borderRadius: 24, padding: 24, width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, textAlign: "left" }}>
          {(item.cover || item.thumbnailUrl)
            ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0, boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }} />
            : <div style={{ width: 48, height: 68, borderRadius: 8, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}><TypeIcon id={item.type} /></div>
          }
          <div>
            <div style={{ display: "inline-block", fontSize: 11, color: "#34d399", fontWeight: 700, marginBottom: 6, padding: "3px 10px", borderRadius: 99, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>✓ {again ? (en ? "Complete again" : "Completar outra vez") : (en ? "Marked as complete" : "Marcado como completo")}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0f172a", lineHeight: 1.2 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}</div>
          </div>
        </div>
        {again && <div style={{ padding: "10px 12px", borderRadius: 14, border: `1px solid ${line}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#f8fafc", fontSize: 12.5, color: "#8b949e", lineHeight: 1.5, textAlign: "left", marginBottom: 4 }}>
          ↺ {en ? `You already completed this${revCount ? ` (+${revCount} again)` : ""}. This adds a new line to your Diary and keeps the previous one.` : `Já completaste este título${revCount ? ` (+${revCount} ${revCount === 1 ? "vez" : "vezes"})` : ""}. Isto acrescenta uma nova linha ao Diário e mantém a anterior.`}
        </div>}
        {lab(en ? "Rating" : "Avaliação")}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 6, paddingBottom: 4 }}>
          <StarRating value={rating} onChange={setRating} size={isMobileDevice ? 22 : 26} />
        </div>
        {lab(en ? "When" : "Quando")}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {chip(when === "today", en ? "Today" : "Hoje", () => setWhen("today"))}
          {chip(when === "yesterday", en ? "Yesterday" : "Ontem", () => setWhen("yesterday"))}
          <input type="date" value={isoOf(customAt)} max={isoOf(Date.now())}
            onChange={(e) => { const [y, m, d] = e.target.value.split("-").map(Number); if (y && m && d) { setCustomAt(new Date(y, m - 1, d, 12).getTime()); setWhen("custom"); } }}
            style={{ padding: "6px 8px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, colorScheme: darkMode ? "dark" : "light", background: "transparent", color: darkMode ? "#e6edf3" : "#0f172a", border: `1px solid ${when === "custom" ? accent : line}` }} />
          {!again && chip(when === "none", en ? "No date" : "Sem data", () => setWhen("none"))}
        </div>
        {(!isFavorite || (!isHallOfFame && canHallOfFame)) && <>
          {lab(en ? "Highlight" : "Destacar")}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!isFavorite && !isHallOfFame && chip(fav, `♥ ${en ? "Favorite" : "Favorito"}`, () => { setFav(v => !v); setHof(false); })}
            {!isHallOfFame && canHallOfFame && chip(hof, `🌸 Hall of Fame`, () => { setHof(v => !v); setFav(false); })}
          </div>
        </>}
        <button onClick={() => onDone(rating, { at: atValue(), favorite: fav, hof })} style={{ width: "100%", marginTop: 20, padding: "13px 0", borderRadius: 14, background: accent, border: "none", color: textColor, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
          {again ? (en ? "Save" : "Guardar revisão") : (en ? "Save" : "Guardar")}{rating > 0 ? ` · ★ ${rating}` : ""}
        </button>
        <button onClick={() => onDone(0, null)} style={{ width: "100%", marginTop: 8, padding: "11px", borderRadius: 14, background: "transparent", border: `1px solid ${line}`, color: "#8b949e", cursor: "pointer", fontWeight: 700, fontSize: 13.5, fontFamily: "inherit" }}>
          {again ? (en ? "Cancel" : "Cancelar") : (en ? "Skip" : "Saltar")}
        </button>
      </div>
    </div>
  );
}

// Se algo falhar a desenhar o painel, nunca deixa a app em branco: fecha-o e segue (o título já ficou completo).
class RatingBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("RatingOverlay:", err); try { this.props.onDone(0, null); } catch { /* noop */ } }
  render() { return this.state.failed ? null : this.props.children; }
}

export function RatingOverlay(props) {
  return <RatingBoundary onDone={props.onDone}><RatingOverlayInner {...props} /></RatingBoundary>;
}
