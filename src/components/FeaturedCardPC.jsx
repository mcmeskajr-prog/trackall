import { useMemo, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor, hiRes } from "../lib/utils";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { TypeIcon } from "./TypeIcon";
import { Sakura } from "./Sakura";

const NOTE_MAX = 140;

// Cartão «Em destaque» (layout novo do PC): capa em poster com a nota (flor), título, estado e uma frase opcional.
// Só o dono vê o lápis para editar a frase; os visitantes só veem o texto.
export function FeaturedCardPC({ featuredItem, library, items, onOpen, onPickFeatured, onSaveNote, readOnly = false }) {
  const { accent, darkMode: pageDark, panelDark, panelBg } = useTheme();
  const darkMode = panelDark ?? pageDark;
  const { lang } = useLang();
  const en = lang === "en";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const line = darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.14)";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const featured = useMemo(() => {
    if (featuredItem) {
      const lib = findLibraryEntry(library, featuredItem.id, featuredItem.type)?.item;
      return { ...featuredItem, ...(lib || {}), userRating: lib?.userRating ?? featuredItem.userRating ?? 0, note: featuredItem.note || "" };
    }
    const rated = (items || []).filter(i => i.userRating > 0);
    if (!rated.length) return null;
    return { ...[...rated].sort((a, b) => (b.userRating - a.userRating) || ((b.addedAt || 0) - (a.addedAt || 0)))[0], note: "", _auto: true };
  }, [featuredItem, items, library]);

  const shell = {
    borderRadius: 18, padding: 22, boxSizing: "border-box", color: text,
    background: panelBg ? panelBg : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)"),
    border: `1px solid ${accent}44`, boxShadow: `0 0 26px -12px ${accent}77`,
  };
  const eyebrow = { fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#8b95a1" : "#64748b" };
  const head = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={eyebrow}>{en ? "Featured" : "Em destaque"}</div>
      {!readOnly && onPickFeatured && (
        <button type="button" onClick={onPickFeatured} style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: 0 }}>{en ? "Change" : "Trocar"}</button>
      )}
    </div>
  );

  if (!featured) {
    return (
      <div style={shell}>
        {head}
        <button type="button" onClick={onPickFeatured || undefined} style={{ width: "100%", minHeight: 120, borderRadius: 14, cursor: onPickFeatured ? "pointer" : "default", fontFamily: "inherit", fontSize: 13, color: sub, background: "transparent", border: `1.5px dashed ${line}` }}>
          {en ? "+ Choose your featured item" : "+ Escolhe o teu item em destaque"}
        </button>
      </div>
    );
  }

  const typeDef = MEDIA_TYPES.find(t => t.id === featured.type);
  const coverSrc = featured.customCover || featured.cover;
  const status = featured.userStatus === "completo" ? (en ? "Completed" : "Completo") : featured.userStatus === "assistindo" ? (en ? "In progress" : "Em curso") : "";
  const when = featured.userStatus === "completo" && featured.addedAt ? new Date(featured.addedAt).toLocaleDateString(en ? "en-GB" : "pt-PT", { month: "short", year: "numeric" }) : "";
  const canEditNote = !readOnly && !featured._auto && onSaveNote;
  const chip = { padding: "4px 12px", borderRadius: 99, fontSize: 12.5, fontWeight: 700, color: sub, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)", border: `1px solid ${line}` };

  const save = () => { onSaveNote(draft.trim().slice(0, NOTE_MAX)); setEditing(false); };

  return (
    <div style={shell}>
      {head}
      <div style={{ display: "flex", gap: 18 }}>
        <div onClick={() => onOpen && onOpen(featured)} style={{ position: "relative", width: 128, aspectRatio: "2/3", borderRadius: 13, overflow: "hidden", flexShrink: 0, cursor: "pointer", background: gradientFor(featured.id), boxShadow: "0 14px 26px -14px rgba(0,0,0,0.8)" }}>
          {coverSrc
            ? <img src={hiRes(coverSrc)} alt={featured.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { if (e.currentTarget.src !== coverSrc && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = coverSrc; } else { e.currentTarget.style.display = "none"; } }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}><TypeIcon id={typeDef?.id} /></div>}
          {featured.userRating > 0 && (
            <div style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px 3px 6px", borderRadius: 8, background: "rgba(0,0,0,0.6)", color: "#fbcfe8", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><Sakura size={12} />{featured.userRating}</div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div onClick={() => onOpen && onOpen(featured)} style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, cursor: "pointer", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{featured.title}</div>
          <div style={{ fontSize: 13, color: sub, margin: "5px 0 12px" }}>{typeDef ? mediaLabel(typeDef, lang) : ""}{featured.year ? ` · ${featured.year}` : ""}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {status && <span style={chip}>{status}</span>}
            {when && <span style={chip}>{when}</span>}
          </div>
        </div>
      </div>

      {(featured.note || canEditNote) && (
        <div style={{ position: "relative", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${line}` }}>
          {editing ? (
            <>
              <textarea autoFocus value={draft} maxLength={NOTE_MAX} onChange={e => setDraft(e.target.value)} rows={3}
                placeholder={en ? "A short phrase about why it stands out…" : "Uma frase curta sobre porque se destaca…"}
                style={{ width: "100%", boxSizing: "border-box", resize: "none", fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, color: text, background: darkMode ? "rgba(0,0,0,0.25)" : "#fff", border: `1px solid ${accent}88`, outline: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 11.5, color: sub, flex: 1 }}>{draft.length}/{NOTE_MAX}</span>
                <button type="button" onClick={() => setEditing(false)} style={{ padding: "6px 12px", borderRadius: 9, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sub, background: "transparent", border: `1px solid ${line}`, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
                <button type="button" onClick={save} style={{ padding: "6px 14px", borderRadius: 9, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#fff", background: accent, border: "none", cursor: "pointer" }}>{en ? "Save" : "Guardar"}</button>
              </div>
            </>
          ) : (
            <>
              {featured.note
                ? <div style={{ fontSize: 14.5, lineHeight: 1.55, fontStyle: "italic", color: darkMode ? "#d4dbe3" : "#334155", paddingRight: canEditNote ? 36 : 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>«{featured.note}»</div>
                : <button type="button" onClick={() => { setDraft(""); setEditing(true); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: sub }}>{en ? "+ Add a phrase" : "+ Adicionar uma frase"}</button>}
              {canEditNote && featured.note && (
                <button type="button" onClick={() => { setDraft(featured.note); setEditing(true); }} aria-label={en ? "Edit phrase" : "Editar frase"} title={en ? "Edit phrase" : "Editar frase"}
                  style={{ position: "absolute", right: 0, top: 12, width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: sub, background: "transparent", border: `1px solid ${line}`, padding: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
