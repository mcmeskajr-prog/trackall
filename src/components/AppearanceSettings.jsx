import { useState } from "react";
import { ACCENT_PRESETS, BG_PRESETS } from "../config/theme";
import { compressImage } from "../lib/utils";

// ─── Definições › Aparência ──────────────────────────────────────────────────
// Estilos prontos + todas as opções de personalização (cor de destaque, fundo, imagem, painéis,
// texto, barra lateral, dispositivos separados, avaliação) com pré-visualização ao vivo.

export const RATING_STYLE_KEY = "trackall_rating_style";

// Estilos prontos: afinam-se por cima com as opções abaixo
const STYLE_PRESETS = [
  { id: "carmim",    name: "Carmim",     accent: "#dc2626", bg: "#120a0c", panel: "#0c0c10", opacity: 70 },
  { id: "meianoite", name: "Meia-noite", accent: "#8b5cf6", bg: "#0a0d12", panel: "#0e121a", opacity: 80 },
  { id: "oceano",    name: "Oceano",     accent: "#38bdf8", bg: "#08141c", panel: "#0a1822", opacity: 80 },
  { id: "floresta",  name: "Floresta",   accent: "#34d399", bg: "#0a130f", panel: "#0c1a14", opacity: 80 },
  { id: "claro",     name: "Claro",      accent: "#6366f1", bg: "#f3f4f8", panel: "#ffffff", opacity: 85 },
];
const PANEL_SWATCHES = ["#161b22", "#1e293b", "#0f172a", "#1c1c1e", "#0d1117", "#ffffff", "#f1f5f9", "#f6f8fa"];

