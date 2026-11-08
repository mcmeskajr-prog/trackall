import { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { pickImage } from "../lib/imageCheck";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa } from "../config/supabase";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor, compressImage } from "../lib/utils";
import { MEDIA_TYPES, STATUS_OPTIONS, TYPE_COLORS, mediaLabel } from "../config/constants";
import { MAX_FAVORITES_PER_TYPE } from "../config/limits";
import { accentShade, accentVariant, ACCENT_PRESETS, BG_PRESETS } from "../config/theme";
import { TiltCard } from "./TiltCard";
import { BannerEditor } from "./BannerEditor";
import { BannerPageTint } from "./BannerHero";
import { ProfileHeaderPC } from "./ProfileHeaderPC";
import { FeaturedCardPC } from "./FeaturedCardPC";
import { useUiPref } from "../lib/uiPrefs";
import { splitBanner, joinBanner, extractPalette, bannerAccentHex } from "../lib/bannerColors";
import { CollectionCard } from "./CollectionCard";
import { TierListCard } from "./TierListCard";
import { RecentSection } from "./RecentSection";
import { ProfileTabCompletos } from "./ProfileTabCompletos";
import { ProfileTabDiario } from "./ProfileTabDiario";
import { ProfileCard } from "./ProfileCard";
import { ProfileStats } from "./ProfileStats";
import { ProfileActivity } from "./ProfileActivity";
import { ProfileEstatisticas } from "./ProfileEstatisticas";
import { TABS_BG_KEY } from "./AppearanceSettings";
import { ProfileSettings } from "./ProfileSettings";
import { PersonalizeMobile } from "./PersonalizeMobile";
import { TypeIcon } from "./TypeIcon";
import { CoverImg } from "./CoverImg";
import { HofGridMobile, FavStacksMobile } from "./ProfileFavsMobile";
import { Sakura } from "./Sakura";
import { lazyNamed } from "../lib/lazyNamed";

// Modais carregados só quando se abrem (code splitting)
const CropModal = lazyNamed(() => import("./CropModal"), "CropModal");
const FeaturedPickerModal = lazyNamed(() => import("./FeaturedPickerModal"), "FeaturedPickerModal");
const MihonImportModal = lazyNamed(() => import("./MihonImportModal"), "MihonImportModal");
const PaperbackImportModal = lazyNamed(() => import("./PaperbackImportModal"), "PaperbackImportModal");
const LetterboxdImportModal = lazyNamed(() => import("./LetterboxdImportModal"), "LetterboxdImportModal");
const AniListImportModal = lazyNamed(() => import("./AniListImportModal"), "AniListImportModal");
const MalImportModal = lazyNamed(() => import("./MalImportModal"), "MalImportModal");
const NotesImportModal = lazyNamed(() => import("./NotesImportModal"), "NotesImportModal");
const GoodreadsImportModal = lazyNamed(() => import("./GoodreadsImportModal"), "GoodreadsImportModal");

// Secção que abre e fecha (telemóvel): cabeçalho com título, contagem e seta; o conteúdo mantém os seus próprios espaços laterais
function SectionAccordion({ title, right, open, onToggle, darkMode, children }) {
  const muted = darkMode ? "#aab4c0" : "#64748b";
  return (
    <div style={{ marginBottom: open ? 8 : 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 48, padding: "0 16px", background: "none", border: "none", borderBottom: open ? "none" : `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)"}`, color: "inherit", fontFamily: "inherit", cursor: "pointer", textAlign: "left", boxSizing: "border-box" }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0f172a" }}>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: muted }}>
          {right}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && <div style={{ paddingTop: 4 }}>{children}</div>}
    </div>
  );
}
const SECTION_DEFAULTS = { atividade: true, favoritos: true, recentes: false, curso: false };

