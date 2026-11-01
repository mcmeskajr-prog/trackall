import { useState } from "react";
import { StarRating } from "./StarRating";
import { dayStamp, revisionsOf } from "../lib/revisions";

const DAY = 86400000;
const iso = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fromIso = (v) => { const [y, m, d] = String(v).split("-").map(Number); return y && m && d ? dayStamp(y, m - 1, d) : null; };

// Registo rápido de um título completo: data de conclusão + «Completar outra vez» (revisões no Diário)
export function CompletedPanel({ libItem, accent, darkMode, lang, onUpdateDate, onRewatch }) {
  const en = lang === "en";
  const [editDate, setEditDate] = useState(false);
  const [again, setAgain] = useState(false);
  const [at, setAt] = useState(() => Date.now());
  const [rating, setRating] = useState(0);
  const revs = revisionsOf(libItem);
  const fmt = (ts) => new Date(ts).toLocaleDateString(en ? "en-GB" : "pt-PT", { day: "numeric", month: "short", year: "numeric" });
  const muted = "#8b949e";
  const line = darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const chip = (on, label, onClick) => (
    <button type="button" onClick={onClick} style={{ padding: "6px 12px", borderRadius: 999, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
      border: `1px solid ${on ? accent : line}`, background: on ? `${accent}26` : "transparent", color: on ? accent : (darkMode ? "#c3ccd6" : "#475569") }}>{label}</button>
  );
  const dateInput = (value, onChange) => (
    <input type="date" value={value} max={iso(Date.now())} onChange={(e) => { const t = fromIso(e.target.value); if (t) onChange(t); }}
      style={{ padding: "5px 8px", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 700, colorScheme: darkMode ? "dark" : "light", background: "transparent", color: darkMode ? "#e6edf3" : "#0f172a", border: `1px solid ${line}` }} />
  );
  const today = iso(Date.now()), yest = iso(Date.now() - DAY);
  const cur = libItem.addedAt ? iso(libItem.addedAt) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setEditDate(v => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: muted, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>{libItem.addedAt ? (en ? "Completed on " : "Completo em ") : ""}<b style={{ color: darkMode ? "#e6edf3" : "#0f172a" }}>{libItem.addedAt ? fmt(libItem.addedAt) : (en ? "No date" : "Sem data")}</b></span>
          <span aria-hidden="true">✎</span>
        </button>
        <button type="button" onClick={() => { setAgain(v => !v); setAt(Date.now()); setRating(libItem.userRating || 0); }}
          style={{ padding: "6px 12px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", border: `1.5px solid ${accent}`, background: again ? `${accent}26` : `${accent}12`, color: accent }}>
          ↺ {en ? "Complete again" : "Completar outra vez"}{revs.length > 0 ? ` · ${revs.length}×` : ""}
        </button>
      </div>

      {editDate && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {chip(cur === today, en ? "Today" : "Hoje", () => onUpdateDate && onUpdateDate(libItem.id, Date.now()))}
          {chip(cur === yest, en ? "Yesterday" : "Ontem", () => onUpdateDate && onUpdateDate(libItem.id, Date.now() - DAY))}
          {dateInput(cur, (t) => onUpdateDate && onUpdateDate(libItem.id, t))}
          {chip(!libItem.addedAt, en ? "No date" : "Sem data", () => onUpdateDate && onUpdateDate(libItem.id, null))}
        </div>
      )}

      {again && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px", borderRadius: 14, border: `1px solid ${line}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#f8fafc" }}>
          <div style={{ fontSize: 12, color: muted, lineHeight: 1.45 }}>
            {en ? "Adds a new line to your Diary without erasing the previous one." : "Acrescenta uma nova linha ao Diário sem apagar a anterior."}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {chip(iso(at) === today, en ? "Today" : "Hoje", () => setAt(Date.now()))}
            {chip(iso(at) === yest, en ? "Yesterday" : "Ontem", () => setAt(Date.now() - DAY))}
            {dateInput(iso(at), setAt)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: muted }}>{en ? "Rating this time" : "Nota desta vez"}</span>
            <StarRating value={rating} onChange={setRating} size={17} />
          </div>
          <button type="button" onClick={() => { onRewatch && onRewatch(libItem.id, { at, rating }); setAgain(false); }}
            style={{ height: 40, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, background: accent, color: "white" }}>
            {en ? "Save" : "Guardar revisão"}
          </button>
        </div>
      )}
    </div>
  );
}
