// ── Normalização de IDs ──────────────────────────────────────────────────────
// Remove espaços, coloca em minúsculas e remove caracteres especiais.
// O segundo argumento (type) existe só para compatibilidade com as chamadas
// feitas no App.jsx — não altera o resultado, para continuar a bater certo
// com os IDs já gravados na base de dados.
export function normalizeMediaId(id, type) {
  if (id === undefined || id === null || id === "") return "";
  return String(id).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── Candidatos de ID ────────────────────────────────────────────────────────
// Gera a lista de IDs possíveis para um dado id (+ type opcional), usada para
// procurar correspondências na biblioteca.
export function mediaIdCandidates(id, type) {
  const candidates = new Set();
  const norm = normalizeMediaId(id, type);
  if (norm) candidates.add(norm);
  return Array.from(candidates);
}

// ─── Encontrar na Biblioteca ──────────────────────────────────────────────────
// Procura um item na biblioteca do utilizador comparando IDs normalizados.
// library: objeto { [id]: item }
// Devolve { key, item } (key = chave real dentro de library) ou null se não encontrar.
export function findLibraryEntry(library, id, type) {
  if (!library || id === undefined || id === null || id === "") return null;
  const candidates = mediaIdCandidates(id, type);
  if (!candidates.length) return null;

  for (const libId of Object.keys(library)) {
    if (candidates.includes(normalizeMediaId(libId))) {
      return { key: libId, item: library[libId] };
    }
  }
  return null;
}

// ─── Normalizar Item de Media ─────────────────────────────────────────────────
// Garante que um item vindo de uma API externa (AniList, TMDB, IGDB, etc.) tem
// sempre os campos base (id, type, title, cover) preenchidos de forma consistente,
// sem perder os restantes campos originais. Usado antes de guardar/comparar itens
// (addToLibrary, toggleFavorite, toggleHallOfFame, log rápido).
export function normalizeMediaItem(item) {
  if (!item) return { id: "", type: "", title: "", cover: "" };
  return {
    ...item,
    id: item.id !== undefined && item.id !== null ? item.id : "",
    type: item.type || "",
    title: item.title || item.name || "",
    cover: item.cover || item.poster || item.image || "",
  };
}