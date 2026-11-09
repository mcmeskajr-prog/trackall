import { useEffect, useMemo, useState } from "react";
import { ThemeContext, useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { TypeIcon } from "./TypeIcon";
import { CoverImg } from "./CoverImg";
import { FriendAvatar } from "./FriendAvatar";
import { BannerPageTint } from "./BannerHero";
import { ProfileStats } from "./ProfileStats";
import { ProfileTabCompletos } from "./ProfileTabCompletos";
import { ProfileTabDiario } from "./ProfileTabDiario";
import { TiltCard } from "./TiltCard";
import { ProfileCard } from "./ProfileCard";
import { ProfileActivity } from "./ProfileActivity";
import { ProfileEstatisticas } from "./ProfileEstatisticas";
import { RecentSection } from "./RecentSection";
import { ProfileHeaderPC } from "./ProfileHeaderPC";
import { FeaturedCardPC } from "./FeaturedCardPC";
import { DiaryRecent } from "./DiaryRecent";
import { MAX_FAVORITES_PER_TYPE } from "../config/limits";

const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

// ── Componentes estáveis (definidos fora para não remontarem a cada render) ──
function Star({ size = 10 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#fbbf24" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg>;
}

function Poster({ item, onOpen, darkMode, outline, badge }) {
  const src = item.customCover || item.cover || item.thumbnailUrl;
  return (
    <div className="recent-card" onClick={() => onOpen && onOpen(item)} title={item.title} style={{ minWidth: 0, cursor: onOpen ? "pointer" : "default" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", background: gradientFor(item.id),
        boxShadow: outline ? `0 0 0 2px ${outline}, 0 14px 24px -14px rgba(0,0,0,0.85)` : "0 14px 24px -14px rgba(0,0,0,0.85)" }}>
        {src ? <CoverImg hi src={src} alt={item.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff" }}><TypeIcon id={item.type} /></div>}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "46%", background: "linear-gradient(to top, rgba(0,0,0,0.82), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 7, fontSize: 11.5, fontWeight: 700, lineHeight: 1.25, color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", pointerEvents: "none" }}>{item.title}</div>
        {item.userRating > 0 && (
          <div style={{ position: "absolute", right: 6, top: 6, display: "flex", alignItems: "center", gap: 3, padding: "2px 7px 2px 5px", borderRadius: 8, background: "rgba(0,0,0,0.62)", color: "#fff", fontSize: 10.5, fontWeight: 800, pointerEvents: "none" }}><Star />{item.userRating}</div>
        )}
        {badge}
      </div>
    </div>
  );
}

function Section({ title, count, children, muted, accent, right }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, margin: 0 }}>{title}</h3>
        {count != null && <span style={{ fontSize: 10, fontWeight: 800, color: accent, background: `${accent}1c`, padding: "1px 8px", borderRadius: 20 }}>{count}</span>}
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)" }} />
        {right}
      </div>
      {children}
    </section>
  );
}

export function FriendProfile({ info, data, library, onBack, onRemove, onOpenItem }) {
  const theme = useTheme();
  const { darkMode, isMobileDevice, panelBg } = theme;
  const { lang } = useLang();
  const en = lang === "en";
  const prof = data.profile || {};
  const fAccent = isHex(prof.accent) ? prof.accent : theme.accent;
  const accent = fAccent;
  const [tab, setTab] = useState("perfil");
  const [favFilter, setFavFilter] = useState("all");
  // Layout escolhido pelo amigo no PC (guardado na conta dele); sem informação = novo. No telemóvel não há layout alternativo.
  const isV2 = !isMobileDevice && data.layout !== "classic";
  // Enquanto o perfil do amigo está aberto, a app usa o tema dele (fundo, wallpaper no PC, painéis); ao sair volta ao teu
  const { setFriendTheme } = theme;
  const fBgColor = (prof.bg_separate_devices && isMobileDevice ? prof.bg_color_mobile : prof.bg_color);
  useEffect(() => {
    if (!setFriendTheme) return undefined;
    setFriendTheme({
      bgColor: isHex(fBgColor) ? fBgColor : "#0d1117",
      bgImage: !isMobileDevice && typeof prof.bg_image === "string" ? prof.bg_image : "",
      overlay: prof.bg_overlay || "rgba(0,0,0,0.55)",
      blur: Number(prof.bg_blur) || 0,
      panelBg: isHex(prof.panel_bg) ? prof.panel_bg : "",
      panelOpacity: prof.panel_opacity ?? 100,
      accent: isHex(prof.accent) ? prof.accent : null,
    });
    return () => setFriendTheme(null);
    // eslint-disable-next-line
  }, [fBgColor, prof.bg_image, prof.bg_overlay, prof.bg_blur, prof.panel_bg, prof.panel_opacity, prof.accent, isMobileDevice]);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const libItems = useMemo(() => Object.values(data.library || {}), [data.library]);
  const name = prof.name || info?.name || prof.username || (en ? "User" : "Utilizador");
  const completed = useMemo(() => libItems.filter(i => i.userStatus === "completo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [libItems]);
  const inProgress = useMemo(() => libItems.filter(i => i.userStatus === "assistindo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [libItems]);
  const hall = useMemo(() => (data.hall || []).slice(0, 10).map(h => {
    const lib = data.library?.[h.id];
    return lib ? { ...h, userRating: lib.userRating ?? h.userRating } : h;
  }), [data.hall, data.library]);
  const featuredId = data.featured?.id;
  // Item em destaque do amigo (para o cartão grande no PC): biblioteca > Hall of Fame > o próprio registo
  const featuredItem = useMemo(() => {
    if (!featuredId) return null;
    const it = data.library?.[featuredId] || (data.hall || []).find(h => h.id === featuredId) || data.featured;
    return it && it.title ? it : null;
  }, [featuredId, data.library, data.hall, data.featured]);
  const favs = Array.isArray(prof.favorites) ? prof.favorites : [];

  // Em comum + afinidade (diferença média entre notas dadas ao mesmo título)
  const common = useMemo(() => {
    const out = [];
    libItems.forEach(fi => {
      const m = findLibraryEntry(library || {}, fi.id, fi.type)?.item;
      if (m) out.push({ fi, m });
    });
    const pairs = out.filter(({ fi, m }) => fi.userRating > 0 && m.userRating > 0);
    const affinity = pairs.length >= 3 ? Math.max(0, Math.round(100 - (pairs.reduce((a, { fi, m }) => a + Math.abs(fi.userRating - m.userRating), 0) / pairs.length) * 10)) : null;
    return { all: out, both: out.filter(({ fi, m }) => fi.userStatus === "completo" && m.userStatus === "completo"), affinity };
  }, [libItems, library]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)";
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || glass, borderRadius: 20, border: `1px solid ${line}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };
  const pad = isMobileDevice ? 16 : 0;

  const gridCols = isMobileDevice ? "repeat(3, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))";
  const openItem = (it) => onOpenItem && onOpenItem(it);

  const row = (list, cols = 15) => (
    <div className="hscroll" style={{ padding: "6px 4px 12px", margin: "-6px -4px -8px", gap: 12 }}>
      {list.slice(0, cols).map(it => <div key={it.id} style={{ width: isMobileDevice ? 104 : 124 }}><Poster item={it} onOpen={openItem} darkMode={darkMode} /></div>)}
    </div>
  );

  const hofBlock = hall.length > 0 && (
    <Section title="Hall of Fame" count={`${hall.length}/10`} muted={muted} accent={accent}>
      {isMobileDevice ? (
        <div className="hscroll" style={{ padding: "4px 16px 14px", margin: "0 -16px", gap: 10, display: "grid", gridTemplateRows: "repeat(2, auto)", gridAutoFlow: "column", gridAutoColumns: "clamp(104px, 29vw, 128px)" }}>
          {hall.map(h => <Poster key={h.id} item={h} onOpen={openItem} darkMode={darkMode} outline={h.id === featuredId ? accent : null}
            badge={h.id === featuredId ? <div title={en ? "Featured" : "Em destaque"} aria-label={en ? "Featured" : "Em destaque"} style={{ position: "absolute", left: 6, top: 6, width: 20, height: 20, borderRadius: 7, background: accent, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg></div> : null} />)}
        </div>
      ) : (
        <div style={{ display: "grid", ...(hall.length <= 5
          // Poucos títulos: capas com tamanho normal, centradas (não encolhem nem ficam coladas à esquerda)
          ? { gridTemplateColumns: `repeat(${hall.length}, minmax(0, ${hall.length <= 4 ? 190 : 170}px))`, justifyContent: "center", gap: 18 }
          : { gridTemplateColumns: `repeat(${hall.length <= 6 ? 6 : hall.length <= 8 ? 4 : 5}, minmax(0, 1fr))`, gap: 14 }), padding: "6px 4px 10px", margin: "-6px -4px -10px" }}>
          {hall.map(h => <Poster key={h.id} item={h} onOpen={openItem} darkMode={darkMode} outline={h.id === featuredId ? accent : null}
            badge={h.id === featuredId ? <div title={en ? "Featured" : "Em destaque"} aria-label={en ? "Featured" : "Em destaque"} style={{ position: "absolute", left: 6, top: 6, width: 20, height: 20, borderRadius: 7, background: accent, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg></div> : null} />)}
        </div>
      )}
    </Section>
  );

  const favByType = {};
  favs.forEach(f => { (favByType[f.type] = favByType[f.type] || []).push(f); });
  const favTypes = MEDIA_TYPES.slice(1).filter(t => favByType[t.id]?.length);

  const tabs = [
    { id: "perfil", label: en ? "Profile" : "Perfil" },
    { id: "completos", label: en ? "Completed" : "Completos" },
    { id: "diario", label: en ? "Diary" : "Diário" },
  ];

  const pdm = theme.panelDark ?? darkMode;
  const cardProfile = { name, bio: prof.bio, banner: prof.banner, hideBannerMobile: prof.hide_banner_mobile };
  const matchPill = common.all.length > 0 ? (
    <div style={{ display: "inline-flex", alignSelf: isMobileDevice ? "center" : "flex-start", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 14, background: `${accent}18`, border: `1px solid ${accent}44`, fontSize: 12.5, fontWeight: 700, color: text }}>
      {common.affinity != null && <span style={{ color: accent, fontSize: 20, fontWeight: 800 }}>{common.affinity}%</span>}
      <span style={{ color: muted, fontWeight: 600 }}>{common.affinity != null ? (en ? "taste match · " : "afinidade · ") : ""}{common.all.length} {en ? "in common" : "em comum"}</span>
    </div>
  ) : null;
  const friendCard = (
    <ProfileCard profile={cardProfile} avatar={prof.avatar || info?.avatar} items={libItems} library={data.library || {}} featuredItem={featuredItem} onOpen={openItem} />
  );

  // ── PC: o mesmo esqueleto do perfil próprio ──
  const h3 = { fontSize: 20, fontWeight: 800, color: text, margin: 0 };
  const hofPC = (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 style={h3}>Hall of Fame</h3>
        <span style={{ fontSize: 12, color: muted }}>{hall.length}/10 {en ? "titles" : "obras"}</span>
      </div>
      {hall.length === 0 ? (
        <div style={{ border: `1px dashed ${line}`, borderRadius: 12, padding: 16, textAlign: "center", color: muted, fontSize: 13 }}>{en ? "No titles in the Hall of Fame yet." : "Ainda sem obras no Hall of Fame."}</div>
      ) : (
        <div style={isV2
          ? { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 190px))", justifyContent: hall.length >= 5 ? "space-between" : "start", gap: 14 }
          : { "--hof-h": "clamp(180px, calc((100vh - 450px) / 2), 300px)", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, calc(var(--hof-h) * 5 / 7)))", justifyContent: "space-between", gap: 14 }}>
          {hall.map(h => {
            const src = h.customCover || h.cover;
            const score = h.userRating ?? 0;
            return (
              <div key={h.id} className="hof-card" onClick={() => openItem(h)} title={h.title} style={{ cursor: "pointer", minWidth: 0 }}>
                <TiltCard maxTilt={8} glare glareOpacity={0.12} style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", background: darkMode ? "#11151b" : "#e2e8f0",
                  boxShadow: "0 18px 30px -16px rgba(0,0,0,0.8)" }}>
                  {src ? <CoverImg hi src={src} alt={h.title} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                    : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: 10, fontSize: 13, fontWeight: 800, color: "white", lineHeight: 1.2 }}>{h.title}</div>}
                  {score > 0 && <div style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px 3px 6px", borderRadius: 8, background: "rgba(0,0,0,0.6)", color: "#fbcfe8", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><Star size={10} />{score}</div>}
                  {h.id === featuredId && <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", boxShadow: `inset 0 0 0 2px ${accent}`, pointerEvents: "none", zIndex: 3 }} />}
                </TiltCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  const favEff = favFilter !== "all" && !favTypes.some(t => t.id === favFilter) ? "all" : favFilter;
  const favsPC = favTypes.length > 0 && (
    <div style={{ marginBottom: isV2 ? 0 : 28 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={h3}>{en ? "Favorites" : "Favoritos"}</h3>
          <span style={{ fontSize: 12, color: muted }}>{favs.length}</span>
        </div>
        {isV2 && favTypes.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {[{ id: "all" }, ...favTypes].map(t => {
              const on = favEff === t.id;
              return <button key={t.id} type="button" onClick={() => setFavFilter(t.id)} style={{ minHeight: 34, padding: "0 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${on ? accent : line}`, background: on ? accent : "transparent", color: on ? "white" : muted }}>{t.id === "all" ? (en ? "All" : "Tudo") : mediaLabel(t, lang)}</button>;
            })}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {(favEff === "all" ? favTypes : favTypes.filter(t => t.id === favEff)).map(t => (
          <div key={t.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted }}>
              {mediaLabel(t, lang)}<span style={{ fontWeight: 600, opacity: 0.7 }}>{favByType[t.id].length}/{MAX_FAVORITES_PER_TYPE}</span>
              <span style={{ flex: 1, height: 1, background: line }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${MAX_FAVORITES_PER_TYPE}, minmax(0, 1fr))`, gap: isV2 ? 12 : 14, padding: "6px 4px 10px", margin: "-6px -4px -10px" }}>
              {favByType[t.id].slice(0, MAX_FAVORITES_PER_TYPE).map(f => <Poster key={f.id} item={{ ...f, userRating: data.library?.[f.id]?.userRating ?? f.userRating }} onOpen={openItem} darkMode={darkMode} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  const bothPC = common.both.length > 0 && (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 style={h3}>{en ? "Completed by both" : "Completos por ambos"}</h3>
        <span style={{ fontSize: 12, color: muted }}>{common.both.length}</span>
      </div>
      <div className="hscroll" style={{ padding: "6px 4px 12px", margin: "-6px -4px -8px", gap: 12 }}>
        {common.both.slice(0, 15).map(({ fi, m }) => (
          <div key={fi.id} style={{ width: 124 }}>
            <Poster item={fi} onOpen={openItem} darkMode={darkMode}
              badge={m.userRating > 0 && fi.userRating > 0 && m.userRating !== fi.userRating ? (
                <div style={{ position: "absolute", left: 6, top: 6, padding: "2px 7px", borderRadius: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 800, pointerEvents: "none" }}>{en ? "you" : "tu"} ★{m.userRating}</div>
              ) : null} />
          </div>
        ))}
      </div>
    </div>
  );
  const perfilPC = (
    <>
      <div style={{ display: "flex", flexDirection: "row", gap: 32, alignItems: "stretch" }}>
        <div style={{ width: 330, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {friendCard}
          {matchPill}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ margin: "0 -16px" }}><ProfileStats items={libItems} panelBg={panelBg} /></div>
          {hofPC}
          {libItems.length > 0 && <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" }}><ProfileActivity items={libItems} accent={accent} darkMode={pdm} isMobile={false} lang={lang} panelBg={panelBg} onOpen={openItem} /></div>}
        </div>
      </div>
      <div style={{ marginTop: 28 }}>
        <RecentSection items={libItems} onOpen={openItem} showDiary={false} />
        {favsPC}
        {bothPC}
        <div style={{ marginBottom: 28 }}><ProfileEstatisticas items={libItems} panelBg={panelBg} /></div>
      </div>
    </>
  );

  // ── PC, layout novo: igual ao teu perfil (cabeçalho com banner, números, duas colunas) ──
  const panelV2 = { borderRadius: 16, padding: 20, boxSizing: "border-box", background: panelBg || (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)"), border: `1px solid ${line}` };
  const eyebrowV2 = { fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#8b95a1" : "#64748b", margin: 0 };
  const topGenresV2 = (() => {
    const cnt = {};
    completed.forEach(i => (i.genres || []).forEach(g => { cnt[g] = (cnt[g] || 0) + 1; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!top.length) return null;
    const mx = top[0][1];
    return (
      <div style={{ borderRadius: 20, padding: "16px 18px", background: panelBg || (darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"), border: `1px solid ${line}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8b949e", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px" }}>
          {en ? "TOP GENRES" : "TOP GÉNEROS"}
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {top.map(([g, c], idx) => {
            const alpha = Math.max(20, Math.round((c / mx) * 100));
            return (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5, background: `${accent}${alpha.toString(16).padStart(2, "0")}`, border: `1px solid ${accent}${Math.round(alpha * 1.5).toString(16).padStart(2, "0")}`, borderRadius: 20, padding: idx === 0 ? "5px 12px" : "4px 10px" }}>
                <span style={{ fontSize: idx === 0 ? 14 : idx < 3 ? 13 : 12, fontWeight: idx < 3 ? 800 : 600, color: idx === 0 ? accent : (darkMode ? "#c9d1d9" : "#374151") }}>{g}</span>
                <span style={{ fontSize: 10, color: accent, fontWeight: 700, opacity: 0.8 }}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  })();
  const cursoV2 = inProgress.slice(0, 2);
  const favRowsV2 = favEff === "all" ? Math.max(1, favTypes.length) : 1;
  const diaryCountV2 = Math.min(15, 5 + 5 * (favRowsV2 - 1));
  const perfilV2 = (
    <div style={{ padding: "4px 32px 0", maxWidth: 1600, margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ margin: "0 0 14px" }}><ProfileStats compact items={libItems} panelBg={panelBg} /></div>
      <style>{`.pv2-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;align-items:start}.pv2-aside{display:flex;flex-direction:column;gap:14px}@media (max-width:1180px){.pv2-grid{grid-template-columns:minmax(0,1fr)}.pv2-aside{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.pv2-aside>*:first-child{grid-column:1 / -1}}`}</style>
      <div className="pv2-grid">
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {hofPC}
          {favsPC}
          <RecentSection items={libItems} onOpen={openItem} showDiary={false} part="recent" compactHead />
          {bothPC}
        </div>
        <div className="pv2-aside">
          <FeaturedCardPC featuredItem={featuredItem} library={data.library || {}} items={libItems} onOpen={openItem} readOnly />
          {matchPill}
          {cursoV2.length > 0 && (
            <div style={panelV2}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <h3 style={eyebrowV2}>{en ? "In progress" : "Em curso"}</h3>
                <span style={{ fontSize: 12, color: muted, fontWeight: 700 }}>{inProgress.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {cursoV2.map(it => (
                  <div key={it.id} onClick={() => openItem(it)} style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer", minWidth: 0 }}>
                    <div style={{ width: 34, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: gradientFor(it.id) }}>
                      {(it.customCover || it.cover) && <CoverImg hi src={it.customCover || it.cover} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: text }}>{it.title}</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(MEDIA_TYPES.find(t => t.id === it.type) ? mediaLabel(MEDIA_TYPES.find(t => t.id === it.type), lang) : "")}{it.lastChapter ? ` · ${String(it.lastChapter).replace(/chapter /i, "Cap. ").replace(/vol\.\d+\s*/i, "")}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ProfileActivity items={libItems} accent={accent} darkMode={pdm} compact lang={lang} panelBg={panelBg} onOpen={openItem} />
          {topGenresV2}
          <DiaryRecent items={libItems} count={diaryCountV2} onOpen={openItem} onSeeAll={() => setTab("diario")} />
        </div>
      </div>
      <div style={{ marginTop: 28, marginBottom: 28 }}><ProfileEstatisticas items={libItems} panelBg={panelBg} /></div>
    </div>
  );

  return (
    <ThemeContext.Provider value={{ ...theme, accent: fAccent }}>
      <div style={{ maxWidth: isMobileDevice ? 600 : (isV2 ? "100%" : 1500), margin: "0 auto", padding: isMobileDevice ? "12px 0 28px" : (isV2 ? "24px 0 40px" : "24px 28px 40px"), color: text, position: "relative", isolation: "isolate" }}>
        {isMobileDevice && prof.banner && !prof.hide_banner_mobile && <BannerPageTint banner={prof.banner} />}
        {/* Barra de topo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isV2 ? "0 32px" : `0 ${pad}px`, marginBottom: 14, ...(isV2 ? { maxWidth: 1600, marginLeft: "auto", marginRight: "auto", boxSizing: "border-box" } : {}) }}>
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px 7px 10px", borderRadius: 999, border: `1px solid ${line}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>{en ? "Friends" : "Amigos"}
          </button>
          {confirmRemove ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: muted }}>{en ? "Remove friend?" : "Remover amigo?"}</span>
              <button onClick={onRemove} style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid #ef444466", background: "#ef444422", color: "#f87171", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{en ? "Remove" : "Remover"}</button>
              <button onClick={() => setConfirmRemove(false)} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${line}`, background: "transparent", color: muted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${line}`, background: "transparent", color: muted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{en ? "Remove friend" : "Remover amigo"}</button>
          )}
        </div>

        {isV2 && <ProfileHeaderPC profile={cardProfile} avatar={prof.avatar || info?.avatar} items={libItems} panelBg={panelBg} />}

        {/* Telemóvel: o mesmo cartão do perfil próprio; no PC o cartão vive na coluna esquerda do separador Perfil */}
        {isMobileDevice && tab === "perfil" && <div style={{ marginBottom: 14 }}>{friendCard}{matchPill && <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>{matchPill}</div>}</div>}

        {/* Separadores */}
        <div style={{ display: "flex", gap: 4, margin: `0 ${pad}px 20px`, borderBottom: `1px solid ${line}`, ...(isV2 ? { maxWidth: 1600, marginLeft: "auto", marginRight: "auto", padding: "16px 32px 0", boxSizing: "border-box" } : {}) }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: isMobileDevice ? "10px 14px" : "11px 20px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? accent : "transparent"}`, marginBottom: -1, color: tab === t.id ? accent : muted, fontFamily: "inherit", fontSize: 13, fontWeight: tab === t.id ? 800 : 600, cursor: "pointer" }}>{t.label}</button>
          ))}
        </div>

        {tab === "perfil" && !isMobileDevice && (
          libItems.length === 0
            ? <div style={{ ...card, padding: "40px 20px", textAlign: "center", color: muted, fontSize: 14 }}>{en ? "This library is empty (or private)." : "Esta biblioteca está vazia (ou privada)."}</div>
            : (isV2 ? perfilV2 : perfilPC)
        )}
        {tab === "perfil" && isMobileDevice && (
          <div style={{ padding: `0 ${pad}px` }}>
            {libItems.length === 0 ? (
              <div style={{ ...card, padding: "40px 20px", textAlign: "center", color: muted, fontSize: 14 }}>{en ? "This library is empty (or private)." : "Esta biblioteca está vazia (ou privada)."}</div>
            ) : (
              <>
                <div style={{ marginBottom: 26 }}><ProfileStats items={libItems} panelBg={panelBg} /></div>
                {hofBlock}
                {completed.length > 0 && <Section title={en ? "Completed" : "Completados"} count={completed.length} muted={muted} accent={accent}>{row(completed, 15)}</Section>}
                {inProgress.length > 0 && <Section title={en ? "In progress" : "Em curso"} count={inProgress.length} muted={muted} accent={accent}>{row(inProgress, 15)}</Section>}
                {common.both.length > 0 && (
                  <Section title={en ? "Completed by both" : "Completos por ambos"} count={common.both.length} muted={muted} accent={accent}>
                    <div className="hscroll" style={{ padding: "6px 4px 12px", margin: "-6px -4px -8px", gap: 12 }}>
                      {common.both.slice(0, 15).map(({ fi, m }) => (
                        <div key={fi.id} style={{ width: isMobileDevice ? 104 : 124 }}>
                          <Poster item={fi} onOpen={openItem} darkMode={darkMode}
                            badge={m.userRating > 0 && fi.userRating > 0 && m.userRating !== fi.userRating ? (
                              <div style={{ position: "absolute", left: 6, top: 6, padding: "2px 7px", borderRadius: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 800, pointerEvents: "none" }}>{en ? "You" : "Tu"} ★{m.userRating}</div>
                            ) : null} />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {favTypes.length > 0 && (
                  <Section title={en ? "Favorites" : "Favoritos"} count={favs.length} muted={muted} accent={accent}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {favTypes.map(t => (
                        <div key={t.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: text, marginBottom: 9 }}>
                            <TypeIcon id={t.id} />{mediaLabel(t, lang)}<span style={{ color: muted, fontWeight: 600 }}>{favByType[t.id].length}</span>
                          </div>
                          {isMobileDevice ? row(favByType[t.id], 24) : (
                            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, padding: "6px 4px 10px", margin: "-6px -4px -10px" }}>
                              {favByType[t.id].slice(0, 12).map(f => <Poster key={f.id} item={f} onOpen={openItem} darkMode={darkMode} />)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        )}
        {tab === "completos" && (
          <div style={isV2 ? { maxWidth: 1600, margin: "0 auto", padding: "0 32px", boxSizing: "border-box" } : undefined}><ProfileTabCompletos items={libItems} library={data.library} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={openItem} /></div>
        )}
        {tab === "diario" && (
          <div style={isV2 ? { maxWidth: 1600, margin: "0 auto", padding: "0 32px", boxSizing: "border-box" } : undefined}><ProfileTabDiario items={libItems} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={openItem} /></div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}
