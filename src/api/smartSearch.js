import { searchAniList } from './anilist';
import { searchTMDB } from './tmdb';
import { searchIGDB, searchSteam } from './igdb';
import { searchGoogleBooks, searchOpenLibrary, parseAuthorQuery } from './books';
import { searchComicVine } from './comicvine';

// ─── Cache de pesquisas ─────────────────────────────────────────────────────────
// Exportado porque o App.jsx apaga entradas diretamente (ao trocar de tipo, para
// garantir resultados frescos em vez de reaproveitar uma pesquisa em cache).
export const CACHE = new Map();
export function cacheKey(q, type) { return `${type}::${q.toLowerCase().trim()}`; }

// ─── Relevância ─────────────────────────────────────────────────────────────────
// Cada API já devolve os seus resultados numa ordem própria (relevância nativa,
// popularidade, etc.). Isto só reordena para dar prioridade a títulos que batem
// mais de perto com o texto pesquisado, mantendo a ordem original da API como
// desempate (sort estável) para não perder essa relevância/popularidade nativa.
function normalizeForMatch(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function matchRank(title, q) {
  const t = normalizeForMatch(title);
  if (!q) return 3;
  if (t === q) return 0;           // título igual à pesquisa
  if (t.startsWith(q)) return 1;   // título começa pela pesquisa
  if (t.includes(q)) return 2;     // título contém a pesquisa
  return 3;                        // resto (ex: encontrado por autor/sinopse)
}
function sortByRelevance(items, query) {
  const q = normalizeForMatch(query);
  return [...items].sort((a, b) => matchRank(a.title, q) - matchRank(b.title, q));
}

// ─── smartSearch — escolhe a melhor API por tipo ──────────────────────────────
export async function smartSearch(query, mediaType, keys = {}) {
  const ck = cacheKey(query, mediaType);
  if (CACHE.has(ck)) return CACHE.get(ck);

  // "autor: Nome" só faz sentido nos livros; nos outros tipos não há resultados
  const ap = parseAuthorQuery(query);
  if (ap.author && mediaType !== "livros") return [];

  let results = null;
  let authorMode = false;
  try {
    if (mediaType === "anime") results = await searchAniList(query, "anime", keys.workerUrl);
    else if (mediaType === "manga") results = await searchAniList(query, "manga", keys.workerUrl);
    else if (mediaType === "manhwa") { const r = await searchAniList(query, "manhwa", keys.workerUrl, null, "KR"); results = r; }
    else if (mediaType === "lightnovels") { const r = await searchAniList(query, "lightnovels", keys.workerUrl, "NOVEL"); results = r; }
    else if (mediaType === "filmes") results = await searchTMDB(query, "filmes", keys.tmdb, keys.workerUrl);
    else if (mediaType === "series") results = await searchTMDB(query, "series", keys.tmdb, keys.workerUrl);
    else if (mediaType === "livros") {
      // "autor: Nome" força autor; senão, se o texto parece um nome de pessoa, pesquisa-se também por autor
      // e os livros desse autor aparecem primeiro.
      const tokens = normalizeForMatch(ap.q).split(/\s+/).filter(Boolean);
      const looksLikeName = !ap.author && tokens.length >= 2 && tokens.length <= 4 && !/\d/.test(ap.q);
      const authorHits = (list) => (list || []).filter((r) => { const a = normalizeForMatch(r.extra); return tokens.every((t) => a.includes(t)); });
      const [byTitle, byAuthor] = await Promise.all([
        searchGoogleBooks(ap.q, keys.workerUrl, { author: ap.author }).catch(() => null),
        looksLikeName ? searchGoogleBooks(ap.q, keys.workerUrl, { author: true }).catch(() => null) : Promise.resolve(null),
      ]);
      results = byTitle;
      if (looksLikeName) {
        let mine = authorHits(byAuthor);
        if (mine.length < 3) {
          const ol = await searchOpenLibrary(ap.q, keys.workerUrl, { author: true }).catch(() => null);
          mine = [...mine, ...authorHits(ol)];
        }
        const seen = new Set();
        mine = mine.filter((r) => { const k = normalizeForMatch(r.title); if (seen.has(k)) return false; seen.add(k); return true; });
        if (mine.length >= 3) {
          const rest = (byTitle || []).filter((r) => !seen.has(normalizeForMatch(r.title)));
          results = [...mine, ...rest];
          authorMode = true;
        }
      }
      // Poucos resultados no Google → junta o Open Library (sem repetir títulos já encontrados)
      if (!authorMode && (results?.length || 0) < 3) {
        const ol = await searchOpenLibrary(ap.q, keys.workerUrl, { author: ap.author }).catch(() => null);
        if (ol?.length) {
          const have = new Set((results || []).map((r) => normalizeForMatch(r.title)));
          results = [...(results || []), ...ol.filter((r) => !have.has(normalizeForMatch(r.title)))];
        }
      }
    }
    else if (mediaType === "jogos") {
      results = await searchIGDB(query, keys.workerUrl);
      if (!results?.length) results = await searchSteam(query, keys.workerUrl);
    }
    else if (mediaType === "comics") results = await searchComicVine(query, keys.workerUrl);
  } catch (err) {
    console.error('[Search] Erro na pesquisa:', err);
  }

  if (results?.length) {
    if (!ap.author && !authorMode) results = sortByRelevance(results, query);
    CACHE.set(ck, results);
    if (CACHE.size > 50) CACHE.delete(CACHE.keys().next().value);
    return results;
  }
  return [];
}
