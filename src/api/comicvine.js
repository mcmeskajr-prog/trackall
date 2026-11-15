// ─── ComicVine via Proxy Worker — Comics ───────────────────────────────────────
// O Worker resolve o CORS que bloqueia chamadas diretas de browser/webview.
// Pesquisa séries (volumes, id "cv-…"). Itens "cva-…" (arcos) já guardados continuam a abrir.

async function cvFetch(workerUrl, query, resources) {
  const url = workerUrl.replace(/\/$/, "") + `/comicvine?q=${encodeURIComponent(query)}${resources ? `&resources=${resources}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.length ? data.results : null;
}

const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const isCollected = (c) => /^(trade paperback|hardcover|omnibus|collect|reprint)/i.test(c.deck || "") && (c.count_of_issues || 0) <= 1;

// O ComicVine tem muitas "séries" repetidas (edições de coleção, outros países, variantes).
// Série com o mesmo nome E o mesmo ano → fica a que tem mais edições. Coleções de 1 edição saem.
// Séries com o mesmo nome mas anos diferentes (ex.: Batman 1940, 2011, 2016) são corridas diferentes e ficam todas.
// As maiores (mais edições) aparecem primeiro.
export function cleanVolumes(list) {
  const arr = list.filter((c) => c?.name);
  const pool = arr.filter((c) => !isCollected(c));
  const base = pool.length ? pool : arr;
  const score = (x) => (x.count_of_issues || 0) * 10 + (x.image ? 1 : 0);
  const best = new Map();
  for (const c of base) {
    const k = `${normName(c.name)}|${c.start_year || ""}`;
    const cur = best.get(k);
    if (!cur || score(c) > score(cur)) best.set(k, c);
  }
  const keep = new Set(best.values());
  return base
    .filter((c) => keep.has(c))
    .sort((x, y) => (y.count_of_issues || 0) - (x.count_of_issues || 0))
    .slice(0, 20);
}

export async function searchComicVine(query, workerUrl) {
  if (!workerUrl) return null;
  // Só séries (volumes). Os arcos ficaram de fora da pesquisa: repetiam a série.
  const vols = await cvFetch(workerUrl, query, "").catch(() => null);
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
  return volumes.length ? volumes : null;
}
