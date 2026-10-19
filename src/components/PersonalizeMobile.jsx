import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ThemeContext, useTheme } from "../contexts/ThemeContext";
import { supa } from "../config/supabase";
import { compressImage } from "../lib/utils";
import { persistImage } from "../lib/imageStore";
import { STYLE_PRESETS } from "./AppearanceSettings";
import { CropModal } from "./CropModal";
import { ColorPicker, PICKER_SUGGESTIONS } from "./ColorPicker";
import { BannerHero } from "./BannerHero";
import { splitBanner, joinBanner, useBannerPalette, bannerAccentHex, DEFAULT_BANNER_STYLE, rgbToHsl, hslToHex } from "../lib/bannerColors";
import { hexRgb } from "../lib/contrast";

// ─── Personalizar (telemóvel): um só ecrã, quatro coisas ───
// Banner · Foto · Cor · Fundo, mais temas prontos. Tudo é rascunho (vês ao vivo em cima) até carregares em Guardar.
const SUGGESTED_BG = ["#0a0c10", "#120a0c", "#0a0d12", "#08141c", "#0a130f", "#14090f", "#1a1410", "#f3f4f8"];

export function PersonalizeMobile({
  profile, currentUserId, onUpdateProfile, lang, savedThemes,
  accent, bgColor, bgColorMobile, bgSeparateDevices, bgImage, bgImageMobile, panelBg, panelOpacity,
  onAccentChange, onBgChange, onBgColorMobile, onBgImage, onBgImageMobile, onPanelBg, onPanelOpacity, onBgSeparateDevices,
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
    url: saved.url, style: saved.style, accent, bgMode: saved.url && saved.style.g !== 0 ? "auto" : (curImg ? "image" : "color"),
    bgColor: curBg, bgImage: curImg || "", panel: panelBg, opacity: panelOpacity,
  }), [profile.banner, accent, curBg, curImg, panelBg, panelOpacity]); // eslint-disable-line
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
  const followChanged = d.style.a !== initial.style.a, urlChanged = d.url !== initial.url;
  // a cor do banner só entra quando o banner (ou a opção "acompanha") muda; senão mantém-se a cor da app
  const effAccent = follow && d.url && bannerAcc && (urlChanged || followChanged) ? bannerAcc : d.accent;
  const pick4 = (x) => JSON.stringify({ u: x.url, s: x.style, m: x.bgMode, c: x.bgColor, i: x.bgImage, p: x.panel, o: x.opacity });
  const dirty = pick4(d) !== pick4(initial) || effAccent !== accent;
  // Cores de fundo: neutras + tons escuros da cor de destaque atual + usadas recentemente. Escolher qualquer uma passa logo a "Uma cor".
  const [recentBg, setRecentBg] = useState(() => { try { return JSON.parse(localStorage.getItem("ta_recent_bg") || "[]"); } catch { return []; } });
  const accentTints = useMemo(() => { const [h, s0] = rgbToHsl(...(hexRgb(effAccent) || [90, 90, 90])); return [0.07, 0.11, 0.16].map((l) => `#${hslToHex(h, Math.min(0.5, s0 * 0.7), l)}`); }, [effAccent]);
  const bgSwatches = [...new Set([...recentBg, ...accentTints, ...SUGGESTED_BG].map((c) => c.toLowerCase()))];
  const pickBg = (c) => {
    set({ bgColor: c, bgMode: "color" });
    try { const n = [c, ...recentBg.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 6); setRecentBg(n); localStorage.setItem("ta_recent_bg", JSON.stringify(n)); } catch {}
  };
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const setStyle = (patch) => setD((p) => ({ ...p, style: { ...p.style, ...patch } }));

  const flash = (label, restore) => { setUndo({ label, restore }); setTimeout(() => setUndo((u) => (u && u.label === label ? null : u)), 7000); };

  // ── enviar imagens (banner / foto) ──
  const pick = (type) => (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCrop({ src: URL.createObjectURL(f), type }); };
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
  const applyPreset = (p) => setD((x) => ({ ...x, accent: p.accent, bgColor: p.bg, panel: p.panel, opacity: p.opacity, bgMode: "color", bgImage: "", style: { ...x.style, a: 0, g: 0 } }));
  const themeOn = (p) => effAccent === p.accent && d.bgColor === p.bg && d.bgMode === "color";

  // ── guardar / cancelar ──
  const commit = async () => {
    const before = { ...initial, accent };
    const bannerStr = joinBanner(d.url, { ...d.style, g: d.bgMode === "auto" ? 1 : 0 });
    if (bannerStr !== (profile.banner || "")) await onUpdateProfile({ ...profile, banner: bannerStr, hideBannerMobile: d.url ? false : profile.hideBannerMobile });
    if (effAccent !== accent) onAccentChange(effAccent);
    if (d.bgMode === "color") { bgSeparateDevices ? onBgColorMobile(d.bgColor) : onBgChange(d.bgColor); bgSeparateDevices ? onBgImageMobile("") : onBgImage(""); }
    if (d.bgMode === "image") { bgSeparateDevices ? onBgImageMobile(d.bgImage) : onBgImage(d.bgImage); }
    if (d.panel !== panelBg) onPanelBg(d.panel);
    if (d.opacity !== panelOpacity) onPanelOpacity(d.opacity);
    flash(en ? "Changes saved" : "Alterações guardadas", async () => {
      await onUpdateProfile({ ...profile, banner: profile.banner || "" });
      onAccentChange(before.accent);
      bgSeparateDevices ? onBgColorMobile(before.bgColor) : onBgChange(before.bgColor);
      bgSeparateDevices ? onBgImageMobile(before.bgImage) : onBgImage(before.bgImage);
      onPanelBg(before.panel); onPanelOpacity(before.opacity);
    });
  };

  const prevTheme = { ...theme, accent: effAccent };
  const A = effAccent;
  const Tile = ({ title, sub, onClick, children }) => (
    <button type="button" onClick={onClick} style={{ textAlign: "left", fontFamily: "inherit", color: text, cursor: "pointer", borderRadius: 18, padding: 14, minHeight: 96, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, background: darkMode ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.04)", border: `1px solid ${line}` }}>
      <div style={{ height: 36, display: "flex", alignItems: "center" }}>{children}</div>
      <div><div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 11.5, color: muted, marginTop: 1 }}>{sub}</div></div>
    </button>
  );
  const renderSheet = (title, children) => createPortal(
    <div onClick={() => setSheet(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "86vh", overflowY: "auto", boxSizing: "border-box", borderRadius: "28px 28px 0 0", background: sheetBg, borderTop: `1px solid ${line}`, padding: "12px 18px calc(22px + env(safe-area-inset-bottom))", color: text }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: darkMode ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.2)", margin: "0 auto 14px" }} />
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 12 }}>{title}</div>
        {children}
        <button type="button" onClick={() => setSheet(null)} style={{ width: "100%", height: 46, marginTop: 16, borderRadius: 14, border: "none", background: A, color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>{en ? "Done" : "Concluído"}</button>
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

        {/* Temas */}
        <div style={lbl}>{en ? "Themes" : "Temas"}</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "2px 16px" }}>
          {STYLE_PRESETS.map((p) => {
            const on = themeOn(p);
            return (
              <button key={p.id} type="button" onClick={() => applyPreset(p)} style={{ flex: "none", width: 92, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: text }}>
                <div style={{ height: 70, borderRadius: 14, background: p.bg, border: `2px solid ${on ? p.accent : line}`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 10, right: 10, top: 12, height: 8, borderRadius: 4, background: p.accent }} />
                  <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, height: 26, borderRadius: 8, background: p.panel, border: `1px solid ${line}` }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: on ? 800 : 600, marginTop: 6, textAlign: "center", color: on ? text : muted }}>{p.name}</div>
              </button>
            );
          })}
          {(savedThemes?.themes || []).map((t) => (
            <button key={t.name} type="button" onClick={() => setD((x) => ({ ...x, accent: t.accent || x.accent, bgColor: t.bgColor || x.bgColor, panel: t.panelBg ?? x.panel, opacity: t.panelOpacity ?? x.opacity, bgMode: "color", style: { ...x.style, a: 0, g: 0 } }))} style={{ flex: "none", width: 92, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: text }}>
              <div style={{ height: 70, borderRadius: 14, background: t.bgColor || "#111", border: `2px solid ${line}`, position: "relative" }}><div style={{ position: "absolute", left: 10, right: 10, top: 12, height: 8, borderRadius: 4, background: t.accent }} /></div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, textAlign: "center", color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
            </button>
          ))}
        </div>

        {/* Quatro blocos */}
        <div style={lbl}>{en ? "Your profile" : "O teu perfil"}</div>
        <input type="file" accept="image/*" ref={fileRef} onChange={pick("banner")} style={{ display: "none" }} />
        <input type="file" accept="image/*" ref={avatarRef} onChange={pick("avatar")} style={{ display: "none" }} />
        <input type="file" accept="image/*" ref={bgFileRef} onChange={onBgFile} style={{ display: "none" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Tile title="Banner" sub={en ? "Top image" : "Imagem do topo"} onClick={() => setSheet("banner")}>
            {d.url ? <div style={{ width: 64, height: 36, borderRadius: 9, overflow: "hidden" }}><img src={d.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div> : <div style={{ width: 64, height: 36, borderRadius: 9, border: `1.5px dashed ${muted}`, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 18 }}>+</div>}
          </Tile>
          <Tile title={en ? "Photo" : "Foto"} sub={en ? "Your profile photo" : "A tua foto de perfil"} onClick={() => avatarRef.current?.click()}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${A}, #222)`, boxShadow: `0 0 0 2px ${A}` }}>{profile.avatar && <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
          </Tile>
          <Tile title={en ? "Colour" : "Cor"} sub={en ? "App accent" : "Destaque da app"} onClick={() => setSheet("color")}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: A, boxShadow: `0 0 0 3px ${A}44` }} />
          </Tile>
          <Tile title={en ? "Background" : "Fundo"} sub={d.bgMode === "auto" ? (en ? "Follows the banner" : "Segue o banner") : d.bgMode === "color" ? (en ? "Solid colour" : "Cor lisa") : (en ? "Your image" : "A tua imagem")} onClick={() => setSheet("bg")}>
            {d.bgMode === "auto" ? <div style={{ padding: "5px 10px", borderRadius: 99, background: "rgba(52,211,153,0.14)", color: "#34d399", fontSize: 11.5, fontWeight: 800, border: "1px solid #34d39955" }}>✦ {en ? "Auto" : "Automático"}</div>
              : <div style={{ width: 36, height: 36, borderRadius: 10, background: d.bgMode === "image" && d.bgImage ? `center/cover url(${d.bgImage})` : d.bgColor, border: `1px solid ${line}` }} />}
          </Tile>
        </div>
      </div>

      {/* Guardar / Cancelar (só quando há alterações) */}
      {dirty && createPortal(
        <div style={{ position: "fixed", left: 16, right: 16, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 900, display: "flex", gap: 10, padding: 10, borderRadius: 18, background: darkMode ? "rgba(20,16,22,0.94)" : "rgba(255,255,255,0.96)", border: `1px solid ${line}`, backdropFilter: "blur(10px)", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
          <button type="button" onClick={() => setD(initial)} style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${line}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
          <button type="button" onClick={commit} disabled={!!busy} style={{ flex: 1.5, height: 44, borderRadius: 12, border: "none", background: A, color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{en ? "Save" : "Guardar"}</button>
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
            {PICKER_SUGGESTIONS.map((c) => circle(`#${c}`, !follow && d.accent.toLowerCase() === `#${c}`, () => { setStyle({ a: 0 }); set({ accent: `#${c}` }); }))}
          </div>
          <button type="button" onClick={() => setSheet("picker")} style={{ width: "100%", height: 46, marginTop: 16, borderRadius: 14, border: `1.5px dashed ${muted}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ {en ? "Another colour" : "Outra cor"}</button>
          <div style={{ marginTop: 10, fontSize: 12, color: muted, lineHeight: 1.45 }}>{en ? "The profile above changes live while you choose." : "O perfil em cima muda ao vivo enquanto escolhes."}</div>
        </>)
      )}
      {sheet === "picker" && (
        renderSheet(en ? "Another colour" : "Outra cor", <>
          <ColorPicker value={(follow ? effAccent : d.accent).replace("#", "")} onChange={(hex) => { setStyle({ a: 0 }); set({ accent: `#${hex}` }); }} suggestions={PICKER_SUGGESTIONS} lang={lang} />
        </>)
      )}

      {/* Folha: Fundo */}
      {sheet === "bg" && (
        renderSheet(en ? "Background" : "Fundo", <>
          {[
            { id: "auto", t: en ? "Automatic" : "Automático", s: en ? "Uses your banner colour" : "Usa a cor do teu banner", disabled: !d.url },
            { id: "color", t: en ? "A colour" : "Uma cor", s: en ? "Pick a plain colour" : "Escolhes uma cor lisa" },
            { id: "image", t: en ? "Image" : "Imagem", s: en ? "A wallpaper of your own" : "Um wallpaper teu" },
          ].map((o) => {
            const on = d.bgMode === o.id;
            return (
              <button key={o.id} type="button" disabled={o.disabled} onClick={() => { if (o.id === "image" && !d.bgImage) bgFileRef.current?.click(); else set({ bgMode: o.id }); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 16, marginBottom: 8, textAlign: "left", fontFamily: "inherit", color: text, cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? 0.45 : 1, background: darkMode ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.04)", border: `1.5px solid ${on ? A : line}` }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 800 }}>{o.t}</div><div style={{ fontSize: 11.5, color: muted }}>{o.disabled ? (en ? "Add a banner first" : "Adiciona primeiro um banner") : o.s}</div></div>
                <i style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${on ? A : muted}`, background: on ? A : "transparent", flexShrink: 0 }} />
              </button>
            );
          })}
          {d.bgMode === "color" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              {bgSwatches.map((c) => circle(c, (d.bgColor || "").toLowerCase() === c.toLowerCase(), () => pickBg(c)))}
              <label style={{ width: 44, height: 44, borderRadius: "50%", border: `2px dashed ${muted}`, display: "flex", alignItems: "center", justifyContent: "center", color: muted, position: "relative", cursor: "pointer" }}>+<input type="color" value={d.bgColor} onChange={(e) => pickBg(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} /></label>
            </div>
          )}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
              <span>{en ? "Panel transparency" : "Transparência dos painéis"}</span><span style={{ color: muted }}>{Math.round(100 - d.opacity)}%</span>
            </div>
            <input type="range" min={35} max={100} step={1} value={d.opacity} onChange={(e) => set({ opacity: parseInt(e.target.value, 10) })} style={{ width: "100%", accentColor: A }} aria-label={en ? "Panel transparency" : "Transparência dos painéis"} />
            <div style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>{en ? "Text colour adjusts automatically." : "A cor do texto ajusta-se automaticamente."}</div>
          </div>
          {onBgSeparateDevices && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${line}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{en ? "Apply background to" : "Aplicar o fundo a"}</div>
              <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 14, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)" }}>
                {[[false, en ? "PC and phone" : "PC e telemóvel"], [true, en ? "Only this device" : "Só este dispositivo"]].map(([v, l]) => (
                  <button key={String(v)} type="button" onClick={() => onBgSeparateDevices(v)} style={{ flex: 1, height: 38, borderRadius: 10, border: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", background: !!bgSeparateDevices === v ? A : "transparent", color: !!bgSeparateDevices === v ? "#fff" : text, transition: "background .25s" }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: muted, marginTop: 6 }}>{en ? "Accent, name, photo and banner are always shared." : "Cor de destaque, nome, foto e banner são sempre partilhados."}</div>
            </div>
          )}
          {d.bgMode === "image" && d.bgImage && <button type="button" onClick={() => bgFileRef.current?.click()} style={{ marginTop: 10, background: "none", border: "none", color: A, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>{en ? "Change image" : "Trocar imagem"}</button>}
        </>)
      )}

      {crop && (
        <CropModal imageSrc={crop.src} aspectRatio={crop.type === "banner" ? 2 : 1} outputWidth={crop.type === "banner" ? 1600 : undefined}
          title={crop.type === "banner" ? (en ? "Crop banner" : "Recortar banner") : (en ? "Crop photo" : "Recortar foto")}
          onSave={onCrop} onClose={() => setCrop(null)} />
      )}
    </ThemeContext.Provider>
  );
}
