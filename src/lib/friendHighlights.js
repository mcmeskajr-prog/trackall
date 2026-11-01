// Para o feed da Home: quais dos itens dos amigos estão nos Favoritos ou no Hall of Fame deles.
// Devolve { fav: Set("userId|mediaId"), hall: Set("userId|mediaId") }. Falhas dão conjuntos vazios (só perde as etiquetas).
export async function fetchFriendHighlights(supabase, friendIds) {
  const out = { fav: new Set(), hall: new Set() };
  const ids = [...new Set(friendIds || [])];
  if (!ids.length) return out;
  try {
    const [favRes, hallRes] = await Promise.all([
      supabase.from("profiles").select("id, favorites").in("id", ids),
      supabase.from("library").select("user_id, data").in("user_id", ids).eq("media_id", "__hall_of_fame__"),
    ]);
    (favRes.data || []).forEach(p => (Array.isArray(p.favorites) ? p.favorites : []).forEach(f => f?.id && out.fav.add(`${p.id}|${f.id}`)));
    (hallRes.data || []).forEach(r => (Array.isArray(r.data?.hall) ? r.data.hall : []).forEach(h => h?.id && out.hall.add(`${r.user_id}|${h.id}`)));
  } catch (_) { /* sem etiquetas */ }
  return out;
}

export function timeAgo(ts, en, now = Date.now()) {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return en ? "now" : "agora";
  if (m < 60) return en ? `${m}m ago` : `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return en ? `${h}h ago` : `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return en ? `${d}d ago` : `há ${d} d`;
  return en ? `${Math.floor(d / 30)}mo ago` : `há ${Math.floor(d / 30)} mes`;
}
