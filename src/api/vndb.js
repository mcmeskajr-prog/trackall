// ─── VNDB (Visual Novel Database) — Visual Novels ────────────────────────────
// API Kana (https://api.vndb.org/kana): leituras públicas sem chave. Gratuita para uso não comercial.
// Limites: 200 pedidos / 5 min e 1 s de execução / min — por isso há cache e pedidos só quando necessário.
// Tenta o pedido direto do browser (cada utilizador usa o seu IP); se falhar (ex.: CORS), usa o Worker.

const VNDB_URL = "https://api.vndb.org/kana/vn";
export const VNDB_PER_PAGE = 24;

const PLATFORMS = { win: "Windows", lin: "Linux", mac: "macOS", web: "Web", and: "Android", ios: "iOS", ps1: "PS1", ps2: "PS2", ps3: "PS3", ps4: "PS4", ps5: "PS5", psp: "PSP", psv: "PS Vita", swi: "Switch", xb1: "Xbox One", xxs: "Xbox Series", drc: "Dreamcast", sat: "Saturn", wii: "Wii", n3d: "3DS", nds: "DS", dos: "DOS", fmt: "FM Towns", p98: "PC-98", pce: "PC Engine", sfc: "Super Famicom", gba: "GBA", mob: "Mobile" };
export const platformName = (c) => PLATFORMS[c] || c;
export const langName = (c, lang = "pt") => { try { return new Intl.DisplayNames([lang], { type: "language" }).of(c.replace(/^zh-Hans$/, "zh-CN").replace(/^zh-Hant$/, "zh-TW")); } catch { return c; } };
const FIELDS = "id,title,alttitle,image.url,image.sexual,image.violence,released,rating,votecount,description,length_minutes,languages,platforms,developers.name,tags.name,tags.rating,tags.spoiler";

// Capas explícitas (escala VNDB: 0 seguro · 1 sugestivo · 2 explícito) não são mostradas
export const isExplicitCover = (img) => !!img && (img.sexual ?? 0) >= 1.5;

// Descrição da VNDB usa BBCode: [url=…]texto[/url], [spoiler]…[/spoiler], [b], [i]…
export function cleanVndbText(s) {
  return String(s || "")
    .replace(/\[spoiler\][\s\S]*?\[\/spoiler\]/gi, "")
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[\/?[a-z]+(=[^\]]*)?\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function lengthLabel(min) {
  if (!min) return null;
  const h = Math.round(min / 60);
  return h < 1 ? "< 1 h" : `~${h} h`;
}

export function mapVn(v, { hideExplicit = false } = {}) {
  if (!v) return null;
  const explicit = isExplicitCover(v.image);
  if (hideExplicit && explicit) return null;
  const tags = (v.tags || []).filter((t) => !t.spoiler).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return {
    id: `vndb-${v.id}`,
    title: v.title || v.alttitle || "",
    cover: !explicit && v.image?.url ? v.image.url : "",
    type: "visualnovels",
    year: v.released && /^\d{4}/.test(v.released) ? v.released.slice(0, 4) : "",
    score: v.rating ? +(v.rating / 10).toFixed(1) : null,
    synopsis: cleanVndbText(v.description).slice(0, 220),
    genres: tags.slice(0, 4).map((t) => t.name),
    keywords: tags.slice(4, 14).map((t) => t.name),
    extra: (v.developers || [])[0]?.name || "",
    platforms: (v.platforms || []).map(platformName).join(", "),
    source: "VNDB",
  };
}

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

export async function vndbPost(body, workerUrl) {
  const key = JSON.stringify(body);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  const opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let data = null;
  try {
    const res = await fetch(VNDB_URL, opts);
    if (res.ok) data = await res.json();
    else if (res.status === 429) throw new Error("vndb-rate-limit");
  } catch (e) {
    if (e?.message === "vndb-rate-limit") throw e;
    // CORS / rede → tenta pelo Worker
  }
  if (!data && workerUrl) {
    const res = await fetch(workerUrl.replace(/\/$/, "") + "/vndb", opts);
    if (res.status === 429) throw new Error("vndb-rate-limit");
    if (res.ok) data = await res.json();
  }
  if (!data || !Array.isArray(data.results)) throw new Error("vndb-unavailable");
  cache.set(key, { t: Date.now(), v: data });
  return data;
}

export function buildVndbSearchBody(query) {
  return { filters: ["search", "=", query], fields: FIELDS, sort: "searchrank", results: VNDB_PER_PAGE };
}

export async function searchVNDB(query, workerUrl) {
  const d = await vndbPost(buildVndbSearchBody(query), workerUrl);
  return d.results.map((v) => mapVn(v)).filter(Boolean);
}

// ── Explorar ──
export function buildVndbExploreBody({ sort = "trending", year = null, page = 1 }) {
  const f = [["released", "<=", "today"]];
  let order = "popularity";
  if (sort === "trending") { f.push(["votecount", ">=", 5]); order = "popularity"; }
  else if (sort === "popular") order = "votecount";
  else if (sort === "score") { f.push(["votecount", ">=", 100]); order = "rating"; }
  else if (sort === "new") { f.push(["votecount", ">=", 3]); order = "released"; }
  if (year) { f.push(["released", ">=", `${year}-01-01`], ["released", "<=", `${year}-12-31`]); }
  return { filters: ["and", ...f], fields: FIELDS, sort: order, reverse: true, results: VNDB_PER_PAGE, page: Math.max(page, 1) };
}

export async function fetchVndbExplore(opts, workerUrl) {
  const d = await vndbPost(buildVndbExploreBody(opts), workerUrl);
  return { items: d.results.map((v) => mapVn(v, { hideExplicit: true })).filter((x) => x && x.cover), hasNext: !!d.more };
}

// ── Detalhes ──
export async function fetchVndbDetails(id, workerUrl, lang = "pt") {
  const vid = String(id).replace(/^vndb-/, "");
  const d = await vndbPost({ filters: ["id", "=", vid], fields: FIELDS + ",screenshots.url,screenshots.sexual,screenshots.violence", results: 1 }, workerUrl);
  const v = d.results[0];
  if (!v) return null;
  const m = mapVn(v);
  const shots = (v.screenshots || []).filter((s) => (s.sexual ?? 0) < 1 && (s.violence ?? 0) < 1).map((s) => s.url).slice(0, 8);
  return {
    synopsis: cleanVndbText(v.description) || null,
    genres: m.genres,
    keywords: m.keywords,
    developer: m.extra || null,
    platforms: (v.platforms || []).map(platformName),
    languages: (v.languages || []).map((l) => langName(l, lang)).filter((x, i, a) => a.indexOf(x) === i),
    length: lengthLabel(v.length_minutes),
    score: m.score,
    artworks: shots,
    bannerImage: shots[0] || null,
    votes: v.votecount || null,
  };
}
