import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../../config/constants";
import { HOME_R, homeLine, homeMuted, homeText } from "./homeUtils";

// Cabeçalho da Home: saudação + filtro por tipo (a faixa de números vem logo a seguir, em HomeStatsStrip).
export function HomeHero({ profile, items, homeFilter, setHomeFilter }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const none = homeFilter.length === 0;
  const seg = (active) => ({
    flexShrink: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, padding: isMobileDevice ? "8px 12px" : "8px 14px",
    border: "none", background: active ? accent : "transparent", color: active ? "#fff" : homeMuted(darkMode),
    borderLeft: `1px solid ${homeLine(darkMode)}`, WebkitTapHighlightColor: "transparent",
  });
  const filter = (
    <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", border: `1px solid ${homeLine(darkMode)}`, borderRadius: HOME_R, maxWidth: "100%" }}>
      <button onClick={() => setHomeFilter([])} style={{ ...seg(none), borderLeft: "none" }}>{lang === "en" ? "All" : "Tudo"}</button>
      {MEDIA_TYPES.slice(1).map((t) => {
        const active = homeFilter.includes(t.id);
        return (
          <button key={t.id} onClick={() => setHomeFilter((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))} style={seg(active)}>
            {mediaLabel(t, lang)}
          </button>
        );
      })}
    </div>
  );
  return (
    <div style={{ padding: isMobileDevice ? "14px 16px 0" : "24px 24px 0" }}>
      <div style={{ display: "flex", alignItems: isMobileDevice ? "stretch" : "center", flexDirection: isMobileDevice ? "column" : "row", gap: isMobileDevice ? 12 : 16, marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: isMobileDevice ? 22 : 26, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0, color: homeText(darkMode), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lang === "en" ? "Hi" : "Olá"}, {profile.name || (lang === "en" ? "there" : "Utilizador")}
          </h1>
          <div style={{ fontSize: 13, color: homeMuted(darkMode), marginTop: 3 }}>
            <b style={{ color: homeText(darkMode), fontWeight: 700 }}>{items.length}</b> {useT("inLibraryCount")}
          </div>
        </div>
        {filter}
      </div>
    </div>
  );
}
