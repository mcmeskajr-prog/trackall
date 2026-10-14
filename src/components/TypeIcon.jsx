// Ícones dos tipos de mídia (SVG de linha). Um único sítio para todos os tipos:
// herdam a cor do texto (currentColor) e o tamanho da letra (1em) por omissão.
const PATHS = {
  anime: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  manga: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 10h18M10 10v11M14 3v7" /></>,
  series: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 3l4 4 4-4" /></>,
  filmes: <><rect x="3" y="9" width="18" height="11" rx="2" /><path d="M3.4 9L19 4.6M7.5 7.8l2 3.4M12 6.5l2 3.4M16.4 5.3l1.6 2.8" /></>,
  jogos: <><path d="M6 8h12a4 4 0 0 1 3.9 4.9l-.9 3.8a2.4 2.4 0 0 1-4 1.2L15 16H9l-2 2a2.4 2.4 0 0 1-4-1.2l-.9-3.8A4 4 0 0 1 6 8z" /><path d="M8 11v3M6.5 12.5h3" /><circle cx="15.5" cy="11.6" r=".7" fill="currentColor" /><circle cx="17.5" cy="13.4" r=".7" fill="currentColor" /></>,
  livros: <path d="M5 19.5V5a2.5 2.5 0 0 1 2.5-2.5H19v14.5H7.5A2.5 2.5 0 0 0 5 19.5zm0 0A2.5 2.5 0 0 0 7.5 22H19v-5" />,
  manhwa: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M12 8v6M9.5 12l2.5 2.5 2.5-2.5" /></>,
  lightnovels: <><path d="M20 4c-6 0-11 4-12 11l-1.5 4.5L11 18c6-1 9-6 9-14z" /><path d="M8 15l6-6" /></>,
  comics: <><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  all: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
};

export function TypeIcon({ id, size = "1em", stroke = 1.75, style }) {
  const key = id == null ? "search" : id;
  const p = PATHS[key];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "-0.15em", ...style }}>{p}</svg>
  );
}