const hexToRgb = (hex) => {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export function AppearanceSettings({
  accent, bgColor, bgColorMobile, sidebarColor, textContrast, textContrastMobile, bgSeparateDevices, darkMode,
  panelBg, panelOpacity, bgImage, bgImageMobile, bgOverlay, bgBlur, bgParallax, isMobileDevice, lang, useT,
  savedThemes, computedPanelBg,
  onAccentChange, onBgChange, onBgColorMobile, onSidebarColor, onTextContrast, onTextContrastMobile,
  onPanelBg, onPanelOpacity, onBgImage, onBgImageMobile, onBgOverlay, onBgBlur, onBgParallax, onBgSeparateDevices,
}) {
  const [themeName, setThemeName] = useState("");
  const [ratingStyle, setRatingStyleState] = useState(() => { try { return localStorage.getItem(RATING_STYLE_KEY) || "stars"; } catch { return "stars"; } });
  const setRatingStyle = (v) => {
    setRatingStyleState(v);
    try { localStorage.setItem(RATING_STYLE_KEY, v); window.dispatchEvent(new Event("trackall-rating-style")); } catch {}
  };

  const en = lang === "en";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#9aa6b2" : "#475569";
  const line = darkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.1)";
  const panel = computedPanelBg;
  const box = { background: panel, border: `1px solid ${line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12 };
  const eyebrow = { fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: sub };
  const chip = (on, color = accent) => ({ padding: "7px 14px", minHeight: 36, borderRadius: 10, border: `1px solid ${on ? color : line}`, background: on ? `${color}22` : "transparent", color: on ? color : sub, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 });
  const sw = (on, round) => ({ width: 34, height: 34, borderRadius: round ? 999 : 10, cursor: "pointer", padding: 0, border: on ? `3px solid ${darkMode ? "#fff" : "#0f172a"}` : `2px solid ${line}` });

  // ── estilos prontos ──
  const hasImg = bgSeparateDevices && isMobileDevice ? bgImageMobile : bgImage;
  const applyPreset = (p) => {
    if (hasImg && !(bgSeparateDevices && isMobileDevice) && !window.confirm(en ? "This style removes the background image. Continue?" : "Este estilo vai remover a imagem de fundo. Continuar?")) return;
    onAccentChange(p.accent);
    if (bgSeparateDevices && isMobileDevice) onBgColorMobile(p.bg); else { onBgChange(p.bg); onBgImage(""); }
    onPanelBg(p.panel); onPanelOpacity(p.opacity);
    onSidebarColor(""); onTextContrast(100); onTextContrastMobile(100);
  };
  const activePreset = STYLE_PRESETS.find(p => p.accent === accent && p.bg === (bgSeparateDevices && isMobileDevice ? bgColorMobile : bgColor) && p.panel === panelBg)?.id;

  // ── temas guardados (mantém o comportamento anterior, imagens à parte no localStorage) ──
  const themes = savedThemes?.themes || [];
  const applyTheme = (t) => {
    if (t.accent) onAccentChange(t.accent);
    if (t.bgColor) onBgChange(t.bgColor);
    if (t.bgColorMobile !== undefined) onBgColorMobile(t.bgColorMobile);
    if (t.sidebarColor !== undefined) onSidebarColor(t.sidebarColor);
    if (t.textContrast !== undefined) onTextContrast(t.textContrast);
    if (t.textContrastMobile !== undefined) onTextContrastMobile(t.textContrastMobile);
    if (t.panelBg !== undefined) onPanelBg(t.panelBg);
    if (t.panelOpacity !== undefined) onPanelOpacity(t.panelOpacity);
    if (t.bgOverlay !== undefined) onBgOverlay(t.bgOverlay);
    if (t.bgBlur !== undefined) onBgBlur(t.bgBlur);
    if (t.bgParallax !== undefined) onBgParallax(t.bgParallax);
    try {
      if (t.hasBgImage) onBgImage(localStorage.getItem(`trackall_theme_img_${t.name}`) || ""); else onBgImage("");
      if (isMobileDevice) { if (t.hasBgImageMobile) onBgImageMobile(localStorage.getItem(`trackall_theme_imgm_${t.name}`) || ""); else onBgImageMobile(""); }
    } catch {}
  };
  const saveTheme = () => {
    const name = themeName.trim(); if (!name) return;
    try {
      if (bgImage) localStorage.setItem(`trackall_theme_img_${name}`, bgImage);
      if (bgImageMobile) localStorage.setItem(`trackall_theme_imgm_${name}`, bgImageMobile);
    } catch {}
    const t = { name, accent, bgColor, bgColorMobile, sidebarColor, textContrast, textContrastMobile, bgSeparateDevices, darkMode, panelBg, panelOpacity, bgOverlay, bgBlur, bgParallax, hasBgImage: !!bgImage, hasBgImageMobile: !!bgImageMobile };
    savedThemes?.save([...themes.filter(x => x.name !== name), t]);
    setThemeName("");
  };

  // ── pré-visualização ──
  const pvBg = (bgSeparateDevices && isMobileDevice ? bgColorMobile : bgColor) || bgColor;
  const pvImg = bgSeparateDevices && isMobileDevice ? bgImageMobile : bgImage;
  const posters = ["linear-gradient(160deg,#3b2a2a,#111)", "linear-gradient(160deg,#2a3b4a,#0f1720)", "linear-gradient(160deg,#4a3a1f,#1a1409)", "linear-gradient(160deg,#2f2a4a,#100d1f)", "linear-gradient(160deg,#1f4a3a,#09170f)"];
  const bars = [4, 6, 5, 8, 10, 14, 20, 32, 45, 38, 60, 72, 100, 55, 40, 26, 16, 10, 6, 4];
  const tc = (bgSeparateDevices && isMobileDevice ? textContrastMobile : textContrast) || 100;
  const pvPanel = { background: panel, border: `1px solid ${line}`, borderRadius: 14 };

  const preview = (
    <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${line}`, position: "relative", background: pvBg }}>
      {pvImg && <div style={{ position: "absolute", inset: 0, background: `url(${pvImg}) center/cover`, filter: bgBlur ? `blur(${bgBlur}px)` : undefined, transform: "scale(1.05)" }} />}
      {pvImg && <div style={{ position: "absolute", inset: 0, background: bgOverlay || "transparent" }} />}
      <div style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column", gap: 12, color: text, filter: tc !== 100 ? `brightness(${tc / 100})` : undefined }}>
        <div style={{ ...pvPanel, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 50, height: 50, borderRadius: 99, background: `linear-gradient(135deg, ${accent}, #222)`, boxShadow: `0 0 0 3px ${accent}`, flexShrink: 0 }} />
          <div><div style={{ fontSize: 18, fontWeight: 800 }}>Higan</div><div style={{ fontSize: 11, color: sub }}>TrackAll · 232 {en ? "items" : "itens"}</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[["232", en ? "items" : "itens"], ["174", en ? "completed" : "completados"], ["7.6", en ? "average" : "média"]].map(([n, l], i) => (
            <div key={l} style={{ ...pvPanel, padding: 10 }}><div style={{ fontSize: 20, fontWeight: 800, color: i === 2 ? accent : text }}>{n}</div><div style={{ fontSize: 10, color: sub }}>{l}</div></div>
          ))}
        </div>
        <div style={{ ...pvPanel, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: sub, marginBottom: 8 }}>{en ? "RATINGS" : "DISTRIBUIÇÃO"}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
            {bars.map((b, i) => <div key={i} style={{ flex: 1, height: `${b}%`, borderRadius: "2px 2px 0 0", background: accent }} />)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{posters.map((g, i) => <div key={i} style={{ flex: 1, aspectRatio: "2/3", borderRadius: 8, background: g }} />)}</div>
        <div style={{ ...pvPanel, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: sub, flex: 1 }}>{en ? "YOUR RATING" : "A TUA NOTA"}</span>
          {ratingStyle === "bar"
            ? <div style={{ position: "relative", width: 110, height: 8, borderRadius: 9, background: darkMode ? "#2b333d" : "#d5d9e2" }}><div style={{ width: "85%", height: "100%", borderRadius: 9, background: "linear-gradient(90deg,#b45309,#f59e0b)" }} /><div style={{ position: "absolute", left: "85%", top: -4, width: 16, height: 16, marginLeft: -8, borderRadius: 99, background: "#fff", boxShadow: "0 1px 5px rgba(0,0,0,.5)" }} /></div>
            : <span style={{ fontSize: 16, letterSpacing: 1, color: "#f59e0b" }}>★★★★<span style={{ color: darkMode ? "#2b333d" : "#d5d9e2" }}>★</span></span>}
          <span style={{ fontWeight: 800, color: "#f59e0b" }}>8.5</span>
        </div>
      </div>
    </div>
  );

  const slider = (label, value, onChange, min, max, step, color = accent, extra) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, fontWeight: 700 }}><span>{label}</span><span style={{ color }}>{value}{extra || "%"}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} style={{ width: "100%", accentColor: color, cursor: "pointer" }} />
    </div>
  );
  const colorRow = (presets, current, onPick, onCustom, round) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      {presets.map(p => <button key={p.name || p} type="button" onClick={() => onPick(p.value || p.color || p)} title={p.name || p} aria-label={p.name || p} style={{ ...sw(current === (p.value || p.color || p), round), background: p.value || p.color || p }} />)}
      <label style={{ ...sw(false, round), border: `2px dashed ${line}`, display: "flex", alignItems: "center", justifyContent: "center", color: sub, fontSize: 16, position: "relative", cursor: "pointer" }}>+
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#888888"} onChange={e => onCustom(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
      </label>
    </div>
  );
  const imgPicker = (img, onSet, w, h, q, icon, label, color) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <label style={{ width: 64, height: 64, borderRadius: 12, border: img ? `2px solid ${color}` : `2px dashed ${line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: img ? `url(${img}) center/cover` : "transparent", overflow: "hidden", gap: 2 }}>
        {!img && <><span>{icon}</span><span style={{ fontSize: 10, color: sub }}>{label}</span></>}
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files[0]; if (!f) return; const c = await compressImage(f, w, h, q); if (c) onSet(c); }} />
      </label>
      {img && <button type="button" onClick={() => onSet("")} style={{ fontSize: 11, padding: "2px 10px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
    </div>
  );

  const controls = (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
      {/* Estilos prontos */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={eyebrow}>{en ? "Style" : "Estilo"}</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(2, minmax(0,1fr))" : "repeat(5, minmax(0,1fr))", gap: 10 }}>
          {STYLE_PRESETS.map(p => {
            const on = activePreset === p.id;
            const rgb = hexToRgb(p.panel) || [20, 20, 20];
            const pn = `rgba(${rgb.join(",")},0.85)`;
            const ln = p.id === "claro" ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.1)";
            return (
              <button key={p.id} type="button" onClick={() => applyPreset(p)} style={{ cursor: "pointer", fontFamily: "inherit", color: text, textAlign: "left", display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 16, border: `2px solid ${on ? accent : "transparent"}`, background: on ? "rgba(128,128,128,0.12)" : "transparent" }}>
                <div style={{ height: 80, borderRadius: 10, background: p.bg, display: "flex", gap: 6, padding: 8, boxSizing: "border-box" }}>
                  <div style={{ width: "34%", borderRadius: 8, background: pn, border: `1px solid ${ln}` }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 14, borderRadius: 6, background: pn, border: `1px solid ${ln}` }} />
                    <div style={{ flex: 1, borderRadius: 6, background: pn, border: `1px solid ${ln}`, position: "relative" }}><div style={{ position: "absolute", left: 6, bottom: 6, width: 24, height: 5, borderRadius: 9, background: p.accent }} /></div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: "0 4px 2px" }}>{p.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cor de destaque */}
      <section style={box}>
        <div style={eyebrow}>{useT("accentColor")}</div>
        {colorRow(ACCENT_PRESETS, accent, onAccentChange, onAccentChange, true)}
      </section>

      {/* Fundo */}
      <section style={box}>
        <div style={eyebrow}>{useT("bgSection")}</div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{en ? "Color" : "Cor"}{bgSeparateDevices ? " · 🖥 PC" : ""}</p>
          {colorRow(BG_PRESETS, !bgImage ? bgColor : "", v => { onBgChange(v); onBgImage(""); }, v => { onBgChange(v); onBgImage(""); }, false)}
        </div>
        {bgSeparateDevices && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>{useT("bgColorMobile")}</p>
              {bgColorMobile && <button type="button" onClick={() => onBgColorMobile("")} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕ {en ? "same as PC" : "igual PC"}</button>}
            </div>
            {colorRow(BG_PRESETS, bgColorMobile, onBgColorMobile, onBgColorMobile, false)}
          </div>
        )}
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{useT("bgImage")}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {imgPicker(bgImage, onBgImage, 1920, 1080, 0.9, "🖥", "PC", accent)}
            {bgSeparateDevices && imgPicker(bgImageMobile, onBgImageMobile, 1080, 1920, 0.85, "📱", "Mobile", "#06b6d4")}
          </div>
        </div>
        {(bgImage || bgImageMobile) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{useT("overlay")}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ label: en ? "None" : "Nenhum", val: "rgba(0,0,0,0)" }, { label: useT("overlaySoft"), val: "rgba(0,0,0,0.3)" }, { label: useT("overlayMid"), val: "rgba(0,0,0,0.55)" }, { label: useT("overlayStrong"), val: "rgba(0,0,0,0.75)" }, { label: useT("overlayWhite"), val: "rgba(255,255,255,0.6)" }].map(o => (
                  <button key={o.label} type="button" onClick={() => onBgOverlay(o.val)} style={chip(bgOverlay === o.val)}>{o.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{en ? "Blur" : "Desfoque"} — {bgBlur}px</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[0, 2, 4, 8, 12].map(v => <button key={v} type="button" onClick={() => onBgBlur(v)} style={chip(bgBlur === v)}>{v === 0 ? (en ? "None" : "Nenhum") : `${v}px`}</button>)}</div>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{useT("scroll")}</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => onBgParallax(true)} style={chip(!!bgParallax)}>{useT("parallax")}</button>
                <button type="button" onClick={() => onBgParallax(false)} style={chip(!bgParallax)}>{useT("staticScroll")}</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Painéis */}
      <section style={box}>
        <div style={eyebrow}>{useT("statsCards")}</div>
        <p style={{ fontSize: 12, color: sub, marginTop: -4 }}>{en ? "Applies to profile, stats, diary, home and lists panels." : "Aplica-se aos painéis do perfil, estatísticas, diário, início e listas."}</p>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{useT("statsCardsColor")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={() => { onPanelBg(""); onPanelOpacity(100); }} style={{ ...sw(!panelBg, false), background: "transparent", fontSize: 10, color: sub, fontFamily: "inherit" }}>Auto</button>
            {PANEL_SWATCHES.map(c => <button key={c} type="button" onClick={() => onPanelBg(c)} title={c} aria-label={c} style={{ ...sw(panelBg === c, false), background: c }} />)}
            <label style={{ ...sw(false, false), border: `2px dashed ${line}`, display: "flex", alignItems: "center", justifyContent: "center", color: sub, fontSize: 16, position: "relative", cursor: "pointer", background: panelBg && !PANEL_SWATCHES.includes(panelBg) ? panelBg : "transparent" }}>{panelBg && !PANEL_SWATCHES.includes(panelBg) ? "" : "+"}
              <input type="color" value={panelBg || "#161b22"} onChange={e => onPanelBg(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
            </label>
          </div>
        </div>
        {slider(useT("panelOpacity"), panelOpacity ?? 100, onPanelOpacity, 0, 100, 1)}
      </section>

      {/* Texto */}
      <section style={box}>
        <div style={eyebrow}>{useT("textSection")}</div>
        {slider(bgSeparateDevices ? "🖥 PC" : (en ? "Contrast" : "Contraste"), textContrast, onTextContrast, 40, 160, 5)}
        {bgSeparateDevices && slider("📱 Mobile", textContrastMobile, onTextContrastMobile, 40, 160, 5, "#06b6d4")}
        <button type="button" onClick={() => { onTextContrast(100); onTextContrastMobile(100); }} style={{ alignSelf: "flex-start", fontSize: 12, color: sub, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>↺ {en ? "Reset" : "Repor"}</button>
      </section>

      {/* Barra lateral */}
      <section style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={eyebrow}>{useT("sidebarSection")}</div>
          {sidebarColor && <button type="button" onClick={() => onSidebarColor("")} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕ {en ? "same as background" : "igual ao fundo"}</button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={() => onSidebarColor("")} title={useT("sameAsBg")} style={{ ...sw(!sidebarColor, false), background: bgColor, color: sub, fontSize: 10, fontFamily: "inherit" }}>≡</button>
          {BG_PRESETS.map(p => <button key={p.name} type="button" onClick={() => onSidebarColor(p.value)} title={p.name} aria-label={p.name} style={{ ...sw(sidebarColor === p.value, false), background: p.value }} />)}
          <label style={{ ...sw(false, false), border: `2px dashed ${line}`, display: "flex", alignItems: "center", justifyContent: "center", color: sub, fontSize: 16, position: "relative", cursor: "pointer" }}>+
            <input type="color" value={sidebarColor || bgColor} onChange={e => onSidebarColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
          </label>
        </div>
      </section>

      {/* Avaliação + dispositivos */}
      <section style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div style={box}>
          <div style={eyebrow}>{en ? "Rating control" : "Avaliação"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setRatingStyle("stars")} style={chip(ratingStyle === "stars")}>{en ? "Stars" : "Estrelas"}</button>
            <button type="button" onClick={() => setRatingStyle("bar")} style={chip(ratingStyle === "bar")}>{en ? "Bar" : "Barra"}</button>
          </div>
        </div>
        <div style={box}>
          <div style={eyebrow}>{useT("devicesSection")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ flex: 1, fontSize: 12, color: sub }}>{en ? "Different color, image and contrast per device" : "Cor, imagem e contraste diferentes por dispositivo"}</p>
            <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0, cursor: "pointer" }}>
              <input type="checkbox" checked={!!bgSeparateDevices} onChange={e => onBgSeparateDevices(e.target.checked)} aria-label={useT("separateDevices")} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", inset: 0, background: bgSeparateDevices ? accent : "#30363d", borderRadius: 24, transition: "background .2s" }} />
              <span style={{ position: "absolute", top: 3, left: bgSeparateDevices ? 23 : 3, width: 18, height: 18, background: "white", borderRadius: "50%", transition: "left .2s" }} />
            </label>
          </div>
        </div>
      </section>

      {/* Os meus estilos */}
      <section style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ ...eyebrow, flex: 1 }}>{useT("savedThemes")}</div>
          <input value={themeName} onChange={e => setThemeName(e.target.value)} placeholder={useT("themeNamePlaceholder")} onKeyDown={e => e.key === "Enter" && saveTheme()} style={{ padding: "7px 12px", fontSize: 13, borderRadius: 10, width: 170 }} />
          <button type="button" onClick={saveTheme} disabled={!themeName.trim()} style={{ padding: "8px 16px", borderRadius: 10, background: accent, border: "none", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: themeName.trim() ? 1 : 0.4 }}>{en ? "Save as my style" : "Guardar como o meu estilo"}</button>
        </div>
        {themes.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {themes.map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${line}`, borderRadius: 999, padding: "4px 6px 4px 12px" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />
                <button type="button" onClick={() => applyTheme(t)} style={{ background: "none", border: "none", color: text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }}>{t.name}</button>
                <button type="button" aria-label={en ? "Delete" : "Apagar"} onClick={() => { try { localStorage.removeItem(`trackall_theme_img_${t.name}`); localStorage.removeItem(`trackall_theme_imgm_${t.name}`); } catch {} savedThemes?.save(themes.filter(x => x.name !== t.name)); }} style={{ background: "none", border: "none", color: sub, fontSize: 12, cursor: "pointer", padding: "0 6px" }}>✕</button>
              </div>
            ))}
          </div>
        ) : <p style={{ fontSize: 12, color: sub }}>{en ? "Save your current setup with a name to switch between later." : "Guarda o teu setup atual com um nome para trocar depois."}</p>}
      </section>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: isMobileDevice ? "column-reverse" : "row", gap: 28, alignItems: "flex-start", color: text }}>
      <div style={{ flex: 1, minWidth: 0, width: "100%" }}>{controls}</div>
      <aside style={{ width: isMobileDevice ? "100%" : 380, flexShrink: 0, position: isMobileDevice ? "static" : "sticky", top: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={eyebrow}>{en ? "Live preview" : "Pré-visualização"}</div>
        {preview}
      </aside>
    </div>
  );
}
