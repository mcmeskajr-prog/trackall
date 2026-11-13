import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../../config/constants";
import { homeLine, homeMuted, homeText } from "./homeUtils";
import { HomeStatsStrip } from "./HomeStatsStrip";

// Cabeçalho da Home: saudação (+ números no PC) e filtro por tipo em separadores.
export function HomeHero({ profile, items, stats, homeStatColors, homeFilter, setHomeFilter }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const none = homeFilter.length === 0;
  const tab = (active) => ({
    flexShrink: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: active ? 800 : 600, padding: "9px 14px",
    border: "none", borderBottom: `2px solid ${active ? accent : "transparent"}`, marginBottom: -1, background: "none",
    color: active ? accent : homeMuted(darkMode), WebkitTapHighlightColor: "transparent",
  });
  return (
    <div style={{ padding: isMobileDevice ? "14px 16px 0" : "24px 24px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: isMobileDevice ? 10 : 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: isMobileDevice ? 22 : 26, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0, color: homeText(darkMode), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lang === "en" ? "Hi" : "Olá"}, {profile.name || (lang === "en" ? "there" : "Utilizador")}
          </h1>
          <div style={{ fontSize: 13, color: homeMuted(darkMode), marginTop: 3 }}>
            <b style={{ color: homeText(darkMode), fontWeight: 700 }}>{items.length}</b> {useT("inLibraryCount")}
          </div>
        </div>
        {!isMobileDevice && items.length > 0 && <HomeStatsStrip inline items={items} stats={stats} homeStatColors={homeStatColors} />}
      </div>
      <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${homeLine(darkMode)}`, marginBottom: 16 }}>
        <button onClick={() => setHomeFilter([])} style={tab(none)}>{lang === "en" ? "All" : "Tudo"}</button>
        {MEDIA_TYPES.slice(1).map((t) => {
          const active = homeFilter.includes(t.id);
          return <button key={t.id} onClick={() => setHomeFilter((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))} style={tab(active)}>{mediaLabel(t, lang)}</button>;
        })}
      </div>
    </div>
  );
}
