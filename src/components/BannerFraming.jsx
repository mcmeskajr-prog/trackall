import { useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { bannerFit, bannerFilter } from "../lib/bannerColors";

// Enquadramento do banner: seletor PC | Telemóvel, pré-visualização que se arrasta com o dedo/rato e zoom.
// Cada dispositivo guarda o seu enquadramento (PC: fx, fy, z · telemóvel: mfx, mfy, mz). Sem enquadramento próprio, o telemóvel acompanha o PC.
// Usado no editor do PC (Editar perfil) e na folha do banner do telemóvel — é o mesmo componente nos dois.
export function BannerFraming({ url, style, onStyle, lang, initialDevice = "pc", accent: accentProp, hideMobile = false, onHideMobile }) {
  const th = useTheme();
  const accent = accentProp || th.accent, darkMode = th.darkMode;
  const en = lang === "en";
  const [dev, setDev] = useState(initialDevice);
  const mob = dev === "mobile";
  const kx = mob ? "mfx" : "fx", ky = mob ? "mfy" : "fy", kz = mob ? "mz" : "z";
  const cur = (k, pk, d) => style[k] ?? (mob ? style[pk] : undefined) ?? d; // telemóvel sem valor próprio herda o do PC
  const fx = cur(kx, "fx", 50), fy = cur(ky, "fy", 50), z = cur(kz, "z", 100);
  const own = mob && style.mfx != null;
  const differs = mob && own && (style.mfx !== (style.fx ?? 50) || style.mfy !== (style.fy ?? 50) || (style.mz ?? 100) !== (style.z ?? 100));
  const line = darkMode ? "#30363d" : "#e2e8f0", muted = darkMode ? "#8b949e" : "#64748b", text = darkMode ? "#e6edf3" : "#0f172a";

  const shown = mob ? !hideMobile : !style.hpc;   // «Mostrar banner» vale para o dispositivo escolhido em cima
  const setShown = (on) => { if (mob) onHideMobile && onHideMobile(!on); else { const { hpc, ...rest } = style; onStyle(on ? rest : { ...rest, hpc: true }); } };
  const frame = useRef(null), nat = useRef({ w: 0, h: 0 }), drag = useRef(null);
  const write = (nx, ny, nz) => onStyle({ ...style, [kx]: Math.round(nx), [ky]: Math.round(ny), [kz]: Math.round(nz),
    ...(mob ? { mfx: Math.round(nx), mfy: Math.round(ny), mz: Math.round(nz) } : {}) });
  const clamp = (v) => Math.min(100, Math.max(0, v));
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, fx, fy }; };
  const move = (e) => {
    const d = drag.current, r = frame.current?.getBoundingClientRect(); if (!d || !r?.width) return;
    const { w, h } = nat.current; if (!w || !h) return;
    const s = Math.max(r.width / w, r.height / h) * (z / 100);       // escala real da imagem na moldura
    const ox = w * s - r.width, oy = h * s - r.height;                // quanto a imagem sobra em cada eixo
    const nx = ox > 1 ? clamp(d.fx - ((e.clientX - d.x) / ox) * 100) : d.fx;
    const ny = oy > 1 ? clamp(d.fy - ((e.clientY - d.y) / oy) * 100) : d.fy;
    write(nx, ny, z);
  };
  const up = () => { drag.current = null; };
  const fit = bannerFit(style, dev);
  const btnSeg = (id, label) => {
    const on = dev === id;
    return <button key={id} type="button" onClick={() => setDev(id)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, background: on ? accent : "transparent", color: on ? "#fff" : muted }}>{label}</button>;
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)", border: `1px solid ${line}` }}>
        {btnSeg("pc", "PC")}{btnSeg("mobile", en ? "Mobile" : "Telemóvel")}
      </div>
      <div ref={frame} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: "relative", marginTop: 14, width: "100%", maxWidth: mob ? 340 : "100%", marginLeft: "auto", marginRight: "auto", height: mob ? 150 : 110, borderRadius: mob ? 18 : 12, overflow: "hidden", cursor: "grab", touchAction: "none", userSelect: "none", border: `1px solid ${line}`, opacity: shown ? 1 : 0.35 }}>
        <img src={url} alt="" draggable={false} onLoad={(e) => { nat.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...fit, filter: bannerFilter(style), pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", padding: "6px 12px", borderRadius: 99, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, fontWeight: 700, pointerEvents: "none", whiteSpace: "nowrap", opacity: drag.current ? 0 : 0.9 }}>{en ? "Drag to frame" : "Arrasta para enquadrar"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button type="button" aria-label="−" onClick={() => write(fx, fy, Math.max(100, z - 10))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${line}`, background: "transparent", color: text, fontSize: 17, cursor: "pointer", fontFamily: "inherit" }}>−</button>
        <input type="range" min={100} max={250} value={z} onChange={(e) => write(fx, fy, Number(e.target.value))} aria-label="Zoom" style={{ flex: 1, accentColor: accent }} />
        <button type="button" aria-label="+" onClick={() => write(fx, fy, Math.min(250, z + 10))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${line}`, background: "transparent", color: text, fontSize: 17, cursor: "pointer", fontFamily: "inherit" }}>+</button>
        <span style={{ width: 42, textAlign: "right", fontSize: 12.5, fontWeight: 800, color: accent }}>{Math.round(z)}%</span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} style={{ width: 18, height: 18, accentColor: accent }} />
        <span style={{ fontSize: 13, color: muted }}>{en ? "Show banner" : "Mostrar banner"}</span>
      </label>
      {differs && (
        <button type="button" onClick={() => { const { mfx, mfy, mz, ...rest } = style; onStyle(rest); }} style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: muted, fontFamily: "inherit", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>{en ? "Reset to match PC" : "Repor igual ao PC"}</button>
      )}
    </div>
  );
}
