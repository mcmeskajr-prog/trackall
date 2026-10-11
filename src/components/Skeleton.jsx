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

// Ecrã de arranque: reproduz a estrutura da app (barra lateral no PC, barra inferior no telemóvel)
// com a forma da Home, para a transição para o conteúdo real ser quase impercetível.
const SHELL_CSS = `
.sk-side { display: none; }
.sk-bottom { display: flex; }
.sk-main { padding: 16px 14px 84px; }
@media (min-width: 768px) {
  .sk-side { display: flex; }
  .sk-bottom { display: none; }
  .sk-main { margin-left: 220px; padding: 28px 32px; }
}
`;

export function AppSkeleton({ accent = "#8b5cf6", bg = "#0d1117" }) {
  const rowOf = (n, w = 130) => (
    <div style={{ display: "flex", gap: 14, overflow: "hidden" }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ width: w, flexShrink: 0 }}>
          <Skeleton height="auto" radius={12} style={{ aspectRatio: "2/3", width: "100%" }} />
          <Skeleton width="70%" height={11} radius={6} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
  return (
    <div role="status" aria-label="A carregar" style={{ minHeight: "100vh", background: bg, fontFamily: "'Outfit', sans-serif", boxSizing: "border-box" }}>
      <SkeletonStyles />
      <style>{SHELL_CSS}</style>

      {/* Barra lateral (PC) */}
      <aside className="sk-side" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, flexDirection: "column", gap: 6, padding: "20px 12px", borderRight: "1px solid rgba(255,255,255,0.06)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 18 }}>T</div>
          <Skeleton width={90} height={16} />
        </div>
        {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={38} radius={10} style={{ opacity: i === 0 ? 1 : 0.7 }} />)}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
          <Skeleton width={34} height={34} radius={999} />
          <Skeleton width={90} height={13} />
        </div>
      </aside>

      {/* Conteúdo: forma da Home */}
      <main className="sk-main">
        <Skeleton width={220} height={28} radius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={150} height={13} radius={6} style={{ marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 30 }}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={84} radius={16} />)}
        </div>
        <Skeleton width={160} height={18} radius={6} style={{ marginBottom: 14 }} />
        {rowOf(10)}
        <Skeleton width={190} height={18} radius={6} style={{ margin: "30px 0 14px" }} />
        {rowOf(10)}
      </main>

      {/* Barra inferior (telemóvel) */}
      <nav className="sk-bottom" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 64, alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(255,255,255,0.06)", background: bg }}>
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} width={28} height={28} radius={8} />)}
      </nav>
    </div>
  );
}
