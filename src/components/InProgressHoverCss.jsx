// Hover do painel «Em curso» do perfil (PC): usado no teu perfil e no dos amigos para ficarem iguais.
export function InProgressHoverCss({ accent }) {
  return (
    <style>{`
      .pv2-row { padding: 6px 8px; margin: -6px -8px; border-radius: 8px; }
      .pv2-row-cover img { transition: transform 0.3s ease; }
      @media (hover: hover) and (prefers-reduced-motion: no-preference) {
        .pv2-curso { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
        .pv2-curso:hover { border-color: ${accent}66 !important; box-shadow: 0 14px 26px -16px ${accent}77; }
        .pv2-row { transition: background 0.15s ease, transform 0.15s ease; }
        .pv2-row:hover { transform: translateX(3px); }
        .pv2-row:hover .pv2-row-cover img { transform: scale(1.08); }
      }
      @media (hover: hover) {
        .pv2-row:hover { background: ${accent}1f; }
        .pv2-row:hover .pv2-row-title { color: ${accent}; }
      }
    `}</style>
  );
}
