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
