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

export async function searchComicVine(query, workerUrl) {
  if (!workerUrl) return null;
  // As séries são o essencial; os arcos são um extra que pode falhar sem estragar nada
  const [vols, arcs] = await Promise.all([
    cvFetch(workerUrl, query, "").catch(() => null),
    cvFetch(workerUrl, query, "story_arc").catch(() => null),
  ]);
  const volumes = (vols || []).slice(0, 24).map((c) => ({
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
  const arcos = (arcs || []).slice(0, 6).map((c) => ({
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
