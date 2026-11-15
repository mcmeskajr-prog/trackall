// ─── Google Books — Livros ─────────────────────────────────────────────────────

export async function searchGoogleBooks(query, workerUrl) {
  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
  const res = await fetch(`${wUrl}/books?q=${encodeURIComponent(query)}&maxResults=24`);
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

// ─── Open Library / Hardcover (via worker v7) — completam o Google Books ──────
// Todas estas chamadas são "melhor esforço": se o worker ainda for antigo (404) ou falhar, devolvem null e a app segue como antes.

const WORKER = "https://trackall-proxy.mcmeskajr.workers.dev";
const wBase = (workerUrl) => (workerUrl || WORKER).replace(/\/$/, "");

async function getJson(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Só aceita um resultado como "o mesmo livro" se o título bater mesmo (e o autor, quando há dos dois lados).
export function pickMatch(results, title, author) {
  const t = norm(title);
  if (!t || !Array.isArray(results)) return null;
  const surname = norm(author).split(" ").filter((w) => w.length > 2).pop();
  for (const r of results) {
    const rt = norm(r.title);
    const titleOk = rt === t || (Math.min(rt.length, t.length) >= 6 && (rt.startsWith(t) || t.startsWith(rt)));
    if (!titleOk) continue;
    const ra = norm((r.authors || []).join(" "));
    if (surname && ra && !ra.includes(surname)) continue;
    return r;
  }
  return null;
}

export async function searchOpenLibrary(query, workerUrl) {
  const data = await getJson(`${wBase(workerUrl)}/openlibrary/search?q=${encodeURIComponent(query)}&limit=12`);
  if (!data?.results?.length) return null;
  return data.results
    .filter((b) => b.key && b.title)
    .map((b) => ({
      id: `ol-${b.key.replace("/works/", "")}`,
      title: b.title,
      cover: b.cover || "",
      type: "livros",
      year: b.year ? String(b.year) : "",
      score: b.rating || null,
      synopsis: "",
      genres: (b.subjects || []).slice(0, 4),
      extra: (b.authors || []).join(", ").slice(0, 60),
      source: "Open Library",
    }));
}

export async function fetchOpenLibraryWork(workKey, workerUrl) {
  if (!workKey) return null;
  return getJson(`${wBase(workerUrl)}/openlibrary/work?key=${encodeURIComponent(workKey)}`);
}

export async function searchHardcover(query, workerUrl) {
  const data = await getJson(`${wBase(workerUrl)}/hardcover/search?q=${encodeURIComponent(query)}`);
  return data?.results?.length ? data.results : null;
}

// Junta as fontes: a sinopse mais completa, notas na escala 0-10 (Hardcover > Open Library > Google) e géneros sem repetições.
export function mergeBookExtras(google, ol, hc) {
  const g = google || {};
  const syns = [hc?.description, ol?.description, g.synopsis].filter((s) => s && s.trim());
  const synopsis = syns.sort((a, b) => b.length - a.length)[0] || null;
  const seen = new Set();
  const genres = [...(g.genres || []), ...(hc?.genres || []), ...(ol?.subjects || [])]
    .filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 6);
  const pick = (...v) => v.find((x) => typeof x === "number" && x > 0) ?? null;
  const googleScore = g.score ? Math.round(g.score * 20) / 10 : null; // Google: 0-5 → 0-10
  return {
    ...g,
    synopsis,
    genres,
    score: pick(hc?.rating, ol?.rating, googleScore),
    series: hc?.series?.[0] || null,
  };
}

// Enriquecimento de um livro do Google Books (ou do Open Library): procura o mesmo livro nas outras fontes.
export async function enrichBook(item, base, workerUrl) {
  const title = item.title, author = item.extra || "";
  const q = `${title} ${author}`.trim();
  const [olRes, hcRes] = await Promise.all([
    item.id?.startsWith("ol-") ? Promise.resolve(null) : searchOpenLibrary(q, workerUrl).catch(() => null),
    searchHardcover(q, workerUrl).catch(() => null),
  ]);
  const olMatch = item.id?.startsWith("ol-")
    ? { id: item.id }
    : pickMatch((olRes || []).map((r) => ({ ...r, authors: r.extra ? [r.extra] : [] })), title, author);
  const hcMatch = pickMatch(hcRes, title, author);
  const ol = olMatch ? await fetchOpenLibraryWork(`/works/${olMatch.id.replace("ol-", "")}`, workerUrl) : null;
  return mergeBookExtras(base, ol, hcMatch);
}
