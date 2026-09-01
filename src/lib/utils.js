// ─── Utilitários partilhados entre módulos de API ─────────────────────────────
// shuffle é usado por fetchTrendingAnime/Manga (AniList), fetchTrendingMovies/Series
// (TMDB) e fetchTrendingGames (IGDB) — fica aqui para não ser duplicado em cada
// ficheiro de api/ à medida que forem extraídos.
export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);