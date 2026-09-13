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

