import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor, hiRes } from "../lib/utils";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { TiltCard } from "./TiltCard";
import { TypeIcon } from "./TypeIcon";
import { splitBanner, bannerFilter } from "../lib/bannerColors";
import higanLine from "../assets/higan-line.webp";

// ─── Cartão de perfil (Fase 1 do redesign) ───
// Cartão de vidro com o item em destaque (tilt + brilho que segue o rato), nome, bio e ações.
// Só aparece em modo de visualização; a edição continua no cabeçalho do ProfileView.
export function ProfileCard({ profile, avatar, items, library, featuredItem, userEmail, hideEmail, onOpen, onEdit, onPersonalize, onSignOut, onPickFeatured, onFilter }) {
  const { accent, darkMode: pageDark, panelDark, isMobileDevice, panelBg } = useTheme();
  const darkMode = panelDark ?? pageDark; // o cartão é um painel: o texto segue a cor do painel
  const { lang } = useLang();

  // Item em destaque: o escolhido; se não houver, o favorito mais bem avaliado.
  const featured = useMemo(() => {
    if (featuredItem) {
      const lib = findLibraryEntry(library, featuredItem.id, featuredItem.type)?.item;
      return { ...featuredItem, ...(lib || {}), userRating: lib?.userRating ?? featuredItem.userRating ?? 0 };
    }
    const rated = (items || []).filter(i => i.userRating > 0);
    if (!rated.length) return null;
    return [...rated].sort((a, b) => (b.userRating - a.userRating) || ((b.addedAt || 0) - (a.addedAt || 0)))[0];
  }, [featuredItem, items, library]);

  // Números do cabeçalho compacto (telemóvel): itens, completados, média + mini-histograma de notas
  const mini = useMemo(() => {
    const list = items || [];
    const rated = list.filter(i => i.userRating > 0);
    const hist = Array.from({ length: 20 }, () => 0);
    rated.forEach(i => { hist[Math.min(20, Math.max(1, Math.round(i.userRating * 2))) - 1] += 1; });
    return {
      total: list.length,
      completed: list.filter(i => i.userStatus === "completo").length,
      avg: rated.length ? (rated.reduce((a, i) => a + i.userRating, 0) / rated.length).toFixed(1) : "—",
      inProgress: list.filter(i => i.userStatus === "assistindo").length,
      hist, histMax: Math.max(1, ...hist), hasRatings: rated.length > 0,
    };
  }, [items]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const typeDef = featured ? MEDIA_TYPES.find(t => t.id === featured.type) : null;
  const coverSrc = featured ? (featured.customCover || featured.cover) : null;
  const count = (items || []).length;

  const avatarSize = isMobileDevice ? 92 : 104;

  // Telemóvel: cartão compacto numa linha (o destaque vive no Hall of Fame, ver ProfileView)
  if (isMobileDevice) {
    const iconBtn = { width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: text, border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.18)"}` };
    const divider = darkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.1)";
    const stats = [
      { n: mini.total, l: lang === "en" ? "items" : "itens", f: {}, c: text },
      { n: mini.completed, l: lang === "en" ? "completed" : "completados", f: { status: "completo" }, c: text },
      { n: mini.avg, l: lang === "en" ? "average" : "média", f: { rating: "rated", sort: "rating" }, c: "#fbbf24" },
      { n: mini.inProgress, l: lang === "en" ? "in progress" : "em curso", f: { status: "assistindo" }, c: text },
    ];
    const featRow = featured ? (
      <button type="button" onClick={() => onOpen && onOpen(featured)} style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 8, borderRadius: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: text, boxSizing: "border-box",
        background: `linear-gradient(90deg, ${accent}22, ${darkMode ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)"})`, border: `1px solid ${accent}55` }}>
        <div style={{ width: 48, height: 70, borderRadius: 9, overflow: "hidden", flexShrink: 0, position: "relative", background: gradientFor(featured.id) }}>
          {coverSrc && <img src={hiRes(coverSrc)} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { if (e.currentTarget.src !== coverSrc && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = coverSrc; } else { e.currentTarget.style.display = "none"; } }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>{lang === "en" ? "Featured" : "Em destaque"}{typeDef ? ` · ${mediaLabel(typeDef, lang)}` : ""}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{featured.title}</div>
        </div>
        {featured.userRating > 0 && <div style={{ fontSize: 12.5, color: "#fbbf24", fontWeight: 800, marginRight: 6, flexShrink: 0 }}>★ {featured.userRating}</div>}
      </button>
    ) : (onPickFeatured ? (
      <button type="button" onClick={onPickFeatured} style={{ marginTop: 12, width: "100%", minHeight: 60, borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: sub, background: "transparent", border: `1.5px dashed ${darkMode ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.25)"}` }}>
        {lang === "en" ? "+ Choose your featured item" : "+ Escolhe o teu item em destaque"}
      </button>
    ) : null);
    // Com banner: perfil sem moldura. Banner a toda a largura que se dissolve no fundo, faixas planas com linhas finas.
    if (profile.banner && !profile.hideBannerMobile) {
      const { url: bUrl, style: bst } = splitBanner(profile.banner);
      const filt = bannerFilter(bst);
      const mask = "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.65) 78%, transparent 100%)";
      const ring = darkMode ? "#0b0d12" : "#ffffff";
      const outBtn = (c) => ({ flex: 1, height: 44, borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: c === accent ? `${accent}14` : "transparent", color: accent, border: `1.5px solid ${c}` });
      return (
        <div style={{ color: text }}>
          <div style={{ position: "relative", height: 236 }}>
            {bUrl && <img src={bUrl} alt="" decoding="async" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none", filter: filt, WebkitMaskImage: mask, maskImage: mask }} />}
          </div>
          <div style={{ position: "relative", marginTop: -60, padding: "0 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ position: "relative", width: 86, height: 86 }}>
              <div style={{ width: 86, height: 86, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 0 0 3px ${ring}, 0 0 0 5.5px ${accent}, 0 8px 28px ${accent}55`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 34, color: "#fff" }}>
                {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.name || "?").charAt(0).toUpperCase()}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginTop: 14, overflowWrap: "anywhere" }}>{profile.name || (lang === "en" ? "User" : "Utilizador")}</div>
            {profile.bio && <div style={{ fontSize: 13.5, color: sub, marginTop: 5, lineHeight: 1.4 }}>{profile.bio}</div>}
          </div>
          <div style={{ display: "flex", margin: "18px 0 0", borderTop: `1px solid ${divider}`, borderBottom: `1px solid ${divider}` }}>
            {stats.map((st, i) => (
              <button key={st.l} type="button" onClick={() => onFilter && onFilter(st.f)} style={{ flex: 1, minHeight: 60, textAlign: "center", background: "none", border: "none", borderLeft: i ? `1px solid ${divider}` : "none", padding: "10px 0", color: "inherit", font: "inherit", cursor: onFilter ? "pointer" : "default" }}>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: st.l === "média" || st.l === "average" ? "#fbbf24" : text }}>{st.n}</div>
                <div style={{ fontSize: 11, color: sub, marginTop: 5 }}>{st.l}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "14px 16px 0" }}>
            <button onClick={onEdit} style={outBtn(accent)}>{lang === "en" ? "Edit profile" : "Editar perfil"}</button>
            {onPersonalize && <button onClick={onPersonalize} style={outBtn(divider)}>{lang === "en" ? "Customise" : "Personalizar"}</button>}
            {onSignOut && (
              <button onClick={onSignOut} aria-label={lang === "en" ? "Sign out" : "Terminar sessão"} style={{ ...iconBtn, color: sub }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            )}
          </div>
          {featRow && <div style={{ padding: "0 16px" }}>{featRow}</div>}
        </div>
      );
    }
    return (
      <>
      <div style={{ padding: 16, borderRadius: 18, color: text, boxSizing: "border-box",
        background: panelBg ? panelBg : (darkMode ? "rgba(12,12,16,0.7)" : "rgba(255,255,255,0.85)"),
        border: `1px solid ${divider}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
            boxShadow: `0 0 0 3px ${darkMode ? "#0a0c10" : "#ffffff"}, 0 0 0 5px ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22, color: "white" }}>
            {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.name || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || (lang === "en" ? "User" : "Utilizador")}</div>
            {profile.bio && <div style={{ fontSize: 12, color: sub, marginTop: 3, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{profile.bio}</div>}
          </div>
          <button onClick={onEdit} aria-label={lang === "en" ? "Edit profile" : "Editar perfil"} style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          </button>
          {onSignOut && (
            <button onClick={onSignOut} aria-label={lang === "en" ? "Sign out" : "Terminar sessão"} style={{ ...iconBtn, color: sub }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          )}
        </div>

        {/* Números (cada um abre a Biblioteca filtrada) */}
        <div style={{ display: "flex", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${divider}` }}>
          {stats.map((st, i) => (
            <button key={st.l} type="button" onClick={() => onFilter && onFilter(st.f)} style={{ flex: 1, minHeight: 44, textAlign: "center", background: "none", border: "none", borderLeft: i ? `1px solid ${divider}` : "none", padding: "2px 0", color: "inherit", font: "inherit", cursor: onFilter ? "pointer" : "default" }}>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: st.c }}>{st.n}</div>
              <div style={{ fontSize: 11.5, color: sub, marginTop: 5 }}>{st.l}</div>
            </button>
          ))}
        </div>
      </div>
      {featRow}
      </>
    );
  }

  return (
    <div style={{
      borderRadius: 26, padding: isMobileDevice ? 16 : 22, position: "relative", overflow: "hidden",
      background: panelBg ? panelBg : darkMode
        ? "linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0.004)), rgba(9,11,15,0.84)"
        : "linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))",
      border: `1px solid ${darkMode ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.1)"}`,
      boxShadow: "0 30px 50px -24px rgba(0,0,0,0.7)",
      backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", color: text,
      display: "flex", flexDirection: "column", boxSizing: "border-box", flex: isMobileDevice ? undefined : 1, isolation: "isolate",
    }}>
      {/* Decoração: higanbana só em traço, na cor de destaque, por trás do conteúdo (canto superior esquerdo) */}
      {!isMobileDevice && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit",
          WebkitMaskImage: "linear-gradient(180deg, #000 40%, transparent 100%)", maskImage: "linear-gradient(180deg, #000 40%, transparent 100%)" }}>
          <div style={{ position: "absolute", left: -30, top: -10, width: 210, height: 336, transform: "scaleX(-1)", opacity: darkMode ? 0.55 : 0.5, background: accent,
            WebkitMask: `url(${JSON.stringify(higanLine)}) no-repeat center / contain`, mask: `url(${JSON.stringify(higanLine)}) no-repeat center / contain` }} />
        </div>
      )}
      {/* Identidade: avatar com presença + nome, centrados */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
          background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
          boxShadow: `0 0 0 4px ${darkMode ? "#0a0c10" : "#ffffff"}, 0 0 0 7px ${accent}, 0 0 36px 2px ${accent}88, 0 14px 30px rgba(0,0,0,0.55)`,
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: avatarSize * 0.4, color: "white",
        }}>
          {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.name || "?").charAt(0).toUpperCase()}
        </div>
        <h2 style={{ fontSize: isMobileDevice ? 26 : 30, fontWeight: 800, lineHeight: 1.1, margin: "18px 0 0", overflowWrap: "anywhere" }}>{profile.name || (lang === "en" ? "User" : "Utilizador")}</h2>
        {profile.bio && <p style={{ fontSize: 13, color: sub, margin: "8px 0 0", lineHeight: 1.5 }}>{profile.bio}</p>}
      </div>

      {/* Item em destaque */}
      {featured ? (
        <div style={{ position: "relative", marginBottom: 14, ...(isMobileDevice ? {} : { flex: "1 1 0", display: "flex", flexDirection: "column", minHeight: 280 }) }}>
        <div onClick={() => onOpen && onOpen(featured)} style={{ cursor: "pointer", ...(isMobileDevice ? {} : { flex: "1 1 0", display: "flex", flexDirection: "column", minHeight: 0 }) }}>
          <TiltCard maxTilt={8} scale={1} glare glareOpacity={0.03} style={{
            ...(isMobileDevice ? { aspectRatio: "2/3" } : { flex: "1 1 0", minHeight: 0 }), borderRadius: 16, overflow: "hidden",
            background: gradientFor(featured.id),
            boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 18px 30px -12px rgba(0,0,0,0.7)",
          }}>
            {coverSrc
              ? <img src={hiRes(coverSrc)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", filter: "brightness(0.9)" }} onError={e => { if (e.currentTarget.src !== coverSrc && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = coverSrc; } else { e.currentTarget.style.display = "none"; } }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}><TypeIcon id={typeDef?.id} /></div>}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0) 42%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 16, pointerEvents: "none", color: "white" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.8 }}>{lang === "en" ? "Featured" : "Em destaque"}{typeDef ? ` · ${mediaLabel(typeDef, lang)}` : ""}</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{featured.title}</div>
            </div>
            {featured.userRating > 0 && (
              <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", borderRadius: 9, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 12, fontWeight: 800 }}>★ {featured.userRating}</div>
            )}
          </TiltCard>
        </div>
        {onPickFeatured && (
          <button onClick={(e) => { e.stopPropagation(); onPickFeatured(); }} aria-label={lang === "en" ? "Change featured item" : "Trocar item em destaque"} title={lang === "en" ? "Change featured item" : "Trocar item em destaque"}
            style={{ position: "absolute", top: 8, left: 8, width: 44, height: 44, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></svg>
            </span>
          </button>
        )}
        </div>
      ) : (
        <div onClick={onPickFeatured || undefined} style={{ cursor: onPickFeatured ? "pointer" : "default", aspectRatio: "2/3", borderRadius: 16, border: `1.5px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20, color: sub, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          {lang === "en" ? "Pick a featured item to show on your profile" : "Escolhe um item em destaque para mostrar no teu perfil"}
        </div>
      )}

      {userEmail && !hideEmail && <p style={{ fontSize: 12, color: darkMode ? "#6e7681" : "#64748b", margin: "0 0 10px", overflowWrap: "anywhere", textAlign: "center" }}>✉ {userEmail}</p>}

      {/* Ações */}
      <div style={{ display: "flex", gap: 10, marginTop: 0 }}>
        <button onClick={onEdit} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "none", background: accent, color: "white", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700 }}>
          {lang === "en" ? "Edit profile" : "Editar perfil"}
        </button>
        {onSignOut && (
          <button onClick={onSignOut} aria-label={lang === "en" ? "Sign out" : "Terminar sessão"} style={{ width: 44, minHeight: 44, borderRadius: 12, border: `1px solid ${darkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)"}`, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)", color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
