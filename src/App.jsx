import { useState, useEffect, useCallback, useRef, useMemo, memo, createContext, useContext } from "react";
import { createClient } from '@supabase/supabase-js';

// ─── Supabase (SDK oficial) ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://kgclapivcpjqxbtomaue.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YhoOLoNbQda5iWgCUjLPvQ_HoO4uZ4B';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Configurações padrão (pré-definidas para todos os utilizadores) ──────────
const DEFAULT_TMDB_KEY = "a678e98d2bdf3f7065d2cd5b5ab6aa54";
const DEFAULT_WORKER_URL = "https://trackall-proxy.mcmeskajr.workers.dev";

// Wrapper simples para manter compatibilidade com o resto do código
const supa = {
  _user: null,

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    supa._user = data.user;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    supa._user = data.user;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
    supa._user = null;
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      supa._user = data.session.user;
      return data.session.user;
    }
    return null;
  },

  async getProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  },

  async upsertProfile(userId, profileData) {
    await supabase.from('profiles').update({ ...profileData, updated_at: new Date().toISOString() }).eq('id', userId);
  },

  async getLibrary(userId) {
    const { data } = await supabase.from('library').select('media_id, data').eq('user_id', userId);
    if (!data) return {};
    const lib = {};
    data.forEach(row => { lib[row.media_id] = row.data; });
    return lib;
  },

  async upsertLibraryItem(userId, mediaId, data) {
    await supabase.from('library').upsert({ user_id: userId, media_id: mediaId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,media_id' });
  },

  async deleteLibraryItem(userId, mediaId) {
    await supabase.from('library').delete().eq('user_id', userId).eq('media_id', mediaId);
  },

  async updateFavorites(userId, favorites) {
    await supabase.from('profiles').update({ favorites }).eq('id', userId);
  },

  async updateUsername(userId, username) {
    await supabase.from('profiles').update({ username }).eq('id', userId);
  },

  // ── Friends ──
  async searchUsers(query) {
    const { data } = await supabase.from('profiles')
      .select('id, name, username, avatar')
      .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(10);
    return data || [];
  },

  async sendFriendRequest(requesterId, addresseeId) {
    const { error } = await supabase.from('friendships').insert({ requester_id: requesterId, addressee_id: addresseeId });
    if (error) throw new Error(error.message);
  },

  async acceptFriendRequest(friendshipId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  },

  async declineFriendRequest(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
  },

  async removeFriend(requesterId, addresseeId) {
    await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`);
  },

  async getFriendships(userId) {
    const { data } = await supabase.from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (!data || data.length === 0) return [];

    // Collect all unique user IDs to fetch profiles for
    const userIds = [...new Set(data.flatMap(f => [f.requester_id, f.addressee_id]).filter(id => id !== userId))];
    const { data: profiles } = await supabase.from('profiles')
      .select('id, name, username, avatar')
      .in('id', userIds);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    return data.map(f => ({
      ...f,
      requester: profileMap[f.requester_id] || { id: f.requester_id, name: "Utilizador", username: "", avatar: "" },
      addressee: profileMap[f.addressee_id] || { id: f.addressee_id, name: "Utilizador", username: "", avatar: "" },
    }));
  },

  async getFriendLibrary(userId) {
    const { data } = await supabase.from('library').select('media_id, data').eq('user_id', userId);
    if (!data) return {};
    const lib = {};
    data.forEach(row => { lib[row.media_id] = row.data; });
    return lib;
  },

  async getFriendProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  },
};

// ─── Theme Context ────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);
const useTheme = () => useContext(ThemeContext);

const ACCENT_PRESETS = [
  { name: "Laranja", color: "#f97316" },
  { name: "Roxo", color: "#a855f7" },
  { name: "Ciano", color: "#06b6d4" },
  { name: "Rosa", color: "#ec4899" },
  { name: "Verde", color: "#10b981" },
  { name: "Azul", color: "#3b82f6" },
  { name: "Amarelo", color: "#eab308" },
  { name: "Vermelho", color: "#ef4444" },
];

const BG_PRESETS = [
  // Escuro
  { name: "Preto", value: "#080c10", dark: true },
  { name: "Escuro", value: "#0d1117", dark: true },
  { name: "Ardósia", value: "#0f172a", dark: true },
  { name: "Grafite", value: "#111827", dark: true },
  // Claro — warm off-white
  { name: "Papel", value: "#f5f0eb", dark: false },
  { name: "Creme", value: "#fdf6e3", dark: false },
  { name: "Nuvem", value: "#f0f4f8", dark: false },
  { name: "Branco", value: "#ffffff", dark: false },
];

// Detecta se uma cor hex é escura ou clara
function isColorDark(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance < 0.5;
}

// Gera 3 variações da cor de destaque para os blocos de estatísticas
// shade: 0 = original, 1 = deslocado +30° no hue, 2 = deslocado +60°
function accentShade(hex, shiftDeg) {
  const c = hex.replace("#", "");
  let r = parseInt(c.substr(0,2),16)/255;
  let g = parseInt(c.substr(2,2),16)/255;
  let b = parseInt(c.substr(4,2),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0, s = max === 0 ? 0 : d/max, v = max;
  if (d !== 0) {
    if (max === r) h = ((g-b)/d + 6) % 6;
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h = h * 60;
  }
  h = ((h + shiftDeg) % 360 + 360) % 360;
  const f = (n) => { const k=(n+h/60)%6; return v - v*s*Math.max(0, Math.min(k, 4-k, 1)); };
  const toHex = (x) => Math.round(x*255).toString(16).padStart(2,"0");
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MEDIA_TYPES = [
  { id: "all", label: "Todos", icon: "⊞" },
  { id: "anime", label: "Anime", icon: "⛩" },
  { id: "manga", label: "Manga", icon: "🗒" },
  { id: "series", label: "Séries", icon: "📺" },
  { id: "filmes", label: "Filmes", icon: "🎬" },
  { id: "jogos", label: "Jogos", icon: "🎮" },
  { id: "livros", label: "Livros", icon: "📚" },
  { id: "manhwa", label: "Manhwa", icon: "🇰🇷" },
  { id: "lightnovels", label: "Light Novels", icon: "✍" },
  { id: "comics", label: "Comics", icon: "💬" },
];

// Gera variações subtis do accent — hue ±10° + brilho ligeiramente diferente
function accentVariant(hex, index) {
  try {
    const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0;
    if (d) { h = max===r ? ((g-b)/d)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4; h = ((h*60)+360)%360; }
    const s = max ? d/max : 0;
    // Pequenas variações: hue ±10°, valor ±8%
    const shifts = [[0,0],[10,0.06],[-10,0.06],[18,-0.05],[-18,-0.05],[8,0.10]];
    const [dh, dv] = shifts[index % shifts.length];
    const nh = (h + dh + 360) % 360;
    const nv = Math.min(1, Math.max(0.3, max + dv));
    const hi = Math.floor(nh/60), f = nh/60-hi, p = nv*(1-s), q = nv*(1-f*s), tv = nv*(1-(1-f)*s);
    const [nr,ng,nb] = [[nv,tv,p],[q,nv,p],[p,nv,tv],[p,q,nv],[tv,p,nv],[nv,p,q]][hi];
    return '#'+[nr,ng,nb].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
  } catch { return hex; }
}

const TYPE_COLORS = {
  anime:       "#6366f1",
  manga:       "#dc2626",
  series:      "#0891b2",
  filmes:      "#d97706",
  jogos:       "#16a34a",
  livros:      "#7c3aed",
  manhwa:      "#db2777",
  lightnovels: "#9333ea",
  comics:      "#ea580c",
};

const STATUS_OPTIONS = [
  { id: "assistindo", label: "Em Curso", color: "#f97316", emoji: "▶" },
  { id: "completo", label: "Completo", color: "#10b981", emoji: "✓" },
  { id: "planejado", label: "Planejado", color: "#06b6d4", emoji: "⏰" },
  { id: "dropado", label: "Dropado", color: "#ef4444", emoji: "✕" },
  { id: "pausado", label: "Pausado", color: "#eab308", emoji: "⏸" },
];

// ─── Storage (Claude artifact + localStorage para APK/Capacitor) ──────────────
const DB = {
  async get(key) {
    // Tenta window.storage (Claude artifact)
    try {
      if (window.storage) {
        const r = await window.storage.get(key);
        if (r?.value != null) return r.value;
      }
    } catch {}
    // Fallback localStorage (APK / browser normal)
    try { return localStorage.getItem(key); } catch {}
    return null;
  },
  async set(key, val) {
    let ok = false;
    // Tenta window.storage primeiro
    try {
      if (window.storage) {
        const result = await window.storage.set(key, val);
        if (result) ok = true;
      }
    } catch {}
    // localStorage sempre (como backup e para APK)
    try { localStorage.setItem(key, val); ok = true; } catch {}
    return ok;
  },
};

// ─── Simple in-memory search cache (evita re-fetch da mesma query) ────────────
const CACHE = new Map();
function cacheKey(q, type) { return `${type}::${q.toLowerCase().trim()}`; }

// ─── APIs ─────────────────────────────────────────────────────────────────────

// 1. AniList — Anime, Manga, Manhwa, Light Novels (sem chave, CORS aberto)
async function searchAniList(query, type) {
  const mediaType = type === "anime" ? "ANIME" : "MANGA";
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query($s:String,$t:MediaType){Page(perPage:15){media(search:$s,type:$t,sort:SEARCH_MATCH){id title{romaji english native}coverImage{large medium}startDate{year}description(asHtml:false)averageScore genres studios(isMain:true){nodes{name}}staff(perPage:2,sort:RELEVANCE){nodes{name{full}}}}}}`,
      variables: { s: query, t: mediaType },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data?.data?.Page?.media;
  if (!items?.length) return null;
  return items.map((m, i) => ({
    id: `al-${type}-${m.id}`,
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
  }));
}

// 2. TMDB — Filmes & Séries (chave grátis: themoviedb.org/settings/api)
async function searchTMDB(query, type, key) {
  if (!key) return null;
  const ep = type === "filmes" ? "movie" : "tv";
  const res = await fetch(`https://api.themoviedb.org/3/search/${ep}?api_key=${key}&query=${encodeURIComponent(query)}&language=pt-PT&page=1`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results?.length) return null;
  return data.results.slice(0, 15).map((m) => ({
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
  }));
}

// Fetch extra details (seasons, runtime, episodes, etc.) for a specific item
async function fetchMediaDetails(item, tmdbKey) {
  try {
    if (item.id.startsWith("tmdb-filmes-")) {
      const tmdbId = item.id.replace("tmdb-filmes-", "");
      const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}&language=pt-PT`);
      const d = await r.json();
      return {
        runtime: d.runtime ? `${d.runtime} min` : null,
        genres: d.genres?.map(g => g.name) || item.genres || [],
        synopsis: d.overview || item.synopsis,
        score: d.vote_average ? +d.vote_average.toFixed(1) : item.score,
        year: d.release_date?.slice(0, 4) || item.year,
      };
    }
    if (item.id.startsWith("tmdb-series-")) {
      const tmdbId = item.id.replace("tmdb-series-", "");
      const r = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}&language=pt-PT`);
      const d = await r.json();
      return {
        seasons: d.number_of_seasons,
        episodes: d.number_of_episodes,
        runtime: d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : null,
        genres: d.genres?.map(g => g.name) || item.genres || [],
        synopsis: d.overview || item.synopsis,
        score: d.vote_average ? +d.vote_average.toFixed(1) : item.score,
        status: d.status,
      };
    }
    if (item.id.startsWith("al-")) {
      const alId = item.id.replace("al-", "");
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ Media(id:${alId}) { episodes chapters volumes averageScore status duration format } }` }),
      });
      const d = await r.json();
      const m = d.data?.Media;
      if (!m) return null;
      return {
        episodes: m.episodes,
        chapters: m.chapters,
        volumes: m.volumes,
        runtime: m.duration ? `${m.duration} min/ep` : null,
        score: m.averageScore,
        status: m.status,
      };
    }
  } catch {}
  return null;
}

// 3. OpenLibrary — Livros (sem chave, CORS aberto)
async function searchOpenLibrary(query) {
  const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=15&fields=key,title,author_name,first_publish_year,cover_i,subject,ratings_average`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.docs?.length) return null;
  return data.docs.slice(0, 15).map((b) => ({
    id: `ol-${b.key?.replace(/\//g, "-")}`,
    title: b.title || "",
    cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : "",
    type: "livros",
    year: String(b.first_publish_year || ""),
    score: b.ratings_average ? +b.ratings_average.toFixed(1) : null,
    synopsis: "",
    genres: (b.subject || []).slice(0, 4),
    extra: (b.author_name || []).join(", ").slice(0, 60),
    source: "OpenLibrary",
  }));
}

// 4. IGDB via Proxy Worker + Steam fallback
// O Worker esconde as chaves e resolve o CORS.
// workerUrl = "https://trackall-proxy.teu-nome.workers.dev"
const SC = (id) => id ? `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg` : "";
const SB = (id) => id ? `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg` : "";

async function searchIGDB(query, workerUrl) {
  if (!workerUrl) return null;
  const url = workerUrl.replace(/\/$/, "") + "/igdb";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: `search "${query}"; fields name,cover.url,first_release_date,summary,total_rating,genres.name,involved_companies.company.name,external_games.uid,external_games.category,platforms.name; limit 15; where version_parent = null;`,
  });
  if (!res.ok) return null;
  const games = await res.json();
  if (!Array.isArray(games) || !games.length) return null;
  return games.map((g) => {
    const steam = g.external_games?.find(e => e.category === 1);
    const steamId = steam?.uid || null;
    const igdbCover = g.cover?.url ? "https:" + g.cover.url.replace("t_thumb", "t_cover_big") : "";
    return {
      id: `igdb-${g.id}`,
      title: g.name || "",
      cover: steamId ? SC(steamId) : igdbCover,
      coverFallback: igdbCover,
      backdrop: steamId ? SB(steamId) : "",
      type: "jogos",
      year: g.first_release_date ? String(new Date(g.first_release_date * 1000).getFullYear()) : "",
      score: g.total_rating ? +(g.total_rating / 10).toFixed(1) : null,
      synopsis: (g.summary || "").slice(0, 220),
      genres: (g.genres || []).map(gr => gr.name).slice(0, 4),
      extra: g.involved_companies?.[0]?.company?.name || "",
      platforms: (g.platforms || []).map(p => p.name).join(", "),
      source: steamId ? "IGDB+Steam" : "IGDB",
      steamAppId: steamId,
    };
  });
}

async function searchSteam(query) {
  const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=portuguese&cc=PT`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;
  return data.items.slice(0, 15).map((g) => ({
    id: `steam-${g.id}`,
    title: g.name || "",
    cover: SC(g.id),
    backdrop: SB(g.id),
    type: "jogos",
    year: "",
    score: null,
    synopsis: g.tiny_desc || "",
    genres: [],
    extra: "",
    source: "Steam",
    steamAppId: g.id,
  }));
}

// 5. ComicVine via Proxy Worker
// O Worker resolve o CORS que bloqueia chamadas diretas de browser/webview.
async function searchComicVine(query, workerUrl) {
  if (!workerUrl) return null;
  const url = workerUrl.replace(/\/$/, "") + `/comicvine?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results?.length) return null;
  return data.results.slice(0, 15).map((c) => ({
    id: `cv-${c.id}`,
    title: c.name || "",
    cover: c.image?.medium_url || c.image?.small_url || "",
    type: "comics",
    year: String(c.start_year || ""),
    score: null,
    synopsis: (c.deck || "").slice(0, 220),
    genres: [],
    extra: c.publisher?.name || "",
    source: "ComicVine",
  }));
}

// ─── smartSearch — escolhe a melhor API por tipo ──────────────────────────────
async function smartSearch(query, mediaType, keys = {}) {
  const ck = cacheKey(query, mediaType);
  if (CACHE.has(ck)) return CACHE.get(ck);

  let results = null;
  try {
    if (mediaType === "anime") results = await searchAniList(query, "anime");
    else if (mediaType === "manga") results = await searchAniList(query, "manga");
    else if (mediaType === "manhwa") { const r = await searchAniList(query, "manga"); results = r?.map(x => ({ ...x, type: "manhwa" })); }
    else if (mediaType === "lightnovels") { const r = await searchAniList(query, "manga"); results = r?.map(x => ({ ...x, type: "lightnovels" })); }
    else if (mediaType === "filmes") results = await searchTMDB(query, "filmes", keys.tmdb);
    else if (mediaType === "series") results = await searchTMDB(query, "series", keys.tmdb);
    else if (mediaType === "livros") results = await searchOpenLibrary(query);
    else if (mediaType === "jogos") {
      // Tenta IGDB via Worker primeiro; fallback para Steam
      results = await searchIGDB(query, keys.workerUrl);
      if (!results?.length) results = await searchSteam(query);
    }
    else if (mediaType === "comics") results = await searchComicVine(query, keys.workerUrl);
  } catch {}

  if (results?.length) {
    CACHE.set(ck, results);
    if (CACHE.size > 50) CACHE.delete(CACHE.keys().next().value);
    return results;
  }
  return [];
}

// ─── Placeholder Gradients ─────────────────────────────────────────────────────
const GRADIENTS = [
  ["#1a0533","#4a0080"],["#0d1f2d","#1a5276"],["#1a1a00","#7d6608"],
  ["#1a0000","#7b241c"],["#0a2e1a","#1e8449"],["#0d0d2b","#1a237e"],
  ["#1c0a2e","#6b21a8"],["#0a1628","#1e3a5f"],["#1a0a00","#7c3a00"],
  ["#001a1a","#006666"],
];
const gradientFor = (id) => {
  const i = Math.abs((id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % GRADIENTS.length;
  return `linear-gradient(145deg, ${GRADIENTS[i][0]} 0%, ${GRADIENTS[i][1]} 100%)`;
};

// ─── Star Rating Component ─────────────────────────────────────────────────────
function StarRating({ value = 0, onChange, size = 16, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  // Each star = 1 point, but we support 0.5 increments
  // We render 10 stars, each star can be empty, half, or full
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1,2,3,4,5,6,7,8,9,10].map((star) => {
        const full = active >= star;
        const half = !full && active >= star - 0.5;
        return (
          <div
            key={star}
            style={{ position: "relative", width: size, height: size, cursor: readOnly ? "default" : "pointer", flexShrink: 0 }}
            onMouseLeave={() => !readOnly && setHover(0)}
          >
            {/* Background star */}
            <span style={{ fontSize: size, color: "#374151", lineHeight: 1, userSelect: "none" }}>★</span>
            {/* Filled overlay */}
            {(full || half) && (
              <span style={{
                position: "absolute", left: 0, top: 0, fontSize: size, color: "#f59e0b",
                lineHeight: 1, overflow: "hidden", width: full ? "100%" : "50%", userSelect: "none",
              }}>★</span>
            )}
            {/* Left half hitbox (X - 0.5) */}
            <div
              style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%" }}
              onMouseEnter={() => !readOnly && setHover(star - 0.5)}
              onClick={() => !readOnly && onChange && onChange(value === star - 0.5 ? 0 : star - 0.5)}
            />
            {/* Right half hitbox (X) */}
            <div
              style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }}
              onMouseEnter={() => !readOnly && setHover(star)}
              onClick={() => !readOnly && onChange && onChange(value === star ? 0 : star)}
            />
          </div>
        );
      })}
      {active > 0 && !readOnly && (
        <span style={{ fontSize: size * 0.8, color: "#f59e0b", fontWeight: 700, marginLeft: 4 }}>{active}</span>
      )}
      {readOnly && value > 0 && (
        <span style={{ fontSize: size * 0.8, color: "#f59e0b", fontWeight: 700, marginLeft: 4 }}>{value}</span>
      )}
    </div>
  );
}

// ─── Notification ──────────────────────────────────────────────────────────────
function Notification({ notif }) {
  if (!notif) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: notif.color || "#10b981", color: "white",
      padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      animation: "slideIn 0.25s cubic-bezier(.34,1.56,.64,1)",
    }}>
      {notif.msg}
    </div>
  );
}

// ─── Image utils ───────────────────────────────────────────────────────────────
// Compresses an image File to a base64 JPEG ≤ 300 KB (portrait 400×600)
function compressImage(file, maxW = 600, maxH = 900, quality = 0.92) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Banner — alta qualidade
function compressBanner(file) {
  return compressImage(file, 1200, 400, 0.90);
}

// ─── Mihon Backup Parser ──────────────────────────────────────────────────────

async function parseMihonBackup(file) {
  const ab = await file.arrayBuffer();
  let data = new Uint8Array(ab);

  // Gzip decompress
  try {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter();
    const r = ds.readable.getReader();
    w.write(data); w.close();
    const chunks = [];
    while (true) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    data = new Uint8Array(total); let off = 0;
    for (const c of chunks) { data.set(c, off); off += c.length; }
  } catch {}

  // Protobuf parser (supports varint, length-delimited, float32, int64)
  function readVarint(buf, pos) {
    let val = 0, shift = 0;
    while (pos < buf.length) {
      const b = buf[pos++]; val = val + ((b & 0x7F) * Math.pow(2, shift)); shift += 7;
      if (!(b & 0x80)) break;
    }
    return { val, pos };
  }

  function parseMsg(buf, start, end) {
    const fields = {}; let pos = start || 0; const lim = end ?? buf.length;
    while (pos < lim) {
      const tr = readVarint(buf, pos); pos = tr.pos;
      const fn = tr.val >>> 3, wt = tr.val & 7;
      if (!fields[fn]) fields[fn] = [];
      if (wt === 0) {
        const r = readVarint(buf, pos); pos = r.pos; fields[fn].push({ t: 0, v: r.val });
      } else if (wt === 2) {
        const lr = readVarint(buf, pos); pos = lr.pos; const len = lr.val;
        if (pos + len > lim) break;
        const bytes = buf.slice(pos, pos + len); pos += len;
        let str = null; try { str = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {}
        fields[fn].push(str !== null ? { t: 2, bytes, str } : { t: 2, bytes, str: null });
      } else if (wt === 5) {
        // 32-bit float (little-endian)
        if (pos + 4 <= lim) {
          const view = new DataView(buf.buffer, buf.byteOffset + pos, 4);
          fields[fn].push({ t: 5, v: view.getFloat32(0, true) });
        }
        pos += 4;
      } else if (wt === 1) {
        pos += 8; // skip 64-bit
      } else break;
    }
    return fields;
  }

  // Root: field 1 = repeated BackupManga
  const root = parseMsg(data, 0, data.length);
  const mangaEntries = root[1] || [];
  const results = [];

  for (const entry of mangaEntries) {
    if (entry.t !== 2) continue;
    const f = parseMsg(entry.bytes, 0, entry.bytes.length);

    const gs = (n) => f[n]?.[0]?.str || '';
    const gi = (n) => f[n]?.[0]?.v ?? 0;

    const title = gs(3); if (!title) continue;
    const url = gs(2);
    const thumbnailUrl = gs(9);
    // field 111 = isFavorite (1=true)
    const isFavorite = gi(111) === 1;

    // field 16 = repeated BackupChapter
    const chapRaw = f[16] || [];
    const chapters = chapRaw.map(cf => {
      if (cf.t !== 2) return null;
      const ch = parseMsg(cf.bytes, 0, cf.bytes.length);
      const name = ch[2]?.[0]?.str || '';
      // f4=1 means READ (boolean), f6>0 means lastPageRead (partially read)
      const read = (ch[4]?.[0]?.v ?? 0) === 1;
      const lastPage = ch[6]?.[0]?.v ?? 0;
      // f9 = float chapter number (wire type 5)
      const chNum = ch[9]?.[0]?.v ?? -1;
      return { name, read, lastPage, chNum };
    }).filter(Boolean);

    const total = chapters.length;
    const readList = chapters.filter(c => c.read);
    const readCount = readList.length;

    // Last read = highest chapter number among fully read ones
    // fallback to highest with lastPage>0 (partially opened)
    let lastChapter = null;
    if (readList.length > 0) {
      const byNum = [...readList].sort((a, b) => b.chNum - a.chNum);
      lastChapter = byNum[0].name || `Cap. ${Math.round(byNum[0].chNum)}`;
    } else {
      const partial = chapters.filter(c => c.lastPage > 0).sort((a, b) => b.chNum - a.chNum);
      if (partial.length > 0) lastChapter = partial[0].name || `Cap. ${Math.round(partial[0].chNum)}`;
    }

    let userStatus = 'planejado';
    if (readCount > 0 && readCount < total) userStatus = 'assistindo';
    else if (readCount > 0 && total > 0 && readCount >= total) userStatus = 'completo';

    results.push({
      id: `mihon-${url.replace(/[^a-z0-9]/gi, '-')}`,
      title, thumbnailUrl, url, type: 'manga',
      userStatus, chaptersRead: readCount, totalChapters: total,
      lastChapter, source: 'Mihon', cover: thumbnailUrl,
    });
  }
  return results;
}

// ─── Google Drive OAuth helper ────────────────────────────────────────────────
// Client ID criado em console.cloud.google.com — o utilizador tem de inserir o seu
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

async function driveGetToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) { reject(new Error('GIS não carregado')); return; }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function driveFindBackups(token) {
  const q = encodeURIComponent("name contains '.tachibk' or name contains '.proto'");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime+desc&pageSize=10&fields=files(id,name,modifiedTime,size)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files || [];
}

