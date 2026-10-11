import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor, hiRes } from "../lib/utils";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { TiltCard } from "./TiltCard";

// ─── Cartão de perfil (Fase 1 do redesign) ───
// Cartão de vidro com o item em destaque (tilt + brilho que segue o rato), nome, bio e ações.
// Só aparece em modo de visualização; a edição continua no cabeçalho do ProfileView.
export function ProfileCard({ profile, avatar, items, library, featuredItem, userEmail, hideEmail, onOpen, onEdit, onSignOut, onPickFeatured }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
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

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const typeDef = featured ? MEDIA_TYPES.find(t => t.id === featured.type) : null;
  const coverSrc = featured ? (featured.customCover || featured.cover) : null;
  const count = (items || []).length;

  const avatarSize = isMobileDevice ? 92 : 104;

  return (
    <div style={{
      borderRadius: 26, padding: isMobileDevice ? 16 : 22, position: "relative", overflow: "hidden",
      background: darkMode
        ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)"
        : "linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))",
      border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)"}`,
      boxShadow: "0 30px 50px -24px rgba(0,0,0,0.7)",
      backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", color: text,
      display: "flex", flexDirection: "column", boxSizing: "border-box", flex: isMobileDevice ? undefined : 1,
    }}>
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
        <div style={{ fontSize: 12, color: sub, marginTop: 4, letterSpacing: "0.04em" }}>TrackAll · {count} {lang === "en" ? "items" : "itens"}</div>
        {profile.bio && <p style={{ fontSize: 13, color: sub, margin: "8px 0 0", lineHeight: 1.5 }}>{profile.bio}</p>}
      </div>

      {/* Item em destaque */}
      {featured ? (
        <div style={{ position: "relative", marginBottom: 14, ...(isMobileDevice ? {} : { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }) }}>
        <div onClick={() => onOpen && onOpen(featured)} style={{ cursor: "pointer", ...(isMobileDevice ? {} : { flex: 1, display: "flex", flexDirection: "column" }) }}>
          <TiltCard maxTilt={8} scale={1} glare glareOpacity={0.06} style={{
            ...(isMobileDevice ? { aspectRatio: "2/3" } : { flex: 1, minHeight: 400 }), borderRadius: 16, overflow: "hidden",
            background: gradientFor(featured.id),
            boxShadow: "0 0 0 1px rgba(255,255,255,0.14), 0 18px 30px -12px rgba(0,0,0,0.7)",
          }}>
            {coverSrc
              ? <img src={hiRes(coverSrc)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", filter: "brightness(0.9)" }} onError={e => { if (e.currentTarget.src !== coverSrc && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = coverSrc; } else { e.currentTarget.style.display = "none"; } }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{typeDef?.icon}</div>}
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
