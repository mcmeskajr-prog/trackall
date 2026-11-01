// «Completar outra vez»: cada revisão fica em item.revisions = [{ at, rating? }] (timestamps em ms).
// A entrada original (addedAt) mantém-se; as revisões só aparecem como linhas extra no Diário.
// Os números do perfil contam TÍTULOS (revisões não os inflacionam); o Diário e a sequência contam as vezes.

export const dayStamp = (y, m, d) => new Date(y, m, d, 12, 0, 0, 0).getTime(); // meio-dia: evita saltos de fuso/horário de verão

export function revisionsOf(item) {
  const r = item && Array.isArray(item.revisions) ? item.revisions : [];
  return r.filter(x => x && Number.isFinite(Number(x.at)) && Number(x.at) > 0).map(x => ({ at: Number(x.at), rating: Number(x.rating) > 0 ? Number(x.rating) : 0 })).sort((a, b) => a.at - b.at);
}

// Devolve o item atualizado com mais uma revisão. rating > 0 passa a ser a nota atual do item.
export function addRevision(item, { at, rating } = {}) {
  const when = Number(at) > 0 ? Number(at) : Date.now();
  const next = [...revisionsOf(item), { at: when, ...(Number(rating) > 0 ? { rating: Number(rating) } : {}) }].sort((a, b) => a.at - b.at);
  const out = { ...item, revisions: next };
  if (Number(rating) > 0) out.userRating = Number(rating);
  return out;
}

// Para o Diário: lista de completados + uma linha extra por revisão (com _revision = 2, 3, …).
// Cada linha leva _k (chave única). Ordem: mais recente primeiro.
export function expandDiary(items) {
  const out = [];
  (items || []).forEach(it => {
    if (it.userStatus !== "completo") return;
    if (it.addedAt) out.push({ ...it, _k: `${it.id}`, _revision: 1 });
    revisionsOf(it).forEach((r, i) => out.push({ ...it, addedAt: r.at, userRating: r.rating || it.userRating, _k: `${it.id}#${i + 2}`, _revision: i + 2 }));
  });
  return out.sort((a, b) => b.addedAt - a.addedAt);
}
