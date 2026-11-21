import { normalizeMediaId } from '../lib/mediaIds';
import { fetchAniListSafe } from './anilist';

// ─── Explorar (AniList): listas por tipo com ordenação, ano e estado, em páginas ───
// O AniList aceita pedidos diretos do browser (e o Worker serve de reserva), por isso não precisa de chave.
// Cada página fica guardada em memória 5 min: voltar atrás / mudar de separador não repete pedidos.

export const EXPLORE_TYPES = ["anime", "manga", "manhwa", "lightnovels"];
export const EXPLORE_SORTS = [
  { id: "trending", al: "TRENDING_DESC", pt: "Em alta", en: "Trending" },
  { id: "popular", al: "POPULARITY_DESC", pt: "Populares", en: "Popular" },
  { id: "score", al: "SCORE_DESC", pt: "Mais bem avaliados", en: "Top rated" },
  { id: "new", al: "START_DATE_DESC", pt: "Novos", en: "Newest" },
];
export const EXPLORE_STATUS = [
  { id: "", al: null, pt: "Todos", en: "All" },
  { id: "RELEASING", al: "RELEASING", pt: "Em publicação", en: "Releasing" },
  { id: "FINISHED", al: "FINISHED", pt: "Terminados", en: "Finished" },
];
const PER_PAGE = 24;
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

// Filtros fixos de cada tipo (o Manga exclui manhwa e novels, como a pesquisa já faz por formato/país)
const TYPE_RULES = {
  anime: { mediaType: "ANIME", extra: "" },
  manga: { mediaType: "MANGA", extra: ',format_in:[MANGA,ONE_SHOT],countryOfOrigin:"JP"' },
  manhwa: { mediaType: "MANGA", extra: ',countryOfOrigin:"KR"' },
  lightnovels: { mediaType: "MANGA", extra: ",format_in:[NOVEL]" },
};

export function buildExploreQuery({ type, sort = "trending", year = null, status = "", page = 1 }) {
  const rule = TYPE_RULES[type];
  if (!rule) return null;
  const s = EXPLORE_SORTS.find((x) => x.id === sort) || EXPLORE_SORTS[0];
  let f = rule.extra;
  if (status) f += `,status:${status}`; else f += ",status_not:NOT_YET_RELEASED";
  if (year) f += `,startDate_greater:${year * 10000},startDate_lesser:${(year + 1) * 10000}`;
  if (s.id === "score") f += `,popularity_greater:${rule.mediaType === "ANIME" ? 8000 : 3000}`; // evita obscuros com 1 voto
  return {
    query: `query($p:Int){Page(page:$p,perPage:${PER_PAGE}){pageInfo{hasNextPage}media(type:${rule.mediaType},sort:${s.al}${f}){id title{romaji english native}coverImage{large medium}startDate{year}averageScore episodes chapters genres}}}`,
    variables: { p: page },
  };
}

export function mapExploreMedia(m, type) {
  return {
    id: normalizeMediaId(`al-${type}-${m.id}`, type),
    title: m.title?.english || m.title?.romaji || m.title?.native || "",
    titleEn: m.title?.english || "",
    cover: m.coverImage?.large || m.coverImage?.medium || "",
    type,
    year: String(m.startDate?.year || ""),
    score: m.averageScore ? +(m.averageScore / 10).toFixed(1) : null,
    genres: (m.genres || []).slice(0, 4),
    source: "AniList",
    episodes: m.episodes || null,
    chapters: m.chapters || null,
  };
}

// → { items, hasNext } ; lança erro se a rede falhar (para a vista mostrar «tentar de novo»)
export async function fetchExplore(opts, workerUrl) {
  const body = buildExploreQuery(opts);
  if (!body) return { items: [], hasNext: false };
  const key = JSON.stringify(body);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  const urls = ["https://graphql.anilist.co", ...(workerUrl ? [workerUrl.replace(/\/$/, "") + "/anilist"] : [])];
  const d = await fetchAniListSafe(urls, JSON.stringify(body));
  const page = d?.data?.Page;
  if (!page) throw new Error("explore-unavailable");
  const v = { items: (page.media || []).map((m) => mapExploreMedia(m, opts.type)), hasNext: !!page.pageInfo?.hasNextPage };
  cache.set(key, { t: Date.now(), v });
  return v;
}
