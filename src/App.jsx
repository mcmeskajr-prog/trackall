import { useState, useEffect, useCallback, useRef, useMemo, memo, createContext, useContext } from "react";
import { flushSync } from "react-dom";
import { createClient } from '@supabase/supabase-js';
import { t, detectLang, saveLang, STRINGS } from './translations';
// Safety fallback for lang
let _globalLang = (() => { try { return localStorage.getItem("trackall_lang") || (navigator.language?.startsWith("pt") ? "pt" : "en"); } catch { return "en"; } })();


// ─── Supabase (SDK oficial) ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://kgclapivcpjqxbtomaue.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YhoOLoNbQda5iWgCUjLPvQ_HoO4uZ4B';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Configurações padrão ────────────────────────────────────────────────────
const DEFAULT_TMDB_KEY = ""; // Chave movida para o Cloudflare Worker (variável TMDB_KEY)
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

  // ── Tier Lists ──
  async getPopularTierlists(limit = 10) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('tierlists')
      .select('*, profiles(name, username, avatar)')
      .gte('created_at', since)
      .order('likes_count', { ascending: false })
      .limit(limit);
    return data || [];
  },
  async getUserTierlists(userId) {
    const { data } = await supabase.from('tierlists')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  },
  async createTierlist(userId, title, tiers) {
    const { data, error } = await supabase.from('tierlists')
      .insert({ user_id: userId, title, tiers }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async updateTierlist(id, title, tiers) {
    const { error } = await supabase.from('tierlists').update({ title, tiers }).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async deleteTierlist(id) {
    await supabase.from('tierlists').delete().eq('id', id);
  },
  async toggleTierlistLike(userId, tierlistId) {
    const { data: existing } = await supabase.from('tierlist_likes')
      .select('id').eq('user_id', userId).eq('tierlist_id', tierlistId).single();
    if (existing) {
      await supabase.from('tierlist_likes').delete().eq('id', existing.id);
      const { data: tl } = await supabase.from('tierlists').select('likes_count').eq('id', tierlistId).single();
      await supabase.from('tierlists').update({ likes_count: Math.max(0, (tl?.likes_count || 1) - 1) }).eq('id', tierlistId);
      return false;
    } else {
      await supabase.from('tierlist_likes').insert({ user_id: userId, tierlist_id: tierlistId });
      const { data: tl } = await supabase.from('tierlists').select('likes_count').eq('id', tierlistId).single();
      await supabase.from('tierlists').update({ likes_count: (tl?.likes_count || 0) + 1 }).eq('id', tierlistId);
      return true;
    }
  },
  async getUserLikes(userId) {
    const { data } = await supabase.from('tierlist_likes').select('tierlist_id').eq('user_id', userId);
    return (data || []).map(r => r.tierlist_id);
  },

  // ── Collections ──
  async getUserCollections(userId) {
    const { data } = await supabase.from('collections')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  },
  async createCollection(userId, { title, description, visibility, show_numbers, items }) {
    const { data, error } = await supabase.from('collections')
      .insert({ user_id: userId, title, description, visibility, show_numbers, items }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async updateCollection(id, { title, description, visibility, show_numbers, items }) {
    const { error } = await supabase.from('collections')
      .update({ title, description, visibility, show_numbers, items }).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async deleteCollection(id) {
    await supabase.from('collections').delete().eq('id', id);
  },
  async toggleCollectionLike(userId, collectionId) {
    const { data: existing } = await supabase.from('collection_likes')
      .select('user_id').eq('user_id', userId).eq('collection_id', collectionId).single();
    if (existing) {
      await supabase.from('collection_likes').delete().eq('user_id', userId).eq('collection_id', collectionId);
      const { data: cl } = await supabase.from('collections').select('likes_count').eq('id', collectionId).single();
      await supabase.from('collections').update({ likes_count: Math.max(0, (cl?.likes_count || 1) - 1) }).eq('id', collectionId);
      return false;
    } else {
      await supabase.from('collection_likes').insert({ user_id: userId, collection_id: collectionId });
      const { data: cl } = await supabase.from('collections').select('likes_count').eq('id', collectionId).single();
      await supabase.from('collections').update({ likes_count: (cl?.likes_count || 0) + 1 }).eq('id', collectionId);
      return true;
    }
  },
  async getUserCollectionLikes(userId) {
    const { data } = await supabase.from('collection_likes').select('collection_id').eq('user_id', userId);
    return (data || []).map(r => r.collection_id);
  },
};

// ─── Theme Context ────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);
const useTheme = () => useContext(ThemeContext);
const useAccent = () => useContext(ThemeContext)?.accent ?? "#f97316";
const useDarkMode = () => useContext(ThemeContext)?.darkMode ?? true;
const useIsMobile = () => useContext(ThemeContext)?.isMobileDevice ?? false;
const _safeT = (k) => { try { const s = STRINGS?.[_globalLang]; return s?.[k] ?? STRINGS?.["en"]?.[k] ?? k; } catch { return k; } };
const LangContext = createContext({ lang: _globalLang, useT: _safeT });
const useLang = () => { const ctx = useContext(LangContext); return ctx ?? { lang: _globalLang, useT: _safeT }; };

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
  { id: "all",         label: "Todos",        labelEn: "All",          icon: "🎯" },
  { id: "anime",       label: "Anime",        labelEn: "Anime",        icon: "⛩️" },
  { id: "manga",       label: "Manga",        labelEn: "Manga",        icon: "📖" },
  { id: "series",      label: "Séries",       labelEn: "Series",       icon: "📺" },
  { id: "filmes",      label: "Filmes",       labelEn: "Movies",       icon: "🎬" },
  { id: "jogos",       label: "Jogos",        labelEn: "Games",        icon: "🎮" },
  { id: "livros",      label: "Livros",       labelEn: "Books",        icon: "📚" },
  { id: "manhwa",      label: "Manhwa",       labelEn: "Manhwa",       icon: "🇰🇷" },
  { id: "lightnovels", label: "Light Novels", labelEn: "Light Novels", icon: "✨" },
  { id: "comics",      label: "Comics",       labelEn: "Comics",       icon: "💬" },
];
const mediaLabel = (m, lang) => lang === "en" ? m.labelEn : m.label;
const MONTH_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const MONTH_EN = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

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
  { id: "assistindo", label: "Em Curso",  labelEn: "In Progress", color: "#f97316", emoji: "▶" },
  { id: "completo",   label: "Completo",  labelEn: "Completed",   color: "#10b981", emoji: "✓" },
  { id: "planejado",  label: "Planeado",  labelEn: "Planned",     color: "#06b6d4", emoji: "⏰" },
  { id: "dropado",    label: "Dropado",   labelEn: "Dropped",     color: "#ef4444", emoji: "✕" },
  { id: "pausado",    label: "Pausado",   labelEn: "Paused",      color: "#eab308", emoji: "⏸" },
];
const statusLabel = (s, lang) => lang === "en" ? s.labelEn : s.label;

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

function normalizeAniListType(type) {
  if (!type) return "";
  if (type === "ANIME" || type === "anime") return "anime";
  if (type === "MANGA" || type === "manga" || type === "manhwa" || type === "lightnovels") return "manga";
  return "";
}

function normalizeMediaId(id, type = "") {
  if (!id) return id;
  const num = id.match(/(\d+)$/)?.[1];
  const aniType = normalizeAniListType(type);

  if (id.startsWith("al-")) {
    if (/^al-\d+$/.test(id) && aniType && num) return `al-${aniType}-${num}`;
    if (/^al-(anime|manga)-\d+$/.test(id)) return id;
    if (/^al-[A-Za-z]+-\d+$/.test(id) && num) {
      const rawType = id.split("-")[1];
      const normalizedType = aniType || normalizeAniListType(rawType);
      if (normalizedType) return `al-${normalizedType}-${num}`;
    }
  }

  if (/^tmdb-\d+$/.test(id) && num) {
    if (type === "filmes") return `tmdb-filmes-${num}`;
    if (type === "series") return `tmdb-series-${num}`;
  }
  if (id.startsWith("tmdb-movie-") && num) return `tmdb-filmes-${num}`;
  if (id.startsWith("tmdb-tv-") && num) return `tmdb-series-${num}`;

  return id;
}

function mediaIdCandidates(id, type = "") {
  if (!id) return [];
  const num = id.match(/(\d+)$/)?.[1];
  const normalized = normalizeMediaId(id, type);
  const candidates = new Set([normalized, id].filter(Boolean));

  if (num) {
    if (id.startsWith("al-") || normalized?.startsWith("al-")) {
      candidates.add(`al-anime-${num}`);
      candidates.add(`al-manga-${num}`);
      candidates.add(`al-${num}`);
    }
    if (id.startsWith("tmdb-") || normalized?.startsWith("tmdb-")) {
      candidates.add(`tmdb-filmes-${num}`);
      candidates.add(`tmdb-series-${num}`);
      candidates.add(`tmdb-movie-${num}`);
      candidates.add(`tmdb-tv-${num}`);
      candidates.add(`tmdb-${num}`);
    }
  }

  return [...candidates];
}

function findLibraryEntry(library, id, type = "") {
  if (!library || !id) return null;
  for (const candidate of mediaIdCandidates(id, type)) {
    if (library[candidate]) return { key: candidate, item: library[candidate] };
  }
  return null;
}

function normalizeMediaItem(item) {
  if (!item?.id) return item;
  const normalizedId = normalizeMediaId(item.id, item.type);
  if (normalizedId === item.id) return item;
  return { ...item, id: normalizedId };
}

// ─── APIs ─────────────────────────────────────────────────────────────────────

// 1. AniList — Anime, Manga, Manhwa, Light Novels (sem chave, CORS aberto)
async function searchAniList(query, type, workerUrl, format = null, country = null) {
  const mediaType = type === "anime" ? "ANIME" : "MANGA";
  let extraFilters = "";
  if (format) extraFilters += `,format_in:[${format}]`;
  if (country) extraFilters += `,countryOfOrigin:"${country}"`;
  const body = JSON.stringify({
    query: `query($s:String,$t:MediaType){Page(perPage:15){media(search:$s,type:$t,sort:SEARCH_MATCH${extraFilters}){id title{romaji english native}coverImage{large medium}startDate{year}description(asHtml:false)averageScore genres studios(isMain:true){nodes{name}}staff(perPage:2,sort:RELEVANCE){nodes{name{full}}}}}}`,
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
  }));
}

// 2. TMDB via Worker (chave guardada no Cloudflare Worker)
async function searchTMDB(query, type, key, workerUrl) {
  const ep = type === "filmes" ? "movie" : "tv";
  try {
    if (workerUrl) {
      // Usar Worker — chave não exposta
      const url = `${workerUrl.replace(/\/$/, "")}/tmdb?endpoint=/search/${ep}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.results?.length) return null;
      return data.results.slice(0, 15).map((m) => ({
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
    return data.results.slice(0, 15).map((m) => ({
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

// Fetch extra details (seasons, runtime, episodes, etc.) for a specific item
async function fetchMediaDetails(item, tmdbKey, workerUrl) {
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
      const [detailRes, creditsRes] = await Promise.all([
        fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}&language=en-US`),
        fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/credits&language=en-US`),
      ]);
      const d = await detailRes.json();
      const c = creditsRes.ok ? await creditsRes.json() : null;
      const cast = (c?.cast || []).slice(0, 20).map(p => ({
        id: p.id, name: p.name, character: p.character,
        image: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
      }));
      const directorData = (c?.crew || []).find(p => p.job === "Director");
      const director = directorData ? { id: directorData.id, name: directorData.name, image: directorData.profile_path ? `https://image.tmdb.org/t/p/w185${directorData.profile_path}` : null } : null;
      return { runtime: d.runtime ? `${d.runtime} min` : null, genres: d.genres?.map(g => g.name) || item.genres || [], synopsis: d.overview || item.synopsis || null, score: d.vote_average ? +d.vote_average.toFixed(1) : item.score, year: d.release_date?.slice(0, 4) || item.year, cast, director };
    }

    // TMDB séries — vários formatos possíveis
    if (id.startsWith("tmdb-series-") || id.startsWith("tmdb-tv-")) {
      const tmdbId = id.replace("tmdb-series-", "").replace("tmdb-tv-", "");
      const [detailRes, creditsRes] = await Promise.all([
        fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}&language=en-US`),
        fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/credits&language=en-US`),
      ]);
      const d = await detailRes.json();
      const c = creditsRes.ok ? await creditsRes.json() : null;
      const cast = (c?.cast || []).slice(0, 20).map(p => ({
        id: p.id, name: p.name, character: p.character,
        image: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
      }));
      const creatorData = d.created_by?.[0];
      const director = creatorData ? { id: creatorData.id, name: creatorData.name, image: creatorData.profile_path ? `https://image.tmdb.org/t/p/w185${creatorData.profile_path}` : null } : null;
      return { seasons: d.number_of_seasons, episodes: d.number_of_episodes, runtime: d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : null, genres: d.genres?.map(g => g.name) || item.genres || [], synopsis: d.overview || item.synopsis || null, score: d.vote_average ? +d.vote_average.toFixed(1) : item.score, status: d.status, cast, director };
    }

    // AniList — formatos: al-anime-123, al-manga-123, al-123
    if (id.startsWith("al-")) {
      const alId = id.replace(/^al-[a-z]+-/, "").replace(/^al-/, "");
      if (!alId || isNaN(Number(alId))) return null;
      // Race: direto vs worker — usa o mais rápido
      const aniBody = JSON.stringify({ query: `{
          Media(id:${alId}) {
            episodes chapters volumes averageScore status duration format
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
      return { episodes: m.episodes, chapters: m.chapters, volumes: m.volumes, runtime: m.duration ? `${m.duration} min/ep` : null, score: m.averageScore, status: m.status, synopsis: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/\n+/g, " ").trim() : null, cast, relations };
    }
  } catch (err) {
    console.error('[fetchMediaDetails] Erro:', err);
  }
  return null;
}
async function searchGoogleBooks(query, workerUrl) {
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
  const res = await fetch(`${wUrl}/books?q=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;
  return data.items.map((b) => {
    const info = b.volumeInfo || {};
    const cover = info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || "";
    return {
      id: `gb-${b.id}`,
      title: info.title || "",
      cover: cover.replace("http://", "https://"),
      type: "livros",
      year: String((info.publishedDate || "").slice(0, 4)),
      score: info.averageRating ? +(info.averageRating * 2).toFixed(1) : null,
      synopsis: (info.description || "").replace(/<[^>]*>/g, "").trim(),
      genres: (info.categories || []).slice(0, 4),
      extra: (info.authors || []).join(", ").slice(0, 60),
      source: "Google Books",
    };
  });
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
        <span style={{ fontSize: size * 0.8, color: "#f59e0b", fontWeight: 700, marginLeft: 4, minWidth: "2.2ch", display: "inline-block" }}>{active}</span>
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

function MihonImportModal({ onClose, onImport }) {
  const { accent, darkMode } = useTheme();
  const { lang, useT } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});
  const [step, setStep] = useState('upload'); // upload | preview | done
  const fileRef = useRef();

  const processFile = async (file) => {
    setLoading(true); setError('');
    try {
      const parsed = await parseMihonBackup(file);
      if (!parsed.length) { setError(lang === "en" ? "No manga found. Make sure it\'s a valid .tachibk file." : "Nenhum manga encontrado. Certifica-te que é um ficheiro .tachibk válido."); setLoading(false); return; }
      const sel = {};
      parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError((lang === "en" ? "Error: " : "Erro: ") + err.message); }
    setLoading(false);
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };

  const statusLabelLocal = (id) => { const s = STATUS_OPTIONS.find(x=>x.id===id); return s ? `${s.emoji} ${statusLabel(s,lang)}` : id; };
  const statusColor = { assistindo: accent, completo: '#10b981', planejado: '#06b6d4' };
  const bg = darkMode ? '#161b22' : '#ffffff';
  const border = darkMode ? '#30363d' : '#e2e8f0';
  const subBg = darkMode ? '#0d1117' : '#f8fafc';

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📚</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{lang === "en" ? "Import from Mihon" : "Importar do Mihon"}</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>
                {step === 'upload' && (lang === "en" ? "Select backup file" : "Seleciona o ficheiro de backup")}
                {step === 'preview' && `${items.length} ${lang === "en" ? "manga found" : "mangas encontrados"}`}
                {step === 'done' && (lang === "en" ? "Import complete!" : "Importação concluída!")}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: subBg, border: `2px dashed ${accent}44`, borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{lang === "en" ? "Select .tachibk backup file" : "Seleciona o ficheiro .tachibk"}</p>
              <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 16 }}>Mihon → {lang === "en" ? "More" : "Mais"} → {lang === "en" ? "Backup & Restore" : "Backup e Restauro"} → {lang === "en" ? "Create backup" : "Criar backup"}</p>
              <input ref={fileRef} type="file" accept=".tachibk,.proto.gz,.gz" onChange={e => e.target.files[0] && processFile(e.target.files[0])} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} disabled={loading} style={{ padding: '10px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
                {loading ? <span className="spin">◌</span> : (lang === "en" ? "Choose file" : "Escolher ficheiro")}
              </button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)} style={{ fontSize: 11, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{useT("all")}</button>
                <button onClick={() => toggleAll(false)} style={{ fontSize: 11, color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{useT("overlayNone")}</button>
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
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[m.userStatus] }}>{statusLabelLocal(m.userStatus)}</span>
                      {m.lastChapter && <span style={{ fontSize: 10, color: '#8b949e' }}>· {m.lastChapter}</span>}
                      {m.totalChapters > 0 && <span style={{ fontSize: 10, color: '#484f58' }}>({m.chaptersRead}/{m.totalChapters})</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('choose')} style={{ flex: 1, padding: 12, background: darkMode ? '#21262d' : '#f1f5f9', border: 'none', borderRadius: 10, color: darkMode ? '#e6edf3' : '#0d1117', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{useT("back")}</button>
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
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{useT("importSuccess")}</h3>
            <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 20 }}>{lang === "en" ? "Your Mihon manga are now in your library." : "Os teus mangas do Mihon já estão na biblioteca."}</p>
            <button onClick={onClose} className="btn-accent" style={{ padding: '10px 28px', fontSize: 14 }}>{lang === "en" ? "Close" : "Fechar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}




function CropModal({imageSrc, aspectRatio = 1, onSave, onClose, title = "Recortar imagem" }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
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
        <p style={{ fontSize: 11, color: "#484f58", textAlign: "center", marginBottom: 12 }}>{lang === "en" ? "Drag to reposition" : "Arrasta para reposicionar"}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <button onClick={() => handleZoom(-0.1)} style={{ padding: "6px 16px", background: "#21262d", border: "none", borderRadius: 8, color: "#e6edf3", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>−</button>
          <span style={{ color: "#8b949e", fontSize: 12, alignSelf: "center" }}>Zoom</span>
          <button onClick={() => handleZoom(0.1)} style={{ padding: "6px 16px", background: "#21262d", border: "none", borderRadius: 8, color: "#e6edf3", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>+</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: 12, background: "#f97316", border: "none", borderRadius: 10, color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>✓ Guardar</button>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Cover Edit Modal ──────────────────────────────────────────────────────────
function CoverEditModal({item, onSave, onClose }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
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
    <div className="modal-bg" onClick={onClose} style={isMobileDevice ? { paddingBottom: 64 } : {}}>
      <div className="modal fade-in cover-modal" style={{ maxWidth: 440, padding: 0, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        {/* Conteúdo scrollável */}
        <div style={{ overflowY: "auto", padding: 24, paddingBottom: 8, flex: 1 }}>
          <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>🖼 {lang === "en" ? "Change Cover" : "Alterar Capa"}</h3>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            {/* Preview */}
            <div style={{
              width: 100, height: 144, borderRadius: 10, overflow: "hidden", flexShrink: 0,
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
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
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
              }}>📁 {lang === "en" ? "Choose file" : "Escolher ficheiro"}</button>
              {url && (
                <button onClick={() => { setUrl(""); setPreview(""); }} style={{
                  padding: "8px", borderRadius: 8, border: "1px solid #ef444444",
                  background: "transparent", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                }}>🗑 {lang === "en" ? "Remove cover" : "Remover capa"}</button>
              )}
              <p style={{ fontSize: 10, color: "#484f58" }}>{lang === "en" ? "Files are compressed automatically" : "Ficheiros são comprimidos automaticamente"}</p>
            </div>
          </div>
        </div>
        {/* Botões fixos no fundo */}
        <div style={{ padding: "12px 24px", paddingBottom: isMobileDevice ? 24 : 16, borderTop: "1px solid #21262d", display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn-accent" style={{ flex: 1, padding: "13px" }} onClick={() => onSave(url)} disabled={loading}>
            {loading ? useT("compressing") : useT("saveProfile")}
          </button>
          <button onClick={onClose} style={{
            flex: 1, padding: "13px", background: "#21262d", border: "none",
            borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14,
          }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ item, library, onAdd, onRemove, onUpdateStatus, onUpdateRating, onChangeCover, onUpdateLastChapter, onClose, favorites = [], onToggleFavorite, tmdbKey, workerUrl }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const modalScrollRef = useRef(null);
  const detailCacheRef = useRef({}); // cache: id -> {detailExtra, extraData}
  const [itemStack, setItemStack] = useState([item]);
  const currentItem = itemStack[itemStack.length - 1];
  const canGoBack = itemStack.length > 1;
  const pushItem = (newItem) => setItemStack(prev => [...prev, newItem]);
  const popItem = () => setItemStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  const [coverEdit, setCoverEdit] = useState(false);
  const [addRating, setAddRating] = useState(0);
  const [detailExtra, setDetailExtra] = useState(null);
  const [chapterInput, setChapterInput] = useState("");
  const [modalTab, setModalTab] = useState("info");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personData, setPersonData] = useState(null);
  const [personLoading, setPersonLoading] = useState(false);
  // Novos estados
  const [omdbData, setOmdbData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [collection, setCollection] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [dlcs, setDlcs] = useState([]);
  const [similarGames, setSimilarGames] = useState([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reset stack when parent changes selectedItem
  useEffect(() => { setItemStack([item]); }, [item?.id]);

  const CHAPTER_TYPES = ["manga", "manhwa", "lightnovels", "comics"];
  const isAniList = (currentItem.id || "").startsWith("al-");
  const isTMDB = (currentItem.id || "").startsWith("tmdb-");
  const isIGDB = (currentItem.id || "").startsWith("igdb-");
  const isFilme = currentItem.type === "filmes";
  const isSerie = currentItem.type === "series";
  const hasCast = isAniList || isTMDB;
  const hasRelations = isAniList;
  const hasMedia = isTMDB || isIGDB;

  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");

  useEffect(() => {
    setModalTab("info");
    setSelectedPerson(null);
    setPersonData(null);

    if (modalScrollRef.current) modalScrollRef.current.scrollTop = 0;

    const ci = currentItem;
    if (!ci?.id) return;

    // Usar cache se disponível E tiver dados reais (evita usar cache de erros anteriores)
    const cached = detailCacheRef.current[ci.id];
    if (cached && (cached.detailExtra?.synopsis || cached.detailExtra?.cast?.length || cached.detailExtra?.episodes || cached.detailExtra?.chapters)) {
      setDetailExtra(cached.detailExtra ?? {});
      setDetailLoading(false);
      setScreenshots(cached.screenshots || []);
      setCollection(cached.collection || null);
      setRecommendations(cached.recommendations || []);
      setDlcs(cached.dlcs || []);
      setSimilarGames(cached.similarGames || []);
      setOmdbData(cached.omdbData || null);
      setExtraLoading(false);
      const lb = findLibraryEntry(library, ci.id, ci.type)?.item;
      setChapterInput(lb?.lastChapter || "");
      return;
    }

    // Não há cache — limpar e fazer fetch
    setDetailExtra(null);
    setDetailLoading(true);
    setOmdbData(null);
    setScreenshots([]);
    setCollection(null);
    setRecommendations([]);
    setDlcs([]);
    setSimilarGames([]);
    setExtraLoading(false);

    fetchMediaDetails(ci, tmdbKey, workerUrl).then(d => {
      setDetailExtra(d || {});
      setDetailLoading(false);
      // Só guarda no cache se tiver dados reais
      if (d && (d.synopsis || d.cast?.length || d.episodes || d.chapters)) {
        detailCacheRef.current[ci.id] = { ...detailCacheRef.current[ci.id], detailExtra: d };
      }
    }).catch((err) => {
      console.error('[DetailModal] fetchMediaDetails falhou:', ci.id, err);
      setDetailExtra({});
      setDetailLoading(false);
      // Não guarda erro no cache para permitir retry
    });

    fetchExtraData(ci);
    const lb = findLibraryEntry(library, ci?.id, ci?.type)?.item;
    setChapterInput(lb?.lastChapter || "");
  }, [currentItem?.id]);

  const fetchExtraData = async (capturedItem) => {
    setExtraLoading(true);
    const cid = capturedItem.id || "";
    const cacheEntry = detailCacheRef.current[cid] || {};
    try {
      const id = capturedItem.id || "";

      // ── TMDB filmes ──
      if (id.startsWith("tmdb-filmes-") || id.startsWith("tmdb-movie-")) {
        const tmdbId = id.replace("tmdb-filmes-", "").replace("tmdb-movie-", "");
        const [imagesRes, recoRes, detailRes] = await Promise.allSettled([
          fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/images`).then(r => r.json()),
          fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/recommendations&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()),
          fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()),
        ]);
        // Screenshots
        if (imagesRes.status === "fulfilled") {
          const imgs = imagesRes.value?.backdrops?.slice(0, 12) || [];
          setScreenshots(imgs.map(i => `https://image.tmdb.org/t/p/w780${i.file_path}`));
        }
        // Recomendações
        if (recoRes.status === "fulfilled") {
          setRecommendations((recoRes.value?.results || []).slice(0, 12).map(m => ({
            id: `tmdb-filmes-${m.id}`, title: m.title || m.name || "",
            cover: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
            type: "filmes", year: (m.release_date || "").slice(0, 4),
          })));
        }
        // Coleção
        if (detailRes.status === "fulfilled" && detailRes.value?.belongs_to_collection) {
          const col = detailRes.value.belongs_to_collection;
          const colRes = await fetch(`${wUrl}/tmdb?endpoint=/collection/${col.id}&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()).catch(() => null);
          if (colRes?.parts) {
            setCollection({
              name: colRes.name,
              parts: colRes.parts.sort((a, b) => (a.release_date || "").localeCompare(b.release_date || "")).map(p => ({
                id: `tmdb-filmes-${p.id}`, title: p.title || "",
                cover: p.poster_path ? `https://image.tmdb.org/t/p/w185${p.poster_path}` : null,
                year: (p.release_date || "").slice(0, 4),
              }))
            });
          }
        }
        // OMDb
        const omdbTitle = capturedItem.title || "";
        const omdbYear = capturedItem.year || "";
        const omdbRes = await fetch(`${wUrl}/omdb?title=${encodeURIComponent(omdbTitle)}${omdbYear ? `&year=${omdbYear}` : ""}`).then(r => r.json()).catch(() => null);
        if (omdbRes?.Response === "True") setOmdbData(omdbRes);
      }

      // ── TMDB séries ──
      else if (id.startsWith("tmdb-series-") || id.startsWith("tmdb-tv-")) {
        const tmdbId = id.replace("tmdb-series-", "").replace("tmdb-tv-", "");
        const [imagesRes, recoRes] = await Promise.allSettled([
          fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/images`).then(r => r.json()),
          fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/recommendations&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()),
        ]);
        if (imagesRes.status === "fulfilled") {
          const imgs = imagesRes.value?.backdrops?.slice(0, 12) || [];
          setScreenshots(imgs.map(i => `https://image.tmdb.org/t/p/w780${i.file_path}`));
        }
        if (recoRes.status === "fulfilled") {
          setRecommendations((recoRes.value?.results || []).slice(0, 12).map(m => ({
            id: `tmdb-series-${m.id}`, title: m.title || m.name || "",
            cover: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
            type: "series", year: (m.first_air_date || "").slice(0, 4),
          })));
        }
        // OMDb
        const omdbRes = await fetch(`${wUrl}/omdb?title=${encodeURIComponent(capturedItem.title || "")}${capturedItem.year ? `&year=${capturedItem.year}` : ""}`).then(r => r.json()).catch(() => null);
        if (omdbRes?.Response === "True") setOmdbData(omdbRes);
      }

      // ── AniList ──
      else if (id.startsWith("al-")) {
        const alId = id.replace(/^al-[a-z]+-/, "").replace(/^al-/, "");
        if (alId && !isNaN(Number(alId))) {
          const recoBody = JSON.stringify({ query: `{ Media(id:${alId}) { recommendations(perPage:12, sort:RATING_DESC) { nodes { rating mediaRecommendation { id title { romaji } coverImage { medium } type format } } } } }` });
          const recoRes = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrl}/anilist`], recoBody).catch(() => null);
          if (recoRes?.data?.Media?.recommendations?.nodes) {
            setRecommendations(
              recoRes.data.Media.recommendations.nodes
                .filter(n => n.rating > 0 && n.mediaRecommendation)
                .map(n => {
                  const m = n.mediaRecommendation;
                  const mType = m.type === "ANIME" ? "anime" : "manga";
                  return { id: `al-${mType}-${m.id}`, title: m.title?.romaji || "", cover: m.coverImage?.medium || null, type: mType };
                })
            );
          }
        }
      }

      // ── IGDB jogos ──
      else if (id.startsWith("igdb-")) {
        const igdbId = id.replace("igdb-", "");
        const [ssRes, simRes, dlcRes] = await Promise.allSettled([
          fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "screenshots", body: `fields image_id; where game = ${igdbId}; limit 12;` }) }).then(r => r.json()),
          fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "games", body: `fields name,cover.image_id,similar_games.name,similar_games.cover.image_id,similar_games.id; where id = ${igdbId}; limit 1;` }) }).then(r => r.json()),
          fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "games", body: `fields name,cover.image_id,category; where parent_game = ${igdbId} & category = (1,2); limit 10;` }) }).then(r => r.json()),
        ]);
        // Screenshots
        if (ssRes.status === "fulfilled" && Array.isArray(ssRes.value)) {
          setScreenshots(ssRes.value.map(s => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`));
        }
        // Jogos similares
        if (simRes.status === "fulfilled" && simRes.value?.[0]?.similar_games) {
          setSimilarGames(simRes.value[0].similar_games.slice(0, 12).map(g => ({
            id: `igdb-${g.id}`, title: g.name || "",
            cover: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
            type: "jogos",
          })));
        }
        // DLCs e expansões
        if (dlcRes.status === "fulfilled" && Array.isArray(dlcRes.value)) {
          setDlcs(dlcRes.value.map(g => ({
            id: `igdb-${g.id}`, title: g.name || "",
            cover: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
            category: g.category === 1 ? "DLC" : "Expansão",
          })));
        }
      }
    } catch (err) {
      console.error("[ExtraData] Erro:", err);
    }
    // Guardar no cache usando setState callbacks para obter valores actuais
    setScreenshots(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), screenshots: prev }; return prev; });
    setRecommendations(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), recommendations: prev }; return prev; });
    setCollection(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), collection: prev }; return prev; });
    setSimilarGames(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), similarGames: prev }; return prev; });
    setDlcs(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), dlcs: prev }; return prev; });
    setOmdbData(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), omdbData: prev }; return prev; });
    setExtraLoading(false);
  };

  // Fetch perfil da pessoa quando selecionada
  useEffect(() => {
    if (!selectedPerson) return;
    setPersonData(null);
    setPersonLoading(true);
    const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
    Promise.all([
      fetch(`${wUrl}/tmdb?endpoint=/person/${selectedPerson.id}&language=en-US`).then(r => r.json()),
      fetch(`${wUrl}/tmdb?endpoint=/person/${selectedPerson.id}/combined_credits&language=en-US`).then(r => r.json()),
    ]).then(([person, credits]) => {
      const filmografia = (credits.cast || [])
        .filter(m => m.poster_path)
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 20)
        .map(m => ({
          id: m.id, title: m.title || m.name || "",
          cover: `https://image.tmdb.org/t/p/w185${m.poster_path}`,
          year: (m.release_date || m.first_air_date || "").slice(0, 4),
          character: m.character || "",
          mediaType: m.media_type,
        }));
      setPersonData({
        name: person.name || selectedPerson.name,
        image: person.profile_path ? `https://image.tmdb.org/t/p/w342${person.profile_path}` : selectedPerson.image,
        bio: person.biography || "",
        birthday: person.birthday || "",
        placeOfBirth: person.place_of_birth || "",
        filmografia,
      });
      setPersonLoading(false);
    }).catch(() => setPersonLoading(false));
  }, [selectedPerson?.id]);

  const matchedLib = findLibraryEntry(library, currentItem.id, currentItem.type);
  const inLib = !!matchedLib;
  const libItem = matchedLib?.item;
  const isChapterType = CHAPTER_TYPES.includes(currentItem.type);
  const coverSrc = libItem?.customCover || currentItem.customCover || currentItem.cover;
  const isFavorite = favorites.some(f => f.id === currentItem.id);
  const canAddFavorite = !isFavorite && favorites.length < 30;
  const RELATION_LABELS = lang === "en"
    ? { PREQUEL: "Prequel", SEQUEL: "Sequel", SOURCE: "Source", ALTERNATIVE: "Alternative", SIDE_STORY: "Side Story", PARENT: "Parent" }
    : { PREQUEL: "Prequel", SEQUEL: "Sequel", SOURCE: "Fonte", ALTERNATIVE: "Alternativo", SIDE_STORY: "História Paralela", PARENT: "Principal" };

  return (
    <>
    <div className="modal-bg" onClick={onClose}>
      <div ref={modalScrollRef} className="modal" style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto", padding: 0, animation: "modalSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }} onClick={(e) => e.stopPropagation()}>

        {/* ── Vista: Perfil da Pessoa (TMDB) ── */}
        {selectedPerson ? (
          <div>
            {/* Header pessoa */}
            <div style={{ position: "relative", height: 120, background: `linear-gradient(135deg, ${accent}33, #0d1117)`, borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
              {canGoBack && <button onClick={popItem} style={{ position: "absolute", top: 12, left: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>←</button>}
              <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div className="modal-bottom-pad" style={{ padding: "0 24px 24px" }}>
              <div style={{ display: "flex", gap: 16, marginTop: -50, position: "relative", zIndex: 2, marginBottom: 20 }}>
                <div style={{ width: 80, height: 110, borderRadius: 10, overflow: "hidden", border: "3px solid #161b22", background: "#21262d", flexShrink: 0, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  {(personData?.image || selectedPerson.image) && <img src={personData?.image || selectedPerson.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                </div>
                <div style={{ paddingTop: 56 }}>
                  <button onClick={() => { setSelectedPerson(null); setPersonData(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: accent, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 6 }}>← Voltar</button>
                  <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{personData?.name || selectedPerson.name}</h2>
                  {personData?.birthday && <p style={{ fontSize: 11, color: "#6e7681", marginTop: 3 }}>🎂 {personData.birthday}{personData.placeOfBirth ? ` · ${personData.placeOfBirth}` : ""}</p>}
                </div>
              </div>

              {personLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                  <div className="spin" style={{ fontSize: 24 }}>⟳</div>
                </div>
              ) : (
                <>
                  {personData?.bio && (
                    <p style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.7, marginBottom: 20 }}>
                      {personData.bio.length > 500 ? personData.bio.slice(0, 500) + "…" : personData.bio}
                    </p>
                  )}
                  {personData?.filmografia?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6e7681", marginBottom: 12, letterSpacing: "0.5px" }}>FILMOGRAFIA</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 10 }}>
                        {personData.filmografia.map(m => (
                          <div key={m.id} style={{ textAlign: "center" }}>
                            <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 6, overflow: "hidden", background: "#21262d", marginBottom: 4 }}>
                              <img src={m.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                            </div>
                            <p style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                            {m.year && <p style={{ fontSize: 9, color: "#6e7681" }}>{m.year}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          // ── Vista: Modal normal ──
          <div>
            {/* Hero backdrop */}
            <div style={{ height: 180, background: currentItem.backdrop ? `url(${currentItem.backdrop}) center/cover` : (coverSrc ? `url(${coverSrc}) center/cover` : gradientFor(currentItem.id)), position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(22,27,34,0.95) 100%)" }} />
              {canGoBack && <button onClick={popItem} style={{ position: "absolute", top: 12, left: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>←</button>}
              <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <div className="modal-bottom-pad" style={{ padding: "0 24px 24px" }}>
              {/* Header: cover + title */}
              <div style={{ display: "flex", gap: 16, marginTop: -60, position: "relative", zIndex: 2 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 110, height: 160, borderRadius: 10, overflow: "hidden", border: "3px solid #161b22", background: gradientFor(currentItem.id), boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                    {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { const fb = currentItem.coverFallback; if (fb && e.currentTarget.src !== fb) { e.currentTarget.src = fb; } else { e.currentTarget.style.display = "none"; } }} />}
                  </div>
                  {inLib && (
                    <button onClick={() => setCoverEdit(true)} style={{ position: "absolute", bottom: 4, right: 4, width: 26, height: 26, borderRadius: 999, background: `${accent}`, border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }} title={useT("customCover")}>🖊</button>
                  )}
                </div>
                <div style={{ flex: 1, paddingTop: 40 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    <span style={{ background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                      {MEDIA_TYPES.find((t) => t.id === currentItem.type)?.icon} {MEDIA_TYPES.find((t) => t.id === currentItem.type) ? mediaLabel(MEDIA_TYPES.find(t => t.id === currentItem.type), lang) : ""}
                    </span>
                    {currentItem.year && <span style={{ background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{currentItem.year}</span>}
                    {currentItem.score && <span style={{ background: "#1a2e1a", color: "#10b981", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>⭐ {currentItem.score}</span>}
                    {currentItem.source && <span style={{ background: "#1a1f2e", color: "#6e9cf7", padding: "2px 8px", borderRadius: 6, fontSize: 10 }}>{currentItem.source}</span>}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginBottom: 4 }}>{currentItem.title}</h2>
                  {currentItem.titleEn && currentItem.titleEn !== currentItem.title && <p style={{ color: "#8b949e", fontSize: 13 }}>{currentItem.titleEn}</p>}
                  {currentItem.extra && <p style={{ color: "#8b949e", fontSize: 13 }}>✍ {currentItem.extra}</p>}
                </div>
              </div>

              {/* Tabs */}
              {(hasCast || hasRelations || hasMedia) && (
                <div style={{ display: "flex", marginTop: 20, borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, overflowX: "auto", scrollbarWidth: "none" }}>
                  {["info", ...(hasCast ? ["cast"] : []), ...(hasRelations ? ["relacoes"] : []), ...(hasMedia ? ["media"] : [])].map(tab => (
                    <button key={tab} onClick={() => setModalTab(tab)} style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: `2px solid ${modalTab === tab ? accent : "transparent"}`, color: modalTab === tab ? accent : "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "color 0.15s", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {tab === "info" ? "Info" : tab === "cast" ? (isAniList ? (lang === "en" ? "Characters" : "Personagens") : "Cast") : tab === "relacoes" ? (lang === "en" ? "Relations" : "Relações") : "Media"}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab: Info */}
              {modalTab === "info" && (
                <div>
                  <div style={{ display: "flex", gap: 16, marginTop: 16, padding: "12px 0", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, flexWrap: "wrap" }}>
                    {(detailExtra?.episodes || currentItem.episodes) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.episodes || currentItem.episodes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("episodes")}</div></div>}
                    {detailExtra?.seasons && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra.seasons}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("seasons")}</div></div>}
                    {(detailExtra?.chapters || currentItem.chapters) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.chapters || currentItem.chapters}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("chapters")}</div></div>}
                    {(detailExtra?.volumes || currentItem.volumes) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.volumes || currentItem.volumes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("volumes")}</div></div>}
                    {detailExtra?.runtime && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra.runtime}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("runtime")}</div></div>}
                    {(detailExtra?.status || currentItem.status) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{detailExtra?.status || currentItem.status}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("status")}</div></div>}
                  </div>

                  {/* OMDb ratings */}
                  {omdbData?.Ratings?.length > 0 && (
                    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                      {omdbData.Ratings.map(r => {
                        const isRT = r.Source === "Rotten Tomatoes";
                        const isMeta = r.Source === "Metacritic";
                        const isIMDb = r.Source === "Internet Movie Database";
                        const color = isRT ? "#fa320a" : isMeta ? "#ffcc33" : "#f5c518";
                        const label = isRT ? "🍅 RT" : isMeta ? "Ⓜ Meta" : "⭐ IMDb";
                        return (
                          <div key={r.Source} style={{ background: darkMode ? "#161b22" : "#f1f5f9", border: `1px solid ${color}44`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color }}>{r.Value}</div>
                            <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600 }}>{label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentItem.genres?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                      {currentItem.genres.slice(0, 6).map((g) => (
                        <span key={g} style={{ background: "#1a1f2e", color: "#6e9cf7", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>{g}</span>
                      ))}
                    </div>
                  )}
                  {(detailExtra?.synopsis || currentItem.synopsis) && (
                    <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.7, marginTop: 16 }}>{detailExtra?.synopsis || currentItem.synopsis || ""}</p>
                  )}

                  {/* Coleção TMDB */}
                  {collection && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📦 {collection.name}</h4>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {collection.parts.map(p => (
                          <div key={p.id}
                            onClick={() => p.id !== currentItem.id && pushItem(p)}
                            style={{ flexShrink: 0, width: 70, cursor: p.id !== currentItem.id ? "pointer" : "default", opacity: p.id === currentItem.id ? 1 : 0.75, WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 70, height: 100, borderRadius: 8, overflow: "hidden", background: gradientFor(p.id), border: p.id === currentItem.id ? `2px solid ${accent}` : "2px solid transparent" }}>
                              {p.cover && <img src={p.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <p style={{ fontSize: 9, color: "#8b949e", marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                            {p.year && <p style={{ fontSize: 9, color: "#484f58" }}>{p.year}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DLCs e Expansões (jogos) */}
                  {dlcs.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🎮 DLCs & Expansões</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {dlcs.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: darkMode ? "#161b22" : "#f1f5f9" }}>
                            <div style={{ width: 36, height: 48, borderRadius: 6, overflow: "hidden", background: gradientFor(d.id), flexShrink: 0 }}>
                              {d.cover && <img src={d.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</p>
                              <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>{d.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recomendações */}
                  {recommendations.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>✨ {lang === "en" ? "Recommendations" : "Recomendações"}</h4>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {recommendations.map(r => (
                          <div key={r.id}
                            onClick={() => pushItem(r)}
                            style={{ flexShrink: 0, width: 70, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 70, height: 100, borderRadius: 8, overflow: "hidden", background: gradientFor(r.id) }}>
                              {r.cover && <img src={r.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <p style={{ fontSize: 9, color: "#8b949e", marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Jogos similares */}
                  {similarGames.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🎮 {lang === "en" ? "Similar Games" : "Jogos Similares"}</h4>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {similarGames.map(g => (
                          <div key={g.id}
                            onClick={() => pushItem(g)}
                            style={{ flexShrink: 0, width: 70, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 70, height: 100, borderRadius: 8, overflow: "hidden", background: gradientFor(g.id) }}>
                              {g.cover && <img src={g.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <p style={{ fontSize: 9, color: "#8b949e", marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Media (Screenshots) */}
              {modalTab === "media" && (
                <div style={{ marginTop: 16 }}>
                  {extraLoading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                      <div className="spin" style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                      <p style={{ fontSize: 13 }}>A carregar...</p>
                    </div>
                  ) : screenshots.length === 0 ? (
                    <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "32px 0" }}>Sem screenshots disponíveis.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {screenshots.map((src, i) => (
                        <div key={i} style={{ borderRadius: 10, overflow: "hidden", background: "#161b22" }}>
                          <img src={src} alt="" style={{ width: "100%", display: "block", borderRadius: 10 }} onError={e => e.currentTarget.parentElement.style.display="none"} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Cast / Personagens */}
              {modalTab === "cast" && (
                <div style={{ marginTop: 16 }}>
                  {detailLoading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                      <div className="spin" style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                      <p style={{ fontSize: 13 }}>{lang === "en" ? "Loading..." : "A carregar..."}</p>
                    </div>
                  ) : !detailExtra?.cast?.length && !detailExtra?.director ? (
                    <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "32px 0" }}>{lang === "en" ? "No cast information available." : "Sem informação de cast disponível."}</p>
                  ) : isAniList ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {detailExtra.cast.map((c) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1117", borderRadius: 10, padding: "8px 10px" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                            {c.image && <img src={c.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: c.role === "MAIN" ? accent : "#6e7681" }}>{c.role === "MAIN" ? "Main" : "Supporting"}</p>
                          </div>
                          {c.va && (
                            <>
                              <div style={{ width: 1, height: 36, background: "#21262d", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                                <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.va.name}</p>
                                <p style={{ fontSize: 10, color: "#6e7681" }}>JP</p>
                              </div>
                              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                                {c.va.image && <img src={c.va.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {/* Diretor no topo */}
                      {detailExtra.director && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6e7681", marginBottom: 8, letterSpacing: "0.5px" }}>{lang === "en" ? "DIRECTOR" : "REALIZADOR"}</p>
                          <div onClick={() => setSelectedPerson(detailExtra.director)} style={{ display: "flex", alignItems: "center", gap: 12, background: `${accent}11`, border: `1px solid ${accent}33`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                            <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                              {detailExtra.director.image ? <img src={detailExtra.director.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎬</div>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 800 }}>{detailExtra.director.name}</p>
                              <p style={{ fontSize: 11, color: accent }}>{lang === "en" ? "Director →" : "Realizador →"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Cast grid — clicável */}
                      {detailExtra.cast?.length > 0 && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6e7681", marginBottom: 8, letterSpacing: "0.5px" }}>{lang === "en" ? "CAST" : "ELENCO"}</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 12 }}>
                            {detailExtra.cast.map((c) => (
                              <div key={c.id} onClick={() => setSelectedPerson(c)} style={{ textAlign: "center", cursor: "pointer" }}>
                                <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: "#21262d", marginBottom: 6 }}>
                                  {c.image ? <img src={c.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>}
                                </div>
                                <p style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{c.name}</p>
                                <p style={{ fontSize: 10, color: "#6e7681", lineHeight: 1.3 }}>{c.character}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Relações */}
              {modalTab === "relacoes" && (
                <div style={{ marginTop: 16 }}>
                  {detailLoading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                      <div className="spin" style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                      <p style={{ fontSize: 13 }}>{lang === "en" ? "Loading..." : "A carregar..."}</p>
                    </div>
                  ) : !detailExtra?.relations?.length ? (
                    <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "32px 0" }}>{lang === "en" ? "No relations available." : "Sem relações disponíveis."}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {detailExtra.relations.map((r, i) => (
                        <div key={r.id + i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0d1117", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ width: 42, height: 60, borderRadius: 6, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                            {r.cover && <img src={r.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 11, color: accent, fontWeight: 700, marginBottom: 3 }}>{RELATION_LABELS[r.type] || r.type}</p>
                            <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                            <p style={{ fontSize: 11, color: "#6e7681", marginTop: 2 }}>{[r.format, r.status].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Library section */}
              <div style={{ marginTop: 20, padding: 16, background: "#0d1117", borderRadius: 12, border: "1px solid #21262d" }}>
                {inLib ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#8b949e" }}>{useT("inLibrary").toUpperCase()}</span>
                        {libItem.userStatus === "assistindo" && libItem.addedAt && (() => {
                          const days = Math.floor((Date.now() - libItem.addedAt) / (1000 * 60 * 60 * 24));
                          return <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>⏱ há {days === 0 ? "menos de 1 dia" : days === 1 ? "1 dia" : `${days} dias`}</span>;
                        })()}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {inLib && onToggleFavorite && (
                          <button onClick={() => onToggleFavorite(currentItem)} style={{ background: isFavorite ? "#f59e0b22" : "none", border: `1px solid ${isFavorite ? "#f59e0b" : "#30363d"}`, color: isFavorite ? "#f59e0b" : "#8b949e", cursor: canAddFavorite || isFavorite ? "pointer" : "not-allowed", fontSize: 11, padding: "4px 8px", borderRadius: 6, fontFamily: "inherit", fontWeight: 600, opacity: !canAddFavorite && !isFavorite ? 0.4 : 1 }} title={isFavorite ? "Remover dos favoritos" : canAddFavorite ? "Adicionar aos favoritos" : useT("favoritesFull")}>
                            {isFavorite ? "★ Favorito" : "☆ Favorito"}
                          </button>
                        )}
                        <button onClick={() => onRemove(currentItem.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: "4px 8px" }}>🗑 Remover</button>
                      </div>
                    </div>
                    <StarRating value={libItem.userRating || 0} onChange={(v) => onUpdateRating(currentItem.id, v)} size={22} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s.id} onClick={() => onUpdateStatus(currentItem.id, s.id)} style={{ padding: "7px 12px", borderRadius: 8, fontFamily: "inherit", fontWeight: 600, fontSize: 12, cursor: "pointer", border: `1.5px solid ${libItem.userStatus === s.id ? s.color : s.color + "44"}`, background: libItem.userStatus === s.id ? `${s.color}25` : "transparent", color: libItem.userStatus === s.id ? s.color : "#8b949e" }}>
                          {s.emoji} {statusLabel(s, lang)}
                        </button>
                      ))}
                    </div>
                    {isChapterType && libItem.userStatus === "assistindo" && (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" }}>📖 Capítulo:</span>
                        <input type="text" value={chapterInput} onChange={e => setChapterInput(e.target.value)} placeholder="ex: Cap. 42" onKeyDown={e => e.key === "Enter" && onUpdateLastChapter && onUpdateLastChapter(currentItem.id, chapterInput.trim())} style={{ flex: 1, background: "#21262d", border: `1px solid ${accent}44`, borderRadius: 8, padding: "6px 10px", color: "#e6edf3", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                        <button onClick={() => onUpdateLastChapter && onUpdateLastChapter(currentItem.id, chapterInput.trim())} style={{ background: accent, border: "none", borderRadius: 8, padding: "6px 14px", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>✓</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 12, fontWeight: 600 }}>{useT("addToLibrary").toUpperCase()}</p>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>{`${useT("rating")} (${lang === "en" ? "optional" : "opcional"})`}</div>
                      <StarRating value={addRating} onChange={setAddRating} size={24} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s.id} onClick={() => { onAdd(currentItem, s.id, addRating); onClose(); }} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${s.color}55`, background: `${s.color}15`, color: s.color, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 }}>
                          {s.emoji} {statusLabel(s, lang)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {coverEdit && inLib && (
      <CoverEditModal
        item={{ ...currentItem, customCover: libItem?.customCover }}
        onSave={(url) => { onChangeCover(currentItem.id, url); setCoverEdit(false); }}
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
  const { lang, useT } = useLang();
  const libItem = findLibraryEntry(library, item.id, item.type)?.item;
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
        <div className="rating-hover no-tc">
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
                {status.emoji} {statusLabel(status, lang)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="card-info" style={{ padding: "6px 8px 8px" }}>
        <p className="card-info-title card-title-text" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
        <p className="card-info-meta" style={{ fontSize: 11, color: "#484f58" }}>
          {MEDIA_TYPES.find((t) => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}{item.year ? ` · ${item.year}` : ""}
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
function DiaryPanel({ completados, onOpen }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [showAll, setShowAll] = useState(false);
  if (!completados || !completados.length) return null;
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
        <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("diary").toUpperCase()}</h3>
        <span style={{ fontSize: 11, color: "#484f58" }}>{completados.length} entradas</span>
      </div>
      {visible.map(group => (
        <div key={group.key} style={{ display: "flex", marginBottom: 20 }}>
          <div style={{ flexShrink: 0, width: 56, marginRight: 12 }}>
            <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
              <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#e6edf3", letterSpacing: 1 }}>
                {group.key === "0000-00" ? "—" : group.year}
              </div>
              <div style={{ padding: "5px 0 6px", fontSize: group.key === "0000-00" ? 11 : 17, fontWeight: 900, color: "#e6edf3" }}>
                {group.key === "0000-00" ? "Sem data" : (lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}
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

function RecentSection({ items, onOpen, showDiary = true }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [showAllCurso, setShowAllCurso] = useState(false);
  const [showAllCompleto, setShowAllCompleto] = useState(false);
  const [showDiaryAll, setShowDiaryAll] = useState(false);

  const inCurso = useMemo(() => [...items].filter(i => i.userStatus === "assistindo").sort((a, b) => b.addedAt - a.addedAt), [items]);
  const completados = useMemo(() => [...items].filter(i => i.userStatus === "completo" && i.addedAt).sort((a, b) => b.addedAt - a.addedAt), [items]);

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: darkMode ? "#8b949e" : "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>{`✓ ${useT("completedLabel").toUpperCase()}`}</h3>
            {completados.length > 10 && (
              <button onClick={() => setShowAllCompleto(v => !v)} style={{ background: "none", border: `1px solid ${accent}44`, color: accent, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                {showAllCompleto ? "↑ Menos" : `Ver todos (${completados.length})`}
              </button>
            )}
          </div>
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
                    <div className="recent-hover-overlay no-tc" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)", opacity: 0, transition: "opacity 0.2s", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "40px 10px 10px" }}>
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
                  <div style={{ background: "#30363d", padding: "3px 0", fontSize: 10, fontWeight: 800, color: "#e6edf3", letterSpacing: 1 }}>
                    {group.key === "0000-00" ? "—" : group.year}
                </div>
                <div style={{ padding: "6px 0 8px", fontSize: group.key === "0000-00" ? 13 : 22, fontWeight: 900, color: "#e6edf3" }}>
                    {group.key === "0000-00" ? "Sem data" : (lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}
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
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("diary").toUpperCase()}</h3>
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
            <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("inProgressLabel").toUpperCase()}</h3>
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

// ─── Tier List Components ─────────────────────────────────────────────────────
const TIER_LEVELS = [
  { id: "S", color: "#ef4444" },
  { id: "A", color: "#f97316" },
  { id: "B", color: "#eab308" },
  { id: "C", color: "#22c55e" },
  { id: "D", color: "#3b82f6" },
];

// ─── Collection Components ────────────────────────────────────────────────────

function CollectionCard({ col, onOpen, onLike, liked, currentUserId, onDelete }) {
  const { accent, darkMode } = useTheme();
  const items = col.items || [];
  const covers = items.slice(0, 8).map(i => i.cover).filter(Boolean);

  const STRIP_H = 160;
  // Cada capa tem proporção portrait 2:3
  const COVER_W = Math.round(STRIP_H * (2 / 3)); // ~107px

  return (
    <div onClick={() => onOpen(col)} style={{
      background: darkMode ? "#161b22" : "#f8fafc",
      border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
      borderRadius: 14, overflow: "hidden", cursor: "pointer",
      transition: "transform 0.15s, box-shadow 0.15s",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${accent}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Cover strip — estilo Letterboxd: capas portrait, sem espaço vazio */}
      <div style={{
        display: "flex",
        gap: 3,
        padding: 3,
        height: STRIP_H,
        boxSizing: "border-box",
        flexShrink: 0,
        // O container encolhe até ao tamanho das capas — sem fundo cinzento vazio
        width: covers.length === 0 ? "100%" : "fit-content",
        minWidth: "100%",
        background: "transparent",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}>
        {covers.length === 0 ? (
          <div style={{
            flex: 1, background: `${accent}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, fontSize: 32, border: `1px dashed ${accent}33`,
          }}>📋</div>
        ) : (
          covers.map((src, i) => (
            <div key={i} style={{
              width: COVER_W,
              minWidth: COVER_W,
              height: "100%",
              borderRadius: 6,
              overflow: "hidden",
              background: darkMode ? "#21262d" : "#c8cfd8",
              flexShrink: 0,
            }}>
              <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
                onError={e => { e.target.parentElement.style.display = "none"; }}
              />
            </div>
          ))
        )}
      </div>

      {/* Info + Actions */}
      <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: darkMode ? "#e6edf3" : "#0d1117", marginBottom: 2, lineHeight: 1.2 }}>{col.title}</div>
          <div style={{ fontSize: 11, color: "#8b949e", marginBottom: col.description ? 4 : 0 }}>
            {items.length} {items.length === 1 ? "item" : "itens"} · {col.visibility === "private" ? "🔒 Privada" : col.visibility === "friends" ? "👥 Amigos" : "🌐 Pública"}
          </div>
          {col.description ? (
            <div style={{ fontSize: 11, color: darkMode ? "#8b949e" : "#64748b", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {col.description}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onLike(col.id)} style={{
            background: liked ? `${accent}22` : "transparent",
            border: `1px solid ${liked ? accent : "#30363d"}`,
            color: liked ? accent : "#8b949e",
            borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
          }}>♥ {col.likes_count || 0}</button>
          {currentUserId === col.user_id && (
            <button onClick={() => onDelete(col.id)} style={{
              background: "transparent", border: "1px solid #ef444433",
              color: "#ef4444", borderRadius: 8, padding: "4px 10px",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionModal({ initialData, library, onSave, onClose, workerUrl }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [visibility, setVisibility] = useState(initialData?.visibility || "public");
  const [showNumbers, setShowNumbers] = useState(initialData?.show_numbers || false);
  const [colItems, setColItems] = useState(initialData?.items || []);
  const [saving, setSaving] = useState(false);

  // Search
  const [searchQ, setSearchQ] = useState("");
  const [searchType, setSearchType] = useState("library"); // library | character | person | comicchar
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchTimer = useRef(null);

  const searchTypeOpts = [
    { id: "library", label: "📚 Biblioteca" },
    { id: "character", label: "⛩️ Personagem" },
    { id: "person", label: "🎬 Ator/Realizador" },
    { id: "comicchar", label: "💬 Comic Char" },
  ];

  useEffect(() => {
    if (!searchQ.trim() || searchQ.trim().length < 2) { setSearchResults([]); setSearchError(false); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(searchQ.trim()), 600);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ, searchType]);

  const doSearch = async (q) => {
    setSearchLoading(true);
    setSearchError(false);
    try {
      if (searchType === "library") {
        const lower = q.toLowerCase();
        const res = (library || []).filter(i => (i.title || "").toLowerCase().includes(lower)).slice(0, 20);
        setSearchResults(res.map(i => ({ id: i.id, title: i.title, cover: i.cover, type: i.type, itemType: "media" })));
      } else if (searchType === "character") {
        const aniHeaders = { "Content-Type": "application/json", "Accept": "application/json" };
        const charQuery = `query($q:String){Page(perPage:15){characters(search:$q){id name{full}image{large}media{nodes{id title{romaji}type}}}}}`;
        const charBody = JSON.stringify({ query: charQuery, variables: { q } });
        const tryFetchChar = async (url) => {
          try {
            const r = await fetch(url, { method: "POST", headers: aniHeaders, body: charBody });
            if (!r.ok) return null;
            const d = await r.json();
            if (d.errors || !d?.data?.Page?.characters?.length) return null;
            return d;
          } catch { return null; }
        };
        const charResults = await Promise.allSettled([
          tryFetchChar(wUrl + "/anilist"),
          tryFetchChar("https://graphql.anilist.co"),
        ]);
        const data = charResults.find(r => r.status === "fulfilled" && r.value)?.value;
        if (!data) throw new Error("Não foi possível ligar ao AniList. Tenta novamente.");
        const chars = (data?.data?.Page?.characters || []).map(c => {
          const firstMedia = c.media?.nodes?.[0];
          return {
            id: `alchar-${c.id}`,
            title: c.name?.full,
            cover: c.image?.large,
            subtitle: firstMedia?.title?.romaji || "",
            mediaId: firstMedia ? `al-${firstMedia.type === "MANGA" ? "manga" : "anime"}-${firstMedia.id}` : null,
            mediaType: firstMedia?.type === "MANGA" ? "manga" : "anime",
            itemType: "character",
          };
        });
        setSearchResults(chars);
      } else if (searchType === "person") {
        const resp = await fetch(`${wUrl}/tmdb?endpoint=/search/person&query=${encodeURIComponent(q)}&language=pt-PT`);
        const data = await resp.json();
        const people = data?.results || [];
        setSearchResults(people.slice(0, 12).map(p => ({
          id: `tmdbperson-${p.id}`, title: p.name,
          cover: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
          subtitle: p.known_for_department === "Acting" ? "Ator/Atriz" : p.known_for_department || "",
          itemType: "person",
        })));
      } else if (searchType === "comicchar") {
        const resp = await fetch(`${wUrl}/comicvine-char?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        const chars = data?.results || [];
        setSearchResults(chars.slice(0, 12).map(c => ({
          id: `cvchar-${c.id}`, title: c.name,
          cover: c.image?.medium_url || null,
          subtitle: c.publisher?.name || "",
          itemType: "comicchar",
        })));
      }
    } catch (e) { console.error("[CollectionSearch]", e); setSearchResults([]); setSearchError(true); }
    setSearchLoading(false);
  };

  const addItem = (item) => {
    if (colItems.find(i => i.id === item.id)) return;
    setColItems(prev => [...prev, { ...item, note: "", order: prev.length }]);
    setSearchQ("");
    setSearchResults([]);
  };

  const removeItem = (id) => setColItems(prev => prev.filter(i => i.id !== id));

  const moveItem = (idx, dir) => {
    setColItems(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const updateNote = (id, note) => setColItems(prev => prev.map(i => i.id === id ? { ...i, note } : i));
  const updateRating = (id, rating) => setColItems(prev => prev.map(i => i.id === id ? { ...i, rating: i.rating === rating ? 0 : rating } : i));

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), visibility, show_numbers: showNumbers, items: colItems });
      onClose();
    } catch (e) { setSaving(false); }
  };

  const itemTypeIcon = { media: "🎬", character: "👤", person: "🎭", comicchar: "💬" };

  return (
    <div className="modal-bg" onClick={onClose} style={isMobileDevice ? { paddingBottom: 64 } : {}}>
      <div className="modal fade-in cover-modal" style={{ maxWidth: 560, padding: 0, display: "flex", flexDirection: "column", width: "100%" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, flexShrink: 0 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
            {initialData ? "✏️ Editar Coleção" : "📋 Nova Coleção"}
          </h3>
          <input
            placeholder="Nome da coleção..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: darkMode ? "#0d1117" : "#f8fafc", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 14, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }}
          />
          <textarea
            placeholder="Descrição (opcional)..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: darkMode ? "#0d1117" : "#f8fafc", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 13, fontFamily: "inherit", resize: "none", marginBottom: 10, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {["public", "friends", "private"].map(v => (
              <button key={v} onClick={() => setVisibility(v)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: visibility === v ? accent : "transparent",
                border: `1px solid ${visibility === v ? accent : "#30363d"}`,
                color: visibility === v ? "#fff" : "#8b949e",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {v === "public" ? "🌐 Pública" : v === "friends" ? "👥 Amigos" : "🔒 Privada"}
              </button>
            ))}
            <button onClick={() => setShowNumbers(v => !v)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: showNumbers ? `${accent}22` : "transparent",
              border: `1px solid ${showNumbers ? accent : "#30363d"}`,
              color: showNumbers ? accent : "#8b949e",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              # Números
            </button>
          </div>
        </div>

        {/* Body scrollável */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
              {searchTypeOpts.map(opt => (
                <button key={opt.id} onClick={() => { setSearchType(opt.id); setSearchQ(""); setSearchResults([]); }} style={{
                  flexShrink: 0, padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: searchType === opt.id ? accent : "transparent",
                  border: `1px solid ${searchType === opt.id ? accent : "#30363d"}`,
                  color: searchType === opt.id ? "#fff" : "#8b949e",
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
              ))}
            </div>
            <input
              placeholder={searchType === "library" ? "Pesquisar na biblioteca..." : searchType === "character" ? "Nome do personagem ou da série/anime..." : searchType === "person" ? "Nome do ator ou realizador..." : "Nome do personagem comic..."}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: darkMode ? "#0d1117" : "#f8fafc", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            {/* Results */}
            {(searchLoading || searchResults.length > 0 || (searchQ.trim() && !searchLoading && searchError) || (searchQ.trim() && !searchLoading && !searchError && searchResults.length === 0)) && (
              <div style={{ marginTop: 6, background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 10, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, maxHeight: 200, overflowY: "auto" }}>
                {searchLoading ? (
                  <div style={{ padding: "12px 16px", color: "#8b949e", fontSize: 13 }}>A pesquisar...</div>
                ) : searchError ? (
                  <div style={{ padding: "12px 16px", color: "#ef4444", fontSize: 13 }}>Erro ao pesquisar. Verifica a ligação.</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "12px 16px", color: "#8b949e", fontSize: 13 }}>Nenhum resultado para "{searchQ}"</div>
                ) : searchResults.map(r => {
                  const already = colItems.some(i => i.id === r.id);
                  return (
                    <div key={r.id} onClick={() => !already && addItem(r)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      cursor: already ? "default" : "pointer", opacity: already ? 0.5 : 1,
                      borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
                    }}
                      onMouseEnter={e => { if (!already) e.currentTarget.style.background = darkMode ? "#21262d" : "#e2e8f0"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                    >
                      <div style={{ width: 32, height: 44, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "#21262d" }}>
                        {r.cover ? <img src={r.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{itemTypeIcon[r.itemType]}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? "#e6edf3" : "#0d1117", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize: 11, color: "#8b949e" }}>{r.subtitle}</div>}
                      </div>
                      {already ? <span style={{ fontSize: 11, color: accent }}>✓ Adicionado</span> : <span style={{ fontSize: 18, color: accent }}>+</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Items list */}
          {colItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#484f58" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <p style={{ fontSize: 13 }}>Pesquisa e adiciona itens à coleção</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {colItems.map((item, idx) => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: darkMode ? "#0d1117" : "#f8fafc",
                  border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
                  borderRadius: 10, padding: "8px 10px",
                }}>
                  {/* Cover */}
                  <div style={{ width: 32, height: 44, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "#21262d" }}>
                    {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{itemTypeIcon[item.itemType]}</span>}
                  </div>
                  {/* Info + note */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {showNumbers && <span style={{ color: accent, marginRight: 5 }}>{idx + 1}.</span>}{item.title}
                    </div>
                    <input
                      placeholder="Nota pessoal (opcional)..."
                      value={item.note || ""}
                      onChange={e => updateNote(item.id, e.target.value)}
                      style={{ width: "100%", padding: "3px 7px", fontSize: 11, borderRadius: 5, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, background: "transparent", color: "#8b949e", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                  {/* Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", color: idx === 0 ? "#30363d" : "#8b949e", cursor: idx === 0 ? "default" : "pointer", fontSize: 13, padding: "1px 4px", lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === colItems.length - 1} style={{ background: "none", border: "none", color: idx === colItems.length - 1 ? "#30363d" : "#8b949e", cursor: idx === colItems.length - 1 ? "default" : "pointer", fontSize: 13, padding: "1px 4px", lineHeight: 1 }}>▼</button>
                  </div>
                  <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", paddingBottom: isMobileDevice ? 24 : 14, borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn-accent" style={{ flex: 1, padding: "12px" }} onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "A guardar..." : "💾 Guardar Coleção"}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: darkMode ? "#21262d" : "#e2e8f0", border: "none", borderRadius: 10, color: darkMode ? "#e6edf3" : "#0d1117", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function CollectionViewer({ col, onClose, onLike, liked, currentUserId, onEdit, onOpenMedia, workerUrl }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
  const items = col.items || [];
  const itemTypeIcon = { media: "🎬", character: "👤", person: "🎭", comicchar: "💬" };
  const cols = isMobileDevice ? 3 : 5;
  const [selectedChar, setSelectedChar] = useState(null);
  const [charData, setCharData] = useState(null);
  const [charLoading, setCharLoading] = useState(false);

  const cleanDesc = (text) => {
    if (!text) return "";
    return text
      .replace(/~![\s\S]*?!~/g, "")             // ~!spoiler!~ → remove
      .replace(/__([^_]+)__/g, "$1")             // __bold__ → bold
      .replace(/\*\*([^*]+)\*\*/g, "$1")         // **bold** → bold
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // [text](url) → text
      .replace(/<br\s*\/?>/gi, " ")              // <br> → espaço
      .replace(/<[^>]*>/g, "")                   // outras html tags
      .replace(/\n{2,}/g, " • ")                 // parágrafos → bullet
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const handleItemClick = (item) => {
    if (item.itemType === "media" || (!item.itemType && item.id)) {
      onOpenMedia && onOpenMedia(item);
    } else if (item.itemType === "character" || item.itemType === "person" || item.itemType === "comicchar") {
      setSelectedChar(item);
      setCharData(null);
      // Fetch AniList character data if it's an AniList character
      const alCharId = item.id?.startsWith("alchar-") ? item.id.replace("alchar-", "") : null;
      if (alCharId) {
        setCharLoading(true);
        const charQuery = `query($id:Int){Character(id:$id){description(asHtml:false) age gender dateOfBirth{year month day} media(perPage:6,sort:POPULARITY_DESC){nodes{id title{romaji}coverImage{medium}type format}}}}`;
        const charBody = JSON.stringify({ query: charQuery, variables: { id: parseInt(alCharId) } });
        fetchAniListSafe(["https://graphql.anilist.co", wUrl + "/anilist"], charBody)
          .then(d => {
            setCharData(d?.data?.Character || null);
            setCharLoading(false);
          }).catch(() => setCharLoading(false));
      }
    }
  };

  return (
    <div className="fade-in view-transition" style={{ minHeight: "100vh", background: "transparent" }}>
      {/* Header */}
      <div style={{
        padding: isMobileDevice ? "16px 16px 12px" : "24px 32px 16px",
        borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Back + actions row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: accent,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 4,
          }}>← {isMobileDevice ? "" : "Voltar"}</button>
          <h2 style={{ flex: 1, fontSize: isMobileDevice ? 18 : 22, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", lineHeight: 1.2, margin: 0 }}>{col.title}</h2>
          {currentUserId === col.user_id && (
            <button onClick={() => onEdit(col)} style={{
              background: "transparent", border: `1px solid ${accent}`, color: accent,
              borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>✏️ Editar</button>
          )}
        </div>
        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => onLike(col.id)} style={{
            background: liked ? `${accent}22` : "transparent",
            border: `1px solid ${liked ? accent : "#30363d"}`,
            color: liked ? accent : "#8b949e",
            borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>♥ {col.likes_count || 0}</button>
          <span style={{ fontSize: 12, color: "#8b949e" }}>{items.length} {items.length === 1 ? "item" : "itens"}</span>
          <span style={{ fontSize: 11, color: "#8b949e" }}>{col.visibility === "private" ? "🔒 Privada" : col.visibility === "friends" ? "👥 Amigos" : "🌐 Pública"}</span>
        </div>
        {col.description ? <p style={{ fontSize: 13, color: "#8b949e", margin: 0, lineHeight: 1.5 }}>{col.description}</p> : null}
      </div>

      {/* Grid */}
      <div style={{ padding: isMobileDevice ? "12px 10px" : "20px 32px", paddingBottom: isMobileDevice ? 90 : 32 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14 }}>Esta coleção está vazia</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: isMobileDevice ? 6 : 10 }}>
            {items.map((item, idx) => {
              const isChar = item.itemType === "character" || item.itemType === "person" || item.itemType === "comicchar";
              const clickable = true;
              return (
                <div key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{ display: "flex", flexDirection: "column", gap: 5, cursor: "pointer" }}
                >
                  <div style={{
                    aspectRatio: "2/3",
                    borderRadius: 8, overflow: "hidden", background: "#21262d", position: "relative",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    transition: "transform 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                  >
                    {item.cover
                      ? <img src={item.cover} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} onError={e => { e.target.style.display = "none"; }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{itemTypeIcon[item.itemType] || "🎬"}</div>
                    }
                    {col.show_numbers && (
                      <div style={{
                        position: "absolute", bottom: 5, left: 5,
                        background: "rgba(0,0,0,0.75)", color: "#fff",
                        borderRadius: "50%", width: 20, height: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800,
                      }}>{idx + 1}</div>
                    )}
                  </div>
                  <div style={{ fontSize: isMobileDevice ? 10 : 11, fontWeight: 700, color: darkMode ? "#c9d1d9" : "#374151", lineHeight: 1.3, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
                  {item.subtitle && <div style={{ fontSize: isMobileDevice ? 9 : 10, color: accent, textAlign: "center", fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.subtitle}</div>}
                  {item.note && <div style={{ fontSize: 9, color: "#8b949e", textAlign: "center", fontStyle: "italic", lineHeight: 1.3 }}>{item.note}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de personagem */}
      {selectedChar && (
        <div className="modal-bg" onClick={() => { setSelectedChar(null); setCharData(null); }} style={{ zIndex: 200 }}>
          <div className="modal fade-in" style={{ maxWidth: 420, width: "95%", padding: 0, overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            {/* Header com imagem + nome */}
            <div style={{ display: "flex", gap: 0, position: "relative", background: "#0d1117", flexShrink: 0 }}>
              {/* Imagem */}
              <div style={{ width: 120, minHeight: 160, flexShrink: 0, background: "#21262d" }}>
                {selectedChar.cover
                  ? <img src={selectedChar.cover} alt={selectedChar.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
                  : <div style={{ width: "100%", height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>👤</div>
                }
              </div>
              {/* Info direita */}
              <div style={{ flex: 1, padding: "16px 16px 16px 16px", display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#e6edf3", lineHeight: 1.2 }}>{selectedChar.title}</div>
                {selectedChar.subtitle && <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{selectedChar.subtitle}</div>}
                {charData?.age && <div style={{ fontSize: 11, color: "#8b949e" }}>{lang === "en" ? "Age" : "Idade"}: {charData.age}</div>}
                {charData?.gender && <div style={{ fontSize: 11, color: "#8b949e" }}>{lang === "en" ? "Gender" : "Género"}: {charData.gender}</div>}
                {selectedChar.note && <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic", lineHeight: 1.4, marginTop: 4 }}>"{selectedChar.note}"</div>}
              </div>
              <button onClick={() => { setSelectedChar(null); setCharData(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Body scrollável */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {charLoading ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#8b949e", fontSize: 13 }}>
                  <span className="spin" style={{ fontSize: 20, display: "inline-block" }}>◌</span>
                </div>
              ) : (
                <>
                  {/* Descrição */}
                  {charData?.description && (
                    <div style={{ padding: "14px 16px 0" }}>
                      <p style={{ fontSize: 12, color: darkMode ? "#8b949e" : "#64748b", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {cleanDesc(charData.description)}
                      </p>
                    </div>
                  )}

                  {/* Obras */}
                  {charData?.media?.nodes?.length > 0 && (
                    <div style={{ padding: "14px 16px 20px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{lang === "en" ? "Appears in" : "Aparece em"}</div>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {charData.media.nodes.map(m => {
                          const mType = m.type === "MANGA" ? "manga" : "anime";
                          const mId = `al-${mType}-${m.id}`;
                          return (
                            <div key={m.id} onClick={() => { setSelectedChar(null); setCharData(null); onOpenMedia && onOpenMedia({ id: mId, title: m.title?.romaji, type: mType, cover: m.coverImage?.medium }); }} style={{ flexShrink: 0, width: 80, cursor: "pointer" }}>
                              <div style={{ width: 80, height: 112, borderRadius: 7, overflow: "hidden", background: "#21262d", marginBottom: 5 }}>
                                {m.coverImage?.medium
                                  ? <img src={m.coverImage.medium} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎬</div>
                                }
                              </div>
                              <div style={{ fontSize: 10, color: darkMode ? "#c9d1d9" : "#374151", lineHeight: 1.3, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{m.title?.romaji}</div>
                              <div style={{ fontSize: 9, color: accent, textAlign: "center", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{m.format?.replace("_", " ")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sem dados AniList — só para personagens não-AniList */}
                  {!charData && !charLoading && !selectedChar.id?.startsWith("alchar-") && (
                    <div style={{ padding: "20px 16px", color: "#8b949e", fontSize: 12, textAlign: "center" }}>
                      {selectedChar.subtitle && <p>De: {selectedChar.subtitle}</p>}
                    </div>
                  )}
                  {/* AniList mas sem dados — retry link */}
                  {!charData && !charLoading && selectedChar.id?.startsWith("alchar-") && (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#484f58", marginBottom: 8 }}>
                        {lang === "en" ? "Could not load character data." : "Não foi possível carregar dados do personagem."}
                      </p>
                      <a href={`https://anilist.co/character/${selectedChar.id.replace("alchar-","")}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: accent, fontWeight: 700 }}>
                        Ver no AniList →
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TierListCard({ tl, onOpen, onLike, liked, currentUserId, onDelete }) {
  const { accent, darkMode } = useTheme();
  const allItems = TIER_LEVELS.flatMap(t => (tl.tiers[t.id] || []));

  // Mosaico: grupos por tier, cada grupo com até 2 capas — separados por barra colorida
  const mosaicGroups = TIER_LEVELS.map(t => ({
    tier: t,
    items: (tl.tiers[t.id] || []).slice(0, 2)
  })).filter(g => g.items.length > 0);

  return (
    <div onClick={() => onOpen(tl)} style={{ background: darkMode ? "#161b22" : "rgba(255,255,255,0.95)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>

      {/* Mosaico com grupos separados por cor do tier */}
      <div style={{ display: "flex", height: 120, overflow: "hidden", background: darkMode ? "#0d1117" : "#e8e8e8", flexShrink: 0 }}>
        {mosaicGroups.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 32 }}>🏆</span>
          </div>
        ) : mosaicGroups.map((group, gIdx) => (
          <div key={group.tier.id} style={{ display: "flex", flex: group.items.length, minWidth: 0, position: "relative" }}>
            {/* Barra colorida do tier no topo */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: group.tier.color, zIndex: 2 }} />
            {/* Label do tier */}
            <div style={{ position: "absolute", top: 6, left: 4, zIndex: 3, background: group.tier.color, borderRadius: 3, padding: "1px 4px" }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: "white", lineHeight: 1 }}>{group.tier.id}</span>
            </div>
            {/* Capas do grupo */}
            {group.items.map((item, iIdx) => {
              const cover = item.customCover || item.cover || item.thumbnailUrl;
              return (
                <div key={item.id} style={{ flex: 1, minWidth: 0, overflow: "hidden", background: gradientFor(item.id), borderLeft: (gIdx > 0 && iIdx === 0) ? `2px solid ${darkMode ? "#0d1117" : "#e0e0e0"}` : "none" }}>
                  {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div style={{ padding: "8px 12px 11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0d1117", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 175 }}>{tl.title}</p>
          <span style={{ fontSize: 10, color: "#6e7681" }}>{allItems.length} itens · {new Date(tl.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onLike && onLike(tl.id); }} style={{ display: "flex", alignItems: "center", gap: 3, background: liked ? `${accent}22` : "transparent", border: `1px solid ${liked ? accent : (darkMode ? "#30363d" : "#ddd")}`, borderRadius: 20, padding: "3px 9px", color: liked ? accent : "#6e7681", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}>
            ♥ {tl.likes_count || 0}
          </button>
          {currentUserId === tl.user_id && onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(tl.id); }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 13, padding: "2px 3px", lineHeight: 1 }}>🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}

function TierListEditor({ initialData, library, onSave, onClose, workerUrl, tmdbKey }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const [title, setTitle] = useState(initialData?.title || "");
  const [tiers, setTiers] = useState(initialData?.tiers || { S: [], A: [], B: [], C: [], D: [] });
  const [search, setSearch] = useState("");
  const [poolTab, setPoolTab] = useState("biblioteca"); // biblioteca | pesquisar
  const [extSearch, setExtSearch] = useState("");
  const [extResults, setExtResults] = useState([]);
  const [extSearching, setExtSearching] = useState(false);
  const [extType, setExtType] = useState("anime");
  const [dragItem, setDragItem] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickingTierFor, setPickingTierFor] = useState(null); // item a adicionar via clique

  const items = Object.values(library || {});
  const rankedIds = new Set(Object.values(tiers).flat().map(i => i.id));
  const unranked = items.filter(i =>
    !rankedIds.has(i.id) &&
    (search === "" || (i.title || "").toLowerCase().includes(search.toLowerCase()))
  );

  const searchExternal = async () => {
    if (!extSearch.trim()) return;
    setExtSearching(true);
    setExtResults([]);
    try {
      let results = [];
      const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
      if (extType === "anime" || extType === "manga") {
        const aniType = extType === "anime" ? "ANIME" : "MANGA";
        const q = `{ Page(perPage:15) { media(search:"${extSearch.trim().replace(/"/g,"'")}",type:${aniType}) { id title{romaji} coverImage{large} averageScore description(asHtml:false) } } }`;
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrl}/anilist`], JSON.stringify({ query: q }));
        results = (data?.data?.Page?.media || []).map(m => ({
          id: `al-${extType}-${m.id}`, title: m.title?.romaji || "", cover: m.coverImage?.large || "",
          type: extType, score: m.averageScore || 0,
          synopsis: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/\n+/g, " ").trim() : ""
        }));
      } else if (extType === "filmes") {
        const url = `${wUrl}/tmdb?endpoint=/search/movie&query=${encodeURIComponent(extSearch.trim())}&language=en-US`;
        const res = await fetch(url);
        const data = await res.json();
        results = (data?.results || []).slice(0, 15).map(m => ({
          id: `tmdb-filmes-${m.id}`, title: m.title || "", cover: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "",
          type: "filmes", score: m.vote_average || 0
        }));
      } else if (extType === "series") {
        const url = `${wUrl}/tmdb?endpoint=/search/tv&query=${encodeURIComponent(extSearch.trim())}&language=en-US`;
        const res = await fetch(url);
        const data = await res.json();
        results = (data?.results || []).slice(0, 15).map(m => ({
          id: `tmdb-series-${m.id}`, title: m.name || "", cover: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "",
          type: "series", score: m.vote_average || 0
        }));
      }
      setExtResults(results.filter(r => !rankedIds.has(r.id)));
    } catch (e) { console.error(e); }
    setExtSearching(false);
  };

  const addToTier = (item, tierId) => {
    setTiers(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = next[k].filter(i => i.id !== item.id); });
      next[tierId] = [...next[tierId], item];
      return next;
    });
  };

  const removeFromTier = (item, tierId) => {
    setTiers(prev => ({ ...prev, [tierId]: prev[tierId].filter(i => i.id !== item.id) }));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(title.trim(), tiers);
    setSaving(false);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in" style={{ maxWidth: 660, maxHeight: "94vh", overflowY: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, position: "sticky", top: 0, background: darkMode ? "#161b22" : "#fff", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117" }}>
              {initialData ? "Editar Tier List" : "Nova Tier List"}
            </h2>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título da tier list..."
            style={{ width: "100%", padding: "10px 14px", fontSize: 14, fontWeight: 700, borderRadius: 10, boxSizing: "border-box", background: darkMode ? "#0d1117" : "#f8fafc", border: `1.5px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit" }}
          />
        </div>

        {/* Tiers */}
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          {TIER_LEVELS.map(tier => (
            <div key={tier.id}
              style={{ display: "flex", minHeight: 56, borderRadius: 10, overflow: "hidden", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragItem) { addToTier(dragItem, tier.id); setDragItem(null); setDragFrom(null); } }}
            >
              <div style={{ width: 44, background: tier.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "white" }}>{tier.id}</span>
              </div>
              <div style={{ flex: 1, background: darkMode ? "#0d1117" : "#f8fafc", display: "flex", flexWrap: "wrap", gap: 5, padding: 6, alignContent: "flex-start", minHeight: 56 }}>
                {(tiers[tier.id] || []).map(item => {
                  const cover = item.customCover || item.cover || item.thumbnailUrl;
                  return (
                    <div key={item.id} title={item.title}
                      draggable
                      onDragStart={() => { setDragItem(item); setDragFrom(tier.id); }}
                      style={{ position: "relative", cursor: "grab" }}
                    >
                      <div style={{ width: 34, height: 50, borderRadius: 4, overflow: "hidden", background: gradientFor(item.id) }}>
                        {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />}
                      </div>
                      <button onClick={() => removeFromTier(item, tier.id)} style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>✕</button>
                    </div>
                  );
                })}
                {(tiers[tier.id] || []).length === 0 && (
                  <span style={{ fontSize: 11, color: "#484f58", alignSelf: "center", paddingLeft: 4 }}>Arrasta aqui</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pool */}
        <div style={{ padding: "0 20px 16px" }}>
          {/* Tabs do pool */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
            <button onClick={() => setPoolTab("biblioteca")} style={{ flex: 1, padding: "8px", background: "none", border: "none", borderBottom: poolTab === "biblioteca" ? `2px solid ${accent}` : "2px solid transparent", color: poolTab === "biblioteca" ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, marginBottom: -1 }}>
              📚 Biblioteca ({unranked.length})
            </button>
            <button onClick={() => setPoolTab("pesquisar")} style={{ flex: 1, padding: "8px", background: "none", border: "none", borderBottom: poolTab === "pesquisar" ? `2px solid ${accent}` : "2px solid transparent", color: poolTab === "pesquisar" ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, marginBottom: -1 }}>
              🔍 Pesquisar
            </button>
          </div>

          {/* Tab biblioteca */}
          {poolTab === "biblioteca" && (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar..." style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8, marginBottom: 10, boxSizing: "border-box", background: darkMode ? "#0d1117" : "#f8fafc", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {unranked.slice(0, 80).map(item => {
                  const cover = item.customCover || item.cover || item.thumbnailUrl;
                  return (
                    <div key={item.id} title={item.title} draggable onDragStart={() => { setDragItem(item); setDragFrom(null); }} style={{ cursor: "grab" }}>
                      <div style={{ width: 38, height: 55, borderRadius: 5, overflow: "hidden", background: gradientFor(item.id), border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                        {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                      </div>
                    </div>
                  );
                })}
                {unranked.length === 0 && <p style={{ fontSize: 12, color: "#484f58" }}>Todos os itens completos já estão na lista!</p>}
              </div>
            </>
          )}

          {/* Tab pesquisa externa */}
          {poolTab === "pesquisar" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {[{id:"anime",label:"Anime"},{id:"manga",label:"Manga"},{id:"filmes",label:"Filmes"},{id:"series",label:"Séries"}].map(t => (
                  <button key={t.id} onClick={() => setExtType(t.id)} style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 20, border: `1px solid ${extType===t.id?accent:"#30363d"}`, background: extType===t.id?`${accent}22`:"transparent", color: extType===t.id?accent:"#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>{t.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input value={extSearch} onChange={e => setExtSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchExternal()} placeholder="Pesquisar título..." style={{ flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 8, boxSizing: "border-box", background: darkMode ? "#0d1117" : "#f8fafc", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit" }} />
                <button onClick={searchExternal} disabled={extSearching} style={{ padding: "8px 14px", borderRadius: 8, background: accent, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {extSearching ? "..." : "🔍"}
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {extResults.map(item => {
                  const alreadyIn = rankedIds.has(item.id);
                  return (
                    <div key={item.id} title={item.title} draggable={!alreadyIn} onDragStart={() => { if (!alreadyIn) { setDragItem(item); setDragFrom(null); } }} style={{ cursor: alreadyIn ? "default" : "grab", opacity: alreadyIn ? 0.4 : 1 }}>
                      <div style={{ width: 38, height: 55, borderRadius: 5, overflow: "hidden", background: gradientFor(item.id), border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                        {item.cover && <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                      </div>
                    </div>
                  );
                })}
                {!extSearching && extResults.length === 0 && extSearch && <p style={{ fontSize: 12, color: "#484f58" }}>Sem resultados.</p>}
                {!extSearching && extResults.length === 0 && !extSearch && <p style={{ fontSize: 12, color: "#484f58" }}>Pesquisa qualquer título acima.</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 20px", borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, display: "flex", gap: 10, position: "sticky", bottom: 0, background: darkMode ? "#161b22" : "#fff" }}>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-accent" style={{ flex: 2, padding: "12px", fontSize: 14, opacity: !title.trim() ? 0.5 : 1 }}>
            {saving ? "A guardar..." : "Guardar Tier List"}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: darkMode ? "#21262d" : "#f1f5f9", border: "none", borderRadius: 10, color: darkMode ? "#e6edf3" : "#0d1117", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function TierListViewer({ tl, onClose, onLike, liked, currentUserId, onEdit }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fade-in" style={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", flex: 1, marginRight: 12 }}>{tl.title}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
          {tl.profiles && <p style={{ fontSize: 12, color: "#484f58", marginBottom: 12 }}>por @{tl.profiles.username || tl.profiles.name}</p>}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => onLike && onLike(tl.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: liked ? `${accent}22` : "none", border: `1px solid ${liked ? accent : "#30363d"}`, borderRadius: 20, padding: "6px 16px", color: liked ? accent : "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              ♥ {tl.likes_count || 0} gostos
            </button>
            {currentUserId === tl.user_id && onEdit && (
              <button onClick={() => { onClose(); onEdit(tl); }} style={{ background: "none", border: "1px solid #30363d", borderRadius: 20, padding: "6px 16px", color: "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                ✏ Editar
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          {TIER_LEVELS.map(tier => {
            const items = tl.tiers[tier.id] || [];
            return (
              <div key={tier.id} style={{ display: "flex", minHeight: 56, borderRadius: 10, overflow: "hidden", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                <div style={{ width: 48, background: tier.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "white" }}>{tier.id}</span>
                </div>
                <div style={{ flex: 1, background: darkMode ? "#0d1117" : "#f8fafc", display: "flex", flexWrap: "wrap", gap: 6, padding: 8, alignContent: "flex-start" }}>
                  {items.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#484f58", alignSelf: "center" }}>Vazio</span>
                  ) : items.map(item => {
                    const cover = item.customCover || item.cover || item.thumbnailUrl;
                    return (
                      <div key={item.id} title={item.title}>
                        <div style={{ width: 54, height: 78, borderRadius: 6, overflow: "hidden", background: gradientFor(item.id) }}>
                          {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />}
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
    </div>
  );
}

function ProfileTabCompletos({ items, library, accent, darkMode, isMobileDevice, lang, onOpen }) {
  const completados = items.filter(i => i.userStatus === "completo").sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortMode, setSortMode] = useState("date");
  const filtered = completados
    .filter(i => typeFilter === "all" || i.type === typeFilter)
    .sort((a,b) => sortMode === "rating" ? (b.userRating||0)-(a.userRating||0) : sortMode === "title" ? (a.title||"").localeCompare(b.title||"") : (b.addedAt||0)-(a.addedAt||0));
  return (
    <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: "#484f58" }}>{completados.length} {lang === "en" ? "completed" : "completos"}</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[{id:"date",label:lang==="en"?"Date":"Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★"}].map(s => (
            <button key={s.id} onClick={() => setSortMode(s.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${sortMode===s.id?accent:"#30363d"}`, background: sortMode===s.id?`${accent}22`:"transparent", color: sortMode===s.id?accent:"#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 16 }}>
        {[{id:"all",label:lang==="en"?"All":"Todos"}, ...MEDIA_TYPES.slice(1).filter(t => completados.some(i => i.type === t.id))].map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${typeFilter===t.id?accent:"#30363d"}`, background: typeFilter===t.id?`${accent}22`:"transparent", color: typeFilter===t.id?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
            {t.icon} {t.labelEn ? (lang==="en"?t.labelEn:t.label) : t.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#484f58" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p>{lang === "en" ? "No completed items yet" : "Ainda sem itens completos"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
          {filtered.map(item => {
            const cover = item.customCover || item.cover || item.thumbnailUrl;
            return (
              <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{ cursor: "pointer" }}>
                <div style={{ aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), position: "relative" }}>
                  {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                  {item.userRating > 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.85)", borderRadius: 5, padding: "1px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 800 }}>★{item.userRating}</div>}
                </div>
                <p style={{ fontSize: 10, color: "#8b949e", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileTabDiario({ items, accent, darkMode, isMobileDevice, lang, onOpen }) {
  const completados = items.filter(i => i.userStatus === "completo" && i.addedAt).sort((a,b) => b.addedAt - a.addedAt);
  if (completados.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 16px", color: "#484f58" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
      <p>{lang === "en" ? "Complete items to see your diary" : "Completa itens para ver o teu diário"}</p>
    </div>
  );
  const groups = {};
  completados.forEach(item => {
    const d = new Date(item.addedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    if (!groups[key]) groups[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
    groups[key].items.push({ ...item, _day: d.getDate() });
  });
  const sortedGroups = Object.values(groups).sort((a,b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
  const typeIcon = (type) => MEDIA_TYPES.find(t => t.id === type)?.icon || "◉";
  return (
    <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
      <p style={{ fontSize: 13, color: "#484f58", marginBottom: 24 }}>{completados.length} {lang === "en" ? "entries" : "entradas"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {sortedGroups.map((group, gi) => (
          <div key={gi}>
            {/* Header do mês */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 12, overflow: "hidden", textAlign: "center", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, flexShrink: 0, minWidth: 56 }}>
                <div style={{ background: accent, padding: "4px 0", fontSize: 9, fontWeight: 800, color: "white", letterSpacing: 1 }}>{group.year}</div>
                <div style={{ padding: "6px 8px 8px", fontSize: 18, fontWeight: 900, color: darkMode ? "#e6edf3" : "#111827" }}>{(lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}</div>
              </div>
              <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
              <span style={{ fontSize: 12, color: darkMode ? "#484f58" : "#57606a", fontWeight: 700, background: darkMode ? "#21262d" : "#e8ecf0", padding: "3px 10px", borderRadius: 20 }}>{group.items.length}</span>
            </div>
            {/* Lista de itens */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.sort((a,b) => b._day - a._day).map((item, idx, arr) => {
                const cover = item.customCover || item.cover || item.thumbnailUrl;
                return (
                  <div key={item.id} onClick={() => onOpen && onOpen(item)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "8px 10px",
                    borderRadius: 10, cursor: "pointer", transition: "background 0.12s",
                    borderBottom: idx < arr.length-1 ? `1px solid ${darkMode ? "#21262d44" : "#e2e8f044"}` : "none",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#ffffff08" : "#00000005"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Dia em destaque */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}33`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: accent, lineHeight: 1 }}>{item._day}</span>
                    </div>
                    {/* Capa */}
                    <div style={{ width: 36, height: 52, borderRadius: 6, overflow: "hidden", background: gradientFor(item.id), flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                      {cover && <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 11, color: darkMode ? "#484f58" : "#57606a" }}>{typeIcon(item.type)} {item.type}</p>
                    </div>
                    {/* Rating */}
                    {item.userRating > 0 && (
                      <div style={{ flexShrink: 0, background: darkMode ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: "#f59e0b", fontWeight: 800 }}>★{item.userRating}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ profile, library, accent, bgColor, bgColorMobile, bgImage, bgImageMobile, bgSeparateDevices, onBgSeparateDevices, onBgImageMobile, onBgColorMobile, isMobileDevice, bgOverlay, bgBlur, bgParallax, darkMode, panelBg, panelOpacity, textContrast, textContrastMobile, sidebarColor, onUpdateProfile, onAccentChange, onBgChange, onBgImage, onBgOverlay, onBgBlur, onBgParallax, onPanelBg, onPanelOpacity, onTextContrast, onTextContrastMobile, onSidebarColor, onSavedThemes, onTmdbKey, tmdbKey, workerUrl, onWorkerUrl, onSignOut, userEmail, favorites = [], onToggleFavorite, onImportMihon, onImportPaperback, onImportLetterboxd, onOpen, diaryPanel = null, lang = "en", useT = (k) => k, onChangeLang, userTierlists = [], userLikes = [], currentUserId = null, onCreateTierlist, onViewTierlist, onLikeTierlist, onDeleteTierlist, userCollections = [], userCollectionLikes = [], onCreateCollection, onViewCollection, onLikeCollection, onDeleteCollection }) {
  const [editing, setEditing] = useState(false);
  const [profileTab, setProfileTab] = useState("perfil");
  const [showMihon, setShowMihon] = useState(false);
  const [showPaperback, setShowPaperback] = useState(false);
  const [showLetterboxd, setShowLetterboxd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [hideEmail, setHideEmail] = useState(profile.hideEmail || false);
  const [hideBannerMobile, setHideBannerMobile] = useState(profile.hideBannerMobile || false);
  const [shareCopied, setShareCopied] = useState(false);
  const [themeName, setThemeName] = useState("");

  // Calcula o background dos painéis com cor + opacidade
  const computedPanelBg = (() => {
    const base = panelBg || (darkMode ? "#161b22" : "rgba(255,255,255,0.7)");
    const op = (panelOpacity ?? 100) / 100;
    if (op >= 1 && !panelBg) return base; // sem customização, usa default
    if (!panelBg) return base;
    // Converter hex para rgba com opacidade
    try {
      const hex = panelBg.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16);
        const g = parseInt(hex.slice(2,4),16);
        const b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b},${op})`;
      }
    } catch {}
    return base;
  })();
  const [appearSections, setAppearSections] = useState({ cores: true, texto: false, fundo: false, sidebar: false, dispositivos: false, stats: false });
  const toggleAppear = (key) => setAppearSections(p => ({ ...p, [key]: !p[key] }));
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || "");
  const [bannerPreview, setBannerPreview] = useState(profile.banner || "");
  const [bannerUrl, setBannerUrl] = useState(profile.banner || "");
  const [cropSrc, setCropSrc] = useState(null);
  const [cropType, setCropType] = useState(null); // "avatar" | "banner"
  const avatarRef = useRef();
  const bannerRef = useRef();
  const items = useMemo(() => Object.values(library), [library]);
  const byType = useMemo(() => {
    const r = {};
    MEDIA_TYPES.slice(1).forEach((t) => { r[t.id] = items.filter((i) => i.type === t.id && i.userStatus === 'completo').length; });
    return r;
  }, [items]);
  const byStatus = useMemo(() => {
    const r = {};
    STATUS_OPTIONS.forEach((s) => { r[s.id] = items.filter((i) => i.userStatus === s.id).length; });
    return r;
  }, [items]);
  const totalRatings = useMemo(() => items.filter((i) => i.userRating > 0), [items]);
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
    await onUpdateProfile({ ...profile, name, bio, avatar: avatarPreview, banner: bannerUrl, hideEmail, hideBannerMobile });
    setEditing(false);
  };

  const currentBanner = editing ? bannerPreview : profile.banner;
  const currentAvatar = editing ? avatarPreview : profile.avatar;

  return (
    <>
    <div style={{ paddingBottom: 32, maxWidth: isMobileDevice ? 600 : "100%", margin: "0 auto" }}>

      {/* ── Banner + Avatar header ── */}
      <div style={{ position: "relative", marginBottom: 64 }}>
        {/* Banner — escondido no mobile se hideBannerMobile */}
        {(!isMobileDevice || !profile.hideBannerMobile) && (
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
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{lang === "en" ? "Recommended: 1200×400px · Mobile: 390×160px" : "Recomendado: 1200×400px · Telemóvel: 390×160px"}</p>
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
        )} {/* fim hideBannerMobile */}

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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={useT("namePlaceholder")} style={{ padding: "10px 14px", textAlign: "center", fontSize: 16, fontWeight: 700 }} />
            <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder={useT("bioPlaceholder")} style={{ padding: "10px 14px", fontSize: 13 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: darkMode ? "#0d1117" : "#f8fafc", borderRadius: 10, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!hideEmail} onChange={e => setHideEmail(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
              <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>{useT("hideEmail")}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: darkMode ? "#0d1117" : "#f8fafc", borderRadius: 10, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!hideBannerMobile} onChange={e => setHideBannerMobile(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
              <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>{lang === "en" ? "Hide banner on mobile" : "Esconder banner no mobile"}</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-accent" style={{ flex: 1, padding: "10px" }} onClick={handleSave}>{useT("saveProfile")}</button>
              <button onClick={() => { setEditing(false); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setAvatarPreview(profile.avatar||""); }} style={{ flex: 1, padding: "10px", background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit" }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, background: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{profile.name || "Utilizador"}</h2>
            {profile.bio && <p style={{ color: "#8b949e", fontSize: 14, marginTop: 4 }}>{profile.bio}</p>}
            {userEmail && !hideEmail && <p style={{ color: "#484f58", fontSize: 12, marginTop: 4 }}>✉ {userEmail}</p>}
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>TrackAll · {items.length} {useT("inLibraryCount")}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, alignItems: "center" }}>
              <button onClick={() => { setName(profile.name||""); setBio(profile.bio||""); setAvatarPreview(profile.avatar||""); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setEditing(true); }} style={{
                padding: "8px 20px", borderRadius: 8, border: `1px solid ${accent}44`,
                background: `${accent}15`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              }}>✏ Editar Perfil</button>
              {onSignOut && (
                <button onClick={onSignOut} title={useT("signOut")} style={{
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

      {/* ── Profile Tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #21262d", scrollbarWidth: "none" }}>
        {["perfil","completos","tierlists","listas","diario"].map(tab => (
          <button key={tab} onClick={() => setProfileTab(tab)} style={{
            flex: 1, padding: isMobileDevice ? "10px 4px" : "12px 20px",
            background: "none", border: "none",
            borderBottom: profileTab === tab ? `2px solid ${accent}` : "2px solid transparent",
            color: profileTab === tab ? accent : "#484f58",
            cursor: "pointer", fontFamily: "inherit",
            fontSize: isMobileDevice ? 11 : 13,
            fontWeight: profileTab === tab ? 700 : 500,
            marginBottom: -1, whiteSpace: "nowrap",
          }}>
            {tab === "perfil" ? useT("tabPerfil") : tab === "completos" ? useT("tabCompletos") : tab === "tierlists" ? useT("tabTierLists") : tab === "listas" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="0" y="0" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="7" y="0" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="0" y="7" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor"/>
                </svg>
                {lang === "en" ? "Lists" : "Listas"}
              </span>
            ) : useT("tabDiario")}
          </button>
        ))}
      </div>

      {/* Stats and settings — PC: flex row com diário à direita */}
      <div style={{ display: profileTab === "perfil" ? "block" : "none" }}>
      <div style={ !isMobileDevice
        ? { display: "flex", flexDirection: "row", gap: 32, padding: "24px 32px 0 32px", alignItems: "flex-start" }
        : { padding: "16px 16px 0" }
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
              <h3 style={{ fontSize: 11, fontWeight: 800, color: darkMode ? "#8b949e" : "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("favorites").toUpperCase()}</h3>
              <span style={{ fontSize: 11, color: "#484f58" }}>{favorites.length}</span>
            </div>

            {favorites.length === 0 ? (
              <div style={{ margin: "0 16px", background: computedPanelBg, border: "1px dashed #30363d", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <p style={{ color: "#484f58", fontSize: 13 }}>{lang === "en" ? "Open any item and click ☆ Favorite" : "Abre qualquer item e clica em ☆ Favorito"}</p>
              </div>
            ) : (
              <div style={{ padding: !isMobileDevice ? "0 32px 0 32px" : "0 0 0 16px", display: "flex", flexDirection: "column", gap: 18 }}>
                {activeTypes.map((t, tIdx) => {
                  const tc = accentVariant(accent, tIdx);
                  return (
                    <div key={t.id}>
                      {/* Label categoria */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, textTransform: "uppercase", letterSpacing: "0.14em" }}>{mediaLabel(t, lang)}</span>
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
                          <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(4, 1fr)" : "repeat(auto-fill, minmax(100px, 1fr))", gap: isMobileDevice ? 4 : 10 }}>
                            {favByType[t.id].map(item => {
                              const coverSrc = item.customCover || item.cover;
                              const currentRating = findLibraryEntry(library, item.id, item.type)?.item?.userRating ?? item.userRating ?? 0;
                              return (
                                <div key={item.id} className="fav-card-wrap" onClick={() => onOpen && onOpen(item)} style={{ position: "relative", cursor: "pointer" }}
                                  onMouseEnter={e => { const rm = e.currentTarget.querySelector(".fav-rm"); if(rm) rm.style.opacity="1"; const th = e.currentTarget.querySelector(".fav-thumb-d"); if(th){th.style.transform="translateY(-3px) scale(1.02)"; th.querySelector(".fav-overlay").style.opacity="1";} }}
                                  onMouseLeave={e => { const rm = e.currentTarget.querySelector(".fav-rm"); if(rm) rm.style.opacity="0"; const th = e.currentTarget.querySelector(".fav-thumb-d"); if(th){th.style.transform="translateY(0) scale(1)"; th.querySelector(".fav-overlay").style.opacity="0";} }}>
                                  <div className="fav-thumb-d" style={{ width: "100%", aspectRatio: "2/3", borderRadius: isMobileDevice ? 6 : 9, overflow: "hidden", background: gradientFor(item.id), transition: "transform 0.15s", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                                    {coverSrc
                                      ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />
                                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{t.icon}</div>
                                    }
                                    <div className="fav-overlay no-tc" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s" }}>
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
      {items.length > 0 && <RecentSection items={items} onOpen={onOpen} showDiary={isMobileDevice} />}

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
              <div key={s.id} style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${s.color}`, borderTop: `1px solid ${s.color}22`, borderRight: `1px solid ${s.color}11`, borderBottom: `1px solid ${s.color}11` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{statusLabel(s, lang)}</div>
              </div>
            ))}
            <div style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: "3px solid #f59e0b", borderTop: "1px solid #f59e0b22", borderRight: "1px solid #f59e0b11", borderBottom: "1px solid #f59e0b11" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{useT("avgRating")}</div>
            </div>
            <div style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${accent}`, borderTop: `1px solid ${accent}22`, borderRight: `1px solid ${accent}11`, borderBottom: `1px solid ${accent}11` }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{items.length}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{useT("totalItems")}</div>
            </div>
            <div style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${accent}99`, borderTop: `1px solid ${accent}22`, borderRight: `1px solid ${accent}11`, borderBottom: `1px solid ${accent}11` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{totalRatings.length}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{lang === "en" ? "Rated" : "Avaliados"}</div>
            </div>
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>{lang === "en" ? "COMPLETED BY TYPE" : "COMPLETOS POR TIPO"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            {MEDIA_TYPES.slice(1).map((t) => {
              const count = byType[t.id] || 0;
              const total = items.filter(i => i.type === t.id).length;
              const pct = total ? (count / total) * 100 : 0;
              if (!total) return null;
              return (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{t.icon} {mediaLabel(t, lang)}</span>
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
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{useT("appearance")}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>

      {/* ── Temas Guardados ── */}
      {(() => {
        const themes = onSavedThemes?.themes || [];
        const getCurrentTheme = () => ({ accent, bgColor, bgColorMobile, sidebarColor, textContrast, textContrastMobile, bgSeparateDevices, darkMode, panelBg, panelOpacity, bgImage, bgImageMobile, bgOverlay, bgBlur, bgParallax });
        const applyTheme = (t) => {
          if (t.accent) onAccentChange(t.accent);
          if (t.bgColor) onBgChange(t.bgColor);
          if (t.bgColorMobile !== undefined) onBgColorMobile(t.bgColorMobile);
          if (t.sidebarColor !== undefined) onSidebarColor(t.sidebarColor);
          if (t.textContrast !== undefined) onTextContrast(t.textContrast);
          if (t.textContrastMobile !== undefined) onTextContrastMobile(t.textContrastMobile);
          if (t.panelBg !== undefined) onPanelBg(t.panelBg);
          if (t.panelOpacity !== undefined) onPanelOpacity(t.panelOpacity);
          if (t.bgOverlay !== undefined) onBgOverlay(t.bgOverlay);
          if (t.bgBlur !== undefined) onBgBlur(t.bgBlur);
          if (t.bgParallax !== undefined) onBgParallax(t.bgParallax);
          // Carregar imagens guardadas separadamente
          try {
            if (t.hasBgImage) { const img = localStorage.getItem(`trackall_theme_img_${t.name}`); onBgImage(img || ""); }
            else onBgImage("");
            // Só restaura imagem mobile se estiver no mobile
            if (isMobileDevice) {
              if (t.hasBgImageMobile) { const img = localStorage.getItem(`trackall_theme_imgm_${t.name}`); onBgImageMobile(img || ""); }
              else onBgImageMobile("");
            }
          } catch {}
        };
        const saveTheme = () => {
          if (!themeName.trim()) return;
          const name = themeName.trim();
          // Guardar imagens separadamente (são grandes)
          try {
            if (bgImage) localStorage.setItem(`trackall_theme_img_${name}`, bgImage);
            if (bgImageMobile) localStorage.setItem(`trackall_theme_imgm_${name}`, bgImageMobile);
          } catch {}
          // Tema sem imagens (ficam no localStorage por chave separada)
          const newTheme = { name, accent, bgColor, bgColorMobile, sidebarColor, textContrast, textContrastMobile, bgSeparateDevices, darkMode, panelBg, panelOpacity, bgOverlay, bgBlur, bgParallax, hasBgImage: !!bgImage, hasBgImageMobile: !!bgImageMobile };
          const updated = [...themes.filter(t => t.name !== name), newTheme];
          onSavedThemes?.save(updated);
          setThemeName("");
        };
        return (
          <div style={{ background: computedPanelBg, border: `1px solid ${accent}33`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: themes.length ? 12 : 6 }}>
              <span style={{ fontSize: 13 }}>🎨</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", flex: 1 }}>{useT("savedThemes")}</span>
              <input value={themeName} onChange={e => setThemeName(e.target.value)} placeholder={useT("themeNamePlaceholder")}
                onKeyDown={e => e.key === "Enter" && saveTheme()}
                style={{ padding: "5px 10px", fontSize: 12, borderRadius: 8, width: 140 }} />
              <button onClick={saveTheme} disabled={!themeName.trim()} style={{ padding: "5px 12px", borderRadius: 8, background: accent, border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: themeName.trim() ? 1 : 0.4 }}>{useT("saveProfile")}</button>
            </div>
            {themes.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {themes.map(t => (
                  <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 4, background: darkMode ? "#21262d" : "#f1f5f9", borderRadius: 20, padding: "4px 4px 4px 10px", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />
                    <button onClick={() => applyTheme(t)} style={{ background: "none", border: "none", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "0 4px 0 2px" }}>{t.name}</button>
                    <button onClick={() => {
                      try { localStorage.removeItem(`trackall_theme_img_${t.name}`); localStorage.removeItem(`trackall_theme_imgm_${t.name}`); } catch {}
                      onSavedThemes?.save(themes.filter(x => x.name !== t.name));
                    }} style={{ background: "none", border: "none", color: "#484f58", fontSize: 11, cursor: "pointer", padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#484f58" }}>{lang === "en" ? "Save your current setup with a name to switch between later." : "Guarda o teu setup atual com um nome para trocar depois."}</p>
            )}
          </div>
        );
      })()}

      <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>

        {/* Sub-secção: CORES */}
        {[
          { key: "cores", label: useT("colorsSection"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("mode")}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => {
                    const hasBg = bgSeparateDevices && isMobileDevice ? bgImageMobile : bgImage;
                    const doChange = () => {
                      if (bgSeparateDevices && isMobileDevice) onBgColorMobile("#0d1117");
                      else { onBgChange("#0d1117"); if (hasBg) onBgImage(""); }
                    };
                    if (hasBg && !(bgSeparateDevices && isMobileDevice)) { if (window.confirm("Mudar o modo vai remover a imagem de fundo. Continuar?")) doChange(); } else doChange();
                  }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: darkMode ? accent : "#21262d", color: darkMode ? "white" : "#8b949e" }}>{useT("nightMode")}</button>
                  <button onClick={() => {
                    const hasBg = bgSeparateDevices && isMobileDevice ? bgImageMobile : bgImage;
                    const doChange = () => {
                      if (bgSeparateDevices && isMobileDevice) onBgColorMobile("#f1f5f9");
                      else { onBgChange("#f1f5f9"); if (hasBg) onBgImage(""); }
                    };
                    if (hasBg && !(bgSeparateDevices && isMobileDevice)) { if (window.confirm("Mudar o modo vai remover a imagem de fundo. Continuar?")) doChange(); } else doChange();
                  }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: !darkMode ? accent : "#21262d", color: !darkMode ? "white" : "#8b949e" }}>{useT("dayMode")}</button>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("accentColor")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {ACCENT_PRESETS.map((p) => (
                    <button key={p.name} onClick={() => onAccentChange(p.color)} style={{ width: 32, height: 32, borderRadius: 999, background: p.color, border: accent === p.color ? "3px solid white" : "3px solid transparent", cursor: "pointer" }} title={p.name} />
                  ))}
                  <label style={{ width: 32, height: 32, borderRadius: 999, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }}>+<input type="color" defaultValue={accent} onBlur={(e) => onAccentChange(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} /></label>
                </div>
              </div>
            </div>
          )},
          { key: "texto", label: useT("textSection"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{bgSeparateDevices ? "PC" : "Geral"}</p>
                  <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{textContrast}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#484f58" }}>{useT("dark")}</span>
                  <input type="range" min={40} max={160} step={5} value={textContrast} onChange={e => onTextContrast(Number(e.target.value))} style={{ flex: 1, accentColor: accent, height: 4, cursor: "pointer" }} />
                  <span style={{ fontSize: 11, color: "#484f58" }}>{useT("light")}</span>
                </div>
                <button onClick={() => onTextContrast(100)} style={{ marginTop: 6, fontSize: 11, color: "#484f58", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>↺ Repor</button>
              </div>
              {bgSeparateDevices && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>📱 Mobile</p>
                    <span style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700 }}>{textContrastMobile}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#484f58" }}>{useT("dark")}</span>
                    <input type="range" min={40} max={160} step={5} value={textContrastMobile} onChange={e => onTextContrastMobile(Number(e.target.value))} style={{ flex: 1, accentColor: "#06b6d4", height: 4, cursor: "pointer" }} />
                    <span style={{ fontSize: 11, color: "#484f58" }}>{useT("light")}</span>
                  </div>
                  <button onClick={() => onTextContrastMobile(100)} style={{ marginTop: 6, fontSize: 11, color: "#484f58", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>↺ Repor</button>
                </div>
              )}
            </div>
          )},
          { key: "fundo", label: useT("bgSection"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Cor de fundo{bgSeparateDevices ? " 🖥 PC" : ""}</p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {BG_PRESETS.map((p) => (<button key={p.name} onClick={() => { onBgChange(p.value); onBgImage(""); }} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: bgColor === p.value && !bgImage ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer" }} title={p.name} />))}
                  <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative", background: bgColor && !BG_PRESETS.find(p => p.value === bgColor) && !bgImage ? bgColor : "transparent" }}>
                    {bgColor && !BG_PRESETS.find(p => p.value === bgColor) && !bgImage ? "" : "+"}
                    <input type="color" value={bgColor} onChange={(e) => { onBgChange(e.target.value); onBgImage(""); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                  </label>
                </div>
              </div>
              {bgSeparateDevices && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{useT("bgColorMobile")}</p>
                    {bgColorMobile && <button onClick={() => onBgColorMobile("")} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕ igual PC</button>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {BG_PRESETS.map((p) => (<button key={p.name} onClick={() => onBgColorMobile(p.value)} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: bgColorMobile === p.value ? "2px solid #06b6d4" : "2px solid #30363d", cursor: "pointer" }} title={p.name} />))}
                    <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative", background: bgColorMobile && !BG_PRESETS.find(p => p.value === bgColorMobile) ? bgColorMobile : "transparent" }}>
                      {bgColorMobile && !BG_PRESETS.find(p => p.value === bgColorMobile) ? "" : "+"}
                      <input type="color" value={bgColorMobile || bgColor} onChange={(e) => onBgColorMobile(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                    </label>
                  </div>
                </div>
              )}
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("bgImage")}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <label style={{ width: 56, height: 56, borderRadius: 10, border: bgImage ? `2px solid ${accent}` : "2px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: bgImage ? `url(${bgImage}) center/cover` : "#21262d", overflow: "hidden", gap: 2 }}>
                      {!bgImage && <><span>🖥</span><span style={{ fontSize: 9, color: "#484f58" }}>PC</span></>}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; const c = await compressImage(file, 1920, 1080, 0.90); if (c) onBgImage(c); }} />
                    </label>
                    {bgImage && <button onClick={() => onBgImage("")} style={{ fontSize: 10, padding: "2px 8px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
                  </div>
                  {bgSeparateDevices && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <label style={{ width: 56, height: 56, borderRadius: 10, border: bgImageMobile ? "2px solid #06b6d4" : "2px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: bgImageMobile ? `url(${bgImageMobile}) center/cover` : "#21262d", overflow: "hidden", gap: 2 }}>
                        {!bgImageMobile && <><span>📱</span><span style={{ fontSize: 9, color: "#484f58" }}>Mobile</span></>}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; const c = await compressImage(file, 1080, 1920, 0.85); if (c) onBgImageMobile(c); }} />
                      </label>
                      {bgImageMobile && <button onClick={() => onBgImageMobile("")} style={{ fontSize: 10, padding: "2px 8px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
                    </div>
                  )}
                </div>
                {(bgImage || bgImageMobile) && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>{useT("overlay")}</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[{ label: "Nenhum", val: "rgba(0,0,0,0)" }, { label: useT("overlaySoft"), val: "rgba(0,0,0,0.3)" }, { label: useT("overlayMid"), val: "rgba(0,0,0,0.55)" }, { label: useT("overlayStrong"), val: "rgba(0,0,0,0.75)" }, { label: useT("overlayWhite"), val: "rgba(255,255,255,0.6)" }].map(o => (
                          <button key={o.label} onClick={() => onBgOverlay(o.val)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${bgOverlay===o.val?accent:"#30363d"}`, background: bgOverlay===o.val?`${accent}22`:"transparent", color: bgOverlay===o.val?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>Desfoque — {bgBlur}px</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[0,2,4,8,12].map(v => (<button key={v} onClick={() => onBgBlur(v)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${bgBlur===v?accent:"#30363d"}`, background: bgBlur===v?`${accent}22`:"transparent", color: bgBlur===v?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{v===0?"Nenhum":`${v}px`}</button>))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>{useT("scroll")}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => onBgParallax(true)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${bgParallax?accent:"#30363d"}`, background: bgParallax?`${accent}22`:"transparent", color: bgParallax?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{useT("parallax")}</button>
                        <button onClick={() => onBgParallax(false)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${!bgParallax?accent:"#30363d"}`, background: !bgParallax?`${accent}22`:"transparent", color: !bgParallax?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{useT("staticScroll")}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )},
          { key: "sidebar", label: useT("sidebarSection"), content: (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{useT("sidebarSection")}</p>
                {sidebarColor && <button onClick={() => onSidebarColor("")} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕ igual ao fundo</button>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <button onClick={() => onSidebarColor("")} style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, border: !sidebarColor ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer", fontSize: 9, color: "#8b949e", fontFamily: "inherit" }} title={useT("sameAsBg")}>≡</button>
                {BG_PRESETS.map((p) => (<button key={p.name} onClick={() => onSidebarColor(p.value)} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: sidebarColor===p.value?`2px solid ${accent}`:"2px solid #30363d", cursor: "pointer" }} title={p.name} />))}
                <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }}>+<input type="color" defaultValue={sidebarColor||bgColor} onBlur={(e) => onSidebarColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} /></label>
              </div>
            </div>
          )},
          { key: "dispositivos", label: useT("devicesSection"), content: (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{useT("separateDevices")}</p>
                <p style={{ fontSize: 11, color: "#484f58" }}>{lang === "en" ? "Different color, image and contrast per device" : "Cor, imagem e contraste diferentes por dispositivo"}</p>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, flexShrink: 0, cursor: "pointer" }}>
                <input type="checkbox" checked={!!bgSeparateDevices} onChange={e => onBgSeparateDevices(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: "absolute", inset: 0, background: bgSeparateDevices ? accent : "#30363d", borderRadius: 22, transition: "background 0.2s" }} />
                <span style={{ position: "absolute", top: 3, left: bgSeparateDevices ? 21 : 3, width: 16, height: 16, background: "white", borderRadius: "50%", transition: "left 0.2s" }} />
              </label>
              <span style={{ fontSize: 12, color: bgSeparateDevices ? accent : "#484f58", fontWeight: bgSeparateDevices ? 700 : 400, flexShrink: 0 }}>{bgSeparateDevices ? "🖥≠📱" : "🖥=📱"}</span>
            </div>
          )},
          { key: "stats", label: useT("statsCards"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("statsCardsColor")}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => { onPanelBg(""); onPanelOpacity(100); }} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: !panelBg ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer", fontSize: 10, color: "#8b949e", fontFamily: "inherit" }}>Auto</button>
                  {["#161b22","#1e293b","#0f172a","#1c1c1e","#0d1117","#ffffff","#f1f5f9","#f6f8fa"].map(c => (
                    <button key={c} onClick={() => onPanelBg(c)} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: panelBg===c ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer" }} title={c} />
                  ))}
                  <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative", background: panelBg && !["#161b22","#1e293b","#0f172a","#1c1c1e","#0d1117","#ffffff","#f1f5f9","#f6f8fa"].includes(panelBg) ? panelBg : "transparent" }}>
                    {panelBg && !["#161b22","#1e293b","#0f172a","#1c1c1e","#0d1117","#ffffff","#f1f5f9","#f6f8fa"].includes(panelBg) ? "" : "+"}
                    <input type="color" value={panelBg || "#161b22"} onChange={(e) => onPanelBg(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                  </label>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{useT("panelOpacity")}</p>
                  <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{panelOpacity ?? 100}%</span>
                </div>
                <input type="range" min={0} max={100} value={panelOpacity ?? 100}
                  onChange={e => onPanelOpacity(Number(e.target.value))}
                  style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#484f58", marginTop: 2 }}>
                  <span>Transparente</span><span>Sólido</span>
                </div>
              </div>
            </div>
          )},
        ].map(({ key, label, content }) => (
          <div key={key} style={{ borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
            <button onClick={() => toggleAppear(key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: appearSections[key] ? accent : (darkMode ? "#c9d1d9" : "#374151") }}>{label}</span>
              <span style={{ fontSize: 12, color: "#484f58", transform: appearSections[key] ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
            </button>
            {appearSections[key] && <div style={{ padding: "0 16px 16px" }}>{content}</div>}
          </div>
        ))}

      </div>

      {/* Mihon Modal */}
      {showMihon && (
        <MihonImportModal
         
         
          onClose={() => setShowMihon(false)}
          onImport={(items) => { onImportMihon && onImportMihon(items); setShowMihon(false); }}
        />
      )}

      {/* Modais Paperback e Letterboxd */}
      {showPaperback && (
        <PaperbackImportModal
         
          onClose={() => setShowPaperback(false)}
          onImport={(items) => { onImportPaperback && onImportPaperback(items); setShowPaperback(false); }}
        />
      )}
      {showLetterboxd && (
        <LetterboxdImportModal
         
          onClose={() => setShowLetterboxd(false)}
          onImport={(items) => { onImportLetterboxd && onImportLetterboxd(items); setShowLetterboxd(false); }}
        />
      )}

      {/* ── Import ── */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{lang === "en" ? "IMPORT" : "IMPORTAR"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📚</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Mihon</p>
            <p style={{ fontSize: 12, color: "#8b949e" }}>{lang === "en" ? "Library, progress and reading status" : "Biblioteca, progresso e estado de leitura"}</p>
          </div>
          <button onClick={() => setShowMihon(true)} className="btn-accent" style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>
            {lang === "en" ? "Import" : "Importar"}
          </button>
        </div>
        {/* Divider */}
        <div style={{ borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, margin: "10px 0" }} />
        {/* Paperback */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>📖</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Paperback <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— iOS manga e comics</span></p>
          </div>
          <button onClick={() => setShowPaperback(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>{lang === "en" ? "Import" : "Importar"}</button>
        </div>
        {/* Letterboxd */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>🎬</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Letterboxd <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— filmes vistos</span></p>
          </div>
          <button onClick={() => setShowLetterboxd(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, background: "#00e05422", border: "1px solid #00e05444", color: "#00e054", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{useT("importMihon").replace("Import Mihon","Import").replace("Importar Mihon","Importar")}</button>
        </div>
      </div>


      {/* API Status */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{lang === "en" ? "API SETTINGS" : "CONFIGURAÇÕES API"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: "#161b22", border: "1px solid #10b98133", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>✓ Tudo configurado automaticamente</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "⛩", label: "Anime/Manga", sub: "AniList" },
            { icon: "📚", label: useT("livros"), sub: "Google Books" },
            { icon: "🎮", label: useT("jogos"), sub: "IGDB + Steam" },
            { icon: "🎬", label: "Filmes/Séries", sub: "TMDB" },
            { icon: "💬", label: useT("comics"), sub: "ComicVine" },
            { icon: "🇰🇷", label: "Manhwa/LN", sub: "AniList" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0d1117", border: "1px solid #10b98122", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}><span style={{ color: "#10b981" }}>✓ </span>{s.icon} {statusLabel(s, lang)}</div>
              <div style={{ color: "#484f58", fontSize: 11, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {/* TMDB Attribution */}
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
        <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("language")}</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>PT / EN</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["pt", "en"].map(l => (
                <button key={l} onClick={() => onChangeLang(l)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${lang === l ? accent : "#30363d"}`, background: lang === l ? `${accent}22` : "transparent", color: lang === l ? accent : "#8b949e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {l === "pt" ? "🇵🇹 PT" : "🇬🇧 EN"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("privacy")}</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>Como tratamos os teus dados · RGPD</p>
            </div>
            <a href="https://raw.githubusercontent.com/mcmeskajr-prog/trackall/main/public/privacy.pdf" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}44`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
              Ver PDF →
            </a>
          </div>
          <div style={{ height: 1, background: darkMode ? "#21262d" : "#e8e0d5" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("version")}</p>
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
                      {deleting ? useT("deleting") : "Sim, apagar tudo"}
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
      </div> {/* fim wrapper tab perfil */}

      {/* Tab Completos */}
      {profileTab === "completos" && (
        <ProfileTabCompletos items={items} library={library} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={onOpen} />
      )}

      {/* Tab Diário */}
      {profileTab === "diario" && (
        <ProfileTabDiario items={items} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={onOpen} />
      )}


      {/* Tab Tier Lists */}
      {profileTab === "tierlists" && (
        <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#484f58" }}>{userTierlists.length} tier lists</p>
            <button onClick={onCreateTierlist} className="btn-accent" style={{ padding: "8px 18px", fontSize: 13 }}>
              + Nova Tier List
            </button>
          </div>
          {userTierlists.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
              <p style={{ color: "#484f58", fontSize: 14, marginBottom: 20 }}>Cria a tua primeira tier list!</p>
              <button onClick={onCreateTierlist} className="btn-accent" style={{ padding: "10px 24px", fontSize: 14 }}>
                + Criar Tier List
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {userTierlists.map(tl => (
                <TierListCard
                  key={tl.id} tl={tl}
                  onOpen={onViewTierlist}
                  onLike={onLikeTierlist}
                  liked={userLikes.includes(tl.id)}
                  currentUserId={currentUserId}
                  onDelete={onDeleteTierlist}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Listas */}
      {profileTab === "listas" && (
        <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#484f58" }}>{(userCollections || []).length} {(userCollections || []).length === 1 ? "lista" : "listas"}</p>
            <button onClick={onCreateCollection} className="btn-accent" style={{ padding: "8px 18px", fontSize: 13 }}>
              + Nova Lista
            </button>
          </div>
          {(userCollections || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p style={{ color: "#484f58", fontSize: 14, marginBottom: 20 }}>Cria a tua primeira lista!</p>
              <button onClick={onCreateCollection} className="btn-accent" style={{ padding: "10px 24px", fontSize: 14 }}>
                + Criar Lista
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {(userCollections || []).map(col => (
                <CollectionCard
                  key={col.id} col={col}
                  onOpen={onViewCollection}
                  onLike={onLikeCollection}
                  liked={(userCollectionLikes || []).includes(col.id)}
                  currentUserId={currentUserId}
                  onDelete={onDeleteCollection}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
function FeedTab({ accepted, getFriendInfo }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
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
      <p style={{ color: "#484f58", fontSize: 14 }}>{lang === "en" ? "Add friends to see activity here." : "Adiciona amigos para ver a atividade aqui."}</p>
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
      <p style={{ color: "#484f58", fontSize: 14 }}>{lang === "en" ? "No recent activity from your friends yet." : "Ainda não há atividade recente dos teus amigos."}</p>
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
                    {mediaLabel(mt, lang)}
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

function FriendsView({user, accent, darkMode = true, isMobileDevice = false, library = {} }) {
  const { lang, useT } = useLang();
  const [tab, setTab] = useState("friends"); // friends | search | requests
  const [friendships, setFriendships] = useState([]);
  const [friendTab, setFriendTab] = useState("perfil");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [showAllDiary, setShowAllDiary] = useState(false);
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

  const accepted = useMemo(() => friendships.filter(f => f.status === "accepted"), [friendships]);
  const pending = useMemo(() => friendships.filter(f => f.status === "pending" && f.addressee_id === user.id), [friendships, user.id]);
  const sent = useMemo(() => friendships.filter(f => f.status === "pending" && f.requester_id === user.id), [friendships, user.id]);

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
    showNotif(useT("friendAdded"));
    await loadFriendships();
  };

  const handleDecline = async (fId) => {
    await supa.declineFriendRequest(fId);
    await loadFriendships();
  };

  const handleRemove = async (f) => {
    await supa.removeFriend(f.requester_id, f.addressee_id);
    showNotif(useT("friendRemoved"));
    await loadFriendships();
    setSelectedFriend(null);
  };

  const openFriendProfile = async (friendId, friendInfo) => {
    setSelectedFriend(friendInfo);
    const [prof, lib] = await Promise.all([supa.getFriendProfile(friendId), supa.getFriendLibrary(friendId)]);
    setFriendData({ profile: prof, library: lib });
    setFriendTab("perfil");
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

        {/* Banner + Avatar — Voltar sobreposto */}
        <div style={{ position: "relative", marginBottom: 56 }}>
          <div style={{
            height: 220, position: "relative", overflow: "hidden",
            background: friendData.profile?.banner
              ? `url(${friendData.profile.banner}) center/cover no-repeat`
              : fBgImage ? "transparent" : fBgColor,
          }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
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
            {/* Botão Voltar sobreposto no banner */}
            <button onClick={() => { setSelectedFriend(null); setFriendData(null); }} style={{
              position: "absolute", top: 14, left: 14, zIndex: 10,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              border: `1px solid rgba(255,255,255,0.2)`, color: "white",
              cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "6px 14px",
              borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
            }}>{useT("back")}</button>
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
        <div style={ !isMobileDevice ? { display: "flex", gap: 20, padding: "0 24px", alignItems: "flex-start", overflow: "hidden" } : {}}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `1px solid ${fDark ? "#21262d" : "#e2e8f0"}`, marginBottom: 0 }}>
          {["perfil","completos","diario"].map(tab => (
            <button key={tab} onClick={() => setFriendTab(tab)} style={{
              flex: 1, padding: isMobileDevice ? "10px 4px" : "12px 20px",
              background: "none", border: "none",
              borderBottom: friendTab === tab ? `2px solid ${fAccent}` : "2px solid transparent",
              color: friendTab === tab ? fAccent : "#484f58",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: isMobileDevice ? 11 : 13,
              fontWeight: friendTab === tab ? 700 : 500,
              marginBottom: -1, whiteSpace: "nowrap",
            }}>
              {tab === "perfil" ? useT("tabPerfil") : tab === "completos" ? useT("tabCompletos") : useT("tabDiario")}
            </button>
          ))}
        </div>

        {/* ── TAB: PERFIL ── */}
        <div style={{ display: friendTab === "perfil" ? "block" : "none" }}>

        {/* Stats */}
        <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
            {STATUS_OPTIONS.slice(0,3).map(s => (
              <div key={s.id} style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${s.color}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{statusLabel(s, lang)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {STATUS_OPTIONS.slice(3).map(s => (
              <div key={s.id} style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${s.color}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{statusLabel(s, lang)}</div>
              </div>
            ))}
            <div style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid #f59e0b33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>★ Média</div>
            </div>
            <div style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${fAccent}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: fAccent }}>{libItems.length}</div>
              <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{useT("totalItems")}</div>
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
                <h3 style={{ fontSize: 11, fontWeight: 800, color: fAccent, letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("inCommon").toUpperCase()}</h3>
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
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("favorites").toUpperCase()}</h3>
                <span style={{ fontSize: 10, fontWeight: 800, color: fAccent, background: `${fAccent}18`, padding: "1px 7px", borderRadius: 20 }}>{favs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activeTypes.map(t => {
                  const tc = TYPE_COLORS[t.id] || fAccent;
                  return (
                    <div key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, textTransform: "uppercase", letterSpacing: "0.1em" }}>{mediaLabel(t, lang)}</span>
                        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${tc}55, transparent)` }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, background: `${tc}18`, padding: "1px 7px", borderRadius: 20 }}>{favByType[t.id].length}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 120px))", gap: 8, maxWidth: 520, margin: "0 auto" }}>
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
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("completedLabel").toUpperCase()}</h3>
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
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("inProgressLabel").toUpperCase()}</h3>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {inCurso.slice(0, 15).map(item => <FriendCard key={item.id} item={item} size={90} />)}
            </div>
          </div>
        )}

        </div>
        {/* Coluna direita — diário com mês atual + ver mais (só no PC na tab perfil) */}
        {!isMobileDevice && friendTab === "perfil" && (() => {
          const fCompletados = libItems.filter(i => i.userStatus === "completo" && i.addedAt).sort((a,b) => b.addedAt - a.addedAt);
          if (!fCompletados.length) return null;
          const now = new Date();
          const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2,"0")}`;
          const groups = {};
          fCompletados.forEach(item => {
            const d = new Date(item.addedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
            if (!groups[key]) groups[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
            groups[key].items.push({ ...item, _day: d.getDate() });
          });
          const sortedGroups = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
          // Mostrar mês atual + mês anterior se existir; resto com "Ver mais"
          const visibleGroups = showAllDiary ? sortedGroups : sortedGroups.slice(0, 2);
          return (
            <div style={{ width: 240, flexShrink: 0, borderLeft: `1px solid ${fDark ? "#21262d" : "#e2e8f0"}`, paddingLeft: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("diary").toUpperCase()}</h3>
                <span style={{ fontSize: 11, color: "#484f58" }}>{fCompletados.length}</span>
              </div>
              {visibleGroups.map(group => (
                <div key={group.key} style={{ display: "flex", marginBottom: 16 }}>
                  <div style={{ flexShrink: 0, width: 46, marginRight: 10 }}>
                    <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
                      <div style={{ background: "#30363d", padding: "3px 0", fontSize: 9, fontWeight: 800, color: "#e6edf3", letterSpacing: 1 }}>{group.year}</div>
                      <div style={{ padding: "3px 0 4px", fontSize: 14, fontWeight: 900, color: "#8b949e" }}>{(lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: idx < arr.length-1 ? `1px solid ${fDark ? "#21262d" : "#e2e8f0"}` : "none" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#484f58", width: 12, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                        {(item.cover || item.thumbnailUrl) ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 20, height: 28, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} onError={e => e.currentTarget.style.display="none"} /> : <div style={{ width: 20, height: 28, borderRadius: 3, background: gradientFor(item.id), flexShrink: 0 }} />}
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: fDark ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                        {item.userRating > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, flexShrink: 0 }}>★{item.userRating}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {sortedGroups.length > 2 && (
                <button onClick={() => setShowAllDiary(v => !v)} style={{ width: "100%", background: "none", border: `1px solid ${fAccent}44`, borderRadius: 8, color: fAccent, fontSize: 11, fontWeight: 700, padding: "6px 0", cursor: "pointer", fontFamily: "inherit" }}>
                  {showAllDiary ? "↑ Menos" : `Ver tudo (${fCompletados.length} entradas)`}
                </button>
              )}
            </div>
          );
        })()}
        </div>{/* fim layout PC */}
        </div> {/* fim tab perfil */}

        {/* Tab Completos do amigo */}
        {friendTab === "completos" && (
          <ProfileTabCompletos
            items={libItems} library={friendData.library} accent={fAccent}
            darkMode={fDark} isMobileDevice={isMobileDevice} lang={lang}
            onOpen={null}
          />
        )}

        {/* Tab Diário do amigo */}
        {friendTab === "diario" && (
          <ProfileTabDiario
            items={libItems} accent={fAccent}
            darkMode={fDark} isMobileDevice={isMobileDevice} lang={lang}
            onOpen={null}
          />
        )}

        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: isMobileDevice ? 600 : 860, margin: "0 auto", padding: isMobileDevice ? "16px 0 20px" : "24px 28px 20px", minHeight: "100vh" }}>
      {notif && <div style={{ margin: "0 16px 12px", padding: "10px 14px", background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 10, fontSize: 13, color: accent, textAlign: "center" }}>{notif}</div>}

      {/* Tabs */}
      <div className="tabs-scroll" style={{ display: "flex", gap: 8, padding: "0 16px", marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { id: "feed", label: "🕐 Feed" },
          { id: "friends", label: `${lang === "en" ? "Friends" : "Amigos"} (${accepted.length})` },
          { id: "search", label: useT("searchFriends") },
          { id: "requests", label: `${lang === "en" ? "Requests" : "Pedidos"}${pending.length > 0 ? ` (${pending.length})` : ""}` },
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
      {tab === "feed" && <FeedTab accepted={accepted} getFriendInfo={getFriendInfo} />}

      {/* Friends list */}
      {tab === "friends" && (
        <div style={{ padding: "0 16px" }}>
          {loading ? <p style={{ color: "#484f58", textAlign: "center" }}>{useT("loading")}</p>
          : accepted.length === 0 ? <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>{lang === "en" ? "No friends yet. Search by name or username!" : "Ainda não tens amigos. Pesquisa pelo nome ou username!"}</p>
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
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>✓ {lang === "en" ? "Friends" : "Amigos"}</span>
                ) : fs.isRequester ? (
                  <span style={{ fontSize: 12, color: "#484f58" }}>{lang === "en" ? "Pending" : "Pendente"}</span>
                ) : (
                  <button onClick={() => handleAccept(fs.id)} style={{ padding: "6px 12px", background: "#10b98122", border: "1px solid #10b98144", borderRadius: 8, color: "#10b981", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>{lang === "en" ? "Accept" : "Aceitar"}</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Requests */}
      {tab === "requests" && (
        <div style={{ padding: "0 16px" }}>
          {pending.length === 0 && sent.length === 0 && <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>{lang === "en" ? "No pending requests." : "Sem pedidos pendentes."}</p>}
          {pending.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8 }}>{lang === "en" ? "INCOMING REQUESTS" : "PEDIDOS RECEBIDOS"}</p>
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
              <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, marginTop: 16 }}>{lang === "en" ? "SENT REQUESTS" : "PEDIDOS ENVIADOS"}</p>
              {sent.map(f => {
                const info = f.addressee;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{info?.name || "Utilizador"}</p>
                    </div>
                    <span style={{ fontSize: 12, color: "#484f58" }}>{lang === "en" ? "Waiting..." : "Aguarda..."}</span>
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
// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_LIBRARY = {
  "al-1": { id: "al-1", title: "Attack on Titan", type: "anime", userStatus: "completo", userRating: 10, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg", addedAt: Date.now() - 86400000 * 2 },
  "al-2": { id: "al-2", title: "Demon Slayer", type: "anime", userStatus: "assistindo", userRating: 9, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg", addedAt: Date.now() - 86400000 * 4 },
  "al-3": { id: "al-3", title: "Tokyo Ghoul", type: "manga", userStatus: "completo", userRating: 9, cover: "https://cdn.myanimelist.net/images/manga/3/258224l.jpg", addedAt: Date.now() - 86400000 * 6 },
  "al-4": { id: "al-4", title: "Jujutsu Kaisen", type: "anime", userStatus: "planeado", userRating: 0, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg", addedAt: Date.now() - 86400000 * 8 },
  "al-5": { id: "al-5", title: "One Piece", type: "manga", userStatus: "assistindo", userRating: 10, cover: "https://cdn.myanimelist.net/images/manga/2/253146l.jpg", addedAt: Date.now() - 86400000 * 10 },
  "al-6": { id: "al-6", title: "Chainsaw Man", type: "manga", userStatus: "completo", userRating: 9, cover: "https://cdn.myanimelist.net/images/manga/3/216464l.jpg", addedAt: Date.now() - 86400000 * 12 },
  "tmdb-1": { id: "tmdb-1", title: "Oppenheimer", type: "filmes", userStatus: "completo", userRating: 9, cover: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", addedAt: Date.now() - 86400000 * 3 },
  "tmdb-2": { id: "tmdb-2", title: "Breaking Bad", type: "series", userStatus: "completo", userRating: 10, cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", addedAt: Date.now() - 86400000 * 5 },
  "tmdb-3": { id: "tmdb-3", title: "Dune: Part Two", type: "filmes", userStatus: "completo", userRating: 9, cover: "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg", addedAt: Date.now() - 86400000 * 1 },
  "tmdb-4": { id: "tmdb-4", title: "The Last of Us", type: "series", userStatus: "completo", userRating: 10, cover: "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", addedAt: Date.now() - 86400000 * 11 },
  "game-1": { id: "game-1", title: "Elden Ring", type: "jogos", userStatus: "completo", userRating: 10, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg", addedAt: Date.now() - 86400000 * 7 },
  "game-2": { id: "game-2", title: "Hollow Knight", type: "jogos", userStatus: "completo", userRating: 9, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg", addedAt: Date.now() - 86400000 * 14 },
};
const DEMO_PROFILE = { name: "Demo User", bio: "A explorar o TrackAll ✨", avatar: "", accent: "#f97316", favorites: [
  { id: "al-1", title: "Attack on Titan", type: "anime", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg" },
  { id: "tmdb-2", title: "Breaking Bad", type: "series", cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
  { id: "game-1", title: "Elden Ring", type: "jogos", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg" },
]};
const DEMO_FEED = [
  { user: "mrdk", avatar: "", action: "completou", item: "Chainsaw Man", type: "manga", rating: 9, time: "há 2h" },
  { user: "shutw", avatar: "", action: "adicionou à biblioteca", item: "Frieren", type: "anime", rating: 0, time: "há 5h" },
  { user: "wmans", avatar: "", action: "completou", item: "The Last of Us", type: "series", rating: 10, time: "há 1d" },
  { user: "mrdk", avatar: "", action: "avaliou", item: "Oppenheimer", type: "filmes", rating: 8, time: "há 1d" },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ accent, onEnter, onDemo, lang = "en", useT = (k) => k, changeLang }) {
  const accentRgb = `${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}`;
  const features = [
    { icon: "📚", title: useT("feature1Title"), desc: "Anime, manga, filmes, séries, jogos, livros, comics e mais — numa biblioteca unificada." },
    { icon: "⭐", title: useT("feature2Title"), desc: "Sistema de rating, estados personalizados e diário com histórico de tudo o que concluíste." },
    { icon: "👥", title: useT("feature3Title"), desc: "Segue amigos, vê o que estão a ver e descobre nova mídia através do feed de atividade." },
    { icon: "🎨", title: useT("feature4Title"), desc: "Cores, fundos, sidebar — personaliza a app ao teu gosto e guarda múltiplos temas." },
    { icon: "📊", title: useT("feature5Title"), desc: "Vê quantos completaste, a tua média de rating e o teu histórico por mês no diário." },
    { icon: "🔍", title: useT("feature6Title"), desc: "Pesquisa em AniList, TMDB, IGDB, Google Books e ComicVine ao mesmo tempo." },
    { icon: "🏆", title: "Tier Lists", desc: "Cria e partilha tier lists da tua mídia favorita. Arrasta, ordena e dá like nas listas da comunidade." },
    { icon: "🎭", title: "Personagens & Cast", desc: "Vê o elenco completo, personagens, voice actors e explora a filmografia de cada ator ou realizador." },
  ];
  const mediaTypes = ["🎌 Anime", "📖 Manga", "🎬 Filmes", "📺 Séries", "🎮 Jogos", "📚 Livros", "🇰🇷 Manhwa", "💬 Comics"];

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'Outfit', 'Segoe UI', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradAnim { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        .land-fade { animation: fadeUp 0.7s ease forwards; }
        .land-float { animation: float 4s ease-in-out infinite; }
        .land-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 40px rgba(${accentRgb},0.5) !important; }
        .land-btn2:hover { transform: translateY(-2px) !important; background: rgba(255,255,255,0.12) !important; }
        .feat-card:hover { transform: translateY(-4px); border-color: ${accent}55 !important; }
        .feat-card { transition: all 0.2s; }
      `}</style>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid #21262d", position: "sticky", top: 0, background: "rgba(13,17,23,0.9)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white" }}>T</div>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#e6edf3", letterSpacing: "-0.5px" }}>TrackAll</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onDemo} className="land-btn2" style={{ padding: "9px 20px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>{useT("landingDemoBtn")}</button>
          <button onClick={onEnter} className="land-btn" style={{ padding: "9px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 4px 20px rgba(${accentRgb},0.3)` }}>{useT("signIn")}</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "100px 20px 80px", position: "relative", overflow: "hidden" }}>
        {/* Glow blobs */}
        <div style={{ position: "absolute", top: -100, left: "20%", width: 500, height: 500, background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 50, right: "10%", width: 300, height: 300, background: `radial-gradient(circle, #8b5cf620 0%, transparent 70%)`, pointerEvents: "none", animation: "pulse 4s ease-in-out infinite" }} />

        <div className="land-fade" style={{ animationDelay: "0.1s", opacity: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${accent}18`, border: `1px solid ${accent}44`, borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: accent, marginBottom: 28, letterSpacing: "0.05em" }}>
          </div>
        </div>
        <div className="land-fade" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: 24, background: `linear-gradient(135deg, #e6edf3 30%, ${accent} 70%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Toda a tua mídia.<br/>Num só lugar.
          </h1>
        </div>
        <div className="land-fade" style={{ animationDelay: "0.35s", opacity: 0 }}>
          <p style={{ fontSize: 20, color: "#8b949e", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7, fontWeight: 400 }}>
            Anime, manga, filmes, séries, jogos, livros e comics — acompanha tudo, avalia, partilha com amigos.
          </p>
        </div>
        <div className="land-fade" style={{ animationDelay: "0.5s", opacity: 0, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onEnter} className="land-btn" style={{ padding: "16px 40px", borderRadius: 14, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 16, fontWeight: 800, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 8px 32px rgba(${accentRgb},0.4)` }}>
            Começar grátis →
          </button>
          <button onClick={onDemo} className="land-btn2" style={{ padding: "16px 36px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
            Ver demonstração
          </button>
        </div>

        {/* Media type pills */}
        <div className="land-fade" style={{ animationDelay: "0.7s", opacity: 0, marginTop: 56, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 600, margin: "56px auto 0" }}>
          {mediaTypes.map((m, i) => (
            <span key={m} style={{ padding: "8px 18px", borderRadius: 20, background: "#161b22", border: "1px solid #21262d", fontSize: 13, fontWeight: 600, color: "#8b949e", animation: `float ${3 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}>{m}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "0 20px 40px", maxWidth: 900, margin: "0 auto" }}>
        {/* Screenshot da app */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${accent}33`, boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px #21262d`, background: "#161b22", position: "relative" }}>
          <div style={{ background: "#161b22", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #21262d" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#ef4444", opacity: 0.7 }} />
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#eab308", opacity: 0.7 }} />
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#10b981", opacity: 0.7 }} />
            <span style={{ fontSize: 11, color: "#484f58", marginLeft: 8 }}>trackall.app</span>
          </div>
          <img src="/og-image.png" alt="TrackAll app screenshot" style={{ width: "100%", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "40px 20px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px", marginBottom: 12 }}>{lang === "en" ? "Everything you need" : "Tudo o que precisas"}</h2>
          <p style={{ color: "#484f58", fontSize: 16 }}>{lang === "en" ? "Made for those who take media seriously" : "Feito para quem leva a mídia a sério"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} className="feat-card" style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: "28px 24px" }}>
              <div style={{ width: 48, height: 48, background: `${accent}18`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#e6edf3", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", background: `linear-gradient(135deg, ${accent}18 0%, #8b5cf618 100%)`, border: `1px solid ${accent}33`, borderRadius: 24, padding: "60px 40px" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px", marginBottom: 16 }}>{useT("landingReadyTitle")}</h2>
          <p style={{ color: "#8b949e", fontSize: 16, marginBottom: 36, lineHeight: 1.6 }}>Cria a tua conta gratuita e começa a organizar a tua biblioteca hoje.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onEnter} className="land-btn" style={{ padding: "14px 36px", borderRadius: 12, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 6px 24px rgba(${accentRgb},0.35)` }}>
              Criar conta grátis
            </button>
            <button onClick={onDemo} className="land-btn2" style={{ padding: "14px 28px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
              Ver demo primeiro
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #21262d", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "white" }}>T</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#484f58" }}>TrackAll</span>
        </div>
        <span style={{ fontSize: 12, color: "#30363d" }}>{useT("landingMadeWith")}</span>
      </footer>
    </div>
  );
}

// ─── Recommendations ──────────────────────────────────────────────────────────
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

async function fetchAniListSafe(urls, body) {
  // Tenta todas as URLs em paralelo, retorna o primeiro resultado válido
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

async function fetchTrendingAnime(workerUrl) {
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

async function fetchTrendingManga(workerUrl) {
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

async function fetchTrendingMovies(tmdbKey, workerUrl) {
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

async function fetchTrendingSeries(tmdbKey, workerUrl) {
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

// ─── Personalized Recommendations ────────────────────────────────────────────
async function fetchPersonalizedRecos(library, workerUrl) {
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

// ─── Recommendation Carousel ──────────────────────────────────────────────────
function RecoCarousel({ title, icon, items, library, onOpen, loading, isPersonal }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  // Skeleton só se loading E sem dados ainda — se já há dados, mostra mesmo durante refresh
  if (loading && !isPersonal && (!items || items.length === 0)) return (
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
  const toShow = items.filter(i => !findLibraryEntry(library, i.id, i.type));
  if (toShow.length === 0) return null;

  return (
    <div style={{ padding: "0 16px 28px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{icon} {title}</h2>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {toShow.map(item => (
          <div key={item.id}
            onClick={() => onOpen(item)}
            style={{ flexShrink: 0, width: 100, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            onMouseEnter={e => { const img = e.currentTarget.querySelector(".reco-img"); if(img) img.style.transform="scale(1.05)"; const ov = e.currentTarget.querySelector(".reco-overlay"); if(ov) ov.style.opacity="1"; }}
            onMouseLeave={e => { const img = e.currentTarget.querySelector(".reco-img"); if(img) img.style.transform="scale(1)"; const ov = e.currentTarget.querySelector(".reco-overlay"); if(ov) ov.style.opacity="0"; }}>
            <div style={{ width: 100, height: 148, borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), marginBottom: 6, position: "relative" }}>
              {item.cover
                ? <img className="reco-img" src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s ease", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, pointerEvents: "none" }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
              }
              <div className="reco-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s", borderRadius: 10, pointerEvents: "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                </div>
              </div>
              {(() => {
                const libItem = findLibraryEntry(library, item.id, item.type)?.item;
                const score = libItem?.userRating > 0 ? libItem.userRating : item.score;
                return score > 0 ? (
                  <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.75)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700, pointerEvents: "none" }}>
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
function LibGroupedList({ items, library, onOpen }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();

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
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: darkMode ? "#8b949e" : "#64748b" }}>{mediaLabel(t, lang)}</span>
            <span style={{ fontSize: 10, color: accent, background: `${accent}18`, padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{gItems.length}</span>
            <span style={{ marginLeft: "auto", color: "#484f58", fontSize: 13, transform: collapsed[t.id] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
          </button>
          {!collapsed[t.id] && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {gItems.map(item => {
                const libItem = findLibraryEntry(library, item.id, item.type)?.item;
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
function PaperbackImportModal({ onClose, onImport }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
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
  const statusLabelLocal = (id) => { const s = STATUS_OPTIONS.find(x=>x.id===id); return s ? `${s.emoji} ${statusLabel(s,lang)}` : id; };
  const typeIcon = { manga: '🗒', comics: '💬' };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📖</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{lang === "en" ? "Import from Paperback" : "Importar do Paperback"}</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{step === 'preview' ? `${items.length} itens encontrados` : 'Backup iOS'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: darkMode ? '#0d1117' : '#f8fafc', borderRadius: 12, padding: 20, textAlign: 'center', border: `2px dashed ${darkMode ? '#30363d' : '#e2e8f0'}`, marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{lang === "en" ? "Select backup file" : "Seleciona o ficheiro de backup"}</p>
              <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>Ficheiro .zip ou .pas4 exportado pelo Paperback</p>
              <input ref={fileRef} type="file" accept=".zip,.pas4" onChange={handleFile} style={{ display: 'none' }} />
              <button className="btn-accent" onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', fontSize: 13 }}>
                {loading ? '⏳ A processar...' : 'Escolher ficheiro .zip'}
              </button>
            </div>
            <div style={{ background: darkMode ? '#161b2288' : '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
              💡 <strong>Como exportar do Paperback:</strong><br />
              Paperback → <strong>{lang === "en" ? "Settings" : "Definições"}</strong> → <strong>Backup</strong> → <strong>{lang === "en" ? "Create Backup" : "Criar Backup"}</strong> → {lang === "en" ? "share the .zip file" : "partilhar o ficheiro .zip"}
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)}  style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>{useT("all")}</button>
                <button onClick={() => toggleAll(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{useT("overlayNone")}</button>
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
                  <span style={{ fontSize: 10, color: statusColor[item.userStatus], fontWeight: 700, flexShrink: 0 }}>{statusLabelLocal(item.userStatus)}</span>
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
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{lang === "en" ? "Import complete!" : "Importação concluída!"}</p>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>{lang === "en" ? "Your Paperback items are now in your library." : "Os teus itens do Paperback já estão na biblioteca."}</p>
            <button onClick={onClose} className="btn-accent" style={{ padding: '10px 28px', fontSize: 14 }}>{lang === "en" ? "Close" : "Fechar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Letterboxd Import Modal ──────────────────────────────────────────────────
function LetterboxdImportModal({ onClose, onImport }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
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
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{lang === "en" ? "Import from Letterboxd" : "Importar do Letterboxd"}</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{step === 'preview' ? `${items.length} filmes encontrados` : 'CSV de filmes vistos'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: darkMode ? '#0d1117' : '#f8fafc', borderRadius: 12, padding: 20, textAlign: 'center', border: `2px dashed ${darkMode ? '#30363d' : '#e2e8f0'}`, marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎞️</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{lang === "en" ? "Select CSV file" : "Seleciona o ficheiro CSV"}</p>
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
                <button onClick={() => toggleAll(true)}  style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>{useT("all")}</button>
                <button onClick={() => toggleAll(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{useT("overlayNone")}</button>
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
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{lang === "en" ? "Import complete!" : "Importação concluída!"}</p>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>{lang === "en" ? "Your Letterboxd films are now in your library." : "Os teus filmes do Letterboxd já estão na biblioteca."}</p>
            <button onClick={onClose} style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}>{lang === "en" ? "Close" : "Fechar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function RatingOverlay({ item, library, onDone }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
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
            <div style={{ fontSize: 12, color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#8b949e", marginBottom: 16 }}>{lang === "en" ? "Want to rate it?" : "Queres dar uma avaliação?"}</p>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <StarRating value={rating} onChange={setRating} size={isMobileDevice ? 22 : 26} />
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

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth, accent, onBack, lang = "en", useT = (k) => k }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const accentRgb = `${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}`;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError("Preenche todos os campos."); return; }
    if (password.length < 6) { setError("A password deve ter pelo menos 6 caracteres."); return; }
    if (mode === "register" && !inviteCode.trim()) { setError("Precisas de um código de convite para criar conta."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (mode === "register") {
        // Verificar código de convite
        const { data: codeData, error: codeError } = await supabase
          .from("invite_codes")
          .select("id, used_by")
          .eq("code", inviteCode.trim().toUpperCase())
          .single();
        if (codeError || !codeData) { setError("Código de convite inválido."); setLoading(false); return; }
        if (codeData.used_by) { setError("Este código de convite já foi utilizado."); setLoading(false); return; }
        // Criar conta
        const { user: u } = await supa.signUp(email.trim(), password);
        // Marcar código como usado
        if (u) {
          await supabase.from("invite_codes").update({ used_by: u.id, used_at: new Date().toISOString() }).eq("id", codeData.id);
          onAuth(u);
        } else {
          // Email verification pendente — marcar após verificação não é possível agora, mas o código fica reservado
          await supabase.from("invite_codes").update({ used_at: new Date().toISOString() }).eq("id", codeData.id);
          setAwaitingVerification(true);
          setSuccess(`Email de confirmação enviado para ${email.trim()}.`);
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
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', 'Segoe UI', sans-serif", position: "relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');`}</style>
      {onBack && <button onClick={onBack} style={{ position: "absolute", top: 20, left: 20, background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>{useT("back")}</button>}
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "white", marginBottom: 16 }}>T</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px" }}>TrackAll</h1>
          <p style={{ color: "#484f58", fontSize: 14, marginTop: 6 }}>{useT("landingTagline")}</p>
        </div>
        {awaitingVerification ? (
          <div style={{ background: "#161b22", border: `1px solid ${accent}44`, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#e6edf3", marginBottom: 12 }}>{useT("verifyEmail")}</h2>
            <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Enviámos um link de confirmação para<br/>
              <strong style={{ color: accent }}>{email}</strong>
            </p>
            <p style={{ color: "#484f58", fontSize: 12, marginBottom: 24 }}>Clica no link no email para ativar a tua conta. Verifica também a pasta de spam.</p>
            <button onClick={() => { setAwaitingVerification(false); setMode("login"); setSuccess(""); }} style={{ padding: "10px 24px", borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}44`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
              Já verifiquei — Entrar
            </button>
          </div>
        ) : (
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: 28 }}>
            <div style={{ display: "flex", background: "#0d1117", borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {["login", "register"].map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.15s", background: mode === m ? accent : "transparent", color: mode === m ? "white" : "#484f58" }}>
                  {m === "login" ? useT("signIn") : useT("createAccount")}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>{useT("email").toUpperCase()}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={useT("emailPlaceholder")} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>{useT("password").toUpperCase()}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={useT("passwordPlaceholder")} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              {mode === "register" && (
                <div>
                  <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>CÓDIGO DE CONVITE</label>
                  <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Ex: TRACKALL-XXXX" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: `1px solid ${accent}44`, color: "#e6edf3", fontFamily: "inherit", letterSpacing: "1px", boxSizing: "border-box" }} />
                  <p style={{ fontSize: 11, color: "#484f58", marginTop: 5 }}>O TrackAll está em acesso antecipado. Precisas de um código para criar conta.</p>
                </div>
              )}
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#ef444415", borderRadius: 8 }}>{error}</p>}
            {success && <p style={{ color: "#10b981", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#10b98115", borderRadius: 8 }}>{success}</p>}
            <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "white", fontFamily: "inherit", fontSize: 15, fontWeight: 700, opacity: loading ? 0.7 : 1, transition: "all 0.2s", boxShadow: `0 4px 20px rgba(${accentRgb},0.3)` }}>
              {loading ? useT("processing") : mode === "login" ? useT("signIn") : useT("createAccount")}
            </button>
          </div>
        )}
        <p style={{ textAlign: "center", color: "#30363d", fontSize: 11, marginTop: 20 }}>
          Os teus dados ficam guardados em segurança na nuvem
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar Search ───────────────────────────────────────────────────────────
function SidebarSearch({ accent, darkMode, activeTab, doSearch, useT }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)} className="ds-nav-btn" style={{ padding: "11px 16px" }}>
          <span className="ds-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/>
              <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          {useT("search")}
        </button>
      ) : (
        <div ref={containerRef} style={{ margin: "2px 8px", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: darkMode ? "#161b22" : "#f1f5f9", borderRadius: 10, border: `1px solid ${accent}55`, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="10.5" cy="10.5" r="6.5" stroke={accent} strokeWidth="2"/>
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && q.trim()) { doSearch(q, activeTab); setOpen(false); setQ(""); }
              if (e.key === "Escape") { setOpen(false); setQ(""); }
            }}
            placeholder={useT("search") + "..."}
            style={{ flex: 1, background: "transparent", border: "none", color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 13, outline: "none", padding: 0, minWidth: 0 }} />
          <button onClick={() => { setOpen(false); setQ(""); }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0, padding: 0 }}>✕</button>
        </div>
      )}
    </>
  );
}

export default function TrackAll() {
  const [lang, setLang] = useState(() => detectLang());
  const useT = (key) => t(key, lang);
  const changeLang = (newLang) => { setLang(newLang); saveLang(newLang); };
  const [accent, setAccent] = useState("#f97316");
  const [bgColor, setBgColor] = useState("#0d1117");
  const [bgColorMobile, setBgColorMobile] = useState(""); // "" = igual ao PC
  const [sidebarColor, setSidebarColor] = useState(""); // "" = igual ao bgColor
  const [textContrast, setTextContrast] = useState(100);
  const [textContrastMobile, setTextContrastMobile] = useState(100);
  const [savedThemes, setSavedThemes] = useState(() => { try { return JSON.parse(localStorage.getItem("trackall_themes") || "[]"); } catch { return []; } });
  const [panelBg, setPanelBg] = useState("");
  const [panelOpacity, setPanelOpacity] = useState(100);

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
    // Theme color meta — segue a cor de fundo do dispositivo atual
    const isMobile = window.innerWidth < 768;
    const activeColor = (bgSeparateDevices && isMobile)
      ? (bgColorMobile || "#0d1117")  // mobile: usa cor mobile, nunca herda PC
      : bgColor;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.content = activeColor;
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = activeColor;
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
  }, [bgColor, bgColorMobile, bgSeparateDevices]);

  // Attach mouse-wheel → horizontal scroll on all .recents-row elements
  // + keyboard arrow keys when hovering ANY horizontal scroll container
  useEffect(() => {
    let hoveredRow = null;

    const onKeyDown = (e) => {
      if (!hoveredRow) return;
      if (hoveredRow.scrollWidth <= hoveredRow.clientWidth) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); hoveredRow.scrollLeft -= 200; }
      if (e.key === "ArrowRight") { e.preventDefault(); hoveredRow.scrollLeft += 200; }
    };
    document.addEventListener('keydown', onKeyDown);

    // Selector que cobre todos os scrolls horizontais
    const SCROLL_SEL = '.recents-row, .tabs-scroll, [style*="overflowX: auto"], [style*="overflow-x: auto"]';

    const attachEl = (el) => {
      if (el._scrollKeyOk) return;
      el._scrollKeyOk = true;
      // wheel
      if (!el._wheelOk) {
        el._wheelOk = true;
        el.addEventListener('wheel', (e) => {
          if (el.scrollWidth <= el.clientWidth) return;
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }, { passive: false });
      }
      // keyboard hover
      el.addEventListener('mouseenter', () => { hoveredRow = el; });
      el.addEventListener('mouseleave', () => { if (hoveredRow === el) hoveredRow = null; });
    };

    const attach = () => {
      document.querySelectorAll(SCROLL_SEL).forEach(attachEl);
    };

    attach();
    const obs = new MutationObserver(attach);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); document.removeEventListener('keydown', onKeyDown); };
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
  const [libSearch, setLibSearch] = useState("");
  const [libViewMode, setLibViewMode] = useState(() => { 
    try { 
      const saved = localStorage.getItem("trackall_lib_view") || "grid";
      // compact não existe no mobile
      if (saved === "compact" && typeof window !== 'undefined' && window.innerWidth < 600) return "grid";
      return saved;
    } catch { return "grid"; } 
  });
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
  const [personalRecos, setPersonalRecos] = useState([]);
  const personalRecosLoadedRef = useRef(false);
  const recoLoadIdRef = useRef(0);
  const recosFetchedRef = useRef(false);
  const [recoLoading, setRecoLoading] = useState(false);
  const [userTierlists, setUserTierlists] = useState([]);
  const [userLikes, setUserLikes] = useState([]);
  const [viewingTierlist, setViewingTierlist] = useState(null);
  const [editingTierlist, setEditingTierlist] = useState(null);
  const [showTierlistEditor, setShowTierlistEditor] = useState(false);
  const [userCollections, setUserCollections] = useState([]);
  const [userCollectionLikes, setUserCollectionLikes] = useState([]);
  const [viewingCollection, setViewingCollection] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const [showCollectionEditor, setShowCollectionEditor] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const mainSwipeRef = useRef({ tracking: false, blocked: false, isHorizontal: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const mainSwipeAnimRef = useRef(null);
  const mainSwipeContentRef = useRef(null);
  const mainSwipePeekRef = useRef(null);
  const mainSwipePeekState = useRef({ dir: 1 });
  const MAIN_SWIPE_VIEWS = ["home", "library", "friends", "profile"];

  // ── Restaurar sessão ao arrancar ──
  useEffect(() => {
    const restore = async () => {
      try {
        const user = await supa.getSession();
        if (user) {
          setUser(user);
          await loadUserData(user.id);
        } else {
          setShowLanding(true);
        }
      } catch { setShowLanding(true); }
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
        setProfile({ name: prof.name || "", bio: prof.bio || "", avatar: prof.avatar || "", banner: prof.banner || "", hideEmail: prof.hide_email || false, hideBannerMobile: prof.hide_banner_mobile || false });
        if (prof.accent) setAccent(prof.accent);
        if (prof.panel_bg !== undefined) setPanelBg(prof.panel_bg || "");
        if (prof.panel_opacity !== undefined) setPanelOpacity(prof.panel_opacity ?? 100);
        if (prof.sidebar_color !== undefined) setSidebarColor(prof.sidebar_color || "");
        if (prof.text_contrast !== undefined) setTextContrast(prof.text_contrast ?? 100);
        if (prof.text_contrast_mobile !== undefined) setTextContrastMobile(prof.text_contrast_mobile ?? 100);
        if (prof.bg_color_mobile) setBgColorMobile(prof.bg_color_mobile);

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
      if (lib) {
        setLibrary(lib);
        // Tentar cache do sessionStorage primeiro
        if (!personalRecosLoadedRef.current) {
          try {
            const cached = sessionStorage.getItem("trackall_personal_recos");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.length) { setPersonalRecos(parsed); personalRecosLoadedRef.current = true; }
            }
          } catch {}
        }
        // Carregar recos personalizadas logo após ter a library — só uma vez
        if (!personalRecosLoadedRef.current && Object.keys(lib).length > 0) {
          personalRecosLoadedRef.current = true;
          const workerU = prof?.worker_url || DEFAULT_WORKER_URL;
          fetchPersonalizedRecos(lib, workerU).then(personal => {
            if (personal?.length) {
              setPersonalRecos(personal);
              try { sessionStorage.setItem("trackall_personal_recos", JSON.stringify(personal)); } catch {}
            }
          });
        }
      }
    } catch (err) {
      console.error('[TrackAll] Erro ao carregar dados do utilizador:', err);
    }
  };

  // Carrega recos UMA VEZ — ref garante que não repete mesmo com re-renders
  const recosInitRef = useRef(false);
  useEffect(() => {
    if (user?.id && !recosInitRef.current) {
      recosInitRef.current = true;
      loadRecos();
    }
  });  // sem dependências — corre a cada render mas a ref para depois da 1ª vez

  // Carrega tierlists/collections uma vez
  const profileInitRef = useRef(false);
  useEffect(() => {
    if (user?.id && !profileInitRef.current) {
      profileInitRef.current = true;
      loadUserTierlists();
      loadUserCollections();
    }
  });  // sem dependências — idem

  useEffect(() => () => {
    if (mainSwipeAnimRef.current) clearTimeout(mainSwipeAnimRef.current);
  }, []);

  const loadRecos = async (manual = false) => {
    if (!manual && recosFetchedRef.current) return; // já carregou, não repetir
    recosFetchedRef.current = true;
    const loadId = ++recoLoadIdRef.current;
    setRecoLoading(true);
    if (!manual) {
      // Tentar restaurar de sessionStorage antes de fazer fetch
      try {
        const cached = sessionStorage.getItem("trackall_trending_recos");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Object.keys(parsed).length > 0) {
            setRecos(parsed);
            setRecoLoading(false);
            return;
          }
        }
      } catch {}
    }
    setRecos({});
    const applyRecoChunk = (key, items) => {
      if (recoLoadIdRef.current !== loadId) return;
      if (items?.length) setRecos(r => ({ ...r, [key]: items }));
    };
    if (manual) {
      setPersonalRecos([]);
      personalRecosLoadedRef.current = false;
      recosFetchedRef.current = false;
      try { sessionStorage.removeItem("trackall_personal_recos"); } catch {}
      try { sessionStorage.removeItem("trackall_trending_recos"); } catch {}
      // Re-fetch personalRecos with current library
      if (Object.keys(library).length > 0) {
        personalRecosLoadedRef.current = true;
        fetchPersonalizedRecos(library, workerUrl).then(personal => {
          if (recoLoadIdRef.current !== loadId) return;
          if (personal?.length) {
            setPersonalRecos(personal);
            try { sessionStorage.setItem("trackall_personal_recos", JSON.stringify(personal)); } catch {}
          }
        }).catch(() => {});
      }
    }
    try {
      // Carregar progressivamente — cada categoria aparece quando fica pronta
      await Promise.allSettled([
        fetchTrendingAnime(workerUrl).then(items => applyRecoChunk("anime", items)),
        fetchTrendingManga(workerUrl).then(items => applyRecoChunk("manga", items)),
        fetchTrendingMovies(tmdbKey, workerUrl).then(items => applyRecoChunk("filmes", items)),
        fetchTrendingSeries(tmdbKey, workerUrl).then(items => applyRecoChunk("series", items)),
        fetchTrendingGames(workerUrl).then(items => applyRecoChunk("jogos", items)),
      ]);
    } catch {}
    if (recoLoadIdRef.current === loadId) {
      setRecoLoading(false);
      // Guardar trending em cache para restaurar sem reload
      if (!manual) {
        setRecos(current => {
          try { sessionStorage.setItem("trackall_trending_recos", JSON.stringify(current)); } catch {}
          return current;
        });
      }
    }
  };

  const handleSaveTierlist = async (title, tiers) => {
    if (!user) return;
    if (editingTierlist?.id) {
      await supa.updateTierlist(editingTierlist.id, title, tiers);
      setUserTierlists(prev => prev.map(tl => tl.id === editingTierlist.id ? { ...tl, title, tiers } : tl));
    } else {
      const newTl = await supa.createTierlist(user.id, title, tiers);
      if (newTl) setUserTierlists(prev => [newTl, ...prev]);
    }
    setShowTierlistEditor(false);
    setEditingTierlist(null);
  };

  const loadUserTierlists = async () => {
    if (!user) return;
    const [tls, likes] = await Promise.all([
      supa.getUserTierlists(user.id),
      supa.getUserLikes(user.id),
    ]);
    setUserTierlists(tls);
    setUserLikes(likes);
  };

  const loadUserCollections = async () => {
    if (!user) return;
    const [cols, colLikes] = await Promise.all([
      supa.getUserCollections(user.id),
      supa.getUserCollectionLikes(user.id),
    ]);
    setUserCollections(cols);
    setUserCollectionLikes(colLikes);
  };

  const handleTierlistLike = async (tierlistId) => {
    if (!user) return;
    const isLiked = await supa.toggleTierlistLike(user.id, tierlistId);
    setUserLikes(prev => isLiked ? [...prev, tierlistId] : prev.filter(id => id !== tierlistId));
    setUserTierlists(prev => prev.map(tl => tl.id === tierlistId ? { ...tl, likes_count: (tl.likes_count || 0) + (isLiked ? 1 : -1) } : tl));
    if (viewingTierlist?.id === tierlistId) {
      setViewingTierlist(prev => ({ ...prev, likes_count: (prev.likes_count || 0) + (isLiked ? 1 : -1) }));
    }
  };

  const handleDeleteTierlist = async (id) => {
    await supa.deleteTierlist(id);
    setUserTierlists(prev => prev.filter(tl => tl.id !== id));
  };

  const handleSaveCollection = async (colData) => {
    if (!user) return;
    if (editingCollection) {
      await supa.updateCollection(editingCollection.id, colData);
      setUserCollections(prev => prev.map(c => c.id === editingCollection.id ? { ...c, ...colData } : c));
      if (viewingCollection?.id === editingCollection.id) setViewingCollection(prev => ({ ...prev, ...colData }));
    } else {
      const created = await supa.createCollection(user.id, colData);
      setUserCollections(prev => [created, ...prev]);
    }
    setShowCollectionEditor(false);
    setEditingCollection(null);
  };

  const handleCollectionLike = async (collectionId) => {
    if (!user) return;
    const isLiked = await supa.toggleCollectionLike(user.id, collectionId);
    setUserCollectionLikes(prev => isLiked ? [...prev, collectionId] : prev.filter(id => id !== collectionId));
    setUserCollections(prev => prev.map(c => c.id === collectionId ? { ...c, likes_count: (c.likes_count || 0) + (isLiked ? 1 : -1) } : c));
    if (viewingCollection?.id === collectionId) setViewingCollection(prev => ({ ...prev, likes_count: (prev.likes_count || 0) + (isLiked ? 1 : -1) }));
  };

  const handleDeleteCollection = async (id) => {
    await supa.deleteCollection(id);
    setUserCollections(prev => prev.filter(c => c.id !== id));
    if (viewingCollection?.id === id) setViewingCollection(null);
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
      } catch (err) {
        console.error('[TrackAll] Erro ao guardar biblioteca:', err);
      }
    }
  };

  const getLibraryMatch = (id, type = "") => findLibraryEntry(library, id, type);

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
          hide_banner_mobile: p.hideBannerMobile || false,
        });
      } catch (err) {
        console.error('[TrackAll] Erro ao guardar perfil:', err);
        showNotif(lang === "en" ? "Error saving profile. Check your connection." : "Erro ao guardar perfil. Verifica a ligação.", "#ef4444");
      }
    }
  };

  const saveAccent = async (c) => {
    setAccent(c);
    if (user) try { await supa.upsertProfile(user.id, { accent: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar accent:", err); }
  };
  const savePanelBg = async (c) => {
    setPanelBg(c);
    if (user) try { await supa.upsertProfile(user.id, { panel_bg: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar panel_bg:", err); }
  };
  const savePanelOpacity = async (v) => {
    setPanelOpacity(v);
    if (user) try { await supa.upsertProfile(user.id, { panel_opacity: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar panel_opacity:", err); }
  };
  const saveSidebarColor = async (c) => {
    setSidebarColor(c);
    if (user) try { await supa.upsertProfile(user.id, { sidebar_color: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar sidebar_color:", err); }
  };
  const saveSavedThemes = (themes) => {
    setSavedThemes(themes);
    try { localStorage.setItem("trackall_themes", JSON.stringify(themes)); } catch {}
  };
  const saveTextContrast = async (v) => {
    setTextContrast(v);
    if (user) try { await supa.upsertProfile(user.id, { text_contrast: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar text_contrast:", err); }
  };
  const saveTextContrastMobile = async (v) => {
    setTextContrastMobile(v);
    if (user) try { await supa.upsertProfile(user.id, { text_contrast_mobile: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar text_contrast_mobile:", err); }
  };
  const saveBgColorMobile = async (c) => {
    setBgColorMobile(c);
    if (user) try { await supa.upsertProfile(user.id, { bg_color_mobile: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_color_mobile:", err); }
  };
  const saveBg = async (c) => {
    setBgColor(c);
    setDarkMode(isColorDark(c));
    if (user) try { await supa.upsertProfile(user.id, { bg_color: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_color:", err); }
  };
  const saveBgOverlay = async (o) => {
    setBgOverlay(o);
    if (user) try { await supa.upsertProfile(user.id, { bg_overlay: o }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_overlay:", err); }
  };
  const saveBgBlur = async (v) => {
    setBgBlur(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_blur: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_blur:", err); }
  };
  const saveBgParallax = async (v) => {
    setBgParallax(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_parallax: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_parallax:", err); }
  };
  // isMobile check — calculado uma vez, estável entre renders
  const [isMobileDevice] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  const canUseMainSwipe = isMobileDevice
    && MAIN_SWIPE_VIEWS.includes(view)
    && !selectedItem
    && !viewingTierlist
    && !showTierlistEditor
    && !showCollectionEditor
    && !logOpen
    && !logPendingItem;

  const hasHorizontalScrollableParent = (target, dx = 0) => {
    let el = target instanceof HTMLElement ? target : null;
    while (el && el !== document.body) {
      const ox = window.getComputedStyle(el)?.overflowX || "";
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 8) {
        if (dx === 0) return true;
        if (dx > 0 && el.scrollLeft > 2) return true;
        if (dx < 0 && el.scrollLeft < el.scrollWidth - el.clientWidth - 2) return true;
      }
      el = el.parentElement;
    }
    return false;
  };
  const isMainSwipeBlockedTarget = (target, dx = 0) => {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest('input,textarea,select,[contenteditable="true"],.modal,.bottom-nav,.top-nav-bar')) return true;
    if (target.closest(".recents-row,.tabs-scroll")) return true;
    if (hasHorizontalScrollableParent(target, dx)) return true;
    return false;
  };
  const resetMainSwipe = () => { mainSwipeRef.current = { tracking: false, blocked: false, isHorizontal: false, startX: 0, startY: 0, lastX: 0, lastY: 0, startTarget: null, peekShown: false }; };
  const hidePeek = () => { const p = mainSwipePeekRef.current; if (p) p.style.display = "none"; };
  const showPeek = (targetView, dir) => {
    const p = mainSwipePeekRef.current; if (!p) return;
    mainSwipePeekState.current.dir = dir;
    const W = window.innerWidth || 360;
    p.style.display = "block"; p.style.transition = "none";
    p.style.transform = `translate3d(${dir * W}px,0,0)`;
    p.querySelectorAll("[data-sk]").forEach(el => { el.style.display = el.dataset.sk === targetView ? "block" : "none"; });
  };
  const applyMainSwipeStyle = (offset = 0, transition = "none") => {
    const W = window.innerWidth || 360;
    const cur = mainSwipeContentRef.current; const peek = mainSwipePeekRef.current;
    const dir = mainSwipePeekState.current.dir;
    if (cur) { cur.style.transition = transition; cur.style.transform = `translate3d(${offset}px,0,0)`; cur.style.willChange = offset !== 0 ? "transform" : "auto"; }
    if (peek && peek.style.display !== "none") { peek.style.transition = transition; peek.style.transform = `translate3d(${offset + dir * W}px,0,0)`; }
  };
  const animateMainSwipeToView = (nextView, direction) => {
    const W = window.innerWidth || 360;
    if (mainSwipeAnimRef.current) clearTimeout(mainSwipeAnimRef.current);
    applyMainSwipeStyle(direction * -W, "transform 260ms cubic-bezier(0.25,0.46,0.45,0.94)");
    mainSwipeAnimRef.current = setTimeout(() => {
      // flushSync força o React a re-renderizar a nova view de forma síncrona
      // ANTES de escondermos o peek — assim nunca há flash de conteúdo vazio
      flushSync(() => { setView(nextView); });
      hidePeek();
      const cur = mainSwipeContentRef.current;
      if (cur) { cur.style.transition = "none"; cur.style.transform = "translate3d(0,0,0)"; cur.style.willChange = "auto"; }
      mainSwipeAnimRef.current = null;
    }, 260);
  };
  const handleMainSwipeStart = (e) => {
    if (!canUseMainSwipe) return;
    const touch = e.touches?.[0]; if (!touch) return;
    if (mainSwipeAnimRef.current) { clearTimeout(mainSwipeAnimRef.current); mainSwipeAnimRef.current = null; }
    hidePeek();
    const cur = mainSwipeContentRef.current; if (cur) { cur.style.transition = "none"; cur.style.transform = "translate3d(0,0,0)"; }
    mainSwipeRef.current = { tracking: true, blocked: !!(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"],.modal,.bottom-nav,.top-nav-bar')), startTarget: e.target, isHorizontal: false, peekShown: false, startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY };
  };
  const handleMainSwipeMove = (e) => {
    const state = mainSwipeRef.current;
    if (!state.tracking || state.blocked) return;
    const touch = e.touches?.[0]; if (!touch) return;
    state.lastX = touch.clientX; state.lastY = touch.clientY;
    const dx = touch.clientX - state.startX, dy = touch.clientY - state.startY;
    if (!state.isHorizontal && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 0.9) {
      if (isMainSwipeBlockedTarget(state.startTarget, dx)) { state.blocked = true; return; }
      state.isHorizontal = true;
    }
    if (state.isHorizontal) {
      const ci = MAIN_SWIPE_VIEWS.indexOf(view), atFirst = ci <= 0, atLast = ci >= MAIN_SWIPE_VIEWS.length - 1;
      if (!state.peekShown) { state.peekShown = true; if (dx < 0 && !atLast) showPeek(MAIN_SWIPE_VIEWS[ci + 1], 1); else if (dx > 0 && !atFirst) showPeek(MAIN_SWIPE_VIEWS[ci - 1], -1); }
      let off = dx * 0.98; if ((atFirst && dx > 0) || (atLast && dx < 0)) off = dx * 0.18;
      applyMainSwipeStyle(off, "none"); if (e.cancelable) e.preventDefault(); return;
    }
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { state.blocked = true; applyMainSwipeStyle(0, "transform 200ms ease"); }
  };
  const handleMainSwipeEnd = () => {
    const state = mainSwipeRef.current; resetMainSwipe();
    if (!canUseMainSwipe || !state.tracking || state.blocked || !state.isHorizontal) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    const dx = state.lastX - state.startX, dy = state.lastY - state.startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.1) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    const ci = MAIN_SWIPE_VIEWS.indexOf(view);
    if (ci === -1) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    if (dx < 0 && ci < MAIN_SWIPE_VIEWS.length - 1) animateMainSwipeToView(MAIN_SWIPE_VIEWS[ci + 1], 1);
    else if (dx > 0 && ci > 0) animateMainSwipeToView(MAIN_SWIPE_VIEWS[ci - 1], -1);
    else { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); }
  };
  const handleMainSwipeCancel = () => { resetMainSwipe(); hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); };
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  /* const mainSwipeTabs = [
    { id: "home", icon: "⌂", label: useT("home") },
    { id: "library", icon: "▤", label: useT("library") },
    { id: "friends", icon: "◔", label: useT("friends") },
    { id: "profile", icon: "◉", label: lang === "en" ? "Profile" : "Perfil" },
  ]; */
  const saveBgImage = async (img) => {
    if (bgSeparateDevices) {
      if (isMobileDevice) {
        setBgImageMobile(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image_mobile:", err); }
      } else {
        setBgImage(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image:", err); }
      }
    } else {
      setBgImage(img);
      setBgImageMobile(img);
      if (user) try { await supa.upsertProfile(user.id, { bg_image: img, bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image:", err); }
    }
  };
  const saveMobileBgImage = async (img) => {
    setBgImageMobile(img);
    if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image_mobile:", err); }
  };
  const saveBgSeparateDevices = async (val) => {
    setBgSeparateDevices(val);
    if (user) try { await supa.upsertProfile(user.id, { bg_separate_devices: val }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_separate_devices:", err); }
  };
  const saveTmdbKey = async (k) => {
    setTmdbKey(k);
    if (user) try { await supa.upsertProfile(user.id, { tmdb_key: k }); } catch (err) { console.error("[TrackAll] Erro ao guardar tmdb_key:", err); }
  };
  const saveWorkerUrl = async (k) => {
    setWorkerUrl(k);
    if (user) try { await supa.upsertProfile(user.id, { worker_url: k }); } catch (err) { console.error("[TrackAll] Erro ao guardar worker_url:", err); }
  };

  const addToLibrary = useCallback((item, status, rating = 0) => {
    const normalizedItem = normalizeMediaItem(item);
    const existing = findLibraryEntry(library, normalizedItem.id, normalizedItem.type);
    const canonicalId = normalizeMediaId(normalizedItem.id, normalizedItem.type);
    const lib = { ...library };
    if (existing?.key && existing.key !== canonicalId) delete lib[existing.key];
    lib[canonicalId] = {
      ...(existing?.item || {}),
      ...normalizedItem,
      id: canonicalId,
      userStatus: status,
      userRating: rating,
      addedAt: Date.now(),
    };
    saveLibrary(lib);
    showNotif(`"${normalizedItem.title.slice(0, 30)}" adicionado!`, "#10b981");
    if (navigator.vibrate) navigator.vibrate(50);
  }, [library]);


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
        const wUrlMihon = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrlMihon}/anilist`], JSON.stringify({ query: `query { ${queryParts} }` }));
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
    const matched = getLibraryMatch(id);
    if (!matched) return;
    const lib = { ...library };
    delete lib[matched.key];
    saveLibrary(lib);
    showNotif("Removido da biblioteca", "#ef4444");
  };
  const updateStatus = useCallback((id, status) => {
    const matched = findLibraryEntry(library, id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const update = { ...matched.item, id: canonicalId, userStatus: status };
    // Atualizar addedAt quando muda para completo — para o diário mostrar a data correta
    if (status === "completo") update.addedAt = Date.now();
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = update;
    saveLibrary(next);
    showNotif(useT("statusUpdated"), accent);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [library, accent]);

  const updateLastChapter = useCallback((id, chapter) => {
    const matched = findLibraryEntry(library, id);
    if (!matched || !chapter) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, lastChapter: chapter };
    saveLibrary(next);
    showNotif(`Capítulo: ${chapter} ✓`, accent);
  }, [library, accent]);
  const updateRating = (id, rating) => {
    const matched = getLibraryMatch(id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, userRating: rating };
    saveLibrary(next);
    showNotif(rating > 0 ? `${rating} ★` : useT("ratingRemoved"), "#f59e0b");
  };
  const updateCover = async (id, url) => {
    const matched = getLibraryMatch(id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, customCover: url };
    saveLibrary(next);
    // Sincronizar cover nos favoritos se este item estiver lá
    const inFavs = favorites.some(f => f.id === id || f.id === matched.key || f.id === canonicalId);
    if (inFavs) {
      const newFavs = favorites.map(f => (f.id === id || f.id === matched.key || f.id === canonicalId) ? { ...f, id: canonicalId, customCover: url } : f);
      setFavorites(newFavs);
      if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
    }
    showNotif(useT("coverUpdated"), accent);
  };

  const toggleFavorite = async (item) => {
    const normalizedItem = normalizeMediaItem(item);
    const favoriteIds = new Set(mediaIdCandidates(normalizedItem.id, normalizedItem.type));
    const exists = favorites.some(f => favoriteIds.has(f.id));
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => !favoriteIds.has(f.id));
      showNotif("Removido dos favoritos", "#8b949e");
    } else {
      if (favorites.length >= 30) { showNotif("Máximo de 30 favoritos!", "#ef4444"); return; }
      const libItem = getLibraryMatch(normalizedItem.id, normalizedItem.type)?.item;
      newFavs = [...favorites, { id: normalizedItem.id, title: normalizedItem.title, cover: normalizedItem.cover, customCover: libItem?.customCover || normalizedItem.customCover || "", type: normalizedItem.type }];
      showNotif(useT("addedToFavorites"), "#f59e0b");
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
        const [anime, manga, manhwa, lightnovels, livros, filmes, series, jogos, comics] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manhwa", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "lightnovels", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "livros", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "jogos", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "comics", { tmdb: tmdbKey, workerUrl }),
        ]);
        const all = [
          ...(anime.status === "fulfilled" ? anime.value || [] : []),
          ...(manga.status === "fulfilled" ? manga.value || [] : []),
          ...(manhwa.status === "fulfilled" ? manhwa.value || [] : []),
          ...(lightnovels.status === "fulfilled" ? lightnovels.value || [] : []),
          ...(livros.status === "fulfilled" ? livros.value || [] : []),
          ...(filmes.status === "fulfilled" ? filmes.value || [] : []),
          ...(series.status === "fulfilled" ? series.value || [] : []),
          ...(jogos.status === "fulfilled" ? jogos.value || [] : []),
          ...(comics.status === "fulfilled" ? comics.value || [] : []),
        ];
        const seen = new Set();
        results = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      } else {
        // Limpar cache para garantir resultados frescos ao trocar de tipo
        const ck = cacheKey(q, type);
        CACHE.delete(ck);
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
        const [anime, manga, filmes, series] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }),
        ]);
        const all = [...(anime.value||[]), ...(manga.value||[]), ...(filmes.value||[]), ...(series.value||[])];
        const seen = new Set();
        results = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      }
      setLogResults(results.slice(0, 8));
    } catch (err) {
      console.error('[QuickLog] Erro na pesquisa:', err);
      setLogResults([]);
    }
    setLogSearching(false);
  }, [tmdbKey, workerUrl, quickSearchType]);

  useEffect(() => {
    if (logOpen) setTimeout(() => logInputRef.current?.focus(), 80);
    else { setLogQuery(""); setLogResults([]); }
  }, [logOpen]);

  useEffect(() => {
    const t = setTimeout(() => { if (logQuery) doLogSearch(logQuery); else setLogResults([]); }, 600);
    return () => clearTimeout(t);
  }, [logQuery, quickSearchType]);

  const items = useMemo(() => {
    if (demoMode) return Object.values(DEMO_LIBRARY);
    return Object.values(library);
  }, [library, demoMode]);

  const activeProfile = demoMode ? DEMO_PROFILE : profile;
  const activeFavorites = demoMode ? DEMO_PROFILE.favorites : favorites;

  const stats = useMemo(() => ({
    assistindo: items.filter((i) => i.userStatus === "assistindo").length,
    completo: items.filter((i) => i.userStatus === "completo").length,
    planejado: items.filter((i) => i.userStatus === "planejado").length,
  }), [items]);

  const filteredLib = useMemo(() => items.filter((i) => {
    if (filterStatus !== "all" && i.userStatus !== filterStatus) return false;
    if (activeTab !== "all" && i.type !== activeTab) return false;
    if (libSearch.trim() && !i.title?.toLowerCase().includes(libSearch.toLowerCase().trim())) return false;
    return true;
  }), [items, filterStatus, activeTab, libSearch]);

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
  if (!user && !demoMode) {
    if (showLanding) return <LandingPage accent={accent} onEnter={() => setShowLanding(false)} onDemo={() => { setDemoMode(true); setShowLanding(false); }} lang={lang} useT={useT} changeLang={changeLang} />;
    return <AuthScreen onAuth={handleAuth} accent={accent} onBack={() => setShowLanding(true)} lang={lang} useT={useT} />;
  }

  // Which bg image to show based on device + separate setting
  const activeBgImage = bgSeparateDevices
    ? (isMobileDevice ? bgImageMobile : bgImage)
    : bgImage;

  // Active bg color: mobile can have different color when bgSeparateDevices is on
  const activeBgColor = (bgSeparateDevices && isMobileDevice)
    ? (bgColorMobile || "#0d1117")  // mobile sem cor = noturno por defeito, nunca herda PC
    : bgColor;

  // darkMode separado: PC usa bgColor, mobile usa bgColorMobile quando separado está ligado
  // Se bgSeparateDevices ligado e no mobile: usa bgColorMobile se tiver valor, senão mantém darkMode independente do PC
  const activeDarkMode = (bgSeparateDevices && isMobileDevice)
    ? (bgColorMobile ? isColorDark(bgColorMobile) : true)  // mobile sem cor definida = noturno por defeito
    : darkMode;

  // Computed panel bg para uso no CSS global (lib-sidebar)
  const computedPanelBgCSS = (() => {
    if (!panelBg) return activeDarkMode ? "#161b22" : "rgba(255,255,255,0.7)";
    const op = (panelOpacity ?? 100) / 100;
    try {
      const hex = panelBg.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16);
        const g = parseInt(hex.slice(2,4),16);
        const b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b},${op})`;
      }
    } catch {}
    return panelBg;
  })();

  // Active text contrast: mobile can have different value when bgSeparateDevices is on
  const activeTextContrast = (bgSeparateDevices && isMobileDevice) ? textContrastMobile : textContrast;
  const baseTextColor = activeDarkMode ? "#e6edf3" : "#0d1117";

  return (
    <ThemeContext.Provider value={{ accent, bg: activeBgColor, darkMode: activeDarkMode, isMobileDevice }}>
      <LangContext.Provider value={{ lang, useT }}>
      <div style={{
        minHeight: "100vh",
        background: activeBgColor,
        color: baseTextColor,
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        paddingBottom: 80,
        position: "relative",
        overflowX: "hidden",
      }}>
        {/* Demo mode banner */}
        {demoMode && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>👀 Modo Demonstração — os dados são fictícios</span>
            <button onClick={() => { setDemoMode(false); setShowLanding(false); }} style={{ padding: "5px 14px", borderRadius: 8, background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>{useT("landingCreateFree")}</button>
            <button onClick={() => { setDemoMode(false); setShowLanding(true); }} style={{ padding: "5px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>✕ Sair</button>
          </div>
        )}
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
            { id: "home", icon: "⌂", label: useT("home") },
            { id: "library", icon: "▤", label: useT("library") },
            { id: "profile", icon: "◉", label: useT("profile") },
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
                {navItems.map((n) => (
                  <button key={n.id} className={`ds-nav-btn${view === n.id ? " active" : ""}`}
                    onClick={() => setView(n.id)}
                    style={view === n.id ? { background: `${accent}1a`, color: accent } : {}}>
                    <span className="ds-icon" style={view === n.id ? { color: accent } : {}}>{n.icon}</span>
                    {n.label}
                  </button>
                ))}
                {/* Amigos */}
                <button className={`ds-nav-btn${view === "friends" ? " active" : ""}`}
                  onClick={() => setView("friends")}
                  style={view === "friends" ? { background: `${accent}1a`, color: accent } : {}}>
                  <span className="ds-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} />
                      <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} opacity="0.7" />
                      <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
                    </svg>
                  </span>
                  {useT("friends")}
                </button>
                <SidebarSearch accent={accent} darkMode={activeDarkMode} activeTab={activeTab} doSearch={doSearch} useT={useT} />
              </div>

              {/* Botão + Log Rápido */}
              <div style={{ padding: "8px 8px 4px" }}>
                <button onClick={() => { setLogOpen(v => !v); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${accent}44`, background: `${accent}12`, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: accent, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accent}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${accent}12`; }}>
                  <span style={{ fontSize: 18 }}>+</span> {useT("quickLog")}
                </button>
              </div>

              {/* Biblioteca por tipo */}
              {libByType.length > 0 && (
                <>
                  <p className="ds-section" style={{ marginTop: 6, paddingBottom: 6 }}>{useT("library")}</p>
                  {MEDIA_TYPES.slice(1).filter(t => libByType.some(i => i.type === t.id)).map((t, tIdx) => {
                    const cnt = libByType.filter(i => i.type === t.id).length;
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
                        style={{ background: isActive ? `${accent}18` : undefined, borderRadius: 8, color: isActive ? accent : (darkMode ? "#8b949e" : "#64748b") }}>
                        <span style={{ display: "flex", alignItems: "center", width: 18, flexShrink: 0, color: isActive ? accent : (darkMode ? "#8b949e" : "#64748b") }}>{typeIcons[t.id] || t.icon}</span>
                        <span style={{ flex: 1, color: isActive ? accent : (darkMode ? "#c9d1d9" : "#374151"), fontWeight: isActive ? 700 : 500, fontSize: 13 }}>{mediaLabel(t, lang)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? accent : "#484f58" }}>{cnt}</span>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
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
                    <p style={{ fontSize: 11, color: "#8b949e" }}>{Object.keys(library).length} {useT("inLibraryCount")}</p>
                  </div>
                </div>
              </div>
            </aside>
          );
        })()}

        <div className="desktop-main tc-zone" style={{ position: "relative", zIndex: 2, minHeight: "100vh", background: activeBgImage ? "transparent" : activeBgColor }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { overscroll-behavior: none; }
          :root { --tc: ${activeTextContrast / 100}; }
          ${(() => {
            if (activeTextContrast === 100) return '';
            const base = darkMode ? [230, 237, 243] : [13, 17, 23];
            let r, g, b;
            if (activeTextContrast < 100) {
              const t = activeTextContrast / 100;
              r = Math.round(base[0] * t); g = Math.round(base[1] * t); b = Math.round(base[2] * t);
            } else {
              const t = (activeTextContrast - 100) / 100;
              r = Math.round(base[0] + (255-base[0])*t); g = Math.round(base[1] + (255-base[1])*t); b = Math.round(base[2] + (255-base[2])*t);
            }
            const col = `rgb(${r},${g},${b})`;
            return `
          .tc-zone { color: ${col} !important; }
          .tc-zone p, .tc-zone span, .tc-zone h1, .tc-zone h2, .tc-zone h3,
          .tc-zone h4, .tc-zone h5, .tc-zone li, .tc-zone a { color: ${col} !important; }
          .tc-zone .no-tc, .tc-zone .no-tc *,
          .tc-zone .rating-hover, .tc-zone .rating-hover *,
          .tc-zone .fav-overlay, .tc-zone .fav-overlay *,
          .tc-zone .recent-hover-overlay, .tc-zone .recent-hover-overlay *,
          .tc-zone .btn-accent, .tc-zone .btn-accent * { color: unset !important; }
          `;
          })()}
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${activeDarkMode ? "#30363d" : "#cbd5e1"}; border-radius: 3px; }
          .btn-accent { background: linear-gradient(135deg, ${accent}, ${accent}cc); color: white; border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 700; transition: all 0.2s; }
          .btn-accent:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(${accentRgb},0.4); }
          .card { background: ${activeDarkMode ? "#161b22" : "rgba(255,252,247,0.92)"}; border: 1px solid ${activeDarkMode ? "#21262d" : "#e8e0d5"}; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
          .card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); border-color: ${activeDarkMode ? "#30363d" : "#cbd5e1"}; }
          .card:hover .card-overlay { opacity: 1 !important; }
          .media-thumb { position: relative; overflow: hidden; border-radius: 10px; }
          .media-thumb .rating-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.52); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(-4px); transition: opacity 0.18s ease, transform 0.18s ease; border-radius: 10px; }
          .media-thumb:hover .rating-hover { opacity: 1; transform: translateY(0); }
          .media-thumb:hover img { transform: scale(1.04); transition: transform 0.25s ease; }
          .media-thumb img { transition: transform 0.25s ease; width: 100%; height: 100%; object-fit: cover; display: block; }
          .tab-btn { background: transparent; border: none; color: ${activeDarkMode ? "#8b949e" : "#64748b"}; cursor: pointer; padding: 7px 14px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s; }
          .tab-btn:hover { color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; background: ${activeDarkMode ? "#21262d" : "#e2e8f0"}; }
          .tab-btn.active { background: ${accent}; color: white; font-weight: 700; }
          input, select, textarea { background: ${activeDarkMode ? "#0d1117" : "#ffffff"}; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; border: 1px solid ${activeDarkMode ? "#30363d" : "#e2e8f0"}; border-radius: 10px; font-family: 'Outfit', sans-serif; transition: border-color 0.15s; }
          input::placeholder { color: ${activeDarkMode ? "#484f58" : "#94a3b8"}; }
          input:focus, select:focus { outline: none; border-color: ${accent}; box-shadow: 0 0 0 3px rgba(${accentRgb},0.1); }
          .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
          .modal { background: ${activeDarkMode ? "#161b22" : "#ffffff"}; border: 1px solid ${activeDarkMode ? "#30363d" : "#e2e8f0"}; border-radius: 16px; width: 100%; overflow: hidden; }
          .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
          @media (max-width: 480px) { .media-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
          .recents-row { -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; }
          .recents-row > * { scroll-snap-align: start; }
          img { will-change: auto; }
          .card { contain: layout style; }
          @media (max-width: 768px) {
            .card { contain: layout; border: none; border-radius: 8px; transition: none !important; }
            .fade-in { animation: none !important; }
            .view-transition { animation: none !important; }
            .media-thumb:hover img { transform: none !important; }
            .media-thumb .rating-hover { display: none; }
            .recents-row { -webkit-overflow-scrolling: touch; }
            * { -webkit-tap-highlight-color: transparent; }
            .card-info { display: none; }
            .card-info-title { display: block; font-size: 10px; font-weight: 700; padding: 5px 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; }
            .card-info-meta { display: none; }
          }
          @media (max-width: 480px) {
            .modal-bg { backdrop-filter: none !important; background: rgba(0,0,0,0.88) !important; }
          }
          .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${activeDarkMode ? "rgba(22,27,34,0.96)" : "rgba(255,255,255,0.96)"}; backdrop-filter: blur(12px); border-top: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; display: flex; height: 64px; z-index: 50; }
          .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; transition: color 0.15s; color: ${activeDarkMode ? "#484f58" : "#94a3b8"}; }
          .nav-btn.active { color: ${accent}; }
          .nav-btn:hover { color: ${activeDarkMode ? "#8b949e" : "#64748b"}; }
          .nav-center-btn { flex: 1; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; height: 100%; position: relative; -webkit-tap-highlight-color: transparent; }
          .tabs-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .tabs-scroll::-webkit-scrollbar { display: none; }
          .lib-layout { display: flex; gap: 20px; align-items: flex-start; }
          .lib-sidebar { display: none; }
          .lib-mobile-controls { display: block; }
          @media (min-width: 768px) {
            .lib-sidebar { display: block; width: 180px; flex-shrink: 0; background: ${computedPanelBgCSS}; border: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; border-radius: 12px; padding: 14px 10px; position: sticky; top: 70px; }
            .lib-mobile-controls { display: none; }
          }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          .shimmer { background: linear-gradient(90deg, ${activeDarkMode ? "#21262d" : "#e2e8f0"} 25%, ${activeDarkMode ? "#30363d" : "#f1f5f9"} 50%, ${activeDarkMode ? "#21262d" : "#e2e8f0"} 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
          :root {
            --border: ${activeDarkMode ? "#21262d" : "#e2e8f0"};
            --border2: ${activeDarkMode ? "#30363d" : "#d0d7de"};
            --card-bg: ${activeDarkMode ? "#161b22" : "rgba(255,252,247,0.95)"};
            --card-bg2: ${activeDarkMode ? "#0d1117" : "#f6f8fa"};
            --text-primary: ${activeDarkMode ? "#e6edf3" : "#1a1a2e"};
            --text-secondary: ${activeDarkMode ? "#8b949e" : "#57606a"};
            --text-muted: ${activeDarkMode ? "#484f58" : "#8c959f"};
            --input-bg: ${activeDarkMode ? "#0d1117" : "#ffffff"};
            --hover-bg: ${activeDarkMode ? "#21262d" : "#f3f4f6"};
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes modalSlideUp { from { opacity: 0; transform: translateY(32px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
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
            .modal { border-radius: 24px 24px 0 0 !important; max-height: 88vh !important; width: 100% !important; max-width: 100% !important; overflow-y: auto !important; }
            .cover-modal { overflow: hidden !important; display: flex !important; flex-direction: column !important; max-height: calc(88vh - 64px) !important; margin-bottom: 64px !important; }
            .modal::before { content: ""; display: block; width: 36px; height: 4px; background: #30363d; border-radius: 99px; margin: 12px auto 4px; }
            .modal-bottom-pad { padding-bottom: 80px !important; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .spin { animation: spin 0.7s linear infinite; display: inline-block; }
          .hero-gradient { background: ${activeBgImage ? "transparent" : activeBgColor}; border-bottom: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; position: relative; }
          .hero-gradient::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 60% 80% at 50% 120%, ${accent}18 0%, transparent 70%); }
          ${!activeDarkMode ? `
            .desktop-sidebar { background: rgba(255,255,255,0.95) !important; border-right: 1px solid #e2e8f0 !important; }
            .bottom-nav { background: rgba(255,255,255,0.97) !important; }
            .top-nav-bar { background: rgba(255,255,255,0.97) !important; border-bottom: 1px solid #e2e8f0 !important; }
            /* Corrigir texto muted/secondary no modo claro */
            .tc-zone span[style*="color: rgb(72, 79, 88)"],
            .tc-zone p[style*="color: rgb(72, 79, 88)"],
            .tc-zone div[style*="color: rgb(72, 79, 88)"] { color: #57606a !important; }
            .tc-zone span[style*="#484f58"],
            .tc-zone p[style*="#484f58"] { color: #57606a !important; }
            .tc-zone span[style*="#8b949e"],
            .tc-zone p[style*="#8b949e"] { color: #57606a !important; }
            /* Bordas invisíveis no modo claro */
            .tc-zone [style*="border: 1px solid rgb(33, 38, 45)"] { border-color: #e2e8f0 !important; }
            .tc-zone [style*="border: 1px solid #21262d"] { border-color: #e2e8f0 !important; }
            .tc-zone [style*="border-top: 1px solid #21262d"] { border-top-color: #e2e8f0 !important; }
            .tc-zone [style*="border-bottom: 1px solid #21262d"] { border-bottom-color: #e2e8f0 !important; }
            /* Backgrounds escuros em cards/sections */
            .tc-zone [style*="background: rgb(13, 17, 23)"],
            .tc-zone [style*="background: #0d1117"] { background: #f6f8fa !important; }
            .tc-zone [style*="background: rgb(22, 27, 34)"],
            .tc-zone [style*="background: #161b22"] { background: rgba(255,255,255,0.9) !important; }
            .tc-zone [style*="background: rgb(33, 38, 45)"],
            .tc-zone [style*="background: #21262d"] { background: #e8ecf0 !important; }
          ` : ""}

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
            background: ${sidebarColor || activeBgColor}f5;
            border-right: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"};
            backdrop-filter: blur(20px);
            padding: 0 0 16px 0;
            overflow-y: hidden;
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
          .ds-nav-btn .ds-icon { font-size: 18px; width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
          .ds-section { font-size: 10px; font-weight: 800; color: #484f58; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 24px 4px; }
          .ds-type-item {
            display: flex; align-items: center; gap: 8px;
            padding: 4px 16px; font-size: 12px; cursor: pointer;
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
           
            library={library}
            onDone={(rating) => {
              if (rating > 0) {
                const normalizedPending = normalizeMediaItem(logPendingItem);
                const matched = getLibraryMatch(normalizedPending.id, normalizedPending.type);
                const canonicalId = normalizeMediaId(normalizedPending.id, normalizedPending.type);
                const next = { ...library };
                if (matched?.key && matched.key !== canonicalId) delete next[matched.key];
                const base = matched?.item || normalizedPending;
                next[canonicalId] = { ...base, id: canonicalId, userStatus: "completo", userRating: rating };
                saveLibrary(next);
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
            favorites={activeFavorites}
            onToggleFavorite={toggleFavorite}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onOpenItem={(newItem) => setSelectedItem(newItem)}
          />
        )}

        {/* NAV TOP */}
        <nav className="top-nav-bar" style={{ background: `${activeBgColor}ee`, backdropFilter: "blur(14px)", borderBottom: `1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}`, padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 56, position: "sticky", top: 0, zIndex: 40 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white" }}>T</div>
            <span style={{ fontSize: 18, fontWeight: 900, color: activeDarkMode ? "#e6edf3" : "#0d1117", letterSpacing: "-0.5px" }}>TrackAll</span>
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

        <div
          onTouchStart={handleMainSwipeStart}
          onTouchMove={handleMainSwipeMove}
          onTouchEnd={handleMainSwipeEnd}
          onTouchCancel={handleMainSwipeCancel}
          style={{
            touchAction: canUseMainSwipe ? "pan-y" : "auto",
            position: "relative",
            overflow: "hidden",
          }}
        >

        {canUseMainSwipe && (
          <div ref={mainSwipePeekRef} style={{ display: "none", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 5, pointerEvents: "none", overflow: "hidden", background: activeDarkMode ? "#0d1117" : "#f5f0e8" }}>
            <div data-sk="home" style={{ display: "none", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div className="shimmer" style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="shimmer" style={{ width: "50%", height: 16, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8 }}>{[80,72,68].map((w,i) => <div key={i} className="shimmer" style={{ width: w, height: 42, borderRadius: 10 }} />)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[72,90,80,68,76].map((w,i) => <div key={i} className="shimmer" style={{ width: w, height: 32, borderRadius: 20, flexShrink: 0 }} />)}</div>
              {[0,1].map(r => <div key={r} style={{ marginBottom: 16 }}><div className="shimmer" style={{ width: 110, height: 13, borderRadius: 6, marginBottom: 10 }} /><div style={{ display: "flex", gap: 10 }}>{[0,1,2,3].map(i => <div key={i} style={{ flexShrink: 0 }}><div className="shimmer" style={{ width: 88, height: 128, borderRadius: 10, marginBottom: 5 }} /><div className="shimmer" style={{ width: 70, height: 9, borderRadius: 4 }} /></div>)}</div></div>)}
            </div>
            <div data-sk="library" style={{ display: "none", padding: "16px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><div className="shimmer" style={{ width: 110, height: 26, borderRadius: 8 }} /><div className="shimmer" style={{ width: 76, height: 30, borderRadius: 20 }} /></div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{[60,90,80,72,68].map((w,i) => <div key={i} className="shimmer" style={{ width: w, height: 30, borderRadius: 20, flexShrink: 0 }} />)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>{[0,1,2,3,4,5,6,7,8,9,10,11].map(i => <div key={i}><div className="shimmer" style={{ width: "100%", height: 130, borderRadius: 10, marginBottom: 4 }} /><div className="shimmer" style={{ width: "70%", height: 9, borderRadius: 4 }} /></div>)}</div>
            </div>
            <div data-sk="friends" style={{ display: "none", padding: "16px 0" }}>
              <div style={{ display: "flex", gap: 8, padding: "0 16px", marginBottom: 18 }}>{[70,100,90,80].map((w,i) => <div key={i} className="shimmer" style={{ width: w, height: 34, borderRadius: 8, flexShrink: 0 }} />)}</div>
              {[0,1,2].map(i => <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 16px 10px", padding: "14px 16px", borderRadius: 14, background: activeDarkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: `1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}` }}><div className="shimmer" style={{ width: 50, height: 50, borderRadius: "50%", flexShrink: 0 }} /><div style={{ flex: 1 }}><div className="shimmer" style={{ width: "55%", height: 14, borderRadius: 6, marginBottom: 6 }} /><div className="shimmer" style={{ width: "35%", height: 10, borderRadius: 4 }} /></div></div>)}
            </div>
            <div data-sk="profile" style={{ display: "none" }}>
              <div className="shimmer" style={{ width: "100%", height: 180 }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -36 }}>
                <div className="shimmer" style={{ width: 76, height: 76, borderRadius: "50%", marginBottom: 10 }} />
                <div className="shimmer" style={{ width: 130, height: 17, borderRadius: 6, marginBottom: 7 }} />
                <div className="shimmer" style={{ width: 90, height: 11, borderRadius: 4, marginBottom: 18 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, width: "90%", marginBottom: 10 }}>{[0,1,2].map(i => <div key={i} className="shimmer" style={{ height: 54, borderRadius: 10 }} />)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, width: "90%" }}>{[0,1,2].map(i => <div key={i} className="shimmer" style={{ height: 54, borderRadius: 10 }} />)}</div>
              </div>
            </div>
          </div>
        )}

        <div
          ref={mainSwipeContentRef}
          style={{
            transform: "translate3d(0, 0, 0)",
            willChange: canUseMainSwipe ? "transform" : "auto",
            backfaceVisibility: "hidden",
          }}
        >

        <div style={{ display: view === "home" ? "block" : "none" }}>
        {/* ── HOME ── */}
          <div style={{ paddingLeft: 0, paddingRight: 0 }}>
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
                      <span style={{ color: darkMode ? "#c9d1d9" : "#475569", fontWeight: 700 }}>{items.length}</span> {useT("inLibraryCount")}
                    </p>
                    {/* Stats compactas numa linha */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { l: lang === "en" ? "Progress" : "Curso",   v: stats.assistindo, key: "assistindo" },
                        { l: useT("completo"),                        v: stats.completo,   key: "completo"   },
                        { l: lang === "en" ? "Paused" : "Pausa",     v: stats.pausa,      key: "pausa"      },
                        { l: useT("dropado"),                         v: stats.largado,    key: "largado"    },
                        { l: lang === "en" ? "Planned" : "Planej.",   v: stats.planejado,  key: "planejado"  },
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

                {/* Filter tags — tab style */}
                <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}` }}>
                  {MEDIA_TYPES.slice(1).map((t) => {
                    const active = homeFilter.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => {
                        setHomeFilter(prev =>
                          prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                        );
                      }} style={{
                        flexShrink: 0, background: "none", border: "none",
                        borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
                        marginBottom: -1,
                        color: active ? accent : (activeDarkMode ? "#8b949e" : "#64748b"),
                        padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        WebkitTapHighlightColor: "transparent",
                      }}>
                        {mediaLabel(t, lang)}
                      </button>
                    );
                  })}
                  {homeFilter.length > 0 && (
                    <button onClick={() => setHomeFilter([])} style={{
                      flexShrink: 0, background: "none", border: "none",
                      borderBottom: "2px solid transparent", marginBottom: -1,
                      color: "#ef4444", padding: "8px 10px",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 13,
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
                { label: useT("completedThisMonth"), value: thisMonth, show: thisMonth > 0, icon: "📅" },
                { label: lang === "en" ? "avg rating" : "rating médio", value: avgRating, show: !!avgRating, icon: "★" },
              ].filter(s => s.show);
              if (!stats.length) return null;
              return (
                <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", overflowX: "auto", scrollbarWidth: "none" }}>
                  {stats.map((s, si) => {
                    const c = accentVariant(accent, si);
                    return (
                      <div key={s.label} className="no-tc" style={{
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
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: darkMode ? "#e6edf3" : "#0d1117" }}>{lang === "en" ? "Your library is empty" : "A tua biblioteca está vazia"}</h3>
                <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 24, lineHeight: 1.5 }}>{lang === "en" ? "Start adding anime, movies, games and much more" : "Começa a adicionar animes, filmes, jogos e muito mais"}</p>
                <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 14, borderRadius: 12 }} onClick={() => setView("search")}>
                  {lang === "en" ? "+ Explore titles" : "+ Explorar títulos"}
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
                  <p style={{ fontSize: 14 }}>{lang === "en" ? "No items with this filter" : "Nenhum item com esse filtro"}</p>
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
                    title={useT("completedLabel")}
                    icon="✓"
                    items={completados}
                    filterBtn={
                      <button onClick={() => { setView("library"); setFilterStatus("completo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>{useT("verTudo")}</button>
                    }
                  />

                  {inCurso.length > 0 && completados.length > 0 && (
                    <div style={{ borderTop: "1px solid #21262d", margin: "4px 16px" }} />
                  )}
                  <RowSection
                    title={useT("emCurso")}
                    icon="▶"
                    items={inCurso}
                    collapsed={homeCollapsedCurso}
                    onToggleCollapse={() => setHomeCollapsedCurso(v => !v)}
                    filterBtn={<button onClick={() => { setView("library"); setFilterStatus("assistindo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>{useT("verTudo")}</button>}
                  />
                </>
              );
            })()}


            {/* Divider */}
            <div style={{ borderTop: "1px solid #21262d", margin: "0 16px 28px" }} />

            {/* Recommendations */}
            <div style={{ paddingBottom: 8 }}>
              <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", background: `linear-gradient(90deg, ${accent}, ${accentShade(accent, 40)})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{lang === "en" ? "Featured" : "Em Destaque"}</h3>
                <button onClick={() => loadRecos(true)} disabled={recoLoading} style={{
                  background: "none", border: "none", color: recoLoading ? "#484f58" : accent,
                  cursor: recoLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: 0,
                }}>
                  <span style={{ display: "inline-block", animation: recoLoading ? "spin 0.7s linear infinite" : "none", fontSize: 14 }}>↻</span>
                  {recoLoading ? useT("loading") : useT("refresh")}
                </button>
              </div>
              <RecoCarousel title={lang === "en" ? "For You" : "Para Ti"} icon="✦" items={personalRecos} library={library} onOpen={setSelectedItem} loading={recoLoading} isPersonal={true} />
              <RecoCarousel title={useT("animeTrending")} icon="⛩️" items={recos.anime} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("mangaTrending")} icon="📖" items={recos.manga} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("moviesWeek")} icon="🎬" items={recos.filmes} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("seriesWeek")} icon="📺" items={recos.series} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("topGames")} icon="🎮" items={recos.jogos} library={library} onOpen={setSelectedItem} loading={recoLoading} />
            </div>
          </div>
        </div>
        <div style={{ display: view === "search" ? "block" : "none" }}>
          <div style={{ padding: "20px 16px" }}>
            <div className="tabs-scroll" style={{ marginBottom: 20 }}>
              {MEDIA_TYPES.map((t) => (
                <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => {
                  setActiveTab(t.id);
                  if (searchQuery.trim()) doSearch(searchQuery, t.id);
                }}>
                  {t.icon} {mediaLabel(t, lang)}
                </button>
              ))}
            </div>
            {isSearching && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e" }}>
                <div className="spin" style={{ fontSize: 40, display: "block", marginBottom: 12 }}>◌</div>
                <p>{lang === "en" ? "Searching" : "A pesquisar"}{activeTab !== "all" ? ` in ${mediaLabel(MEDIA_TYPES.find(t=>t.id===activeTab), lang)}` : (lang === "en" ? " across all types" : " em todos os tipos")}...</p>
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
                      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b949e" }}>{useT("recentSearches")}</p>
                      <button onClick={() => { setSearchHistory([]); try { localStorage.removeItem("trackall_search_history"); } catch {} }} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>{useT("clearHistory")}</button>
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
                    <p style={{ marginBottom: 8 }}>{lang === "en" ? "Search something above!" : "Pesquisa algo acima!"}</p>
                    <p style={{ fontSize: 12, color: "#30363d" }}>{lang === "en" ? "Anime · Manga · Series · Movies · Games · Books · and more" : "Anime · Manga · Séries · Filmes · Jogos · Livros · e mais"}</p>
                  </div>
                )}
              </div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <>
                {(() => {
                  const filtered = activeTab === "all" ? searchResults : searchResults.filter(i => i.type === activeTab);
                  return (
                    <>
                      <p style={{ color: "#484f58", fontSize: 13, marginBottom: 16 }}>{filtered.length} resultados{activeTab !== "all" ? ` em ${mediaLabel(MEDIA_TYPES.find(t=>t.id===activeTab), lang)}` : ""} para "<strong style={{ color: activeDarkMode ? "#e6edf3" : "#0d1117" }}>{searchQuery}</strong>"</p>
                      {filtered.length === 0 ? (
                        <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", marginTop: 40 }}>Sem resultados para este tipo. Tenta "All".</p>
                      ) : (
                        <div className="media-grid">
                          {filtered.map((item) => <MediaCard key={item.id} item={item} library={library} onOpen={setSelectedItem} accent={accent} />)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
        <div style={{ display: view === "library" ? "block" : "none" }}>
        {/* ── LIBRARY ── */}
          <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 28px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900 }}>{useT("library")}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Search input */}
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#484f58", fontSize: 12, pointerEvents: "none" }}>🔍</span>
                  <input
                    value={libSearch}
                    onChange={e => setLibSearch(e.target.value)}
                    placeholder={useT("filterPlaceholder")}
                    style={{ padding: "6px 10px 6px 28px", fontSize: 13, width: isMobileDevice ? 110 : 160, borderRadius: 8 }}
                  />
                  {libSearch && <button onClick={() => setLibSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>}
                </div>
                {/* Type counters — PC only */}
                {!isMobileDevice && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
                    {MEDIA_TYPES.slice(1).filter(t => filteredLib.some(i => i.type === t.id)).map(t => (
                      <span key={t.id} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 13 }}>{t.icon}</span>
                        <span style={{ color: darkMode ? "#8b949e" : "#64748b", fontWeight: 700, fontSize: 11 }}>{filteredLib.filter(i => i.type === t.id).length}</span>
                      </span>
                    ))}
                    <span style={{ flexShrink: 0, color: darkMode ? "#484f58" : "#94a3b8", fontSize: 11, marginLeft: 2 }}>· {filteredLib.length}</span>
                  </div>
                )}
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
                  <button key={t.id} className={`tab-btn${isActive ? " active" : ""}`} onClick={() => {
                      setActiveTab(t.id);
                      if (view === "search" && searchQuery.trim()) doSearch(searchQuery, t.id);
                    }}>
                    {t.icon} {mediaLabel(t, lang)}
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
                <p style={{ fontSize: 11, fontWeight: 800, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{useT("status")}</p>
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
                    <span>{s.emoji}</span> {s.id === "all" ? useT("all") : statusLabel(s, lang)}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: filterStatus === s.id ? s.color : "#484f58" }}>
                      {s.id === "all" ? filteredLib.length : items.filter(i => i.userStatus === s.id && (activeTab === "all" || i.type === activeTab)).length}
                    </span>
                  </button>
                ))}
                <div style={{ height: 1, background: "#21262d", margin: "12px 0" }} />
                <p style={{ fontSize: 11, fontWeight: 800, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{lang === "en" ? "Sort" : "Ordenar"}</p>
                {[{id:"date",label: lang === "en" ? "Date" : "Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★ Rating"}].map(s => (
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
                    <button onClick={() => setFilterStatus("all")} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === "all" ? accent : "#30363d"}`, background: filterStatus === "all" ? accent : "transparent", color: filterStatus === "all" ? "white" : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>{useT("all")}</button>
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s.id} onClick={() => setFilterStatus(s.id)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === s.id ? s.color : "#30363d"}`, background: filterStatus === s.id ? `${s.color}22` : "transparent", color: filterStatus === s.id ? s.color : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                        {s.emoji} {statusLabel(s, lang)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", justifyContent: "flex-end" }}>
                    {[{id:"date",label: lang === "en" ? "Date" : "Data"},{id:"title",label:"A–Z"},{id:"rating",label:"★"}].map(s => (
                      <button key={s.id} onClick={() => setLibSort(s.id)} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${libSort === s.id ? accent : "#30363d"}`, background: libSort === s.id ? `${accent}22` : "transparent", color: libSort === s.id ? accent : "#484f58", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, WebkitTapHighlightColor: "transparent" }}>{s.label}</button>
                    ))}
                  </div>
                </div>

                {sortedLib.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#8b949e" }}>{lang === "en" ? "Nothing here yet" : "Nada aqui ainda"}</p>
                    <p style={{ fontSize: 14, marginBottom: 20 }}>{lang === "en" ? "Use search to add media!" : "Usa a pesquisa para adicionar mídias!"}</p>
                    <button className="btn-accent" style={{ padding: "12px 24px" }} onClick={() => { setView("search"); }}>{useT("search")}</button>
                  </div>
                ) : libViewMode === "list" ? (
                  <LibGroupedList
                    items={sortedLib}
                    library={library}
                   
                   
                    onOpen={setSelectedItem}
                  />
                ) : libViewMode === "compact" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6 }}>
                    {sortedLib.map(item => {
                      const libItem = findLibraryEntry(library, item.id, item.type)?.item;
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

        </div>
        <div style={{ display: view === "friends" ? "block" : "none" }}>
        {/* ── FRIENDS ── */}
          {demoMode || !user ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{lang === "en" ? "Friends are waiting!" : "Os teus amigos estão à espera!"}</h3>
              <p style={{ fontSize: 14, color: darkMode ? "#8b949e" : "#64748b", marginBottom: 24, maxWidth: 300, lineHeight: 1.6 }}>{lang === "en" ? "Create a free account to add friends and share your library." : "Cria uma conta gratuita para adicionar amigos e partilhar a tua biblioteca."}</p>
              <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 15, borderRadius: 12 }} onClick={() => { setDemoMode(false); setShowLanding(false); }}>
                {lang === "en" ? "Create free account" : "Criar conta grátis"}
              </button>
            </div>
          ) : (
            <FriendsView user={user} accent={accent} darkMode={activeDarkMode} isMobileDevice={isMobileDevice} library={library} />
          )}
        </div>
        <div style={{ display: view === "profile" ? "block" : "none" }}>
          <div className="profile-desktop-wrap" style={{ padding: 0, background: activeBgImage ? "transparent" : activeBgColor, minHeight: "100vh" }}>
          <ProfileView
            profile={activeProfile}
            library={library}
            accent={accent}
            bgColor={bgColor}
            bgColorMobile={bgColorMobile}
            bgImage={bgImage}
            bgOverlay={bgOverlay}
            bgBlur={bgBlur}
            bgParallax={bgParallax}
            darkMode={activeDarkMode}
            onUpdateProfile={saveProfile}
            onAccentChange={saveAccent}
            onBgChange={saveBg}
            onBgImage={saveBgImage}
            bgImageMobile={bgImageMobile}
            bgSeparateDevices={bgSeparateDevices}
            onBgSeparateDevices={saveBgSeparateDevices}
            onBgImageMobile={saveMobileBgImage}
            onBgColorMobile={saveBgColorMobile}
            isMobileDevice={isMobileDevice}
            onBgOverlay={saveBgOverlay}
            onBgBlur={saveBgBlur}
            onBgParallax={saveBgParallax}
            panelBg={panelBg}
            panelOpacity={panelOpacity}
            onPanelBg={savePanelBg}
            onPanelOpacity={savePanelOpacity}
            textContrast={textContrast}
            onTextContrast={saveTextContrast}
            textContrastMobile={textContrastMobile}
            onTextContrastMobile={saveTextContrastMobile}
            sidebarColor={sidebarColor}
            onSidebarColor={saveSidebarColor}
            lang={lang}
            useT={useT}
            onChangeLang={changeLang}
            userTierlists={userTierlists}
            userLikes={userLikes}
            currentUserId={user?.id}
            onCreateTierlist={() => { setEditingTierlist(null); setShowTierlistEditor(true); }}
            onViewTierlist={setViewingTierlist}
            onLikeTierlist={handleTierlistLike}
            onDeleteTierlist={handleDeleteTierlist}
            userCollections={userCollections}
            userCollectionLikes={userCollectionLikes}
            onCreateCollection={() => { setEditingCollection(null); setShowCollectionEditor(true); }}
            onViewCollection={(col) => { setViewingCollection(col); setView("collection"); }}
            onLikeCollection={handleCollectionLike}
            onDeleteCollection={handleDeleteCollection}
            onSavedThemes={{ themes: savedThemes, save: saveSavedThemes }}
            onTmdbKey={saveTmdbKey}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onWorkerUrl={saveWorkerUrl}
            onSignOut={handleSignOut}
            userEmail={user?.email || ""}
            favorites={activeFavorites}
            onToggleFavorite={toggleFavorite}
            onImportMihon={importMihon}
            onImportPaperback={importPaperback}
            onImportLetterboxd={importLetterboxd}
            onOpen={setSelectedItem}
            diaryPanel={null}
          />
          </div>
        </div>
        <div style={{ display: view === "collection" ? "block" : "none" }}>
          {viewingCollection && (
            <div style={{ background: activeBgImage ? "transparent" : activeBgColor, minHeight: "100vh" }}>
              <CollectionViewer
                col={viewingCollection}
                onClose={() => { setViewingCollection(null); setView("profile"); }}
                onLike={handleCollectionLike}
                liked={userCollectionLikes.includes(viewingCollection.id)}
                currentUserId={user?.id}
                workerUrl={workerUrl}
                onEdit={(col) => { setEditingCollection(col); setShowCollectionEditor(true); }}
                onOpenMedia={(item) => {
                  const libItem = findLibraryEntry(library, item.id, item.type || item.mediaType || "anime")?.item;
                  if (libItem) { setSelectedItem(libItem); } else { setSelectedItem({ id: item.id, title: item.title, type: item.type || item.mediaType || "anime", cover: item.cover }); }
                }}
              />
            </div>
          )}
        </div>

        </div>
        </div>

        {/* TierList Viewer */}
        {viewingTierlist && (
          <TierListViewer
            tl={viewingTierlist}
            onClose={() => setViewingTierlist(null)}
            onLike={handleTierlistLike}
            liked={userLikes.includes(viewingTierlist.id)}
            currentUserId={user?.id}
            onEdit={(tl) => { setViewingTierlist(null); setEditingTierlist(tl); setShowTierlistEditor(true); }}
          />
        )}

        {/* TierList Editor */}
        {showTierlistEditor && (
          <TierListEditor
            initialData={editingTierlist}
            library={library}
            onSave={handleSaveTierlist}
            onClose={() => { setShowTierlistEditor(false); setEditingTierlist(null); }}
            workerUrl={workerUrl}
            tmdbKey={tmdbKey}
          />
        )}

        {/* Collection Editor */}
        {showCollectionEditor && (
          <CollectionModal
            initialData={editingCollection}
            library={Object.values(library)}
            onSave={handleSaveCollection}
            onClose={() => { setShowCollectionEditor(false); setEditingCollection(null); }}
            workerUrl={workerUrl}
          />
        )}

        {/* PWA Install Banner — mobile only */}
        {pwaPrompt && !pwaInstalled && isMobileDevice && (
          <div style={{ position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 60, background: '#161b22', border: `1px solid ${accent}44`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 28 }}>📲</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{useT("installApp")}</p>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{useT("installDesc")}</p>
            </div>
            <button onClick={async () => { pwaPrompt.prompt(); const r = await pwaPrompt.userChoice; if (r.outcome === 'accepted') setPwaInstalled(true); setPwaPrompt(null); }} style={{ background: accent, border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{useT("install")}</button>
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
                    <span>{t.icon}</span> {mediaLabel(t, lang) || useT("all")}
                  </button>
                ))}
              </div>
              <input ref={logInputRef} type="text" value={logQuery} onChange={e => setLogQuery(e.target.value)}
                placeholder={quickSearchType ? `Pesquisar ${MEDIA_TYPES.find(t => t.id === quickSearchType)?.label || ""}...` : "Pesquisar qualquer título..."}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: darkMode ? "#0d1117" : "#f8fafc", border: `1.5px solid ${accent}44`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
              {logSearching && <p style={{ fontSize: 12, color: "#484f58", marginTop: 10 }}>{useT("searching")}</p>}
              {!logQuery && !logSearching && (
                <p style={{ fontSize: 12, color: "#484f58", marginTop: 10, textAlign: "center" }}>{lang === "en" ? "Type to search · tap to mark as complete" : "Escreve para pesquisar · toca para marcar como completo"}</p>
              )}
              {logResults.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {logResults.map(item => (
                    <div key={item.id} onClick={() => {
                      if (findLibraryEntry(library, item.id, item.type)) updateStatus(item.id, "completo");
                      else addToLibrary(item, "completo");
                      setLogOpen(false); setLogQuery(""); setLogResults([]); setLogPendingItem(item);
                    }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: darkMode ? "#21262d" : "#f1f5f9", cursor: "pointer" }}>
                      {(item.cover || item.thumbnailUrl)
                        ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 50, borderRadius: 6, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}{item.year ? ` · ${item.year}` : ""}</p>
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
            { id: "home", icon: "⌂", label: useT("home") },
            { id: "library", icon: "▤", label: useT("library") },
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
            {useT("friends")}
          </button>
          <button className={`nav-btn${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")} style={{ color: view === "profile" ? accent : undefined }}>
            <span style={{ fontSize: 22 }}>◉</span>
            Perfil
          </button>
        </nav>
      </div>
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
