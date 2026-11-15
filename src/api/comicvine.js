// ─── ComicVine via Proxy Worker — Comics ───────────────────────────────────────
// O Worker resolve o CORS que bloqueia chamadas diretas de browser/webview.
// Pesquisa séries (volumes, id "cv-…") e arcos/eventos (story arcs, id "cva-…").

async function cvFetch(workerUrl, query, resources) {
  const url = workerUrl.replace(/\/$/, "") + `/comicvine?q=${encodeURIComponent(query)}${resources ? `&resources=${resources}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.length ? data.results : null;
}

const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const isCollected = (c) => /^(trade paperback|hardcover|omnibus|collect|reprint)/i.test(c.deck || "") && (c.count_of_issues || 0) <= 1;

// O ComicVine tem muitas "séries" com o mesmo nome (edições de coleção, outros países, variantes).
// Junta-as numa só — fica a que tem mais edições — e deixa de fora as coleções de 1 edição.
export function cleanVolumes(list) {
  const arr = list.filter((c) => c?.name);
  const pool = arr.filter((c) => !isCollected(c));
  const base = pool.length ? pool : arr;
  const best = new Map();
  for (const c of base) {
    const k = normName(c.name);
    const cur = best.get(k);
    const score = (x) => (x.count_of_issues || 0) * 10 + (x.image ? 1 : 0);
    if (!cur || score(c) > score(cur)) best.set(k, c);
  }
  // mantém a ordem original da API (relevância)
  const keep = new Set(best.values());
  return base.filter((c) => keep.has(c)).slice(0, 16);
}

export async function searchComicVine(query, workerUrl) {
  if (!workerUrl) return null;
  // As séries são o essencial; os arcos são um extra que pode falhar sem estragar nada
  const [vols, arcs] = await Promise.all([
    cvFetch(workerUrl, query, "").catch(() => null),
    cvFetch(workerUrl, query, "story_arc").catch(() => null),
  ]);
  const volumes = cleanVolumes(vols || []).map((c) => ({
    id: `cv-${c.id}`,
    title: c.name || "",
    cover: c.image?.medium_url || c.image?.small_url || "",
    type: "comics",
    year: String(c.start_year || ""),
    score: null,
    synopsis: (c.deck || "").slice(0, 220),
    genres: [],
    extra: [c.publisher?.name, c.count_of_issues ? `${c.count_of_issues} ed.` : ""].filter(Boolean).join(" · "),
    source: "ComicVine",
  }));
  const arcSeen = new Set();
  const arcos = (arcs || []).filter((c) => { const k = normName(c.name); if (!k || arcSeen.has(k)) return false; arcSeen.add(k); return true; }).slice(0, 4).map((c) => ({
    id: `cva-${c.id}`,
    title: c.name || "",
    cover: c.image?.medium_url || c.image?.small_url || "",
    type: "comics",
    year: "",
    score: null,
    synopsis: (c.deck || "").slice(0, 220),
    genres: [],
    extra: ["Arco", c.publisher?.name].filter(Boolean).join(" · "),
    source: "ComicVine (arco)",
  }));
  const all = [...volumes, ...arcos];
  return all.length ? all : null;
}
