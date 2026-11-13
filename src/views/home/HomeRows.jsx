import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MediaCard } from "../../components/MediaCard";
import { HomeSection } from "./HomeSection";
import { homeMuted } from "./homeUtils";

// Linha «Completados» (com filtro por tipo).
export function HomeRows({ items, library, homeFilter, setView, setFilterStatus, setSelectedItem }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const inFilter = (i) => homeFilter.length === 0 || homeFilter.includes(i.type);
  const completados = items
    .filter((i) => i.userStatus === "completo" && inFilter(i))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, 20);

  if (homeFilter.length > 0 && completados.length === 0 && !items.some((i) => i.userStatus === "assistindo" && inFilter(i))) return (
    <div style={{ padding: "28px 16px", textAlign: "center", color: homeMuted(darkMode) }}>
      <p style={{ fontSize: 14 }}>{lang === "en" ? "No items with this filter" : "Nenhum item com esse filtro"}</p>
    </div>
  );
  if (completados.length === 0) return null;
  const pad = isMobileDevice ? 16 : 24;
  return (
    <HomeSection style={{ padding: `0 ${pad}px 28px` }} title={useT("completedLabel")} action={useT("verTudo")} onAction={() => { setView("library"); setFilterStatus("completo"); }}>
      <div className="recents-row" style={{ display: "flex", gap: isMobileDevice ? 8 : 14, overflowX: "auto", padding: "4px 4px 8px", margin: "-4px -4px -8px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {completados.map((item) => (
          <div key={item.id} style={{ flexShrink: 0, width: isMobileDevice ? "clamp(90px, 26vw, 130px)" : 150 }}>
            <MediaCard item={item} library={library} onOpen={setSelectedItem} accent={accent} />
          </div>
        ))}
      </div>
    </HomeSection>
  );
}
