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