async function driveDownloadFile(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const ab = await res.arrayBuffer();
  // wrap as File-like object
  return { arrayBuffer: () => Promise.resolve(ab) };
}

function MihonImportModal({ onClose, onImport, accent, darkMode, driveClientId, onSaveClientId }) {
  const [step, setStep] = useState('choose'); // choose | drive_files | upload | preview | done
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});
  const [driveFiles, setDriveFiles] = useState([]);
  const [token, setToken] = useState(null);
  const [clientIdInput, setClientIdInput] = useState(driveClientId || '');
  const fileRef = useRef();

  const processFile = async (fileLike) => {
    setLoading(true); setError('');
    try {
      const parsed = await parseMihonBackup(fileLike);
      if (!parsed.length) { setError('Nenhum manga encontrado. Certifica-te que é um ficheiro .tachibk válido.'); setLoading(false); return; }
      const sel = {};
      parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError('Erro: ' + err.message); }
    setLoading(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    await processFile(file);
  };

  const connectDrive = async () => {
    if (!clientIdInput.trim()) { setError('Insere o Client ID do Google primeiro.'); return; }
    if (onSaveClientId) onSaveClientId(clientIdInput.trim());
    setLoading(true); setError('');
    try {
      // Load GIS script if needed
      if (!window.google?.accounts?.oauth2) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar Google'));
          document.head.appendChild(s);
        });
        await new Promise(r => setTimeout(r, 500));
      }
      const t = await driveGetToken(clientIdInput.trim());
      setToken(t);
      const files = await driveFindBackups(t);
      if (!files.length) { setError('Nenhum ficheiro .tachibk encontrado no Google Drive.'); setLoading(false); return; }
      setDriveFiles(files); setStep('drive_files');
    } catch (err) { setError('Erro Google Drive: ' + err.message); }
    setLoading(false);
  };

  const downloadAndImport = async (fileId) => {
    setLoading(true); setError('');
    try {
      const fileLike = await driveDownloadFile(token, fileId);
      await processFile(fileLike);
    } catch (err) { setError('Erro ao descarregar: ' + err.message); setLoading(false); }
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };

  const statusLabel = { assistindo: '▶ Em Curso', completo: '✓ Completo', planejado: '⏰ Planejado' };
  const statusColor = { assistindo: accent, completo: '#10b981', planejado: '#06b6d4' };
  const bg = darkMode ? '#161b22' : '#ffffff';
  const border = darkMode ? '#30363d' : '#e2e8f0';
  const subBg = darkMode ? '#0d1117' : '#f8fafc';

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📚</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Importar do Mihon</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>
                {step === 'choose' && 'Escolhe como importar'}
                {step === 'drive_files' && `${driveFiles.length} backups encontrados`}
                {step === 'upload' && 'Upload manual'}
                {step === 'preview' && `${items.length} mangas encontrados`}
                {step === 'done' && 'Importação concluída!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* STEP: choose */}
        {step === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Google Drive option */}
            <div style={{ background: subBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>☁️</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>Google Drive <span style={{ fontSize: 10, background: `${accent}22`, color: accent, borderRadius: 6, padding: '1px 6px', marginLeft: 4 }}>AUTOMÁTICO</span></p>
                  <p style={{ fontSize: 11, color: '#8b949e' }}>Liga ao Drive e sincroniza com 1 clique</p>
                </div>
              </div>

              <input
                placeholder="Google Client ID (ex: 123...apps.googleusercontent.com)"
                value={clientIdInput}
                onChange={e => setClientIdInput(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8, marginBottom: 8, background: bg }}
              />

              {/* Setup instructions */}
              <details style={{ marginBottom: 10 }}>
                <summary style={{ fontSize: 11, color: accent, cursor: 'pointer', fontWeight: 700 }}>📋 Como obter o Client ID?</summary>
                <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.7, marginTop: 8, paddingLeft: 8 }}>
                  <p>1. Vai a <strong>console.cloud.google.com</strong></p>
                  <p>2. Cria projeto → <strong>APIs & Services</strong> → <strong>Credentials</strong></p>
                  <p>3. <strong>Create OAuth Client ID</strong> → Web Application</p>
                  <p>4. Em "Authorized JavaScript origins" adiciona:<br />
                    <code style={{ background: '#21262d', padding: '1px 4px', borderRadius: 3 }}>https://teu-app.vercel.app</code>
                  </p>
                  <p>5. Ativa a <strong>Google Drive API</strong> no projeto</p>
                  <p>6. Copia o Client ID para aqui</p>
                </div>
              </details>

              <button onClick={connectDrive} disabled={loading} style={{
                width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                background: loading ? '#21262d' : `linear-gradient(135deg, #4285f4, #34a853)`,
                color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? <span className="spin">◌</span> : '☁️'} {loading ? 'A conectar...' : 'Ligar ao Google Drive'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: border }} />
              <span style={{ fontSize: 11, color: '#484f58' }}>ou</span>
              <div style={{ flex: 1, height: 1, background: border }} />
            </div>

            {/* Manual upload option */}
            <button onClick={() => setStep('upload')} style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: `1px dashed ${accent}66`, background: `${accent}11`,
              color: accent, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700,
            }}>
              📂 Upload manual do ficheiro .tachibk
            </button>

            {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* STEP: drive_files */}
        {step === 'drive_files' && (
          <div>
            <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>Seleciona o backup para importar:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {driveFiles.map(f => (
                <button key={f.id} onClick={() => downloadAndImport(f.id)} disabled={loading} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 10,
                  background: subBg, border: `1px solid ${border}`,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>📦 {f.name}</p>
                    <p style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                      {new Date(f.modifiedTime).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {f.size && ` · ${(f.size / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                  {loading ? <span className="spin" style={{ color: accent }}>◌</span> : <span style={{ color: accent, fontSize: 18 }}>→</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setStep('choose')} style={{ width: '100%', padding: 10, background: darkMode ? '#21262d' : '#f1f5f9', border: 'none', borderRadius: 10, color: darkMode ? '#e6edf3' : '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}>← Voltar</button>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* STEP: upload manual */}
        {step === 'upload' && (
          <div>
            <div style={{ background: subBg, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
              <p style={{ fontWeight: 700, color: accent, marginBottom: 6 }}>📱 Como exportar do Mihon:</p>
              <p>1. Abre o Mihon → <strong>Mais</strong> → <strong>Backup e Restauro</strong></p>
              <p>2. Carrega em <strong>Criar backup</strong> → guarda o ficheiro</p>
              <p>3. Seleciona o ficheiro <code style={{ background: '#21262d', padding: '1px 4px', borderRadius: 3 }}>.tachibk</code> abaixo</p>
            </div>
            <input ref={fileRef} type="file" accept=".tachibk,.proto,.bak" style={{ display: 'none' }} onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} disabled={loading} style={{
              width: '100%', padding: 14, borderRadius: 12, border: `2px dashed ${accent}66`,
              background: `${accent}11`, color: accent, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? <span className="spin">◌</span> : '📂'} {loading ? 'A processar...' : 'Selecionar ficheiro .tachibk'}
            </button>
            <button onClick={() => setStep('choose')} style={{ width: '100%', padding: 10, marginTop: 8, background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← Voltar</button>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)} style={{ fontSize: 11, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Todos</button>
                <button onClick={() => toggleAll(false)} style={{ fontSize: 11, color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Nenhum</button>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {items.map(m => (
                <div key={m.id} onClick={() => setSelected(s => ({ ...s, [m.id]: !s[m.id] }))} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: selected[m.id] ? `${accent}11` : subBg,
                  border: `1px solid ${selected[m.id] ? accent + '44' : border}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected[m.id] ? accent : '#30363d'}`, background: selected[m.id] ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected[m.id] && <span style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>✓</span>}
                  </div>
                  {m.thumbnailUrl ? (
                    <img src={m.thumbnailUrl} alt="" style={{ width: 32, height: 46, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} onError={e => e.currentTarget.style.display='none'} />
                  ) : (
                    <div style={{ width: 32, height: 46, borderRadius: 4, background: '#21262d', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🗒</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[m.userStatus] }}>{statusLabel[m.userStatus]}</span>
                      {m.lastChapter && <span style={{ fontSize: 10, color: '#8b949e' }}>· {m.lastChapter}</span>}
                      {m.totalChapters > 0 && <span style={{ fontSize: 10, color: '#484f58' }}>({m.chaptersRead}/{m.totalChapters})</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('choose')} style={{ flex: 1, padding: 12, background: darkMode ? '#21262d' : '#f1f5f9', border: 'none', borderRadius: 10, color: darkMode ? '#e6edf3' : '#0d1117', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>← Voltar</button>
              <button onClick={handleImport} style={{ flex: 2, padding: 12, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14 }}>
                Importar {Object.values(selected).filter(Boolean).length} mangas
              </button>
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Importado com sucesso!</h3>
            <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 20 }}>Os teus mangas do Mihon já estão na biblioteca.</p>
            <button onClick={onClose} className="btn-accent" style={{ padding: '10px 28px', fontSize: 14 }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}



function CropModal({ imageSrc, aspectRatio = 1, onSave, onClose, title = "Recortar imagem" }) {
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [startDrag, setStartDrag] = useState(null);
  const imgRef = useRef(null);

  const CANVAS_W = aspectRatio > 1 ? 900 : 320;
  const CANVAS_H = Math.round(CANVAS_W / aspectRatio);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      const initScale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
      setScale(initScale);
      setOffset({ x: (CANVAS_W - img.width * initScale) / 2, y: (CANVAS_H - img.height * initScale) / 2 });
      setImgSize({ w: img.width, h: img.height });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => { drawCanvas(); }, [offset, scale, imgSize]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(imgRef.current, offset.x, offset.y, imgSize.w * scale, imgSize.h * scale);
  };

  const clampOffset = (ox, oy, s) => {
    const iw = imgSize.w * s, ih = imgSize.h * s;
    return {
      x: Math.min(0, Math.max(CANVAS_W - iw, ox)),
      y: Math.min(0, Math.max(CANVAS_H - ih, oy)),
    };
  };

  const onMouseDown = (e) => { setDrag(true); setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y }); };
  const onMouseMove = (e) => {
    if (!drag || !startDrag) return;
    const newOff = clampOffset(e.clientX - startDrag.x, e.clientY - startDrag.y, scale);
    setOffset(newOff);
  };
  const onMouseUp = () => { setDrag(false); setStartDrag(null); };
  const onTouchStart = (e) => { const t = e.touches[0]; setDrag(true); setStartDrag({ x: t.clientX - offset.x, y: t.clientY - offset.y }); };
  const onTouchMove = (e) => {
    if (!drag || !startDrag) return;
    const t = e.touches[0];
    const newOff = clampOffset(t.clientX - startDrag.x, t.clientY - startDrag.y, scale);
    setOffset(newOff);
  };

  const handleZoom = (delta) => {
    const newScale = Math.max(scale + delta, Math.max(CANVAS_W / imgSize.w, CANVAS_H / imgSize.h));
    const newOff = clampOffset(offset.x, offset.y, newScale);
    setScale(newScale);
    setOffset(newOff);
  };

  const handleSave = () => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgRef.current, offset.x, offset.y, imgSize.w * scale, imgSize.h * scale);
    onSave(canvas.toDataURL("image/jpeg", 0.95));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#161b22", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>{title}</h3>
        <div style={{ borderRadius: 12, overflow: "hidden", cursor: drag ? "grabbing" : "grab", marginBottom: 16, touchAction: "none" }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W} height={CANVAS_H}
            style={{ display: "block", width: "100%" }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
          />
        </div>
        <p style={{ fontSize: 11, color: "#484f58", textAlign: "center", marginBottom: 12 }}>Arrasta para reposicionar</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <button onClick={() => handleZoom(-0.1)} style={{ padding: "6px 16px", background: "#21262d", border: "none", borderRadius: 8, color: "#e6edf3", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>−</button>
          <span style={{ color: "#8b949e", fontSize: 12, alignSelf: "center" }}>Zoom</span>
          <button onClick={() => handleZoom(0.1)} style={{ padding: "6px 16px", background: "#21262d", border: "none", borderRadius: 8, color: "#e6edf3", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>+</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: 12, background: "#f97316", border: "none", borderRadius: 10, color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>✓ Guardar</button>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Cover Edit Modal ──────────────────────────────────────────────────────────
function CoverEditModal({ item, onSave, onClose }) {
  const [url, setUrl] = useState(item.customCover || item.cover || "");
  const [preview, setPreview] = useState(item.customCover || item.cover || "");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const compressed = await compressImage(file);
    setLoading(false);
    if (compressed) { setUrl(compressed); setPreview(compressed); }
  };

  const handleUrlChange = (v) => { setUrl(v); setPreview(v); };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in" style={{ maxWidth: 440, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>🖼 Alterar Capa</h3>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {/* Preview */}
          <div style={{
            width: 110, height: 158, borderRadius: 10, overflow: "hidden", flexShrink: 0,
            background: gradientFor(item.id), border: "2px dashed #30363d",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            {loading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="spin" style={{ fontSize: 24 }}>◌</span>
              </div>
            )}
            {preview
              ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setPreview("")} />
              : <span style={{ color: "#484f58", fontSize: 32 }}>🖼</span>}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              placeholder="URL da imagem..."
              value={url.startsWith("data:") ? "" : url}
              onChange={(e) => handleUrlChange(e.target.value)}
              style={{ padding: "10px 12px", fontSize: 13, width: "100%" }}
            />
            <div style={{ textAlign: "center", color: "#484f58", fontSize: 11 }}>ou</div>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{
              padding: "10px", borderRadius: 8, border: "1px dashed #30363d",
              background: "transparent", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            }}>📁 Escolher ficheiro</button>
            {item.cover && url !== item.cover && !url.startsWith("data:") && (
              <button onClick={() => { setUrl(item.cover); setPreview(item.cover); }} style={{
                padding: "8px", borderRadius: 8, border: "1px solid #30363d",
                background: "transparent", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
              }}>↩ Restaurar original</button>
            )}
            {url && (
              <button onClick={() => { setUrl(""); setPreview(""); }} style={{
                padding: "8px", borderRadius: 8, border: "1px solid #ef444444",
                background: "transparent", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
              }}>🗑 Remover capa</button>
            )}
            <p style={{ fontSize: 10, color: "#484f58", marginTop: 2 }}>Ficheiros são comprimidos automaticamente</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-accent" style={{ flex: 1, padding: "12px" }} onClick={() => onSave(url)} disabled={loading}>
            {loading ? "A comprimir..." : "Guardar"}
          </button>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", background: "#21262d", border: "none",
            borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
          }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ item, library, onAdd, onRemove, onUpdateStatus, onUpdateRating, onChangeCover, onUpdateLastChapter, onClose, accent, favorites = [], onToggleFavorite, tmdbKey }) {
  const [coverEdit, setCoverEdit] = useState(false);
  const [addRating, setAddRating] = useState(0);
  const [detailExtra, setDetailExtra] = useState(null);
  const [chapterInput, setChapterInput] = useState("");
  const CHAPTER_TYPES = ["manga", "manhwa", "lightnovels", "comics"];
  useEffect(() => {
    setDetailExtra(null);
    if (item && tmdbKey) fetchMediaDetails(item, tmdbKey).then(d => { if (d) setDetailExtra(d); });
    const lb = library[item.id];
    setChapterInput(lb?.lastChapter || "");
  }, [item?.id]);
  const inLib = !!library[item.id];
  const libItem = library[item.id];
  const isChapterType = CHAPTER_TYPES.includes(item.type);
  const coverSrc = libItem?.customCover || item.customCover || item.cover;
  const isFavorite = favorites.some(f => f.id === item.id);
  const canAddFavorite = !isFavorite && favorites.length < 30;
  return (
    <>
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in" style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto", padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* Hero backdrop */}
        <div style={{
          height: 180, background: item.backdrop ? `url(${item.backdrop}) center/cover` : (coverSrc ? `url(${coverSrc}) center/cover` : gradientFor(item.id)),
          position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(22,27,34,0.95) 100%)" }} />
          <button onClick={onClose} style={{
            position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999,
            background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "flex", gap: 16, marginTop: -60, position: "relative", zIndex: 2 }}>
            {/* Cover */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 110, height: 160, borderRadius: 10, overflow: "hidden", border: "3px solid #161b22", background: gradientFor(item.id), boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    const fb = item.coverFallback;
                    if (fb && e.currentTarget.src !== fb) { e.currentTarget.src = fb; }
                    else { e.currentTarget.style.display = "none"; }
                  }} />}
              </div>
              {inLib && (
                <button onClick={() => setCoverEdit(true)} style={{
                  position: "absolute", bottom: 4, right: 4, width: 26, height: 26,
                  borderRadius: 999, background: `${accent}`, border: "none",
                  cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                }} title="Alterar capa">🖊</button>
              )}
            </div>

            <div style={{ flex: 1, paddingTop: 40 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                <span style={{ background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  {MEDIA_TYPES.find((t) => t.id === item.type)?.icon} {MEDIA_TYPES.find((t) => t.id === item.type)?.label}
                </span>
                {item.year && <span style={{ background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{item.year}</span>}
                {item.score && <span style={{ background: "#1a2e1a", color: "#10b981", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>⭐ {item.score}</span>}
                {item.source && <span style={{ background: "#1a1f2e", color: "#6e9cf7", padding: "2px 8px", borderRadius: 6, fontSize: 10 }}>{item.source}</span>}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginBottom: 4 }}>{item.title}</h2>
              {item.titleEn && item.titleEn !== item.title && <p style={{ color: "#8b949e", fontSize: 13 }}>{item.titleEn}</p>}
              {item.extra && <p style={{ color: "#8b949e", fontSize: 13 }}>✍ {item.extra}</p>}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, padding: "12px 0", borderTop: "1px solid #21262d", borderBottom: "1px solid #21262d", flexWrap: "wrap" }}>
            {(detailExtra?.episodes || item.episodes) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.episodes || item.episodes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Episódios</div></div>}
            {(detailExtra?.seasons) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra.seasons}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Temporadas</div></div>}
            {(detailExtra?.chapters || item.chapters) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.chapters || item.chapters}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Capítulos</div></div>}
            {(detailExtra?.volumes || item.volumes) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.volumes || item.volumes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Volumes</div></div>}
            {(detailExtra?.runtime) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra.runtime}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Duração</div></div>}
            {(detailExtra?.status || item.status) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{detailExtra?.status || item.status}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Estado</div></div>}
          </div>

          {/* Genres */}
          {item.genres?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {item.genres.slice(0, 6).map((g) => (
                <span key={g} style={{ background: "#1a1f2e", color: "#6e9cf7", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>{g}</span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {item.synopsis && (
            <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.7, marginTop: 16 }}>
              {item.synopsis.slice(0, 500)}{item.synopsis.length > 500 ? "…" : ""}
            </p>
          )}

          {/* Library section */}
          <div style={{ marginTop: 20, padding: 16, background: "#0d1117", borderRadius: 12, border: "1px solid #21262d" }}>
            {inLib ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#8b949e" }}>NA TUA BIBLIOTECA</span>
                    {libItem.userStatus === "assistindo" && libItem.addedAt && (() => {
                      const days = Math.floor((Date.now() - libItem.addedAt) / (1000 * 60 * 60 * 24));
                      return <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>⏱ há {days === 0 ? "menos de 1 dia" : days === 1 ? "1 dia" : `${days} dias`}</span>;
                    })()}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {inLib && onToggleFavorite && (
                      <button onClick={() => onToggleFavorite(item)} style={{
                        background: isFavorite ? "#f59e0b22" : "none",
                        border: `1px solid ${isFavorite ? "#f59e0b" : "#30363d"}`,
                        color: isFavorite ? "#f59e0b" : "#8b949e",
                        cursor: canAddFavorite || isFavorite ? "pointer" : "not-allowed",
                        fontSize: 11, padding: "4px 8px", borderRadius: 6, fontFamily: "inherit", fontWeight: 600,
                        opacity: !canAddFavorite && !isFavorite ? 0.4 : 1,
                      }} title={isFavorite ? "Remover dos favoritos" : canAddFavorite ? "Adicionar aos favoritos" : "Favoritos cheios (máx. 30)"}>
                        {isFavorite ? "★ Favorito" : "☆ Favorito"}
                      </button>
                    )}
                    <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: "4px 8px" }}>🗑 Remover</button>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>A TUA AVALIAÇÃO</div>
                  <StarRating value={libItem.userRating || 0} onChange={(r) => onUpdateRating(item.id, r)} size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>ESTADO</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s.id} onClick={() => onUpdateStatus(item.id, s.id)} style={{
                        padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                        border: `1.5px solid ${libItem.userStatus === s.id ? s.color : s.color + "44"}`,
                        background: libItem.userStatus === s.id ? `${s.color}25` : "transparent",
                        color: libItem.userStatus === s.id ? s.color : "#8b949e",
                      }}>
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                  {isChapterType && libItem.userStatus === "assistindo" && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" }}>📖 Capítulo:</span>
                      <input type="text" value={chapterInput} onChange={e => setChapterInput(e.target.value)}
                        placeholder="ex: Cap. 42"
                        onKeyDown={e => e.key === 'Enter' && onUpdateLastChapter && onUpdateLastChapter(item.id, chapterInput.trim())}
                        style={{ flex: 1, background: "#21262d", border: `1px solid ${accent}44`, borderRadius: 8, padding: "6px 10px", color: "#e6edf3", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                      />
                      <button onClick={() => onUpdateLastChapter && onUpdateLastChapter(item.id, chapterInput.trim())}
                        style={{ background: accent, border: "none", borderRadius: 8, padding: "6px 14px", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>✓</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 12, fontWeight: 600 }}>ADICIONAR À BIBLIOTECA</p>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>AVALIAÇÃO (opcional)</div>
                  <StarRating value={addRating} onChange={setAddRating} size={24} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s.id} onClick={() => { onAdd(item, s.id, addRating); onClose(); }} style={{
                      padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${s.color}55`,
                      background: `${s.color}15`, color: s.color, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: 600, fontSize: 13,
                    }}>
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    {coverEdit && inLib && (
      <CoverEditModal
        item={{ ...item, customCover: libItem.customCover }}
        onSave={(url) => { onChangeCover(item.id, url); setCoverEdit(false); }}
        onClose={() => setCoverEdit(false)}
      />
    )}
    </>
  );
}

// ─── Media Card ────────────────────────────────────────────────────────────────
// ── VirtualGrid: only renders cards near the viewport ──────────────────────
const VirtualGrid = memo(function VirtualGrid({ items, library, onOpen, accent, columns = 3 }) {
  const [visibleCount, setVisibleCount] = useState(columns * 6); // initial render
  const sentinelRef = useRef(null);

  useEffect(() => {
    setVisibleCount(columns * 6); // reset on filter change
  }, [items.length, columns]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + columns * 4, items.length));
        }
      },
      { rootMargin: '100px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [items.length, columns]);

  const visible = items.slice(0, visibleCount);

  return (
    <>
      <div className="media-grid">
        {visible.map((item) => (
          <MediaCard key={item.id} item={item} library={library} onOpen={onOpen} accent={accent} />
        ))}
      </div>
      {visibleCount < items.length && (
        <div ref={sentinelRef} style={{ height: 1, margin: '20px 0' }} />
      )}
      {visibleCount >= items.length && items.length > 0 && (
        <p style={{ textAlign: 'center', color: '#484f58', fontSize: 12, padding: '16px 0' }}>
          {items.length} itens
        </p>
      )}
    </>
  );
}); // end memo(VirtualGrid)

