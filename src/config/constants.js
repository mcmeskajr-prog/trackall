// ─── Media Types ─────────────────────────────────────────────────────────────
export const MEDIA_TYPES = [
  { id: "all",         label: "Todos",        labelEn: "All",          icon: "🎯" },
  { id: "anime",       label: "Anime",        labelEn: "Anime",        icon: "⛩️" },
  { id: "manga",       label: "Manga",        labelEn: "Manga",        icon: "" },
  { id: "series",      label: "Séries",       labelEn: "Series",       icon: "📺" },
  { id: "filmes",      label: "Filmes",       labelEn: "Movies",       icon: "🎬" },
  { id: "jogos",       label: "Jogos",        labelEn: "Games",        icon: "🎮" },
  { id: "livros",      label: "Livros",       labelEn: "Books",        icon: "📚" },
  { id: "manhwa",      label: "Manhwa",       labelEn: "Manhwa",       icon: "🇰🇷" },
  { id: "lightnovels", label: "Light Novels", labelEn: "Light Novels", icon: "✨" },
  { id: "comics",      label: "Comics",       labelEn: "Comics",       icon: "💬" },
];

export const mediaLabel = (m, lang) => lang === "en" ? m.labelEn : m.label;

export const getMediaTypeLabel = (type, lang = "en") => {
  const mediaType = MEDIA_TYPES.find(t => t.id === type);
  return mediaType ? mediaLabel(mediaType, lang) : (type || "media");
};

// ─── Months ───────────────────────────────────────────────────────────────────
export const MONTH_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const MONTH_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// ─── Status Options ───────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  { id: "assistindo", label: "Em Curso",  labelEn: "In Progress", color: "#f97316", emoji: "▶" },
  { id: "completo",   label: "Completo",  labelEn: "Completed",   color: "#10b981", emoji: "✓" },
  { id: "planejado",  label: "Planeado",  labelEn: "Planned",     color: "#06b6d4", emoji: "" },
  { id: "dropado",    label: "Dropado",   labelEn: "Dropped",     color: "#ef4444", emoji: "✕" },
  { id: "pausado",    label: "Pausado",   labelEn: "Paused",      color: "#eab308", emoji: "" },
];

export const statusLabel = (s, lang) => lang === "en" ? s.labelEn : s.label;

// ─── Tier Levels ──────────────────────────────────────────────────────────────
export const TIER_LEVELS = [
  { id: "S", color: "#ef4444" },
  { id: "A", color: "#f97316" },
  { id: "B", color: "#eab308" },
  { id: "C", color: "#22c55e" },
  { id: "D", color: "#3b82f6" },
];

// ── Type Colors ──────────────────────────────────────────────────────────────
export const TYPE_COLORS = {
  anime:        "#6366f1",
  manga:        "#dc2626",
  series:       "#0891b2",
  filmes:       "#d97706",
  jogos:        "#16a34a",
  livros:       "#7c3aed",
  manhwa:       "#db2777",
  lightnovels:  "#9333ea",
  comics:       "#ea580c",
};