import { useState, useRef, useEffect } from "react";

// Avaliação 0–10 em passos de 0.5.
//  · arrastar pelas estrelas (ou tocar) escolhe a nota; guarda ao largar
//  · metade esquerda de cada estrela = meia estrela
//  · tocar outra vez na nota atual limpa-a
//  · botões − / + mexem meia estrela de cada vez
//  · variant="bar": barra com bolha (alternativa à linha de estrelas)
const STAR_PATH = "M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z";
const GOLD = "#f59e0b";

const fmt = (v) => (v <= 0 ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch {} };

// Estilo escolhido nas Definições (estrelas ou barra); atualiza ao vivo
const readStyle = () => { try { return localStorage.getItem("trackall_rating_style") || "stars"; } catch { return "stars"; } };
function useRatingStyle() {
  const [v, setV] = useState(readStyle);
  useEffect(() => {
    const h = () => setV(readStyle());
    window.addEventListener("trackall-rating-style", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("trackall-rating-style", h); window.removeEventListener("storage", h); };
  }, []);
  return v;
}

export function StarRating({ value = 0, onChange, size = 16, readOnly = false, variant, showButtons = true }) {
  const chosen = useRatingStyle();
  variant = variant || chosen;
  const [live, setLive] = useState(null);   // valor durante o arrasto
  const drag = useRef({ on: false, start: 0, moved: false, last: 0 });
  const width = size * 10;
  const shown = live !== null ? live : value;

  // Só leitura: estrelas compactas + número
  if (readOnly) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Row width={size * 10} size={size} fill={value} />
        {value > 0 && <span style={{ fontSize: size * 0.8, color: GOLD, fontWeight: 700 }}>{fmt(value)}</span>}
      </div>
    );
  }

  const calc = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    return Math.max(0.5, Math.min(10, Math.ceil((x / r.width) * 20) / 2));
  };
  const onDown = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const v = calc(e);
    drag.current = { on: true, start: value, moved: false, last: v };
    buzz(); setLive(v);
  };
  const onMove = (e) => {
    if (!drag.current.on) return;
    const v = calc(e);
    if (v !== drag.current.last) { drag.current.last = v; drag.current.moved = true; buzz(); setLive(v); }
  };
  const onUp = () => {
    if (!drag.current.on) return;
    const { start, moved, last } = drag.current;
    drag.current.on = false;
    setLive(null);
    if (!onChange) return;
    onChange(!moved && start === last ? 0 : last);
  };
  const step = (d) => { if (onChange) { buzz(); onChange(Math.max(0, Math.min(10, (value || 0) + d))); } };

  const btn = { width: 30, height: 30, borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "inherit", fontSize: 17, lineHeight: 1, cursor: "pointer", padding: 0, flexShrink: 0, fontFamily: "inherit" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      {variant === "bar" ? (
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ position: "relative", width: Math.max(width, 200), height: 56, cursor: "pointer", touchAction: "none", userSelect: "none" }}>
          <div style={{ position: "absolute", left: `${shown * 10}%`, top: 0, width: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ minWidth: 40, padding: "3px 8px", borderRadius: 9, background: GOLD, color: "#1a1204", fontSize: 14, fontWeight: 800, textAlign: "center", whiteSpace: "nowrap" }}>{fmt(shown)}</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 36, height: 8, borderRadius: 999, background: "#222a33", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 0, top: 36, width: `${shown * 10}%`, height: 8, borderRadius: 999, background: "linear-gradient(90deg,#b45309,#f59e0b)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: `${shown * 10}%`, top: 40, width: 0, pointerEvents: "none" }}>
            <div style={{ width: 20, height: 20, margin: "-10px 0 0 -10px", borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.6),0 0 0 3px rgba(245,158,11,.35)" }} />
          </div>
        </div>
      ) : (
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ position: "relative", width, height: size, cursor: "pointer", touchAction: "none", userSelect: "none" }}>
          <Row width={width} size={size} fill={shown} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showButtons && <button type="button" aria-label="Menos meia estrela" style={btn} onClick={() => step(-0.5)}>−</button>}
        <span style={{ fontSize: Math.max(18, size * 1.05), fontWeight: 800, minWidth: 48, textAlign: "center", color: shown > 0 ? GOLD : "#6b7683", fontVariantNumeric: "tabular-nums" }}>{fmt(shown)}</span>
        {showButtons && <button type="button" aria-label="Mais meia estrela" style={btn} onClick={() => step(0.5)}>+</button>}
      </div>
    </div>
  );
}

function Row({ width, size, fill }) {
  const stars = (color) => (
    <div style={{ display: "flex", width }}>
      {Array.from({ length: 10 }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><path d={STAR_PATH} fill={color} /></svg>
      ))}
    </div>
  );
  return (
    <div style={{ position: "relative", width, height: size, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0 }}>{stars("#2b333d")}</div>
      <div style={{ position: "absolute", top: 0, left: 0, height: size, overflow: "hidden", width: `${Math.max(0, Math.min(10, fill)) * 10}%` }}>{stars(GOLD)}</div>
    </div>
  );
}
