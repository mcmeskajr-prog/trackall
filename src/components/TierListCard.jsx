import { useTheme } from "../contexts/ThemeContext";
import { gradientFor } from "../lib/utils";
import { TIER_LEVELS } from "../config/constants";

// Cartão da galeria: mosaico com os melhores itens + título, autor, itens e gostos
export function TierListCard({ tl, onOpen, onLike, liked, currentUserId, onDelete }) {
  const { accent, darkMode, panelBg } = useTheme();
  const all = TIER_LEVELS.flatMap(t => (tl.tiers[t.id] || []).map(i => ({ ...i, _tier: t })));
  const top = all.slice(0, 4); // já vêm ordenados do melhor tier para o pior
  const author = tl.profiles ? (tl.profiles.username || tl.profiles.name) : null;
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const border = darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0";

  return (
    <div onClick={() => onOpen(tl)} style={{ background: panelBg || glass, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: `1px solid ${border}`, borderRadius: 20, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", transition: "transform 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = `${accent}88`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = border; }}>
      <div style={{ display: "flex", gap: 2, height: 140, background: darkMode ? "#0d1117" : "#e8e8e8" }}>
        {top.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🏆</div>
        ) : top.map(item => {
          const cover = item.customCover || item.cover || item.thumbnailUrl;
          return (
            <div key={item.id} style={{ flex: 1, minWidth: 0, position: "relative", background: gradientFor(item.id) }}>
              {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
              <span style={{ position: "absolute", left: 6, top: 6, padding: "1px 7px", borderRadius: 7, background: item._tier.color, fontSize: 11, fontWeight: 800, color: "#fff" }}>{item._tier.id}</span>
            </div>
          );
        })}
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
