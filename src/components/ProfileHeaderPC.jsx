import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { splitBanner, bannerFilter, bannerFit } from "../lib/bannerColors";

// Cabeçalho do perfil no PC (layout novo): banner largo com engrenagem, avatar por cima, nome, números e «Editar perfil».
export function ProfileHeaderPC({ profile, avatar, items, userEmail, hideEmail, onEdit, onSettings, onFilter, panelBg = null }) {
  const { accent, darkMode: pageDark, panelDark } = useTheme();
  const darkMode = panelDark ?? pageDark;
  const { lang } = useLang();
  const en = lang === "en";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const sub = darkMode ? "#aab4c0" : "#475569";
  const line = darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.14)";
  const { url, style: bst } = splitBanner(profile.banner);
  const filt = bannerFilter(bst);
  const mask = "linear-gradient(180deg, #000 0%, #000 45%, rgba(0,0,0,0.6) 75%, transparent 100%)";

  return (
    <div style={{ position: "relative", color: text }}>
      <div style={{ position: "relative", height: 110, overflow: "hidden", background: url ? "transparent" : `linear-gradient(135deg, ${accent}66, ${accent}18)` }}>
        {url && <img src={url} alt="" decoding="async" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...bannerFit(bst), filter: filt, WebkitMaskImage: mask, maskImage: mask, pointerEvents: "none" }} />}
        {!url && <div aria-hidden="true" style={{ position: "absolute", inset: 0, WebkitMaskImage: mask, maskImage: mask, background: `radial-gradient(circle at 78% 30%, ${accent}33, transparent 55%)` }} />}
        {onSettings && (
          <button type="button" onClick={onSettings} aria-label={en ? "Settings" : "Definições"} title={en ? "Settings" : "Definições"}
            style={{ position: "absolute", top: 16, right: 20, width: 36, height: 36, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#e6edf3", background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.16)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 22, padding: "0 32px", position: "relative", flexWrap: "wrap", maxWidth: 1600, margin: "-44px auto 0", boxSizing: "border-box" }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 0 0 4px ${darkMode ? "#0a0c10" : "#ffffff"}, 0 0 0 6.5px ${accent}, 0 12px 30px rgba(0,0,0,0.5)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 36, color: "white" }}>
          {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.name || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0, paddingBottom: 6 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, margin: 0, overflowWrap: "anywhere" }}>{profile.name || (en ? "User" : "Utilizador")}</h2>
          {profile.bio && <div style={{ fontSize: 14, color: sub, marginTop: 5, lineHeight: 1.4 }}>{profile.bio}</div>}
          {userEmail && !hideEmail && <div style={{ fontSize: 12, color: sub, opacity: 0.8, marginTop: 4, overflowWrap: "anywhere" }}>✉ {userEmail}</div>}
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} style={{ marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sub, background: "transparent", border: `1px solid ${line}`, cursor: "pointer", whiteSpace: "nowrap" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            {en ? "Edit profile" : "Editar perfil"}
          </button>
        )}
      </div>
    </div>
  );
}
