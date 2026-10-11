// Esqueletos de carregamento: blocos cinzentos com brilho a passar (shimmer).
// Respeitam "prefers-reduced-motion" (ficam estáticos).
const CSS = `
@keyframes ta-skel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.ta-skel { background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.11) 37%, rgba(255,255,255,0.05) 63%); background-size: 200% 100%; animation: ta-skel 1.4s ease-in-out infinite; }
.ta-skel-light { background: linear-gradient(90deg, rgba(15,23,42,0.06) 25%, rgba(15,23,42,0.12) 37%, rgba(15,23,42,0.06) 63%); background-size: 200% 100%; }
@media (prefers-reduced-motion: reduce) { .ta-skel { animation: none; } }
`;

export function SkeletonStyles() { return <style>{CSS}</style>; }

export function Skeleton({ width = "100%", height = 16, radius = 8, light = false, style }) {
  return <div className={`ta-skel${light ? " ta-skel-light" : ""}`} aria-hidden="true" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />;
}

// Grelha de posters (2:3) — pesquisa, biblioteca, favoritos…
export function PosterGridSkeleton({ count = 12, minWidth = 130, gap = 14, light = false }) {
  return (
    <div role="status" aria-label="A carregar" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap }}>
      <SkeletonStyles />
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton height="auto" radius={12} light={light} style={{ aspectRatio: "2/3", width: "100%" }} />
          <Skeleton width="70%" height={11} radius={6} light={light} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

// Ecrã de arranque: barra de topo + título + grelha, em vez de um spinner
export function AppSkeleton({ accent = "#8b5cf6", bg = "#0d1117" }) {
  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Outfit', sans-serif", padding: "24px 28px", boxSizing: "border-box" }}>
      <SkeletonStyles />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 20 }}>T</div>
        <Skeleton width={120} height={18} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Skeleton width={90} height={32} radius={10} />
          <Skeleton width={32} height={32} radius={999} />
        </div>
      </div>
      <Skeleton width={180} height={26} radius={8} style={{ marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {[70, 60, 80, 64, 72].map((w, i) => <Skeleton key={i} width={w} height={30} radius={999} />)}
      </div>
      <PosterGridSkeleton count={14} />
    </div>
  );
}
