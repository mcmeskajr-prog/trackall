import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, TYPE_COLORS, mediaLabel } from "../config/constants";

// ─── Escolher item em destaque (Fase 1) ───
// Portal para o body: o ProfileView vive dentro de um ancestral com transform,
// onde position:fixed ficaria preso (ver DEV_GUIDE).
export function FeaturedPickerModal({ items, currentId, onSelect, onClear, onClose }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter(i => (type === "all" || i.type === type) && (!q || (i.title || "").toLowerCase().includes(q)))
      .sort((a, b) => ((b.userRating || 0) - (a.userRating || 0)) || ((a.title || "").localeCompare(b.title || "")))
      .slice(0, 120);
  }, [items, query, type]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const border = darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.15)";

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 170, background: "rgba(5,8,12,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 14, padding: 22, borderRadius: 24, background: darkMode ? "#11161d" : "#ffffff", border: `1px solid ${border}`, boxShadow: "0 40px 80px -20px rgba(0,0,0,0.9)", color: text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{lang === "en" ? "Choose featured item" : "Escolher item em destaque"}</div>
            <div style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>{lang === "en" ? "It will show on your profile card." : "Vai aparecer no teu cartão de perfil."}</div>
          </div>
          <button onClick={onClose} aria-label={lang === "en" ? "Close" : "Fechar"} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer", fontSize: 20, fontFamily: "inherit" }}>×</button>
        </div>

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={lang === "en" ? "Search your library..." : "Procurar na tua biblioteca..."} style={{ height: 44, borderRadius: 12, padding: "0 14px", fontSize: 14, boxSizing: "border-box" }} />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MEDIA_TYPES.map(t => {
            const on = type === t.id;
            return (
              <button key={t.id} onClick={() => setType(t.id)} style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${border}`, background: on ? accent : "transparent", color: on ? "white" : text, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
                {t.id === "all" ? (lang === "en" ? "All" : "Tudo") : mediaLabel(t, lang)}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 12, alignContent: "start", padding: 4 }}>
          {list.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32, color: darkMode ? "#8b949e" : "#64748b", fontSize: 13 }}>{lang === "en" ? "No items found." : "Nenhum item encontrado."}</div>
          )}
          {list.map(item => {
            const selected = item.id === currentId;
            const cover = item.customCover || item.cover;
            return (
              <button key={item.id} onClick={() => onSelect(item)} aria-label={item.title} style={{ position: "relative", aspectRatio: "2/3", padding: 0, border: "none", borderRadius: 12, overflow: "hidden", cursor: "pointer", background: gradientFor(item.id), outline: selected ? `3px solid ${accent}` : "none", outlineOffset: 2 }}>
                {cover
                  ? <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: 8, fontSize: 11, fontWeight: 700, color: "white", textAlign: "left", lineHeight: 1.2 }}>{item.title}</span>}
                {item.userRating > 0 && <span style={{ position: "absolute", top: 6, right: 6, padding: "2px 6px", borderRadius: 7, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 10, fontWeight: 800 }}>★ {item.userRating}</span>}
                <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: TYPE_COLORS[item.type] || accent }} />
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={onClear} style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: darkMode ? "#8b949e" : "#64748b", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
            {lang === "en" ? "Use my top-rated item" : "Usar o meu mais bem avaliado"}
          </button>
          <button onClick={onClose} style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}>
            {lang === "en" ? "Cancel" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
