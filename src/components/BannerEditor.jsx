import { useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { BannerHero } from "./BannerHero";
import { useBannerPalette, hexToRgb } from "../lib/bannerColors";

// Editor do banner (no "Editar perfil"): imagem, cores tiradas do banner, e 3 controlos.
// A pré-visualização é o mesmo componente que o perfil usa no telemóvel → o que vês é o que fica.
export function BannerEditor({ url, style, onStyle, onFile, onRemove, uploading, hide, onHide, lang, avatar, name }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const en = lang === "en";
  const fileRef = useRef();
  const palette = useBannerPalette(url);
  const line = darkMode ? "#30363d" : "#e2e8f0";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const set = (k, v) => onStyle({ ...style, [k]: v });
  const swatches = palette ? [{ id: "auto", hex: "", label: "Auto" }, ...palette.map((p, i) => ({ ...p, label: [en ? "Dominant" : "Dominante", en ? "Vibrant" : "Vibrante", en ? "Muted" : "Suave", en ? "Dark" : "Escura", en ? "Darkest" : "Mais escura"][i] }))] : [];
  const slider = (k, label, min, max, fmt) => (
    <label style={{ display: "block", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: muted, marginBottom: 4 }}><span>{label}</span><span style={{ color: text, fontWeight: 700 }}>{fmt(style[k])}</span></div>
      <input type="range" min={min} max={max} value={style[k]} onChange={(e) => set(k, Number(e.target.value))} style={{ width: "100%", accentColor: accent }} />
    </label>
  );
  const btn = { padding: "8px 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${line}`, background: "transparent", color: text };
  return (
    <div style={{ textAlign: "left", padding: 14, borderRadius: 14, border: `1px solid ${line}`, background: darkMode ? "#0d1117" : "#f8fafc" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: text, marginBottom: 4 }}>{en ? "Banner" : "Banner"}</div>
      {!isMobileDevice && (
        <div style={{ fontSize: 11.5, lineHeight: 1.45, color: muted, padding: "8px 10px", borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}33`, marginBottom: 10 }}>
          📱 {en ? "On mobile, profiles have a banner. On PC the profile keeps its current layout, without a banner — you can still set it here." : "No telemóvel os perfis têm banner. No PC o perfil mantém o layout atual, sem banner — podes escolhê-lo aqui na mesma."}
        </div>
      )}
      <input type="file" accept="image/*" ref={fileRef} onChange={(e) => { onFile(e); e.target.value = ""; }} style={{ display: "none" }} />
      {!url ? (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...btn, width: "100%", padding: "22px 10px", borderStyle: "dashed", color: muted }}>{uploading ? (en ? "Uploading…" : "A enviar…") : (en ? "+ Add banner image" : "+ Adicionar imagem de banner")}</button>
      ) : (
        <>
          <div style={{ maxWidth: 360, margin: "0 auto" }}>
            <BannerHero urlOverride={url} styleOverride={style} height={90} style={{ borderRadius: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg, ${accent}, ${accent}88)`, overflow: "hidden", boxShadow: `0 0 0 3px ${darkMode ? "#0a0c10" : "#fff"}` }}>
                  {avatar && <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 8, color: text }}>{name || (en ? "Your name" : "O teu nome")}</div>
                <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 11, color: muted, justifyContent: "flex-start" }}>{["142", "98", "8.1", "6"].map((n, i) => <span key={i}><b style={{ color: text, fontSize: 15 }}>{n}</b></span>)}</div>
              </div>
            </BannerHero>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={btn}>{uploading ? (en ? "Uploading…" : "A enviar…") : (en ? "Change image" : "Trocar imagem")}</button>
            <button type="button" onClick={onRemove} style={{ ...btn, color: "#f87171", borderColor: "#ef444455" }}>{en ? "Remove" : "Remover"}</button>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: muted }}>{en ? "Colours picked from the banner" : "Cores tiradas do banner"}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            {swatches.map((sw) => {
              const on = (style.c || "") === sw.hex;
              return (
                <button key={sw.id} type="button" title={sw.label} aria-label={sw.label} onClick={() => set("c", sw.hex)} style={{ width: 36, height: 36, borderRadius: "50%", cursor: "pointer", padding: 0, fontSize: 10, fontWeight: 800, color: text,
                  background: sw.hex ? `#${sw.hex}` : "transparent", border: `2px solid ${on ? accent : line}`, boxShadow: on ? `0 0 0 2px ${accent}55` : "none" }}>{sw.hex ? "" : "A"}</button>
              );
            })}
            <label title={en ? "Custom colour" : "Cor à escolha"} style={{ width: 36, height: 36, borderRadius: "50%", border: `2px dashed ${line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: muted, fontSize: 16, position: "relative", overflow: "hidden" }}>
              +<input type="color" value={`#${style.c || "808080"}`} onChange={(e) => set("c", e.target.value.replace("#", ""))} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
          {slider("m", en ? "Tint strength" : "Mistura da cor", 0, 100, (v) => `${v}%`)}
          {slider("d", en ? "Darken towards the bottom" : "Escurecer ao descer", 0, 100, (v) => v === 0 ? (en ? "none" : "nada") : `${v}%`)}
          {slider("b", en ? "Brightness" : "Brilho", 60, 140, (v) => `${v}%`)}
          <button type="button" onClick={() => onStyle({ c: "", m: 70, d: 55, b: 100, a: 1 })} style={{ ...btn, marginTop: 12, fontSize: 11.5, padding: "6px 12px", color: muted }}>{en ? "Reset style" : "Repor estilo"}</button>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={style.a !== 0} onChange={(e) => set("a", e.target.checked ? 1 : 0)} style={{ width: 16, height: 16, accentColor: accent }} />
            <span style={{ fontSize: 12.5, color: muted }}>{en ? "Use the banner colour as the app accent colour" : "Usar a cor do banner como cor de destaque da app"}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={!hide} onChange={(e) => onHide(!e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
            <span style={{ fontSize: 12.5, color: muted }}>{en ? "Show banner on mobile" : "Mostrar banner no telemóvel"}</span>
          </label>
        </>
      )}
    </div>
  );
}
