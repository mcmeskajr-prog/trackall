// ─── Utilitários partilhados entre módulos de API ─────────────────────────────
// shuffle é usado por fetchTrendingAnime/Manga (AniList), fetchTrendingMovies/Series
// (TMDB) e fetchTrendingGames (IGDB) — fica aqui para não ser duplicado em cada
// ficheiro de api/ à medida que forem extraídos.
export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ─── Gradiente de fallback para capas em falta ────────────────────────────────
// Usado em ~30 sítios do App.jsx e por componentes de UI (MediaCard, etc.) —
// escolhe sempre o mesmo gradiente para o mesmo id, para não "saltar" de cor
// entre renders.
const GRADIENTS = [
  ["#1a0533","#4a0080"],["#0d1f2d","#1a5276"],["#1a1a00","#7d6608"],
  ["#1a0000","#7b241c"],["#0a2e1a","#1e8449"],["#0d0d2b","#1a237e"],
  ["#1c0a2e","#6b21a8"],["#0a1628","#1e3a5f"],["#1a0a00","#7c3a00"],
  ["#001a1a","#006666"],
];
export const gradientFor = (id) => {
  const i = Math.abs((id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % GRADIENTS.length;
  return `linear-gradient(145deg, ${GRADIENTS[i][0]} 0%, ${GRADIENTS[i][1]} 100%)`;
};

// ─── Compressão de imagens (canvas → base64 JPEG) ─────────────────────────────
// Usado antes de enviar capas/avatares/banners — reduz o ficheiro no browser
// antes do upload, tanto para o Supabase Storage como para pré-visualizações.
export function compressImage(file, maxW = 400, maxH = 600, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Reduz uma imagem já guardada (data URI) — devolve a original se não ficar mais pequena
export function shrinkDataUrl(dataUrl, maxW = 400, maxH = 600, quality = 0.78) {
  return new Promise((resolve) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length * 0.9 ? out : dataUrl);
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Banner — alta qualidade
export function compressBanner(file) {
  return compressImage(file, 1200, 400, 0.90);
}




// ─── Capa em melhor resolução (para cartões grandes) ───
// Só troca padrões de URL conhecidos; quem usar deve ter onError a voltar ao original.
export function hiRes(url) {
  if (!url || typeof url !== "string") return url;
  return url
    .replace(/(image\.tmdb\.org\/t\/p\/)w\d+\//, "$1w780/")
    .replace(/(images\.igdb\.com\/igdb\/image\/upload\/)t_(?:thumb|micro|cover_small|cover_big|screenshot_med)\//, "$1t_720p/")
    .replace(/(anilist\.co\/file\/anilistcdn\/media\/[^/]+\/cover\/)(?:small|medium)\//, "$1large/");
}