export function ProfileView(props) {
  const { profile, library, accent, bgColor, bgColorMobile, bgImage, bgImageMobile, bgSeparateDevices, onBgSeparateDevices, onBgImageMobile, onBgColorMobile, isMobileDevice, bgOverlay, bgBlur, bgParallax, darkMode, panelBg, panelOpacity, textContrast, textContrastMobile, sidebarColor, onUpdateProfile, onAccentChange, onBgChange, onBgImage, onBgOverlay, onBgBlur, onBgParallax, onPanelBg, onPanelOpacity, onTextContrast, onTextContrastMobile, onSidebarColor, onSavedThemes, onTmdbKey, tmdbKey, workerUrl, onWorkerUrl, onSignOut, userEmail, favorites = [], onToggleFavorite, hallOfFame = [], onToggleHallOfFame, onImportMihon, onImportPaperback, onImportLetterboxd, onImportAniList, onImportMal, onImportNotes, onImportGoodreads, onOpen, diaryPanel = null, lang = "en", useT = (k) => k, onChangeLang, userTierlists = [], userLikes = [], currentUserId = null, onCreateTierlist, onViewTierlist, onLikeTierlist, onDeleteTierlist, userCollections = [], userCollectionLikes = [], onCreateCollection, onViewCollection, onLikeCollection, onDeleteCollection, featuredItem = null, onSetFeatured, onOpenLibrary = null, onReorderHallOfFame = null, onReorderFavorites = null, onSaveFeaturedNote = null } = props;
  const { panelDark } = useTheme() || {};
  const panelDM = panelBg ? (panelDark ?? darkMode) : darkMode;
  const [tabsBg, setTabsBg] = useState(() => { try { return localStorage.getItem(TABS_BG_KEY) || ""; } catch { return ""; } });
  useEffect(() => {
    const h = () => { try { setTabsBg(localStorage.getItem(TABS_BG_KEY) || ""); } catch {} };
    window.addEventListener("trackall-tabs-bg", h); window.addEventListener("storage", h);
    return () => { window.removeEventListener("trackall-tabs-bg", h); window.removeEventListener("storage", h); };
  }, []); // texto dentro de painéis segue a cor do painel
  const [editing, setEditing] = useState(false);
  const [profileTab, setProfileTab] = useState("perfil");
  const [showMihon, setShowMihon] = useState(false);
  const [showPaperback, setShowPaperback] = useState(false);
  const [showLetterboxd, setShowLetterboxd] = useState(false);
  const [showAniList, setShowAniList] = useState(false);
  const [showMal, setShowMal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showGoodreads, setShowGoodreads] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFeaturedPicker, setShowFeaturedPicker] = useState(false);
  const [favFilter, setFavFilter] = useState("all");
  const [favAll, setFavAll] = useState(false); // layout novo: «Tudo» mostra uma fila por tipo; por defeito mostra só o primeiro tipo
  const [moreOpen, setMoreOpen] = useState(false); // telemóvel: menu «⋯» dos separadores
  const [secOpen, setSecOpen] = useState(() => { try { return { ...SECTION_DEFAULTS, ...JSON.parse(localStorage.getItem("trackall.profileSections") || "{}") }; } catch { return SECTION_DEFAULTS; } });
  const toggleSec = (k) => setSecOpen(prev => { const next = { ...prev, [k]: !prev[k] }; try { localStorage.setItem("trackall.profileSections", JSON.stringify(next)); } catch { /* sem armazenamento: só nesta sessão */ } return next; });
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [hideEmail, setHideEmail] = useState(profile.hideEmail || false);
  const [hideBannerMobile, setHideBannerMobile] = useState(profile.hideBannerMobile || false);
  const [shareCopied, setShareCopied] = useState(false);
  const [settingsSection, setSettingsSection] = useState("aparencia");
  const [personalizing, setPersonalizing] = useState(false);
  // Separadores colantes (telemóvel): ficam em vidro quando chegam ao topo ao deslizar
  const tabsSentinel = useRef(null);
  const [tabsStuck, setTabsStuck] = useState(false);
  useEffect(() => {
    const el = tabsSentinel.current;
    if (!isMobileDevice || !el || typeof IntersectionObserver === "undefined") { setTabsStuck(false); return; }
    const io = new IntersectionObserver(([e]) => setTabsStuck(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [isMobileDevice, profileTab, editing]);

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
  // Fundo opcional das abas sobre wallpaper (PC): "dark" | "light" | "panel"
  const tabsGlass = !isMobileDevice && bgImage && tabsBg ? {
    dark: { bg: "rgba(12,12,16,0.62)", dm: true },
    light: { bg: "rgba(255,255,255,0.72)", dm: false },
    panel: { bg: panelBg ? computedPanelBg : (darkMode ? "rgba(12,12,16,0.62)" : "rgba(255,255,255,0.72)"), dm: panelBg ? panelDM : darkMode },
  }[tabsBg] : null;
  const [appearSections, setAppearSections] = useState({ cores: true, texto: false, fundo: false, sidebar: false, dispositivos: false, stats: false });
  const toggleAppear = (key) => setAppearSections(p => ({ ...p, [key]: !p[key] }));
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || "");
  const [bannerPreview, setBannerPreview] = useState(splitBanner(profile.banner).url);
  const [bannerUrl, setBannerUrl] = useState(splitBanner(profile.banner).url);
  const [bannerStyle, setBannerStyle] = useState(splitBanner(profile.banner).style);
  const resetBanner = () => { const b = splitBanner(profile.banner); setBannerPreview(b.url); setBannerUrl(b.url); setBannerStyle(b.style); setHideBannerMobile(profile.hideBannerMobile || false); };
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
    const file = pickImage(e); if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropType("avatar");
  };

  // Banner: sem recorte fixo. Vai a imagem inteira (até 2400 px) e o enquadramento escolhe-se com o ponto focal no editor.
  const handleBannerFile = async (e) => {
    const file = pickImage(e); if (!file) return;
    const dataUrl = await compressImage(file, 2400, 2400, 0.9);
    if (dataUrl) saveImage("banner", dataUrl);
  };

  const [uploadingImage, setUploadingImage] = useState(null); // "avatar" | "banner" | null
  const [uploadError, setUploadError] = useState("");
  const handleCropSave = (dataUrl) => { const type = cropType; setCropSrc(null); setCropType(null); return saveImage(type, dataUrl); };
  const saveImage = async (type, dataUrl) => {
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
      if (type === "banner") resetBanner();
      setUploadError(lang === "en" ? "Image upload failed — try a smaller image or a direct link instead" : "O envio da imagem falhou — tenta uma imagem mais pequena ou um link direto");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    await onUpdateProfile({ ...profile, name, bio, avatar: avatarPreview, banner: joinBanner(bannerUrl, bannerStyle), hideEmail, hideBannerMobile });
    setEditing(false);
    // Uma só cor para tudo: a cor do banner passa a ser a cor de destaque da app (e fica guardada no perfil)
    if (bannerUrl && bannerStyle.a !== 0 && onAccentChange) {
      try { const hex = bannerAccentHex(bannerStyle, await extractPalette(bannerUrl)); if (hex && hex.toLowerCase() !== String(accent).toLowerCase()) onAccentChange(hex); } catch {}
    }
  };

  const startEditing = () => { setName(profile.name||""); setBio(profile.bio||""); setAvatarPreview(profile.avatar||""); resetBanner(); setEditing(true); };
  // Na vista normal do separador Perfil, a identidade vive no ProfileCard; o cabeçalho antigo só aparece a editar ou noutros separadores.
  const showHeaderIdentity = editing || profileTab !== "perfil";
  const [profileLayout] = useUiPref("trackall_profile_layout");
  const v2 = !isMobileDevice && !editing && profileLayout !== "classic"; // layout novo do PC (banner + duas colunas)
  const currentBanner = editing ? bannerPreview : splitBanner(profile.banner).url;
  const currentAvatar = editing ? avatarPreview : profile.avatar;

  const renderTopGenres = (panel) => {
        const completed = items.filter(i => i?.userStatus === "completo");
        const genreCount = {};
        completed.forEach(i => (i.genres||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
        const topGenres = Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
        if (topGenres.length === 0) return null;
        const maxCount = topGenres[0][1];
        return (
          <div style={panel ? { borderRadius: 20, padding: "16px 18px", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}` } : { marginBottom: 24 }}>
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
  };

  const nRecent = items.filter(i => i.userStatus === "completo" && i.addedAt).length;
  const nCurso = items.filter(i => i.userStatus === "assistindo").length;

  // ── Favoritos: máx. MAX_FAVORITES_PER_TYPE por tipo (aplicado ao adicionar, ver toggleFavorite no App) ──
  const favoritesBlock = (() => {
    const typesWithFavs = MEDIA_TYPES.slice(1).filter(t => favorites.some(f => f.type === t.id));
    const fEff = v2 && !favAll && favFilter === "all" ? (typesWithFavs[0]?.id || "all") : (favFilter !== "all" && !typesWithFavs.some(t => t.id === favFilter) ? "all" : favFilter);
    const byRating = (a, b) => ((b.userRating || 0) - (a.userRating || 0)) || ((b.addedAt || 0) - (a.addedAt || 0));
    const ratingOf = (item) => findLibraryEntry(library, item.id, item.type)?.item?.userRating ?? item.userRating ?? 0;
    const sortedOf = (tid) => favorites.filter(f => f.type === tid).map(f => ({ ...f, userRating: ratingOf(f) })).sort(byRating);
    const hair = darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.15)";
    const heading = (
      <div style={{ marginBottom: 12, padding: v2 ? 0 : "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ fontSize: isMobileDevice ? 18 : 20, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0f172a", margin: 0 }}>{lang === "en" ? "Favorites" : "Favoritos"}</h3>
          <span style={{ fontSize: 12, color: darkMode ? "#aab4c0" : "#64748b" }}>{favorites.length}</span>
        </div>
        {v2 && typesWithFavs.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {[{ id: "all" }, ...typesWithFavs].map(t => {
              const on = fEff === t.id;
              return <button key={t.id} type="button" onClick={() => { setFavAll(t.id === "all"); setFavFilter(t.id); }} style={{ minHeight: 34, padding: "0 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${on ? accent : hair}`, background: on ? accent : "transparent", color: on ? "white" : (darkMode ? "#aab4c0" : "#475569") }}>{t.id === "all" ? (lang === "en" ? "All" : "Tudo") : mediaLabel(t, lang)}</button>;
            })}
          </div>
        )}
      </div>
    );
    const empty = (txt) => (
      <div style={{ margin: "0 16px", border: "1px dashed #30363d", borderRadius: 12, padding: 20, textAlign: "center" }}>
        <p style={{ color: "#484f58", fontSize: 13 }}>{txt}</p>
      </div>
    );
    if (favorites.length === 0) return (
      <div style={{ marginBottom: isMobileDevice ? 8 : 28 }}>{!isMobileDevice && heading}{empty(lang === "en" ? "Open any item and click ☆ Favorite" : "Abre qualquer item e clica em ☆ Favorito")}</div>
    );

    // Capa de um favorito (sem borda: o gradiente de fundo aparecia por baixo de uma borda de 1px)
    const renderFav = (item, { mobile = false } = {}) => {
      const coverSrc = item.customCover || item.cover;
      const t = MEDIA_TYPES.find(x => x.id === item.type);
      const r = item.userRating || 0;
      return (
        <div key={item.id} className={mobile ? undefined : "recent-card fav-card-wrap"} onClick={() => onOpen && onOpen(item)} title={item.title} style={{ position: "relative", cursor: "pointer", ...(mobile ? { width: "clamp(96px, 27vw, 112px)", flexShrink: 0 } : {}) }}>
          {mobile ? (
            <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 12, overflow: "hidden", position: "relative", background: gradientFor(item.id), boxShadow: "0 12px 22px -10px rgba(0,0,0,0.8)" }}>
              {coverSrc && <CoverImg hi src={coverSrc} alt={item.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
              {r > 0 && <div style={{ position: "absolute", right: 6, top: 6, padding: "2px 7px", borderRadius: 8, background: "rgba(0,0,0,0.62)", color: "#fff", fontSize: 10.5, fontWeight: 800, pointerEvents: "none" }}>★ {r}</div>}
            </div>
          ) : (
            <>
              <TiltCard maxTilt={8} glare glareOpacity={0.12} style={{ width: "100%", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", position: "relative", background: gradientFor(item.id), boxShadow: "0 12px 24px -10px rgba(0,0,0,0.7)" }}>
                {coverSrc
                  ? <CoverImg hi src={coverSrc} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}><TypeIcon id={t?.id} /></div>}
                <div className="recent-hover-overlay no-tc" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)", opacity: 0, transition: "opacity 0.2s", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "40px 10px 10px" }}>
                  <p style={{ fontSize: 12, color: "white", fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", margin: 0 }}>{item.title}</p>
                </div>
                {r > 0 && <div style={{ position: "absolute", top: 7, right: 7, padding: "2px 7px", borderRadius: 7, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 10, fontWeight: 800, pointerEvents: "none" }}>★ {r}</div>}
              </TiltCard>
              <button className="fav-rm" aria-label={lang === "en" ? "Remove from favorites" : "Remover dos favoritos"} onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(item); }}
                style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "#ef4444", color: "white", fontSize: 11, cursor: "pointer", display: "flex", opacity: 0, transition: "opacity 0.15s", alignItems: "center", justifyContent: "center", padding: 0, zIndex: 2 }}>✕</button>
            </>
          )}
        </div>
      );
    };

    // ── Telemóvel: pilhas por tipo (toca para abrir a lista; toque longo para reordenar) ──
    if (isMobileDevice) return (
      <FavStacksMobile favorites={favorites} library={library} accent={accent} darkMode={darkMode} lang={lang} onOpen={onOpen}
        onReorderFavorites={onReorderFavorites} onOpenLibrary={onOpenLibrary} />
    );

    // ── PC: uma fila por tipo (7 colunas = o máximo por tipo, cabem todos) ──
    const groups = (fEff === "all" ? typesWithFavs : typesWithFavs.filter(t => t.id === fEff)).map(t => ({ t, list: sortedOf(t.id) }));
    return (
      <div style={{ marginBottom: 28 }}>
        {heading}
        {groups.length === 0 ? (
          <div style={{ margin: v2 ? 0 : "0 16px", border: `1px dashed ${hair}`, borderRadius: 12, padding: 20, textAlign: "center", color: darkMode ? "#8b949e" : "#64748b", fontSize: 13 }}>
            {lang === "en" ? "No favorites of this type." : "Sem favoritos deste tipo."}
          </div>
        ) : (
          <div style={{ margin: v2 ? 0 : "0 16px", display: "flex", flexDirection: "column", gap: 24 }}>
            {groups.map(({ t, list }) => (
              <div key={t.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#aab4c0" : "#475569" }}>
                  {mediaLabel(t, lang)}
                  <span style={{ fontWeight: 600, opacity: 0.7 }}>{list.length}/{MAX_FAVORITES_PER_TYPE}</span>
                  <span style={{ flex: 1, height: 1, background: darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${MAX_FAVORITES_PER_TYPE}, minmax(0, 1fr))`, gap: v2 ? 12 : 14 }}>
                  {list.map(item => renderFav(item))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  })();

  // Separadores: ícone de linha + texto no PC (todos iguais); só texto no telemóvel, onde o espaço é curto
  const TAB_ICONS = {
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    completos: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    tierlists: '<path d="M4 6h16M4 12h10M4 18h6"/>',
    listas: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    diario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    definicoes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  };
  const stripGlyph = (t) => String(t).replace(/^[^\p{L}\p{N}]+/u, "");
  const renderTabLabel = (tab) => {
    const text = stripGlyph(tab === "perfil" ? useT("tabPerfil") : tab === "completos" ? useT("tabCompletos") : tab === "tierlists" ? useT("tabTierLists")
      : tab === "listas" ? (lang === "en" ? "Lists" : "Listas") : tab === "definicoes" ? (lang === "en" ? "Settings" : "Definições") : (lang === "en" ? "Diary" : "Diário"));
    if (isMobileDevice) return text;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: TAB_ICONS[tab] }} />
        {text}
      </span>
    );
  };

  const personalizeProps = {
    profile, currentUserId, onUpdateProfile, lang, savedThemes: onSavedThemes,
    accent, bgColor, bgColorMobile, bgSeparateDevices, bgImage, bgImageMobile, panelBg, panelOpacity, bgOverlay, bgBlur,
    onAccentChange, onBgChange, onBgColorMobile, onBgImage, onBgImageMobile, onPanelBg, onPanelOpacity, onBgOverlay, onBgBlur, onBgSeparateDevices,
  };
  const pageBg = (bgSeparateDevices ? bgColorMobile : bgColor) || bgColor || "#0d1117";
  const flatProfile = isMobileDevice && !editing && !!profile.banner && !profile.hideBannerMobile; // perfil sem moldura (banner a toda a largura)
  const cardProps = {
    profile, avatar: currentAvatar, items, library, featuredItem, userEmail, hideEmail, onOpen, onEdit: startEditing,
    onPersonalize: isMobileDevice ? () => setPersonalizing(true) : null, onSignOut,
    onPickFeatured: onSetFeatured ? () => setShowFeaturedPicker(true) : null, onFilter: onOpenLibrary,
  };

  const hofSection = (
      <div style={{ marginBottom: isMobileDevice ? 20 : 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, padding: v2 ? 0 : "0 16px" }}>
          <h3 style={{ fontSize: isMobileDevice ? 18 : 20, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0f172a", margin: 0 }}>Hall of Fame</h3>
          <span style={{ fontSize: 12, color: darkMode ? "#aab4c0" : "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                        {hallOfFame.length}/10 {lang === "en" ? "titles" : "obras"}
          </span>
        </div>

        {isMobileDevice ? (() => {
          // Máximo 10 obras. Se o destaque estiver no Hall of Fame, fica assinalado com o contorno de destaque.
          const sameItem = (a, b) => a.id === b.id || (findLibraryEntry(library, a.id, a.type)?.key && findLibraryEntry(library, a.id, a.type)?.key === findLibraryEntry(library, b.id, b.type)?.key);
          const list = hallOfFame.slice(0, 10).map(h => (featuredItem && sameItem(h, featuredItem)) ? { ...h, _feat: true } : h);
          return <HofGridMobile list={list} accent={accent} darkMode={darkMode} lang={lang} library={library} onOpen={onOpen} onReorder={onReorderHallOfFame} onAdd={onOpenLibrary ? () => onOpenLibrary() : undefined} />;
        })() : hallOfFame.length === 0 ? (
          <div style={{ margin: "0 16px", border: "1px dashed #30363d", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <p style={{ color: "#484f58", fontSize: 13 }}>{lang === "en" ? "Choose up to 10 titles from the item modal." : "Escolhe até 10 obras a partir do modal de cada item."}</p>
          </div>
        ) : (
          <div style={{ ...(v2 ? { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, min(230px, max(110px, calc((100vh - 400px) / 3)), calc((100% - 56px) / 5))))", justifyContent: "space-between", gap: 14 } : { margin: "0 16px" }), ...(v2 ? {} : isMobileDevice ? { display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 6 } : { "--hof-h": "clamp(180px, calc((100vh - 450px) / 2), 300px)", display: "grid", ...(hallOfFame.length <= 5
              // Poucos títulos: o tamanho das capas não encolhe; ficam centradas e um pouco maiores (até 4)
              ? { gridTemplateColumns: `repeat(${hallOfFame.length}, minmax(0, calc(var(--hof-h) * 5 / 7 * ${hallOfFame.length <= 4 ? 1.12 : 1})))`, justifyContent: "center", gap: 18 }
              : { gridTemplateColumns: "repeat(5, minmax(0, calc(var(--hof-h) * 5 / 7)))", justifyContent: "space-between", gap: 14 }) }) }}>
            {hallOfFame.map((item, idx) => {
              const coverSrc = item.customCover || item.cover;
              const score = findLibraryEntry(library, item.id, item.type)?.item?.userRating ?? item.userRating ?? 0;
              const tone = accentVariant(accent, idx);
              return (
                <div
                  key={item.id}
                  className="hof-card"
                  onClick={() => onOpen && onOpen(item)}
                  title={item.title}
                  style={{ cursor: "pointer", ...(isMobileDevice ? { width: 110, flexShrink: 0 } : { minWidth: 0 }) }}
                >
                  <TiltCard maxTilt={8} glare glareOpacity={0.12} style={{
                    position: "relative", aspectRatio: "2/3", borderRadius: isMobileDevice ? 10 : 14, overflow: "hidden",
                    background: darkMode ? "#11151b" : "#e2e8f0",
                    boxShadow: "0 18px 30px -16px rgba(0,0,0,0.8)",
                  }}>
                    
                    {coverSrc
                      ? <CoverImg hi src={coverSrc} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                      : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: 10, fontSize: 13, fontWeight: 800, color: "white", lineHeight: 1.2 }}>{item.title}</div>}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleHallOfFame && onToggleHallOfFame(item); }}
                      aria-label={lang === "en" ? "Remove from Hall of Fame" : "Remover do Hall of Fame"}
                      className="hof-rm" style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: 999, border: "none", background: "rgba(10,10,10,0.72)", color: "#f8fafc", cursor: "pointer", display: isMobileDevice ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: 13, padding: 0 }}
                    >
                      ×
                    </button>
                    {score > 0 && (
                      <div className="hof-badge" style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px 3px 6px", borderRadius: 8, background: "rgba(0,0,0,0.6)", transition: "background 0.25s", color: "#fbcfe8", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><Sakura size={12} />{score}</div>
                    )}
                                      </TiltCard>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );

  return (
    <>
    {isMobileDevice && personalizing && createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 800, background: pageBg, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 170 }}>
        <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 12px 10px", background: pageBg }}>
          <button type="button" onClick={() => setPersonalizing(false)} aria-label={lang === "en" ? "Back" : "Voltar"} style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.07)", color: darkMode ? "#e6edf3" : "#0f172a", fontSize: 20, cursor: "pointer" }}>←</button>
          <div style={{ fontSize: 18, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0f172a" }}>{lang === "en" ? "Customise" : "Personalizar"}</div>
        </div>
        <div style={{ padding: "0 16px", maxWidth: 600, margin: "0 auto" }}><PersonalizeMobile {...personalizeProps} /></div>
      </div>, document.body)}
    <div style={{ paddingBottom: 32, maxWidth: isMobileDevice ? 600 : "100%", margin: "0 auto", position: "relative", isolation: "isolate" }}>
      {isMobileDevice && !editing && profile.banner && !profile.hideBannerMobile && <BannerPageTint banner={profile.banner} />}

      {/* ── Avatar (só a editar ou noutros separadores; no Perfil a identidade vive no ProfileCard) ── */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", padding: showHeaderIdentity ? "28px 0 14px" : 0 }}>
        {showHeaderIdentity && (
        <>
        {/* Avatar — overlaps banner */}
        <div>
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
        </>
        )}
      </div>

      {showHeaderIdentity && (
      <>
      {/* Name / bio / edit */}
      <div style={{ textAlign: "center", padding: "0 16px", marginBottom: 20 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 400, margin: "0 auto" }}>
            {!isMobileDevice && (
            <BannerEditor url={bannerPreview} style={bannerStyle} onStyle={setBannerStyle} onFile={handleBannerFile}
              onRemove={() => { setBannerPreview(""); setBannerUrl(""); }} uploading={uploadingImage === "banner"}
              hide={hideBannerMobile} onHide={setHideBannerMobile} lang={lang} avatar={avatarPreview} name={name} />
            )}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={useT("namePlaceholder")} style={{ padding: "10px 14px", textAlign: "center", fontSize: 16, fontWeight: 700 }} />
            <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder={useT("bioPlaceholder")} style={{ padding: "10px 14px", fontSize: 13 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: darkMode ? "#0d1117" : "#f8fafc", borderRadius: 10, border: `1px solid ${darkMode ? "#30363d" : "#e2e8f0"}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!hideEmail} onChange={e => setHideEmail(e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
              <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b" }}>{useT("hideEmail")}</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-accent" style={{ flex: 1, padding: "10px", opacity: uploadingImage ? 0.6 : 1 }} onClick={handleSave} disabled={!!uploadingImage}>{uploadingImage ? (lang === "en" ? "Uploading image..." : "A enviar imagem...") : useT("saveProfile")}</button>
              <button onClick={() => { setEditing(false); resetBanner(); setAvatarPreview(profile.avatar||""); }} style={{ flex: 1, padding: "10px", background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit" }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, backgroundImage: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{profile.name || "Utilizador"}</h2>
            {profile.bio && <p style={{ color: "#8b949e", fontSize: 14, marginTop: 4 }}>{profile.bio}</p>}
            {userEmail && !hideEmail && <p style={{ color: "#484f58", fontSize: 12, marginTop: 4 }}>✉ {userEmail}</p>}
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>TrackAll · {items.length} {useT("inLibraryCount")}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, alignItems: "center" }}>
              <button onClick={() => { setName(profile.name||""); setBio(profile.bio||""); setAvatarPreview(profile.avatar||""); resetBanner(); setEditing(true); }} style={{
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

      </>
      )}

      {/* Layout novo do PC: banner + identidade (no separador Perfil) */}
      {v2 && profileTab === "perfil" && (
        <ProfileHeaderPC profile={profile} avatar={currentAvatar} items={items} userEmail={userEmail} hideEmail={hideEmail}
          onEdit={startEditing} onSettings={() => setProfileTab("definicoes")} onFilter={onOpenLibrary} panelBg={panelBg ? computedPanelBg : null} />
      )}

      {/* Perfil sem moldura: banner a toda a largura, depois os separadores */}
      {flatProfile && profileTab === "perfil" && <ProfileCard {...cardProps} />}
      <div ref={tabsSentinel} aria-hidden="true" style={{ height: 1, marginBottom: -1 }} />
      {/* ── Profile Tabs ── */}
      <div style={{ display: "flex", gap: isMobileDevice ? 18 : 28, padding: isMobileDevice ? (tabsStuck ? "calc(8px + env(safe-area-inset-top)) 16px 0" : "8px 16px 0") : "16px 32px 0", margin: isMobileDevice ? "0 0 4px" : "0 0 8px", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`, overflowX: "auto", scrollbarWidth: "none",
        ...(tabsGlass ? { background: tabsGlass.bg, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 16, padding: "12px 24px 0", margin: "0 0 14px", borderBottom: "none" } : {}),
        ...(isMobileDevice ? { justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, transition: "background-color .25s ease",
          background: tabsStuck ? (darkMode ? `color-mix(in srgb, ${pageBg} 72%, transparent)` : "rgba(255,255,255,0.78)") : "transparent",
          backdropFilter: tabsStuck ? "blur(16px)" : "none", WebkitBackdropFilter: tabsStuck ? "blur(16px)" : "none" } : {}) }}>
        {(isMobileDevice ? ["perfil","completos","listas","diario","mais"] : ["perfil","completos","tierlists","listas","diario","definicoes"]).map(tab => {
          const isMore = tab === "mais";
          const active = isMore ? (profileTab === "tierlists" || profileTab === "definicoes") : profileTab === tab;
          return (
          <button key={tab} onClick={() => isMore ? setMoreOpen(true) : setProfileTab(tab)} aria-label={isMore ? (lang === "en" ? "More" : "Mais") : undefined} aria-haspopup={isMore ? "dialog" : undefined} style={{
            flexShrink: 0, padding: "0 2px 14px", minHeight: 44,
            background: "none", border: "none",
            borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
            color: active ? accent : (tabsGlass ? (tabsGlass.dm ? "#aab4c0" : "#475569") : (darkMode ? "#6e7681" : "#64748b")),
            cursor: "pointer", fontFamily: "inherit",
            fontSize: isMobileDevice ? 13 : 14,
            fontWeight: active ? 700 : 500,
            marginBottom: -1, whiteSpace: "nowrap",
            ...(isMobileDevice ? { flex: 1 } : {}),
          }}>
            {isMore ? "⋯" : renderTabLabel(tab)}
          </button>
          );
        })}
      </div>

      {/* Stats and settings — PC: flex row com diário à direita (layout clássico) */}
      {!(v2 && profileTab === "perfil") && (<>
      <div style={{ display: profileTab === "perfil" ? "block" : "none" }}>
      <div style={ !isMobileDevice
        ? { display: "flex", flexDirection: "row", gap: 32, padding: "24px 32px 0 32px", alignItems: "stretch" }
        : { padding: "16px 16px 0" }
      }>
      {!editing && !flatProfile && (
        <div style={ !isMobileDevice ? { width: 330, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 } : { marginBottom: 20 } }>
          <ProfileCard
            profile={profile}
            avatar={currentAvatar}
            items={items}
            library={library}
            featuredItem={featuredItem}
            userEmail={userEmail}
            hideEmail={hideEmail}
            onOpen={onOpen}
            onEdit={startEditing}
            onPersonalize={isMobileDevice ? () => setPersonalizing(true) : null}
            onSignOut={onSignOut}
            onPickFeatured={onSetFeatured ? () => setShowFeaturedPicker(true) : null}
            onFilter={onOpenLibrary}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, margin: "0 -16px", ...(isMobileDevice ? {} : { display: "flex", flexDirection: "column" }) }}>


      {/* ── Estatísticas (Fase 2) ── */}
      {!isMobileDevice && <ProfileStats items={items} panelBg={panelBg ? computedPanelBg : null} onFilter={onOpenLibrary} />}

      {/* ── Hall of Fame ── */}
      {hofSection}

      {/* Telemóvel: Recentes e Em curso logo a seguir ao Hall of Fame */}
      {isMobileDevice && items.length > 0 && (<>
        {nRecent > 0 && <div style={{ padding: "0 16px", margin: "6px 0 18px" }}><RecentSection items={items} onOpen={onOpen} showDiary={false} part="recent" bare inlineTitle={lang === "en" ? "Recent" : "Recentes"} /></div>}
        {nCurso > 0 && <div style={{ padding: "0 16px", margin: "6px 0 18px" }}><RecentSection items={items} onOpen={onOpen} showDiary={false} part="curso" bare inlineTitle={lang === "en" ? "In progress" : "Em curso"} /></div>}
      </>)}

      {/* ── Atividade (12 meses; 6 no telemóvel). Ocupa a faixa reservada às Conquistas até elas existirem ── */}
      {items.length > 0 && (isMobileDevice
        ? <SectionAccordion title={lang === "en" ? "Activity" : "Atividade"} open={secOpen.atividade} onToggle={() => toggleSec("atividade")} darkMode={panelDM}><div style={{ margin: "0 16px" }}><ProfileActivity items={items} accent={accent} darkMode={panelDM} isMobile={isMobileDevice} lang={lang} panelBg={panelBg ? computedPanelBg : null} onOpen={onOpen} /></div></SectionAccordion>
        : <div style={{ margin: "0 16px", flex: "1 1 auto", display: "flex", flexDirection: "column" }}><ProfileActivity items={items} accent={accent} darkMode={panelDM} isMobile={isMobileDevice} lang={lang} panelBg={panelBg ? computedPanelBg : null} onOpen={onOpen} /></div>)}

      </div>
      {diaryPanel}
      </div>

      <div style={{ padding: isMobileDevice ? 0 : "0 16px", marginTop: isMobileDevice ? 0 : 28 }}>
      {/* Telemóvel: ordem Recentes, Em curso, Favoritos (ver mais abaixo) */}

      {/* ── Filtro de tipo (só PC; no telemóvel os chips vivem dentro dos Favoritos) ── */}
      {!isMobileDevice && (() => {
        const filterTypes = MEDIA_TYPES.slice(1).filter(t => items.some(i => i.type === t.id));
        const border = darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.15)";
        return (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "0 16px", marginBottom: 18, justifyContent: "flex-end" }}>
            {[{ id: "all" }, ...filterTypes].map(t => {
              const on = favFilter === t.id;
              return (
                <button key={t.id} onClick={() => setFavFilter(t.id)} style={{
                  flexShrink: 0, minHeight: 36, padding: "0 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                  border: `1px solid ${on ? accent : border}`, background: on ? accent : "transparent", color: on ? "white" : (darkMode ? "#aab4c0" : "#475569"),
                }}>{t.id === "all" ? (lang === "en" ? "All" : "Tudo") : mediaLabel(t, lang)}</button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Recentes (+ Em curso) ── o Diário tem o seu próprio separador ── */}
      {items.length > 0 && !isMobileDevice && <div style={{ padding: "0 16px" }}><RecentSection items={favFilter === "all" ? items : items.filter(i => i.type === favFilter)} onOpen={onOpen} showDiary={false} /></div>}

      {/* Telemóvel: Recentes e Em curso logo a seguir ao Hall of Fame; Favoritos (com os seus chips de tipo) depois */}
      {isMobileDevice && <SectionAccordion title={lang === "en" ? "Favorites" : "Favoritos"} right={favorites.length} open={secOpen.favoritos} onToggle={() => toggleSec("favoritos")} darkMode={darkMode}>{favoritesBlock}</SectionAccordion>}

      {isMobileDevice ? null : favoritesBlock}

      {/* ── Estatísticas (PC): distribuição de ratings completa ── */}
      {!editing && !isMobileDevice && <div style={{ margin: "0 16px 28px" }}><ProfileEstatisticas items={items} panelBg={panelBg ? computedPanelBg : null} /></div>}

      {/* ── Tier Lists e Listas ── */}
      {!editing && !isMobileDevice && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: isMobileDevice ? 10 : 14, margin: "0 16px 28px" }}>
          {[
            { tab: "tierlists", label: "Tier Lists", count: userTierlists.length, grad: "rgba(236,72,153,0.16)" },
            { tab: "listas", label: lang === "en" ? "My Lists" : "Minhas Listas", count: userCollections.length, grad: "rgba(59,130,246,0.16)" },
          ].map(c => (
            <button key={c.tab} onClick={() => setProfileTab(c.tab)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit", borderRadius: isMobileDevice ? 16 : 20, padding: isMobileDevice ? 16 : 22, border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`, background: `linear-gradient(120deg, ${c.grad}, rgba(255,255,255,0.04))` }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#aab4c0" : "#475569" }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{c.count} {c.count === 1 ? (lang === "en" ? "list" : "lista") : (lang === "en" ? "lists" : "listas")}</div>
              <div style={{ fontSize: 12, color: darkMode ? "#aab4c0" : "#475569", marginTop: 2 }}>{lang === "en" ? "Open" : "Abrir"} →</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ margin: "0 16px" }}>{renderTopGenres(false)}</div>

            </div>
      </div> {/* fim wrapper tab perfil */}
      </>)}

      {/* ── Layout novo do PC: duas colunas (Hall of Fame, Favoritos, Recentes | Destaque, Em curso, Atividade) ── */}
      {v2 && profileTab === "perfil" && (() => {
        const cursoList = items.filter(i => i.userStatus === "assistindo").slice(0, 4);
        const panel = { borderRadius: 16, padding: 20, boxSizing: "border-box", background: panelBg ? computedPanelBg : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)"), border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}` };
        const eyebrow = { fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#8b95a1" : "#64748b", margin: 0 };
        return (
          <div style={{ padding: "24px 32px 0", maxWidth: 1480, margin: "0 auto", boxSizing: "border-box" }}>
            <style>{`.pv2-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;align-items:stretch}.pv2-aside{display:flex;flex-direction:column;gap:16px}.pv2-genres{display:flex;flex-direction:column;flex:1}.pv2-genres>*{flex:1}@media (max-width:1180px){.pv2-grid{grid-template-columns:minmax(0,1fr)}.pv2-aside{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.pv2-aside>*:first-child{grid-column:1 / -1}}`}</style>
            <div className="pv2-grid">
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
                {hofSection}
                {favoritesBlock}
                {items.length > 0 && <RecentSection items={items} onOpen={onOpen} showDiary={false} part="recent" compactHead />}
              </div>
              <div className="pv2-aside">
                <FeaturedCardPC featuredItem={featuredItem} library={library} items={items} onOpen={onOpen}
                  onPickFeatured={onSetFeatured ? () => setShowFeaturedPicker(true) : null} onSaveNote={onSaveFeaturedNote} />
                {cursoList.length > 0 && (
                  <div style={panel}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                      <h3 style={eyebrow}>{lang === "en" ? "In progress" : "Em curso"}</h3>
                      <span style={{ fontSize: 12, color: darkMode ? "#aab4c0" : "#64748b", fontWeight: 700 }}>{nCurso}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {cursoList.map(it => (
                        <div key={it.id} onClick={() => onOpen && onOpen(it)} style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer", minWidth: 0 }}>
                          <div style={{ width: 44, height: 66, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: gradientFor(it.id) }}>
                            {(it.customCover || it.cover) && <CoverImg hi src={it.customCover || it.cover} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: darkMode ? "#e6edf3" : "#0f172a" }}>{it.title}</div>
                            <div style={{ fontSize: 12, color: darkMode ? "#aab4c0" : "#64748b", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(MEDIA_TYPES.find(t => t.id === it.type) ? mediaLabel(MEDIA_TYPES.find(t => t.id === it.type), lang) : "")}{it.lastChapter ? ` · ${String(it.lastChapter).replace(/chapter /i, "Cap. ").replace(/vol\.\d+\s*/i, "")}` : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {items.length > 0 && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                    <ProfileActivity items={items} accent={accent} darkMode={panelDM} compact lang={lang} panelBg={panelBg ? computedPanelBg : null} onOpen={onOpen} />
                    <div className="pv2-genres">{renderTopGenres(true)}</div>
                  </div>
                )}
              </div>
            </div>
            {diaryPanel}
            {!editing && <div style={{ margin: "28px 0" }}><ProfileEstatisticas items={items} panelBg={panelBg ? computedPanelBg : null} /></div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, margin: "0 0 28px" }}>
              {[
                { tab: "tierlists", label: "Tier Lists", count: userTierlists.length, grad: "rgba(236,72,153,0.16)" },
                { tab: "listas", label: lang === "en" ? "My Lists" : "Minhas Listas", count: userCollections.length, grad: "rgba(59,130,246,0.16)" },
              ].map(c => (
                <button key={c.tab} onClick={() => setProfileTab(c.tab)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit", borderRadius: 20, padding: 22, border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`, background: `linear-gradient(120deg, ${c.grad}, rgba(255,255,255,0.04))` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#aab4c0" : "#475569" }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{c.count} {c.count === 1 ? (lang === "en" ? "list" : "lista") : (lang === "en" ? "lists" : "listas")}</div>
                  <div style={{ fontSize: 12, color: darkMode ? "#aab4c0" : "#475569", marginTop: 2 }}>{lang === "en" ? "Open" : "Abrir"} →</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Telemóvel: menu «⋯» (Tier Lists e Definições) */}
      {isMobileDevice && moreOpen && createPortal(
        <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}>
          <div role="dialog" aria-label={lang === "en" ? "More" : "Mais"} onClick={e => e.stopPropagation()} style={{ width: "100%", boxSizing: "border-box", borderRadius: "20px 20px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", background: darkMode ? "#12151b" : "#ffffff", border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`, borderBottom: "none" }}>
            <div style={{ width: 38, height: 4, borderRadius: 9, background: darkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)", margin: "0 auto 14px" }} />
            {[
              { tab: "tierlists", label: "Tier Lists", sub: `${userTierlists.length} ${userTierlists.length === 1 ? (lang === "en" ? "list" : "lista") : (lang === "en" ? "lists" : "listas")}` },
              { tab: "definicoes", label: lang === "en" ? "Settings" : "Definições", sub: lang === "en" ? "Appearance, import, account" : "Aparência, importar, conta" },
            ].map(o => (
              <button key={o.tab} onClick={() => { setProfileTab(o.tab); setMoreOpen(false); }} style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", padding: "8px 4px", background: "none", border: "none", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`, color: darkMode ? "#e6edf3" : "#0f172a", fontFamily: "inherit", cursor: "pointer" }}>
                <span><span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{o.label}</span><span style={{ display: "block", fontSize: 12, color: darkMode ? "#8b949e" : "#64748b", marginTop: 2 }}>{o.sub}</span></span>
                <span style={{ color: darkMode ? "#8b949e" : "#64748b", fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Modais de importação (fora do separador Perfil para funcionarem a partir das Definições) */}
      {/* Mihon Modal */}
      {showMihon && (
        <Suspense fallback={null}><MihonImportModal
         
         
          onClose={() => setShowMihon(false)}
          onImport={(items) => { onImportMihon && onImportMihon(items); setShowMihon(false); }}
        /></Suspense>
      )}

      {/* Modais Paperback e Letterboxd */}
      {showPaperback && (
        <Suspense fallback={null}><PaperbackImportModal
         
          onClose={() => setShowPaperback(false)}
          onImport={(items) => { onImportPaperback && onImportPaperback(items); setShowPaperback(false); }}
        /></Suspense>
      )}
      {showNotes && (
        <Suspense fallback={null}><NotesImportModal
          library={library}
          tmdbKey={tmdbKey}
          workerUrl={workerUrl}
          onClose={() => setShowNotes(false)}
          onImport={(items) => { onImportNotes && onImportNotes(items); setShowNotes(false); }}
        /></Suspense>
      )}
      {showGoodreads && (
        <Suspense fallback={null}><GoodreadsImportModal
          library={library}
          workerUrl={workerUrl}
          onClose={() => setShowGoodreads(false)}
          onImport={(items) => { onImportGoodreads && onImportGoodreads(items); setShowGoodreads(false); }}
        /></Suspense>
      )}
      {showAniList && (
        <Suspense fallback={null}><AniListImportModal
          library={library}
          workerUrl={workerUrl}
          onClose={() => setShowAniList(false)}
          onImport={(items, opts) => { onImportAniList && onImportAniList(items, opts); setShowAniList(false); }}
        /></Suspense>
      )}
      {showMal && (
        <Suspense fallback={null}><MalImportModal
          library={library}
          workerUrl={workerUrl}
          onClose={() => setShowMal(false)}
          onImport={(items, opts) => { onImportMal && onImportMal(items, opts); setShowMal(false); }}
        /></Suspense>
      )}
      {showLetterboxd && (
        <Suspense fallback={null}><LetterboxdImportModal
         
          onClose={() => setShowLetterboxd(false)}
          onImport={(items) => { onImportLetterboxd && onImportLetterboxd(items); setShowLetterboxd(false); }}
        /></Suspense>
      )}

      {/* ── Separador Definições ── */}
      {/* ── Separador Definições ── */}
      {profileTab === "definicoes" && (
        <ProfileSettings {...props} lang={lang} useT={useT} panelDM={panelDM} computedPanelBg={computedPanelBg} personalizeProps={personalizeProps}
          settingsSection={settingsSection} setSettingsSection={setSettingsSection}
          setShowMihon={setShowMihon} setShowPaperback={setShowPaperback} setShowLetterboxd={setShowLetterboxd} setShowAniList={setShowAniList} setShowMal={setShowMal} setShowNotes={setShowNotes} setShowGoodreads={setShowGoodreads} />
      )}


      {/* Tab Completos */}
      {profileTab === "completos" && (
        <ProfileTabCompletos items={items} library={library} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={onOpen} />
      )}

      {/* Tab Diário */}
      {profileTab === "diario" && (
        <ProfileTabDiario items={items} accent={accent} darkMode={panelDM} isMobileDevice={isMobileDevice} lang={lang} onOpen={onOpen} />
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
    {showFeaturedPicker && (
      <Suspense fallback={null}><FeaturedPickerModal
        items={items}
        currentId={featuredItem?.id}
        onSelect={(it) => { onSetFeatured && onSetFeatured(it); setShowFeaturedPicker(false); }}
        onClear={() => { onSetFeatured && onSetFeatured(null); setShowFeaturedPicker(false); }}
        onClose={() => setShowFeaturedPicker(false)}
      /></Suspense>
    )}
    {cropSrc && (
      <Suspense fallback={null}><CropModal
        imageSrc={cropSrc}
        aspectRatio={cropType === "banner" ? 2 : 1}
        outputWidth={cropType === "banner" ? 1600 : undefined}
        title={cropType === "banner" ? "Recortar Banner" : "Recortar Avatar"}
        onSave={handleCropSave}
        onClose={() => { setCropSrc(null); setCropType(null); }}
      /></Suspense>
    )}
    </>
  );
}

