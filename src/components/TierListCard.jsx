import { useTheme } from "../contexts/ThemeContext";
import { gradientFor } from "../lib/utils";
import { TIER_LEVELS } from "../config/constants";

// Cartão da galeria: mosaico com os melhores itens + título, autor, itens e gostos
export function TierListCard({ tl, onOpen, onLike, liked, currentUserId, onDelete }) {
  const { accent, darkMode, panelBg } = useTheme();
  const all = TIER_LEVELS.flatMap(t => (tl.tiers[t.id] || []).map(i => ({ ...i, _tier: t })));
  const MAX = 12;
  const top = all.slice(0, MAX); // já vêm ordenados do melhor tier para o pior
  const extra = all.length - top.length;
  const author = tl.profiles ? (tl.profiles.username || tl.profiles.name) : null;
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const border = darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0";

  return (
    <div onClick={() => onOpen(tl)} style={{ background: panelBg || glass, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: `1px solid ${border}`, borderRadius: 20, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", transition: "transform 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = `${accent}88`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = border; }}>
      <style>{`
        .tlc-p { transition: transform .16s ease, box-shadow .16s ease, filter .16s ease; }
        @media (hover:hover) { .tlc-wrap:hover .tlc-p:not(:hover) { filter: brightness(.65); } .tlc-p:hover { transform: translateY(-4px) scale(1.08); z-index: 2; box-shadow: 0 10px 22px rgba(0,0,0,.55); } }
      `}</style>
      <div className="tlc-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 12, maxHeight: 2 * 100 + 6 + 24, overflow: "hidden", background: darkMode ? "rgba(0,0,0,0.25)" : "#eef1f5", alignContent: "flex-start" }}>
        {top.length === 0 ? (
          <div style={{ flex: 1, height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🏆</div>
        ) : top.map(item => {
          const cover = item.customCover || item.cover || item.thumbnailUrl;
          return (
            <div key={item.id} className="tlc-p" title={item.title} style={{ position: "relative", width: 66, height: 100, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: gradientFor(item.id), boxShadow: `0 0 0 1.5px ${item._tier.color}66` }}>
              {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
              <span style={{ position: "absolute", left: 4, top: 4, padding: "0 6px", borderRadius: 6, background: item._tier.color, fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: "16px" }}>{item._tier.id}</span>
            </div>
          );
        })}
        {extra > 0 && <div style={{ width: 66, height: 100, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px dashed ${darkMode ? "rgba(255,255,255,0.2)" : "#cbd5e1"}`, color: darkMode ? "#aab4c0" : "#64748b", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>+{extra}</div>}
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, color: darkMode ? "#e6edf3" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tl.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: darkMode ? "#8b949e" : "#64748b" }}>
          {author && <><span style={{ width: 18, height: 18, borderRadius: 99, background: `linear-gradient(135deg, ${accent}, #3a1212)`, flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{author}</span><span>·</span></>}
          <span style={{ whiteSpace: "nowrap" }}>{all.length} itens</span>
          <span style={{ flex: 1 }} />
          <button onClick={e => { e.stopPropagation(); onLike && onLike(tl.id); }} style={{ display: "flex", alignItems: "center", gap: 4, background: liked ? `${accent}22` : "transparent", border: `1px solid ${liked ? accent : border}`, borderRadius: 99, padding: "3px 9px", color: liked ? accent : (darkMode ? "#8b949e" : "#64748b"), cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
            {liked ? "♥" : "♡"} {tl.likes_count || 0}
          </button>
          {currentUserId === tl.user_id && onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(tl.id); }} title="Apagar" aria-label="Apagar" style={{ background: "none", border: "none", color: "#6e7681", cursor: "pointer", fontSize: 13, padding: "2px 3px", lineHeight: 1 }}>🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}
