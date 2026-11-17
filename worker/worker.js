// ─────────────────────────────────────────────────────────────────────────────
// TrackAll proxy (Cloudflare Worker) — v7.2
//
// Este ficheiro é a cópia versionada do worker. NÃO é publicado pela Vercel:
// para entrar em vigor, cola-o em Cloudflare → Workers → trackall-proxy → Edit code → Deploy.
//
// Novidades face à v6.6 (as rotas antigas ficam iguais):
//  • CORS: ALLOWED_ORIGIN aceita uma lista separada por vírgulas e o localhost (qualquer porta) é sempre aceite.
//  • /openlibrary/search e /openlibrary/work  (livros — sem chave)
//  • /comicvine-volume                         (detalhe completo de uma série de comics)
//  • /hardcover/search                         (livros — precisa do segredo HARDCOVER_TOKEN)
//  • v7.2: /comicvine-volume e /comicvine-arc vão buscar personagens, criadores e sinopse à 1.ª edição (?debug=1 no volume mostra o que o ComicVine devolve)
//  • v7.1: /comicvine aceita resources=story_arc (arcos), /comicvine-volume devolve personagens (com imagem) e usa a
//          descrição da 1.ª edição quando a da série vem vazia, /comicvine-arc (detalhe de um arco),
//          /openlibrary/search aceita author= (pesquisa por autor)
//  • /health passa a indicar openLibrary e hardcover
//  • Pequena cache em memória (e Cache API quando disponível) para poupar limites das APIs
// ─────────────────────────────────────────────────────────────────────────────

const UA = "TrackAll/1.0 (+https://trackall-green.vercel.app)";

// ── Tokens IGDB (inalterado) ──────────────────────────────────────────────────
let igdbTokenMem = null;
const IGDB_TOKEN_CACHE_KEY = "https://trackall-internal.invalid/igdb-token";

async function getIgdbToken(env, forceRefresh = false) {
  if (!forceRefresh) {
    if (igdbTokenMem) return igdbTokenMem;
    try {
      const hit = await caches.default.match(IGDB_TOKEN_CACHE_KEY);
      if (hit) {
        igdbTokenMem = await hit.text();
        return igdbTokenMem;
      }
    } catch (e) {
    }
    return env.IGDB_ACCESS_TOKEN;
  }
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) return null;
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${env.IGDB_CLIENT_ID}&client_secret=${env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`, { method: "POST" });
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.access_token) return null;
  igdbTokenMem = d.access_token;
  try {
    const ttl = Math.max(60, (d.expires_in || 3600) - 3600);
    await caches.default.put(IGDB_TOKEN_CACHE_KEY, new Response(d.access_token, { headers: { "Cache-Control": `max-age=${ttl}` } }));
  } catch (e) {
  }
  return igdbTokenMem;
}

async function igdbFetch(env, endpoint, body) {
  const call = (token) => fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: { "Client-ID": env.IGDB_CLIENT_ID, "Authorization": `Bearer ${token}`, "Content-Type": "text/plain" },
    body
  });
  let resp = await call(await getIgdbToken(env));
  if (resp.status === 401) {
    const fresh = await getIgdbToken(env, true);
    if (fresh) resp = await call(fresh);
  }
  return resp;
}

// ── Utilitários ───────────────────────────────────────────────────────────────
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}

class UpstreamError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// CORS: "*" (por omissão), ou uma lista de origens separadas por vírgulas em ALLOWED_ORIGIN.
// O localhost / 127.0.0.1 (qualquer porta) é sempre aceite, para poderes testar com `npm run dev`.
function corsFor(request, env) {
  const origin = request.headers.get("Origin") || "";
  const raw = (env.ALLOWED_ORIGIN || "*").trim();
  let allow;
  if (raw === "*") {
    allow = "*";
  } else {
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const isDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    allow = origin && (list.includes(origin) || isDev) ? origin : "null";
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

// Cache: memória do isolate (rápida, curta) + Cache API (quando o domínio a suporta).
// Nota: nos domínios *.workers.dev a Cache API pode não guardar nada; a memória e a cache da app compensam.
const memCache = new Map();
const MEM_MAX = 400;

async function cached(key, ttlSec, producer) {
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit && hit.exp > now) return hit.val;
  let cacheReq = null;
  try {
    cacheReq = new Request("https://trackall-internal.invalid/c/" + encodeURIComponent(key));
    const c = await caches.default.match(cacheReq);
    if (c) {
      const v = await c.json();
      memCache.set(key, { val: v, exp: now + Math.min(ttlSec, 3600) * 1000 });
      return v;
    }
  } catch (e) {
  }
  const val = await producer();
  if (val !== null && val !== undefined) {
    if (memCache.size >= MEM_MAX) memCache.delete(memCache.keys().next().value);
    memCache.set(key, { val, exp: now + Math.min(ttlSec, 3600) * 1000 });
    try {
      if (cacheReq) await caches.default.put(cacheReq, new Response(JSON.stringify(val), { headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttlSec}` } }));
    } catch (e) {
    }
  }
  return val;
}

