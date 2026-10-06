import { useTheme } from "../contexts/ThemeContext";

export function CollectionCard({ col, onOpen, onLike, liked, currentUserId, onDelete }) {
  const { accent, darkMode } = useTheme();
  const items = col.items || [];
  const covers = items.slice(0, 8).map(i => i.cover).filter(Boolean);

  const STRIP_H = 160;
  // Cada capa tem proporção portrait 2:3
  const COVER_W = Math.round(STRIP_H * (2 / 3)); // ~107px

  return (
    <div onClick={() => onOpen(col)} style={{
      background: darkMode ? "rgba(22,27,34,0.35)" : "rgba(248,250,252,0.42)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
      borderRadius: 14, overflow: "hidden", cursor: "pointer",
      transition: "transform 0.15s, box-shadow 0.15s",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${accent}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Cover strip — estilo Letterboxd: capas portrait, sem espaço vazio */}
      <div style={{
        display: "flex",
        gap: 3,
        padding: 3,
        height: STRIP_H,
        boxSizing: "border-box",
        flexShrink: 0,
        // O container encolhe até ao tamanho das capas — sem fundo cinzento vazio
        width: covers.length === 0 ? "100%" : "fit-content",
        minWidth: "100%",
        background: "transparent",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}>
        {covers.length === 0 ? (
          <div style={{
            flex: 1, background: `${accent}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, fontSize: 32, border: `1px dashed ${accent}33`,
          }}>📋</div>
        ) : (
          covers.map((src, i) => (
            <div key={i} style={{
              width: COVER_W,
              minWidth: COVER_W,
              height: "100%",
              borderRadius: 6,
              overflow: "hidden",
              background: darkMode ? "#21262d" : "#c8cfd8",
              flexShrink: 0,
            }}>
              <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
                onError={e => { e.target.parentElement.style.display = "none"; }}
              />
            </div>
          ))
        )}
      </div>

      {/* Info + Actions */}
      <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: darkMode ? "#e6edf3" : "#0d1117", marginBottom: 2, lineHeight: 1.2 }}>{col.title}</div>
          <div style={{ fontSize: 11, color: "#8b949e", marginBottom: col.description ? 4 : 0 }}>
            {items.length} {items.length === 1 ? "item" : "itens"} · {col.visibility === "private" ? "🔒 Privada" : col.visibility === "friends" ? "👥 Amigos" : "🌐 Pública"}
          </div>
          {col.description ? (
            <div style={{ fontSize: 11, color: darkMode ? "#8b949e" : "#64748b", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {col.description}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onLike(col.id)} style={{
            background: liked ? `${accent}22` : "transparent",
            border: `1px solid ${liked ? accent : "#30363d"}`,
            color: liked ? accent : "#8b949e",
            borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
          }}>♥ {col.likes_count || 0}</button>
          {currentUserId === col.user_id && (
            <button onClick={() => onDelete(col.id)} style={{
              background: "transparent", border: "1px solid #ef444433",
              color: "#ef4444", borderRadius: 8, padding: "4px 10px",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}
