import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { CoverImg } from "./CoverImg";
import { Sakura } from "./Sakura";

const DAY = 86400000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

// «Diário recente» (layout novo do PC): os últimos itens completados, com o dia, a capa, o título, o tipo e a nota.
// `count` é decidido pelo perfil (depende de quantas filas de Favoritos estão à vista), para a coluna da direita acompanhar a da esquerda.
export function DiaryRecent({ items, count = 5, onOpen, onSeeAll, panelStyle = null }) {
  const { accent, darkMode: pageDark, panelDark, panelBg } = useTheme();
  const darkMode = panelDark ?? pageDark;
  const { lang } = useLang();
  const en = lang === "en";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)";

  const list = useMemo(() => (items || []).filter(i => i?.userStatus === "completo" && i.addedAt).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, count), [items, count]);
  if (!list.length) return null;

  const today = startOfDay(Date.now());
  const dayLabel = (t) => {
    const diff = Math.round((today - startOfDay(t)) / DAY);
    if (diff <= 0) return en ? "Today" : "Hoje";
    if (diff === 1) return en ? "Yesterday" : "Ontem";
    return new Date(t).toLocaleDateString(en ? "en-GB" : "pt-PT", { day: "numeric", month: "short" }).replace(".", "");
  };

  return (
    <div style={{ borderRadius: 16, padding: 18, boxSizing: "border-box", color: text, background: panelBg ? panelBg : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)"), border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`, ...(panelStyle || {}) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#8b95a1" : "#64748b", margin: 0 }}>{en ? "Recent diary" : "Diário recente"}</h3>
        {onSeeAll && <button type="button" onClick={onSeeAll} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, color: accent }}>{en ? "See diary →" : "Ver diário →"}</button>}
      </div>
      {list.map((it, idx) => {
        const typeDef = MEDIA_TYPES.find(t => t.id === it.type);
        return (
          <div key={it.id} onClick={() => onOpen && onOpen(it)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: idx ? `1px solid ${line}` : "none", cursor: "pointer", minWidth: 0 }}>
            <div style={{ width: 46, flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: sub, whiteSpace: "nowrap" }}>{dayLabel(it.addedAt)}</div>
            <div style={{ width: 30, height: 44, borderRadius: 6, overflow: "hidden", position: "relative", flexShrink: 0, background: gradientFor(it.id) }}>
              {(it.customCover || it.cover) && <CoverImg hi src={it.customCover || it.cover} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</div>
              <div style={{ fontSize: 11.5, color: sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeDef ? mediaLabel(typeDef, lang) : ""}</div>
            </div>
            {it.userRating > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px 2px 6px", borderRadius: 99, flexShrink: 0, background: "rgba(244,114,182,0.14)", border: "1px solid rgba(244,114,182,0.4)", color: "#fbcfe8", fontSize: 11.5, fontWeight: 800 }}>
                <Sakura size={11} />{it.userRating}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
