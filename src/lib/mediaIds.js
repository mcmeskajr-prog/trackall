// ── Normalização de IDs ──────────────────────────────────────────────────────
// Remove espaços, coloca em minúsculas e remove caracteres especiais
export function normalizeMediaId(id) {
  if (!id) return "";
  return String(id).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── Candidatos de ID ────────────────────────────────────────────────────────
// Gera uma lista de IDs possíveis para um item (título, nome, id original)
export function mediaIdCandidates(item) {
  const ids = new Set();
  if (item.id) ids.add(normalizeMediaId(item.id));
  if (item.title) ids.add(normalizeMediaId(item.title));
  if (item.name) ids.add(normalizeMediaId(item.name));
  return Array.from(ids);
}

// ─── Encontrar na Biblioteca ──────────────────────────────────────────────────
// Procura um item na biblioteca do utilizador comparando os IDs normalizados
export function findLibraryEntry(library, item) {
  if (!library || !item) return null;
  const candidates = mediaIdCandidates(item);
  
  for (const libId of Object.keys(library)) {
    if (candidates.includes(normalizeMediaId(libId))) {
      return library[libId];
    }
  }
  return null;
}