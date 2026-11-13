import { SIX_MONTHS, HOME_R, homeLine, homeMuted, homePanel, homeText } from "./homeUtils";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { getMediaTypeLabel } from "../../config/constants";
import { supa } from "../../config/supabase";
import { HomeSection } from "./HomeSection";

// «Provavelmente nunca vais consumir»: planeados há 6+ meses.
export function HomeGraveyard({ items, user, setLibrary, graveyardOpen, setGraveyardOpen, setSelectedItem }) {
  const { darkMode, panelBg, isMobileDevice } = useTheme();
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
    <HomeSection style={{ padding: `0 ${pad}px 28px` }} title={lang === "en" ? "Probably never consuming this" : "Provavelmente nunca vais consumir"}
      action={graveyard.length > 3 ? (graveyardOpen ? (lang === "en" ? "show less" : "mostrar menos") : `${lang === "en" ? "see all" : "ver todos"} (${graveyard.length}) →`) : null} onAction={() => setGraveyardOpen((v) => !v)}>
      <div style={{ border: `1px solid ${line}`, borderRadius: HOME_R, background: homePanel(darkMode, panelBg) }}>
        {visible.map((item, i) => {
          const cover = item.customCover || item.cover;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: i ? `1px solid ${line}` : "none" }}>
              <div onClick={() => setSelectedItem(item)} style={{ width: 34, height: 51, borderRadius: HOME_R - 1 > 0 ? HOME_R - 1 : 0, overflow: "hidden", background: "#161b22", cursor: "pointer", flexShrink: 0, border: `1px solid ${line}` }}>
                {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#484f58", fontSize: 16 }}>?</div>}
              </div>
              <div onClick={() => setSelectedItem(item)} style={{ minWidth: 0, flex: 1, cursor: "pointer" }}>
                <div style={{ fontSize: 11, color: homeMuted(darkMode) }}>{getMediaTypeLabel(item.type, lang)} · {lang === "en" ? `added ${item.monthsOld}m ago` : `adicionado há ${item.monthsOld}m`}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: homeText(darkMode), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
              </div>
              {!isMobileDevice && <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2a84a", border: "1px solid rgba(226,168,74,0.4)", borderRadius: HOME_R, padding: "3px 8px", whiteSpace: "nowrap" }}>{item.reason}</span>}
              <button onClick={() => removeItem(item)} style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: HOME_R, border: `1px solid ${line}`, background: "transparent", color: homeText(darkMode), cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                {lang === "en" ? "Remove" : "Remover"}
              </button>
            </div>
          );
        })}
      </div>
    </HomeSection>
  );
}
