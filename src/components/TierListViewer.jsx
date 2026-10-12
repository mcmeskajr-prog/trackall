import { createPortal } from "react-dom";
import { TIER_LEVELS } from "../config/constants";
import { gradientFor } from "../lib/utils";
import { useTheme } from "../contexts/ThemeContext";

export function TierListViewer({ tl, onClose, onLike, liked, currentUserId, onEdit, onOpenItem }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in modal-glass" style={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", flex: 1, marginRight: 12 }}>{tl.title}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
          {tl.profiles && <p style={{ fontSize: 12, color: "#484f58", marginBottom: 12 }}>por @{tl.profiles.username || tl.profiles.name}</p>}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => onLike && onLike(tl.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: liked ? `${accent}22` : "none", border: `1px solid ${liked ? accent : "#30363d"}`, borderRadius: 20, padding: "6px 16px", color: liked ? accent : "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              ♥ {tl.likes_count || 0} gostos
            </button>
            {currentUserId === tl.user_id && onEdit && (
              <button onClick={() => { onClose(); onEdit(tl); }} style={{ background: "none", border: "1px solid #30363d", borderRadius: 20, padding: "6px 16px", color: "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                ✏ Editar
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          {TIER_LEVELS.map(tier => {
            const items = tl.tiers[tier.id] || [];
            return (
              <div key={tier.id} style={{ display: "flex", minHeight: 96, borderRadius: 10, overflow: "hidden", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                <div style={{ width: 52, background: tier.color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 3 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "white" }}>{tier.id}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>{items.length}</span>
                </div>
                <div style={{ flex: 1, background: darkMode ? "#0d1117" : "#f8fafc", display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center" }}>
                  {items.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#484f58" }}>Vazio</span>
                  ) : items.map(item => {
                    const cover = item.customCover || item.cover || item.thumbnailUrl;
                    return (
                      <div key={item.id} title={item.title} onClick={() => onOpenItem && onOpenItem(item)} style={{ flexShrink: 0, cursor: onOpenItem ? "pointer" : "default" }}>
                        <div style={{ width: 62, height: 90, borderRadius: 7, overflow: "hidden", background: gradientFor(item.id) }}>
                          {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
