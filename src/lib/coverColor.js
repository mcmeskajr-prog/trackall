// Cor dominante de uma capa (dá ao modal de detalhes um tom próprio de cada título).
// Lê uma versão MINÚSCULA da capa (outro URL → não apanha a cópia «opaca» da cache) por CORS e analisa-a num canvas 24×24.
// Se o servidor não autorizar, devolve null e fica tudo como estava (sem erros visíveis).
import { useEffect, useState } from "react";

const cache = new Map();

function tinyUrl(src) {
  return src
    .replace(/(image\.tmdb\.org\/t\/p\/)w\d+\//, "$1w92/")
    .replace(/(images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+\//, "$1t_micro/")
    .replace(/(anilist\.co\/file\/anilistcdn\/media\/[^/]+\/cover\/)(?:large|medium|extraLarge)\//, "$1small/");
}

export function extractCoverColor(src) {
  if (!src || typeof src !== "string" || src.startsWith("data:") || src.startsWith("blob:")) return Promise.resolve(null);
  if (cache.has(src)) return Promise.resolve(cache.get(src));
  return new Promise((resolve) => {
    const done = (v) => { cache.set(src, v); resolve(v); };
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
          if (lum < 28 || lum > 235) continue;
          const wt = 0.15 + sat * sat * 3;
          r += R * wt; g += G * wt; b += B * wt; w += wt;
        }
        done(w > 0 ? `#${[r, g, b].map(v => Math.round(v / w).toString(16).padStart(2, "0")).join("")}` : null);
      } catch { done(null); }
    };
    img.onerror = () => done(null);
    img.src = tinyUrl(src);
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