const MediaCard = memo(function MediaCard({ item, library, onOpen, accent }) {
  const libItem = library[item.id];
  const inLib = !!libItem;
  const coverSrc = libItem?.customCover || libItem?.cover || libItem?.thumbnailUrl || item.cover || item.thumbnailUrl;
  const status = STATUS_OPTIONS.find((s) => s.id === libItem?.userStatus);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleError = (e) => {
    if (item.coverFallback && e.currentTarget.src !== item.coverFallback) {
      e.currentTarget.src = item.coverFallback;
    } else {
      setImgError(true);
    }
  };

  return (
    <div className="card" onClick={() => onOpen(item)} style={{ cursor: "pointer" }}>
      <div className="media-thumb" style={{ width: "100%", aspectRatio: "2/3", background: gradientFor(item.id) }}>
        {coverSrc && !imgError ? (
          <img
            src={coverSrc}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={handleError}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 1, display: "block" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center", gap: 6 }}>
            <span style={{ fontSize: 28 }}>{MEDIA_TYPES.find((t) => t.id === item.type)?.icon}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, lineHeight: 1.3 }}>{item.title.slice(0, 40)}</span>
          </div>
        )}
        {/* Badges — status + score sem ícone de tipo */}
        <div style={{ position: "absolute", top: 6, left: 6, right: 6, display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: 3 }}>
          {!inLib && item.score && (
            <span style={{ background: "rgba(0,0,0,0.75)", borderRadius: 6, padding: "2px 6px", fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>
              ★ {item.score}
            </span>
          )}
          {status && status.id !== "completo" && (
            <span style={{ background: `${status.color}cc`, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "white" }}>
              {status.emoji}
            </span>
          )}
        </div>
        {/* Hover rating overlay — desktop rico */}
        <div className="rating-hover">
          <div style={{ textAlign: "center", padding: "0 8px", width: "100%" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6, opacity: 0.9 }}>{item.title}</p>
            {libItem?.userRating > 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 16, color: "#f59e0b" }}>★</span>
                <span style={{ fontSize: 18, color: "#f59e0b", fontWeight: 900 }}>{libItem.userRating}</span>
              </div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>★ sem nota</span>
              </div>
            )}
            {status && (
              <span style={{ fontSize: 10, background: `${status.color}cc`, color: "white", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                {status.emoji} {status.label}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="card-info" style={{ padding: "6px 8px 8px" }}>
        <p className="card-info-title card-title-text" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
        <p className="card-info-meta" style={{ fontSize: 11, color: "#484f58" }}>
          {MEDIA_TYPES.find((t) => t.id === item.type)?.label}{item.year ? ` · ${item.year}` : ""}
        </p>
        {libItem?.lastChapter && libItem?.userStatus === 'assistindo' && (
          <p style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📖 {libItem.lastChapter}
          </p>
        )}
        {!inLib && (
          <div style={{ marginTop: 8, padding: "5px 0", borderTop: "1px solid #21262d", fontSize: 11, color: accent, fontWeight: 600 }}>+ Adicionar</div>
        )}
      </div>
    </div>
  );
}); // end memo(MediaCard)

// ─── Profile / Settings View ──────────────────────────────────────────────────
function DiaryPanel({ completados, onOpen, accent }) {
  const [showAll, setShowAll] = useState(false);
  if (!completados || !completados.length) return null;
  const MONTH_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const groups = {};
  completados.forEach(item => {
    const d = item.addedAt ? new Date(item.addedAt) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}` : "0000-00";
    if (!groups[key]) groups[key] = { key, year: d ? d.getFullYear() : 0, month: d ? d.getMonth() : 0, items: [] };
    groups[key].items.push({ ...item, _day: d ? d.getDate() : 0 });
  });
  const sorted = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
  if (!sorted.length) return null;
  const visible = showAll ? sorted : sorted.slice(0, 3);
  const hiddenCount = sorted.slice(3).reduce((s,g) => s + g.items.length, 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>DIARY</h3>
        <span style={{ fontSize: 11, color: "#484f58" }}>{completados.length} entradas</span>
      </div>
      {visible.map(group => (
        <div key={group.key} style={{ display: "flex", marginBottom: 20 }}>
          <div style={{ flexShrink: 0, width: 56, marginRight: 12 }}>
            <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
              <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#8b949e", letterSpacing: 1 }}>
                {group.key === "0000-00" ? "—" : MONTH_PT[group.month]}
              </div>
              <div style={{ padding: "5px 0 6px", fontSize: group.key === "0000-00" ? 11 : 17, fontWeight: 900, color: "#e6edf3" }}>
                {group.key === "0000-00" ? "Sem data" : group.year}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
              <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 4px",
                borderBottom: idx < arr.length-1 ? "1px solid #21262d" : "none",
                cursor: "pointer", borderRadius: 4,
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#484f58", width: 14, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                {(item.customCover || item.cover || item.thumbnailUrl)
                  ? <img src={item.customCover || item.cover || item.thumbnailUrl} alt="" style={{ width: 24, height: 36, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                  : <div style={{ width: 24, height: 36, borderRadius: 3, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                }
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#e6edf3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                {item.userRating > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, flexShrink: 0 }}>★ {item.userRating}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {sorted.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} style={{ width: "100%", padding: "8px", borderRadius: 8, background: "#21262d", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
          {showAll ? "↑ Mostrar menos" : `Ver mais — ${hiddenCount} entr${hiddenCount===1?"ada":"adas"}`}
        </button>
      )}
    </div>
  );
}

function RecentSection({ items, accent, darkMode, onOpen, isMobileDevice = true, showDiary = true }) {
  const [showAllCurso, setShowAllCurso] = useState(false);
  const [showAllCompleto, setShowAllCompleto] = useState(false);
  const [showDiaryAll, setShowDiaryAll] = useState(false);

  const inCurso = [...items].filter(i => i.userStatus === "assistindo").sort((a, b) => b.addedAt - a.addedAt);
  const completados = [...items].filter(i => i.userStatus === "completo" && i.addedAt).sort((a, b) => b.addedAt - a.addedAt);

  const ItemGrid = ({ list, showAll, maxPreview = 10 }) => {
    const visible = showAll ? list : list.slice(0, maxPreview);
    return (
      <div className={showAll ? "" : "recents-row"} style={{
        display: showAll ? "grid" : "flex",
        gridTemplateColumns: showAll ? "repeat(auto-fill, minmax(72px, 1fr))" : undefined,
        gap: 10, overflowX: showAll ? "visible" : "auto",
        paddingBottom: 4, scrollbarWidth: "none",
      }}>
        {visible.map((item) => {
          const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
          return (
            <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{ flexShrink: 0, width: showAll ? undefined : 72, cursor: "pointer" }}>
              <div style={{ width: showAll ? "100%" : 72, height: 104, borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), border: `2px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, marginBottom: 4, position: "relative" }}>
                {coverSrc
                  ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.currentTarget.style.display = "none"} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                }
                {item.userRating > 0 && (
                  <div style={{ position: "absolute", bottom: 3, left: 3, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "1px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>★ {item.userRating}</div>
                )}
                {item.lastChapter && item.userStatus === "assistindo" && (
                  <div style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "1px 4px", fontSize: 9, color: accent, fontWeight: 700, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.lastChapter.replace(/chapter /i, 'Ch.').replace(/vol\.\d+\s*/i, '')}
                  </div>
                )}
              </div>
              <p style={{ fontSize: 10, color: darkMode ? "#8b949e" : "#64748b", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Completados — tamanho igual aos Favoritos */}
      {completados.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {completados.length > 10 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button onClick={() => setShowAllCompleto(v => !v)} style={{ background: "none", border: `1px solid ${accent}44`, color: accent, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                {showAllCompleto ? "↑ Menos" : `Ver todos (${completados.length})`}
              </button>
            </div>
          )}
          <div
            onWheel={e => { if (!showAllCompleto) { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY; } }}
            style={{
              display: showAllCompleto ? "grid" : "flex",
              gridTemplateColumns: showAllCompleto ? "repeat(auto-fill, minmax(160px, 1fr))" : undefined,
              gap: 10, overflowX: showAllCompleto ? "visible" : "auto",
              paddingBottom: 8, scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
            }}>
            {(showAllCompleto ? completados : completados.slice(0, 12)).map((item) => {
              const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
              return (
                <div key={item.id} className="recent-card" style={{ flexShrink: 0, width: showAllCompleto ? undefined : (isMobileDevice ? "calc((100vw - 32px) / 4)" : 120), cursor: "pointer" }} onClick={() => onOpen && onOpen(item)}>
                  <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 4, overflow: "hidden", position: "relative", background: gradientFor(item.id), boxShadow: "0 4px 14px rgba(0,0,0,0.5)", transition: "transform 0.18s" }}>
                    {coverSrc
                      ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                    }
                    {/* Hover overlay: título + rating + data */}
                    <div className="recent-hover-overlay" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)", opacity: 0, transition: "opacity 0.2s", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "40px 10px 10px" }}>
                      <p style={{ fontSize: 12, color: "white", fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 4 }}>{item.title}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {item.userRating > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 800 }}>★ {item.userRating}</span>}
                        {item.addedAt && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{new Date(item.addedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DIARY — Letterboxd style, grouped by month (só mobile; PC usa DiaryPanel na coluna direita) */}
      {showDiary && completados.length > 0 && (() => {
        const MONTH_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
        // Group by month — only items WITH addedAt appear in the diary
        const groups = {};
        completados.filter(item => item.addedAt).forEach(item => {
          const d = new Date(item.addedAt);
          const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
          if (!groups[key]) groups[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
          groups[key].items.push({ ...item, _day: d.getDate() });
        });
        const sortedGroups = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
        if (!sortedGroups.length) return null;

        // Show 2 most recent months; rest collapses
        const visibleGroups = showDiaryAll ? sortedGroups : sortedGroups.slice(0, 2);
        const hiddenCount = sortedGroups.slice(2).reduce((s,g) => s + g.items.length, 0);

        const renderGroup = (group) => (
          <div key={group.key} style={{ display: "flex", gap: 0, marginBottom: 24 }}>
            {/* Month/Year block */}
            <div style={{ flexShrink: 0, width: 68, marginRight: 16 }}>
              <div style={{ background: "#21262d", borderRadius: 10, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
                <div style={{ background: "#30363d", padding: "4px 0", fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: 1 }}>
                  {group.key === "0000-00" ? "—" : MONTH_PT[group.month]}
                </div>
                <div style={{ padding: "6px 0 8px", fontSize: group.key === "0000-00" ? 13 : 22, fontWeight: 900, color: "#e6edf3" }}>
                  {group.key === "0000-00" ? "Sem data" : group.year}
                </div>
              </div>
            </div>
            {/* Entries sorted by day desc */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
                <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  borderBottom: idx < arr.length - 1 ? "1px solid #21262d" : "none",
                  cursor: "pointer", minWidth: 0,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#484f58", width: 16, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                  {(item.customCover || item.cover || item.thumbnailUrl)
                    ? <img src={item.customCover || item.cover || item.thumbnailUrl} alt="" style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    : <div style={{ width: 28, height: 40, borderRadius: 4, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                  }
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#e6edf3", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>{item.title}</span>
                  {item.userRating > 0 && (
                    <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>★ {item.userRating}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

        return (
          <div style={{ marginBottom: 24, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>DIARY</h3>
              <span style={{ fontSize: 12, color: "#484f58" }}>{completados.length} entradas</span>
            </div>
            {visibleGroups.map(renderGroup)}
            {sortedGroups.length > 2 && (
              <button onClick={() => setShowDiaryAll(v => !v)} style={{
                width: "100%", padding: "10px", borderRadius: 10,
                background: "#21262d", border: "1px solid #30363d",
                color: "#8b949e", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600,
              }}>
                {showDiaryAll
                  ? "↑ Mostrar menos"
                  : `Ver mais — ${hiddenCount} entr${hiddenCount === 1 ? "ada" : "adas"} em ${sortedGroups.length - 2} mes${sortedGroups.length - 2 === 1 ? "" : "es"} anteriores`}
              </button>
            )}
          </div>
        );
      })()}

      {/* Em Curso — small cards with chapter info */}
      {inCurso.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>IN PROGRESS</h3>
            {inCurso.length > 10 && (
              <button onClick={() => setShowAllCurso(v => !v)} style={{ background: "none", border: `1px solid ${accent}44`, color: accent, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                {showAllCurso ? "↑ Menos" : `Ver todos (${inCurso.length})`}
              </button>
            )}
          </div>
          <ItemGrid list={inCurso} showAll={showAllCurso} />
        </div>
      )}
    </>
  );
}

function ProfileView({ profile, library, accent, bgColor, bgImage, bgImageMobile, bgSeparateDevices, onBgSeparateDevices, onBgImageMobile, isMobileDevice, bgOverlay, bgBlur, bgParallax, darkMode, statsCardBg, onUpdateProfile, onAccentChange, onBgChange, onBgImage, onBgOverlay, onBgBlur, onBgParallax, onStatsCardBg, onTmdbKey, tmdbKey, workerUrl, onWorkerUrl, onSignOut, userEmail, favorites = [], onToggleFavorite, onImportMihon, onImportPaperback, onImportLetterboxd, driveClientId, onSaveDriveClientId, lastDriveSync, onAutoSync, driveAutoSyncing, onOpen, diaryPanel = null }) {
  const [editing, setEditing] = useState(false);
  const [showMihon, setShowMihon] = useState(false);
  const [showPaperback, setShowPaperback] = useState(false);
  const [showLetterboxd, setShowLetterboxd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [hideEmail, setHideEmail] = useState(profile.hideEmail || false);
  const [shareCopied, setShareCopied] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || "");
  const [bannerPreview, setBannerPreview] = useState(profile.banner || "");
  const [bannerUrl, setBannerUrl] = useState(profile.banner || "");
  const [cropSrc, setCropSrc] = useState(null);
  const [cropType, setCropType] = useState(null); // "avatar" | "banner"
  const avatarRef = useRef();
  const bannerRef = useRef();
  const items = Object.values(library);
  const byType = {};
  MEDIA_TYPES.slice(1).forEach((t) => { byType[t.id] = items.filter((i) => i.type === t.id && i.userStatus === 'completo').length; });
  const byStatus = {};
  STATUS_OPTIONS.forEach((s) => { byStatus[s.id] = items.filter((i) => i.userStatus === s.id).length; });
  const totalRatings = items.filter((i) => i.userRating > 0);
  const avgRating = totalRatings.length ? (totalRatings.reduce((a, i) => a + i.userRating, 0) / totalRatings.length).toFixed(1) : "—";

  const handleAvatarFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropType("avatar");
  };

  const handleBannerFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropType("banner");
  };

  const handleCropSave = (dataUrl) => {
    if (cropType === "avatar") setAvatarPreview(dataUrl);
    if (cropType === "banner") { setBannerPreview(dataUrl); setBannerUrl(dataUrl); }
    setCropSrc(null); setCropType(null);
  };

  const handleSave = async () => {
    await onUpdateProfile({ ...profile, name, bio, avatar: avatarPreview, banner: bannerUrl, hideEmail });
    setEditing(false);
  };

  const currentBanner = editing ? bannerPreview : profile.banner;
  const currentAvatar = editing ? avatarPreview : profile.avatar;

  return (
    <>
    <div style={{ paddingBottom: 32, maxWidth: isMobileDevice ? 600 : "100%", margin: "0 auto" }}>

      {/* ── Banner + Avatar header ── */}
      <div style={{ position: "relative", marginBottom: 64 }}>
        {/* Banner — taller, more impactful */}
        <div style={{
          height: 260, overflow: "hidden", position: "relative",
          borderRadius: "20px 20px 0 0",
          background: currentBanner
            ? `url(${currentBanner}) center/cover no-repeat`
            : darkMode ? "#0d1117" : "#f1f5f9",
        }}>
          {/* Multi-layer gradient overlay for impact */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
          {/* Banner fallback — hexágonos + partículas animadas */}
          {!currentBanner && (
            <>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="hex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
                    <polygon points="28,4 52,16 52,32 28,44 4,32 4,16" fill="none" stroke={accent} strokeWidth="1">
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite"/>
                    </polygon>
                    <polygon points="28,4 52,16 52,32 28,44 4,32 4,16" fill={accent} fillOpacity="0.04">
                      <animate attributeName="fill-opacity" values="0.02;0.08;0.02" dur="3s" repeatCount="indefinite"/>
                    </polygon>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hex)"/>
                {/* Partículas flutuantes */}
                {[
                  { cx: "15%", cy: "30%", r: 2, dur: "4s" },
                  { cx: "35%", cy: "60%", r: 1.5, dur: "5s" },
                  { cx: "55%", cy: "25%", r: 2.5, dur: "3.5s" },
                  { cx: "70%", cy: "70%", r: 1.5, dur: "6s" },
                  { cx: "85%", cy: "40%", r: 2, dur: "4.5s" },
                  { cx: "25%", cy: "80%", r: 1, dur: "5.5s" },
                  { cx: "90%", cy: "20%", r: 1.5, dur: "4s" },
                ].map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={accent} opacity="0.6">
                    <animate attributeName="cy" values={`${p.cy};calc(${p.cy} - 8%);${p.cy}`} dur={p.dur} repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.2;0.8;0.2" dur={p.dur} repeatCount="indefinite"/>
                  </circle>
                ))}
              </svg>
              {/* Gradiente respirante */}
              <div style={{ position: "absolute", inset: 0 }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${accent}30 0%, transparent 65%)`, animation: "breathe 4s ease-in-out infinite" }} />
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 70% 50%, ${accentShade(accent, 60)}20 0%, transparent 55%)`, animation: "breathe 4s ease-in-out infinite 2s" }} />
              </div>
              <style>{`@keyframes breathe { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
            </>
          )}
          {editing && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}>
              <input type="file" accept="image/*" ref={bannerRef} onChange={handleBannerFile} style={{ display: "none" }} />
              <button onClick={() => bannerRef.current?.click()} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(0,0,0,0.5)", color: "white", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, backdropFilter: "blur(4px)",
              }}>🖼 Alterar Banner</button>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>Recomendado: 1200×400px · Telemóvel: 390×160px</p>
              <input
                placeholder="ou cola URL do banner..."
                value={bannerUrl.startsWith("data:") ? "" : bannerUrl}
                onChange={(e) => { setBannerUrl(e.target.value); setBannerPreview(e.target.value); }}
                style={{ padding: "7px 12px", fontSize: 12, width: "70%", maxWidth: 300, borderRadius: 8 }}
              />
              {bannerUrl && (
                <button onClick={() => { setBannerUrl(""); setBannerPreview(""); }} style={{
                  padding: "4px 10px", borderRadius: 6, border: "1px solid #ef444466",
                  background: "rgba(239,68,68,0.15)", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 11,
                }}>✕ Remover banner</button>
              )}
            </div>
          )}
        </div>

        {/* Avatar — overlaps banner */}
        <div style={{ position: "absolute", bottom: -48, left: "50%", transform: "translateX(-50%)" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: 92, height: 92, borderRadius: 999, overflow: "hidden",
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
              border: `3px solid ${bgColor}`,
              boxShadow: `0 0 0 3px ${accent}, 0 0 24px ${accent}66, 0 8px 32px rgba(0,0,0,0.5)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {currentAvatar
                ? <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 38 }}>👤</span>}
            </div>
            {editing && (
              <>
                <input type="file" accept="image/*" ref={avatarRef} onChange={handleAvatarFile} style={{ display: "none" }} />
                <button onClick={() => avatarRef.current?.click()} style={{
                  position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 999,
                  background: accent, border: `2px solid ${bgColor}`, cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>🖊</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Name / bio / edit */}
      <div style={{ textAlign: "center", padding: "0 16px", marginBottom: 20 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="O teu nome..." style={{ padding: "10px 14px", textAlign: "center", fontSize: 16, fontWeight: 700 }} />
            <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A tua bio..." style={{ padding: "10px 14px", fontSize: 13 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: darkMode ? "#0d1117" : "#f8fafc", borderRadius: 10, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!hideEmail} onChange={e => setHideEmail(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
              <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>Esconder email no perfil</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-accent" style={{ flex: 1, padding: "10px" }} onClick={handleSave}>Guardar</button>
              <button onClick={() => { setEditing(false); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setAvatarPreview(profile.avatar||""); }} style={{ flex: 1, padding: "10px", background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, background: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{profile.name || "Utilizador"}</h2>
            {profile.bio && <p style={{ color: "#8b949e", fontSize: 14, marginTop: 4 }}>{profile.bio}</p>}
            {userEmail && !hideEmail && <p style={{ color: "#484f58", fontSize: 12, marginTop: 4 }}>✉ {userEmail}</p>}
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>TrackAll · {items.length} na biblioteca</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, alignItems: "center" }}>
              <button onClick={() => { setName(profile.name||""); setBio(profile.bio||""); setAvatarPreview(profile.avatar||""); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setEditing(true); }} style={{
                padding: "8px 20px", borderRadius: 8, border: `1px solid ${accent}44`,
                background: `${accent}15`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              }}>✏ Editar Perfil</button>
              <button onClick={() => {
                const name = profile.name || "perfil";
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }).catch(() => {});
              }} title="Copiar link do perfil" style={{
                width: 34, height: 34, borderRadius: 8, border: `1px solid ${shareCopied ? "#10b981" : accent + "44"}`,
                background: shareCopied ? "#10b98120" : `${accent}15`,
                color: shareCopied ? "#10b981" : accent,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                transition: "all 0.2s",
              }}>
                {shareCopied ? "✓" : "🔗"}
              </button>
              {onSignOut && (
                <button onClick={onSignOut} title="Sair" style={{
                  width: 34, height: 34, borderRadius: 8, border: "1px solid #30363d",
                  background: "transparent", color: "#484f58", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stats and settings — PC: flex row com diário à direita */}
      <div style={ !isMobileDevice
        ? { display: "flex", flexDirection: "row", gap: 32, padding: "0 32px 0 32px", alignItems: "flex-start" }
        : { padding: "0 16px" }
      }><div style={{ flex: 1, minWidth: 0 }}>


      {/* ── Favoritos — Categorias com variações do accent ── */}
      {(() => {
        const favByType = {};
        favorites.forEach(f => {
          if (!favByType[f.type]) favByType[f.type] = [];
          favByType[f.type].push(f);
        });
        const activeTypes = MEDIA_TYPES.slice(1).filter(t => favByType[t.id]?.length > 0);

        return (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 0 0 16px" }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: darkMode ? "#8b949e" : "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>FAVORITES</h3>
              <span style={{ fontSize: 11, color: "#484f58" }}>{favorites.length}</span>
            </div>

            {favorites.length === 0 ? (
              <div style={{ margin: "0 16px", background: darkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: "1px dashed #30363d", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <p style={{ color: "#484f58", fontSize: 13 }}>Abre qualquer item e clica em ☆ Favorito</p>
              </div>
            ) : (
              <div style={{ padding: !isMobileDevice ? "0 24px 0 24px" : "0 0 0 16px", display: "flex", flexDirection: "column", gap: 18 }}>
                {activeTypes.map((t, tIdx) => {
                  const tc = accentVariant(accent, tIdx);
                  return (
                    <div key={t.id}>
                      {/* Label categoria */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, textTransform: "uppercase", letterSpacing: "0.14em" }}>{t.label}</span>
                        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${tc}70, transparent)` }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, background: `${tc}18`, padding: "1px 7px", borderRadius: 20 }}>{favByType[t.id].length}</span>
                      </div>
                      {/* Grid adaptativo: scroll row se ≤4 itens, grid 4 col se mais */}
                      {(() => {
                        const count = favByType[t.id].length;
                        // Sempre grid 4 colunas — sem scroll em nenhum dispositivo
                        const useScroll = false;
                        const cardW = 0; // não usado no grid
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: isMobileDevice ? 4 : 10 }}>
                            {favByType[t.id].map(item => {
                              const coverSrc = item.customCover || item.cover;
                              const currentRating = library[item.id]?.userRating ?? item.userRating ?? 0;
                              return (
                                <div key={item.id} className="fav-card-wrap" onClick={() => onOpen && onOpen(item)} style={{ position: "relative", cursor: "pointer" }}
                                  onMouseEnter={e => { const rm = e.currentTarget.querySelector(".fav-rm"); if(rm) rm.style.opacity="1"; const th = e.currentTarget.querySelector(".fav-thumb-d"); if(th){th.style.transform="translateY(-3px) scale(1.02)"; th.querySelector(".fav-overlay").style.opacity="1";} }}
                                  onMouseLeave={e => { const rm = e.currentTarget.querySelector(".fav-rm"); if(rm) rm.style.opacity="0"; const th = e.currentTarget.querySelector(".fav-thumb-d"); if(th){th.style.transform="translateY(0) scale(1)"; th.querySelector(".fav-overlay").style.opacity="0";} }}>
                                  <div className="fav-thumb-d" style={{ width: "100%", aspectRatio: "2/3", borderRadius: isMobileDevice ? 6 : 9, overflow: "hidden", background: gradientFor(item.id), transition: "transform 0.15s", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                                    {coverSrc
                                      ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />
                                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{t.icon}</div>
                                    }
                                    <div className="fav-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s" }}>
                                      {currentRating > 0
                                        ? <div style={{ fontSize: 22, color: "#f59e0b", fontWeight: 900 }}>★ {currentRating}</div>
                                        : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>sem nota</div>
                                      }
                                    </div>
                                  </div>
                                  <button className="fav-rm" onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(item); }}
                                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#ef4444", color: "white", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s", zIndex: 10 }}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Vistos Recentemente ── */}
      {items.length > 0 && <RecentSection items={items} accent={accent} darkMode={darkMode} onOpen={onOpen} isMobileDevice={isMobileDevice} showDiary={isMobileDevice} />}

      {/* Stats grid — colapsável */}
      <button onClick={() => setShowStats(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showStats ? 12 : 20, fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span style={{ transform: showStats ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-block", fontSize: 11 }}>▾</span>
          ESTATÍSTICAS
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
        </h3>
      </button>
      {showStats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {STATUS_OPTIONS.map((s) => (
              <div key={s.id} style={{ background: statsCardBg || (darkMode ? "#161b22" : "rgba(255,255,255,0.7)"), borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${s.color}`, borderTop: `1px solid ${s.color}22`, borderRight: `1px solid ${s.color}11`, borderBottom: `1px solid ${s.color}11` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
            <div style={{ background: statsCardBg || (darkMode ? "#161b22" : "rgba(255,255,255,0.7)"), borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: "3px solid #f59e0b", borderTop: "1px solid #f59e0b22", borderRight: "1px solid #f59e0b11", borderBottom: "1px solid #f59e0b11" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>Avg. Rating</div>
            </div>
            <div style={{ background: statsCardBg || (darkMode ? "#161b22" : "rgba(255,255,255,0.7)"), borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${accent}`, borderTop: `1px solid ${accent}22`, borderRight: `1px solid ${accent}11`, borderBottom: `1px solid ${accent}11` }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{items.length}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>Total</div>
            </div>
            <div style={{ background: statsCardBg || (darkMode ? "#161b22" : "rgba(255,255,255,0.7)"), borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${accent}99`, borderTop: `1px solid ${accent}22`, borderRight: `1px solid ${accent}11`, borderBottom: `1px solid ${accent}11` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{totalRatings.length}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>Avaliados</div>
            </div>
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>COMPLETOS POR TIPO<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            {MEDIA_TYPES.slice(1).map((t) => {
              const count = byType[t.id] || 0;
              const total = items.filter(i => i.type === t.id).length;
              const pct = total ? (count / total) * 100 : 0;
              if (!total) return null;
              return (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{t.icon} {t.label}</span>
                    <span style={{ fontSize: 12, color: "#8b949e" }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: "#21262d", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, borderRadius: 999, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Temas */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>APARÊNCIA<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: darkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Modo ── */}
        <div>
          <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Modo</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onBgChange("#0d1117"); onBgImage(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: darkMode ? accent : "#21262d", color: darkMode ? "white" : "#8b949e" }}>🌙 Noturno</button>
            <button onClick={() => { onBgChange("#f1f5f9"); onBgImage(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: !darkMode ? accent : "#21262d", color: !darkMode ? "white" : "#8b949e" }}>☀️ Diurno</button>
          </div>
        </div>

        {/* ── Cor de destaque ── */}
        <div>
          <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Cor de destaque</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {ACCENT_PRESETS.map((p) => (
              <button key={p.name} onClick={() => onAccentChange(p.color)} style={{ width: 32, height: 32, borderRadius: 999, background: p.color, border: accent === p.color ? "3px solid white" : "3px solid transparent", cursor: "pointer" }} title={p.name} />
            ))}
            <label style={{ width: 32, height: 32, borderRadius: 999, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }} title="Personalizada">
              +
              <input type="color" defaultValue={accent} onBlur={(e) => onAccentChange(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
            </label>
          </div>
        </div>

        {/* ── Cor de fundo ── */}
        <div>
          <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Cor de fundo</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {BG_PRESETS.map((p) => (
              <button key={p.name} onClick={() => { onBgChange(p.value); onBgImage(""); }} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: bgColor === p.value && !bgImage ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer" }} title={p.name} />
            ))}
            <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }} title="Personalizada">
              +
              <input type="color" defaultValue={bgColor} onBlur={(e) => { onBgChange(e.target.value); onBgImage(""); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
            </label>
          </div>
        </div>

        {/* ── Imagem de fundo ── */}
        <div>
          <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Imagem de fundo</p>

          {/* Device toggle row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#8b949e" }}>Fundo igual em todos os dispositivos</span>
            <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, flexShrink: 0, cursor: "pointer" }}>
              <input type="checkbox" checked={!!bgSeparateDevices} onChange={e => onBgSeparateDevices(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", inset: 0, background: bgSeparateDevices ? accent : "#30363d", borderRadius: 22, transition: "background 0.2s" }} />
              <span style={{ position: "absolute", top: 3, left: bgSeparateDevices ? 21 : 3, width: 16, height: 16, background: "white", borderRadius: "50%", transition: "left 0.2s" }} />
            </label>
            <span style={{ fontSize: 12, color: bgSeparateDevices ? accent : "#484f58", fontWeight: bgSeparateDevices ? 700 : 400 }}>{bgSeparateDevices ? "Separado 🖥≠📱" : "Igual 🖥=📱"}</span>
          </div>

          {/* Upload buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* PC / Único */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <label style={{ width: 56, height: 56, borderRadius: 10, border: bgImage ? `2px solid ${accent}` : "2px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: bgImage ? `url(${bgImage}) center/cover` : "#21262d", overflow: "hidden", gap: 2 }}>
                {!bgImage && <><span>🖥</span><span style={{ fontSize: 9, color: "#484f58" }}>PC</span></>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  const compressed = await compressImage(file, 1920, 1080, 0.90);
                  if (compressed) onBgImage(compressed);
                }} />
              </label>
              {bgImage && <button onClick={() => onBgImage("")} style={{ fontSize: 10, padding: "2px 8px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕ remover</button>}
            </div>

            {/* Mobile (only when separate is ON) */}
            {bgSeparateDevices && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <label style={{ width: 56, height: 56, borderRadius: 10, border: bgImageMobile ? "2px solid #06b6d4" : "2px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: bgImageMobile ? `url(${bgImageMobile}) center/cover` : "#21262d", overflow: "hidden", gap: 2 }}>
                  {!bgImageMobile && <><span>📱</span><span style={{ fontSize: 9, color: "#484f58" }}>Mobile</span></>}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    const compressed = await compressImage(file, 1080, 1920, 0.85);
                    if (compressed) onBgImageMobile(compressed);
                  }} />
                </label>
                {bgImageMobile && <button onClick={() => onBgImageMobile("")} style={{ fontSize: 10, padding: "2px 8px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕ remover</button>}
              </div>
            )}
          </div>

          {/* Image controls when any bg is set */}
          {(bgImage || bgImageMobile) && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>Sobreposição</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ label: "Nenhum", val: "rgba(0,0,0,0)" }, { label: "Suave", val: "rgba(0,0,0,0.3)" }, { label: "Médio", val: "rgba(0,0,0,0.55)" }, { label: "Forte", val: "rgba(0,0,0,0.75)" }, { label: "Branco", val: "rgba(255,255,255,0.6)" }].map(o => (
                    <button key={o.label} onClick={() => onBgOverlay(o.val)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${bgOverlay === o.val ? accent : "#30363d"}`, background: bgOverlay === o.val ? `${accent}22` : "transparent", color: bgOverlay === o.val ? accent : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>Desfoque — {bgBlur}px</p>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 2, 4, 8, 12].map(v => (
                    <button key={v} onClick={() => onBgBlur(v)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${bgBlur === v ? accent : "#30363d"}`, background: bgBlur === v ? `${accent}22` : "transparent", color: bgBlur === v ? accent : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{v === 0 ? "Nenhum" : `${v}px`}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>Scroll</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onBgParallax(true)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${bgParallax ? accent : "#30363d"}`, background: bgParallax ? `${accent}22` : "transparent", color: bgParallax ? accent : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>✦ Parallax</button>
                  <button onClick={() => onBgParallax(false)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${!bgParallax ? accent : "#30363d"}`, background: !bgParallax ? `${accent}22` : "transparent", color: !bgParallax ? accent : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>◼ Estático</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Blocos de estatísticas ── */}
        <div>
          <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Cor dos blocos de stats</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => onStatsCardBg("")} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: !statsCardBg ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer", fontSize: 10, color: "#8b949e", fontFamily: "inherit" }} title="Automático">Auto</button>
            {["#161b22","#1e293b","#0f172a","#1c1c1e","#1a1a2e","rgba(255,255,255,0.08)","rgba(255,255,255,0.15)"].map(c => (
              <button key={c} onClick={() => onStatsCardBg(c)} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: statsCardBg === c ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer" }} title={c} />
            ))}
            <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }}>
              +
              <input type="color" defaultValue="#161b22" onBlur={(e) => onStatsCardBg(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
            </label>
          </div>
        </div>

      </div>

      {/* Mihon Modal */}
      {showMihon && (
        <MihonImportModal
          accent={accent}
          darkMode={darkMode}
          onClose={() => setShowMihon(false)}
          onImport={(items) => { onImportMihon && onImportMihon(items); setShowMihon(false); }}
          driveClientId={driveClientId}
          onSaveClientId={onSaveDriveClientId}
        />
      )}

      {/* Modais Paperback e Letterboxd */}
      {showPaperback && (
        <PaperbackImportModal
          accent={accent} darkMode={darkMode}
          onClose={() => setShowPaperback(false)}
          onImport={(items) => { onImportPaperback && onImportPaperback(items); setShowPaperback(false); }}
        />
      )}
      {showLetterboxd && (
        <LetterboxdImportModal
          accent={accent} darkMode={darkMode}
          onClose={() => setShowLetterboxd(false)}
          onImport={(items) => { onImportLetterboxd && onImportLetterboxd(items); setShowLetterboxd(false); }}
        />
      )}

      {/* ── Mihon Sync ── */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>SINCRONIZAÇÃO<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: darkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📚</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Mihon</p>
            {lastDriveSync ? (
              <p style={{ fontSize: 11, color: "#10b981", marginBottom: 2 }}>
                ✓ Última sync: {lastDriveSync.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
              </p>
            ) : (
              <p style={{ fontSize: 12, color: "#8b949e" }}>Biblioteca, progresso e estado de leitura</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {driveClientId && (
              <button onClick={() => onAutoSync && onAutoSync(driveClientId)} disabled={driveAutoSyncing} style={{
                padding: "8px 12px", fontSize: 12, fontWeight: 700, borderRadius: 10,
                background: driveAutoSyncing ? "#21262d" : `${accent}22`,
                border: `1px solid ${accent}44`, color: driveAutoSyncing ? "#484f58" : accent,
                cursor: driveAutoSyncing ? "not-allowed" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {driveAutoSyncing ? <span className="spin">◌</span> : "☁️"} Sync
              </button>
            )}
            <button onClick={() => setShowMihon(true)} className="btn-accent" style={{ padding: "8px 14px", fontSize: 13 }}>
              Importar
            </button>
          </div>
        </div>
        {/* Status bar */}
        <div style={{ marginTop: 12, padding: "8px 10px", background: darkMode ? "#0d111766" : "#f8fafc", borderRadius: 8, fontSize: 11, color: "#484f58", lineHeight: 1.6 }}>
          {driveClientId
            ? <>☁️ <strong style={{ color: "#10b981" }}>Google Drive ligado</strong> — sync automático ao abrir a app. Ou clica <strong>Sync</strong> para atualizar agora.</>
            : <>💡 Mihon → <strong>Mais</strong> → <strong>Backup e Restauro</strong> → <strong>Criar backup</strong> → ou liga o Google Drive no modal de importação para sync automático.</>
          }
        </div>
        {/* Divider */}
        <div style={{ borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, margin: "12px 0" }} />
        {/* Paperback */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>📖</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Paperback <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— iOS manga e comics</span></p>
          </div>
          <button onClick={() => setShowPaperback(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>Importar</button>
        </div>
        {/* Letterboxd */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>🎬</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Letterboxd <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— filmes vistos</span></p>
          </div>
          <button onClick={() => setShowLetterboxd(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, background: "#00e05422", border: "1px solid #00e05444", color: "#00e054", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Importar</button>
        </div>
      </div>


      {/* API Status — tudo pré-configurado */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>CONFIGURAÇÕES API<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: "#161b22", border: "1px solid #10b98133", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>✓ Tudo configurado automaticamente</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "⛩", label: "Anime/Manga", sub: "AniList" },
            { icon: "📚", label: "Livros", sub: "OpenLibrary" },
            { icon: "🎮", label: "Jogos", sub: "IGDB + Steam" },
            { icon: "🎬", label: "Filmes/Séries", sub: "TMDB" },
            { icon: "💬", label: "Comics", sub: "ComicVine" },
            { icon: "🇰🇷", label: "Manhwa/LN", sub: "AniList" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0d1117", border: "1px solid #10b98122", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}><span style={{ color: "#10b981" }}>✓ </span>{s.icon} {s.label}</div>
              <div style={{ color: "#484f58", fontSize: 11, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {/* TMDB Attribution — required by TMDB ToS */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
          <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" style={{ height: 14, opacity: 0.7 }} />
          <span style={{ fontSize: 10, color: "#484f58" }}>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
      </div>

      {/* ── Legal ── */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: darkMode ? "#8b949e" : "#475569", display: "flex", alignItems: "center", gap: 10 }}>
          LEGAL
          <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${darkMode ? "#30363d" : "#e2e8f0"}, transparent)` }} />
        </h3>
        <div style={{ background: darkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>Política de Privacidade</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>Como tratamos os teus dados · RGPD</p>
            </div>
            <a href="https://raw.githubusercontent.com/mcmeskajr-prog/trackall/main/public/privacy.pdf" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}44`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
              Ver PDF →
            </a>
          </div>
          <div style={{ height: 1, background: darkMode ? "#21262d" : "#e8e0d5" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>Versão da App</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>TrackAll v64 · março 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zona de Perigo ── */}
      {(() => {
        const [confirmDelete, setConfirmDelete] = useState(false);
        const [deleting, setDeleting] = useState(false);
        const handleDeleteAccount = async () => {
          if (!confirmDelete) { setConfirmDelete(true); return; }
          setDeleting(true);
          try {
            // 1. Apagar todos os dados da biblioteca
            await supabase.from("library").delete().eq("user_id", user.id);
            // 2. Apagar friendships
            await supabase.from("friendships").delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
            // 3. Apagar perfil
            await supabase.from("profiles").delete().eq("id", user.id);
            // 4. Sign out (a conta auth só pode ser apagada por service role — instrui o utilizador)
            await supabase.auth.signOut();
            onSignOut && onSignOut();
          } catch (e) {
            console.error(e);
            setDeleting(false);
            setConfirmDelete(false);
          }
        };
        return (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 10 }}>
              ZONA DE PERIGO
              <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #ef444433, transparent)" }} />
            </h3>
            <div style={{ background: "#1a0a0a", border: "1px solid #ef444433", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 14 }}>
                Apagar a conta remove permanentemente toda a tua biblioteca, perfil e dados. Esta ação não pode ser desfeita.
              </p>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #ef444455", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Apagar conta
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>⚠️ Tens a certeza? Esta ação é irreversível.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "#ef4444", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? "A apagar..." : "Sim, apagar tudo"}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #30363d", background: "transparent", color: "#8b949e", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

            </div>
      {diaryPanel}
      </div>
    </div>{/* fim conteudo */}
    {cropSrc && (
      <CropModal
        imageSrc={cropSrc}
        aspectRatio={cropType === "banner" ? 800/280 : 1}
        title={cropType === "banner" ? "Recortar Banner" : "Recortar Avatar"}
        onSave={handleCropSave}
        onClose={() => { setCropSrc(null); setCropType(null); }}
      />
    )}
    </>
  );
}

// ─── Friends View ─────────────────────────────────────────────────────────────
function FeedTab({ accepted, getFriendInfo, accent, darkMode }) {
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    const loadFeed = async () => {
      setFeedLoading(true);
      try {
        const allActivity = [];
        await Promise.all(accepted.map(async (f) => {
          const friendInfo = getFriendInfo(f);
          const lib = await supa.getFriendLibrary(friendInfo.id);
          const libItems = Object.values(lib || {});
          const recent = libItems
            .filter(i => i.addedAt && (i.userStatus === "completo" || i.userStatus === "assistindo"))
            .map(i => ({ ...i, friendName: friendInfo.name || "Utilizador", friendAvatar: friendInfo.avatar || null, friendId: friendInfo.id }));
          allActivity.push(...recent);
        }));
        allActivity.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        setFeedItems(allActivity.slice(0, 80));
      } catch (e) { console.error(e); }
      setFeedLoading(false);
    };
    loadFeed();
  }, [accepted.length]);

  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "agora";
    if (m < 60) return `há ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d}d`;
    return `há ${Math.floor(d / 30)}mes`;
  };

  if (accepted.length === 0) return (
    <div style={{ padding: "60px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
      <p style={{ color: "#484f58", fontSize: 14 }}>Adiciona amigos para ver a atividade aqui.</p>
    </div>
  );

  if (feedLoading) return (
    <div style={{ padding: "60px 16px", textAlign: "center", color: "#484f58" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      A carregar feed...
    </div>
  );

  if (feedItems.length === 0) return (
    <div style={{ padding: "60px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
      <p style={{ color: "#484f58", fontSize: 14 }}>Ainda não há atividade recente dos teus amigos.</p>
    </div>
  );

  return (
    <div style={{ padding: "0 16px" }}>
      {feedItems.map((item, idx) => {
        const tc = TYPE_COLORS[item.type];
        const mt = MEDIA_TYPES.find(t => t.id === item.type);
        const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
        const isCompleto = item.userStatus === "completo";
        return (
          <div key={`${item.friendId}-${item.id}-${idx}`} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e8e0d5"}` }}>
            {/* Avatar */}
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#21262d", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: `2px solid ${accent}44` }}>
              {item.friendAvatar ? <img src={item.friendAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} /> : "👤"}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 5 }}>
                <span style={{ fontWeight: 800, color: accent }}>{item.friendName}</span>
                <span style={{ color: darkMode ? "#6b7280" : "#94a3b8" }}> {isCompleto ? "completou" : "está a ver"} </span>
                <span style={{ fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117" }}>{item.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {mt && tc && (
                  <span style={{ background: `${tc}18`, color: tc, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 800, letterSpacing: "0.03em" }}>
                    {mt.label}
                  </span>
                )}
                {item.userRating > 0 && (
                  <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 800 }}>★ {item.userRating}</span>
                )}
                <span style={{ fontSize: 11, color: "#484f58", marginLeft: "auto" }}>{timeAgo(item.addedAt)}</span>
              </div>
            </div>
            {/* Capa */}
            <div style={{ width: 44, height: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1.5px solid ${tc || accent}33`, background: "#161b22" }}>
              {coverSrc
                ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{mt?.icon}</div>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FriendsView({ user, accent, darkMode = true, isMobileDevice = false, library = {} }) {
  const [tab, setTab] = useState("friends"); // friends | search | requests
  const [friendships, setFriendships] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState("");

  const showNotif = (msg) => { setNotif(msg); setTimeout(() => setNotif(""), 2500); };

  useEffect(() => { loadFriendships(); }, []);

  const loadFriendships = async () => {
    setLoading(true);
    const data = await supa.getFriendships(user.id);
    setFriendships(data);
    setLoading(false);
  };

  const accepted = friendships.filter(f => f.status === "accepted");
  const pending = friendships.filter(f => f.status === "pending" && f.addressee_id === user.id);
  const sent = friendships.filter(f => f.status === "pending" && f.requester_id === user.id);

  const getFriendInfo = (f) => f.requester_id === user.id ? f.addressee : f.requester;

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    const results = await supa.searchUsers(searchQ);
    setSearchResults(results.filter(r => r.id !== user.id));
    setSearching(false);
  };

  const handleSendRequest = async (targetId) => {
    try {
      await supa.sendFriendRequest(user.id, targetId);
      showNotif("Pedido enviado!");
      await loadFriendships();
    } catch (e) {
      if (e.message?.includes("duplicate")) {
        showNotif("Pedido já enviado!");
      } else {
        showNotif("Erro: " + e.message);
      }
      await loadFriendships();
    }
  };

  const handleAccept = async (fId) => {
    await supa.acceptFriendRequest(fId);
    showNotif("Amigo adicionado!");
    await loadFriendships();
  };

  const handleDecline = async (fId) => {
    await supa.declineFriendRequest(fId);
    await loadFriendships();
  };

  const handleRemove = async (f) => {
    await supa.removeFriend(f.requester_id, f.addressee_id);
    showNotif("Amigo removido.");
    await loadFriendships();
    setSelectedFriend(null);
  };

  const openFriendProfile = async (friendId, friendInfo) => {
    setSelectedFriend(friendInfo);
    const [prof, lib] = await Promise.all([supa.getFriendProfile(friendId), supa.getFriendLibrary(friendId)]);
    setFriendData({ profile: prof, library: lib });
  };

  const friendshipStatus = (targetId) => {
    const f = friendships.find(f =>
      (f.requester_id === user.id && f.addressee_id === targetId) ||
      (f.addressee_id === user.id && f.requester_id === targetId)
    );
    if (!f) return null;
    return { status: f.status, isRequester: f.requester_id === user.id, id: f.id };
  };

  if (selectedFriend && friendData) {
    const libItems = Object.values(friendData.library || {});
    const favs = friendData.profile?.favorites || [];
    const byStatus = {};
    STATUS_OPTIONS.forEach(s => { byStatus[s.id] = libItems.filter(i => i.userStatus === s.id).length; });
    const rated = libItems.filter(i => i.userRating > 0);
    const avgRating = rated.length ? (rated.reduce((a, i) => a + i.userRating, 0) / rated.length).toFixed(1) : "—";
    const completados = libItems.filter(i => i.userStatus === "completo").sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    const inCurso = libItems.filter(i => i.userStatus === "assistindo").sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    // Usar a cor e background do amigo
    const fAccent = friendData.profile?.accent || "#dc2626";
    const fBgColor = friendData.profile?.bg_color || (darkMode ? "#0d1117" : "#f5f0e8");
    const fBgImage = isMobileDevice ? (friendData.profile?.bg_image_mobile || friendData.profile?.bg_image || "") : (friendData.profile?.bg_image || "");
    const fDark = isColorDark(fBgColor);

    const FriendCard = ({ item, size = 90 }) => {
      const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
      return (
        <div style={{ flexShrink: 0, width: size }}>
          <div style={{ width: size, height: Math.round(size * 1.45), borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), position: "relative", border: `1px solid ${fAccent}22` }}>
            {coverSrc ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "16px 6px 6px" }}>
              <p style={{ fontSize: 10, color: "white", fontWeight: 700, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
            </div>
            {item.userRating > 0 && (
              <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.85)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>★ {item.userRating}</div>
            )}
            {item.lastChapter && item.userStatus === "assistindo" && (
              <div style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.85)", borderRadius: 4, padding: "1px 4px", fontSize: 9, color: accent, fontWeight: 700, maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.lastChapter.replace(/chapter /i,'Ch.').replace(/vol\.\d+\s*/i,'')}
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div style={{ position: "relative", minHeight: "100vh", maxWidth: isMobileDevice ? 600 : "100%", margin: "0 auto", paddingBottom: 20,
        background: fBgImage ? "transparent" : fBgColor,
        color: fDark ? "#e6edf3" : "#0d1117",
      }}>
        {/* Background do amigo */}
        {fBgImage && (
          <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url(${fBgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
            <div style={{ position: "absolute", inset: 0, background: `${fBgColor}cc`, backdropFilter: "blur(2px)" }} />
          </div>
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
        <button onClick={() => { setSelectedFriend(null); setFriendData(null); }} style={{ background: "none", border: "none", color: fAccent, cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "16px" }}>← Voltar</button>

        {/* Banner + Avatar */}
        <div style={{ position: "relative", marginBottom: 60 }}>
          <div style={{
            height: 180, overflow: "hidden", position: "relative",
            borderRadius: "16px 16px 0 0",
            background: friendData.profile?.banner
              ? `url(${friendData.profile.banner}) center/cover no-repeat`
              : fBgImage ? "transparent" : fBgColor,
          }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
            {!friendData.profile?.banner && (
              <>
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} xmlns="http://www.w3.org/2000/svg">
                  <defs><pattern id="fhex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
                    <polygon points="28,4 52,16 52,32 28,44 4,32 4,16" fill="none" stroke={fAccent} strokeWidth="1"/>
                  </pattern></defs>
                  <rect width="100%" height="100%" fill="url(#fhex)"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 40% 50%, ${fAccent}28 0%, transparent 60%)` }} />
              </>
            )}
          </div>
          <div style={{ position: "absolute", bottom: -44, left: "50%", transform: "translateX(-50%)" }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", border: `3px solid ${fBgColor}`, boxShadow: `0 0 0 3px ${fAccent}, 0 8px 24px rgba(0,0,0,0.5)`, background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
              {friendData.profile?.avatar ? <img src={friendData.profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
            </div>
          </div>
        </div>

        {/* Nome + bio */}
        <div style={{ textAlign: "center", padding: "0 16px 20px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, background: `linear-gradient(90deg, ${fAccent}, ${fDark ? "#e6edf3" : "#0d1117"})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{friendData.profile?.name || selectedFriend.name || "Utilizador"}</h2>
          {friendData.profile?.username && <p style={{ color: fDark ? "#8b949e" : "#64748b", fontSize: 13, marginTop: 2 }}>@{friendData.profile.username}</p>}
          {friendData.profile?.bio && <p style={{ color: fDark ? "#8b949e" : "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{friendData.profile.bio}</p>}
        </div>

        {/* Layout PC: 2 colunas | Mobile: 1 coluna */}
        <div style={ !isMobileDevice ? { display: "flex", gap: 24, padding: "0 24px", alignItems: "flex-start" } : {}}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* Stats */}
        <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
            {STATUS_OPTIONS.slice(0,3).map(s => (
              <div key={s.id} style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${s.color}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {STATUS_OPTIONS.slice(3).map(s => (
              <div key={s.id} style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${s.color}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
            <div style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid #f59e0b33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>★ Média</div>
            </div>
            <div style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${fAccent}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: fAccent }}>{libItems.length}</div>
              <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>Total</div>
            </div>
          </div>
        </div>

        {/* Em comum */}
        {(() => {
          const myLib = Object.values(library || {});
          const emComum = libItems.filter(fi => myLib.some(mi => mi.id === fi.id && mi.userStatus === "completo" && fi.userStatus === "completo"));
          if (!emComum.length) return null;
          return (
            <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: fAccent, letterSpacing: "0.12em", textTransform: "uppercase" }}>EM COMUM</h3>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${fAccent}55, transparent)` }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: fAccent, background: `${fAccent}18`, padding: "1px 7px", borderRadius: 20 }}>{emComum.length}</span>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                {emComum.slice(0, 12).map(item => {
                  const myItem = myLib.find(mi => mi.id === item.id);
                  const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
                  return (
                    <div key={item.id} style={{ flexShrink: 0, width: 72 }}>
                      <div style={{ width: 72, height: 104, borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), position: "relative", border: `1px solid ${fAccent}22` }}>
                        {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        {myItem?.userRating > 0 && item.userRating > 0 && myItem.userRating !== item.userRating && (
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.85)", padding: "3px 4px", display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                            <span style={{ color: accent }}>★{myItem.userRating}</span>
                            <span style={{ color: fAccent }}>★{item.userRating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Favoritos */}
        {favs.length > 0 && (() => {
          const favByType = {};
          favs.forEach(f => { if (!favByType[f.type]) favByType[f.type] = []; favByType[f.type].push(f); });
          const activeTypes = MEDIA_TYPES.slice(1).filter(t => favByType[t.id]?.length > 0);
          return (
            <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>FAVORITES</h3>
                <span style={{ fontSize: 10, fontWeight: 800, color: fAccent, background: `${fAccent}18`, padding: "1px 7px", borderRadius: 20 }}>{favs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activeTypes.map(t => {
                  const tc = TYPE_COLORS[t.id] || fAccent;
                  return (
                    <div key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.label}</span>
                        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${tc}55, transparent)` }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, background: `${tc}18`, padding: "1px 7px", borderRadius: 20 }}>{favByType[t.id].length}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {favByType[t.id].map(item => {
                          const coverSrc = item.customCover || item.cover;
                          return (
                            <div key={item.id} style={{ position: "relative" }}>
                              <div style={{ aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), border: `2px solid ${tc}33`, boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
                                {coverSrc ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />
                                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{t.icon}</div>}
                                {item.userRating > 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.88)", borderRadius: 5, padding: "1px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 800 }}>★{item.userRating}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Completados */}
        {completados.length > 0 && (
          <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>COMPLETADOS</h3>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {completados.slice(0, 15).map(item => <FriendCard key={item.id} item={item} size={110} />)}
            </div>
          </div>
        )}

        {/* Em Curso */}
        {inCurso.length > 0 && (
          <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>EM CURSO</h3>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {inCurso.slice(0, 15).map(item => <FriendCard key={item.id} item={item} size={90} />)}
            </div>
          </div>
        )}

        </div>
        {/* PC: coluna direita — diário do amigo */}
        {!isMobileDevice && (() => {
          const fCompletados = libItems.filter(i => i.userStatus === "completo" && i.addedAt).sort((a,b) => b.addedAt - a.addedAt);
          if (!fCompletados.length) return null;
          const MONTH_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
          const groups = {};
          fCompletados.forEach(item => {
            const d = new Date(item.addedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
            if (!groups[key]) groups[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
            groups[key].items.push({ ...item, _day: d.getDate() });
          });
          const sortedGroups = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
          return (
            <div style={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${fDark ? "#21262d" : "#e2e8f0"}`, paddingLeft: 24, marginLeft: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>DIARY</h3>
                <span style={{ fontSize: 11, color: "#484f58" }}>{fCompletados.length} entradas</span>
              </div>
              {sortedGroups.slice(0, 4).map(group => (
                <div key={group.key} style={{ display: "flex", marginBottom: 20 }}>
                  <div style={{ flexShrink: 0, width: 52, marginRight: 10 }}>
                    <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
                      <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#8b949e", letterSpacing: 1 }}>{MONTH_PT[group.month]}</div>
                      <div style={{ padding: "4px 0 5px", fontSize: 15, fontWeight: 900, color: "#e6edf3" }}>{group.year}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {[...group.items].sort((a,b) => b._day - a._day).slice(0, 5).map((item, idx, arr) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: idx < arr.length-1 ? "1px solid #21262d" : "none" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#484f58", width: 14, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                        {(item.cover || item.thumbnailUrl) ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 22, height: 32, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} /> : <div style={{ width: 22, height: 32, borderRadius: 3, background: gradientFor(item.id), flexShrink: 0 }} />}
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: fDark ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                        {item.userRating > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, flexShrink: 0 }}>★{item.userRating}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        </div>{/* fim layout PC */}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: isMobileDevice ? 600 : 860, margin: "0 auto", padding: isMobileDevice ? "16px 0 20px" : "24px 28px 20px" }}>
      {notif && <div style={{ margin: "0 16px 12px", padding: "10px 14px", background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 10, fontSize: 13, color: accent, textAlign: "center" }}>{notif}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "0 16px", marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { id: "feed", label: "🕐 Feed" },
          { id: "friends", label: `Amigos (${accepted.length})` },
          { id: "search", label: "Pesquisar" },
          { id: "requests", label: `Pedidos${pending.length > 0 ? ` (${pending.length})` : ""}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0,
            padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: tab === t.id ? accent : "#21262d",
            color: tab === t.id ? "white" : "#8b949e",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Feed de Atividade ── */}
      {tab === "feed" && <FeedTab accepted={accepted} getFriendInfo={getFriendInfo} accent={accent} darkMode={false} />}

      {/* Friends list */}
      {tab === "friends" && (
        <div style={{ padding: "0 16px" }}>
          {loading ? <p style={{ color: "#484f58", textAlign: "center" }}>A carregar...</p>
          : accepted.length === 0 ? <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>Ainda não tens amigos. Pesquisa pelo nome ou username!</p>
          : accepted.map(f => {
            const info = getFriendInfo(f);
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: darkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}
                onClick={() => openFriendProfile(info.id, info)}
                onMouseEnter={e => e.currentTarget.style.borderColor = accent + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = darkMode ? "#21262d" : "#e2e8f0"}>
                {/* Avatar */}
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${accent}44, ${accent}22)`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: `2px solid ${accent}33` }}>
                  {info?.avatar ? <img src={info.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0d1117" }}>{info?.name || "Utilizador"}</p>
                  {info?.username && <p style={{ fontSize: 11, color: "#484f58", marginTop: 1 }}>@{info.username}</p>}
                </div>
                <span style={{ color: accent, fontSize: 16, opacity: 0.6 }}>→</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      {tab === "search" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Pesquisar por nome ou username..."
              style={{ flex: 1, padding: "10px 14px", background: "#161b22", border: "1px solid #30363d", borderRadius: 10, color: "#e6edf3", fontFamily: "inherit", fontSize: 14 }} />
            <button onClick={handleSearch} style={{ padding: "10px 16px", background: accent, border: "none", borderRadius: 10, color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              {searching ? "..." : "🔍"}
            </button>
          </div>
          {searchResults.map(r => {
            const fs = friendshipStatus(r.id);
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {r.avatar ? <img src={r.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{r.name || "Utilizador"}</p>
                  {r.username && <p style={{ fontSize: 12, color: "#484f58" }}>@{r.username}</p>}
                </div>
                {!fs ? (
                  <button onClick={() => handleSendRequest(r.id)} style={{ padding: "6px 12px", background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 8, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>+ Adicionar</button>
                ) : fs.status === "accepted" ? (
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>✓ Amigos</span>
                ) : fs.isRequester ? (
                  <span style={{ fontSize: 12, color: "#484f58" }}>Pendente</span>
                ) : (
                  <button onClick={() => handleAccept(fs.id)} style={{ padding: "6px 12px", background: "#10b98122", border: "1px solid #10b98144", borderRadius: 8, color: "#10b981", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>Aceitar</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Requests */}
      {tab === "requests" && (
        <div style={{ padding: "0 16px" }}>
          {pending.length === 0 && sent.length === 0 && <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>Sem pedidos pendentes.</p>}
          {pending.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8 }}>PEDIDOS RECEBIDOS</p>
              {pending.map(f => {
                const info = f.requester;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{info?.name || "Utilizador"}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleAccept(f.id)} style={{ padding: "6px 10px", background: "#10b98122", border: "1px solid #10b98144", borderRadius: 8, color: "#10b981", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>✓</button>
                      <button onClick={() => handleDecline(f.id)} style={{ padding: "6px 10px", background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {sent.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, marginTop: 16 }}>PEDIDOS ENVIADOS</p>
              {sent.map(f => {
                const info = f.addressee;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{info?.name || "Utilizador"}</p>
                    </div>
                    <span style={{ fontSize: 12, color: "#484f58" }}>Aguarda...</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth, accent }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const accentRgb = `${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}`;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError("Preenche todos os campos."); return; }
    if (password.length < 6) { setError("A password deve ter pelo menos 6 caracteres."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (mode === "register") {
        const { user: u } = await supa.signUp(email.trim(), password);
        if (u) {
          onAuth(u);
        } else {
          setSuccess("Conta criada! Faz login para entrar.");
          setMode("login");
        }
      } else {
        const { user: u } = await supa.signIn(email.trim(), password);
        onAuth(u);
      }
    } catch (e) {
      setError(e.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', 'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "white", marginBottom: 16 }}>T</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px" }}>TrackAll</h1>
          <p style={{ color: "#484f58", fontSize: 14, marginTop: 6 }}>Organiza toda a tua mídia num só lugar</p>
        </div>

        {/* Card */}
        <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: 28 }}>
          {/* Tabs */}
          <div style={{ display: "flex", background: "#0d1117", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                background: mode === m ? accent : "transparent",
                color: mode === m ? "white" : "#484f58",
              }}>{m === "login" ? "Entrar" : "Criar Conta"}</button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>EMAIL</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="o-teu@email.com"
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", fontFamily: "inherit" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>PASSWORD</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#ef444415", borderRadius: 8 }}>{error}</p>}
          {success && <p style={{ color: "#10b981", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#10b98115", borderRadius: 8 }}>{success}</p>}

          <button
            onClick={handleSubmit} disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "white",
              fontFamily: "inherit", fontSize: 15, fontWeight: 700,
              opacity: loading ? 0.7 : 1, transition: "all 0.2s",
              boxShadow: `0 4px 20px rgba(${accentRgb},0.3)`,
            }}
          >{loading ? "A processar..." : mode === "login" ? "Entrar" : "Criar Conta"}</button>
        </div>

        <p style={{ textAlign: "center", color: "#30363d", fontSize: 11, marginTop: 20 }}>
          Os teus dados ficam guardados em segurança na nuvem
        </p>
      </div>
    </div>
  );
}

// ─── Recommendations ──────────────────────────────────────────────────────────
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

async function fetchTrendingAnime() {
  try {
    // Busca 2 listas diferentes e mistura
    const [trending, popular] = await Promise.all([
      fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ Page(page:1,perPage:25) { media(type:ANIME,sort:TRENDING_DESC,status_not:NOT_YET_RELEASED) { id title{romaji} coverImage{large} averageScore } } }` }),
      }).then(r => r.json()).then(d => d.data?.Page?.media || []).catch(() => []),
      fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ Page(page:2,perPage:25) { media(type:ANIME,sort:TRENDING_DESC,status_not:NOT_YET_RELEASED) { id title{romaji} coverImage{large} averageScore } } }` }),
      }).then(r => r.json()).then(d => d.data?.Page?.media || []).catch(() => []),
    ]);
    return shuffle([...trending, ...popular]).map(m => ({
      id: `al-${m.id}`, title: m.title.romaji, cover: m.coverImage?.large,
      type: "anime", source: "AniList", score: m.averageScore,
    }));
  } catch { return []; }
}

async function fetchTrendingManga() {
  try {
    const [p1, p2] = await Promise.all([
      fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ Page(page:1,perPage:25) { media(type:MANGA,sort:TRENDING_DESC) { id title{romaji} coverImage{large} averageScore } } }` }),
      }).then(r => r.json()).then(d => d.data?.Page?.media || []).catch(() => []),
      fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ Page(page:2,perPage:25) { media(type:MANGA,sort:TRENDING_DESC) { id title{romaji} coverImage{large} averageScore } } }` }),
      }).then(r => r.json()).then(d => d.data?.Page?.media || []).catch(() => []),
    ]);
    return shuffle([...p1, ...p2]).map(m => ({
      id: `al-${m.id}`, title: m.title.romaji, cover: m.coverImage?.large,
      type: "manga", source: "AniList", score: m.averageScore,
    }));
  } catch { return []; }
}

async function fetchTrendingMovies(tmdbKey) {
  if (!tmdbKey) return [];
  try {
    const [p1, p2, p3] = await Promise.all([1,2,3].map(page =>
      fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}&language=pt-PT&page=${page}`)
        .then(r => r.json()).then(d => d.results || []).catch(() => [])
    ));
    return shuffle([...p1, ...p2, ...p3]).map(m => ({
      id: `tmdb-movie-${m.id}`, title: m.title,
      cover: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      type: "filmes", source: "TMDB", score: Math.round(m.vote_average * 10),
    }));
  } catch { return []; }
}

async function fetchTrendingSeries(tmdbKey) {
  if (!tmdbKey) return [];
  try {
    const [p1, p2, p3] = await Promise.all([1,2,3].map(page =>
      fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${tmdbKey}&language=pt-PT&page=${page}`)
        .then(r => r.json()).then(d => d.results || []).catch(() => [])
    ));
    return shuffle([...p1, ...p2, ...p3]).map(m => ({
      id: `tmdb-tv-${m.id}`, title: m.name,
      cover: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      type: "series", source: "TMDB", score: Math.round(m.vote_average * 10),
    }));
  } catch { return []; }
}

async function fetchTrendingGames(workerUrl) {
  if (!workerUrl) return [];
  try {
    const url = workerUrl.replace(/\/$/, "") + "/igdb";
    const offset = Math.floor(Math.random() * 100);
    const results = await Promise.all([0, offset].map(off =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: `fields name,cover.url,rating; where rating > 75 & rating_count > 30 & cover != null; sort rating desc; limit 30; offset ${off};`,
      }).then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => [])
    ));
    return shuffle(results.flat()).map(g => ({
      id: `igdb-${g.id}`, title: g.name,
      cover: g.cover?.url ? "https:" + g.cover.url.replace("t_thumb", "t_cover_big") : null,
      type: "jogos", source: "IGDB", score: Math.round(g.rating),
    })).filter(g => g.cover);
  } catch { return []; }
}

// ─── Recommendation Carousel ──────────────────────────────────────────────────
function RecoCarousel({ title, icon, items, library, onOpen, accent, loading }) {
  if (loading) return (
    <div style={{ padding: "0 16px 28px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{icon} {title}</h2>
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flexShrink: 0, width: 100, height: 148, borderRadius: 10, background: "#161b22", animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    </div>
  );
  if (!items || items.length === 0) return null;

  // Filter out items already in library — as user adds, new ones slide in
  const toShow = items.filter(i => !library[i.id]);
  if (toShow.length === 0) return null;

  return (
    <div style={{ padding: "0 16px 28px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{icon} {title}</h2>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {toShow.map(item => (
          <div key={item.id} onClick={() => onOpen(item)} style={{ flexShrink: 0, width: 100, cursor: "pointer" }}>
            <div style={{ width: 100, height: 148, borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), marginBottom: 6, position: "relative" }}>
              {item.cover
                ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
              }
              {(() => {
                const libItem = library[item.id];
                const score = libItem?.userRating > 0 ? libItem.userRating : item.score;
                const color = libItem?.userRating > 0 ? "#f59e0b" : "#f59e0b";
                return score > 0 ? (
                  <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.75)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color, fontWeight: 700 }}>
                    ★ {score}
                  </div>
                ) : null;
              })()}
            </div>
            <p style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </div>
  );
}

// ─── Library Grouped List (modo lista agrupado por tipo) ─────────────────────
function LibGroupedList({ items, library, accent, darkMode, onOpen }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const groups = MEDIA_TYPES.slice(1)
    .map(t => ({ type: t, items: items.filter(i => i.type === t.id) }))
    .filter(g => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map(({ type: t, items: gItems }) => (
        <div key={t.id}>
          <button onClick={() => toggle(t.id)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: "none", border: "none", cursor: "pointer", padding: "4px 0 8px",
            fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: darkMode ? "#8b949e" : "#64748b" }}>{t.label}</span>
            <span style={{ fontSize: 10, color: accent, background: `${accent}18`, padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{gItems.length}</span>
            <span style={{ marginLeft: "auto", color: "#484f58", fontSize: 13, transform: collapsed[t.id] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
          </button>
          {!collapsed[t.id] && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {gItems.map(item => {
                const libItem = library[item.id];
                const status = STATUS_OPTIONS.find(s => s.id === libItem?.userStatus);
                const coverSrc = libItem?.customCover || item.cover || item.thumbnailUrl;
                return (
                  <div key={item.id} onClick={() => onOpen(item)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "7px 10px",
                    borderRadius: 8, cursor: "pointer",
                    background: darkMode ? "#161b22" : "rgba(255,252,247,0.8)",
                    border: `1px solid ${darkMode ? "#21262d" : "#e8e0d5"}`,
                    transition: "background 0.12s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1c2128" : "#fffcf7"}
                    onMouseLeave={e => e.currentTarget.style.background = darkMode ? "#161b22" : "rgba(255,252,247,0.8)"}>
                    <div style={{ width: 34, height: 48, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: gradientFor(item.id) }}>
                      {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: darkMode ? "#e6edf3" : "#1a1a2e" }}>{item.title}</p>
                      {item.year && <p style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>{item.year}</p>}
                    </div>
                    {status && <span style={{ fontSize: 12, flexShrink: 0 }}>{status.emoji}</span>}
                    {libItem?.userRating > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 800, flexShrink: 0 }}>★ {libItem.userRating}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Paperback Backup Parser ─────────────────────────────────────────────────
async function parsePaperbackBackup(file) {
  // Carregar JSZip dinamicamente
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar JSZip'));
      document.head.appendChild(s);
    });
  }
  const ab = await file.arrayBuffer();
  const zip = await window.JSZip.loadAsync(ab);

  const readJSON = async (name) => {
    const f = zip.file(name); if (!f) return {};
    const txt = await f.async('string'); return JSON.parse(txt);
  };

  const [libData, infoData, srcData, chapData, progData] = await Promise.all([
    readJSON('__LIBRARY_MANGA_V4'),
    readJSON('__MANGA_INFO_V4'),
    readJSON('__SOURCE_MANGA_V4'),
    readJSON('__CHAPTER_V4'),
    readJSON('__CHAPTER_PROGRESS_MARKER_V4-1'),
  ]);

  // sourceId → type mapping
  const sourceTypeMap = {
    ReadAllComics: 'comics', ReadComicsOnline: 'comics',
    MangaPlus: 'manga', Manganato: 'manga', MangaDex: 'manga',
    ReadBerserk: 'manga', ReadJujutsuKaisen: 'manga',
    Webtoons: 'manhwa', TappytoonComics: 'manhwa',
  };
  const guessType = (sid) => {
    if (!sid) return 'manga';
    if (/comic/i.test(sid)) return 'comics';
    if (/webtoon|tappy/i.test(sid)) return 'manhwa';
    return 'manga';
  };

  // Calcular progresso por info_id
  const mangaTotal = {}, mangaCompleted = {};
  for (const ch of Object.values(chapData)) {
    const srcId = ch?.sourceManga?.id;
    const infoId = srcData[srcId]?.mangaInfo?.id;
    if (infoId) mangaTotal[infoId] = (mangaTotal[infoId] || 0) + 1;
  }
  for (const p of Object.values(progData)) {
    const chId = p?.chapter?.id;
    const ch = chapData[chId];
    const srcId = ch?.sourceManga?.id;
    const infoId = srcData[srcId]?.mangaInfo?.id;
    if (infoId && p?.completed) mangaCompleted[infoId] = (mangaCompleted[infoId] || 0) + 1;
  }

  const results = [];
  for (const [, libItem] of Object.entries(libData)) {
    try {
      const srcId = libItem?.primarySource?.id;
      const src = srcData[srcId]; if (!src) continue;
      const infoId = src?.mangaInfo?.id;
      const manga = infoData[infoId]; if (!manga) continue;
      const titles = manga?.titles || []; if (!titles.length) continue;
      const title = titles[0];
      const cover = manga?.image || '';
      const sourceId = src?.sourceId || '';
      const type = sourceTypeMap[sourceId] || guessType(sourceId);
      const total = mangaTotal[infoId] || 0;
      const completed = mangaCompleted[infoId] || 0;
      let userStatus = 'planejado';
      if (completed > 0 && total > 0 && completed >= total) userStatus = 'completo';
      else if (completed > 0) userStatus = 'assistindo';
      // Apple timestamp: segundos desde 2001-01-01 → ms desde 1970-01-01
      const APPLE_EPOCH_OFFSET = 978307200;
      const addedAt = libItem.dateBookmarked
        ? Math.round((libItem.dateBookmarked + APPLE_EPOCH_OFFSET) * 1000)
        : Date.now();
      results.push({ id: `pb-${infoId}`, title, cover, type, userStatus, chaptersRead: completed, totalChapters: total, source: 'Paperback', addedAt });
    } catch {}
  }
  return results;
}

// ─── Letterboxd CSV Parser ────────────────────────────────────────────────────
function parseLetterboxdCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const nameIdx   = header.findIndex(h => h === 'Name');
  const yearIdx   = header.findIndex(h => h === 'Year');
  const ratingIdx = header.findIndex(h => h === 'Rating');
  const dateIdx   = header.findIndex(h => h === 'Watched Date' || h === 'Date');
  if (nameIdx === -1) return [];

  const parseRow = (line) => {
    // Handle quoted fields with commas
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  };

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
      const fields = parseRow(lines[i]);
      const title = fields[nameIdx]?.replace(/^"|"$/g, '') || ''; if (!title) continue;
      const year  = fields[yearIdx]?.replace(/^"|"$/g, '') || '';
      const ratingRaw = parseFloat(fields[ratingIdx] || '0');
      const rating = isNaN(ratingRaw) ? 0 : Math.round(ratingRaw * 2); // 0.5–5 → 1–10
      const dateStr = fields[dateIdx]?.replace(/^"|"$/g, '') || '';
      const addedAt = dateStr ? new Date(dateStr).getTime() || Date.now() : Date.now();
      results.push({
        id: `lb-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${year}`,
        title, year: parseInt(year) || undefined,
        type: 'filmes', userStatus: 'completo',
        userRating: rating, addedAt, source: 'Letterboxd',
      });
    } catch {}
  }
  return results;
}

// ─── Paperback Import Modal ───────────────────────────────────────────────────
function PaperbackImportModal({ onClose, onImport, accent, darkMode }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const bg = darkMode ? '#161b22' : '#ffffff';
  const border = darkMode ? '#30363d' : '#e2e8f0';

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setError('');
    try {
      const parsed = await parsePaperbackBackup(file);
      if (!parsed.length) { setError('Nenhum item encontrado. Certifica-te que é um backup Paperback (.zip) válido.'); setLoading(false); return; }
      const sel = {}; parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError('Erro: ' + err.message); }
    setLoading(false);
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };
  const statusColor = { assistindo: accent, completo: '#10b981', planejado: '#06b6d4' };
  const statusLabel = { assistindo: '▶ Em Curso', completo: '✓ Completo', planejado: '⏰ Planejado' };
  const typeIcon = { manga: '🗒', comics: '💬' };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📖</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Importar do Paperback</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{step === 'preview' ? `${items.length} itens encontrados` : 'Backup iOS'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: darkMode ? '#0d1117' : '#f8fafc', borderRadius: 12, padding: 20, textAlign: 'center', border: `2px dashed ${darkMode ? '#30363d' : '#e2e8f0'}`, marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Seleciona o ficheiro de backup</p>
              <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>Ficheiro .zip ou .pas4 exportado pelo Paperback</p>
              <input ref={fileRef} type="file" accept=".zip,.pas4" onChange={handleFile} style={{ display: 'none' }} />
              <button className="btn-accent" onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', fontSize: 13 }}>
                {loading ? '⏳ A processar...' : 'Escolher ficheiro .zip'}
              </button>
            </div>
            <div style={{ background: darkMode ? '#161b2288' : '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
              💡 <strong>Como exportar do Paperback:</strong><br />
              Paperback → <strong>Definições</strong> → <strong>Backup</strong> → <strong>Criar Backup</strong> → partilhar o ficheiro .zip
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)}  style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Todos</button>
                <button onClick={() => toggleAll(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Nenhum</button>
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {items.map(item => (
                <div key={item.id} onClick={() => setSelected(s => ({ ...s, [item.id]: !s[item.id] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selected[item.id] ? `${accent}11` : (darkMode ? '#0d1117' : '#f8fafc'), border: `1px solid ${selected[item.id] ? accent + '44' : (darkMode ? '#21262d' : '#e2e8f0')}` }}>
                  <div style={{ width: 32, height: 44, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: '#21262d' }}>
                    {item.cover && <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display='none'} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <p style={{ fontSize: 10, color: '#8b949e', marginTop: 1 }}>{typeIcon[item.type] || '📖'} {item.type} · {item.chaptersRead}/{item.totalChapters} cap.</p>
                  </div>
                  <span style={{ fontSize: 10, color: statusColor[item.userStatus], fontWeight: 700, flexShrink: 0 }}>{statusLabel[item.userStatus]}</span>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{selected[item.id] ? '☑' : '☐'}</span>
                </div>
              ))}
            </div>
            <button onClick={handleImport} className="btn-accent" disabled={!Object.values(selected).some(Boolean)} style={{ width: '100%', padding: '12px 0', fontSize: 14 }}>
              Importar {Object.values(selected).filter(Boolean).length} itens
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Importação concluída!</p>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>Os teus itens do Paperback já estão na biblioteca.</p>
            <button onClick={onClose} className="btn-accent" style={{ padding: '10px 28px', fontSize: 14 }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Letterboxd Import Modal ──────────────────────────────────────────────────
function LetterboxdImportModal({ onClose, onImport, accent, darkMode }) {
  const [step, setStep] = useState('upload');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const bg = darkMode ? '#161b22' : '#ffffff';
  const border = darkMode ? '#30363d' : '#e2e8f0';

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setError('');
    try {
      const text = await file.text();
      const parsed = parseLetterboxdCSV(text);
      if (!parsed.length) { setError('Nenhum filme encontrado. Certifica-te que é o ficheiro diary.csv ou watched.csv do Letterboxd.'); setLoading(false); return; }
      const sel = {}; parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError('Erro: ' + err.message); }
    setLoading(false);
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#00e05422', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎬</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Importar do Letterboxd</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{step === 'preview' ? `${items.length} filmes encontrados` : 'CSV de filmes vistos'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: darkMode ? '#0d1117' : '#f8fafc', borderRadius: 12, padding: 20, textAlign: 'center', border: `2px dashed ${darkMode ? '#30363d' : '#e2e8f0'}`, marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎞️</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Seleciona o ficheiro CSV</p>
              <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>diary.csv ou watched.csv exportado do Letterboxd</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? '⏳ A processar...' : 'Escolher ficheiro .csv'}
              </button>
            </div>
            <div style={{ background: darkMode ? '#161b2288' : '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
              💡 <strong>Como exportar do Letterboxd:</strong><br />
              letterboxd.com → <strong>Settings</strong> → <strong>Import & Export</strong> → <strong>Export Your Data</strong> → usar <code>watched.csv</code>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)}  style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Todos</button>
                <button onClick={() => toggleAll(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Nenhum</button>
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {items.map(item => (
                <div key={item.id} onClick={() => setSelected(s => ({ ...s, [item.id]: !s[item.id] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: selected[item.id] ? `${accent}11` : (darkMode ? '#0d1117' : '#f8fafc'), border: `1px solid ${selected[item.id] ? accent + '44' : (darkMode ? '#21262d' : '#e2e8f0')}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: '#8b949e', marginTop: 1 }}>🎬 {item.year || '—'}{item.userRating > 0 ? ` · ★ ${item.userRating}/10` : ''}</p>
                  </div>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{selected[item.id] ? '☑' : '☐'}</span>
                </div>
              ))}
            </div>
            <button onClick={handleImport} style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}
              disabled={!Object.values(selected).some(Boolean)}>
              Importar {Object.values(selected).filter(Boolean).length} filmes
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Importação concluída!</p>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>Os teus filmes do Letterboxd já estão na biblioteca.</p>
            <button onClick={onClose} style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function RatingOverlay({ item, accent, library, onDone }) {
  const [rating, setRating] = useState(0);
  const textColor = (() => {
    const r=parseInt(accent.slice(1,3),16)/255, g=parseInt(accent.slice(3,5),16)/255, b=parseInt(accent.slice(5,7),16)/255;
    return 0.2126*r+0.7152*g+0.0722*b > 0.45 ? "#111" : "#fff";
  })();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => onDone(0)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#161b22", border: `1px solid ${accent}44`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, textAlign: "left" }}>
          {(item.cover || item.thumbnailUrl)
            ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 48, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            : <div style={{ width: 48, height: 68, borderRadius: 8, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
          }
          <div>
            <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>✓ Marcado como completo!</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e6edf3" }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)?.label}</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#8b949e", marginBottom: 20 }}>Queres dar uma avaliação?</p>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <StarRating value={rating} onChange={setRating} size={30} />
          </div>
          {rating > 0 && (
            <button onClick={() => onDone(rating)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: accent, border: "none", color: textColor, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              Confirmar ★ {rating}
            </button>
          )}
        </div>
        <button onClick={() => onDone(0)} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "#21262d", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          Saltar avaliação
        </button>
      </div>
    </div>
  );
}

export default function TrackAll() {
  const [accent, setAccent] = useState("#f97316");
  const [bgColor, setBgColor] = useState("#0d1117");
  const [statsCardBg, setStatsCardBg] = useState("");
  const [driveClientId, setDriveClientId] = useState("");
  const [lastDriveSync, setLastDriveSync] = useState(null);
  const [driveAutoSyncing, setDriveAutoSyncing] = useState(false);
  const [bgImage, setBgImage] = useState("");
  const [bgImageMobile, setBgImageMobile] = useState("");
  const [bgSeparateDevices, setBgSeparateDevices] = useState(false);
  const [bgOverlay, setBgOverlay] = useState("rgba(0,0,0,0.55)");
  const [bgBlur, setBgBlur] = useState(0);
  const [bgParallax, setBgParallax] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState({ name: "", bio: "", avatar: "" });
  const [library, setLibrary] = useState({});
  const [tmdbKey, setTmdbKey] = useState(DEFAULT_TMDB_KEY);
  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [view, setView] = useState("home");
  const [activeTab, setActiveTab] = useState("all");
  const [homeFilter, setHomeFilter] = useState([]);
  const [homeCollapsedCurso, setHomeCollapsedCurso] = useState(false);

  // ── PWA: Register service worker + inject manifest meta tags ──
  useEffect(() => {
    // Bloquear zoom no mobile
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    // Inject manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }
    // Theme color meta
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#0d1117';
      document.head.appendChild(meta);
    }
    // Apple mobile web app
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m1 = document.createElement('meta');
      m1.name = 'apple-mobile-web-app-capable';
      m1.content = 'yes';
      document.head.appendChild(m1);
      const m2 = document.createElement('meta');
      m2.name = 'apple-mobile-web-app-status-bar-style';
      m2.content = 'black-translucent';
      document.head.appendChild(m2);
      const m3 = document.createElement('meta');
      m3.name = 'apple-mobile-web-app-title';
      m3.content = 'TrackAll';
      document.head.appendChild(m3);
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/icon-192.png';
      document.head.appendChild(icon);
      // Favicon SVG inline — evita o globo do browser
      if (!document.querySelector('link[rel="icon"]')) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/svg+xml';
        favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23f97316'/><text x='16' y='23' text-anchor='middle' font-size='20' font-weight='900' font-family='Arial,sans-serif' fill='white'>T</text></svg>`;
        document.head.appendChild(favicon);
      }
    }
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => console.log('[PWA] SW registered:', reg.scope))
        .catch(err => console.log('[PWA] SW failed:', err));
    }
    // Capture install prompt
    const onPrompt = (e) => { e.preventDefault(); setPwaPrompt(e); };
    const onInstalled = () => { setPwaInstalled(true); setPwaPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Check if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) setPwaInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Attach mouse-wheel → horizontal scroll on all .recents-row elements
  useEffect(() => {
    const attach = () => {
      document.querySelectorAll('.recents-row').forEach(el => {
        if (el._wheelOk) return;
        el._wheelOk = true;
        el.addEventListener('wheel', (e) => {
          if (el.scrollWidth <= el.clientWidth) return; // not scrollable
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already horizontal
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }, { passive: false });
      });
    };
    attach();
    const obs = new MutationObserver(attach);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState(() => { try { return JSON.parse(localStorage.getItem("trackall_search_history") || "[]"); } catch { return []; } });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [notif, setNotif] = useState(null);
  const [pwaPrompt, setPwaPrompt] = useState(null); // deferred install prompt
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [libSort, setLibSort] = useState("date");
  const [libViewMode, setLibViewMode] = useState(() => { try { return localStorage.getItem("trackall_lib_view") || "grid"; } catch { return "grid"; } });
  const setLibViewModePersist = (mode) => { setLibViewMode(mode); try { localStorage.setItem("trackall_lib_view", mode); } catch {} };
  const [logOpen, setLogOpen] = useState(false);
  const [logQuery, setLogQuery] = useState("");
  const [logResults, setLogResults] = useState([]);
  const [logSearching, setLogSearching] = useState(false);
  const logInputRef = useRef(null);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchType, setQuickSearchType] = useState(null);
  const [logPendingItem, setLogPendingItem] = useState(null); // item awaiting rating after log
  const [favorites, setFavorites] = useState([]);
  const [recos, setRecos] = useState({});
  const [recoLoading, setRecoLoading] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Restaurar sessão ao arrancar ──
  useEffect(() => {
    const restore = async () => {
      try {
        const user = await supa.getSession();
        if (user) {
          setUser(user);
          await loadUserData(user.id);
        }
      } catch {}
      setAuthLoading(false);
    };
    restore();
  }, []);

  const loadUserData = async (userId) => {
    try {
      const [prof, lib] = await Promise.all([
        supa.getProfile(userId),
        supa.getLibrary(userId),
      ]);
      if (prof) {
        setProfile({ name: prof.name || "", bio: prof.bio || "", avatar: prof.avatar || "", banner: prof.banner || "", hideEmail: prof.hide_email || false });
        if (prof.accent) setAccent(prof.accent);
        if (prof.stats_card_bg) setStatsCardBg(prof.stats_card_bg);
        if (prof.drive_client_id) {
          setDriveClientId(prof.drive_client_id);
          // Auto-sync: try silently after browser is idle (não bloqueia o arranque)
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => autoSyncDrive(prof.drive_client_id), { timeout: 5000 });
          } else {
            setTimeout(() => autoSyncDrive(prof.drive_client_id), 5000);
          }
        }
        if (prof.bg_color) {
          setBgColor(prof.bg_color);
          setDarkMode(isColorDark(prof.bg_color));
        }
        if (prof.bg_image) setBgImage(prof.bg_image);
        if (prof.bg_image_mobile) setBgImageMobile(prof.bg_image_mobile);
        if (prof.bg_separate_devices) setBgSeparateDevices(true);
        if (prof.bg_overlay !== undefined) setBgOverlay(prof.bg_overlay);
        if (prof.bg_blur !== undefined) setBgBlur(prof.bg_blur);
        if (prof.bg_parallax !== undefined) setBgParallax(prof.bg_parallax);
        if (prof.tmdb_key) setTmdbKey(prof.tmdb_key);
        else setTmdbKey(DEFAULT_TMDB_KEY);
        if (prof.worker_url) setWorkerUrl(prof.worker_url);
        else setWorkerUrl(DEFAULT_WORKER_URL);
        if (prof.favorites) setFavorites(prof.favorites);
      }
      if (lib) setLibrary(lib);
    } catch {}
  };

  // Lazy: só carrega recos quando o utilizador vai ao Início pela 1ª vez
  useEffect(() => {
    if (view === "home" && user && !recoLoading && Object.keys(recos).length === 0) {
      loadRecos();
    }
  }, [view, user]);

  const loadRecos = async () => {
    setRecoLoading(true);
    try {
      // Carrega sequencialmente para evitar rate limiting
      const anime = await fetchTrendingAnime();
      const manga = await fetchTrendingManga();
      const [filmes, series, jogos] = await Promise.all([
        fetchTrendingMovies(DEFAULT_TMDB_KEY),
        fetchTrendingSeries(DEFAULT_TMDB_KEY),
        fetchTrendingGames(DEFAULT_WORKER_URL),
      ]);
      setRecos({ anime, manga, filmes, series, jogos });
    } catch {}
    setRecoLoading(false);
  };

  const handleAuth = async (u) => {
    setUser(u);
    await loadUserData(u.id);
  };

  const handleSignOut = async () => {
    await supa.signOut();
    setUser(null);
    setLibrary({});
    setProfile({ name: "", bio: "", avatar: "" });
    setView("home");
  };

  const showNotif = (msg, color) => { setNotif({ msg, color }); setTimeout(() => setNotif(null), Math.max(2000, Math.min(msg.length * 60, 4500))); };

  const saveLibrary = async (lib) => {
    setLibrary(lib);
    // Guarda no Supabase em background
    if (user) {
      try {
        const prev = library;
        // Items novos ou atualizados
        for (const [id, item] of Object.entries(lib)) {
          if (JSON.stringify(prev[id]) !== JSON.stringify(item)) {
            await supa.upsertLibraryItem(user.id, id, item);
          }
        }
        // Items removidos
        for (const id of Object.keys(prev)) {
          if (!lib[id]) await supa.deleteLibraryItem(user.id, id);
        }
      } catch {}
    }
  };

  const saveProfile = async (p) => {
    setProfile(p);
    if (user) {
      try {
        await supa.upsertProfile(user.id, {
          name: p.name || "",
          bio: p.bio || "",
          avatar: p.avatar || "",
          banner: p.banner || "",
          hide_email: p.hideEmail || false,
        });
      } catch {}
    }
  };

  const saveAccent = async (c) => {
    setAccent(c);
    if (user) try { await supa.upsertProfile(user.id, { accent: c }); } catch {}
  };
  const saveStatsCardBg = async (c) => {
    setStatsCardBg(c);
    if (user) try { await supa.upsertProfile(user.id, { stats_card_bg: c }); } catch {}
  };
  const saveDriveClientId = async (id) => {
    setDriveClientId(id);
    if (user) try { await supa.upsertProfile(user.id, { drive_client_id: id }); } catch {}
  };
  const saveBg = async (c) => {
    setBgColor(c);
    setDarkMode(isColorDark(c));
    if (user) try { await supa.upsertProfile(user.id, { bg_color: c }); } catch {}
  };
  const saveBgOverlay = async (o) => {
    setBgOverlay(o);
    if (user) try { await supa.upsertProfile(user.id, { bg_overlay: o }); } catch {}
  };
  const saveBgBlur = async (v) => {
    setBgBlur(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_blur: v }); } catch {}
  };
  const saveBgParallax = async (v) => {
    setBgParallax(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_parallax: v }); } catch {}
  };
  // isMobile check — calculado uma vez, estável entre renders
  const [isMobileDevice] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  const saveBgImage = async (img) => {
    if (bgSeparateDevices) {
      if (isMobileDevice) {
        setBgImageMobile(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch {}
      } else {
        setBgImage(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image: img }); } catch {}
      }
    } else {
      setBgImage(img);
      setBgImageMobile(img);
      if (user) try { await supa.upsertProfile(user.id, { bg_image: img, bg_image_mobile: img }); } catch {}
    }
  };
  const saveMobileBgImage = async (img) => {
    setBgImageMobile(img);
    if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch {}
  };
  const saveBgSeparateDevices = async (val) => {
    setBgSeparateDevices(val);
    if (user) try { await supa.upsertProfile(user.id, { bg_separate_devices: val }); } catch {}
  };
  const saveTmdbKey = async (k) => {
    setTmdbKey(k);
    if (user) try { await supa.upsertProfile(user.id, { tmdb_key: k }); } catch {}
  };
  const saveWorkerUrl = async (k) => {
    setWorkerUrl(k);
    if (user) try { await supa.upsertProfile(user.id, { worker_url: k }); } catch {}
  };

  const addToLibrary = useCallback((item, status, rating = 0) => {
    const lib = { ...library, [item.id]: { ...item, userStatus: status, userRating: rating, addedAt: Date.now() } };
    saveLibrary(lib);
    showNotif(`"${item.title.slice(0, 30)}" adicionado!`, "#10b981");
    if (navigator.vibrate) navigator.vibrate(50);
  }, [library]);

  const autoSyncDrive = async (clientId) => {
    if (!clientId || driveAutoSyncing) return;
    // Only auto-sync once per session (silent, no popup if token fails)
    try {
      setDriveAutoSyncing(true);
      // Try to get token silently (no prompt)
      const token = await new Promise((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) { reject(); return; }
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          prompt: 'none', // silent — no popup
          callback: (resp) => resp.error ? reject() : resolve(resp.access_token),
        });
        client.requestAccessToken({ prompt: 'none' });
      });
      const files = await driveFindBackups(token);
      if (!files.length) return;
      // Download most recent backup
      const fileLike = await driveDownloadFile(token, files[0].id);
      const parsed = await parseMihonBackup(fileLike);
      if (parsed.length) {
        importMihon(parsed);
        setLastDriveSync(new Date());
        showNotif(`Mihon auto-sync: ${parsed.length} mangas ✓`, "#10b981");
      }
    } catch {
      // Silent fail — user will sync manually if needed
    } finally {
      setDriveAutoSyncing(false);
    }
  };

  const importPaperback = async (pbItems) => {
    const lib = { ...library };
    let added = 0, updated = 0;
    const needsCover = []; // itens novos que precisam de capa
    const existingByTitle = {};
    Object.values(lib).forEach(e => { const n = (e.title||'').toLowerCase().trim(); if (n) existingByTitle[n] = e.id; });
    pbItems.forEach(item => {
      const norm = item.title.toLowerCase().trim();
      const existingId = existingByTitle[norm];
      if (lib[item.id]) {
        lib[item.id] = { ...lib[item.id], userStatus: item.userStatus, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else if (existingId) {
        lib[existingId] = { ...lib[existingId], userStatus: item.userStatus, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else {
        lib[item.id] = { ...item, userRating: 0 };
        added++;
        // Marcar para enriquecimento de capa se não tiver cover fiável
        needsCover.push({ id: item.id, title: item.title, type: item.type });
      }
    });
    saveLibrary(lib);
    showNotif(`Paperback: ${added} adicionados, ${updated} atualizados ✓ — A buscar capas...`, "#10b981");

    // ── Enriquecimento de capas em background ──
    // Processa em lotes de 3 para não sobrecarregar as APIs
    const enrichCover = async (id, title, type) => {
      try {
        let cover = '';
        if (type === 'comics') {
          const results = await searchComicVine(title, workerUrl);
          if (results?.length) {
            // Tentar match exato primeiro, senão usar o primeiro resultado
            const exact = results.find(r => r.title.toLowerCase() === title.toLowerCase());
            cover = (exact || results[0]).cover;
          }
        } else {
          // manga / manhwa — usar AniList
          const results = await searchAniList(title, 'MANGA');
          if (results?.length) {
            const exact = results.find(r => r.title.toLowerCase() === title.toLowerCase());
            cover = (exact || results[0]).cover;
          }
        }
        if (cover) {
          // Usar setLibrary com callback para não perder atualizações concorrentes
          setLibrary(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev, [id]: { ...prev[id], cover } };
            // Persistir no Supabase em background
            if (user) supa.upsertLibraryItem(user.id, id, next[id]).catch(() => {});
            return next;
          });
        }
      } catch { /* silent */ }
    };

    // Processar em lotes
    for (let i = 0; i < needsCover.length; i += 3) {
      const batch = needsCover.slice(i, i + 3);
      await Promise.all(batch.map(({ id, title, type }) => enrichCover(id, title, type)));
      if (i + 3 < needsCover.length) await new Promise(r => setTimeout(r, 400)); // throttle
    }

    if (needsCover.length > 0) showNotif(`Capas atualizadas ✓`, "#10b981");
  };

  const importLetterboxd = async (lbItems) => {
    const lib = { ...library };
    let added = 0, updated = 0;
    const existingByTitle = {};
    Object.values(lib).forEach(e => { const n = (e.title||'').toLowerCase().trim(); if (n) existingByTitle[n] = e.id; });
    lbItems.forEach(item => {
      const norm = item.title.toLowerCase().trim();
      const existingId = existingByTitle[norm];
      if (lib[item.id]) {
        lib[item.id] = { ...lib[item.id], userStatus: 'completo', userRating: item.userRating || lib[item.id].userRating };
        updated++;
      } else if (existingId) {
        lib[existingId] = { ...lib[existingId], userStatus: 'completo', userRating: item.userRating || lib[existingId].userRating };
        updated++;
      } else {
        lib[item.id] = { ...item };
        added++;
      }
    });
    saveLibrary(lib);
    showNotif(`Letterboxd: ${added} filmes adicionados, ${updated} atualizados ✓`, "#00e054");
  };

  const importMihon = async (items) => {
    const lib = { ...library };
    let added = 0, updated = 0, skipped = 0;

    // Build title lookup for existing library items (normalize to lowercase)
    const existingByTitle = {};
    Object.values(lib).forEach(entry => {
      const norm = (entry.title || '').toLowerCase().trim();
      if (norm) existingByTitle[norm] = entry.id;
    });

    const coversMissing = [];

    items.forEach(item => {
      const norm = item.title.toLowerCase().trim();
      const existingId = existingByTitle[norm];

      if (lib[item.id]) {
        // Exact ID match — update progress only
        lib[item.id] = { ...lib[item.id], userStatus: item.userStatus, lastChapter: item.lastChapter, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else if (existingId) {
        // Title match — update progress on existing entry, don't create duplicate
        lib[existingId] = { ...lib[existingId], userStatus: item.userStatus, lastChapter: item.lastChapter, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else {
        // New entry
        lib[item.id] = { ...item, userRating: 0, addedAt: Date.now() };
        added++;
        if (!item.thumbnailUrl || item.thumbnailUrl.includes('mangadex.org/covers')) {
          coversMissing.push(item);
        }
      }
    });

    saveLibrary(lib);
    showNotif(`Mihon: ${added} adicionados, ${updated} atualizados${skipped ? `, ${skipped} ignorados` : ''} ✓`, "#10b981");

    // Fetch missing covers from AniList
    if (!coversMissing.length) return;
    showNotif(`A buscar capas para ${coversMissing.length} mangas...`, accent);

    const chunkSize = 10;
    const updatedLib = { ...lib };
    for (let i = 0; i < coversMissing.length; i += chunkSize) {
      const chunk = coversMissing.slice(i, i + chunkSize);
      const queryParts = chunk.map((item, idx) => `
        m${idx}: Media(search: ${JSON.stringify(item.title)}, type: MANGA, sort: SEARCH_MATCH) {
          id coverImage { large medium } title { romaji english }
        }`).join('\n');
      try {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `query { ${queryParts} }` }),
        });
        const data = await res.json();
        if (data?.data) {
          chunk.forEach((item, idx) => {
            const result = data.data[`m${idx}`];
            if (result?.coverImage) {
              const cover = result.coverImage.large || result.coverImage.medium;
              if (cover && updatedLib[item.id]) {
                updatedLib[item.id] = { ...updatedLib[item.id], cover, thumbnailUrl: cover };
              }
            }
          });
        }
      } catch {}
      if (i + chunkSize < coversMissing.length) await new Promise(r => setTimeout(r, 500));
    }
    saveLibrary(updatedLib);
    showNotif(`Capas atualizadas ✓`, "#10b981");
  };
  const removeFromLibrary = (id) => {
    const lib = { ...library }; delete lib[id]; saveLibrary(lib);
    showNotif("Removido da biblioteca", "#ef4444");
  };
  const updateStatus = useCallback((id, status) => {
    if (!library[id]) return;
    const update = { ...library[id], userStatus: status };
    // Atualizar addedAt quando muda para completo — para o diário mostrar a data correta
    if (status === "completo") update.addedAt = Date.now();
    saveLibrary({ ...library, [id]: update });
    showNotif("Estado atualizado!", accent);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [library, accent]);

  const updateLastChapter = useCallback((id, chapter) => {
    if (!library[id] || !chapter) return;
    saveLibrary({ ...library, [id]: { ...library[id], lastChapter: chapter } });
    showNotif(`Capítulo: ${chapter} ✓`, accent);
  }, [library, accent]);
  const updateRating = (id, rating) => {
    if (!library[id]) return;
    saveLibrary({ ...library, [id]: { ...library[id], userRating: rating } });
    showNotif(rating > 0 ? `${rating} ★` : "Avaliação removida", "#f59e0b");
  };
  const updateCover = async (id, url) => {
    if (!library[id]) return;
    saveLibrary({ ...library, [id]: { ...library[id], customCover: url } });
    // Sincronizar cover nos favoritos se este item estiver lá
    const inFavs = favorites.some(f => f.id === id);
    if (inFavs) {
      const newFavs = favorites.map(f => f.id === id ? { ...f, customCover: url } : f);
      setFavorites(newFavs);
      if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
    }
    showNotif("Capa atualizada!", accent);
  };

  const toggleFavorite = async (item) => {
    const exists = favorites.some(f => f.id === item.id);
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => f.id !== item.id);
      showNotif("Removido dos favoritos", "#8b949e");
    } else {
      if (favorites.length >= 30) { showNotif("Máximo de 30 favoritos!", "#ef4444"); return; }
      newFavs = [...favorites, { id: item.id, title: item.title, cover: item.cover, customCover: library[item.id]?.customCover || item.customCover || "", type: item.type }];
      showNotif("Adicionado aos favoritos! ★", "#f59e0b");
      if (navigator.vibrate) navigator.vibrate(50);
    }
    setFavorites(newFavs);
    if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
  };

  const doSearch = useCallback(async (q, type) => {
    if (!q.trim()) return;
    setIsSearching(true); setSearchError(""); setSearchResults([]); setView("search");
    try {
      let results = [];
      if (type === "all") {
        // Pesquisa em paralelo nos tipos principais sem chave
        const [anime, manga, livros] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "livros", { tmdb: tmdbKey, workerUrl }),
        ]);
        // Adiciona filmes/séries se tiver TMDB, jogos Steam sempre
        const extras = await Promise.allSettled([
          tmdbKey ? smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }) : Promise.resolve([]),
          tmdbKey ? smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }) : Promise.resolve([]),
          smartSearch(q, "jogos", { tmdb: tmdbKey, workerUrl }),
        ]);
        const all = [
          ...(anime.status === "fulfilled" ? anime.value : []),
          ...(manga.status === "fulfilled" ? manga.value : []),
          ...(livros.status === "fulfilled" ? livros.value : []),
          ...(extras[0].status === "fulfilled" ? extras[0].value : []),
          ...(extras[1].status === "fulfilled" ? extras[1].value : []),
          ...(extras[2].status === "fulfilled" ? extras[2].value : []),
        ];
        // Deduplica por id
        const seen = new Set();
        results = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      } else {
        results = await smartSearch(q, type, { tmdb: tmdbKey, workerUrl });
      }
      setSearchResults(results);
      if (!results.length) setSearchError("Nenhum resultado encontrado. Tenta outro termo ou seleciona um tipo específico.");
      // Guardar no histórico
      if (q.trim()) {
        setSearchHistory(prev => {
          const next = [q.trim(), ...prev.filter(h => h.toLowerCase() !== q.trim().toLowerCase())].slice(0, 8);
          try { localStorage.setItem("trackall_search_history", JSON.stringify(next)); } catch {}
          return next;
        });
      }
    } catch (e) {
      setSearchError("Erro ao pesquisar. Verifica a tua ligação à internet.");
    } finally {
      setIsSearching(false);
    }
  }, [tmdbKey, workerUrl]);

  // Log quick-add search — respects quickSearchType filter
  const doLogSearch = useCallback(async (q) => {
    if (!q.trim()) { setLogResults([]); return; }
    setLogSearching(true);
    try {
      let results = [];
      if (quickSearchType) {
        results = await smartSearch(q, quickSearchType, { tmdb: tmdbKey, workerUrl });
      } else {
        const [anime, manga, filmes] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          tmdbKey ? smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }) : Promise.resolve([]),
        ]);
        const all = [...(anime.value||[]), ...(manga.value||[]), ...(filmes.value||[])];
        const seen = new Set();
        results = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      }
      setLogResults(results.slice(0, 8));
    } catch { setLogResults([]); }
    setLogSearching(false);
  }, [tmdbKey, workerUrl, quickSearchType]);

  useEffect(() => {
    if (logOpen) setTimeout(() => logInputRef.current?.focus(), 80);
    else { setLogQuery(""); setLogResults([]); }
  }, [logOpen]);

  useEffect(() => {
    const t = setTimeout(() => { if (logQuery) doLogSearch(logQuery); else setLogResults([]); }, 350);
    return () => clearTimeout(t);
  }, [logQuery, quickSearchType]);

  const items = useMemo(() => Object.values(library), [library]);

  const stats = useMemo(() => ({
    assistindo: items.filter((i) => i.userStatus === "assistindo").length,
    completo: items.filter((i) => i.userStatus === "completo").length,
    planejado: items.filter((i) => i.userStatus === "planejado").length,
  }), [items]);

  const filteredLib = useMemo(() => items.filter((i) => {
    if (filterStatus !== "all" && i.userStatus !== filterStatus) return false;
    if (activeTab !== "all" && i.type !== activeTab) return false;
    return true;
  }), [items, filterStatus, activeTab]);

  const sortedLib = useMemo(() => {
    const arr = [...filteredLib];
    if (libSort === "title") return arr.sort((a,b) => (a.title||"").localeCompare(b.title||""));
    if (libSort === "rating") return arr.sort((a,b) => (b.userRating||0) - (a.userRating||0));
    return arr.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
  }, [filteredLib, libSort]);

  const accentRgb = useMemo(() => `${parseInt(accent.slice(1, 3), 16)},${parseInt(accent.slice(3, 5), 16)},${parseInt(accent.slice(5, 7), 16)}`, [accent]);

  // Stat colors pré-calculados — evita accentShade() em cada render
  const homeStatColors = useMemo(() => ({
    assistindo: accentShade(accent, 0),
    completo:   accentShade(accent, 15),
    pausa:      accentShade(accent, 30),
    largado:    accentShade(accent, -20),
    planejado:  accentShade(accent, 45),
  }), [accent]);

  // Loading screen
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "white", fontWeight: 900, marginBottom: 16 }}>T</div>
          <div className="spin" style={{ fontSize: 28, color: accent, display: "block" }}>◌</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.7s linear infinite; display: inline-block; }`}</style>
        </div>
      </div>
    );
  }

  // Auth screen
  if (!user) return <AuthScreen onAuth={handleAuth} accent={accent} />;

  // Which bg image to show based on device + separate setting
  const activeBgImage = bgSeparateDevices
    ? (isMobileDevice ? bgImageMobile : bgImage)
    : bgImage;

  return (
    <ThemeContext.Provider value={{ accent, bg: bgColor }}>
      <div style={{
        minHeight: "100vh",
        background: bgColor,
        color: darkMode ? "#e6edf3" : "#0d1117",
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        paddingBottom: 80,
        position: "relative",
        overflowX: "hidden",
      }}>
        {/* Background image layer */}
        {activeBgImage && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 0,
            backgroundImage: `url(${activeBgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundAttachment: "scroll",
            backgroundRepeat: "no-repeat",
            filter: bgBlur > 0 ? `blur(${bgBlur}px)` : "none",
            transform: bgBlur > 0 ? "scale(1.05)" : "none",
          }} />
        )}
        {activeBgImage && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1,
            background: bgOverlay,
          }} />
        )}
        {/* ── Desktop Sidebar ── */}
        {!isMobileDevice && (() => {
          const libByType = Object.values(library);
          const navItems = [
            { id: "home", icon: "⌂", label: "Início" },
            { id: "library", icon: "▤", label: "Biblioteca" },
            { id: "profile", icon: "◉", label: "Perfil" },
          ];
          return (
            <aside className="desktop-sidebar">
              {/* Logo */}
              <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white", flexShrink: 0 }}>T</div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", letterSpacing: "-0.5px" }}>TrackAll</span>
                </div>
              </div>

              {/* Nav principal */}
              <div style={{ padding: "4px 0" }}>
                {navItems.map((n, nIdx) => {
                  const ic = accentVariant(accent, nIdx);
                  return (
                    <button key={n.id} className={`ds-nav-btn${view === n.id ? " active" : ""}`}
                      onClick={() => setView(n.id)}
                      style={view === n.id ? { background: `${ic}1a`, color: ic } : {}}>
                      <span className="ds-icon" style={view === n.id ? { color: ic } : {}}>{n.icon}</span>
                      {n.label}
                    </button>
                  );
                })}
                {/* Amigos — com SVG colorido */}
                {(() => {
                  const ic = accentVariant(accent, navItems.length);
                  return (
                    <button className={`ds-nav-btn${view === "friends" ? " active" : ""}`}
                      onClick={() => setView("friends")}
                      style={view === "friends" ? { background: `${ic}1a`, color: ic } : {}}>
                      <span className="ds-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? ic : (darkMode ? "#8b949e" : "#64748b")} />
                          <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? ic : (darkMode ? "#8b949e" : "#64748b")} opacity="0.7" />
                          <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? ic : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                          <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? ic : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
                        </svg>
                      </span>
                      Amigos
                    </button>
                  );
                })()}
              </div>

              {/* Botão + Log Rápido */}
              <div style={{ padding: "8px 8px 4px" }}>
                <button onClick={() => { setLogOpen(v => !v); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${accent}44`, background: `${accent}12`, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: accent, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accent}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${accent}12`; }}>
                  <span style={{ fontSize: 18 }}>+</span> Log Rápido
                </button>
              </div>

              {/* Biblioteca por tipo */}
              {libByType.length > 0 && (
                <>
                  <p className="ds-section" style={{ marginTop: 12 }}>Biblioteca</p>
                  {MEDIA_TYPES.slice(1).filter(t => libByType.some(i => i.type === t.id)).map((t, tIdx) => {
                    const cnt = libByType.filter(i => i.type === t.id).length;
                    const ic = accentVariant(accent, tIdx + 1);
                    const isActive = view === "library" && activeTab === t.id;
                    const typeIcons = {
                      anime: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 9.5c.5-1 1.5-1.5 2.5-1s1.5 1.5 1 2.5L9 14h5"/><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none"/></svg>,
                      manga: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="3" width="11" height="18" rx="2"/><path d="M15 3l4 2v16l-4-2"/></svg>,
                      series: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></svg>,
                      filmes: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M9 4v5M15 4v5M2 14h20M9 14v6M15 14v6"/></svg>,
                      jogos: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="12" rx="3"/><path d="M9 13h2m1 0h2M14 11v2M6 13h.01"/></svg>,
                      livros: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h7a2 2 0 012 2v13a1.5 1.5 0 00-1.5-1.5H4z"/><path d="M20 4h-7a2 2 0 00-2 2v13a1.5 1.5 0 011.5-1.5H20z"/></svg>,
                      manhwa: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h4M7 12h6M7 16h3M15 12l3-4v8"/></svg>,
                      lightnovels: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3l1.5 5h5l-4 3 1.5 5L12 13l-4 3 1.5-5-4-3h5z"/></svg>,
                      comics: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 4V5a1 1 0 011-1z"/></svg>,
                    };
                    return (
                      <div key={t.id} className="ds-type-item" onClick={() => { setView("library"); setActiveTab(t.id); }}
                        style={{ background: isActive ? `${ic}18` : undefined, borderRadius: 8, color: isActive ? ic : (darkMode ? "#8b949e" : "#64748b") }}>
                        <span style={{ display: "flex", alignItems: "center", width: 18, flexShrink: 0, color: isActive ? ic : (darkMode ? "#8b949e" : "#64748b") }}>{typeIcons[t.id] || t.icon}</span>
                        <span style={{ flex: 1, color: isActive ? ic : (darkMode ? "#c9d1d9" : "#374151"), fontWeight: isActive ? 700 : 500, fontSize: 13 }}>{t.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? ic : "#484f58" }}>{cnt}</span>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Avatar + nome em baixo */}
              <div style={{ marginTop: "auto", padding: "16px", borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("profile")}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}66)`, border: `2px solid ${view === "profile" ? accent : "transparent"}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {profile.avatar ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Utilizador"}</p>
                    <p style={{ fontSize: 11, color: "#8b949e" }}>{Object.keys(library).length} na biblioteca</p>
                  </div>
                </div>
              </div>
            </aside>
          );
        })()}

        <div className="desktop-main" style={{ position: "relative", zIndex: 2, minHeight: "100vh", background: activeBgImage ? "transparent" : bgColor }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { overscroll-behavior: none; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${darkMode ? "#30363d" : "#cbd5e1"}; border-radius: 3px; }
          .btn-accent { background: linear-gradient(135deg, ${accent}, ${accent}cc); color: white; border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 700; transition: all 0.2s; }
          .btn-accent:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(${accentRgb},0.4); }
          .card { background: ${darkMode ? "#161b22" : "rgba(255,252,247,0.92)"}; border: 1px solid ${darkMode ? "#21262d" : "#e8e0d5"}; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
          .card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); border-color: ${darkMode ? "#30363d" : "#cbd5e1"}; }
          .card:hover .card-overlay { opacity: 1 !important; }
          .media-thumb { position: relative; overflow: hidden; border-radius: 10px; }
          .media-thumb .rating-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.52); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(-4px); transition: opacity 0.18s ease, transform 0.18s ease; border-radius: 10px; }
          .media-thumb:hover .rating-hover { opacity: 1; transform: translateY(0); }
          .media-thumb:hover img { transform: scale(1.04); transition: transform 0.25s ease; }
          .media-thumb img { transition: transform 0.25s ease; width: 100%; height: 100%; object-fit: cover; display: block; }
          .tab-btn { background: transparent; border: none; color: ${darkMode ? "#8b949e" : "#64748b"}; cursor: pointer; padding: 7px 14px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s; }
          .tab-btn:hover { color: ${darkMode ? "#e6edf3" : "#0d1117"}; background: ${darkMode ? "#21262d" : "#e2e8f0"}; }
          .tab-btn.active { background: ${accent}; color: white; font-weight: 700; }
          input, select, textarea { background: ${darkMode ? "#0d1117" : "#ffffff"}; color: ${darkMode ? "#e6edf3" : "#0d1117"}; border: 1px solid ${darkMode ? "#30363d" : "#e2e8f0"}; border-radius: 10px; font-family: 'Outfit', sans-serif; transition: border-color 0.15s; }
          input::placeholder { color: ${darkMode ? "#484f58" : "#94a3b8"}; }
          input:focus, select:focus { outline: none; border-color: ${accent}; box-shadow: 0 0 0 3px rgba(${accentRgb},0.1); }
          .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
          .modal { background: ${darkMode ? "#161b22" : "#ffffff"}; border: 1px solid ${darkMode ? "#30363d" : "#e2e8f0"}; border-radius: 16px; width: 100%; overflow: hidden; }
          .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
          @media (max-width: 480px) { .media-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
          .recents-row { -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; }
          .recents-row > * { scroll-snap-align: start; }
          img { will-change: auto; }
          .card { contain: layout style; }
          @media (max-width: 768px) {
            .card { contain: layout; border: none; border-radius: 8px; transition: none !important; }
            .fade-in { animation: none !important; }
            .media-thumb:hover img { transform: none !important; }
            .media-thumb .rating-hover { display: none; }
            .recents-row { -webkit-overflow-scrolling: touch; }
            * { -webkit-tap-highlight-color: transparent; }
            .card-info { display: none; }
            .card-info-title { display: block; font-size: 10px; font-weight: 700; padding: 5px 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: ${darkMode ? "#e6edf3" : "#0d1117"}; }
            .card-info-meta { display: none; }
          }
          @media (max-width: 480px) {
            .modal-bg { backdrop-filter: none !important; background: rgba(0,0,0,0.88) !important; }
          }
          .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${darkMode ? "rgba(22,27,34,0.96)" : "rgba(255,255,255,0.96)"}; backdrop-filter: blur(12px); border-top: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"}; display: flex; height: 64px; z-index: 50; }
          .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; transition: color 0.15s; color: ${darkMode ? "#484f58" : "#94a3b8"}; }
          .nav-btn.active { color: ${accent}; }
          .nav-btn:hover { color: ${darkMode ? "#8b949e" : "#64748b"}; }
          .nav-center-btn { flex: 1; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; height: 100%; position: relative; -webkit-tap-highlight-color: transparent; }
          .tabs-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .tabs-scroll::-webkit-scrollbar { display: none; }
          .lib-layout { display: flex; gap: 20px; align-items: flex-start; }
          .lib-sidebar { display: none; }
          .lib-mobile-controls { display: block; }
          @media (min-width: 768px) {
            .lib-sidebar { display: block; width: 180px; flex-shrink: 0; background: ${darkMode ? "#161b22" : "rgba(255,255,255,0.7)"}; border: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"}; border-radius: 12px; padding: 14px 10px; position: sticky; top: 70px; }
            .lib-mobile-controls { display: none; }
          }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          .shimmer { background: linear-gradient(90deg, ${darkMode ? "#21262d" : "#e2e8f0"} 25%, ${darkMode ? "#30363d" : "#f1f5f9"} 50%, ${darkMode ? "#21262d" : "#e2e8f0"} 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          .fade-in { animation: fadeIn 0.2s ease; }
          .view-transition { animation: viewIn 0.18s ease both; }
          @keyframes viewIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .recent-card:hover > div { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.7) !important; }
          .recent-card:hover .recent-hover-overlay { opacity: 1 !important; }
          .fav-card-wrap:hover > div { transform: translateY(-3px) scale(1.03); box-shadow: 0 8px 28px rgba(0,0,0,0.65) !important; }
          .fav-card-wrap > div { transition: transform 0.18s, box-shadow 0.18s; }
          .fav-card-wrap:hover .fav-hover-overlay { opacity: 1 !important; }
          .media-grid .card { animation: cardIn 0.22s ease both; }
          .media-grid[data-key] .card { animation: cardIn 0.22s ease both; }
          .media-grid .card:nth-child(1)  { animation-delay: 0ms; }
          .media-grid .card:nth-child(2)  { animation-delay: 25ms; }
          .media-grid .card:nth-child(3)  { animation-delay: 50ms; }
          .media-grid .card:nth-child(4)  { animation-delay: 75ms; }
          .media-grid .card:nth-child(5)  { animation-delay: 100ms; }
          .media-grid .card:nth-child(6)  { animation-delay: 125ms; }
          .media-grid .card:nth-child(n+7) { animation-delay: 150ms; }
          @media (max-width: 768px) {
            .media-grid .card { animation: none !important; }
            .modal-bg { align-items: flex-end !important; padding: 0 !important; }
            .modal { border-radius: 24px 24px 0 0 !important; max-height: 92vh !important; width: 100% !important; max-width: 100% !important; }
            .modal::before { content: ""; display: block; width: 36px; height: 4px; background: #30363d; border-radius: 99px; margin: 12px auto 4px; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .spin { animation: spin 0.7s linear infinite; display: inline-block; }
          .hero-gradient { background: ${activeBgImage ? "transparent" : bgColor}; border-bottom: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"}; position: relative; }
          .hero-gradient::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 60% 80% at 50% 120%, ${accent}18 0%, transparent 70%); }

          /* ── Desktop layout ── */
          @media (min-width: 900px) {
            .bottom-nav { display: none !important; }
            .top-nav-bar { display: none !important; }
            .desktop-sidebar { display: flex !important; }
            .desktop-main { margin-left: 220px !important; padding-bottom: 24px !important; }
            .media-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)) !important; gap: 16px !important; }
            .lib-sidebar { display: block !important; }
            .profile-desktop { display: grid !important; grid-template-columns: 300px 1fr !important; gap: 24px !important; align-items: flex-start !important; }
            .profile-desktop-left { display: block !important; }
            .profile-desktop-right { display: block !important; }
            .card-title-text { display: none !important; }
            .card-info { padding: 5px 8px 7px !important; }
            .card-info-meta { font-size: 11px; color: #8b949e; }
          }

          /* ── Desktop sidebar ── */
          .desktop-sidebar {
            display: none;
            position: fixed; left: 0; top: 0; bottom: 0; width: 220px; z-index: 50;
            flex-direction: column;
            background: ${darkMode ? "rgba(13,17,23,0.97)" : "rgba(255,252,247,0.97)"};
            border-right: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"};
            backdrop-filter: blur(20px);
            padding: 0 0 16px 0;
            overflow-y: auto;
          }
          .ds-nav-btn {
            display: flex; align-items: center; gap: 12px;
            width: 100%; padding: 11px 16px; border: none; background: none;
            cursor: pointer; font-family: Outfit, sans-serif; font-size: 14px; font-weight: 600;
            color: ${darkMode ? "#8b949e" : "#64748b"}; border-radius: 10px; margin: 1px 8px; width: calc(100% - 16px);
            transition: all 0.15s; text-align: left;
          }
          .ds-nav-btn:hover { background: ${darkMode ? "#161b22" : "#f1f5f9"}; color: ${darkMode ? "#e6edf3" : "#0d1117"}; }
          .ds-nav-btn.active { background: ${accent}18; color: ${accent}; }
          .ds-nav-btn .ds-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
          .ds-section { font-size: 10px; font-weight: 800; color: #484f58; letter-spacing: 0.1em; text-transform: uppercase; padding: 16px 24px 6px; }
          .ds-type-item {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 16px; font-size: 13px; cursor: pointer;
            color: ${darkMode ? "#8b949e" : "#64748b"}; border-radius: 8px; margin: 0 8px;
            transition: all 0.12s;
          }
          .ds-type-item:hover { background: ${darkMode ? "#161b22" : "#f1f5f9"}; }
        `}</style>

        <Notification notif={notif} />




        {/* ── Rating prompt after quick-log ── */}
        {logPendingItem && (
          <RatingOverlay
            item={logPendingItem}
            accent={accent}
            library={library}
            onDone={(rating) => {
              if (rating > 0) {
                const base = library[logPendingItem.id] || logPendingItem;
                saveLibrary({ ...library, [logPendingItem.id]: { ...base, userStatus: "completo", userRating: rating } });
                showNotif(`"${logPendingItem.title.slice(0,24)}" ✓  ★ ${rating}`, accent);
              } else {
                showNotif(`"${logPendingItem.title.slice(0,30)}" ✓`, accent);
              }
              setLogPendingItem(null);
            }}
          />
        )}

        {/* Detail Modal */}
        {selectedItem && (
          <DetailModal
            item={selectedItem}
            library={library}
            onAdd={addToLibrary}
            onRemove={(id) => { removeFromLibrary(id); setSelectedItem(null); }}
            onUpdateStatus={updateStatus}
            onUpdateLastChapter={updateLastChapter}
            onUpdateRating={updateRating}
            onChangeCover={updateCover}
            onClose={() => setSelectedItem(null)}
            accent={accent}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            tmdbKey={tmdbKey}
          />
        )}

        {/* NAV TOP */}
        <nav className="top-nav-bar" style={{ background: `${bgColor}ee`, backdropFilter: "blur(14px)", borderBottom: "1px solid #21262d", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 56, position: "sticky", top: 0, zIndex: 40 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white" }}>T</div>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#e6edf3", letterSpacing: "-0.5px" }}>TrackAll</span>
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#484f58", fontSize: 14, display: "flex" }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(searchQuery, activeTab); } }}
                placeholder="Pesquisar..."
                style={{ width: "100%", padding: "9px 36px 9px 36px", fontSize: 13 }}
              />
              {searchQuery && (
                <span
                  onClick={() => doSearch(searchQuery, activeTab)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b949e", fontSize: 16, padding: "2px 6px", borderRadius: 6, background: "#21262d" }}
                >⏎</span>
              )}
            </div>
          </div>

          {/* Avatar */}
          <button onClick={() => setView("profile")} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}66)`, border: `2px solid ${view === "profile" ? accent : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 16 }}>👤</span>}
            </div>
          </button>
        </nav>

        {/* ── HOME ── */}
        {view === "home" && (
          <div className="fade-in view-transition" style={{ paddingLeft: 0, paddingRight: 0 }}>
            {/* Hero — Avatar + Stats side by side */}
            <div className="hero-gradient" style={{ padding: "16px 16px 14px" }}>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                {/* Avatar + Name + Stats */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  {/* Avatar compacto */}
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                    border: `2.5px solid ${accent}`,
                    boxShadow: `0 0 0 3px ${accent}33`,
                    background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                  }}>
                    {profile.avatar
                      ? <img src={profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : "👤"}
                  </div>
                  {/* Right: nome + stats numa linha */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1.1, marginBottom: 2, background: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      {profile.name || "Utilizador"}
                    </h2>
                    <p style={{ fontSize: 12, color: darkMode ? "#6b7280" : "#94a3b8", marginBottom: 8, fontWeight: 500 }}>
                      <span style={{ color: darkMode ? "#c9d1d9" : "#475569", fontWeight: 700 }}>{items.length}</span> na biblioteca
                    </p>
                    {/* Stats compactas numa linha */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { l: "Curso",    v: stats.assistindo, key: "assistindo" },
                        { l: "Completo", v: stats.completo,   key: "completo"   },
                        { l: "Pausa",    v: stats.pausa,      key: "pausa"      },
                        { l: "Largado",  v: stats.largado,    key: "largado"    },
                        { l: "Planej.",  v: stats.planejado,  key: "planejado"  },
                      ].filter(s => s.v > 0).map((s) => {
                        const col = homeStatColors[s.key];
                        return (
                          <div key={s.l} style={{
                            flex: "1 1 0", minWidth: 0,
                            background: `${col}14`,
                            borderLeft: `2px solid ${col}`,
                            borderRadius: "0 6px 6px 0",
                            padding: "4px 5px",
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: col, lineHeight: 1 }}>{s.v}</div>
                            <div style={{ color: "#8b949e", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 1 }}>{s.l}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Filter tags — scroll horizontal */}
                <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
                  {MEDIA_TYPES.slice(1).map((t) => {
                    const active = homeFilter.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => {
                        setHomeFilter(prev =>
                          prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                        );
                      }} style={{
                        flexShrink: 0,
                        background: active ? accent : (darkMode ? "#161b22" : "rgba(255,255,255,0.7)"),
                        border: `1px solid ${active ? accent : (darkMode ? "#21262d" : "#e2e8f0")}`,
                        color: active ? "white" : (darkMode ? "#e6edf3" : "#0d1117"),
                        padding: "7px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 5,
                        WebkitTapHighlightColor: "transparent",
                      }}>
                        {t.icon} {t.label}
                      </button>
                    );
                  })}
                  {homeFilter.length > 0 && (
                    <button onClick={() => setHomeFilter([])} style={{
                      flexShrink: 0,
                      background: "transparent", border: "1px solid #ef444444",
                      color: "#ef4444", padding: "7px 10px", borderRadius: 20,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      WebkitTapHighlightColor: "transparent",
                    }}>✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats strip rápido ── */}
            {items.length > 0 && (() => {
              const now = new Date();
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
              const thisMonth = items.filter(i => i.addedAt && i.userStatus === "completo" && i.addedAt >= startOfMonth).length;
              const rated = items.filter(i => i.userRating > 0);
              const avgRating = rated.length ? (rated.reduce((s,i) => s + i.userRating, 0) / rated.length).toFixed(1) : null;
              const stats = [
                { label: "completados este mês", value: thisMonth, show: thisMonth > 0, icon: "📅" },
                { label: "rating médio", value: avgRating, show: !!avgRating, icon: "★" },
              ].filter(s => s.show);
              if (!stats.length) return null;
              return (
                <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", overflowX: "auto", scrollbarWidth: "none" }}>
                  {stats.map((s, si) => {
                    const c = accentVariant(accent, si);
                    return (
                      <div key={s.label} style={{
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${c}18 0%, ${c}08 100%)`,
                        border: `1px solid ${c}33`,
                        borderRadius: 12, padding: "10px 16px",
                        display: "flex", flexDirection: "column", gap: 2,
                        minWidth: 110,
                      }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{s.icon === "★" ? <span style={{ fontSize: 14, marginRight: 2 }}>★</span> : null}{s.value}</span>
                        <span style={{ fontSize: 10, color: darkMode ? "#8b949e" : "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Recent — filtered by homeFilter */}
            {items.length === 0 && (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🎬</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: darkMode ? "#e6edf3" : "#0d1117" }}>A tua biblioteca está vazia</h3>
                <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 24, lineHeight: 1.5 }}>Começa a adicionar animes, filmes, jogos e muito mais</p>
                <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 14, borderRadius: 12 }} onClick={() => setView("search")}>
                  + Explorar títulos
                </button>
              </div>
            )}

            {items.length > 0 && (() => {
              const inCurso = items
                .filter(i => i.userStatus === "assistindo")
                .filter(i => homeFilter.length === 0 || homeFilter.includes(i.type))
                .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
                .slice(0, 20);

              const completados = items
                .filter(i => i.userStatus === "completo")
                .filter(i => homeFilter.length === 0 || homeFilter.includes(i.type))
                .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
                .slice(0, 20);

              if (inCurso.length === 0 && completados.length === 0 && homeFilter.length > 0) return (
                <div style={{ padding: "28px 16px", textAlign: "center", color: darkMode ? "#484f58" : "#94a3b8" }}>
                  <p style={{ fontSize: 14 }}>Nenhum item com esse filtro</p>
                </div>
              );

              const RowSection = ({ title, icon, items: rowItems, filterBtn, collapsed, onToggleCollapse }) => rowItems.length === 0 ? null : (
                <div style={{ padding: "16px 0 8px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 12, paddingRight: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {onToggleCollapse && (
                        <button onClick={onToggleCollapse} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-flex", alignItems: "center", WebkitTapHighlightColor: "transparent" }}>▾</button>
                      )}
                      <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: homeFilter.length === 1 ? (TYPE_COLORS[homeFilter[0]] || (darkMode ? "#8b949e" : "#64748b")) : (darkMode ? "#8b949e" : "#64748b"), textTransform: "uppercase" }}>{icon} {title}</h2>
                      {homeFilter.length > 0 && (
                        <span style={{ fontSize: 10, color: accent, background: `${accent}22`, padding: "2px 6px", borderRadius: 20, fontWeight: 700 }}>
                          {homeFilter.map(f => MEDIA_TYPES.find(t => t.id === f)?.icon).join(" ")}
                        </span>
                      )}
                    </div>
                    {filterBtn}
                  </div>
                  {!collapsed && <div className="recents-row" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                    {rowItems.map((item) => (
                      <div key={item.id} style={{ flexShrink: 0, width: "clamp(90px, 26vw, 130px)" }}>
                        <MediaCard item={item} library={library} onOpen={setSelectedItem} accent={accent} />
                      </div>
                    ))}
                  </div>}
                </div>
              );

              return (
                <>
                  <RowSection
                    title="Completados"
                    icon="✓"
                    items={completados}
                    filterBtn={
                      <button onClick={() => { setView("library"); setFilterStatus("completo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>Ver tudo →</button>
                    }
                  />

                  {inCurso.length > 0 && completados.length > 0 && (
                    <div style={{ borderTop: "1px solid #21262d", margin: "4px 16px" }} />
                  )}
                  <RowSection
                    title="Em Curso"
                    icon="▶"
                    items={inCurso}
                    collapsed={homeCollapsedCurso}
                    onToggleCollapse={() => setHomeCollapsedCurso(v => !v)}
                    filterBtn={<button onClick={() => { setView("library"); setFilterStatus("assistindo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>Ver tudo →</button>}
                  />
                </>
              );
            })()}


            {/* Divider */}
            <div style={{ borderTop: "1px solid #21262d", margin: "0 16px 28px" }} />

            {/* Recommendations */}
            <div style={{ paddingBottom: 8 }}>
              <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", background: `linear-gradient(90deg, ${accent}, ${accentShade(accent, 40)})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Em Destaque</h3>
                <button onClick={loadRecos} disabled={recoLoading} style={{
                  background: "none", border: "none", color: recoLoading ? "#484f58" : accent,
                  cursor: recoLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: 0,
                }}>
                  <span style={{ display: "inline-block", animation: recoLoading ? "spin 0.7s linear infinite" : "none", fontSize: 14 }}>↻</span>
                  {recoLoading ? "A carregar..." : "Atualizar"}
                </button>
              </div>
              <RecoCarousel title="Anime em Tendência" icon="⛩" items={recos.anime} library={library} onOpen={setSelectedItem} accent={accent} loading={recoLoading} />
              <RecoCarousel title="Manga em Tendência" icon="🗒" items={recos.manga} library={library} onOpen={setSelectedItem} accent={accent} loading={recoLoading} />
              <RecoCarousel title="Filmes desta Semana" icon="🎬" items={recos.filmes} library={library} onOpen={setSelectedItem} accent={accent} loading={recoLoading} />
              <RecoCarousel title="Séries desta Semana" icon="📺" items={recos.series} library={library} onOpen={setSelectedItem} accent={accent} loading={recoLoading} />
              <RecoCarousel title="Jogos Mais Bem Avaliados" icon="🎮" items={recos.jogos} library={library} onOpen={setSelectedItem} accent={accent} loading={recoLoading} />
            </div>
          </div>
        )}

        {view === "search" && (
          <div style={{ padding: "20px 16px" }} className="fade-in view-transition">
            <div className="tabs-scroll" style={{ marginBottom: 20 }}>
              {MEDIA_TYPES.map((t) => (
                <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => { setActiveTab(t.id); if (searchQuery) doSearch(searchQuery, t.id); }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {isSearching && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e" }}>
                <div className="spin" style={{ fontSize: 40, display: "block", marginBottom: 12 }}>◌</div>
                <p>A pesquisar{activeTab !== "all" ? ` em ${MEDIA_TYPES.find(t=>t.id===activeTab)?.label}` : " em todos os tipos"}...</p>
              </div>
            )}
            {searchError && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>😶</div>
                <p style={{ color: "#ef4444", marginBottom: 12 }}>{searchError}</p>
                <p style={{ color: "#484f58", fontSize: 12, lineHeight: 1.6 }}>
                  Se estás a testar no Claude.ai, as chamadas de rede externas são bloqueadas.<br />
                  A pesquisa funciona corretamente no browser normal ou no APK Android.
                </p>
              </div>
            )}
            {!isSearching && !searchError && searchResults.length === 0 && (
              <div style={{ color: "#484f58" }}>
                {searchHistory.length > 0 && !searchQuery && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b949e" }}>Pesquisas recentes</p>
                      <button onClick={() => { setSearchHistory([]); try { localStorage.removeItem("trackall_search_history"); } catch {} }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Limpar</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {searchHistory.map((h, i) => (
                        <button key={i} onClick={() => { setSearchQuery(h); doSearch(h, activeTab); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: darkMode ? "#161b22" : "#f8fafc", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 13, WebkitTapHighlightColor: "transparent" }}>
                          <span style={{ color: "#484f58", fontSize: 13 }}>↩</span> {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!searchQuery && (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                    <p style={{ marginBottom: 8 }}>Pesquisa algo acima!</p>
                    <p style={{ fontSize: 12, color: "#30363d" }}>Anime · Manga · Séries · Filmes · Jogos · Livros · e mais</p>
                  </div>
                )}
              </div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <>
                <p style={{ color: "#484f58", fontSize: 13, marginBottom: 16 }}>{searchResults.length} resultados para "<strong style={{ color: "#e6edf3" }}>{searchQuery}</strong>"</p>
                <div className="media-grid">
                  {searchResults.map((item) => <MediaCard key={item.id} item={item} library={library} onOpen={setSelectedItem} accent={accent} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LIBRARY ── */}
        {view === "library" && (
          <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 28px" }} className="fade-in view-transition">

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900 }}>Biblioteca</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
                  {MEDIA_TYPES.slice(1).filter(t => filteredLib.some(i => i.type === t.id)).map(t => (
                    <span key={t.id} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 13 }}>{t.icon}</span>
                      <span style={{ color: darkMode ? "#8b949e" : "#64748b", fontWeight: 700, fontSize: 11 }}>{filteredLib.filter(i => i.type === t.id).length}</span>
                    </span>
                  ))}
                  <span style={{ flexShrink: 0, color: darkMode ? "#484f58" : "#94a3b8", fontSize: 11, marginLeft: 2 }}>· {filteredLib.length}</span>
                </div>
                <div style={{ display: "flex", background: darkMode ? "#21262d" : "#e8e0d5", borderRadius: 8, padding: 2 }}>
                  {[{id:"grid",icon:"▦"},{id:"list",icon:"☰"}, ...(isMobileDevice ? [] : [{id:"compact",icon:"⊟"}])].map(m => (
                    <button key={m.id} onClick={() => setLibViewModePersist(m.id)} title={m.id === "compact" ? "Compacto" : undefined} style={{ width: 28, height: 26, borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, background: libViewMode === m.id ? (darkMode ? "#30363d" : "#fff") : "transparent", color: libViewMode === m.id ? accent : "#8b949e", transition: "all 0.15s" }}>{m.icon}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="tabs-scroll" style={{ marginBottom: 14 }}>
              {MEDIA_TYPES.map((t) => {
                const isActive = activeTab === t.id;
                const count = t.id === "all" ? items.length : items.filter((i) => i.type === t.id).length;
                return (
                  <button key={t.id} className={`tab-btn${isActive ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>
                    {t.icon} {t.label}
                    <span style={{ background: isActive ? "rgba(255,255,255,0.25)" : (darkMode ? "#30363d" : "#e2e8f0"), color: isActive ? "white" : "#8b949e", borderRadius: 999, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Layout: sidebar desktop / stack mobile */}
            <div className="lib-layout">

              {/* SIDEBAR — desktop only */}
              <aside className="lib-sidebar">
                <p style={{ fontSize: 11, fontWeight: 800, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Estado</p>
                {[{ id: "all", emoji: "▤", label: "Todos", color: accent }, ...STATUS_OPTIONS].map((s) => (
                  <button key={s.id} onClick={() => setFilterStatus(s.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8, border: "none", textAlign: "left",
                    background: filterStatus === s.id ? `${s.color}18` : "transparent",
                    color: filterStatus === s.id ? s.color : "#8b949e",
                    borderLeft: filterStatus === s.id ? `3px solid ${s.color}` : "3px solid transparent",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: filterStatus === s.id ? 700 : 500,
                    marginBottom: 2,
                  }}>
                    <span>{s.emoji}</span> {s.label}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: filterStatus === s.id ? s.color : "#484f58" }}>
                      {s.id === "all" ? filteredLib.length : items.filter(i => i.userStatus === s.id && (activeTab === "all" || i.type === activeTab)).length}
                    </span>
                  </button>
                ))}
                <div style={{ height: 1, background: "#21262d", margin: "12px 0" }} />
                <p style={{ fontSize: 11, fontWeight: 800, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Ordenar</p>
                {[{id:"date",label:"Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★ Rating"}].map(s => (
                  <button key={s.id} onClick={() => setLibSort(s.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8, border: "none", textAlign: "left",
                    background: libSort === s.id ? `${accent}18` : "transparent",
                    color: libSort === s.id ? accent : "#8b949e",
                    borderLeft: libSort === s.id ? `3px solid ${accent}` : "3px solid transparent",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: libSort === s.id ? 700 : 500,
                    marginBottom: 2,
                  }}>
                    {s.label}
                  </button>
                ))}
              </aside>

              {/* MAIN CONTENT */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Mobile-only: filtros + sort compactos */}
                <div className="lib-mobile-controls">
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                    <button onClick={() => setFilterStatus("all")} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === "all" ? accent : "#30363d"}`, background: filterStatus === "all" ? accent : "transparent", color: filterStatus === "all" ? "white" : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>Todos</button>
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s.id} onClick={() => setFilterStatus(s.id)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === s.id ? s.color : "#30363d"}`, background: filterStatus === s.id ? `${s.color}22` : "transparent", color: filterStatus === s.id ? s.color : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", justifyContent: "flex-end" }}>
                    {[{id:"date",label:"Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★"}].map(s => (
                      <button key={s.id} onClick={() => setLibSort(s.id)} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${libSort === s.id ? accent : "#30363d"}`, background: libSort === s.id ? `${accent}22` : "transparent", color: libSort === s.id ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, WebkitTapHighlightColor: "transparent" }}>{s.label}</button>
                    ))}
                  </div>
                </div>

                {sortedLib.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#8b949e" }}>Nada aqui ainda</p>
                    <p style={{ fontSize: 14, marginBottom: 20 }}>Usa a pesquisa para adicionar mídias!</p>
                    <button className="btn-accent" style={{ padding: "12px 24px" }} onClick={() => { setView("search"); }}>Pesquisar</button>
                  </div>
                ) : libViewMode === "list" ? (
                  <LibGroupedList
                    items={sortedLib}
                    library={library}
                    accent={accent}
                    darkMode={darkMode}
                    onOpen={setSelectedItem}
                  />
                ) : libViewMode === "compact" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6 }}>
                    {sortedLib.map(item => {
                      const libItem = library[item.id];
                      const coverSrc = libItem?.customCover || item.cover || item.thumbnailUrl;
                      const status = STATUS_OPTIONS.find(s => s.id === libItem?.userStatus);
                      return (
                        <div key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: "pointer", position: "relative" }}>
                          <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 6, overflow: "hidden", background: gradientFor(item.id) }}>
                            {coverSrc && <img src={coverSrc} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            {status && <span style={{ position: "absolute", top: 3, right: 3, fontSize: 9, background: `${status.color}cc`, color: "white", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>{status.emoji}</span>}
                            {libItem?.userRating > 0 && <span style={{ position: "absolute", bottom: 3, left: 3, fontSize: 9, background: "rgba(0,0,0,0.85)", color: "#f59e0b", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>★{libItem.userRating}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <VirtualGrid
                    key={`${filterStatus}-${activeTab}-${libSort}`}
                    items={sortedLib}
                    library={library}
                    onOpen={setSelectedItem}
                    accent={accent}
                    columns={typeof window !== 'undefined' && window.innerWidth < 480 ? 3 : 5}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {view === "friends" && (
          <FriendsView user={user} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} library={library} />
        )}
        {view === "profile" && (
          <div className="profile-desktop-wrap" style={{ padding: 0, background: activeBgImage ? "transparent" : bgColor, minHeight: "100vh" }}>
          <ProfileView
            profile={profile}
            library={library}
            accent={accent}
            bgColor={bgColor}
            bgImage={bgImage}
            bgOverlay={bgOverlay}
            bgBlur={bgBlur}
            bgParallax={bgParallax}
            darkMode={darkMode}
            onUpdateProfile={saveProfile}
            onAccentChange={saveAccent}
            onBgChange={saveBg}
            onBgImage={saveBgImage}
            bgImageMobile={bgImageMobile}
            bgSeparateDevices={bgSeparateDevices}
            onBgSeparateDevices={saveBgSeparateDevices}
            onBgImageMobile={saveMobileBgImage}
            isMobileDevice={isMobileDevice}
            onBgOverlay={saveBgOverlay}
            onBgBlur={saveBgBlur}
            onBgParallax={saveBgParallax}
            statsCardBg={statsCardBg}
            onStatsCardBg={saveStatsCardBg}
            onTmdbKey={saveTmdbKey}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onWorkerUrl={saveWorkerUrl}
            onSignOut={handleSignOut}
            userEmail={user?.email || ""}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onImportMihon={importMihon}
            onImportPaperback={importPaperback}
            onImportLetterboxd={importLetterboxd}
            driveClientId={driveClientId}
            onSaveDriveClientId={saveDriveClientId}
            lastDriveSync={lastDriveSync}
            onAutoSync={autoSyncDrive}
            driveAutoSyncing={driveAutoSyncing}
            onOpen={setSelectedItem}
            diaryPanel={!isMobileDevice ? (() => {
              const completados = items.filter(i => i.userStatus === "completo" && i.addedAt)
                .sort((a,b) => b.addedAt - a.addedAt);
              if (!completados.length) return null;
              const MONTH_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
              const groups = {};
              completados.forEach(item => {
                const d = new Date(item.addedAt);
                const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
                if (!groups[key]) groups[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
                groups[key].items.push({ ...item, _day: d.getDate() });
              });
              const sortedGroups = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
              return (
                <div style={{
                  width: 280, flexShrink: 0,
                  borderLeft: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
                  paddingLeft: 24, paddingRight: 16,
                  marginLeft: "auto",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>DIARY</h3>
                    <span style={{ fontSize: 11, color: "#484f58" }}>{completados.length} entradas</span>
                  </div>
                  {sortedGroups.map(group => (
                    <div key={group.key} style={{ display: "flex", marginBottom: 20 }}>
                      <div style={{ flexShrink: 0, width: 52, marginRight: 10 }}>
                        <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
                          <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#8b949e", letterSpacing: 1 }}>{MONTH_PT[group.month]}</div>
                          <div style={{ padding: "4px 0 5px", fontSize: 15, fontWeight: 900, color: "#e6edf3" }}>{group.year}</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
                          <div key={item.id} onClick={() => setSelectedItem(item)} style={{
                            display: "flex", alignItems: "center", gap: 7, padding: "5px 3px",
                            borderBottom: idx < arr.length-1 ? `1px solid ${darkMode ? "#21262d" : "#e8e0d5"}` : "none",
                            cursor: "pointer", borderRadius: 4,
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#ffffff08" : "#00000008"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#484f58", width: 14, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                            {(item.customCover || item.cover || item.thumbnailUrl)
                              ? <img src={item.customCover || item.cover || item.thumbnailUrl} alt="" style={{ width: 22, height: 32, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                              : <div style={{ width: 22, height: 32, borderRadius: 3, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                            }
                            <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                            {item.userRating > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, flexShrink: 0 }}>★{item.userRating}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })() : null}
          />
          </div>
        )}

        {/* PWA Install Banner */}
        {pwaPrompt && !pwaInstalled && (
          <div style={{ position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 60, background: '#161b22', border: `1px solid ${accent}44`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 28 }}>📲</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>Instalar TrackAll</p>
              <p style={{ fontSize: 11, color: '#8b949e' }}>Adicionar ao ecrã inicial para acesso rápido</p>
            </div>
            <button onClick={async () => { pwaPrompt.prompt(); const r = await pwaPrompt.userChoice; if (r.outcome === 'accepted') setPwaInstalled(true); setPwaPrompt(null); }} style={{ background: accent, border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Instalar</button>
            <button onClick={() => setPwaPrompt(null)} style={{ background: 'none', border: 'none', color: '#484f58', fontSize: 18, cursor: 'pointer', padding: '4px', flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* LOG BOTTOM SHEET */}
        {logOpen && (
          <>
            <div onClick={() => { setLogOpen(false); setLogQuery(""); setLogResults([]); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }} />
            <div style={{ position: "fixed", bottom: isMobileDevice ? 64 : "auto", top: isMobileDevice ? "auto" : "50%", left: isMobileDevice ? 0 : "50%", right: isMobileDevice ? 0 : "auto", transform: isMobileDevice ? "none" : "translate(-50%, -50%)", width: isMobileDevice ? "auto" : 480, zIndex: 100, background: darkMode ? "#161b22" : "#fff", borderRadius: isMobileDevice ? "20px 20px 0 0" : 16, borderTop: isMobileDevice ? `2px solid ${accent}55` : "none", border: isMobileDevice ? undefined : `1px solid ${accent}44`, padding: "16px 16px 8px", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)", maxHeight: "70vh", overflowY: "auto" }}>
              {/* Handle */}
              <div style={{ width: 36, height: 4, background: "#30363d", borderRadius: 99, margin: "0 auto 16px" }} />
              {/* Type filter pills */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none", marginBottom: 10 }}>
                {[{ id: null, icon: "🔍", label: "Todos" }, ...MEDIA_TYPES.filter(t => t.id !== "all")].map(t => (
                  <button key={t.id || "all"} onClick={() => setQuickSearchType(t.id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, background: quickSearchType === t.id ? accent : (darkMode ? "#21262d" : "#f1f5f9"), border: `1px solid ${quickSearchType === t.id ? accent : "transparent"}`, color: quickSearchType === t.id ? "white" : (darkMode ? "#8b949e" : "#64748b"), cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
              <input ref={logInputRef} type="text" value={logQuery} onChange={e => setLogQuery(e.target.value)}
                placeholder={quickSearchType ? `Pesquisar ${MEDIA_TYPES.find(t => t.id === quickSearchType)?.label || ""}...` : "Pesquisar qualquer título..."}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: darkMode ? "#0d1117" : "#f8fafc", border: `1.5px solid ${accent}44`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
              {logSearching && <p style={{ fontSize: 12, color: "#484f58", marginTop: 10 }}>A pesquisar...</p>}
              {!logQuery && !logSearching && (
                <p style={{ fontSize: 12, color: "#484f58", marginTop: 10, textAlign: "center" }}>Escreve para pesquisar · toca para marcar como completo</p>
              )}
              {logResults.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {logResults.map(item => (
                    <div key={item.id} onClick={() => {
                      if (library[item.id]) updateStatus(item.id, "completo");
                      else addToLibrary(item, "completo");
                      setLogOpen(false); setLogQuery(""); setLogResults([]); setLogPendingItem(item);
                    }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: darkMode ? "#21262d" : "#f1f5f9", cursor: "pointer" }}>
                      {(item.cover || item.thumbnailUrl)
                        ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 50, borderRadius: 6, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.label}{item.year ? ` · ${item.year}` : ""}</p>
                      </div>
                      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        </div>

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">
          {[
            { id: "home", icon: "⌂", label: "Início" },
            { id: "library", icon: "▤", label: "Biblioteca" },
          ].map((n) => (
            <button key={n.id} className={`nav-btn${view === n.id ? " active" : ""}`} onClick={() => setView(n.id)} style={{ color: view === n.id ? accent : undefined }}>
              <span style={{ fontSize: 22 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {/* Botão + central flutuante */}
          <button className="nav-center-btn" onClick={() => { setLogOpen(v => !v); setView("home"); }}>
            <div style={{
              width: 52, height: 52,
              borderRadius: "50%",
              background: logOpen ? `linear-gradient(135deg, ${accent}dd, ${accent})` : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 20px ${accent}66`,
              transform: logOpen ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 28, color: "white", lineHeight: 1, fontWeight: 300, marginTop: -2 }}>+</span>
            </div>
          </button>

          <button className={`nav-btn${view === "friends" ? " active" : ""}`} onClick={() => setView("friends")} style={{ color: view === "friends" ? accent : undefined }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
              <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? accent : "#8b949e"} />
              <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? accent : "#8b949e"} opacity="0.7" />
              <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? accent : "#8b949e"} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? accent : "#8b949e"} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
            </svg>
            Amigos
          </button>
          <button className={`nav-btn${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")} style={{ color: view === "profile" ? accent : undefined }}>
            <span style={{ fontSize: 22 }}>◉</span>
            Perfil
          </button>
        </nav>
      </div>
    </ThemeContext.Provider>
  );
}
