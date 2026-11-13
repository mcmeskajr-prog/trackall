import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { HOME_R, homeLine, homeMuted, homePanel, homeText } from "./homeUtils";

// Faixa única de números: estados + completados este mês + média.
export function HomeStatsStrip({ items, stats }) {
  const { darkMode, panelBg, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = items.filter((i) => i.addedAt && i.userStatus === "completo" && i.addedAt >= startOfMonth).length;
  const rated = items.filter((i) => i.userRating > 0);
  const avg = rated.length ? (rated.reduce((s, i) => s + i.userRating, 0) / rated.length).toFixed(1) : null;
  const cells = [
    { l: lang === "en" ? "In progress" : "Em curso", v: stats.assistindo },
    { l: useT("completo"), v: stats.completo },
    { l: lang === "en" ? "Planned" : "Planeados", v: stats.planejado },
    { l: lang === "en" ? "Paused" : "Pausa", v: stats.pausa },
    { l: useT("dropado"), v: stats.largado },
    { l: useT("completedThisMonth"), v: thisMonth },
    { l: lang === "en" ? "Avg rating" : "Média", v: avg, star: true },
  ].filter((c) => c.v !== null && c.v !== undefined && Number(c.v) > 0);
  if (!cells.length) return null;
  const line = homeLine(darkMode);
  return (
    <div style={{ padding: isMobileDevice ? "0 16px 16px" : "0 24px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${isMobileDevice ? 96 : 130}px, 1fr))`, gap: 1, background: line, border: `1px solid ${line}`, borderRadius: HOME_R, overflow: "hidden" }}>
        {cells.map((c) => (
          <div key={c.l} style={{ background: homePanel(darkMode, panelBg), padding: isMobileDevice ? "10px 12px" : "12px 18px", minWidth: 0 }}>
            <div style={{ fontSize: isMobileDevice ? 19 : 24, fontWeight: 800, color: homeText(darkMode), lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{c.star ? "★ " : ""}{c.v}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: homeMuted(darkMode), marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
