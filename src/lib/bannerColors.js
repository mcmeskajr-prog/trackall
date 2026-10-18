// ─── Banner do perfil (telemóvel): estilo guardado no próprio URL + cores automáticas ───
// O estilo (cor, mistura, escurecer ao descer, brilho) vai como "fragmento" do URL do banner:
//   https://…/banner-123.jpg#tc=ff6a3d&mx=70&dk=55&br=100
// Assim não é preciso nenhuma coluna nova na BD e os amigos recebem tudo com o perfil.
import { useEffect, useState } from "react";

export const DEFAULT_BANNER_STYLE = { c: "", m: 70, d: 55, b: 100, a: 1 }; // c "" = automático; a 1 = a cor do banner passa a ser o destaque do perfil

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isHex = (s) => /^[0-9a-f]{6}$/i.test(s || "");

export function splitBanner(str) {
  if (!str || typeof str !== "string") return { url: "", style: { ...DEFAULT_BANNER_STYLE } };
  const i = [str.indexOf("#tc="), str.indexOf("#mx=")].filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? -1;
  if (i < 0 || str.startsWith("data:")) return { url: str, style: { ...DEFAULT_BANNER_STYLE } };
  const url = str.slice(0, i);
  const q = new URLSearchParams(str.slice(i + 1));
  const num = (k, def, a, b) => { const v = Number(q.get(k)); return q.has(k) && Number.isFinite(v) ? clamp(v, a, b) : def; };
  const tc = (q.get("tc") || "").replace("#", "");
  return { url, style: { c: isHex(tc) ? tc.toLowerCase() : "", m: num("mx", 70, 0, 100), d: num("dk", 55, 0, 100), b: num("br", 100, 60, 140), a: q.get("ac") === "0" ? 0 : 1 } };
}

export function joinBanner(url, style) {
  if (!url) return "";
  if (url.startsWith("data:")) return url; // base64 não leva fragmento (o upload tenta sempre devolver URL)
  const s = { ...DEFAULT_BANNER_STYLE, ...(style || {}) };
  const isDefault = !s.c && s.m === 70 && s.d === 55 && s.b === 100 && s.a !== 0;
  if (isDefault) return url;
  const p = [];
  if (s.c) p.push(`tc=${s.c.replace("#", "")}`);
  p.push(`mx=${Math.round(s.m)}`, `dk=${Math.round(s.d)}`, `br=${Math.round(s.b)}`);
  if (s.a === 0) p.push("ac=0");
  return `${url}#${p.join("&")}`;
}

// ── Conversões de cor ──
export function hexToRgb(hex) { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const hexHsl = (hex) => rgbToHsl(...hexToRgb(hex));

// ── Extração de cores (canvas pequeno, cache por URL) ──
const _cache = new Map();
export function extractPalette(url) {
  if (!url) return Promise.resolve(null);
  if (_cache.has(url)) return _cache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = 48, H = Math.max(8, Math.round(48 * img.height / img.width));
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        const buckets = new Map();
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 200) continue;
          const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
          const key = (Math.round(h / 15) % 24) + (s < 0.15 ? 100 : 0);
          const b = buckets.get(key) || { n: 0, h: 0, s: 0, l: 0, sx: 0, sy: 0 };
          b.n++; b.s += s; b.l += l; b.sx += Math.cos(h * Math.PI / 180); b.sy += Math.sin(h * Math.PI / 180);
          buckets.set(key, b);
        }
        const list = [...buckets.values()].map((b) => ({ n: b.n, s: b.s / b.n, l: b.l / b.n, h: (Math.atan2(b.sy, b.sx) * 180 / Math.PI + 360) % 360 }));
        if (!list.length) return resolve(null);
        // dominante: mais pixéis, com bónus de saturação (evita cinzentos quando há cor)
        const score = (b) => b.n * (0.4 + b.s) * (b.l > 0.08 && b.l < 0.92 ? 1 : 0.3);
        const dom = [...list].sort((a, b) => score(b) - score(a))[0];
        const vib = [...list].sort((a, b) => (b.s * Math.min(b.l, 1 - b.l) * Math.sqrt(b.n)) - (a.s * Math.min(a.l, 1 - a.l) * Math.sqrt(a.n)))[0];
        const sat = (b) => Math.max(0.4, Math.min(0.9, b.s * 1.15));
        resolve([
          { id: "dom", hex: hslToHex(dom.h, sat(dom), clamp(dom.l, 0.3, 0.55)) },
          { id: "vib", hex: hslToHex(vib.h, Math.max(0.55, sat(vib)), 0.5) },
          { id: "mut", hex: hslToHex(dom.h, Math.min(0.3, dom.s), 0.38) },
          { id: "drk", hex: hslToHex(dom.h, sat(dom) * 0.8, 0.2) },
          { id: "dkk", hex: hslToHex(dom.h, sat(dom) * 0.6, 0.1) },
        ]);
      } catch { resolve(null); } // canvas "tainted" (sem CORS) → sem cores automáticas
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  _cache.set(url, p);
  return p;
}

