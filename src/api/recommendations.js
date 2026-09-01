import { fetchAniListSafe } from './anilist';

// ─── Personalized Recommendations ────────────────────────────────────────────
// Usa a biblioteca do utilizador como "seed" (itens mais bem avaliados, ou
// completos, ou os primeiros disponíveis) para pedir recomendações relacionadas
// a cada API (AniList para anime/manga, TMDB para filmes/séries).

export async function fetchPersonalizedRecos(library, workerUrl) {
  try {
    const libItems = Object.values(library);
    if (libItems.length < 1) return [];

    const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");

    // IDs já na biblioteca
    const inLib = new Set(Object.keys(library));

    // Seeds: itens com rating ≥7 primeiro, depois completos, depois qualquer coisa
    const topRated = libItems.filter(i => i.userRating >= 7).sort((a, b) => (b.userRating || 0) - (a.userRating || 0)).slice(0, 20);
    const completed = libItems.filter(i => i.userStatus === "completo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 10);
    const seed = topRated.length >= 2 ? topRated : completed.length >= 2 ? completed : libItems.slice(0, 10);

    if (!seed.length) return [];

    const results = [];

    // Anime via AniList
    const animeSeeds = seed.filter(i => i.type === "anime" && i.id.startsWith("al-"));
    if (animeSeeds.length > 0) {
      try {
        const seedId = parseInt(animeSeeds[0].id.replace(/^al-[^-]+-/, "").replace(/^al-/, "")) || 0;
        if (seedId) {
          const animeRecoBody = JSON.stringify({ query: `{ Media(id:${seedId},type:ANIME) { recommendations(sort:RATING_DESC,perPage:15) { nodes { mediaRecommendation { id title{romaji} coverImage{large} averageScore } } } } }` });
          const d = await fetchAniListSafe(["https://graphql.anilist.co", wUrl + "/anilist"], animeRecoBody);
          (d?.data?.Media?.recommendations?.nodes || []).forEach(n => {
            const m = n.mediaRecommendation; if (!m) return;
            const id = `al-anime-${m.id}`;
            if (!inLib.has(id) && m.coverImage?.large) results.push({ id, title: m.title.romaji, cover: m.coverImage.large, type: "anime", source: "AniList", score: m.averageScore });
          });
        }
      } catch {}
    }

    // Manga via AniList
    const mangaSeeds = seed.filter(i => (i.type === "manga" || i.type === "manhwa") && i.id.startsWith("al-"));
    if (mangaSeeds.length > 0) {
      try {
        const seedId = parseInt(mangaSeeds[0].id.replace(/^al-[^-]+-/, "").replace(/^al-/, "")) || 0;
        if (seedId) {
          const mangaRecoBody = JSON.stringify({ query: `{ Media(id:${seedId},type:MANGA) { recommendations(sort:RATING_DESC,perPage:15) { nodes { mediaRecommendation { id title{romaji} coverImage{large} averageScore } } } } }` });
          const d2 = await fetchAniListSafe(["https://graphql.anilist.co", wUrl + "/anilist"], mangaRecoBody);
          (d2?.data?.Media?.recommendations?.nodes || []).forEach(n => {
            const m = n.mediaRecommendation; if (!m) return;
            const id = `al-manga-${m.id}`;
            if (!inLib.has(id) && m.coverImage?.large) results.push({ id, title: m.title.romaji, cover: m.coverImage.large, type: "manga", source: "AniList", score: m.averageScore });
          });
        }
      } catch {}
    }

    // Filmes via TMDB
    const filmeSeeds = seed.filter(i => i.type === "filmes" && (i.id.startsWith("tmdb-movie-") || i.id.startsWith("tmdb-filmes-")));
    if (filmeSeeds.length > 0) {
      try {
        const rawId = filmeSeeds[0].id.replace("tmdb-movie-", "").replace("tmdb-filmes-", "");
        const res = await fetch(`${wUrl}/tmdb?endpoint=/movie/${rawId}/recommendations&language=en-US`).then(r => r.json());
        (res?.results || []).slice(0, 12).forEach(m => {
          const id = `tmdb-filmes-${m.id}`;
          if (!inLib.has(id) && m.poster_path) results.push({ id, title: m.title, cover: `https://image.tmdb.org/t/p/w300${m.poster_path}`, type: "filmes", source: "TMDB", score: Math.round(m.vote_average * 10) });
        });
      } catch {}
    }

    // Séries via TMDB
    const serieSeeds = seed.filter(i => i.type === "series" && (i.id.startsWith("tmdb-tv-") || i.id.startsWith("tmdb-series-")));
    if (serieSeeds.length > 0) {
      try {
        const rawId = serieSeeds[0].id.replace("tmdb-tv-", "").replace("tmdb-series-", "");
        const res = await fetch(`${wUrl}/tmdb?endpoint=/tv/${rawId}/recommendations&language=en-US`).then(r => r.json());
        (res?.results || []).slice(0, 12).forEach(m => {
          const id = `tmdb-series-${m.id}`;
          if (!inLib.has(id) && m.poster_path) results.push({ id, title: m.name, cover: `https://image.tmdb.org/t/p/w300${m.poster_path}`, type: "series", source: "TMDB", score: Math.round(m.vote_average * 10) });
        });
      } catch {}
    }

    // Se não há resultados de nenhuma API, usar trending de anime como fallback
    if (results.length === 0) {
      try {
        const fallbackBody = JSON.stringify({ query: `{ Page(perPage:20) { media(type:ANIME, sort:TRENDING_DESC) { id title{romaji} coverImage{large} averageScore } } }` });
        const d = await fetchAniListSafe(["https://graphql.anilist.co", wUrl + "/anilist"], fallbackBody);
        (d?.data?.Page?.media || []).forEach(m => {
          const id = `al-anime-${m.id}`;
          if (!inLib.has(id) && m.coverImage?.large) results.push({ id, title: m.title.romaji, cover: m.coverImage.large, type: "anime", source: "AniList", score: m.averageScore });
        });
      } catch {}
    }

    // Embaralhar
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return results.filter(r => r.cover).slice(0, 20);
  } catch { return []; }
}
