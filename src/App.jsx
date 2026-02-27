import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
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
  // Claro
  { name: "Branco", value: "#ffffff", dark: false },
  { name: "Cinza", value: "#f1f5f9", dark: false },
  { name: "Creme", value: "#fdf6e3", dark: false },
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

// ─── Crop Modal ───────────────────────────────────────────────────────────────
function CropModal({ imageSrc, aspectRatio = 1, onSave, onClose, title = "Recortar imagem" }) {
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [startDrag, setStartDrag] = useState(null);
  const imgRef = useRef(null);

  const CANVAS_W = 320;
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
    onSave(canvas.toDataURL("image/jpeg", 0.85));
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
function DetailModal({ item, library, onAdd, onRemove, onUpdateStatus, onUpdateRating, onChangeCover, onClose, accent, favorites = [], onToggleFavorite }) {
  const [coverEdit, setCoverEdit] = useState(false);
  const [addRating, setAddRating] = useState(0);
  const inLib = !!library[item.id];
  const libItem = library[item.id];
  const coverSrc = libItem?.customCover || item.customCover || item.cover;
  const isFavorite = favorites.some(f => f.id === item.id);
  const canAddFavorite = !isFavorite && favorites.length < 5;
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
            {item.episodes && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{item.episodes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Episódios</div></div>}
            {item.chapters && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{item.chapters}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Capítulos</div></div>}
            {item.volumes && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{item.volumes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Volumes</div></div>}
            {item.status && <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{item.status}</div><div style={{ fontSize: 11, color: "#8b949e" }}>Estado</div></div>}
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#8b949e" }}>NA TUA BIBLIOTECA</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {inLib && onToggleFavorite && (
                      <button onClick={() => onToggleFavorite(item)} style={{
                        background: isFavorite ? "#f59e0b22" : "none",
                        border: `1px solid ${isFavorite ? "#f59e0b" : "#30363d"}`,
                        color: isFavorite ? "#f59e0b" : "#8b949e",
                        cursor: canAddFavorite || isFavorite ? "pointer" : "not-allowed",
                        fontSize: 11, padding: "4px 8px", borderRadius: 6, fontFamily: "inherit", fontWeight: 600,
                        opacity: !canAddFavorite && !isFavorite ? 0.4 : 1,
                      }} title={isFavorite ? "Remover dos favoritos" : canAddFavorite ? "Adicionar aos favoritos" : "Favoritos cheios (máx. 5)"}>
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
function MediaCard({ item, library, onOpen, accent }) {
  const libItem = library[item.id];
  const inLib = !!libItem;
  const coverSrc = libItem?.customCover || item.cover;
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
      <div style={{ width: "100%", aspectRatio: "2/3", background: gradientFor(item.id), position: "relative", overflow: "hidden" }}>
        {/* Shimmer while loading */}
        {coverSrc && !imgLoaded && !imgError && (
          <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
        )}
        {coverSrc && !imgError ? (
          <img
            src={coverSrc}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={handleError}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center", gap: 6 }}>
            <span style={{ fontSize: 28 }}>{MEDIA_TYPES.find((t) => t.id === item.type)?.icon}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, lineHeight: 1.3 }}>{item.title.slice(0, 40)}</span>
          </div>
        )}
        {/* Badges */}
        <div style={{ position: "absolute", top: 6, left: 6, right: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {item.score && (
            <span style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "2px 6px", fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>
              ★ {item.score}
            </span>
          )}
          {status && (
            <span style={{ background: `${status.color}cc`, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "white", marginLeft: "auto" }}>
              {status.emoji}
            </span>
          )}
        </div>
        {libItem?.userRating > 0 && (
          <div style={{ position: "absolute", bottom: 6, left: 6 }}>
            <div style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "2px 6px", display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 10, color: "#f59e0b" }}>★</span>
              <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>{libItem.userRating}</span>
            </div>
          </div>
        )}
        <div className="card-overlay" style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${accent}33, transparent)`, opacity: 0, transition: "opacity 0.2s" }} />
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
        <p style={{ fontSize: 11, color: "#484f58" }}>
          {MEDIA_TYPES.find((t) => t.id === item.type)?.label}{item.year ? ` · ${item.year}` : ""}
        </p>
        {!inLib && (
          <div style={{ marginTop: 8, padding: "5px 0", borderTop: "1px solid #21262d", fontSize: 11, color: accent, fontWeight: 600 }}>+ Adicionar</div>
        )}
      </div>
    </div>
  );
}

// ─── Profile / Settings View ──────────────────────────────────────────────────
function ProfileView({ profile, library, accent, bgColor, bgImage, bgOverlay, darkMode, onUpdateProfile, onAccentChange, onBgChange, onBgImage, onBgOverlay, onTmdbKey, tmdbKey, workerUrl, onWorkerUrl, onSignOut, userEmail, favorites = [], onToggleFavorite }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || "");
  const [bannerPreview, setBannerPreview] = useState(profile.banner || "");
  const [bannerUrl, setBannerUrl] = useState(profile.banner || "");
  const [cropSrc, setCropSrc] = useState(null);
  const [cropType, setCropType] = useState(null); // "avatar" | "banner"
  const avatarRef = useRef();
  const bannerRef = useRef();
  const items = Object.values(library);
  const byType = {};
  MEDIA_TYPES.slice(1).forEach((t) => { byType[t.id] = items.filter((i) => i.type === t.id).length; });
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
    await onUpdateProfile({ ...profile, name, bio, avatar: avatarPreview, banner: bannerUrl });
    setEditing(false);
  };

  const currentBanner = editing ? bannerPreview : profile.banner;
  const currentAvatar = editing ? avatarPreview : profile.avatar;

  return (
    <>
    <div style={{ paddingBottom: 32, maxWidth: 600, margin: "0 auto" }}>

      {/* ── Banner + Avatar header ── */}
      <div style={{ position: "relative", marginBottom: 60 }}>
        {/* Banner */}
        <div style={{
          height: 160, borderRadius: "0 0 0 0", overflow: "hidden", position: "relative",
          background: currentBanner
            ? `url(${currentBanner}) center/cover no-repeat`
            : `linear-gradient(135deg, ${accent}33 0%, ${bgColor} 100%)`,
        }}>
          {/* Overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(13,17,23,0.85) 100%)" }} />
          {editing && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
              boxShadow: `0 0 0 3px ${accent}`,
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
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-accent" style={{ flex: 1, padding: "10px" }} onClick={handleSave}>Guardar</button>
              <button onClick={() => { setEditing(false); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setAvatarPreview(profile.avatar||""); }} style={{ flex: 1, padding: "10px", background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>{profile.name || "Utilizador"}</h2>
            {profile.bio && <p style={{ color: "#8b949e", fontSize: 14, marginTop: 4 }}>{profile.bio}</p>}
            {userEmail && <p style={{ color: "#484f58", fontSize: 12, marginTop: 4 }}>✉ {userEmail}</p>}
            <p style={{ color: "#484f58", fontSize: 12, marginTop: 4 }}>TrackAll · {items.length} na biblioteca</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => { setName(profile.name||""); setBio(profile.bio||""); setAvatarPreview(profile.avatar||""); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setEditing(true); }} style={{
                padding: "8px 20px", borderRadius: 8, border: `1px solid ${accent}44`,
                background: `${accent}15`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              }}>✏ Editar Perfil</button>
              {onSignOut && (
                <button onClick={onSignOut} style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid #ef444444",
                  background: "#ef444415", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                }}>⏻ Sair</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stats and settings */}
      <div style={{ padding: "0 16px" }}>

      {/* ── Vistos Recentemente ── */}
      {items.length > 0 && (() => {
        const recent = [...items].filter(i => i.userStatus !== "planejado").sort((a, b) => b.addedAt - a.addedAt).slice(0, 10);
        return (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e" }}>VISTOS RECENTEMENTE</h3>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {recent.map((item) => {
                const coverSrc = item.customCover || item.cover;
                return (
                  <div key={item.id} style={{ flexShrink: 0, width: 72, cursor: "pointer" }}>
                    <div style={{ width: 72, height: 104, borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), border: "2px solid #21262d", marginBottom: 6 }}>
                      {coverSrc
                        ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.currentTarget.style.display = "none"} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                      }
                    </div>
                    <p style={{ fontSize: 10, color: "#8b949e", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Favoritos Manuais ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#8b949e" }}>FAVORITOS</h3>
          <span style={{ fontSize: 11, color: "#484f58" }}>{favorites.length}/5</span>
        </div>
        {favorites.length === 0 ? (
          <div style={{ background: "#161b22", border: "1px dashed #30363d", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <p style={{ color: "#484f58", fontSize: 13 }}>Abre qualquer item da biblioteca e clica em ☆ Favorito</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {favorites.map((item, idx) => {
              const coverSrc = item.customCover || item.cover;
              const status = STATUS_OPTIONS.find(s => s.id === item.userStatus);
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #f59e0b22", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: idx === 0 ? "#f59e0b" : idx === 1 ? "#9ca3af" : idx === 2 ? "#cd7c2f" : "#484f58", width: 24, textAlign: "center", flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ width: 44, height: 62, borderRadius: 6, overflow: "hidden", background: gradientFor(item.id), flexShrink: 0 }}>
                    {coverSrc
                      ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.currentTarget.style.display = "none"} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {item.userRating > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: 12, color: "#f59e0b" }}>★</span>
                          <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>{item.userRating}</span>
                        </div>
                      )}
                      {status && <span style={{ fontSize: 10, color: status.color, fontWeight: 600 }}>{status.emoji} {status.label}</span>}
                    </div>
                  </div>
                  <button onClick={() => onToggleFavorite && onToggleFavorite(item)} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 16, padding: 4 }} title="Remover dos favoritos">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e" }}>ESTATÍSTICAS</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {STATUS_OPTIONS.map((s) => (
          <div key={s.id} style={{ background: "#161b22", border: `1px solid ${s.color}22`, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{byStatus[s.id] || 0}</div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{avgRating}</div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>Avg. Rating</div>
        </div>
        <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{items.length}</div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>Total</div>
        </div>
        <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{totalRatings.length}</div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>Avaliados</div>
        </div>
      </div>

      {/* Por tipo */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e" }}>POR TIPO</h3>
      <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        {MEDIA_TYPES.slice(1).map((t) => {
          const count = byType[t.id] || 0;
          const pct = items.length ? (count / items.length) * 100 : 0;
          return (
            <div key={t.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{t.icon} {t.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
              </div>
              <div style={{ height: 6, background: "#21262d", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, borderRadius: 999, transition: "width 0.5s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Temas */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e" }}>APARÊNCIA</h3>
      <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 10 }}>Cor de destaque</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {ACCENT_PRESETS.map((p) => (
              <button key={p.name} onClick={() => onAccentChange(p.color)} style={{
                width: 36, height: 36, borderRadius: 999, background: p.color,
                border: accent === p.color ? `3px solid white` : "3px solid transparent",
                cursor: "pointer", transition: "transform 0.1s",
              }} title={p.name} />
            ))}
              <label style={{ width: 36, height: 36, borderRadius: 999, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, position: "relative" }} title="Cor personalizada">
                +
                <input
                  type="color"
                  defaultValue={accent}
                  onBlur={(e) => onAccentChange(e.target.value)}
                  onChange={(e) => {
                    // Update preview in real-time but only save on blur
                    document.documentElement.style.setProperty('--accent-preview', e.target.value);
                  }}
                  style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                />
              </label>
          </div>
        </div>
        <div>
          <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 8 }}>Fundo</p>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={() => { onBgChange("#0d1117"); onBgImage(""); }} style={{
              padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: darkMode ? accent : "#21262d", color: darkMode ? "white" : "#8b949e",
            }}>🌙 Noturno</button>
            <button onClick={() => { onBgChange("#f1f5f9"); onBgImage(""); }} style={{
              padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: !darkMode ? accent : "#21262d", color: !darkMode ? "white" : "#8b949e",
            }}>☀️ Diurno</button>
          </div>

          {/* Color swatches */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {BG_PRESETS.map((p) => (
              <button key={p.name} onClick={() => { onBgChange(p.value); onBgImage(""); }} style={{
                width: 32, height: 32, borderRadius: 8, background: p.value,
                border: bgColor === p.value && !bgImage ? `2px solid ${accent}` : "2px solid #30363d",
                cursor: "pointer", flexShrink: 0,
              }} title={p.name} />
            ))}
            {/* Custom color */}
            <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, position: "relative" }} title="Cor personalizada">
              +
              <input type="color" defaultValue={bgColor} onBlur={(e) => { onBgChange(e.target.value); onBgImage(""); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
            </label>
            {/* Image upload */}
            <label style={{
              width: 32, height: 32, borderRadius: 8, border: bgImage ? `2px solid ${accent}` : "2px dashed #30363d",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16,
              background: bgImage ? `url(${bgImage}) center/cover` : "transparent", overflow: "hidden", flexShrink: 0,
            }} title="Imagem de fundo">
              {!bgImage && "🖼"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                const file = e.target.files[0]; if (!file) return;
                const compressed = await compressImage(file, 1920, 1080, 0.90);
                if (compressed) onBgImage(compressed);
              }} />
            </label>
            {bgImage && (
              <button onClick={() => onBgImage("")} style={{ fontSize: 11, padding: "3px 8px", background: "#ef444422", border: "1px solid #ef444444", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
            )}
          </div>

          {/* Overlay when image is set */}
          {bgImage && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>Escurecimento da imagem</p>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { label: "Nenhum", val: "rgba(0,0,0,0)" },
                  { label: "Suave", val: "rgba(0,0,0,0.3)" },
                  { label: "Médio", val: "rgba(0,0,0,0.55)" },
                  { label: "Forte", val: "rgba(0,0,0,0.75)" },
                  { label: "Branco", val: "rgba(255,255,255,0.6)" },
                ].map(o => (
                  <button key={o.label} onClick={() => onBgOverlay(o.val)} style={{
                    padding: "4px 8px", borderRadius: 6, border: `1px solid ${bgOverlay === o.val ? accent : "#30363d"}`,
                    background: bgOverlay === o.val ? `${accent}22` : "transparent",
                    color: bgOverlay === o.val ? accent : "#8b949e",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                  }}>{o.label}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: "#161b2266", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#484f58", lineHeight: 1.6 }}>
            💡 <strong style={{ color: "#8b949e" }}>Fundo:</strong> Recomendado 1920×1080px (16:9) · Telemóvel: 390×844px (iPhone) ou 360×800px (Android)
          </div>
        </div>
      </div>

      {/* API Status — tudo pré-configurado */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e" }}>CONFIGURAÇÕES API</h3>
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
      </div>

            </div>{/* end padding div */}
    </div>
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
function FriendsView({ user, accent }) {
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
    const recentItems = [...libItems].filter(i => i.userStatus !== "planejado").sort((a,b) => b.addedAt - a.addedAt).slice(0, 20);

    return (
      <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 20 }}>
        <button onClick={() => { setSelectedFriend(null); setFriendData(null); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "16px" }}>← Voltar</button>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "10px 16px 24px" }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", margin: "0 auto 14px", background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, border: `3px solid ${accent}44` }}>
            {friendData.profile?.avatar ? <img src={friendData.profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900 }}>{friendData.profile?.name || selectedFriend.name || "Utilizador"}</h2>
          {friendData.profile?.username && <p style={{ color: "#484f58", fontSize: 14, marginTop: 2 }}>@{friendData.profile.username}</p>}
          {friendData.profile?.bio && <p style={{ color: "#8b949e", fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{friendData.profile.bio}</p>}
        </div>

        {/* Stats */}
        <div style={{ padding: "0 16px", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {STATUS_OPTIONS.map(s => (
              <div key={s.id} style={{ background: "#161b22", border: `1px solid ${s.color}22`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>{s.emoji} {s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <div style={{ background: "#161b22", border: "1px solid #f59e0b22", borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>★ Média de Rating</div>
            </div>
            <div style={{ background: "#161b22", border: "1px solid #a855f722", borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#a855f7" }}>{libItems.length}</div>
              <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>📚 Total na Biblioteca</div>
            </div>
          </div>
        </div>

        {/* Favoritos */}
        {favs.length > 0 && (
          <div style={{ padding: "0 16px", marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#8b949e", marginBottom: 12 }}>FAVORITOS</h3>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {favs.map(item => (
                <div key={item.id} style={{ flexShrink: 0, width: 90 }}>
                  <div style={{ width: 90, height: 130, borderRadius: 10, overflow: "hidden", background: "#21262d", border: `1px solid ${accent}33` }}>
                    {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎭</div>}
                  </div>
                  <p style={{ fontSize: 11, color: "#8b949e", marginTop: 6, lineHeight: 1.3 }}>{item.title?.slice(0,22)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recentes com rating */}
        {recentItems.length > 0 && (
          <div style={{ padding: "0 16px", marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#8b949e", marginBottom: 12 }}>ADICIONADO RECENTEMENTE</h3>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {recentItems.map(item => {
                const status = STATUS_OPTIONS.find(s => s.id === item.userStatus);
                return (
                  <div key={item.id} style={{ flexShrink: 0, width: 84 }}>
                    <div style={{ width: 84, height: 120, borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), position: "relative" }}>
                      {item.cover ? <img src={item.customCover || item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>}
                      {item.userRating > 0 && (
                        <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.8)", borderRadius: 5, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
                          <span style={{ fontSize: 10, color: "#f59e0b" }}>★</span>
                          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>{item.userRating}</span>
                        </div>
                      )}
                      {status && (
                        <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 4px", fontSize: 10 }}>{status.emoji}</div>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "#8b949e", marginTop: 5, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Já viram / Concluídos */}
        {(() => {
          const completed = libItems.filter(i => i.userStatus === "completo").sort((a,b) => b.addedAt - a.addedAt);
          if (completed.length === 0) return null;
          return (
            <div style={{ padding: "0 16px", marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>✓ JÁ VIRAM / CONCLUÍRAM</h3>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {completed.map(item => (
                  <div key={item.id} style={{ flexShrink: 0, width: 84 }}>
                    <div style={{ width: 84, height: 120, borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), position: "relative", border: "1px solid #10b98133" }}>
                      {item.cover ? <img src={item.customCover || item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon}</div>}
                      {item.userRating > 0 && (
                        <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.8)", borderRadius: 5, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
                          <span style={{ fontSize: 10, color: "#f59e0b" }}>★</span>
                          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>{item.userRating}</span>
                        </div>
                      )}
                      <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 4px", fontSize: 10 }}>✓</div>
                    </div>
                    <p style={{ fontSize: 11, color: "#8b949e", marginTop: 5, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 0 20px" }}>
      {notif && <div style={{ margin: "0 16px 12px", padding: "10px 14px", background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 10, fontSize: 13, color: accent, textAlign: "center" }}>{notif}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "0 16px", marginBottom: 20 }}>
        {[
          { id: "friends", label: `Amigos (${accepted.length})` },
          { id: "search", label: "Pesquisar" },
          { id: "requests", label: `Pedidos${pending.length > 0 ? ` (${pending.length})` : ""}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: tab === t.id ? accent : "#21262d",
            color: tab === t.id ? "white" : "#8b949e",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Friends list */}
      {tab === "friends" && (
        <div style={{ padding: "0 16px" }}>
          {loading ? <p style={{ color: "#484f58", textAlign: "center" }}>A carregar...</p>
          : accepted.length === 0 ? <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>Ainda não tens amigos. Pesquisa pelo nome ou username!</p>
          : accepted.map(f => {
            const info = getFriendInfo(f);
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}
                onClick={() => openFriendProfile(info.id, info)}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {info?.avatar ? <img src={info.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{info?.name || "Utilizador"}</p>
                  {info?.username && <p style={{ fontSize: 12, color: "#484f58" }}>@{info.username}</p>}
                </div>
                <span style={{ color: "#484f58", fontSize: 18 }}>→</span>
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
              {item.score > 0 && (
                <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.75)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>
                  ★ {item.score}
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function TrackAll() {
  const [accent, setAccent] = useState("#f97316");
  const [bgColor, setBgColor] = useState("#0d1117");
  const [bgImage, setBgImage] = useState("");
  const [bgOverlay, setBgOverlay] = useState("rgba(0,0,0,0.55)");
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState({ name: "", bio: "", avatar: "" });
  const [library, setLibrary] = useState({});
  const [tmdbKey, setTmdbKey] = useState(DEFAULT_TMDB_KEY);
  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [view, setView] = useState("home");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [notif, setNotif] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
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
        setProfile({ name: prof.name || "", bio: prof.bio || "", avatar: prof.avatar || "", banner: prof.banner || "" });
        if (prof.accent) setAccent(prof.accent);
        if (prof.bg_color) {
          setBgColor(prof.bg_color);
          setDarkMode(isColorDark(prof.bg_color));
        }
        if (prof.bg_image) setBgImage(prof.bg_image);
        if (prof.bg_overlay !== undefined) setBgOverlay(prof.bg_overlay);
        if (prof.tmdb_key) setTmdbKey(prof.tmdb_key);
        else setTmdbKey(DEFAULT_TMDB_KEY);
        if (prof.worker_url) setWorkerUrl(prof.worker_url);
        else setWorkerUrl(DEFAULT_WORKER_URL);
        if (prof.favorites) setFavorites(prof.favorites);
      }
      if (lib) setLibrary(lib);
    } catch {}
    // Load recommendations in background
    loadRecos();
  };

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

  const showNotif = (msg, color) => { setNotif({ msg, color }); setTimeout(() => setNotif(null), 2500); };

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
        });
      } catch {}
    }
  };

  const saveAccent = async (c) => {
    setAccent(c);
    if (user) try { await supa.upsertProfile(user.id, { accent: c }); } catch {}
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
  const saveBgImage = async (img) => {
    setBgImage(img);
    if (user) try { await supa.upsertProfile(user.id, { bg_image: img }); } catch {}
  };
  const saveTmdbKey = async (k) => {
    setTmdbKey(k);
    if (user) try { await supa.upsertProfile(user.id, { tmdb_key: k }); } catch {}
  };
  const saveWorkerUrl = async (k) => {
    setWorkerUrl(k);
    if (user) try { await supa.upsertProfile(user.id, { worker_url: k }); } catch {}
  };

  const addToLibrary = (item, status, rating = 0) => {
    const lib = { ...library, [item.id]: { ...item, userStatus: status, userRating: rating, addedAt: Date.now() } };
    saveLibrary(lib);
    showNotif(`"${item.title.slice(0, 30)}" adicionado!`, "#10b981");
  };
  const removeFromLibrary = (id) => {
    const lib = { ...library }; delete lib[id]; saveLibrary(lib);
    showNotif("Removido da biblioteca", "#ef4444");
  };
  const updateStatus = (id, status) => {
    if (!library[id]) return;
    saveLibrary({ ...library, [id]: { ...library[id], userStatus: status } });
    showNotif("Estado atualizado!", accent);
  };
  const updateRating = (id, rating) => {
    if (!library[id]) return;
    saveLibrary({ ...library, [id]: { ...library[id], userRating: rating } });
    showNotif(rating > 0 ? `${rating} ★` : "Avaliação removida", "#f59e0b");
  };
  const updateCover = (id, url) => {
    if (!library[id]) return;
    saveLibrary({ ...library, [id]: { ...library[id], customCover: url } });
    showNotif("Capa atualizada!", accent);
  };

  const toggleFavorite = async (item) => {
    const exists = favorites.some(f => f.id === item.id);
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => f.id !== item.id);
      showNotif("Removido dos favoritos", "#8b949e");
    } else {
      if (favorites.length >= 5) { showNotif("Máximo de 5 favoritos!", "#ef4444"); return; }
      newFavs = [...favorites, { id: item.id, title: item.title, cover: item.cover, type: item.type }];
      showNotif("Adicionado aos favoritos! ★", "#f59e0b");
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
    } catch (e) {
      setSearchError("Erro ao pesquisar. Verifica a tua ligação à internet.");
    } finally {
      setIsSearching(false);
    }
  }, [tmdbKey, workerUrl]);

  const items = Object.values(library);
  const stats = {
    assistindo: items.filter((i) => i.userStatus === "assistindo").length,
    completo: items.filter((i) => i.userStatus === "completo").length,
    planejado: items.filter((i) => i.userStatus === "planejado").length,
  };

  const filteredLib = items.filter((i) => {
    if (filterStatus !== "all" && i.userStatus !== filterStatus) return false;
    if (activeTab !== "all" && i.type !== activeTab) return false;
    return true;
  });

  const accentRgb = `${parseInt(accent.slice(1, 3), 16)},${parseInt(accent.slice(3, 5), 16)},${parseInt(accent.slice(5, 7), 16)}`;

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

  return (
    <ThemeContext.Provider value={{ accent, bg: bgColor }}>
      <div style={{
        minHeight: "100vh",
        background: bgImage
          ? `linear-gradient(${bgOverlay}, ${bgOverlay}), url(${bgImage}) center/cover fixed`
          : bgColor,
        color: darkMode ? "#e6edf3" : "#0d1117",
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        paddingBottom: 80,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { overscroll-behavior: none; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${darkMode ? "#30363d" : "#cbd5e1"}; border-radius: 3px; }
          .btn-accent { background: linear-gradient(135deg, ${accent}, ${accent}cc); color: white; border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 700; transition: all 0.2s; }
          .btn-accent:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(${accentRgb},0.4); }
          .card { background: ${darkMode ? "#161b22" : "rgba(255,255,255,0.85)"}; border: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"}; border-radius: 12px; overflow: hidden; transition: all 0.2s; backdrop-filter: blur(4px); }
          .card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); border-color: ${darkMode ? "#30363d" : "#cbd5e1"}; }
          .card:hover .card-overlay { opacity: 1 !important; }
          .tab-btn { background: transparent; border: none; color: ${darkMode ? "#8b949e" : "#64748b"}; cursor: pointer; padding: 7px 14px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s; }
          .tab-btn:hover { color: ${darkMode ? "#e6edf3" : "#0d1117"}; background: ${darkMode ? "#21262d" : "#e2e8f0"}; }
          .tab-btn.active { background: ${accent}; color: white; font-weight: 700; }
          input, select, textarea { background: ${darkMode ? "#0d1117" : "#ffffff"}; color: ${darkMode ? "#e6edf3" : "#0d1117"}; border: 1px solid ${darkMode ? "#30363d" : "#e2e8f0"}; border-radius: 10px; font-family: 'Outfit', sans-serif; transition: border-color 0.15s; }
          input::placeholder { color: ${darkMode ? "#484f58" : "#94a3b8"}; }
          input:focus, select:focus { outline: none; border-color: ${accent}; box-shadow: 0 0 0 3px rgba(${accentRgb},0.1); }
          .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
          .modal { background: ${darkMode ? "#161b22" : "#ffffff"}; border: 1px solid ${darkMode ? "#30363d" : "#e2e8f0"}; border-radius: 16px; width: 100%; overflow: hidden; }
          .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
          .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${darkMode ? "rgba(22,27,34,0.96)" : "rgba(255,255,255,0.96)"}; backdrop-filter: blur(12px); border-top: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"}; display: flex; height: 64px; z-index: 50; }
          .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; transition: color 0.15s; color: ${darkMode ? "#484f58" : "#94a3b8"}; }
          .nav-btn.active { color: ${accent}; }
          .nav-btn:hover { color: ${darkMode ? "#8b949e" : "#64748b"}; }
          .tabs-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .tabs-scroll::-webkit-scrollbar { display: none; }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          .shimmer { background: linear-gradient(90deg, ${darkMode ? "#21262d" : "#e2e8f0"} 25%, ${darkMode ? "#30363d" : "#f1f5f9"} 50%, ${darkMode ? "#21262d" : "#e2e8f0"} 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          .fade-in { animation: fadeIn 0.3s ease; }
          @keyframes spin { to { transform: rotate(360deg); } }
          .spin { animation: spin 0.7s linear infinite; display: inline-block; }
          .hero-gradient { background: radial-gradient(ellipse 70% 50% at 50% -10%, rgba(${accentRgb},0.12) 0%, transparent 70%), ${bgImage ? "transparent" : bgColor}; }
        `}</style>

        <Notification notif={notif} />



        {/* Detail Modal */}
        {selectedItem && (
          <DetailModal
            item={selectedItem}
            library={library}
            onAdd={addToLibrary}
            onRemove={(id) => { removeFromLibrary(id); setSelectedItem(null); }}
            onUpdateStatus={updateStatus}
            onUpdateRating={updateRating}
            onChangeCover={updateCover}
            onClose={() => setSelectedItem(null)}
            accent={accent}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {/* NAV TOP */}
        <nav style={{ background: `${bgColor}ee`, backdropFilter: "blur(14px)", borderBottom: "1px solid #21262d", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 56, position: "sticky", top: 0, zIndex: 40 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white" }}>T</div>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#e6edf3", letterSpacing: "-0.5px" }}>TrackAll</span>
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#484f58", fontSize: 14 }}>🔍</span>
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
          <div className="fade-in">
            {/* Setup banner — só aparece quando faltam chaves importantes */}
            {/* Setup banner removido — configurações pré-definidas */}
            <div className="hero-gradient" style={{ padding: "56px 20px 48px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `rgba(${accentRgb},0.1)`, border: `1px solid rgba(${accentRgb},0.2)`, borderRadius: 999, padding: "5px 14px", marginBottom: 24, fontSize: 12, color: accent, fontWeight: 600 }}>
                ✦ Organiza toda a tua mídia num só lugar
              </div>
              <h1 style={{ fontSize: "clamp(32px,8vw,68px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 18, letterSpacing: "-1px" }}>
                Acompanha{" "}
                <span style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Tudo</span>{" "}
                que<br />Adoras
              </h1>
              <p style={{ color: "#8b949e", fontSize: 16, maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.7 }}>
                Anime, séries, filmes, manga, livros, manhwa, light novels, jogos e comics.
              </p>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 480, margin: "0 auto 40px" }}>
                {[
                  { l: "Em Curso", v: stats.assistindo, c: accent, e: "▶" },
                  { l: "Completos", v: stats.completo, c: "#10b981", e: "✓" },
                  { l: "Planejados", v: stats.planejado, c: "#06b6d4", e: "⏰" },
                ].map((s) => (
                  <div key={s.l} style={{ background: "#161b22", border: `1px solid ${s.c}22`, borderRadius: 14, padding: "18px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{s.e}</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ color: "#8b949e", fontSize: 12, marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Media type shortcuts */}
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
                {MEDIA_TYPES.slice(1).map((t) => (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); doSearch(t.label, t.id); }} style={{ background: "#161b22", border: "1px solid #21262d", color: "#e6edf3", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#21262d"; e.currentTarget.style.color = "#e6edf3"; }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent */}
            {items.length > 0 && (
              <div style={{ padding: "28px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>Recentes</h2>
                  <button onClick={() => setView("library")} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>Ver tudo →</button>
                </div>
                <div className="media-grid">
                  {items.filter(i => i.userStatus !== "planejado").sort((a,b)=>b.addedAt-a.addedAt).slice(0,12).map((item) => (
                    <MediaCard key={item.id} item={item} library={library} onOpen={setSelectedItem} accent={accent} />
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid #21262d", margin: "0 16px 28px" }} />

            {/* Recommendations */}
            <div style={{ paddingBottom: 8 }}>
              <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900 }}>📡 Em Destaque</h2>
                  <p style={{ fontSize: 13, color: "#484f58", marginTop: 4 }}>Tendências desta semana</p>
                </div>
                <button onClick={loadRecos} disabled={recoLoading} style={{
                  background: recoLoading ? "#21262d" : `${accent}22`,
                  border: `1px solid ${recoLoading ? "#30363d" : accent + "44"}`,
                  color: recoLoading ? "#484f58" : accent,
                  borderRadius: 10, padding: "8px 14px", cursor: recoLoading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s",
                }}>
                  <span style={{ display: "inline-block", animation: recoLoading ? "spin 0.7s linear infinite" : "none" }}>↻</span>
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
          <div style={{ padding: "20px 16px" }} className="fade-in">
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
              <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🔍</div>
                <p style={{ marginBottom: 8 }}>Pesquisa algo acima!</p>
                <p style={{ fontSize: 12, color: "#30363d" }}>Anime · Manga · Séries · Filmes · Jogos · Livros · e mais</p>
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
          <div style={{ padding: "20px 16px" }} className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900 }}>Biblioteca</h2>
              <span style={{ color: "#484f58", fontSize: 13 }}>{items.length} itens</span>
            </div>

            <div className="tabs-scroll" style={{ marginBottom: 14 }}>
              {MEDIA_TYPES.map((t) => (
                <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>
                  {t.icon} {t.label}
                  <span style={{ background: "#21262d", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
                    {t.id === "all" ? items.length : items.filter((i) => i.type === t.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => setFilterStatus("all")} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #30363d", background: filterStatus === "all" ? "#21262d" : "transparent", color: filterStatus === "all" ? "#e6edf3" : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>Todos</button>
              {STATUS_OPTIONS.map((s) => (
                <button key={s.id} onClick={() => setFilterStatus(s.id)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${filterStatus === s.id ? s.color : "#30363d"}`, background: filterStatus === s.id ? `${s.color}18` : "transparent", color: filterStatus === s.id ? s.color : "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            {filteredLib.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#484f58" }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
                <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#8b949e" }}>Nada aqui ainda</p>
                <p style={{ fontSize: 14, marginBottom: 20 }}>Usa a pesquisa para adicionar mídias!</p>
                <button className="btn-accent" style={{ padding: "12px 24px" }} onClick={() => { setView("search"); }}>Pesquisar</button>
              </div>
            ) : (
              <div className="media-grid">
                {filteredLib.sort((a, b) => b.addedAt - a.addedAt).map((item) => (
                  <MediaCard key={item.id} item={item} library={library} onOpen={setSelectedItem} accent={accent} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE ── */}
        {view === "friends" && (
          <FriendsView user={user} accent={accent} />
        )}
        {view === "profile" && (
          <ProfileView
            profile={profile}
            library={library}
            accent={accent}
            bgColor={bgColor}
            bgImage={bgImage}
            bgOverlay={bgOverlay}
            darkMode={darkMode}
            onUpdateProfile={saveProfile}
            onAccentChange={saveAccent}
            onBgChange={saveBg}
            onBgImage={saveBgImage}
            onBgOverlay={saveBgOverlay}
            onTmdbKey={saveTmdbKey}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onWorkerUrl={saveWorkerUrl}
            onSignOut={handleSignOut}
            userEmail={user?.email || ""}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">
          {[
            { id: "home", icon: "⌂", label: "Início" },
            { id: "search", icon: "⌕", label: "Pesquisar" },
            { id: "library", icon: "▤", label: "Biblioteca" },
            { id: "friends", icon: "👥", label: "Amigos" },
            { id: "profile", icon: "◉", label: "Perfil" },
          ].map((n) => (
            <button key={n.id} className={`nav-btn${view === n.id ? " active" : ""}`} onClick={() => setView(n.id)} style={{ color: view === n.id ? accent : undefined }}>
              <span style={{ fontSize: 22 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </div>
    </ThemeContext.Provider>
  );
}
