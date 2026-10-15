import { useState } from "react";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES } from "../config/constants";
import { TypeIcon } from "./TypeIcon";
import { CoverImg } from "./CoverImg";

export function ProfileTabCompletos({ items, library, accent, darkMode, isMobileDevice, lang, onOpen }) {
  const completados = items.filter(i => i.userStatus === "completo").sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortMode, setSortMode] = useState("date");
  const filtered = completados
    .filter(i => typeFilter === "all" || i.type === typeFilter)
    .sort((a,b) => sortMode === "rating" ? (b.userRating||0)-(a.userRating||0) : sortMode === "title" ? (a.title||"").localeCompare(b.title||"") : (b.addedAt||0)-(a.addedAt||0));
  return (
    <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: "#484f58" }}>{completados.length} {lang === "en" ? "completed" : "completos"}</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[{id:"date",label:lang==="en"?"Date":"Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★"}].map(s => (
            <button key={s.id} onClick={() => setSortMode(s.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${sortMode===s.id?accent:"#30363d"}`, background: sortMode===s.id?`${accent}22`:"transparent", color: sortMode===s.id?accent:"#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 16 }}>
        {[{id:"all",label:lang==="en"?"All":"Todos"}, ...MEDIA_TYPES.slice(1).filter(t => completados.some(i => i.type === t.id))].map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${typeFilter===t.id?accent:"#30363d"}`, background: typeFilter===t.id?`${accent}22`:"transparent", color: typeFilter===t.id?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
            <TypeIcon id={t.id} /> {t.labelEn ? (lang==="en"?t.labelEn:t.label) : t.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#484f58" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p>{lang === "en" ? "No completed items yet" : "Ainda sem itens completos"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
          {filtered.map(item => {
            const cover = item.customCover || item.cover || item.thumbnailUrl;
            return (
              <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{ cursor: "pointer" }}>
                <div className="ec-card" style={{ aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), position: "relative" }}>
                  {cover && <CoverImg src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                  {item.userRating > 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.85)", borderRadius: 5, padding: "1px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 800 }}>★{item.userRating}</div>}
                </div>
                <p style={{ fontSize: 10, color: "#8b949e", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
