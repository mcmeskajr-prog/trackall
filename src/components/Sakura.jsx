// Flor de sakura (badge de nota do Hall of Fame, PC e telemóvel)
export function Sakura({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
      {[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="12" cy="6.2" rx="3.6" ry="5.6" transform={`rotate(${r} 12 12)`} fill="#f9a8d4" />)}
      <circle cx="12" cy="12" r="2.3" fill="#be185d" />
    </svg>
  );
}