const DAY = 86400;

function htmlToText(html, max = 2500) {
  if (!html) return "";
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|ul|ol|div|table|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

// Limitador simples para o Hardcover (60/min no plano grátis): no máximo 45 pedidos por minuto por isolate
const hcStamps = [];
function hardcoverAllowed() {
  const now = Date.now();
  while (hcStamps.length && now - hcStamps[0] > 60000) hcStamps.shift();
  if (hcStamps.length >= 45) return false;
  hcStamps.push(now);
  return true;
}

async function fetchJson(url, init, what) {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new UpstreamError(resp.status, `${what} erro ${resp.status}`);
  return resp.json();
}

// ── Worker ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const corsHeaders = corsFor(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/igdb" && request.method === "POST") {
      const body = await request.text();
      try {
        if (!env.IGDB_CLIENT_ID || !(env.IGDB_ACCESS_TOKEN || env.IGDB_CLIENT_SECRET))
          return json({ error: "IGDB nao configurado." }, 500, corsHeaders);
        const resp = await igdbFetch(env, "games", body);
        if (!resp.ok) return json({ error: `IGDB erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno IGDB", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/igdb-query" && request.method === "POST") {
      const { endpoint, body } = await request.json();
      try {
        if (!env.IGDB_CLIENT_ID || !(env.IGDB_ACCESS_TOKEN || env.IGDB_CLIENT_SECRET))
          return json({ error: "IGDB nao configurado." }, 500, corsHeaders);
        const valid = [
          "games", "screenshots", "dlcs", "expansions", "game_videos", "involved_companies", "covers", "artworks",
          "game_time_to_beat", "game_time_to_beats", "franchises", "collections", "platforms", "genres", "themes",
          "age_ratings", "external_games"
        ];
        if (!valid.includes(endpoint)) return json({ error: "Endpoint IGDB invalido: " + endpoint }, 400, corsHeaders);
        const resp = await igdbFetch(env, endpoint, body);
        if (!resp.ok) return json({ error: `IGDB erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno IGDB", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/steam" && request.method === "GET") {
      const query = url.searchParams.get("q");
      if (!query) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      try {
        const resp = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=portuguese&cc=PT`, { headers: { "User-Agent": "TrackAll/1.0" } });
        if (!resp.ok) return json({ error: `Steam erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno Steam", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/comicvine" && request.method === "GET") {
      const query = url.searchParams.get("q");
      if (!query) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      // resources: "volume" (séries, por omissão) ou "story_arc" (arcos / eventos)
      const resources = url.searchParams.get("resources") === "story_arc" ? "story_arc" : "volume";
      const fields = resources === "story_arc" ? "id,name,image,deck,publisher" : "id,name,image,start_year,deck,publisher,count_of_issues";
      try {
        if (!env.COMICVINE_KEY) return json({ error: "ComicVine nao configurado." }, 500, corsHeaders);
        const resp = await fetch(`https://comicvine.gamespot.com/api/search/?api_key=${env.COMICVINE_KEY}&format=json&query=${encodeURIComponent(query)}&resources=${resources}&field_list=${fields}&limit=24`, { headers: { "User-Agent": "TrackAll/1.0" } });
        if (!resp.ok) return json({ error: `ComicVine erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno ComicVine", detail: e.message }, 500, corsHeaders);
      }
    }

    // Ajudante ComicVine: lê uma edição e devolve descrição, personagens e criadores (com imagens)
    const cvIssueExtras = async (cv, issueId) => {
      const out = { description: "", characters: [], creators: [] };
      if (!issueId) return out;
      try {
        const ij = await cv(`issue/4000-${issueId}/?field_list=description,deck,character_credits,person_credits`);
        const ir = (ij && ij.results) || {};
        out.description = htmlToText(ir.description) || ir.deck || "";
        out.characters = (Array.isArray(ir.character_credits) ? ir.character_credits : []).map((c) => ({ id: c.id, name: c.name || "" }));
        const wanted = /writer|penciler|artist|inker|colorist|cover|plotter|script/i;
        const seen = new Set();
        out.creators = (Array.isArray(ir.person_credits) ? ir.person_credits : [])
          .filter((p) => p.id && wanted.test(p.role || "") && !seen.has(p.id) && seen.add(p.id))
          .slice(0, 10)
          .map((p) => ({ id: p.id, name: p.name || "", role: String(p.role || "").split(",")[0].trim() }));
      } catch (e) {
      }
      return out;
    };
    const cvImages = async (cv, kind, list) => {
      if (!list.length) return list.map((x) => ({ ...x, image: null }));
      try {
        const cj = await cv(`${kind}/?filter=id:${list.map((x) => x.id).join("|")}&field_list=id,name,image&limit=${list.length}`);
        const byId = {};
        for (const c of ((cj && cj.results) || [])) byId[c.id] = c;
        return list.map((x) => ({ ...x, image: (byId[x.id] && byId[x.id].image && (byId[x.id].image.medium_url || byId[x.id].image.small_url)) || null }));
      } catch (e) {
        return list.map((x) => ({ ...x, image: null }));
      }
    };

    // NOVO — detalhe completo de uma série (volume) do ComicVine, com personagens e descrição de recurso
    if (path === "/comicvine-volume" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      if (!/^\d{1,9}$/.test(id)) return json({ error: "Parametro id invalido" }, 400, corsHeaders);
      try {
        if (!env.COMICVINE_KEY) return json({ error: "ComicVine nao configurado." }, 500, corsHeaders);
        const cv = (p) => fetchJson(`https://comicvine.gamespot.com/api/${p}${p.includes("?") ? "&" : "?"}api_key=${env.COMICVINE_KEY}&format=json`, { headers: { "User-Agent": "TrackAll/1.0" } }, "ComicVine");
        if (url.searchParams.get("debug") === "1") {
          const j = await cv(`volume/4050-${id}/?field_list=id,name,description,deck,count_of_issues,first_issue,last_issue,characters,people`);
          const r = (j && j.results) || {};
          const ex = await cvIssueExtras(cv, r.first_issue && r.first_issue.id);
          return json({ volumeKeys: Object.keys(r), firstIssue: r.first_issue || null, volumeCharacters: Array.isArray(r.characters) ? r.characters.length : r.characters, volumePeople: Array.isArray(r.people) ? r.people.length : r.people, issueDescriptionLen: ex.description.length, issueCharacters: ex.characters.length, issueCreators: ex.creators }, 200, corsHeaders);
        }
        const data = await cached(`cvvol3:${id}`, 3 * DAY, async () => {
          const j = await cv(`volume/4050-${id}/?field_list=id,name,description,deck,image,start_year,publisher,count_of_issues,first_issue,last_issue,characters,people`);
          const r = j && j.results;
          if (!r || Array.isArray(r)) throw new UpstreamError(404, "ComicVine: volume nao encontrado");
          const ex = await cvIssueExtras(cv, r.first_issue && r.first_issue.id);
          const description = htmlToText(r.description) || ex.description || r.deck || "";
          // Personagens: as da série (mais aparições primeiro) + as da 1.ª edição, sem repetir
          const fromVol = (Array.isArray(r.characters) ? r.characters : [])
            .sort((x, y) => (parseInt(y.count, 10) || 0) - (parseInt(x.count, 10) || 0))
            .map((c) => ({ id: c.id, name: c.name || "" }));
          const seen = new Set();
          const chars = [...fromVol, ...ex.characters].filter((c) => c.id && !seen.has(c.id) && seen.add(c.id)).slice(0, 12);
          const characters = await cvImages(cv, "characters", chars);
          // Criadores: os da 1.ª edição (com função) ou, se não houver, os da série
          let cre = ex.creators;
          if (!cre.length) cre = (Array.isArray(r.people) ? r.people : []).slice(0, 8).map((p) => ({ id: p.id, name: p.name || "", role: "" }));
          const creators = await cvImages(cv, "people", cre);
          return {
            id: r.id,
            name: r.name || "",
            description,
            deck: r.deck || "",
            image: r.image || null,
            startYear: r.start_year || "",
            publisher: (r.publisher && r.publisher.name) || "",
            countOfIssues: r.count_of_issues || 0,
            firstIssue: r.first_issue ? { name: r.first_issue.name || "", number: r.first_issue.issue_number || "" } : null,
            lastIssue: r.last_issue ? { name: r.last_issue.name || "", number: r.last_issue.issue_number || "" } : null,
            characters,
            creators
          };
        });
        return json(data, 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro ComicVine volume", detail: e.message }, e instanceof UpstreamError ? e.status : 500, corsHeaders);
      }
    }

    // NOVO — detalhe de um arco narrativo (story arc) do ComicVine
    if (path === "/comicvine-arc" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      if (!/^\d{1,9}$/.test(id)) return json({ error: "Parametro id invalido" }, 400, corsHeaders);
      try {
        if (!env.COMICVINE_KEY) return json({ error: "ComicVine nao configurado." }, 500, corsHeaders);
        const data = await cached(`cvarc2:${id}`, 3 * DAY, async () => {
          const cv = (p) => fetchJson(`https://comicvine.gamespot.com/api/${p}${p.includes("?") ? "&" : "?"}api_key=${env.COMICVINE_KEY}&format=json`, { headers: { "User-Agent": "TrackAll/1.0" } }, "ComicVine");
          const j = await cv(`story_arc/4045-${id}/?field_list=id,name,description,deck,image,publisher,first_appeared_in_issue,issues`);
          const r = j && j.results;
          if (!r || Array.isArray(r)) throw new UpstreamError(404, "ComicVine: arco nao encontrado");
          const issues = Array.isArray(r.issues) ? r.issues : [];
          const ex = await cvIssueExtras(cv, r.first_appeared_in_issue && r.first_appeared_in_issue.id);
          return {
            id: r.id,
            name: r.name || "",
            description: htmlToText(r.description) || r.deck || ex.description || "",
            deck: r.deck || "",
            image: r.image || null,
            publisher: (r.publisher && r.publisher.name) || "",
            issueCount: issues.length,
            firstIssue: r.first_appeared_in_issue ? { name: r.first_appeared_in_issue.name || "", number: r.first_appeared_in_issue.issue_number || "" } : null,
            characters: await cvImages(cv, "characters", ex.characters.slice(0, 12)),
            creators: await cvImages(cv, "people", ex.creators)
          };
        });
        return json(data, 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro ComicVine arco", detail: e.message }, e instanceof UpstreamError ? e.status : 500, corsHeaders);
      }
    }

    if (path === "/comicvine-char" && request.method === "GET") {
      const query = url.searchParams.get("q");
      if (!query) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      try {
        if (!env.COMICVINE_KEY) return json({ error: "ComicVine nao configurado." }, 500, corsHeaders);
        const resp = await fetch(`https://comicvine.gamespot.com/api/characters/?api_key=${env.COMICVINE_KEY}&format=json&filter=name:${encodeURIComponent(query)}&field_list=id,name,image,deck,publisher&limit=15`, { headers: { "User-Agent": "TrackAll/1.0" } });
        if (!resp.ok) return json({ error: `ComicVine erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno ComicVine Char", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/tmdb" && request.method === "GET") {
      const endpoint = url.searchParams.get("endpoint") || "";
      try {
        if (!env.TMDB_KEY) return json({ error: "TMDB nao configurado." }, 500, corsHeaders);
        if (!endpoint || !endpoint.startsWith("/")) return json({ error: "Parametro endpoint obrigatorio" }, 400, corsHeaders);
        const params = new URLSearchParams();
        params.set("api_key", env.TMDB_KEY);
        for (const [k, v] of url.searchParams.entries()) {
          if (k !== "endpoint") params.set(k, v);
        }
        const resp = await fetch(`https://api.themoviedb.org/3${endpoint}?${params.toString()}`);
        if (!resp.ok) return json({ error: `TMDB erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno TMDB", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/anilist" && request.method === "POST") {
      const body = await request.text();
      try {
        const resp = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA },
          body
        });
        if (!resp.ok) {
          const detail = (await resp.text().catch(() => "")).slice(0, 200);
          return json({ error: `AniList erro ${resp.status}`, detail }, resp.status, corsHeaders);
        }
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno AniList", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/books" && request.method === "GET") {
      const query = url.searchParams.get("q");
      if (!query) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      try {
        if (!env.GOOGLE_BOOKS_KEY) return json({ error: "Google Books nao configurado." }, 500, corsHeaders);
        const maxResults = url.searchParams.get("maxResults") || "24";
        const resp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${env.GOOGLE_BOOKS_KEY}`);
        if (!resp.ok) return json({ error: `Google Books erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno Google Books", detail: e.message }, 500, corsHeaders);
      }
    }

    // NOVO — Open Library: pesquisa (sem chave)
    if (path === "/openlibrary/search" && request.method === "GET") {
      const author = (url.searchParams.get("author") || "").trim();
      const q = author || (url.searchParams.get("q") || "").trim();
      if (!q) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get("limit") || "12", 10) || 12));
      try {
        const data = await cached(`ols:${author ? "a:" : ""}${q.toLowerCase()}:${limit}`, DAY, async () => {
          const j = await fetchJson(
            `https://openlibrary.org/search.json?${author ? "author" : "q"}=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,isbn,subject,ratings_average,ratings_count`,
            { headers: { "User-Agent": UA, "Accept": "application/json" } }, "Open Library");
          return {
            results: (j.docs || []).map((d) => ({
              key: d.key || "",
              title: d.title || "",
              authors: (d.author_name || []).slice(0, 3),
              year: d.first_publish_year || null,
              coverId: d.cover_i || null,
              cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
              isbn: (d.isbn || []).slice(0, 3),
              subjects: (d.subject || []).slice(0, 6),
              rating: d.ratings_average ? Math.round(d.ratings_average * 20) / 10 : null,
              ratingsCount: d.ratings_count || 0
            }))
          };
        });
        return json(data, 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro Open Library", detail: e.message }, e instanceof UpstreamError ? e.status : 500, corsHeaders);
      }
    }

    // NOVO — Open Library: ficha de uma obra (descrição, temas, nota)
    if (path === "/openlibrary/work" && request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      if (!/^\/works\/OL\d+W$/.test(key)) return json({ error: "Parametro key invalido" }, 400, corsHeaders);
      try {
        const data = await cached(`olw:${key}`, 7 * DAY, async () => {
          const h = { headers: { "User-Agent": UA, "Accept": "application/json" } };
          const [work, ratings] = await Promise.all([
            fetchJson(`https://openlibrary.org${key}.json`, h, "Open Library"),
            fetchJson(`https://openlibrary.org${key}/ratings.json`, h, "Open Library").catch(() => null)
          ]);
          const d = work.description;
          const description = typeof d === "string" ? d : (d && d.value) || "";
          const sum = ratings && ratings.summary;
          return {
            key,
            description: htmlToText(description, 2500),
            subjects: (work.subjects || []).slice(0, 12),
            rating: sum && sum.average ? Math.round(sum.average * 20) / 10 : null,
            ratingsCount: (sum && sum.count) || 0
          };
        });
        return json(data, 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro Open Library", detail: e.message }, e instanceof UpstreamError ? e.status : 500, corsHeaders);
      }
    }

    // NOVO — Hardcover: pesquisa de livros (precisa do segredo HARDCOVER_TOKEN)
    if (path === "/hardcover/search" && request.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      if (!env.HARDCOVER_TOKEN) return json({ error: "Hardcover nao configurado." }, 500, corsHeaders);
      const debug = url.searchParams.get("debug") === "1";
      try {
        const data = await cached(`hc:${q.toLowerCase()}:${debug ? "d" : ""}`, 7 * DAY, async () => {
          if (!hardcoverAllowed()) throw new UpstreamError(429, "Hardcover: limite local atingido, tenta daqui a pouco");
          const token = env.HARDCOVER_TOKEN.startsWith("Bearer ") ? env.HARDCOVER_TOKEN : `Bearer ${env.HARDCOVER_TOKEN}`;
          const resp = await fetch("https://api.hardcover.app/v1/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": token, "User-Agent": UA },
            body: JSON.stringify({
              query: `query Search($q: String!) { search(query: $q, query_type: "Book", per_page: 8, page: 1) { results } }`,
              variables: { q }
            })
          });
          if (!resp.ok) throw new UpstreamError(resp.status, `Hardcover erro ${resp.status}`);
          const j = await resp.json();
          if (j.errors && j.errors.length) throw new UpstreamError(502, "Hardcover: " + String(j.errors[0].message || "erro").slice(0, 160));
          const raw = j.data && j.data.search && j.data.search.results;
          const hits = (raw && raw.hits) || [];
          const out = {
            results: hits.map((h) => {
              const d = h.document || h;
              const img = d.image;
              return {
                id: d.id != null ? String(d.id) : "",
                slug: d.slug || "",
                title: d.title || "",
                authors: Array.isArray(d.author_names) ? d.author_names.slice(0, 3) : [],
                year: d.release_year || null,
                rating: typeof d.rating === "number" ? Math.round(d.rating * 20) / 10 : null,
                ratingsCount: d.ratings_count || 0,
                description: htmlToText(d.description, 1500),
                cover: typeof img === "string" ? img : (img && img.url) || null,
                series: Array.isArray(d.series_names) ? d.series_names.slice(0, 2) : [],
                genres: Array.isArray(d.genres) ? d.genres.slice(0, 6) : []
              };
            })
          };
          if (debug) out.raw = raw;
          return out;
        });
        return json(data, 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro Hardcover", detail: e.message }, e instanceof UpstreamError ? e.status : 500, corsHeaders);
      }
    }

    if (path === "/omdb" && request.method === "GET") {
      const imdbId = url.searchParams.get("imdbid");
      const title = url.searchParams.get("title");
      const year = url.searchParams.get("year") || "";
      try {
        if (!env.OMDB_KEY) return json({ error: "OMDb nao configurado." }, 500, corsHeaders);
        let omdbUrl;
        if (imdbId) {
          omdbUrl = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${env.OMDB_KEY}`;
        } else if (title) {
          omdbUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}&apikey=${env.OMDB_KEY}`;
        } else {
          return json({ error: "Parametro imdbid ou title obrigatorio" }, 400, corsHeaders);
        }
        const resp = await fetch(omdbUrl);
        if (!resp.ok) return json({ error: `OMDb erro ${resp.status}` }, resp.status, corsHeaders);
        return json(await resp.json(), 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno OMDb", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/hltb" && request.method === "GET") {
      const query = url.searchParams.get("q");
      if (!query) return json({ error: "Parametro q obrigatorio" }, 400, corsHeaders);
      try {
        const formData = new URLSearchParams();
        formData.append("queryString", query);
        formData.append("t", "games");
        formData.append("sorthead", "popular");
        formData.append("sortd", "Normal Order");
        formData.append("plat", "");
        formData.append("length_type", "main");
        formData.append("length_min", "");
        formData.append("length_max", "");
        formData.append("v", "");
        formData.append("detail", "0");
        formData.append("modifier", "");
        const resp = await fetch("https://howlongtobeat.com/search_results?page=1", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": "https://howlongtobeat.com/",
            "Origin": "https://howlongtobeat.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: formData.toString()
        });
        if (!resp.ok) return json({ error: `HLTB erro ${resp.status}` }, resp.status, corsHeaders);
        const html = await resp.text();
        const games = [];
        const titleMatches = [...html.matchAll(/class="title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi)];
        const timeMatches = [...html.matchAll(/class="search_list_tidbit[^"]*"[^>]*>([^<]+)<\/span>/gi)];
        if (titleMatches.length > 0) {
          const title = titleMatches[0][1].trim();
          const times = timeMatches.slice(0, 6).map((m) => m[1].trim());
          const parseH = (s) => {
            if (!s || s === "--") return null;
            const n = parseFloat(s);
            return isNaN(n) ? null : n;
          };
          games.push({ name: title, main: parseH(times[0]), extra: parseH(times[2]), completionist: parseH(times[4]) });
        }
        return json({ results: games }, 200, corsHeaders);
      } catch (e) {
        return json({ error: "Erro interno HLTB", detail: e.message }, 500, corsHeaders);
      }
    }

    if (path === "/health") {
      return json({
        status: "ok",
        version: "v7.2",
        igdb: !!(env.IGDB_CLIENT_ID && (env.IGDB_ACCESS_TOKEN || env.IGDB_CLIENT_SECRET)),
        igdbAutoRefresh: !!env.IGDB_CLIENT_SECRET,
        comicvine: !!env.COMICVINE_KEY,
        tmdb: !!env.TMDB_KEY,
        googleBooks: !!env.GOOGLE_BOOKS_KEY,
        omdb: !!env.OMDB_KEY,
        openLibrary: true,
        hardcover: !!env.HARDCOVER_TOKEN,
        timestamp: new Date().toISOString()
      }, 200, corsHeaders);
    }

    return json({ error: "Rota nao encontrada" }, 404, corsHeaders);
  }
};
