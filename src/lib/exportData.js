// Exportação completa dos dados da conta (JSON). Usada em Perfil → Definições → Geral.
export async function exportAllData({ supabase, userId, email, profile, library, favorites, hallOfFame }) {
  const safe = async (q) => { try { const r = await q; return r?.data ?? null; } catch { return null; } };
  const [tierlists, collections, prof] = await Promise.all([
    userId ? safe(supabase.from("tierlists").select("*").eq("user_id", userId)) : null,
    userId ? safe(supabase.from("collections").select("*").eq("user_id", userId)) : null,
    userId ? safe(supabase.from("profiles").select("*").eq("id", userId).maybeSingle()) : null,
  ]);
  const payload = {
    app: "TrackAll", exportedAt: new Date().toISOString(), version: 1,
    account: { id: userId || null, email: email || null },
    profile: prof || profile || null,
    library: library || {},
    favorites: favorites || [],
    hallOfFame: hallOfFame || [],
    tierlists: tierlists || [],
    collections: collections || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `trackall-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
