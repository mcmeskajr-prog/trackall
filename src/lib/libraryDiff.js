// ─── Diferença entre duas versões da biblioteca ───
// Função pura usada pelo saveLibrary (App.jsx): devolve o que é preciso escrever e apagar no Supabase.
// - upserts: itens novos ou alterados (comparação por conteúdo)
// - deletes: ids que existiam e já não existem (ids que começam por "__" são linhas especiais, nunca se apagam)
export function diffLibrary(prev = {}, next = {}) {
  const upserts = [];
  for (const [id, item] of Object.entries(next)) {
    if (JSON.stringify(prev[id]) !== JSON.stringify(item)) upserts.push([id, item]);
  }
  const deletes = [];
  for (const id of Object.keys(prev)) {
    if (!id.startsWith("__") && !next[id]) deletes.push(id);
  }
  return { upserts, deletes };
}
