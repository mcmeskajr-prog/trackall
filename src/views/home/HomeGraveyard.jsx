import { SIX_MONTHS, HOME_R, homeLine, homeMuted, homePanel, homeRowCss, homeText } from "./homeUtils";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { getMediaTypeLabel } from "../../config/constants";
import { supa } from "../../config/supabase";
import { HomeSection } from "./HomeSection";

// «Provavelmente nunca vais consumir»: planeados há 6+ meses.
export function HomeGraveyard({ items, user, setLibrary, graveyardOpen, setGraveyardOpen, setSelectedItem, embedded }) {
  const { accent, darkMode, panelBg, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const now = Date.now();
  const recentCompleted = items.filter((i) => i?.userStatus === "completo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 20);
  const genreCounts = {};
  recentCompleted.forEach((i) => (i.genres || []).forEach((g) => { genreCounts[g] = (genreCounts[g] || 0) + 1; }));
  const topGenres = new Set(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g));
  const graveyard = items.filter((i) => {
    if (!i) return false;
    if (i.userStatus !== "planejado" && i.userStatus !== "planeado") return false;
    return (now - (i.addedAt || now)) > SIX_MONTHS;
  }).map((i) => {
    const outOfPattern = topGenres.size > 0 && !(i.genres || []).some((g) => topGenres.has(g));
    const monthsOld = Math.floor((now - (i.addedAt || now)) / (1000 * 60 * 60 * 24 * 30));
    const reason = outOfPattern ? (lang === "en" ? "out of your pattern" : "fora do teu padrão") : (lang === "en" ? `forgotten for ${monthsOld}m` : `esquecido há ${monthsOld}m`);
    return { ...i, reason, monthsOld };
  }).sort((a, b) => b.monthsOld - a.monthsOld);
  if (graveyard.length === 0) return null;
  const visible = graveyardOpen ? graveyard : graveyard.slice(0, 3);
  const removeItem = async (item) => {
    const cat = item.type + "s";
    setLibrary((prev) => { const next = { ...prev }; if (next[cat]) { next[cat] = { ...next[cat] }; delete next[cat][item.id]; } return next; });
    if (user) try { await supa.removeFromLibrary(user.id, item.id, item.type); } catch { /* ignorar */ }
  };
  const line = homeLine(darkMode);
  const pad = isMobileDevice ? 16 : 24;
  return (
    <HomeSection fill style={embedded ? { padding: 0 } : { padding: `0 ${pad}px 28px` }} title={lang === "en" ? "Probably never consuming this" : "Provavelmente nunca vais consumir"}
      action={graveyard.length > 3 ? (graveyardOpen ? (lang === "en" ? "Show less" : "Mostrar menos") : `${lang === "en" ? "See all" : "Ver todos"} (${graveyard.length})`) : null} onAction={() => setGraveyardOpen((v) => !v)}>
      <style>{homeRowCss(accent)}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: `1px solid ${line}`, borderRadius: HOME_R, background: homePanel(darkMode, panelBg), overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${line}`, fontSize: 12, color: homeMuted(darkMode), flexShrink: 0 }}>
          <b style={{ color: homeText(darkMode), fontWeight: 800 }}>{graveyard.length}</b> {lang === "en" ? "titles planned for 6+ months" : "títulos no Planejo há 6+ meses"}
        </div>
        {visible.map((item, i) => {
          const cover = item.customCover || item.cover;
          return (
            <div key={item.id} className="home-row" role="button" tabIndex={0} onClick={() => setSelectedItem(item)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedItem(item); }}
              style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderTop: i ? `1px solid ${line}` : "none" }}>
              <div style={{ width: 40, height: 60, borderRadius: HOME_R - 1 > 0 ? HOME_R - 1 : 0, overflow: "hidden", background: "#161b22", flexShrink: 0, border: `1px solid ${line}` }}>
                {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#484f58", fontSize: 16 }}>?</div>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: homeMuted(darkMode) }}>{getMediaTypeLabel(item.type, lang)} · {lang === "en" ? `added ${item.monthsOld}m ago` : `adicionado há ${item.monthsOld}m`}</div>
                <div className="row-title" style={{ fontSize: 14.5, fontWeight: 800, color: homeText(darkMode), margin: "2px 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color .15s" }}>{item.title}</div>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2a84a", border: "1px solid rgba(226,168,74,0.4)", borderRadius: HOME_R, padding: "2px 7px", whiteSpace: "nowrap" }}>{item.reason}</span>
              </div>
              <button className="home-danger" onClick={(e) => { e.stopPropagation(); removeItem(item); }} title={lang === "en" ? "Remove from library" : "Remover da biblioteca"} style={{ fontSize: 11.5, fontWeight: 700, padding: isMobileDevice ? "10px 12px" : "7px 12px", borderRadius: HOME_R, border: `1px solid ${line}`, background: "transparent", color: homeMuted(darkMode), cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                {lang === "en" ? "Remove" : "Remover"}
              </button>
            </div>
          );
        })}
      </div>
    </HomeSection>
  );
}
