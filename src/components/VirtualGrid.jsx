import { useState, useEffect, useRef, memo } from "react";
import { MediaCard } from "./MediaCard";

// ── VirtualGrid: only renders cards near the viewport ──────────────────────
export const VirtualGrid = memo(function VirtualGrid({ items, library, onOpen, accent, columns = 3, size = "normal" }) {
  const [visibleCount, setVisibleCount] = useState(columns * 6); // initial render
  const sentinelRef = useRef(null);

  useEffect(() => {
    setVisibleCount(columns * 6); // reset on filter change
  }, [items.length, columns]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + columns * 4, items.length));
        }
      },
      { rootMargin: '100px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [items.length, columns]);

  const visible = items.slice(0, visibleCount);

  return (
    <>
      <div className="media-grid" style={size === "large" ? { gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" } : undefined}>
        {visible.map((item) => (
          <MediaCard key={item.id} item={item} library={library} onOpen={onOpen} accent={accent} />
        ))}
      </div>
      {visibleCount < items.length && (
        <div ref={sentinelRef} style={{ height: 1, margin: '20px 0' }} />
      )}
      {visibleCount >= items.length && items.length > 0 && (
        <p style={{ textAlign: 'center', color: '#484f58', fontSize: 12, padding: '16px 0' }}>
          {items.length} itens
        </p>
      )}
    </>
  );
}); // end memo(VirtualGrid)
