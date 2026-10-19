import { useEffect, useRef, useState } from "react";

// Wallpaper com cross-fade: ao trocar de imagem a nova aparece por cima da anterior (sem corte nem flash).
// Camada única fixa (evita background-attachment: fixed, que falha no iOS).
export function WallpaperLayer({ src, blur = 0, ms = 450 }) {
  const [layers, setLayers] = useState(() => (src ? [{ id: 0, src, ready: true }] : []));
  const idRef = useRef(0);
  useEffect(() => {
    if (!src) { setLayers([]); return; }
    if (layers.length && layers[layers.length - 1].src === src) return;
    const id = ++idRef.current;
    const img = new Image();
    const add = () => {
      setLayers((ls) => [...ls, { id, src, ready: false }]);
      requestAnimationFrame(() => requestAnimationFrame(() => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ready: true } : l)))));
      setTimeout(() => setLayers((ls) => (ls.length > 1 ? ls.filter((l) => l.id >= id) : ls)), ms + 80);
    };
    img.onload = add; img.onerror = add; img.src = src; // só entra depois de carregar: nunca aparece a meio
    // eslint-disable-next-line
  }, [src]);
  return layers.map((l) => (
    <div key={l.id} aria-hidden="true" style={{
      position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url(${l.src})`, backgroundSize: "cover", backgroundPosition: "center top", backgroundRepeat: "no-repeat",
      filter: blur > 0 ? `blur(${blur}px)` : "none", transform: blur > 0 ? "scale(1.05)" : "none",
      opacity: l.ready ? 1 : 0, transition: `opacity ${ms}ms ease`, willChange: "opacity",
    }} />
  ));
}
