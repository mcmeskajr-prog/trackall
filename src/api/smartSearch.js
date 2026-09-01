import { searchAniList } from './anilist';
import { searchTMDB } from './tmdb';
import { searchIGDB, searchSteam } from './igdb';
import { searchGoogleBooks } from './books';
import { searchComicVine } from './comicvine';

// ─── Cache de pesquisas ─────────────────────────────────────────────────────────
// Exportado porque o App.jsx apaga entradas diretamente (ao trocar de tipo, para
// garantir resultados frescos em vez de reaproveitar uma pesquisa em cache).
export const CACHE = new Map();
export function cacheKey(q, type) { return `${type}::${q.toLowerCase().trim()}`; }

// ─── smartSearch — escolhe a melhor API por tipo ──────────────────────────────
export async function smartSearch(query, mediaType, keys = {}) {
  const ck = cacheKey(query, mediaType);
  if (CACHE.has(ck)) return CACHE.get(ck);

  let results = null;
  try {
    if (mediaType === "anime") results = await searchAniList(query, "anime", keys.workerUrl);
    else if (mediaType === "manga") results = await searchAniList(query, "manga", keys.workerUrl);
    else if (mediaType === "manhwa") { const r = await searchAniList(query, "manhwa", keys.workerUrl, null, "KR"); results = r; }
    else if (mediaType === "lightnovels") { const r = await searchAniList(query, "lightnovels", keys.workerUrl, "NOVEL"); results = r; }
    else if (mediaType === "filmes") results = await searchTMDB(query, "filmes", keys.tmdb, keys.workerUrl);
    else if (mediaType === "series") results = await searchTMDB(query, "series", keys.tmdb, keys.workerUrl);
    else if (mediaType === "livros") results = await searchGoogleBooks(query, keys.workerUrl);
    else if (mediaType === "jogos") {
      results = await searchIGDB(query, keys.workerUrl);
      if (!results?.length) results = await searchSteam(query);
    }
    else if (mediaType === "comics") results = await searchComicVine(query, keys.workerUrl);
  } catch (err) {
    console.error('[Search] Erro na pesquisa:', err);
  }

  if (results?.length) {
    CACHE.set(ck, results);
    if (CACHE.size > 50) CACHE.delete(CACHE.keys().next().value);
    return results;
  }
  return [];
}
