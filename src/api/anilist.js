import { normalizeMediaId } from '../lib/mediaIds';
import { shuffle } from '../lib/utils';

// ─── AniList — Anime, Manga, Manhwa, Light Novels (sem chave, CORS aberto) ────

export async function searchAniList(query, type, workerUrl, format = null, country = null) {
  const mediaType = type === "anime" ? "ANIME" : "MANGA";
  let extraFilters = "";
  if (format) extraFilters += `,format_in:[${format}]`;
  if (country) extraFilters += `,countryOfOrigin:"${country}"`;
  const body = JSON.stringify({
    query: `query($s:String,$t:MediaType){Page(perPage:24){media(search:$s,type:$t,sort:SEARCH_MATCH${extraFilters}){id title{romaji english native}coverImage{large medium}startDate{year}description(asHtml:false)averageScore episodes chapters duration genres studios(isMain:true){nodes{name}}staff(perPage:2,sort:RELEVANCE){nodes{name{full}}}}}}`,
    variables: { s: query, t: mediaType },
  });
  const opts = { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body };
  const direct = "https://graphql.anilist.co";
  const proxy = workerUrl ? workerUrl.replace(/\/$/, "") + "/anilist" : null;
  const tryFetchJson = async (url) => {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) return null;
      const d = await r.json();
      if (d?.errors || !d?.data?.Page?.media?.length) return null;
      return d;
    } catch { return null; }
  };
  const urls = proxy ? [direct, proxy] : [direct];
  const results = await Promise.allSettled(urls.map(url => tryFetchJson(url)));
  const data = results.find(r => r.status === "fulfilled" && r.value)?.value;
  const items = data?.data?.Page?.media;
  if (!items?.length) return null;
  return items.map((m) => ({
    id: normalizeMediaId(`al-${type}-${m.id}`, type),
    title: m.title.english || m.title.romaji || m.title.native || "",
    titleEn: m.title.english || "",
    cover: m.coverImage?.large || m.coverImage?.medium || "",
    type,
    year: String(m.startDate?.year || ""),
    score: m.averageScore ? +(m.averageScore / 10).toFixed(1) : null,
    synopsis: (m.description || "").replace(/<[^>]*>/g, "").slice(0, 220),
    genres: (m.genres || []).slice(0, 4),
    extra: type === "anime" ? (m.studios?.nodes?.[0]?.name || "") : (m.staff?.nodes?.[0]?.name?.full || ""),
    source: "AniList",
    episodes: m.episodes || null,
    chapters: m.chapters || null,
    runtime: m.duration ? `${m.duration} min/ep` : null,
  }));
}

// Tenta várias URLs (direta + proxy do Worker) em paralelo, devolve o primeiro
// resultado válido. Usado por searchAniList, pelas trending abaixo, e também
// chamado diretamente do App.jsx com queries GraphQL à medida (recomendações,
// modal de personagens, export Mihon) — por isso tem de continuar exportado.
export async function fetchAniListSafe(urls, body) {
  const results = await Promise.allSettled(
    urls.map(async url => {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.data ? d : null;
    })
  );
  return results.find(r => r.status === "fulfilled" && r.value)?.value || null;
}

export async function fetchTrendingAnime(workerUrl) {
  const direct = "https://graphql.anilist.co";
  const proxy = workerUrl ? workerUrl.replace(/\/$/, "") + "/anilist" : null;
  const urls = proxy ? [direct, proxy] : [direct];
  const q1 = JSON.stringify({ query: `{ Page(page:1,perPage:25) { media(type:ANIME,sort:TRENDING_DESC,status_not:NOT_YET_RELEASED) { id title{romaji} coverImage{large} averageScore description(asHtml:false) } } }` });
  const q2 = JSON.stringify({ query: `{ Page(page:2,perPage:25) { media(type:ANIME,sort:TRENDING_DESC,status_not:NOT_YET_RELEASED) { id title{romaji} coverImage{large} averageScore description(asHtml:false) } } }` });
  const [d1, d2] = await Promise.all([fetchAniListSafe(urls, q1), fetchAniListSafe(urls, q2)]);
  const all = [...(d1?.data?.Page?.media || []), ...(d2?.data?.Page?.media || [])];
  if (!all.length) return [];
  return shuffle(all).map(m => ({ id: `al-anime-${m.id}`, title: m.title.romaji, cover: m.coverImage?.large, type: "anime", source: "AniList", score: m.averageScore, synopsis: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/\n+/g, " ").trim() : "" }));
}

export async function fetchTrendingManga(workerUrl) {
  const direct = "https://graphql.anilist.co";
  const proxy = workerUrl ? workerUrl.replace(/\/$/, "") + "/anilist" : null;
  const urls = proxy ? [direct, proxy] : [direct];
  const q1 = JSON.stringify({ query: `{ Page(page:1,perPage:25) { media(type:MANGA,sort:TRENDING_DESC) { id title{romaji} coverImage{large} averageScore description(asHtml:false) } } }` });
  const q2 = JSON.stringify({ query: `{ Page(page:2,perPage:25) { media(type:MANGA,sort:TRENDING_DESC) { id title{romaji} coverImage{large} averageScore description(asHtml:false) } } }` });
  const [d1, d2] = await Promise.all([fetchAniListSafe(urls, q1), fetchAniListSafe(urls, q2)]);
  const all = [...(d1?.data?.Page?.media || []), ...(d2?.data?.Page?.media || [])];
  if (!all.length) return [];
  return shuffle(all).map(m => ({ id: `al-manga-${m.id}`, title: m.title.romaji, cover: m.coverImage?.large, type: "manga", source: "AniList", score: m.averageScore, synopsis: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/\n+/g, " ").trim() : "" }));
}
