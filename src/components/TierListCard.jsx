import { useTheme } from "../contexts/ThemeContext";
import { gradientFor } from "../lib/utils";
import { TIER_LEVELS } from "../config/constants";

export function TierListCard({ tl, onOpen, onLike, liked, currentUserId, onDelete }) {
  const { accent, darkMode, panelBg } = useTheme();
  const allItems = TIER_LEVELS.flatMap(t => (tl.tiers[t.id] || []));

  // Mosaico: grupos por tier, cada grupo com até 2 capas — separados por barra colorida
  const mosaicGroups = TIER_LEVELS.map(t => ({
    tier: t,
    items: (tl.tiers[t.id] || []).slice(0, 2)
  })).filter(g => g.items.length > 0);

  return (
    <div onClick={() => onOpen(tl)} style={{ background: panelBg || (darkMode ? "rgba(22,27,34,0.35)" : "rgba(255,255,255,0.42)"), backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>

      {/* Mosaico com grupos separados por cor do tier */}
      <div style={{ display: "flex", height: 120, overflow: "hidden", background: darkMode ? "#0d1117" : "#e8e8e8", flexShrink: 0 }}>
        {mosaicGroups.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 32 }}>🏆</span>
          </div>
        ) : mosaicGroups.map((group, gIdx) => (
          <div key={group.tier.id} style={{ display: "flex", flex: group.items.length, minWidth: 0, position: "relative" }}>
            {/* Barra colorida do tier no topo */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: group.tier.color, zIndex: 2 }} />
            {/* Label do tier */}
            <div style={{ position: "absolute", top: 6, left: 4, zIndex: 3, background: group.tier.color, borderRadius: 3, padding: "1px 4px" }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: "white", lineHeight: 1 }}>{group.tier.id}</span>
            </div>
            {/* Capas do grupo */}
            {group.items.map((item, iIdx) => {
              const cover = item.customCover || item.cover || item.thumbnailUrl;
              return (
                <div key={item.id} style={{ flex: 1, minWidth: 0, overflow: "hidden", background: gradientFor(item.id), borderLeft: (gIdx > 0 && iIdx === 0) ? `2px solid ${darkMode ? "#0d1117" : "#e0e0e0"}` : "none" }}>
                  {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div style={{ padding: "8px 12px 11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0d1117", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 175 }}>{tl.title}</p>
          <span style={{ fontSize: 10, color: "#6e7681" }}>{allItems.length} itens · {new Date(tl.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onLike && onLike(tl.id); }} style={{ display: "flex", alignItems: "center", gap: 3, background: liked ? `${accent}22` : "transparent", border: `1px solid ${liked ? accent : (darkMode ? "#30363d" : "#ddd")}`, borderRadius: 20, padding: "3px 9px", color: liked ? accent : "#6e7681", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}>
            ♥ {tl.likes_count || 0}
          </button>
          {currentUserId === tl.user_id && onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(tl.id); }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 13, padding: "2px 3px", lineHeight: 1 }}>🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}
