import { shuffle } from '../lib/utils';

// ─── TMDB — Filmes e Séries ────────────────────────────────────────────────────

export async function searchTMDB(query, type, key, workerUrl) {
  const ep = type === "filmes" ? "movie" : "tv";
  try {
    if (workerUrl) {
      // Usar Worker — chave não exposta
      const url = `${workerUrl.replace(/\/$/, "")}/tmdb?endpoint=/search/${ep}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.results?.length) return null;
      return data.results.slice(0, 24).map((m) => ({
        id: `tmdb-${type}-${m.id}`,
        title: m.title || m.name || "",
        cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
        backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : "",
        type, year: String((m.release_date || m.first_air_date || "").slice(0, 4)),
        score: m.vote_average ? +m.vote_average.toFixed(1) : null,
        synopsis: (m.overview || "").slice(0, 220), genres: [], extra: "", source: "TMDB",
      }));
    }
    // Fallback direto (só se não houver workerUrl)
    if (!key) return null;
    const res = await fetch(`https://api.themoviedb.org/3/search/${ep}?api_key=${key}&query=${encodeURIComponent(query)}&language=en-US&page=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;
    return data.results.slice(0, 24).map((m) => ({
      id: `tmdb-${type}-${m.id}`,
      title: m.title || m.name || "",
      cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
      backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : "",
      type, year: String((m.release_date || m.first_air_date || "").slice(0, 4)),
      score: m.vote_average ? +m.vote_average.toFixed(1) : null,
      synopsis: (m.overview || "").slice(0, 220), genres: [], extra: "", source: "TMDB",
    }));
  } catch { return null; }
}

export async function fetchTrendingMovies(tmdbKey, workerUrl) {
  try {
    const pages = await Promise.all([1,2,3].map(page => {
      const url = workerUrl
        ? `${workerUrl.replace(/\/$/, "")}/tmdb?endpoint=/trending/movie/week&language=en-US&page=${page}`
        : `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}&language=en-US&page=${page}`;
      return fetch(url).then(r => r.json()).then(d => d.results || []).catch(() => []);
    }));
    return shuffle(pages.flat()).map(m => ({ id: `tmdb-filmes-${m.id}`, title: m.title, cover: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null, type: "filmes", source: "TMDB", score: Math.round(m.vote_average * 10) }));
  } catch { return []; }
}

export async function fetchTrendingSeries(tmdbKey, workerUrl) {
  try {
    const pages = await Promise.all([1,2,3].map(page => {
      const url = workerUrl
        ? `${workerUrl.replace(/\/$/, "")}/tmdb?endpoint=/trending/tv/week&language=en-US&page=${page}`
        : `https://api.themoviedb.org/3/trending/tv/week?api_key=${tmdbKey}&language=en-US&page=${page}`;
      return fetch(url).then(r => r.json()).then(d => d.results || []).catch(() => []);
    }));
    return shuffle(pages.flat()).map(m => ({ id: `tmdb-series-${m.id}`, title: m.name, cover: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null, type: "series", source: "TMDB", score: Math.round(m.vote_average * 10) }));
  } catch { return []; }
}
