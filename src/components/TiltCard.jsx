import { useRef } from "react";

// ── TiltCard: efeito de inclinação 3D ao seguir o rato ─────────────────────────
// Escreve o transform diretamente no DOM (via ref) em vez de usar useState,
// e limita a 1 atualização por frame com requestAnimationFrame — não causa
// re-renders do React nem sobrecarrega o browser, mesmo com o rato a mexer
// muito rápido.
export function TiltCard({ children, maxTilt = 8, scale = 1.02, glare = false, style, className }) {
  const ref = useRef(null);
  const glareRef = useRef(null);
  const rafRef = useRef(null);
  const handleMove = (e) => {
    if (rafRef.current) return;
    const clientX = e.clientX, clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * maxTilt * 2;
      const rotateX = -(y - 0.5) * maxTilt * 2;
      el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale},${scale},${scale})`;
      if (glare && glareRef.current) {
        glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.4), transparent 60%)`;
        glareRef.current.style.opacity = "1";
      }
    });
  };
  const handleLeave = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
    if (glare && glareRef.current) glareRef.current.style.opacity = "0";
  };
  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{ position: "relative", transition: "transform 0.2s ease-out", transformStyle: "preserve-3d", willChange: "transform", ...style }}
    >
      {children}
      {glare && <div ref={glareRef} style={{ position: "absolute", inset: 0, opacity: 0, transition: "opacity 0.3s ease-out", pointerEvents: "none", mixBlendMode: "overlay" }} />}
    </div>
  );
}
