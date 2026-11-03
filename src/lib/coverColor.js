// Cor dominante de uma capa (para dar ao modal de detalhes um tom próprio de cada título).
// Usa um canvas minúsculo; se o servidor da imagem não permitir (CORS) devolve null e fica tudo como estava.
import { useEffect, useState } from "react";

const cache = new Map();

export function extractCoverColor(src) {
  if (!src || typeof src !== "string" || src.startsWith("data:")) return Promise.resolve(null);
  if (cache.has(src)) return Promise.resolve(cache.get(src));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const lum = (R + G + B) / 3;
          if (lum < 28 || lum > 235) continue;       // ignora preto/branco
          const wt = 0.15 + sat * sat * 3;            // prefere cores vivas
          r += R * wt; g += G * wt; b += B * wt; w += wt;
        }
        const out = w > 0 ? `#${[r, g, b].map(v => Math.round(v / w).toString(16).padStart(2, "0")).join("")}` : null;
        cache.set(src, out);
        resolve(out);
      } catch { cache.set(src, null); resolve(null); }
    };
    img.onerror = () => { cache.set(src, null); resolve(null); };
    img.src = src;
  });
}

export function useCoverColor(src) {
  const [color, setColor] = useState(() => (src && cache.get(src)) || null);
  useEffect(() => {
    let alive = true;
    if (!src) { setColor(null); return; }
    if (cache.has(src)) { setColor(cache.get(src)); return; }
    setColor(null);
    extractCoverColor(src).then((c) => { if (alive) setColor(c); });
    return () => { alive = false; };
  }, [src]);
  return color;
}
