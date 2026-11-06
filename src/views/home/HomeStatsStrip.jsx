import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { accentVariant } from "../../config/theme";

// Faixa rápida: completados este mês e rating médio.
export function HomeStatsStrip({ items }) {
  const { accent, darkMode } = useTheme();
  const { lang, useT } = useLang();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = items.filter(i => i.addedAt && i.userStatus === "completo" && i.addedAt >= startOfMonth).length;
  const rated = items.filter(i => i.userRating > 0);
  const avgRating = rated.length ? (rated.reduce((s,i) => s + i.userRating, 0) / rated.length).toFixed(1) : null;
  const stats = [
    { label: useT("completedThisMonth"), value: thisMonth, show: thisMonth > 0, icon: "📅" },
    { label: lang === "en" ? "avg rating" : "rating médio", value: avgRating, show: !!avgRating, icon: "★" },
  ].filter(s => s.show);
  if (!stats.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", overflowX: "auto", scrollbarWidth: "none" }}>
      {stats.map((s, si) => {
        const c = accentVariant(accent, si);
        return (
          <div key={s.label} className="no-tc" style={{
            flexShrink: 0,
            background: `linear-gradient(135deg, ${c}18 0%, ${c}08 100%)`,
            border: `1px solid ${c}33`,
            borderRadius: 12, padding: "10px 16px",
            display: "flex", flexDirection: "column", gap: 2,
            minWidth: 110,
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{s.icon === "★" ? <span style={{ fontSize: 14, marginRight: 2 }}>★</span> : null}{s.value}</span>
            <span style={{ fontSize: 10, color: darkMode ? "#8b949e" : "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
