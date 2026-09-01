// ─── Detalhes extra por item (temporadas, elenco, trailers, etc.) ────────────
// Deteta a fonte pelo prefixo do id (tmdb-, igdb-, gb-, cv-, al-) e busca
// detalhes adicionais que a pesquisa inicial não trouxe.

export async function fetchMediaDetails(item, tmdbKey, workerUrl) {
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
  const fetchWithTimeout = (url, opts, ms = 8000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
  };
  try {
    const id = item.id || "";

    // TMDB filmes — vários formatos possíveis
    if (id.startsWith("tmdb-filmes-") || id.startsWith("tmdb-movie-")) {
      const tmdbId = id.replace("tmdb-filmes-", "").replace("tmdb-movie-", "");
      const [detailRes, creditsRes, videosRes, keywordsRes] = await Promise.allSettled([
        fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}&language=en-US`).then(r => r.json()),
        fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/credits&language=en-US`).then(r => r.json()),
        fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/videos&language=en-US`).then(r => r.json()),
        fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/keywords`).then(r => r.json()),
      ]);
      const d = detailRes.status === "fulfilled" ? detailRes.value : {};
      const c = creditsRes.status === "fulfilled" ? creditsRes.value : null;
      const vids = videosRes.status === "fulfilled" ? videosRes.value : null;
      const kws = keywordsRes.status === "fulfilled" ? keywordsRes.value : null;
      const cast = (c?.cast || []).slice(0, 20).map(p => ({
        id: p.id, name: p.name, character: p.character,
        image: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
      }));
      const directorData = (c?.crew || []).find(p => p.job === "Director");
      const director = directorData ? { id: directorData.id, name: directorData.name, image: directorData.profile_path ? `https://image.tmdb.org/t/p/w185${directorData.profile_path}` : null } : null;
      const videos = (vids?.results || []).filter(v => v.site === "YouTube" && ["Trailer","Teaser","Clip"].includes(v.type)).slice(0, 4).map(v => ({ id: v.key, name: v.name, type: v.type }));
      const keywords = (kws?.keywords || []).slice(0, 12).map(k => k.name);
      return { runtime: d.runtime ? `${d.runtime} min` : null, genres: d.genres?.map(g => g.name) || item.genres || [], synopsis: d.overview || item.synopsis || null, score: d.vote_average ? +d.vote_average.toFixed(1) : item.score, year: d.release_date?.slice(0, 4) || item.year, cast, director, videos, keywords };
    }

    // TMDB séries — vários formatos possíveis
    if (id.startsWith("tmdb-series-") || id.startsWith("tmdb-tv-")) {
      const tmdbId = id.replace("tmdb-series-", "").replace("tmdb-tv-", "");
      const [detailRes, creditsRes, videosRes, keywordsRes] = await Promise.allSettled([
        fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}&language=en-US`).then(r => r.json()),
        fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/credits&language=en-US`).then(r => r.json()),
        fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/videos&language=en-US`).then(r => r.json()),
        fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/keywords`).then(r => r.json()),
      ]);
      const d = detailRes.status === "fulfilled" ? detailRes.value : {};
      const c = creditsRes.status === "fulfilled" ? creditsRes.value : null;
      const vids = videosRes.status === "fulfilled" ? videosRes.value : null;
      const kws = keywordsRes.status === "fulfilled" ? keywordsRes.value : null;
      const cast = (c?.cast || []).slice(0, 20).map(p => ({
        id: p.id, name: p.name, character: p.character,
        image: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
      }));
      const creatorData = d.created_by?.[0];
      const director = creatorData ? { id: creatorData.id, name: creatorData.name, image: creatorData.profile_path ? `https://image.tmdb.org/t/p/w185${creatorData.profile_path}` : null } : null;
      const videos = (vids?.results || []).filter(v => v.site === "YouTube" && ["Trailer","Teaser","Clip"].includes(v.type)).slice(0, 4).map(v => ({ id: v.key, name: v.name, type: v.type }));
      const keywords = (kws?.results || kws?.keywords || []).slice(0, 12).map(k => k.name);
      const seasonsList = (d.seasons || []).filter(s => s.season_number > 0).map(s => ({ number: s.season_number, name: s.name, episodes: s.episode_count, airDate: s.air_date?.slice(0,4) || null, poster: s.poster_path ? `https://image.tmdb.org/t/p/w185${s.poster_path}` : null }));
      return { seasons: d.number_of_seasons, episodes: d.number_of_episodes, runtime: d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : null, genres: d.genres?.map(g => g.name) || item.genres || [], synopsis: d.overview || item.synopsis || null, score: d.vote_average ? +d.vote_average.toFixed(1) : item.score, status: d.status, cast, director, videos, keywords, seasonsList };
    }

    // IGDB jogos
    if (id.startsWith("igdb-")) {
      const igdbId = id.replace("igdb-", "");
      const [mainRes, videosRes, artworksRes, ttbRes] = await Promise.allSettled([
        // Campos sem time_to_beat (endpoint separada) e sem artworks inline
        fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "games", body: `fields name,summary,genres.name,platforms.name,franchises.name,collections.name,involved_companies.company.name,involved_companies.developer,first_release_date,total_rating,videos.video_id,videos.name; where id = ${igdbId}; limit 1;` }) }).then(r => r.json()),
        fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "game_videos", body: `fields video_id,name; where game = ${igdbId}; limit 5;` }) }).then(r => r.json()),
        fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "artworks", body: `fields image_id; where game = ${igdbId}; limit 8;` }) }).then(r => r.json()),

      ]);
      const g = (mainRes.status === "fulfilled" && Array.isArray(mainRes.value) && mainRes.value[0]) ? mainRes.value[0] : null;
      if (!g) return null;
      const developer = (g.involved_companies || []).find(c => c.developer)?.company?.name || g.involved_companies?.[0]?.company?.name || null;

      const videosFromMain = (g.videos || []).filter(v => v.video_id).map(v => ({ id: v.video_id, name: v.name || "Trailer" }));
      const videosFromEndpoint = (videosRes.status === "fulfilled" && Array.isArray(videosRes.value))
        ? videosRes.value.filter(v => v.video_id).map(v => ({ id: v.video_id, name: v.name || "Trailer" }))
        : [];
      const videos = videosFromEndpoint.length > 0 ? videosFromEndpoint : videosFromMain;
      const artworks = (artworksRes.status === "fulfilled" && Array.isArray(artworksRes.value))
        ? artworksRes.value.map(a => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${a.image_id}.jpg`)
        : [];
      const platforms = (g.platforms || []).map(p => p.name);
      const timeToBeat = null;
      return {
        synopsis: g.summary || null,
        genres: (g.genres || []).map(gg => gg.name),
        platforms,
        franchises: [...(g.franchises || []).map(f => f.name), ...(g.collections || []).map(c => c.name)].filter(Boolean),
        developer,
        videos,
        artworks,
        score: g.total_rating ? +(g.total_rating / 10).toFixed(1) : null,
      };
    }

    // Google Books — pesquisar pelo título+autor para obter detalhes
    if (id.startsWith("gb-")) {
      // Pesquisa com intitle + inauthor para maior precisão
      const titlePart = item.title ? `intitle:${item.title}` : "";
      const authorPart = item.extra ? `+inauthor:${item.extra}` : "";
      const searchQ = encodeURIComponent(titlePart + authorPart);
      const res = await fetch(`${wUrl}/books?q=${searchQ}`);
      if (!res.ok) return null;
      const data = await res.json();
      // Encontrar o volume com mais páginas (edição mais completa)
      const items = data?.items || [];
      const best = items.reduce((acc, cur) => {
        const pages = cur.volumeInfo?.pageCount || 0;
        return pages > (acc.volumeInfo?.pageCount || 0) ? cur : acc;
      }, items[0] || null);
      const vol = best?.volumeInfo;
      if (!vol) return null;
      return {
        synopsis: vol.description || null,
        genres: vol.categories || [],
        pages: vol.pageCount || null,
        publisher: vol.publisher || null,
        publishedDate: vol.publishedDate || null,
        language: vol.language || null,
        score: vol.averageRating || null,
      };
    }

    // ComicVine
    if (id.startsWith("cv-")) {
      const cvId = id.replace("cv-", "");
      const [volRes, charsRes] = await Promise.allSettled([
        fetch(`${wUrl}/comicvine?q=${cvId}&resource=volume`).then(r => r.json()),
        fetch(`${wUrl}/comicvine-char?q=${cvId}`).then(r => r.json()),
      ]);
      const vol = volRes.status === "fulfilled" ? volRes.value?.results?.[0] : null;
      const chars = charsRes.status === "fulfilled" && Array.isArray(charsRes.value) ? charsRes.value.slice(0, 12) : [];
      if (!vol && chars.length === 0) return null;
      return {
        synopsis: vol?.description?.replace(/<[^>]*>/g, "").slice(0, 800) || null,
        publisher: vol?.publisher?.name || null,
        startYear: vol?.start_year || null,
        issueCount: vol?.count_of_issues || null,
        cast: chars.map(c => ({ id: `cvchar-${c.id}`, name: c.name, image: c.image?.medium_url || null, role: "CHARACTER" })),
      };
    }

    // AniList — formatos: al-anime-123, al-manga-123, al-123
    if (id.startsWith("al-")) {
      const alId = id.replace(/^al-[a-z]+-/, "").replace(/^al-/, "");
      if (!alId || isNaN(Number(alId))) return null;
      // Race: direto vs worker — usa o mais rápido
      const aniBody = JSON.stringify({ query: `{
          Media(id:${alId}) {
            episodes chapters volumes averageScore status duration format bannerImage
            description(asHtml:false)
            characters(perPage:20, sort:ROLE) {
              edges {
                role
                node { id name { full } image { medium } }
                voiceActors(language:JAPANESE) { id name { full } image { medium } }
              }
            }
            relations {
              edges {
                relationType(version:2)
                node { id title { romaji } coverImage { medium } type format status }
              }
            }
          }
        }` });
      const aniOpts = { method: "POST", headers: { "Content-Type": "application/json" }, body: aniBody };
      // Race seguro: ignora erros individuais, usa o primeiro com dados válidos
      const aniResults = await Promise.allSettled([
        fetchWithTimeout("https://graphql.anilist.co", aniOpts, 6000).then(r => r.ok ? r.json() : null).catch(() => null),
        fetchWithTimeout(`${wUrl}/anilist`, aniOpts, 6000).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const d = aniResults.find(r => r.status === "fulfilled" && r.value?.data?.Media)?.value || null;
      const m = d?.data?.Media;
      if (!m) return null;
      const cast = (m.characters?.edges || []).map(e => ({
        id: e.node?.id,
        name: e.node?.name?.full || "",
        image: e.node?.image?.medium || null,
        role: e.role || "SUPPORTING",
        va: e.voiceActors?.[0] ? { name: e.voiceActors[0].name?.full || "", image: e.voiceActors[0].image?.medium || null } : null,
      }));
      const relations = (m.relations?.edges || []).map(e => ({
        type: e.relationType,
        id: e.node?.type === "ANIME" ? `al-anime-${e.node?.id}` : `al-manga-${e.node?.id}`,
        title: e.node?.title?.romaji || "",
        cover: e.node?.coverImage?.medium || null,
        format: e.node?.format || "",
        status: e.node?.status || "",
        mediaType: (e.node?.type || "").toLowerCase(),
      })).filter(r => ["PREQUEL","SEQUEL","SOURCE","ALTERNATIVE","SIDE_STORY","PARENT"].includes(r.type));
      return { episodes: m.episodes, chapters: m.chapters, volumes: m.volumes, runtime: m.duration ? `${m.duration} min/ep` : null, score: m.averageScore, status: m.status, synopsis: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/\n+/g, " ").trim() : null, bannerImage: m.bannerImage || null, cast, relations };
    }
  } catch (err) {
    console.error('[fetchMediaDetails] Erro:', err);
  }
  return null;
}
