import { useRef, useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

// Seletor de cor moderno (substitui o <input type="color"> do sistema):
// quadrado saturação/brilho, barra de tonalidade, campo hex, conta-gotas (onde existir) e cores sugeridas.
// value / onChange trabalham com hex sem "#" (ex.: "ff6a3d").

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function hexToHsv(hex) {
  const h = (hex || "808080").replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = 0;
  if (d) hue = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [hue, mx ? d / mx : 0, mx];
}
function hsvToHex(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function ColorPicker({ value, onChange, suggestions = [], lang = "pt" }) {
  const { accent, darkMode } = useTheme();
  const en = lang === "en";
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexText, setHexText] = useState((value || "").replace("#", ""));
  const sq = useRef(), hu = useRef();
  const last = useRef(value);

  // se o valor mudar por fora (ex.: clicar numa amostra), acompanha
  useEffect(() => {
    if ((value || "") !== last.current) { last.current = value; setHsv(hexToHsv(value)); setHexText((value || "").replace("#", "")); }
  }, [value]);

  const push = (next) => {
    setHsv(next);
    const hex = hsvToHex(...next);
    last.current = hex; setHexText(hex); onChange(hex);
  };
  const drag = (ref, fn) => (e) => {
    const el = ref.current; if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    const move = (ev) => { const r = el.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); };
    move(e);
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const [h, s, v] = hsv;
  const line = darkMode ? "#30363d" : "#e2e8f0";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const knob = { position: "absolute", width: 20, height: 20, borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.4)", transform: "translate(-50%, -50%)", pointerEvents: "none" };
  const eye = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${line}`, background: darkMode ? "#11151b" : "#fff", marginTop: 10 }}>
      <div ref={sq} onPointerDown={drag(sq, (x, y) => push([h, x, 1 - y]))}
        style={{ position: "relative", height: 150, borderRadius: 10, cursor: "crosshair", touchAction: "none", background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))` }}>
        <div style={{ ...knob, left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: `#${hsvToHex(h, s, v)}` }} />
      </div>
      <div ref={hu} onPointerDown={drag(hu, (x) => push([x * 360, s || 0.01, v || 0.5]))}
        style={{ position: "relative", height: 14, borderRadius: 999, marginTop: 14, cursor: "pointer", touchAction: "none", background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
        <div style={{ ...knob, top: "50%", left: `${(h / 360) * 100}%`, background: `hsl(${h}, 100%, 50%)` }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `#${hsvToHex(h, s, v)}`, border: `1px solid ${line}`, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, padding: "0 10px", height: 36, borderRadius: 10, border: `1px solid ${line}`, background: darkMode ? "#0d1117" : "#f8fafc" }}>
          <span style={{ color: muted, fontSize: 13 }}>#</span>
          <input value={hexText} maxLength={6} spellCheck={false} aria-label="Hex"
            onChange={(e) => { const t = e.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6); setHexText(t); if (t.length === 6) { const n = hexToHsv(t); setHsv(n); last.current = t.toLowerCase(); onChange(t.toLowerCase()); } }}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: darkMode ? "#e6edf3" : "#0f172a", fontFamily: "ui-monospace, monospace", fontSize: 14, textTransform: "uppercase", padding: 0 }} />
        </div>
        {eye && (
          <button type="button" title={en ? "Pick from screen" : "Tirar cor do ecrã"} aria-label={en ? "Pick from screen" : "Tirar cor do ecrã"}
            onClick={async () => { try { const r = await new window.EyeDropper().open(); const t = r.sRGBHex.replace("#", "").toLowerCase(); const n = hexToHsv(t); setHsv(n); setHexText(t); last.current = t; onChange(t); } catch {} }}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${line}`, background: "transparent", color: darkMode ? "#e6edf3" : "#0f172a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {suggestions.map((c) => (
            <button key={c} type="button" aria-label={`#${c}`} onClick={() => { const n = hexToHsv(c); setHsv(n); setHexText(c); last.current = c; onChange(c); }}
              style={{ width: 28, height: 28, borderRadius: "50%", background: `#${c}`, border: `2px solid ${c === (value || "").toLowerCase() ? accent : line}`, cursor: "pointer", padding: 0 }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Cores sugeridas (vivas e agradáveis sobre fundo escuro)
export const PICKER_SUGGESTIONS = ["ef4444", "f97316", "f59e0b", "84cc16", "10b981", "14b8a6", "06b6d4", "3b82f6", "6366f1", "a855f7", "ec4899", "f43f5e"];
