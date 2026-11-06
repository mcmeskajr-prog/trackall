import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { TYPE_COLORS } from "../../config/constants";
import { MediaCard } from "../../components/MediaCard";
import { TypeIcon } from "../../components/TypeIcon";
import { HomeFriendsFeed } from "../../components/HomeFriendsFeed";

function RowSection({ title, icon, items: rowItems, filterBtn, collapsed, onToggleCollapse, homeFilter, library, onOpen, accent, darkMode }) {
  if (rowItems.length === 0) return null;
  return (
    <div style={{ padding: "16px 0 8px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 12, paddingRight: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-flex", alignItems: "center", WebkitTapHighlightColor: "transparent" }}>▾</button>
          )}
          <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: homeFilter.length === 1 ? (TYPE_COLORS[homeFilter[0]] || (darkMode ? "#8b949e" : "#64748b")) : (darkMode ? "#8b949e" : "#64748b"), textTransform: "uppercase" }}>{icon} {title}</h2>
          {homeFilter.length > 0 && (
            <span style={{ fontSize: 10, color: accent, background: `${accent}22`, padding: "2px 6px", borderRadius: 20, fontWeight: 700 }}>
              {homeFilter.map(f => <TypeIcon key={f} id={f} style={{ marginRight: 3 }} />)}
            </span>
          )}
        </div>
        {filterBtn}
      </div>
      {!collapsed && <div className="recents-row" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 12px 20px", margin: "-8px -12px -10px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {rowItems.map((item) => (
          <div key={item.id} style={{ flexShrink: 0, width: "clamp(90px, 26vw, 130px)" }}>
            <MediaCard item={item} library={library} onOpen={onOpen} accent={accent} />
          </div>
        ))}
      </div>}
    </div>
  );
}

// Linha «Completados» (com filtro) + feed de amigos.
export function HomeRows({ items, library, user, homeFilter, setView, setFilterStatus, setSelectedItem, onOpenFriendItem, onOpenFriend }) {
  const { accent, darkMode } = useTheme();
  const { lang, useT } = useLang();
  const inFilter = (i) => homeFilter.length === 0 || homeFilter.includes(i.type);
  const completados = items
    .filter(i => i.userStatus === "completo" && inFilter(i))
    .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
    .slice(0, 20);

  // Com filtro ativo e nada a mostrar (nem completos nem em curso): só a mensagem
  if (homeFilter.length > 0 && completados.length === 0 && !items.some(i => i.userStatus === "assistindo" && inFilter(i))) return (
    <div style={{ padding: "28px 16px", textAlign: "center", color: darkMode ? "#484f58" : "#94a3b8" }}>
      <p style={{ fontSize: 14 }}>{lang === "en" ? "No items with this filter" : "Nenhum item com esse filtro"}</p>
    </div>
  );

  return (
    <>
      <RowSection
        homeFilter={homeFilter} library={library} onOpen={setSelectedItem} accent={accent} darkMode={darkMode}
        title={useT("completedLabel")}
        icon="✓"
        items={completados}
        filterBtn={
          <button onClick={() => { setView("library"); setFilterStatus("completo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>{useT("verTudo")}</button>
        }
      />
      <HomeFriendsFeed user={user} onOpenItem={onOpenFriendItem} onOpenFriend={onOpenFriend} onSeeAll={() => setView("friends")} />
    </>
  );
}
