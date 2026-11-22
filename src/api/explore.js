import { normalizeMediaId } from '../lib/mediaIds';
import { fetchAniListSafe } from './anilist';
import { fetchVndbExplore } from './vndb';

// ─── Explorar: listas por tipo com ordenação, ano e estado, em páginas ───
// Anime/manga/manhwa/light novels: AniList (pedido direto, sem chave; o Worker serve de reserva).
// Visual Novels: VNDB (direto, sem chave; Worker de reserva). Séries/filmes: TMDB e jogos: IGDB, ambos pelo Worker (as chaves ficam lá).
// Cada página fica guardada em memória 5 min: voltar atrás / mudar de separador não repete pedidos.

export const EXPLORE_TYPES = ["anime", "manga", "series", "filmes", "jogos", "visualnovels", "manhwa", "lightnovels"];
// Só estes tipos têm «estado» (em publicação / terminados): no TMDB só as séries, e os filmes e jogos não
export const EXPLORE_HAS_STATUS = ["anime", "manga", "manhwa", "lightnovels", "series"];
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

// ── TMDB (séries e filmes) ──
const TMDB_PER_PAGE = 20;
const today = () => new Date().toISOString().slice(0, 10);

// → { endpoint, params } para o /tmdb do Worker
export function buildTmdbRequest({ type, sort = "trending", year = null, status = "", page = 1 }) {
  const ep = type === "filmes" ? "movie" : type === "series" ? "tv" : null;
  if (!ep) return null;
  const params = { language: "en-US", page: String(Math.min(page, 500)) };
  const yearKey = ep === "movie" ? "primary_release_year" : "first_air_date_year";
  const dateKey = ep === "movie" ? "primary_release_date" : "first_air_date";
  if (sort === "trending" && !year && !(ep === "tv" && status)) return { endpoint: `/trending/${ep}/week`, params };
  const d = { ...params, sort_by: "popularity.desc", include_adult: "false" };
  if (sort === "score") { d.sort_by = "vote_average.desc"; d["vote_count.gte"] = ep === "movie" ? "500" : "200"; }
  if (sort === "new") { d.sort_by = `${dateKey}.desc`; d[`${dateKey}.lte`] = today(); d["vote_count.gte"] = "5"; }
  if (year) d[yearKey] = String(year);
  if (ep === "tv" && status === "RELEASING") d.with_status = "0";
  if (ep === "tv" && status === "FINISHED") d.with_status = "3";
  return { endpoint: `/discover/${ep}`, params: d };
}

export function mapTmdbMedia(m, type) {
  return {
    id: `tmdb-${type}-${m.id}`,
    title: m.title || m.name || "",
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
    backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : "",
    type,
    year: String((m.release_date || m.first_air_date || "").slice(0, 4)),
    score: m.vote_average ? +m.vote_average.toFixed(1) : null,
    synopsis: (m.overview || "").slice(0, 220),
    genres: [],
    extra: "",
    source: "TMDB",
  };
}

async function fetchTmdbPage(opts, workerUrl) {
  const req = buildTmdbRequest(opts);
  if (!req || !workerUrl) throw new Error("explore-unavailable");
  const qs = new URLSearchParams({ endpoint: req.endpoint, ...req.params });
  const res = await fetch(`${workerUrl.replace(/\/$/, "")}/tmdb?${qs.toString()}`);
  if (!res.ok) throw new Error("explore-unavailable");
  const d = await res.json();
  if (!Array.isArray(d?.results)) throw new Error("explore-unavailable");
  const items = d.results.filter((m) => m.poster_path).map((m) => mapTmdbMedia(m, opts.type));
  return { items, hasNext: (d.page || opts.page || 1) < Math.min(d.total_pages || 1, 500), raw: d.results.length || TMDB_PER_PAGE };
}

// ── IGDB (jogos) ──
const IGDB_PER_PAGE = 24;

export function buildIgdbBody({ sort = "trending", year = null, page = 1 }, nowSec = Math.floor(Date.now() / 1000)) {
  const w = ["cover != null", "version_parent = null"];
  let order = "total_rating_count desc";
  if (sort === "trending") { w.push(`first_release_date > ${nowSec - 365 * 86400}`, `first_release_date <= ${nowSec}`, "total_rating_count > 0"); }
  else if (sort === "popular") { w.push("total_rating_count > 50"); }
  else if (sort === "score") { w.push("total_rating_count > 100", "total_rating != null"); order = "total_rating desc"; }
  else if (sort === "new") { w.push(`first_release_date <= ${nowSec}`, "total_rating_count > 1"); order = "first_release_date desc"; }
  if (year) {
    const a = Math.floor(Date.UTC(year, 0, 1) / 1000), b = Math.floor(Date.UTC(year + 1, 0, 1) / 1000);
    w.push(`first_release_date >= ${a}`, `first_release_date < ${b}`);
  }
  return `fields name,cover.url,first_release_date,total_rating,genres.name; where ${w.join(" & ")}; sort ${order}; limit ${IGDB_PER_PAGE}; offset ${(Math.max(page, 1) - 1) * IGDB_PER_PAGE};`;
}

export function mapIgdbGame(g) {
  return {
    id: `igdb-${g.id}`,
    title: g.name || "",
    cover: g.cover?.url ? "https:" + g.cover.url.replace("t_thumb", "t_cover_big") : "",
    type: "jogos",
    year: g.first_release_date ? String(new Date(g.first_release_date * 1000).getUTCFullYear()) : "",
    score: g.total_rating ? +(g.total_rating / 10).toFixed(1) : null,
    genres: (g.genres || []).map((x) => x.name).slice(0, 4),
    source: "IGDB",
  };
}

async function fetchIgdbPage(opts, workerUrl) {
  if (!workerUrl) throw new Error("explore-unavailable");
  const res = await fetch(workerUrl.replace(/\/$/, "") + "/igdb", { method: "POST", headers: { "Content-Type": "text/plain" }, body: buildIgdbBody(opts) });
  if (!res.ok) throw new Error("explore-unavailable");
  const d = await res.json();
  if (!Array.isArray(d)) throw new Error("explore-unavailable");
  return { items: d.map(mapIgdbGame).filter((g) => g.cover), hasNext: d.length >= IGDB_PER_PAGE };
}

async function fetchAniListPage(opts, workerUrl) {
  const body = buildExploreQuery(opts);
  if (!body) return { items: [], hasNext: false };
  const urls = ["https://graphql.anilist.co", ...(workerUrl ? [workerUrl.replace(/\/$/, "") + "/anilist"] : [])];
  const d = await fetchAniListSafe(urls, JSON.stringify(body));
  const page = d?.data?.Page;
  if (!page) throw new Error("explore-unavailable");
  return { items: (page.media || []).map((m) => mapExploreMedia(m, opts.type)), hasNext: !!page.pageInfo?.hasNextPage };
}

// → { items, hasNext } ; lança erro se a rede falhar (para a vista mostrar «tentar de novo»)
export async function fetchExplore(opts, workerUrl) {
  const key = JSON.stringify([opts, workerUrl ? 1 : 0]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  let v;
  if (opts.type === "filmes" || opts.type === "series") { const r = await fetchTmdbPage(opts, workerUrl); v = { items: r.items, hasNext: r.hasNext }; }
  else if (opts.type === "jogos") v = await fetchIgdbPage(opts, workerUrl);
  else if (opts.type === "visualnovels") v = await fetchVndbExplore(opts, workerUrl);
  else v = await fetchAniListPage(opts, workerUrl);
  cache.set(key, { t: Date.now(), v });
  return v;
}
