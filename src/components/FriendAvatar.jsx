import { useState } from "react";

// Avatar redondo com anel opcional; sem imagem (ou se falhar) mostra a inicial do nome.
export function FriendAvatar({ src, name, size = 40, ring, ringWidth = 2, style }) {
  const [bad, setBad] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(255,255,255,0.08)", color: "#c9d1d9", fontWeight: 800, fontSize: Math.round(size * 0.42),
      boxShadow: ring ? `0 0 0 ${ringWidth}px ${ring}` : "none", ...style,
    }}>
      {src && !bad
        ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initial}
    </div>
  );
}
