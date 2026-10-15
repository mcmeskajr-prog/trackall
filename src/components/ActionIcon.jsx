// Ícones de ação (favorito, hall of fame, nota, remover) — os mesmos no telemóvel e no PC.
// `filled` preenche o ícone (estado ativo); `slash` desenha um risco vermelho (lista cheia).
const PATHS = {
  heart: "M12 20.3s-7.4-4.5-7.4-10.1A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.4 2.7c0 5.6-7.4 10.1-7.4 10.1z",
  star: "M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z",
  note: "M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5v3zM14 8l3 3",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5",
};

export function ActionIcon({ name, size = 18, filled = false, slash = false, stroke = 1.75, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block", ...style }}>
      <path d={PATHS[name]} />
      {slash && <line x1="4" y1="20" x2="20" y2="4" stroke="#ef4444" strokeWidth={stroke + 0.5} />}
    </svg>
  );
}