export function useBannerPalette(url) {
  const [pal, setPal] = useState(null);
  useEffect(() => {
    let alive = true;
    setPal(null);
    if (url) extractPalette(url).then((p) => { if (alive) setPal(p); });
    return () => { alive = false; };
  }, [url]);
  return pal;
}

// Cor base escolhida: a do estilo, senão a dominante, senão o acento
export function baseColor(style, palette, accent) {
  if (style?.c && isHex(style.c)) return style.c;
  if (palette?.[0]) return palette[0].hex;
  const a = (accent || "#f97316").replace("#", "");
  return isHex(a) ? a : "f97316";
}

// Fundo em gradiente que se dissolve no fundo real da página (sem bordas).
// m = intensidade (0-100), d = escurecer ao descer (0-100). Tons escuros e pouco saturados para casar com a UI.
export function backdropCss(baseHex, style, darkMode) {
  const [h, s, l] = hexHsl(baseHex);
  const m = clamp(style?.m ?? 70, 0, 100) / 100, d = clamp(style?.d ?? 55, 0, 100) / 100;
  const sat = clamp(s, 0.18, 0.5);
  const top = darkMode ? clamp(l * 0.62, 0.15, 0.27) : clamp(0.9 - (0.5 - l) * 0.3, 0.8, 0.9);
  const low = darkMode ? top + (0.06 - top) * d : top + (0.98 - top) * d;
  const c1 = hslToHex(h, sat, top), c2 = hslToHex(h, sat * 0.8, low);
  const al = (x, k) => `#${x}${Math.round(clamp(k, 0, 1) * 255).toString(16).padStart(2, "0")}`;
  return `linear-gradient(180deg, ${al(c1, m)} 0%, ${al(c1, m * 0.92)} 22%, ${al(c2, m * 0.7)} 50%, ${al(c2, m * 0.3)} 78%, ${al(c2, 0)} 100%)`;
}

export const bannerFilter = (style) => { const b = clamp(style?.b ?? 100, 60, 140); return b === 100 ? undefined : `brightness(${b / 100})`; };

// Cor de destaque tirada do banner (viva e legível sobre fundo escuro); null = usar a do tema
export function bannerAccentHex(style, palette) {
  if (style?.a === 0) return null;
  const hex = style?.c && isHex(style.c) ? style.c : palette?.[0]?.hex;
  if (!hex) return null;
  const [h, s, l] = hexHsl(hex);
  return `#${hslToHex(h, clamp(s, 0.5, 0.85), clamp(l, 0.58, 0.68))}`;
}
export function useBannerAccent(banner, enabled = true) {
  const { url, style } = splitBanner(banner);
  const pal = useBannerPalette(enabled ? url : "");
  return enabled && url ? bannerAccentHex(style, pal) : null;
}
