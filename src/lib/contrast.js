// ─── Contraste automático ───
// Funções puras (sem dependências). A luminância é a relativa do WCAG: 0 = preto, 1 = branco.
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const relLum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const hexRgb = (hex) => {
  const h = String(hex || "").replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return /^[0-9a-f]{6}$/i.test(f) ? [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)] : null;
};
export const hexLum = (hex) => { const c = hexRgb(hex); return c ? relLum(c) : 0; };
export const ratio = (l1, l2) => { const a = Math.max(l1, l2), b = Math.min(l1, l2); return (a + 0.05) / (b + 0.05); };
// A luminância em que preto e branco dão o mesmo contraste (~0.179): abaixo disso o texto claro lê-se melhor.
export const isDarkLum = (lum) => lum < 0.179;

export const TEXT_ON_DARK = "#f0f3f8", TEXT_ON_LIGHT = "#14151a";
export function textFor(bgLum) { return isDarkLum(bgLum) ? TEXT_ON_DARK : TEXT_ON_LIGHT; }
// Texto a pôr sobre uma cor de destaque (botões): preto ou branco, o que der mais contraste
export function onAccent(accentHex) { return ratio(hexLum(accentHex), 1) >= ratio(hexLum(accentHex), 0) ? "#ffffff" : "#0b0b0b"; }
export function ratioLabel(r) { return r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA grande" : "fraco"; }

// Cor do fundo atrás do texto: mistura da cor do painel (com opacidade) sobre o que está por baixo
export function blendLum(panelHex, opacity, underLum) {
  const p = hexLum(panelHex), a = Math.max(0, Math.min(1, opacity));
  return p * a + underLum * (1 - a); // aproximação linear suficiente para decidir texto claro/escuro
}
export function overlayAlpha(css) {
  const m = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\s*\)/i.exec(css || "");
  return m ? (m[1] === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(m[1])))) : 0;
}

// Luminância média de uma imagem (grelha 24×24). Guarda em cache; devolve null se o canvas ficar bloqueado (CORS).
const _imgCache = new Map();
export function imageLuminance(src) {
  if (!src) return Promise.resolve(null);
  if (_imgCache.has(src)) return _imgCache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = 24, H = 24, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        let sum = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; sum += relLum([px[i], px[i + 1], px[i + 2]]); n++; }
        resolve(n ? sum / n : null);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  _imgCache.set(src, p);
  return p;
}

// Luminância média E dispersão (desvio-padrão) de uma imagem: uma imagem pode ter média «cinzenta» e ainda assim
// ser metade branca e metade preta, que é o pior caso para texto. Devolve { lum, std } ou null.
const _statCache = new Map();
export function imageStats(src) {
  if (!src) return Promise.resolve(null);
  if (_statCache.has(src)) return _statCache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = 24, H = 24, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        const ls = [];
        for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; ls.push(relLum([px[i], px[i + 1], px[i + 2]])); }
        if (!ls.length) return resolve(null);
        const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
        const std = Math.sqrt(ls.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ls.length);
        resolve({ lum: mean, std });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  _statCache.set(src, p);
  return p;
}

// Uma imagem precisa de «leitura garantida» se for clara ou se for contrastada e não escura.
// (Ex.: manga a preto e branco: lum 0.72, std 0.35.)
export function needsLegibility(stats) {
  if (!stats || typeof stats.lum !== "number") return false;
  return stats.lum >= 0.4 || (stats.lum >= 0.2 && (stats.std || 0) >= 0.3);
}

// «Garantir leitura sobre wallpaper»: só com imagem de fundo e película escura (a película branca já é o modo claro).
// Com cor de painel «Auto» passa a vidro escuro; com cor própria mantém-na e impõe uma opacidade mínima.
export const LEGIBLE_MIN_OPACITY = 65;      // % mínimo de um painel com cor própria
export const LEGIBLE_AUTO_PANEL = "#0d1117"; // vidro escuro quando o painel está em «Auto»
export const LEGIBLE_AUTO_OPACITY = 68;
export const LEGIBLE_MIN_OVERLAY = 0.7;      // película sugerida ao ligar / ao carregar uma imagem clara
export const isLightOverlay = (css) => /rgba?\(\s*255\s*,\s*255\s*,\s*255/i.test(css || "");
export function legibleTheme({ on, hasImage, overlay, panelBg, panelOpacity }) {
  const active = !!on && !!hasImage && !isLightOverlay(overlay);
  if (!active) return { active: false, panelBg, panelOpacity };
  if (!panelBg) return { active: true, panelBg: LEGIBLE_AUTO_PANEL, panelOpacity: LEGIBLE_AUTO_OPACITY };
  return { active: true, panelBg, panelOpacity: Math.max(panelOpacity ?? 100, LEGIBLE_MIN_OPACITY) };
}
