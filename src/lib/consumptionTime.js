// ─── Quando Consumir? ─────────────────────────────────────────────────────────
// Determina o "slot" de tempo ideal para consumir um item (hoje, fim de semana, férias)
export function getConsumptionTime(item) {
  if (!item) return null;
  
  // Apenas itens planeados
  if (item.userStatus !== "planejado" && item.userStatus !== "planeado") return null;
  
  const type = item.type;
  
  // Lógica de slot baseada no tipo de media
  if (type === "anime" || type === "manga" || type === "manhwa" || type === "lightnovels" || type === "comics") {
    return { slot: "hoje" };
  }
  if (type === "filmes" || type === "series" || type === "jogos") {
    return { slot: "fimdesemana" };
  }
  
  return { slot: "ferias" };
}