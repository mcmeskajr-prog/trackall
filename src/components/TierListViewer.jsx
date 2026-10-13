import { createPortal } from "react-dom";
import { TIER_LEVELS } from "../config/constants";
import { gradientFor } from "../lib/utils";
import { useTheme } from "../contexts/ThemeContext";

export const TIER_NAMES = { S: "Obra-prima", A: "Excelente", B: "Bom", C: "Fraco", D: "Evitar" };

// Visualizador de tier list: linhas limpas, capas grandes
export function TierListViewer({ tl, onClose, onLike, liked, currentUserId, onEdit, onOpenItem }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  const author = tl.profiles ? (tl.profiles.username || tl.profiles.name) : null;
  const total = TIER_LEVELS.reduce((n, t) => n + (tl.tiers[t.id] || []).length, 0);
  const cw = isMobileDevice ? 56 : 74, ch = isMobileDevice ? 84 : 110;

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <style>{`
        .tl-poster { position: relative; transition: transform .18s cubic-bezier(.2,.8,.3,1), box-shadow .18s ease, filter .18s ease; }
        .tl-poster .tl-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 6px 6px; font-size: 10.5px; font-weight: 700; line-height: 1.2; color: #fff; background: linear-gradient(to top, rgba(0,0,0,.88), transparent); opacity: 0; transform: translateY(4px); transition: opacity .18s ease, transform .18s ease; pointer-events: none; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        @media (hover: hover) {
          .tl-row:hover .tl-badge { box-shadow: 0 0 18px var(--tc); }
          .tl-grid:hover .tl-poster:not(:hover) { filter: brightness(.6) saturate(.8); }
          .tl-poster:hover { transform: translateY(-6px) scale(1.07); z-index: 3; box-shadow: 0 14px 30px rgba(0,0,0,.55), 0 0 0 2px var(--tc) !important; }
          .tl-poster:hover .tl-cap { opacity: 1; transform: none; }
        }
        .tl-poster:active { transform: scale(.97); }
      `}</style>
      <div className="modal fade-in" style={{ maxWidth: 940, maxHeight: "92vh", overflowY: "auto", padding: 0, background: darkMode ? `radial-gradient(circle at 90% 0%, ${accent}24, transparent 45%), #0e1014` : "#ffffff", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, borderRadius: isMobileDevice ? undefined : 24, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: isMobileDevice ? "20px 16px 6px" : "32px 40px 6px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: accent, marginBottom: 6 }}>TIER LIST · {total} {total === 1 ? "ITEM" : "ITENS"}</div>
              <h2 style={{ fontSize: isMobileDevice ? 24 : 32, fontWeight: 800, lineHeight: 1.1, color: text }}>{tl.title}</h2>
              {author && <p style={{ fontSize: 13, color: muted, marginTop: 8 }}>por <b style={{ color: text }}>@{author}</b></p>}
            </div>
            <button onClick={onClose} aria-label="Fechar" style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : "#e2e8f0"}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => onLike && onLike(tl.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: liked ? `${accent}22` : "transparent", border: `1px solid ${liked ? accent : (darkMode ? "rgba(255,255,255,0.14)" : "#e2e8f0")}`, borderRadius: 12, padding: "8px 14px", color: liked ? accent : muted, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              {liked ? "♥" : "♡"} {tl.likes_count || 0}
            </button>
            {currentUserId === tl.user_id && onEdit && (
              <button onClick={() => { onClose(); onEdit(tl); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : "#e2e8f0"}`, borderRadius: 12, padding: "8px 14px", color: muted, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>✎ Editar</button>
            )}
          </div>
        </div>
        <div style={{ padding: isMobileDevice ? "8px 16px 24px" : "10px 40px 32px" }}>
          {TIER_LEVELS.map((tier, idx) => {
            const items = tl.tiers[tier.id] || [];
            return (
              <div key={tier.id} className="tl-row" style={{ "--tc": tier.color, display: "flex", alignItems: isMobileDevice ? "flex-start" : "center", gap: isMobileDevice ? 12 : 18, padding: isMobileDevice ? "14px 0" : "16px 0", borderBottom: idx < TIER_LEVELS.length - 1 ? `1px solid ${line}` : "none" }}>
                <div className="tl-badge" style={{ transition: "box-shadow .2s", width: isMobileDevice ? 38 : 48, height: isMobileDevice ? 38 : 48, borderRadius: 14, background: `${tier.color}22`, border: `1.5px solid ${tier.color}`, color: tier.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobileDevice ? 19 : 24, fontWeight: 800, flexShrink: 0 }}>{tier.id}</div>
                <div className="tl-grid" style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: isMobileDevice ? 7 : 10, minHeight: ch }}>
                  {items.length === 0 ? (
                    <span style={{ fontSize: 12, color: muted, alignSelf: "center" }}>Vazio</span>
                  ) : items.map(item => {
                    const cover = item.customCover || item.cover || item.thumbnailUrl;
                    return (
                      <div key={item.id} className="tl-poster" title={item.title} onClick={() => onOpenItem && onOpenItem(item)} style={{ "--tc": tier.color, width: cw, height: ch, borderRadius: 9, overflow: "hidden", background: gradientFor(item.id), boxShadow: "0 4px 14px rgba(0,0,0,0.35)", cursor: onOpenItem ? "pointer" : "default" }}>
                        {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                        <div className="tl-cap">{item.title}</div>
                      </div>
                    );
                  })}
                </div>
                {!isMobileDevice && (
                  <div style={{ width: 70, textAlign: "right", flexShrink: 0, fontSize: 12, color: muted }}>
                    {TIER_NAMES[tier.id] || ""}<br /><b style={{ color: text, fontSize: 15 }}>{items.length}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
