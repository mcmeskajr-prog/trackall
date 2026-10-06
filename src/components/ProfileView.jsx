import { useState, useRef, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa, supabase } from "../config/supabase";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor, compressImage } from "../lib/utils";
import { MEDIA_TYPES, STATUS_OPTIONS, mediaLabel, statusLabel } from "../config/constants";
import { accentShade } from "../config/theme";
import { TiltCard } from "./TiltCard";
import { CropModal } from "./CropModal";
import { CollectionCard } from "./CollectionCard";
import { TierListCard } from "./TierListCard";
import { RecentSection } from "./RecentSection";
import { ProfileTabCompletos } from "./ProfileTabCompletos";
import { ProfileTabDiario } from "./ProfileTabDiario";
import { MihonImportModal } from "./MihonImportModal";
import { PaperbackImportModal } from "./PaperbackImportModal";
import { LetterboxdImportModal } from "./LetterboxdImportModal";

export function ProfileView({ profile, library, accent, bgColor, bgColorMobile, bgImage, bgImageMobile, bgSeparateDevices, onBgSeparateDevices, onBgImageMobile, onBgColorMobile, isMobileDevice, bgOverlay, bgBlur, bgParallax, darkMode, panelBg, panelOpacity, textContrast, textContrastMobile, sidebarColor, onUpdateProfile, onAccentChange, onBgChange, onBgImage, onBgOverlay, onBgBlur, onBgParallax, onPanelBg, onPanelOpacity, onTextContrast, onTextContrastMobile, onSidebarColor, onSavedThemes, onTmdbKey, tmdbKey, workerUrl, onWorkerUrl, onSignOut, userEmail, favorites = [], onToggleFavorite, hallOfFame = [], onToggleHallOfFame, onImportMihon, onImportPaperback, onImportLetterboxd, onOpen, diaryPanel = null, lang = "en", useT = (k) => k, onChangeLang, userTierlists = [], userLikes = [], currentUserId = null, onCreateTierlist, onViewTierlist, onLikeTierlist, onDeleteTierlist, userCollections = [], userCollectionLikes = [], onCreateCollection, onViewCollection, onLikeCollection, onDeleteCollection }) {
  const [editing, setEditing] = useState(false);
  const [profileTab, setProfileTab] = useState("perfil");
  const [showMihon, setShowMihon] = useState(false);
  const [showPaperback, setShowPaperback] = useState(false);
  const [showLetterboxd, setShowLetterboxd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [hideEmail, setHideEmail] = useState(profile.hideEmail || false);
  const [hideBannerMobile, setHideBannerMobile] = useState(profile.hideBannerMobile || false);
  const [shareCopied, setShareCopied] = useState(false);
  const [themeName, setThemeName] = useState("");

  // Calcula o background dos painéis com cor + opacidade
  const computedPanelBg = (() => {
    const base = panelBg || (darkMode ? "#161b22" : "rgba(255,255,255,0.7)");
    const op = (panelOpacity ?? 100) / 100;
    if (op >= 1 && !panelBg) return base; // sem customização, usa default
    if (!panelBg) return base;
    // Converter hex para rgba com opacidade
    try {
      const hex = panelBg.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16);
        const g = parseInt(hex.slice(2,4),16);
        const b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b},${op})`;
      }
    } catch {}
    return base;
  })();
  const [appearSections, setAppearSections] = useState({ cores: true, texto: false, fundo: false, sidebar: false, dispositivos: false, stats: false });
  const toggleAppear = (key) => setAppearSections(p => ({ ...p, [key]: !p[key] }));
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || "");
  const [bannerPreview, setBannerPreview] = useState(profile.banner || "");
  const [bannerUrl, setBannerUrl] = useState(profile.banner || "");
  const [cropSrc, setCropSrc] = useState(null);
  const [cropType, setCropType] = useState(null); // "avatar" | "banner"
  const avatarRef = useRef();
  const bannerRef = useRef();
  const items = useMemo(() => Object.values(library), [library]);
  const byType = useMemo(() => {
    const r = {};
    MEDIA_TYPES.slice(1).forEach((t) => { r[t.id] = items.filter((i) => i.type === t.id && i.userStatus === 'completo').length; });
    return r;
  }, [items]);
  const byStatus = useMemo(() => {
    const r = {};
    STATUS_OPTIONS.forEach((s) => { r[s.id] = items.filter((i) => i.userStatus === s.id).length; });
    return r;
  }, [items]);
  const totalRatings = useMemo(() => items.filter((i) => i.userRating > 0), [items]);
  const avgRating = totalRatings.length ? (totalRatings.reduce((a, i) => a + i.userRating, 0) / totalRatings.length).toFixed(1) : "—";
  const handleAvatarFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropType("avatar");
  };

  const handleBannerFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropType("banner");
  };

  const [uploadingImage, setUploadingImage] = useState(null); // "avatar" | "banner" | null
  const [uploadError, setUploadError] = useState("");
  const handleCropSave = async (dataUrl) => {
    const type = cropType;
    setCropSrc(null); setCropType(null);
    setUploadError("");
    // Pré-visualização imediata (local) enquanto o upload real acontece
    if (type === "avatar") setAvatarPreview(dataUrl);
    if (type === "banner") { setBannerPreview(dataUrl); setBannerUrl(dataUrl); }
    if (!currentUserId) return;
    setUploadingImage(type);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const url = await supa.uploadImage(currentUserId, blob, `${type}-${Date.now()}.jpg`);
      if (type === "avatar") setAvatarPreview(url);
      if (type === "banner") { setBannerPreview(url); setBannerUrl(url); }
    } catch (e) {
      console.error("Upload falhou:", e);
      setUploadError(lang === "en" ? "Image upload failed — try a smaller image or a direct link instead" : "O envio da imagem falhou — tenta uma imagem mais pequena ou um link direto");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    await onUpdateProfile({ ...profile, name, bio, avatar: avatarPreview, banner: bannerUrl, hideEmail, hideBannerMobile });
    setEditing(false);
  };

  const currentBanner = editing ? bannerPreview : profile.banner;
  const currentAvatar = editing ? avatarPreview : profile.avatar;

  return (
    <>
    <div style={{ paddingBottom: 32, maxWidth: isMobileDevice ? 600 : "100%", margin: "0 auto" }}>

      {/* ── Banner + Avatar header ── */}
      <div style={{ position: "relative", marginBottom: 64 }}>
        {/* Banner — escondido no mobile se hideBannerMobile */}
        {(!isMobileDevice || !profile.hideBannerMobile) && (
        <div style={{
          height: 260, overflow: "hidden", position: "relative",
          borderRadius: "20px 20px 0 0",
          background: currentBanner
            ? `url(${currentBanner}) center/cover no-repeat`
            : darkMode ? "#0d1117" : "#f1f5f9",
        }}>
          {/* Multi-layer gradient overlay for impact */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, transparent 65%, rgba(0,0,0,0.45) 100%)" }} />
          {/* Banner fallback — hexágonos + partículas animadas */}
          {!currentBanner && (
            <>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="hex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
                    <polygon points="28,4 52,16 52,32 28,44 4,32 4,16" fill="none" stroke={accent} strokeWidth="1">
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite"/>
                    </polygon>
                    <polygon points="28,4 52,16 52,32 28,44 4,32 4,16" fill={accent} fillOpacity="0.04">
                      <animate attributeName="fill-opacity" values="0.02;0.08;0.02" dur="3s" repeatCount="indefinite"/>
                    </polygon>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hex)"/>
                {/* Partículas flutuantes */}
                {[
                  { cx: "15%", cy: "30%", r: 2, dur: "4s" },
                  { cx: "35%", cy: "60%", r: 1.5, dur: "5s" },
                  { cx: "55%", cy: "25%", r: 2.5, dur: "3.5s" },
                  { cx: "70%", cy: "70%", r: 1.5, dur: "6s" },
                  { cx: "85%", cy: "40%", r: 2, dur: "4.5s" },
                  { cx: "25%", cy: "80%", r: 1, dur: "5.5s" },
                  { cx: "90%", cy: "20%", r: 1.5, dur: "4s" },
                ].map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={accent} opacity="0.6">
                    <animate attributeName="cy" values={`${p.cy};calc(${p.cy} - 8%);${p.cy}`} dur={p.dur} repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.2;0.8;0.2" dur={p.dur} repeatCount="indefinite"/>
                  </circle>
                ))}
              </svg>
              {/* Gradiente respirante */}
              <div style={{ position: "absolute", inset: 0 }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${accent}30 0%, transparent 65%)`, animation: "breathe 4s ease-in-out infinite" }} />
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 70% 50%, ${accentShade(accent, 60)}20 0%, transparent 55%)`, animation: "breathe 4s ease-in-out infinite 2s" }} />
              </div>
              <style>{`@keyframes breathe { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
            </>
          )}
          {editing && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}>
              <input type="file" accept="image/*" ref={bannerRef} onChange={handleBannerFile} style={{ display: "none" }} />
              <button onClick={() => bannerRef.current?.click()} disabled={uploadingImage === "banner"} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(0,0,0,0.5)", color: "white", cursor: uploadingImage === "banner" ? "default" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, backdropFilter: "blur(4px)", opacity: uploadingImage === "banner" ? 0.6 : 1,
              }}>{uploadingImage === "banner" ? (lang === "en" ? "⏳ Uploading..." : "⏳ A enviar...") : "🖼 Alterar Banner"}</button>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{lang === "en" ? "Recommended: 1200×400px · Mobile: 390×160px" : "Recomendado: 1200×400px · Telemóvel: 390×160px"}</p>
              {uploadError && <p style={{ fontSize: 11, color: "#ff8a8a", textAlign: "center", maxWidth: 260 }}>{uploadError}</p>}
              <input
                placeholder="ou cola URL do banner..."
                value={bannerUrl.startsWith("data:") ? "" : bannerUrl}
                onChange={(e) => { setBannerUrl(e.target.value); setBannerPreview(e.target.value); }}
                style={{ padding: "7px 12px", fontSize: 12, width: "70%", maxWidth: 300, borderRadius: 8 }}
              />
              {bannerUrl && (
                <button onClick={() => { setBannerUrl(""); setBannerPreview(""); }} style={{
                  padding: "4px 10px", borderRadius: 6, border: "1px solid #ef444466",
                  background: "rgba(239,68,68,0.15)", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 11,
                }}>✕ Remover banner</button>
              )}
            </div>
          )}
        </div>
        )} {/* fim hideBannerMobile */}

        {/* Avatar — overlaps banner */}
        <div style={{ position: "absolute", bottom: -48, left: "50%", transform: "translateX(-50%)" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: 92, height: 92, borderRadius: 999, overflow: "hidden",
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
              border: `3px solid ${bgColor}`,
              boxShadow: `0 0 0 3px ${accent}, 0 0 24px ${accent}66, 0 8px 32px rgba(0,0,0,0.5)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {currentAvatar
                ? <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 38 }}>👤</span>}
            </div>
            {editing && (
              <>
                <input type="file" accept="image/*" ref={avatarRef} onChange={handleAvatarFile} style={{ display: "none" }} />
                <button onClick={() => avatarRef.current?.click()} disabled={uploadingImage === "avatar"} style={{
                  position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 999,
                  background: accent, border: `2px solid ${bgColor}`, cursor: uploadingImage === "avatar" ? "default" : "pointer", fontSize: 12, opacity: uploadingImage === "avatar" ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{uploadingImage === "avatar" ? "⏳" : "🖊"}</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Name / bio / edit */}
      <div style={{ textAlign: "center", padding: "0 16px", marginBottom: 20 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={useT("namePlaceholder")} style={{ padding: "10px 14px", textAlign: "center", fontSize: 16, fontWeight: 700 }} />
            <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder={useT("bioPlaceholder")} style={{ padding: "10px 14px", fontSize: 13 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: darkMode ? "#0d1117" : "#f8fafc", borderRadius: 10, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!hideEmail} onChange={e => setHideEmail(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
              <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>{useT("hideEmail")}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: darkMode ? "#0d1117" : "#f8fafc", borderRadius: 10, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!hideBannerMobile} onChange={e => setHideBannerMobile(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
              <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>{lang === "en" ? "Hide banner on mobile" : "Esconder banner no mobile"}</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-accent" style={{ flex: 1, padding: "10px", opacity: uploadingImage ? 0.6 : 1 }} onClick={handleSave} disabled={!!uploadingImage}>{uploadingImage ? (lang === "en" ? "Uploading image..." : "A enviar imagem...") : useT("saveProfile")}</button>
              <button onClick={() => { setEditing(false); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setAvatarPreview(profile.avatar||""); }} style={{ flex: 1, padding: "10px", background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit" }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, background: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{profile.name || "Utilizador"}</h2>
            {profile.bio && <p style={{ color: "#8b949e", fontSize: 14, marginTop: 4 }}>{profile.bio}</p>}
            {userEmail && !hideEmail && <p style={{ color: "#484f58", fontSize: 12, marginTop: 4 }}>✉ {userEmail}</p>}
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>TrackAll · {items.length} {useT("inLibraryCount")}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, alignItems: "center" }}>
              <button onClick={() => { setName(profile.name||""); setBio(profile.bio||""); setAvatarPreview(profile.avatar||""); setBannerPreview(profile.banner||""); setBannerUrl(profile.banner||""); setEditing(true); }} style={{
                padding: "8px 20px", borderRadius: 8, border: `1px solid ${accent}44`,
                background: `${accent}15`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              }}>✏ Editar Perfil</button>
              {onSignOut && (
                <button onClick={onSignOut} title={useT("signOut")} style={{
                  width: 34, height: 34, borderRadius: 8, border: "1px solid #30363d",
                  background: "transparent", color: "#484f58", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Profile Tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #21262d", scrollbarWidth: "none" }}>
        {["perfil","completos","tierlists","listas","diario"].map(tab => (
          <button key={tab} onClick={() => setProfileTab(tab)} style={{
            flex: 1, padding: isMobileDevice ? "10px 4px" : "12px 20px",
            background: "none", border: "none",
            borderBottom: profileTab === tab ? `2px solid ${accent}` : "2px solid transparent",
            color: profileTab === tab ? accent : "#484f58",
            cursor: "pointer", fontFamily: "inherit",
            fontSize: isMobileDevice ? 11 : 13,
            fontWeight: profileTab === tab ? 700 : 500,
            marginBottom: -1, whiteSpace: "nowrap",
          }}>
            {tab === "perfil" ? useT("tabPerfil") : tab === "completos" ? useT("tabCompletos") : tab === "tierlists" ? useT("tabTierLists") : tab === "listas" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="0" y="0" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="7" y="0" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="0" y="7" width="5" height="5" rx="1" fill="currentColor"/>
                  <rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor"/>
                </svg>
                {lang === "en" ? "Lists" : "Listas"}
              </span>
            ) : useT("tabDiario")}
          </button>
        ))}
      </div>

      {/* Stats and settings — PC: flex row com diário à direita */}
      <div style={{ display: profileTab === "perfil" ? "block" : "none" }}>
      <div style={ !isMobileDevice
        ? { display: "flex", flexDirection: "row", gap: 32, padding: "24px 32px 0 32px", alignItems: "flex-start" }
        : { padding: "16px 16px 0" }
      }><div style={{ flex: 1, minWidth: 0 }}>


      {/* ── Hall of Fame ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 0 0 16px" }}>
          <h3 style={{ fontSize: 12, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0f172a", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8 }}>
            <span>{lang === "en" ? "Hall of Fame" : "Hall of Fame"}</span>
          </h3>
          <span style={{ fontSize: 11, color: darkMode ? "#8b949e" : "#64748b", fontWeight: 700 }}>{hallOfFame.length} {lang === "en" ? "titles" : "obras"}</span>
        </div>

        {hallOfFame.length === 0 ? (
          <div style={{ margin: "0 16px", border: "1px dashed #30363d", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <p style={{ color: "#484f58", fontSize: 13 }}>{lang === "en" ? "Choose up to 5 titles from the item modal." : "Escolhe até 5 obras a partir do modal de cada item."}</p>
          </div>
        ) : (
          <div style={{ margin: "0 16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: isMobileDevice ? 8 : 10 }}>
              {hallOfFame.map((item, idx) => {
                const coverSrc = item.customCover || item.cover;
                const score = findLibraryEntry(library, item.id, item.type)?.item?.userRating ?? item.userRating ?? 0;
                const tone = accentVariant(accent, idx);
                return (
                  <div
                    key={item.id}
                    className="fav-card-wrap"
                    onClick={() => onOpen && onOpen(item)}
                    style={{ cursor: "pointer", width: isMobileDevice ? 108 : 128, flexShrink: 0 }}
                  >
                    <TiltCard maxTilt={9} glare style={{ position: "relative", aspectRatio: "0.72", borderRadius: isMobileDevice ? 8 : 10, overflow: "hidden", background: `linear-gradient(180deg, ${tone}40 0%, ${tone}18 100%)`, boxShadow: darkMode ? "0 8px 18px rgba(0,0,0,0.28)" : "0 8px 18px rgba(15,23,42,0.08)" }}>
                      {coverSrc
                        ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display = "none"} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white" }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon || "★"}</div>}
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleHallOfFame && onToggleHallOfFame(item); }}
                        style={{ position: "absolute", top: 6, left: 6, width: 18, height: 18, borderRadius: 999, border: "none", background: "rgba(10,10,10,0.72)", color: "#f8fafc", cursor: "pointer", display: "none", alignItems: "center", justifyContent: "center", fontSize: 10, padding: 0 }}
                      >
                        ×
                      </button>
                      <div style={{ position: "absolute", top: 6, right: 6, minWidth: 22, height: 22, borderRadius: 999, padding: "0 6px", background: "rgba(10,10,10,0.72)", border: "1px solid rgba(251,191,36,0.30)", color: "#fbbf24", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>
                        {score || "—"}
                      </div>
                    </TiltCard>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Favoritos — Categorias com variações do accent ── */}
      {(() => {
        const favByType = {};
        favorites.forEach(f => {
          if (!favByType[f.type]) favByType[f.type] = [];
          favByType[f.type].push(f);
        });
        const activeTypes = MEDIA_TYPES.slice(1).filter(t => favByType[t.id]?.length > 0);

        return (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 0 0 16px" }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: darkMode ? "#8b949e" : "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("favorites").toUpperCase()}</h3>
              <span style={{ fontSize: 11, color: "#484f58" }}>{favorites.length}</span>
            </div>

            {favorites.length === 0 ? (
              <div style={{ margin: "0 16px", background: computedPanelBg, border: "1px dashed #30363d", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <p style={{ color: "#484f58", fontSize: 13 }}>{lang === "en" ? "Open any item and click ☆ Favorite" : "Abre qualquer item e clica em ☆ Favorito"}</p>
              </div>
            ) : (
              <div style={{ padding: !isMobileDevice ? "0 32px 0 32px" : "0 0 0 16px", display: "flex", flexDirection: "column", gap: 18 }}>
                {activeTypes.map((t, tIdx) => {
                  const tc = accentVariant(accent, tIdx);
                  return (
                    <div key={t.id}>
                      {/* Label categoria */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, textTransform: "uppercase", letterSpacing: "0.14em" }}>{mediaLabel(t, lang)}</span>
                        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${tc}70, transparent)` }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, background: `${tc}18`, padding: "1px 7px", borderRadius: 20 }}>{favByType[t.id].length}</span>
                      </div>
                      {/* Grid adaptativo: scroll row se ≤4 itens, grid 4 col se mais */}
                      {(() => {
                        const count = favByType[t.id].length;
                        // Sempre grid 4 colunas — sem scroll em nenhum dispositivo
                        const useScroll = false;
                        const cardW = 0; // não usado no grid
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(4, 1fr)" : "repeat(auto-fill, minmax(100px, 1fr))", gap: isMobileDevice ? 4 : 10 }}>
                            {favByType[t.id].map(item => {
                              const coverSrc = item.customCover || item.cover;
                              const currentRating = findLibraryEntry(library, item.id, item.type)?.item?.userRating ?? item.userRating ?? 0;
                              return (
                                <div key={item.id} className="recent-card fav-card-wrap" onClick={() => onOpen && onOpen(item)} style={{ position: "relative", cursor: "pointer" }}>
                                  <TiltCard maxTilt={9} glare style={{ width: "100%", aspectRatio: "2/3", borderRadius: isMobileDevice ? 6 : 9, overflow: "hidden", position: "relative", background: gradientFor(item.id), boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                                    {coverSrc
                                      ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display = "none"} />
                                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{t.icon}</div>
                                    }
                                    <div className="recent-hover-overlay no-tc" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)", opacity: 0, transition: "opacity 0.2s", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "40px 10px 10px" }}>
                                      <p style={{ fontSize: 12, color: "white", fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 4 }}>{item.title}</p>
                                      {currentRating > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 800 }}>★ {currentRating}</span>}
                                    </div>
                                  </TiltCard>
                                  <button className="fav-rm" onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(item); }}
                                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#ef4444", color: "white", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s", zIndex: 10 }}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Vistos Recentemente ── */}
      {items.length > 0 && <RecentSection items={items} onOpen={onOpen} showDiary={isMobileDevice} />}

      {/* ── Top Géneros ── */}
      {(() => {
        const completed = items.filter(i => i?.userStatus === "completo");
        const genreCount = {};
        completed.forEach(i => (i.genres||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
        const topGenres = Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
        if (topGenres.length === 0) return null;
        const maxCount = topGenres[0][1];
        return (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
              {lang === "en" ? "TOP GENRES" : "TOP GÉNEROS"}
              <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {topGenres.map(([genre, count], idx) => {
                const intensity = Math.round((count / maxCount) * 100);
                const size = idx === 0 ? 14 : idx < 3 ? 13 : 12;
                const alpha = Math.max(20, intensity);
                return (
                  <div key={genre} style={{ display: "flex", alignItems: "center", gap: 5, background: `${accent}${alpha.toString(16).padStart(2,"0")}`, border: `1px solid ${accent}${Math.round(alpha*1.5).toString(16).padStart(2,"0")}`, borderRadius: 20, padding: idx === 0 ? "5px 12px" : "4px 10px", cursor: "default" }}>
                    <span style={{ fontSize: size, fontWeight: idx < 3 ? 800 : 600, color: idx === 0 ? accent : darkMode ? "#c9d1d9" : "#374151" }}>{genre}</span>
                    <span style={{ fontSize: 10, color: accent, fontWeight: 700, opacity: 0.8 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Stats grid */}
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        ESTATÍSTICAS
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
      </h3>
      {true && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {STATUS_OPTIONS.map((s) => (
              <div key={s.id} style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${s.color}`, borderTop: `1px solid ${s.color}22`, borderRight: `1px solid ${s.color}11`, borderBottom: `1px solid ${s.color}11` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{statusLabel(s, lang)}</div>
              </div>
            ))}
            <div style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: "3px solid #f59e0b", borderTop: "1px solid #f59e0b22", borderRight: "1px solid #f59e0b11", borderBottom: "1px solid #f59e0b11" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{useT("avgRating")}</div>
            </div>
            <div style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${accent}`, borderTop: `1px solid ${accent}22`, borderRight: `1px solid ${accent}11`, borderBottom: `1px solid ${accent}11` }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{items.length}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{useT("totalItems")}</div>
            </div>
            <div style={{ background: computedPanelBg, borderRadius: 12, padding: "14px 10px 14px 14px", textAlign: "left", borderLeft: `3px solid ${accent}99`, borderTop: `1px solid ${accent}22`, borderRight: `1px solid ${accent}11`, borderBottom: `1px solid ${accent}11` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{totalRatings.length}</div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{lang === "en" ? "Rated" : "Avaliados"}</div>
            </div>
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>{lang === "en" ? "COMPLETED BY TYPE" : "COMPLETOS POR TIPO"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            {(() => {
              const totalCompleted = Math.max(1, MEDIA_TYPES.slice(1).reduce((s,t) => s + (byType[t.id]||0), 0));
              return MEDIA_TYPES.slice(1).map((t) => {
              const count = byType[t.id] || 0;
              const total = items.filter(i => i.type === t.id).length;
              const pct = (count / totalCompleted) * 100;
              if (!total) return null;
              return (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{t.icon} {mediaLabel(t, lang)}</span>
                    <span style={{ fontSize: 12, color: "#8b949e" }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: "#21262d", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, borderRadius: 999, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            });})()}
          </div>
        </>
      )}


      {/* Temas */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{useT("appearance")}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>

      {/* ── Temas Guardados ── */}
      {(() => {
        const themes = onSavedThemes?.themes || [];
        const getCurrentTheme = () => ({ accent, bgColor, bgColorMobile, sidebarColor, textContrast, textContrastMobile, bgSeparateDevices, darkMode, panelBg, panelOpacity, bgImage, bgImageMobile, bgOverlay, bgBlur, bgParallax });
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
          // Carregar imagens guardadas separadamente
          try {
            if (t.hasBgImage) { const img = localStorage.getItem(`trackall_theme_img_${t.name}`); onBgImage(img || ""); }
            else onBgImage("");
            // Só restaura imagem mobile se estiver no mobile
            if (isMobileDevice) {
              if (t.hasBgImageMobile) { const img = localStorage.getItem(`trackall_theme_imgm_${t.name}`); onBgImageMobile(img || ""); }
              else onBgImageMobile("");
            }
          } catch {}
        };
        const saveTheme = () => {
          if (!themeName.trim()) return;
          const name = themeName.trim();
          // Guardar imagens separadamente (são grandes)
          try {
            if (bgImage) localStorage.setItem(`trackall_theme_img_${name}`, bgImage);
            if (bgImageMobile) localStorage.setItem(`trackall_theme_imgm_${name}`, bgImageMobile);
          } catch {}
          // Tema sem imagens (ficam no localStorage por chave separada)
          const newTheme = { name, accent, bgColor, bgColorMobile, sidebarColor, textContrast, textContrastMobile, bgSeparateDevices, darkMode, panelBg, panelOpacity, bgOverlay, bgBlur, bgParallax, hasBgImage: !!bgImage, hasBgImageMobile: !!bgImageMobile };
          const updated = [...themes.filter(t => t.name !== name), newTheme];
          onSavedThemes?.save(updated);
          setThemeName("");
        };
        return (
          <div style={{ background: computedPanelBg, border: `1px solid ${accent}33`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: themes.length ? 12 : 6 }}>
              <span style={{ fontSize: 13 }}>🎨</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", flex: 1 }}>{useT("savedThemes")}</span>
              <input value={themeName} onChange={e => setThemeName(e.target.value)} placeholder={useT("themeNamePlaceholder")}
                onKeyDown={e => e.key === "Enter" && saveTheme()}
                style={{ padding: "5px 10px", fontSize: 12, borderRadius: 8, width: 140 }} />
              <button onClick={saveTheme} disabled={!themeName.trim()} style={{ padding: "5px 12px", borderRadius: 8, background: accent, border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: themeName.trim() ? 1 : 0.4 }}>{useT("saveProfile")}</button>
            </div>
            {themes.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {themes.map(t => (
                  <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 4, background: darkMode ? "#21262d" : "#f1f5f9", borderRadius: 20, padding: "4px 4px 4px 10px", border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />
                    <button onClick={() => applyTheme(t)} style={{ background: "none", border: "none", color: darkMode ? "#e6edf3" : "#0d1117", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "0 4px 0 2px" }}>{t.name}</button>
                    <button onClick={() => {
                      try { localStorage.removeItem(`trackall_theme_img_${t.name}`); localStorage.removeItem(`trackall_theme_imgm_${t.name}`); } catch {}
                      onSavedThemes?.save(themes.filter(x => x.name !== t.name));
                    }} style={{ background: "none", border: "none", color: "#484f58", fontSize: 11, cursor: "pointer", padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#484f58" }}>{lang === "en" ? "Save your current setup with a name to switch between later." : "Guarda o teu setup atual com um nome para trocar depois."}</p>
            )}
          </div>
        );
      })()}

      <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>

        {/* Sub-secção: CORES */}
        {[
          { key: "cores", label: useT("colorsSection"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("mode")}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => {
                    const hasBg = bgSeparateDevices && isMobileDevice ? bgImageMobile : bgImage;
                    const doChange = () => {
                      if (bgSeparateDevices && isMobileDevice) onBgColorMobile("#0d1117");
                      else { onBgChange("#0d1117"); if (hasBg) onBgImage(""); }
                    };
                    if (hasBg && !(bgSeparateDevices && isMobileDevice)) { if (window.confirm("Mudar o modo vai remover a imagem de fundo. Continuar?")) doChange(); } else doChange();
                  }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: darkMode ? accent : "#21262d", color: darkMode ? "white" : "#8b949e" }}>{useT("nightMode")}</button>
                  <button onClick={() => {
                    const hasBg = bgSeparateDevices && isMobileDevice ? bgImageMobile : bgImage;
                    const doChange = () => {
                      if (bgSeparateDevices && isMobileDevice) onBgColorMobile("#f1f5f9");
                      else { onBgChange("#f1f5f9"); if (hasBg) onBgImage(""); }
                    };
                    if (hasBg && !(bgSeparateDevices && isMobileDevice)) { if (window.confirm("Mudar o modo vai remover a imagem de fundo. Continuar?")) doChange(); } else doChange();
                  }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: !darkMode ? accent : "#21262d", color: !darkMode ? "white" : "#8b949e" }}>{useT("dayMode")}</button>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("accentColor")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {ACCENT_PRESETS.map((p) => (
                    <button key={p.name} onClick={() => onAccentChange(p.color)} style={{ width: 32, height: 32, borderRadius: 999, background: p.color, border: accent === p.color ? "3px solid white" : "3px solid transparent", cursor: "pointer" }} title={p.name} />
                  ))}
                  <label style={{ width: 32, height: 32, borderRadius: 999, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }}>+<input type="color" defaultValue={accent} onBlur={(e) => onAccentChange(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} /></label>
                </div>
              </div>
            </div>
          )},
          { key: "texto", label: useT("textSection"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{bgSeparateDevices ? "PC" : "Geral"}</p>
                  <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{textContrast}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#484f58" }}>{useT("dark")}</span>
                  <input type="range" min={40} max={160} step={5} value={textContrast} onChange={e => onTextContrast(Number(e.target.value))} style={{ flex: 1, accentColor: accent, height: 4, cursor: "pointer" }} />
                  <span style={{ fontSize: 11, color: "#484f58" }}>{useT("light")}</span>
                </div>
                <button onClick={() => onTextContrast(100)} style={{ marginTop: 6, fontSize: 11, color: "#484f58", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>↺ Repor</button>
              </div>
              {bgSeparateDevices && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>📱 Mobile</p>
                    <span style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700 }}>{textContrastMobile}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#484f58" }}>{useT("dark")}</span>
                    <input type="range" min={40} max={160} step={5} value={textContrastMobile} onChange={e => onTextContrastMobile(Number(e.target.value))} style={{ flex: 1, accentColor: "#06b6d4", height: 4, cursor: "pointer" }} />
                    <span style={{ fontSize: 11, color: "#484f58" }}>{useT("light")}</span>
                  </div>
                  <button onClick={() => onTextContrastMobile(100)} style={{ marginTop: 6, fontSize: 11, color: "#484f58", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>↺ Repor</button>
                </div>
              )}
            </div>
          )},
          { key: "fundo", label: useT("bgSection"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Cor de fundo{bgSeparateDevices ? " 🖥 PC" : ""}</p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {BG_PRESETS.map((p) => (<button key={p.name} onClick={() => { onBgChange(p.value); onBgImage(""); }} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: bgColor === p.value && !bgImage ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer" }} title={p.name} />))}
                  <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative", background: bgColor && !BG_PRESETS.find(p => p.value === bgColor) && !bgImage ? bgColor : "transparent" }}>
                    {bgColor && !BG_PRESETS.find(p => p.value === bgColor) && !bgImage ? "" : "+"}
                    <input type="color" value={bgColor} onChange={(e) => { onBgChange(e.target.value); onBgImage(""); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                  </label>
                </div>
              </div>
              {bgSeparateDevices && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{useT("bgColorMobile")}</p>
                    {bgColorMobile && <button onClick={() => onBgColorMobile("")} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕ igual PC</button>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {BG_PRESETS.map((p) => (<button key={p.name} onClick={() => onBgColorMobile(p.value)} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: bgColorMobile === p.value ? "2px solid #06b6d4" : "2px solid #30363d", cursor: "pointer" }} title={p.name} />))}
                    <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative", background: bgColorMobile && !BG_PRESETS.find(p => p.value === bgColorMobile) ? bgColorMobile : "transparent" }}>
                      {bgColorMobile && !BG_PRESETS.find(p => p.value === bgColorMobile) ? "" : "+"}
                      <input type="color" value={bgColorMobile || bgColor} onChange={(e) => onBgColorMobile(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                    </label>
                  </div>
                </div>
              )}
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("bgImage")}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <label style={{ width: 56, height: 56, borderRadius: 10, border: bgImage ? `2px solid ${accent}` : "2px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: bgImage ? `url(${bgImage}) center/cover` : "#21262d", overflow: "hidden", gap: 2 }}>
                      {!bgImage && <><span>🖥</span><span style={{ fontSize: 9, color: "#484f58" }}>PC</span></>}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; const c = await compressImage(file, 1920, 1080, 0.90); if (c) onBgImage(c); }} />
                    </label>
                    {bgImage && <button onClick={() => onBgImage("")} style={{ fontSize: 10, padding: "2px 8px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
                  </div>
                  {bgSeparateDevices && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <label style={{ width: 56, height: 56, borderRadius: 10, border: bgImageMobile ? "2px solid #06b6d4" : "2px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, background: bgImageMobile ? `url(${bgImageMobile}) center/cover` : "#21262d", overflow: "hidden", gap: 2 }}>
                        {!bgImageMobile && <><span>📱</span><span style={{ fontSize: 9, color: "#484f58" }}>Mobile</span></>}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; const c = await compressImage(file, 1080, 1920, 0.85); if (c) onBgImageMobile(c); }} />
                      </label>
                      {bgImageMobile && <button onClick={() => onBgImageMobile("")} style={{ fontSize: 10, padding: "2px 8px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
                    </div>
                  )}
                </div>
                {(bgImage || bgImageMobile) && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>{useT("overlay")}</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[{ label: "Nenhum", val: "rgba(0,0,0,0)" }, { label: useT("overlaySoft"), val: "rgba(0,0,0,0.3)" }, { label: useT("overlayMid"), val: "rgba(0,0,0,0.55)" }, { label: useT("overlayStrong"), val: "rgba(0,0,0,0.75)" }, { label: useT("overlayWhite"), val: "rgba(255,255,255,0.6)" }].map(o => (
                          <button key={o.label} onClick={() => onBgOverlay(o.val)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${bgOverlay===o.val?accent:"#30363d"}`, background: bgOverlay===o.val?`${accent}22`:"transparent", color: bgOverlay===o.val?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>Desfoque — {bgBlur}px</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[0,2,4,8,12].map(v => (<button key={v} onClick={() => onBgBlur(v)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${bgBlur===v?accent:"#30363d"}`, background: bgBlur===v?`${accent}22`:"transparent", color: bgBlur===v?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{v===0?"Nenhum":`${v}px`}</button>))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>{useT("scroll")}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => onBgParallax(true)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${bgParallax?accent:"#30363d"}`, background: bgParallax?`${accent}22`:"transparent", color: bgParallax?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{useT("parallax")}</button>
                        <button onClick={() => onBgParallax(false)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${!bgParallax?accent:"#30363d"}`, background: !bgParallax?`${accent}22`:"transparent", color: !bgParallax?accent:"#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{useT("staticScroll")}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )},
          { key: "sidebar", label: useT("sidebarSection"), content: (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{useT("sidebarSection")}</p>
                {sidebarColor && <button onClick={() => onSidebarColor("")} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕ igual ao fundo</button>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <button onClick={() => onSidebarColor("")} style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, border: !sidebarColor ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer", fontSize: 9, color: "#8b949e", fontFamily: "inherit" }} title={useT("sameAsBg")}>≡</button>
                {BG_PRESETS.map((p) => (<button key={p.name} onClick={() => onSidebarColor(p.value)} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: sidebarColor===p.value?`2px solid ${accent}`:"2px solid #30363d", cursor: "pointer" }} title={p.name} />))}
                <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative" }}>+<input type="color" defaultValue={sidebarColor||bgColor} onBlur={(e) => onSidebarColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} /></label>
              </div>
            </div>
          )},
          { key: "dispositivos", label: useT("devicesSection"), content: (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{useT("separateDevices")}</p>
                <p style={{ fontSize: 11, color: "#484f58" }}>{lang === "en" ? "Different color, image and contrast per device" : "Cor, imagem e contraste diferentes por dispositivo"}</p>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, flexShrink: 0, cursor: "pointer" }}>
                <input type="checkbox" checked={!!bgSeparateDevices} onChange={e => onBgSeparateDevices(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: "absolute", inset: 0, background: bgSeparateDevices ? accent : "#30363d", borderRadius: 22, transition: "background 0.2s" }} />
                <span style={{ position: "absolute", top: 3, left: bgSeparateDevices ? 21 : 3, width: 16, height: 16, background: "white", borderRadius: "50%", transition: "left 0.2s" }} />
              </label>
              <span style={{ fontSize: 12, color: bgSeparateDevices ? accent : "#484f58", fontWeight: bgSeparateDevices ? 700 : 400, flexShrink: 0 }}>{bgSeparateDevices ? "🖥≠📱" : "🖥=📱"}</span>
            </div>
          )},
          { key: "stats", label: useT("statsCards"), content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{useT("statsCardsColor")}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => { onPanelBg(""); onPanelOpacity(100); }} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: !panelBg ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer", fontSize: 10, color: "#8b949e", fontFamily: "inherit" }}>Auto</button>
                  {["#161b22","#1e293b","#0f172a","#1c1c1e","#0d1117","#ffffff","#f1f5f9","#f6f8fa"].map(c => (
                    <button key={c} onClick={() => onPanelBg(c)} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: panelBg===c ? `2px solid ${accent}` : "2px solid #30363d", cursor: "pointer" }} title={c} />
                  ))}
                  <label style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, position: "relative", background: panelBg && !["#161b22","#1e293b","#0f172a","#1c1c1e","#0d1117","#ffffff","#f1f5f9","#f6f8fa"].includes(panelBg) ? panelBg : "transparent" }}>
                    {panelBg && !["#161b22","#1e293b","#0f172a","#1c1c1e","#0d1117","#ffffff","#f1f5f9","#f6f8fa"].includes(panelBg) ? "" : "+"}
                    <input type="color" value={panelBg || "#161b22"} onChange={(e) => onPanelBg(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                  </label>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{useT("panelOpacity")}</p>
                  <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{panelOpacity ?? 100}%</span>
                </div>
                <input type="range" min={0} max={100} value={panelOpacity ?? 100}
                  onChange={e => onPanelOpacity(Number(e.target.value))}
                  style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#484f58", marginTop: 2 }}>
                  <span>Transparente</span><span>Sólido</span>
                </div>
              </div>
            </div>
          )},
        ].map(({ key, label, content }) => (
          <div key={key} style={{ borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
            <button onClick={() => toggleAppear(key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: appearSections[key] ? accent : (darkMode ? "#c9d1d9" : "#374151") }}>{label}</span>
              <span style={{ fontSize: 12, color: "#484f58", transform: appearSections[key] ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
            </button>
            {appearSections[key] && <div style={{ padding: "0 16px 16px" }}>{content}</div>}
          </div>
        ))}

      </div>

      {/* Mihon Modal */}
      {showMihon && (
        <MihonImportModal
         
         
          onClose={() => setShowMihon(false)}
          onImport={(items) => { onImportMihon && onImportMihon(items); setShowMihon(false); }}
        />
      )}

      {/* Modais Paperback e Letterboxd */}
      {showPaperback && (
        <PaperbackImportModal
         
          onClose={() => setShowPaperback(false)}
          onImport={(items) => { onImportPaperback && onImportPaperback(items); setShowPaperback(false); }}
        />
      )}
      {showLetterboxd && (
        <LetterboxdImportModal
         
          onClose={() => setShowLetterboxd(false)}
          onImport={(items) => { onImportLetterboxd && onImportLetterboxd(items); setShowLetterboxd(false); }}
        />
      )}

      {/* ── Import ── */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{lang === "en" ? "IMPORT" : "IMPORTAR"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📚</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Mihon</p>
            <p style={{ fontSize: 12, color: "#8b949e" }}>{lang === "en" ? "Library, progress and reading status" : "Biblioteca, progresso e estado de leitura"}</p>
          </div>
          <button onClick={() => setShowMihon(true)} className="btn-accent" style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>
            {lang === "en" ? "Import" : "Importar"}
          </button>
        </div>
        {/* Divider */}
        <div style={{ borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, margin: "10px 0" }} />
        {/* Paperback */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>📖</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Paperback <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— iOS manga e comics</span></p>
          </div>
          <button onClick={() => setShowPaperback(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>{lang === "en" ? "Import" : "Importar"}</button>
        </div>
        {/* Letterboxd */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>🎬</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Letterboxd <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— filmes vistos</span></p>
          </div>
          <button onClick={() => setShowLetterboxd(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, background: "#00e05422", border: "1px solid #00e05444", color: "#00e054", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{useT("importMihon").replace("Import Mihon","Import").replace("Importar Mihon","Importar")}</button>
        </div>
      </div>


      {/* API Status */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{lang === "en" ? "API SETTINGS" : "CONFIGURAÇÕES API"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
      <div style={{ background: "#161b22", border: "1px solid #10b98133", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>✓ Tudo configurado automaticamente</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "⛩", label: "Anime/Manga", sub: "AniList" },
            { icon: "📚", label: useT("livros"), sub: "Google Books" },
            { icon: "🎮", label: useT("jogos"), sub: "IGDB + Steam" },
            { icon: "🎬", label: "Filmes/Séries", sub: "TMDB" },
            { icon: "💬", label: useT("comics"), sub: "ComicVine" },
            { icon: "🇰🇷", label: "Manhwa/LN", sub: "AniList" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0d1117", border: "1px solid #10b98122", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}><span style={{ color: "#10b981" }}>✓ </span>{s.icon} {statusLabel(s, lang)}</div>
              <div style={{ color: "#484f58", fontSize: 11, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {/* TMDB Attribution */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
          <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" style={{ height: 14, opacity: 0.7 }} />
          <span style={{ fontSize: 10, color: "#484f58" }}>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
      </div>

      {/* ── Legal ── */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: darkMode ? "#8b949e" : "#475569", display: "flex", alignItems: "center", gap: 10 }}>
          LEGAL
          <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${darkMode ? "#30363d" : "#e2e8f0"}, transparent)` }} />
        </h3>
        <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("language")}</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>PT / EN</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["pt", "en"].map(l => (
                <button key={l} onClick={() => onChangeLang(l)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${lang === l ? accent : "#30363d"}`, background: lang === l ? `${accent}22` : "transparent", color: lang === l ? accent : "#8b949e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {l === "pt" ? "🇵🇹 PT" : "🇬🇧 EN"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ background: computedPanelBg, border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("privacy")}</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>Como tratamos os teus dados · RGPD</p>
            </div>
            <a href="https://raw.githubusercontent.com/mcmeskajr-prog/trackall/main/public/privacy.pdf" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}44`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
              Ver PDF →
            </a>
          </div>
          <div style={{ height: 1, background: darkMode ? "#21262d" : "#e8e0d5" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("version")}</p>
              <p style={{ fontSize: 11, color: "#8b949e" }}>TrackAll v64 · março 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zona de Perigo ── */}
      {(() => {
        const [confirmDelete, setConfirmDelete] = useState(false);
        const [deleting, setDeleting] = useState(false);
        const handleDeleteAccount = async () => {
          if (!confirmDelete) { setConfirmDelete(true); return; }
          setDeleting(true);
          try {
            // 1. Apagar todos os dados da biblioteca
            await supabase.from("library").delete().eq("user_id", user.id);
            // 2. Apagar friendships
            await supabase.from("friendships").delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
            // 3. Apagar perfil
            await supabase.from("profiles").delete().eq("id", user.id);
            // 4. Sign out (a conta auth só pode ser apagada por service role — instrui o utilizador)
            await supabase.auth.signOut();
            onSignOut && onSignOut();
          } catch (e) {
            console.error(e);
            setDeleting(false);
            setConfirmDelete(false);
          }
        };
        return (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 10 }}>
              ZONA DE PERIGO
              <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #ef444433, transparent)" }} />
            </h3>
            <div style={{ background: "#1a0a0a", border: "1px solid #ef444433", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 14 }}>
                Apagar a conta remove permanentemente toda a tua biblioteca, perfil e dados. Esta ação não pode ser desfeita.
              </p>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #ef444455", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Apagar conta
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>⚠️ Tens a certeza? Esta ação é irreversível.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "#ef4444", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? useT("deleting") : "Sim, apagar tudo"}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #30363d", background: "transparent", color: "#8b949e", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

            </div>
      {diaryPanel}
      </div>
      </div> {/* fim wrapper tab perfil */}

      {/* Tab Completos */}
      {profileTab === "completos" && (
        <ProfileTabCompletos items={items} library={library} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={onOpen} />
      )}

      {/* Tab Diário */}
      {profileTab === "diario" && (
        <ProfileTabDiario items={items} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={onOpen} />
      )}


      {/* Tab Tier Lists */}
      {profileTab === "tierlists" && (
        <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#484f58" }}>{userTierlists.length} tier lists</p>
            <button onClick={onCreateTierlist} className="btn-accent" style={{ padding: "8px 18px", fontSize: 13 }}>
              + Nova Tier List
            </button>
          </div>
          {userTierlists.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
              <p style={{ color: "#484f58", fontSize: 14, marginBottom: 20 }}>Cria a tua primeira tier list!</p>
              <button onClick={onCreateTierlist} className="btn-accent" style={{ padding: "10px 24px", fontSize: 14 }}>
                + Criar Tier List
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {userTierlists.map(tl => (
                <TierListCard
                  key={tl.id} tl={tl}
                  onOpen={onViewTierlist}
                  onLike={onLikeTierlist}
                  liked={userLikes.includes(tl.id)}
                  currentUserId={currentUserId}
                  onDelete={onDeleteTierlist}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Listas */}
      {profileTab === "listas" && (
        <div style={{ padding: isMobileDevice ? "16px 12px" : "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#484f58" }}>{(userCollections || []).length} {(userCollections || []).length === 1 ? "lista" : "listas"}</p>
            <button onClick={onCreateCollection} className="btn-accent" style={{ padding: "8px 18px", fontSize: 13 }}>
              + Nova Lista
            </button>
          </div>
          {(userCollections || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p style={{ color: "#484f58", fontSize: 14, marginBottom: 20 }}>Cria a tua primeira lista!</p>
              <button onClick={onCreateCollection} className="btn-accent" style={{ padding: "10px 24px", fontSize: 14 }}>
                + Criar Lista
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {(userCollections || []).map(col => (
                <CollectionCard
                  key={col.id} col={col}
                  onOpen={onViewCollection}
                  onLike={onLikeCollection}
                  liked={(userCollectionLikes || []).includes(col.id)}
                  currentUserId={currentUserId}
                  onDelete={onDeleteCollection}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>{/* fim conteudo */}
    {cropSrc && (
      <CropModal
        imageSrc={cropSrc}
        aspectRatio={cropType === "banner" ? 800/280 : 1}
        title={cropType === "banner" ? "Recortar Banner" : "Recortar Avatar"}
        onSave={handleCropSave}
        onClose={() => { setCropSrc(null); setCropType(null); }}
      />
    )}
    </>
  );
}
