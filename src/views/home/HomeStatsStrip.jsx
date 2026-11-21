import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { accentVariant } from "../../config/theme";
import { HOME_R, homeLine, homeMuted, homePanel } from "./homeUtils";

function useCells(items, stats, homeStatColors) {
  const { accent } = useTheme();
  const { lang, useT } = useLang();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = items.filter((i) => i.addedAt && i.userStatus === "completo" && i.addedAt >= startOfMonth).length;
  const rated = items.filter((i) => i.userRating > 0);
  const avg = rated.length ? (rated.reduce((s, i) => s + i.userRating, 0) / rated.length).toFixed(1) : null;
  return [
    { l: lang === "en" ? "In progress" : "Em curso", s: lang === "en" ? "Active" : null, v: stats.assistindo, c: homeStatColors.assistindo || accent },
    { l: useT("completo"), s: lang === "en" ? "Done" : null, v: stats.completo, c: homeStatColors.completo || accent },
    { l: lang === "en" ? "Planned" : "Planeados", v: stats.planejado, c: homeStatColors.planejado || accent },
    { l: lang === "en" ? "Paused" : "Pausa", v: stats.pausa, c: homeStatColors.pausa || accent },
    { l: useT("dropado"), v: stats.largado, c: homeStatColors.largado || accent },
    { l: lang === "en" ? "This month" : "Este mês", s: lang === "en" ? "Month" : null, v: thisMonth, c: accentVariant(accent, 0) },
    { l: lang === "en" ? "Avg rating" : "Média", s: lang === "en" ? "Avg" : null, v: avg, star: true, c: "#f5b83d" },
  ].filter((c) => c.v !== null && c.v !== undefined && Number(c.v) > 0);
}

// Números da biblioteca. `inline` (PC): sem caixa, ao lado da saudação. Sem `inline` (telemóvel): faixa em grelha.
export function HomeStatsStrip({ items, stats, homeStatColors = {}, inline = false }) {
  const { darkMode, panelBg, isMobileDevice } = useTheme();
  const cells = useCells(items, stats, homeStatColors);
  if (!cells.length) return null;
  const line = homeLine(darkMode);
  const tight = isMobileDevice && cells.length <= 5; // 5 colunas estreitas no telemóvel: rótulos curtos (só inglês)
  if (inline) {
    return (
      <div style={{ display: "flex", flexShrink: 0 }}>
        {cells.map((c, i) => (
          <div key={c.l} style={{ padding: "0 20px", borderLeft: i ? `1px solid ${line}` : "none", minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.c, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{c.star ? "★ " : ""}{c.v}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: homeMuted(darkMode), marginTop: 3, whiteSpace: "nowrap" }}>{c.l}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ padding: isMobileDevice ? "0 16px 16px" : "0 24px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobileDevice && cells.length <= 5 ? `repeat(${cells.length}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(${isMobileDevice ? 96 : 130}px, 1fr))`, gap: 1, background: line, border: `1px solid ${line}`, borderRadius: HOME_R, overflow: "hidden" }}>
        {cells.map((c) => (
          <div key={c.l} style={{ background: `linear-gradient(180deg, ${c.c}1f 0%, transparent 70%), ${homePanel(darkMode, panelBg)}`, borderTop: `2px solid ${c.c}`, padding: isMobileDevice ? "9px 6px" : "14px 18px 12px", minWidth: 0 }}>
            <div style={{ fontSize: isMobileDevice ? 18 : 24, fontWeight: 800, color: c.c, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{c.star ? "★ " : ""}{c.v}</div>
            <div style={{ fontSize: isMobileDevice ? 9 : 10, fontWeight: 700, letterSpacing: isMobileDevice ? "0.06em" : "0.1em", textTransform: "uppercase", color: homeMuted(darkMode), marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tight && c.s ? c.s : c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
