import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ThemeContext, useTheme } from "../contexts/ThemeContext";
import { supa } from "../config/supabase";
import { compressImage } from "../lib/utils";
import { persistImage } from "../lib/imageStore";
import { STYLE_PRESETS } from "./AppearanceSettings";
import { Suspense } from "react";
import { lazyNamed } from "../lib/lazyNamed";
const CropModal = lazyNamed(() => import("./CropModal"), "CropModal");
import { ColorPicker, PICKER_SUGGESTIONS } from "./ColorPicker";
import { BannerHero } from "./BannerHero";
import { splitBanner, joinBanner, useBannerPalette, bannerAccentHex, DEFAULT_BANNER_STYLE, rgbToHsl, hslToHex } from "../lib/bannerColors";
import { hexRgb, hexLum, overlayAlpha, onAccent as onAccentColor } from "../lib/contrast";

// ─── Personalizar: três linhas (Banner, Foto, Cor) e "Mais opções" fechado ───
// O fundo acompanha sempre a cor escolhida (ou o banner). Wallpaper, transparência e sincronização ficam em Mais opções. Tudo é rascunho (vês ao vivo em cima) até carregares em Guardar.
// Fundo e painel com o tom da cor de destaque (é isto que faz o fundo acompanhar o tema)
const tintFrom = (hex) => { const [h, s0] = rgbToHsl(...(hexRgb(hex) || [90, 90, 90])); return { bg: `#${hslToHex(h, Math.min(0.45, 0.2 + s0 * 0.3), 0.065)}`, panel: `#${hslToHex(h, Math.min(0.4, 0.15 + s0 * 0.25), 0.095)}` }; };
export function PersonalizeMobile({
  profile, currentUserId, onUpdateProfile, lang, savedThemes,
  accent, bgColor, bgColorMobile, bgSeparateDevices, bgImage, bgImageMobile, panelBg, panelOpacity, bgOverlay, bgBlur,
  onAccentChange, onBgChange, onBgColorMobile, onBgImage, onBgImageMobile, onPanelBg, onPanelOpacity, onBgSeparateDevices, onBgOverlay, onBgBlur,
}) {
  const { darkMode } = useTheme();
  const theme = useTheme();
  const en = lang === "en";
  const line = darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.12)";
  const muted = darkMode ? "#9aa6b2" : "#64748b";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sheetBg = darkMode ? "#14101a" : "#ffffff";

  const saved = splitBanner(profile.banner);
  const curBg = (bgSeparateDevices ? bgColorMobile : bgColor) || bgColor;
  const curImg = bgSeparateDevices ? bgImageMobile : bgImage;
  const initial = useMemo(() => ({
    url: saved.url, style: saved.style, accent, bgMode: saved.url && saved.style.g !== 0 ? "auto" : (curImg ? "image" : ((curBg || "").toLowerCase() === tintFrom(accent).bg ? "accent" : "color")),
    bgColor: curBg, bgImage: curImg || "", panel: panelBg, opacity: panelOpacity,
    ov: Math.round(overlayAlpha(bgOverlay) * 100), blur: bgBlur || 0,
  }), [profile.banner, accent, curBg, curImg, panelBg, panelOpacity, bgOverlay, bgBlur]); // eslint-disable-line
  const [d, setD] = useState(initial);
  const [sheet, setSheet] = useState(null); // "banner" | "color" | "bg" | "picker"
  const [crop, setCrop] = useState(null);   // { src, type }
  const [busy, setBusy] = useState(null);   // "banner" | "avatar"
  const [err, setErr] = useState("");
  const [undo, setUndo] = useState(null);
  const fileRef = useRef(), avatarRef = useRef(), bgFileRef = useRef();

  // se o perfil mudar por fora (ex.: depois de guardar), volta a alinhar o rascunho
  useEffect(() => { setD(initial); }, [initial]);

  const palette = useBannerPalette(d.url);
  const follow = d.style.a !== 0;
  const bannerAcc = bannerAccentHex(d.style, palette);
  const bannerSwatch = d.url ? bannerAccentHex({ ...d.style, a: 1 }, palette) : null; // continua visível mesmo depois de escolheres outra cor
  const followChanged = d.style.a !== initial.style.a, urlChanged = d.url !== initial.url;
  // a cor do banner só entra quando o banner (ou a opção "acompanha") muda; senão mantém-se a cor da app
  const effAccent = follow && d.url && bannerAcc && (urlChanged || followChanged) ? bannerAcc : d.accent;
  const pick4 = (x) => JSON.stringify({ u: x.url, s: x.style, m: x.bgMode, c: x.bgColor, i: x.bgImage, p: x.panel, o: x.opacity, v: x.ov, l: x.blur });
  const dirty = pick4(d) !== pick4(initial) || effAccent !== accent;
  const tint = tintFrom(effAccent);
  const bgEff = d.bgMode === "accent" ? tint.bg : d.bgColor;
  const panelEff = d.bgMode === "accent" ? tint.panel : d.panel;
  const [more, setMore] = useState(false);
  const pickAccent = (hex) => setD((x) => ({ ...x, accent: `#${hex}`, bgMode: x.bgMode === "image" ? "image" : "accent", style: { ...x.style, a: 0, g: 0 } }));
  const pickBanner = () => setD((x) => ({ ...x, accent: bannerSwatch || x.accent, bgMode: x.bgImage && x.bgMode === "image" ? "image" : "auto", style: { ...x.style, a: 1, g: 1 } }));
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const setStyle = (patch) => setD((p) => ({ ...p, style: { ...p.style, ...patch } }));

  const flash = (label, restore) => { setUndo({ label, restore }); setTimeout(() => setUndo((u) => (u && u.label === label ? null : u)), 7000); };

  // ── enviar imagens (banner / foto) ──
  const pick = (type) => (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setSheet(null); if (f) setCrop({ src: URL.createObjectURL(f), type }); };
  const onCrop = async (dataUrl) => {
    const type = crop.type; setCrop(null); setErr("");
    const prevUrl = d.url, prevAvatar = profile.avatar;
    if (type === "banner") set({ url: dataUrl });          // aparece logo, desfocado até chegar
    setBusy(type);
    try {
      const url = currentUserId ? await supa.uploadImage(currentUserId, await (await fetch(dataUrl)).blob(), `${type}-${Date.now()}.jpg`) : dataUrl;
      if (type === "banner") set({ url, style: { ...d.style, a: 1 } });
      else { await onUpdateProfile({ ...profile, avatar: url }); flash(en ? "Photo changed" : "Foto alterada", () => onUpdateProfile({ ...profile, avatar: prevAvatar || "" })); }
    } catch (e2) {
      console.error(e2);
      if (type === "banner") set({ url: prevUrl });
      setErr(type === "banner" ? (en ? "Couldn't upload the banner. The previous one is still active." : "Não foi possível enviar o banner. O anterior continua ativo.") : (en ? "Couldn't upload the photo." : "Não foi possível enviar a foto."));
    } finally { setBusy(null); }
  };
  const onBgFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const c = await compressImage(f, 1080, 1920, 0.85); if (!c) return;
    set({ bgImage: await persistImage(c), bgMode: "image" });
  };

  // ── temas prontos (rascunho) ──
  const isLight = (hex) => hexLum(hex) > 0.5;
  const applyPreset = (p) => setD((x) => ({ ...x, accent: p.accent, bgColor: p.bg, panel: p.panel, opacity: p.opacity, bgMode: isLight(p.bg) ? "color" : "accent", bgImage: "", style: { ...x.style, a: 0, g: 0 } }));
  const themeOn = (p) => effAccent.toLowerCase() === p.accent && (d.bgMode === "accent" ? !isLight(p.bg) : d.bgColor === p.bg);

  // ── temas guardados (nome + definições atuais) ──
  const [themeName, setThemeName] = useState("");
  const themes = savedThemes?.themes || [];
  const imgKey = (n) => `trackall_theme_${bgSeparateDevices ? "imgm" : "img"}_${n}`;
  const saveCurrentTheme = () => {
    const name = themeName.trim(); if (!name || !savedThemes?.save) return;
    const hasImg = d.bgMode === "image" && !!d.bgImage;
    try { if (hasImg) localStorage.setItem(imgKey(name), d.bgImage); } catch {}
    const t = { name, accent: effAccent, bgColor: bgEff, panelBg: panelEff, panelOpacity: d.opacity, bgMode: d.bgMode, bgOverlay: `rgba(0,0,0,${d.ov / 100})`, bgBlur: d.blur, hasBgImage: hasImg && !bgSeparateDevices, hasBgImageMobile: hasImg && !!bgSeparateDevices };
    savedThemes.save([...themes.filter((x) => x.name !== name), t]);
    setThemeName(""); flash(en ? "Theme saved" : "Tema guardado", () => savedThemes.save(themes));
  };
  const applySaved = (t) => {
    let img = ""; try { img = (t.hasBgImage || t.hasBgImageMobile) ? (localStorage.getItem(`trackall_theme_${t.hasBgImageMobile ? "imgm" : "img"}_${t.name}`) || "") : ""; } catch {}
    setD((x) => ({ ...x, accent: t.accent || x.accent, bgColor: t.bgColor || x.bgColor, panel: t.panelBg ?? x.panel, opacity: t.panelOpacity ?? x.opacity,
      bgMode: img ? "image" : (t.bgMode === "accent" || t.bgMode === "color" ? t.bgMode : "color"), bgImage: img || "", ov: t.bgOverlay ? Math.round(overlayAlpha(t.bgOverlay) * 100) : x.ov, blur: t.bgBlur ?? x.blur,
      style: { ...x.style, a: 0, g: 0 } }));
  };
  const delTheme = (t) => { try { localStorage.removeItem(`trackall_theme_img_${t.name}`); localStorage.removeItem(`trackall_theme_imgm_${t.name}`); } catch {} savedThemes?.save(themes.filter((x) => x.name !== t.name)); };

  // ── guardar / cancelar ──
  const commit = async () => {
    const before = { ...initial, accent };
    const bannerStr = joinBanner(d.url, { ...d.style, g: d.bgMode === "auto" ? 1 : 0 });
    const toColor = d.bgMode === "color" || d.bgMode === "accent";
    if (bannerStr !== (profile.banner || "")) await onUpdateProfile({ ...profile, banner: bannerStr, hideBannerMobile: d.url ? false : profile.hideBannerMobile });
    if (effAccent !== accent) onAccentChange(effAccent);
    if (toColor) { bgSeparateDevices ? onBgColorMobile(bgEff) : onBgChange(bgEff); }
    if (toColor || d.bgMode === "auto") { bgSeparateDevices ? onBgImageMobile("") : onBgImage(""); }
    if (d.bgMode === "image") { bgSeparateDevices ? onBgImageMobile(d.bgImage) : onBgImage(d.bgImage); }
    if (panelEff !== panelBg) onPanelBg(panelEff);
    if (d.opacity !== panelOpacity) onPanelOpacity(d.opacity);
    if (d.ov !== initial.ov && onBgOverlay) onBgOverlay(`rgba(0,0,0,${d.ov / 100})`);
    if (d.blur !== initial.blur && onBgBlur) onBgBlur(d.blur);
    flash(en ? "Changes saved" : "Alterações guardadas", async () => {
      await onUpdateProfile({ ...profile, banner: profile.banner || "" });
      onAccentChange(before.accent);
      bgSeparateDevices ? onBgColorMobile(before.bgColor) : onBgChange(before.bgColor);
      bgSeparateDevices ? onBgImageMobile(before.bgImage) : onBgImage(before.bgImage);
      onPanelBg(before.panel); onPanelOpacity(before.opacity);
      if (onBgOverlay) onBgOverlay(`rgba(0,0,0,${before.ov / 100})`); if (onBgBlur) onBgBlur(before.blur);
    });
  };

  const prevTheme = { ...theme, accent: effAccent };
  const A = effAccent;
  const Row = ({ title, sub, onClick, children }) => (
    <button type="button" onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 0", background: "none", border: "none", borderBottom: `1px solid ${line}`, textAlign: "left", fontFamily: "inherit", color: text, cursor: "pointer" }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 11.5, color: muted, marginTop: 1 }}>{sub}</div></div>
      {children}<span style={{ color: muted, fontSize: 16 }}>›</span>
    </button>
  );
  const swBtn = { flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" };
  const swLbl = (on) => ({ fontSize: 11, fontWeight: on ? 800 : 600, color: on ? text : muted, whiteSpace: "nowrap" });
  const linkBtn = { background: "none", border: "none", color: A, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 6 };
  const renderSheet = (title, children) => createPortal(
    <div onClick={() => setSheet(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "86vh", overflowY: "auto", boxSizing: "border-box", borderRadius: "28px 28px 0 0", background: sheetBg, borderTop: `1px solid ${line}`, padding: "12px 18px calc(22px + env(safe-area-inset-bottom))", color: text }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: darkMode ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.2)", margin: "0 auto 14px" }} />
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 12 }}>{title}</div>
        {children}
        <button type="button" onClick={() => setSheet(null)} style={{ width: "100%", height: 46, marginTop: 16, borderRadius: 14, border: "none", background: A, color: onAccentColor(A), fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>{en ? "Done" : "Concluído"}</button>
      </div>
    </div>, document.body);
  const lbl = { fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: muted, margin: "16px 0 8px", textTransform: "uppercase" };
  const circle = (c, on, onClick, key) => (
    <button key={key || c} type="button" aria-label={c} onClick={onClick} style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, cursor: "pointer", padding: 0, background: c, border: `3px solid ${on ? "#fff" : (darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)")}`, boxShadow: on ? `0 0 0 3px ${c}55` : "none" }} />
  );

  return (
    <ThemeContext.Provider value={prevTheme}>
      <div style={{ paddingBottom: dirty ? 96 : 12 }}>
        {/* Pré-visualização ao vivo */}
        <BannerHero urlOverride={d.url} styleOverride={{ ...d.style, g: 1 }} height={120} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${A}, ${A}88)`, boxShadow: `0 0 0 3px ${darkMode ? "#0b0d12" : "#fff"}, 0 0 0 5px ${A}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 28, color: "#fff", opacity: busy === "avatar" ? 0.5 : 1 }}>
              {profile.avatar ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.name || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, marginTop: 10 }}>{profile.name || (en ? "User" : "Utilizador")}</div>
            <div style={{ marginTop: 10, width: "100%", height: 38, borderRadius: 12, border: `1.5px solid ${A}`, background: `${A}14`, color: A, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{en ? "Edit profile" : "Editar perfil"}</div>
          </div>
          {busy === "banner" && <div style={{ position: "absolute", left: 18, right: 18, top: 14 }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>{en ? "Uploading banner…" : "A enviar o banner…"}</div><div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}><div style={{ width: "40%", height: "100%", background: A, animation: "tbar 1.1s ease-in-out infinite alternate" }} /></div></div>}
        </BannerHero>
        <style>{`@keyframes tbar{from{margin-left:0}to{margin-left:60%}}`}</style>
        {err && <div role="alert" style={{ margin: "10px 0", padding: "10px 12px", borderRadius: 12, background: "#ef444418", border: "1px solid #ef444455", fontSize: 13, color: "#f87171" }}>{err}</div>}

        {/* Três linhas */}
        <input type="file" accept="image/*" ref={fileRef} onChange={pick("banner")} style={{ display: "none" }} />
        <input type="file" accept="image/*" ref={avatarRef} onChange={pick("avatar")} style={{ display: "none" }} />
        <input type="file" accept="image/*" ref={bgFileRef} onChange={onBgFile} style={{ display: "none" }} />
        <div style={{ marginTop: 14, borderTop: `1px solid ${line}` }}>
          <Row title="Banner" sub={d.url ? (en ? "Change or remove" : "Trocar ou remover") : (en ? "Add a top image" : "Adicionar imagem do topo")} onClick={() => setSheet("banner")}>
            {d.url ? <div style={{ width: 56, height: 32, borderRadius: 8, overflow: "hidden" }}><img src={d.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div> : <div style={{ width: 56, height: 32, borderRadius: 8, border: `1.5px dashed ${muted}`, display: "flex", alignItems: "center", justifyContent: "center", color: muted }}>+</div>}
          </Row>
          <Row title={en ? "Photo" : "Foto"} sub={en ? "Your profile photo" : "A tua foto de perfil"} onClick={() => avatarRef.current?.click()}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${A}, #222)`, boxShadow: `0 0 0 2px ${A}` }}>{profile.avatar && <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
          </Row>
          <div style={{ padding: "14px 0", borderBottom: `1px solid ${line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{en ? "Colour" : "Cor"}</div>
              <div style={{ fontSize: 11.5, color: muted }}>{en ? "Accent and background follow it" : "Destaque e fundo acompanham"}</div>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", margin: "12px -16px 0", padding: "2px 16px 4px" }}>
              {d.url && bannerSwatch && (
                <div onClick={pickBanner} style={swBtn}>
                  {circle(bannerSwatch, d.bgMode === "auto" && follow, pickBanner, "ban")}
                  <span style={swLbl(d.bgMode === "auto" && follow)}>✦ {en ? "Banner" : "Banner"}</span>
                </div>
              )}
              {STYLE_PRESETS.map((p) => {
                const on = themeOn(p);
                return (
                  <div key={p.id} onClick={() => applyPreset(p)} style={swBtn}>
                    {circle(isLight(p.bg) ? `linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)` : p.accent, on, () => applyPreset(p), p.id)}
                    <span style={swLbl(on)}>{p.name}</span>
                  </div>
                );
              })}
              <div onClick={() => setSheet("picker")} style={swBtn}>
                <span style={{ width: 44, height: 44, borderRadius: "50%", border: `2px dashed ${muted}`, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 20 }}>+</span>
                <span style={swLbl(false)}>{en ? "Other" : "Outra"}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", background: "none", border: "none", borderBottom: more ? "none" : `1px solid ${line}`, color: text, fontFamily: "inherit", cursor: "pointer" }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{en ? "More options" : "Mais opções"}</span>
            <span style={{ color: muted, fontSize: 16, transform: more ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
          </button>
          {more && (
            <div style={{ paddingBottom: 14, borderBottom: `1px solid ${line}` }}>
              {/* Wallpaper */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Wallpaper</div>
              {d.bgMode === "image" && d.bgImage ? (<>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: `center/cover url(${d.bgImage})`, border: `1px solid ${line}`, flexShrink: 0 }} />
                  <button type="button" onClick={() => bgFileRef.current?.click()} style={linkBtn}>{en ? "Change" : "Trocar"}</button>
                  <button type="button" onClick={() => set({ bgImage: "", bgMode: d.url && follow ? "auto" : "accent" })} style={{ ...linkBtn, color: "#f87171" }}>{en ? "Remove" : "Remover"}</button>
                </div>
                {[[en ? "Darken" : "Escurecer", "ov", 0, 90], [en ? "Blur" : "Desfoque", "blur", 0, 20]].map(([l, k, mn, mx]) => (
                  <div key={k} style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}><span>{l}</span><span style={{ color: muted }}>{d[k]}{k === "ov" ? "%" : "px"}</span></div>
                    <input type="range" min={mn} max={mx} step={1} value={d[k]} onChange={(e) => set({ [k]: parseInt(e.target.value, 10) })} style={{ width: "100%", accentColor: A }} />
                  </div>))}
              </>) : (
                <button type="button" onClick={() => bgFileRef.current?.click()} style={{ width: "100%", height: 44, borderRadius: 12, border: `1.5px dashed ${muted}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ {en ? "Choose a wallpaper" : "Escolher wallpaper"}</button>
              )}
              {/* Transparência */}
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                  <span>{en ? "Panel transparency" : "Transparência dos painéis"}</span><span style={{ color: muted }}>{Math.round(100 - d.opacity)}%</span>
                </div>
                <input type="range" min={35} max={100} step={1} value={d.opacity} onChange={(e) => set({ opacity: parseInt(e.target.value, 10) })} style={{ width: "100%", accentColor: A }} aria-label={en ? "Panel transparency" : "Transparência dos painéis"} />
                <div style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>{en ? "Text colour adjusts automatically." : "A cor do texto ajusta-se automaticamente."}</div>
              </div>
              {/* Sincronização */}
              {onBgSeparateDevices && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{en ? "Apply background to" : "Aplicar o fundo a"}</div>
                  <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 14, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)" }}>
                    {[[false, en ? "PC and phone" : "PC e telemóvel"], [true, en ? "Only this device" : "Só este dispositivo"]].map(([v, l]) => (
                      <button key={String(v)} type="button" onClick={() => onBgSeparateDevices(v)} style={{ flex: 1, height: 38, borderRadius: 10, border: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", background: !!bgSeparateDevices === v ? A : "transparent", color: !!bgSeparateDevices === v ? onAccentColor(A) : text, transition: "background .25s" }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: muted, marginTop: 6 }}>{en ? "Accent, name, photo and banner are always shared." : "Cor de destaque, nome, foto e banner são sempre partilhados."}</div>
                </div>
              )}
              {/* Temas */}
              <button type="button" onClick={() => setSheet("themes")} style={{ width: "100%", marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 14, border: `1px solid ${line}`, background: "transparent", color: text, fontFamily: "inherit", cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{en ? "My themes" : "Os meus temas"}</span>
                <span style={{ fontSize: 12, color: muted }}>{themes.length ? (en ? `${themes.length} saved` : `${themes.length} guardados`) : (en ? "Save the current look" : "Guardar o aspeto atual")} ›</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Guardar / Cancelar (só quando há alterações) */}
      {dirty && createPortal(
        <div style={{ position: "fixed", left: 16, right: 16, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 900, display: "flex", gap: 10, padding: 10, borderRadius: 18, background: darkMode ? "rgba(20,16,22,0.94)" : "rgba(255,255,255,0.96)", border: `1px solid ${line}`, backdropFilter: "blur(10px)", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
          <button type="button" onClick={() => setD(initial)} style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${line}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
          <button type="button" onClick={commit} disabled={!!busy} style={{ flex: 1.5, height: 44, borderRadius: 12, border: "none", background: A, color: onAccentColor(A), fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{en ? "Save" : "Guardar"}</button>
        </div>, document.body)}

      {/* Aviso curto com Desfazer */}
      {undo && !dirty && createPortal(
        <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 900, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, background: darkMode ? "rgba(20,16,22,0.95)" : "rgba(255,255,255,0.97)", border: `1px solid ${line}`, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", color: text }}>
          <span style={{ color: "#34d399" }}>✓</span><div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{undo.label}</div>
          <button type="button" onClick={() => { const u = undo; setUndo(null); u.restore(); }} style={{ background: "none", border: "none", color: A, fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: "pointer", padding: 6 }}>{en ? "Undo" : "Desfazer"}</button>
        </div>, document.body)}

      {/* Folha: Banner */}
      {sheet === "banner" && (
        renderSheet("Banner", <>
          {d.url ? (
            <div style={{ position: "relative", height: 116, borderRadius: 16, overflow: "hidden" }}>
              <img src={d.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: busy === "banner" ? "blur(6px)" : "none", transition: "filter .3s" }} />
              <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 8 }}>
                <button type="button" onClick={() => fileRef.current?.click()} style={{ padding: "8px 13px", borderRadius: 11, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{en ? "Change" : "Trocar"}</button>
                <button type="button" onClick={() => set({ url: "" })} style={{ padding: "8px 13px", borderRadius: 11, border: "none", background: "rgba(0,0,0,0.65)", color: "#f87171", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{en ? "Remove" : "Remover"}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} style={{ width: "100%", height: 116, borderRadius: 16, border: `1.5px dashed ${muted}`, background: "transparent", color: muted, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{en ? "+ Choose an image" : "+ Escolher imagem"}</button>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: "rgba(52,211,153,0.1)", border: "1px solid #34d39944" }}>
            <span style={{ color: "#34d399", fontSize: 16 }}>✦</span>
            <div style={{ fontSize: 13, lineHeight: 1.4, color: darkMode ? "#cfe9dd" : "#14532d" }}>{en ? "Colour and background adjust to the banner by themselves." : "A cor e o fundo ajustam-se sozinhos ao banner. Não tens de fazer mais nada."}</div>
          </div>
          {d.url && (
            <label style={{ display: "block", marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700 }}><span>{en ? "Darken" : "Escurecer"}</span><span style={{ color: A }}>{d.style.d}%</span></div>
              <input type="range" min={0} max={100} value={d.style.d} onChange={(e) => setStyle({ d: Number(e.target.value) })} style={{ width: "100%", accentColor: A, marginTop: 8 }} />
            </label>
          )}
        </>)
      )}

      {/* Folha: Cor */}
      {sheet === "color" && (
        renderSheet(en ? "Accent colour" : "Cor de destaque", <>
          {d.url && bannerAcc && (<>
            <div style={lbl}>{en ? "From your banner" : "Do teu banner"}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {circle(bannerAcc, follow, () => setStyle({ a: 1 }), "auto")}
              <span style={{ fontSize: 12.5, color: muted }}>{en ? "Follows the banner" : "Acompanha o banner"}</span>
            </div>
          </>)}
          <div style={lbl}>{en ? "Suggested" : "Sugeridas"}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {PICKER_SUGGESTIONS.map((c) => circle(`#${c}`, !follow && d.accent.toLowerCase() === `#${c}`, () => pickAccent(c)))}
          </div>
          <button type="button" onClick={() => setSheet("picker")} style={{ width: "100%", height: 46, marginTop: 16, borderRadius: 14, border: `1.5px dashed ${muted}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ {en ? "Another colour" : "Outra cor"}</button>
          <div style={{ marginTop: 10, fontSize: 12, color: muted, lineHeight: 1.45 }}>{en ? "The profile and the background tone change live while you choose." : "O perfil e o tom do fundo mudam ao vivo enquanto escolhes."}</div>
        </>)
      )}
      {sheet === "picker" && (
        renderSheet(en ? "Another colour" : "Outra cor", <>
          <ColorPicker value={(follow ? effAccent : d.accent).replace("#", "")} onChange={pickAccent} suggestions={PICKER_SUGGESTIONS} lang={lang} />
        </>)
      )}

      {/* Folha: Os meus temas */}
      {sheet === "themes" && (
        renderSheet(en ? "My themes" : "Os meus temas", <>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={themeName} onChange={(e) => setThemeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCurrentTheme()} placeholder={en ? "Theme name" : "Nome do tema"} style={{ flex: 1, minWidth: 0, height: 44, padding: "0 14px", borderRadius: 12, border: `1px solid ${line}`, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)", color: text, fontFamily: "inherit", fontSize: 15 }} />
            <button type="button" onClick={saveCurrentTheme} disabled={!themeName.trim()} style={{ padding: "0 16px", borderRadius: 12, border: "none", background: A, color: onAccentColor(A), fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: themeName.trim() ? 1 : 0.4 }}>{en ? "Save" : "Guardar"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: muted, margin: "6px 0 4px" }}>{en ? "Saves colour, background, transparency and wallpaper as they are in the draft." : "Guarda cor, fundo, transparência e wallpaper como estão agora no rascunho."}</div>
          {themes.map((t) => (
            <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, marginTop: 8, border: `1px solid ${line}` }}>
              <i style={{ width: 28, height: 28, borderRadius: 9, background: t.bgColor || "#111", boxShadow: `inset 0 0 0 5px ${t.bgColor || "#111"}, inset 0 0 0 20px ${t.accent}`, flexShrink: 0 }} />
              <button type="button" onClick={() => { applySaved(t); setSheet(null); }} style={{ flex: 1, textAlign: "left", background: "none", border: "none", color: text, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: 0 }}>{t.name}</button>
              <button type="button" aria-label={en ? "Delete" : "Apagar"} onClick={() => delTheme(t)} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", color: muted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </>)
      )}

      {crop && (
        <Suspense fallback={null}><CropModal imageSrc={crop.src} aspectRatio={crop.type === "banner" ? 2 : 1} outputWidth={crop.type === "banner" ? 1600 : undefined}
          title={crop.type === "banner" ? (en ? "Crop banner" : "Recortar banner") : (en ? "Crop photo" : "Recortar foto")}
          onSave={onCrop} onClose={() => setCrop(null)} /></Suspense>
      )}
    </ThemeContext.Provider>
  );
}
