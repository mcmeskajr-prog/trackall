import { SIX_MONTHS } from "./homeUtils";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES } from "../../config/constants";

// Dois mini-insights do dia.
export function HomeInsights({ items }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const now = new Date();
  const daySeed = now.getFullYear() * 10000 + (now.getMonth()+1) * 100 + now.getDate();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const completed = items.filter(i => i?.userStatus === "completo");
  const completedPct = items.length > 0 ? Math.round((completed.length / items.length) * 100) : 0;
  const genreCount = {};
  completed.forEach(i => (i.genres||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
  const topGenre = Object.entries(genreCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
  const typeCount = {};
  completed.forEach(i => { if(i.type) typeCount[i.type] = (typeCount[i.type]||0)+1; });
  const topType = Object.entries(typeCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
  const topTypeLabel = topType ? (MEDIA_TYPES.find(t=>t.id===topType)?.label || topType) : null;
  const graveyardCount = items.filter(i => i && (i.userStatus==="planejado"||i.userStatus==="planeado") && (Date.now()-(i.addedAt||Date.now()))>SIX_MONTHS).length;
  const ratedThisMonth = completed.filter(i => (i.addedAt||0) >= thisMonthStart && i.userRating > 0);
  const avgThisMonth = ratedThisMonth.length > 0 ? (ratedThisMonth.reduce((s,i)=>s+i.userRating,0)/ratedThisMonth.length).toFixed(1) : null;
  const pool = [
    completedPct > 0 && { icon: "■", text: lang==="en" ? `You've completed ${completedPct}% of your library` : `Já completaste ${completedPct}% da tua biblioteca` },
    topGenre && { icon: "◆", text: lang==="en" ? `Your top genre is ${topGenre}` : `O teu género favorito é ${topGenre}` },
    topTypeLabel && { icon: "▲", text: lang==="en" ? `You consume most ${topTypeLabel}` : `Consomes mais ${topTypeLabel}` },
    graveyardCount > 0 && { icon: "●", text: lang==="en" ? `${graveyardCount} title${graveyardCount>1?"s":""} forgotten in your queue for 6+ months` : `${graveyardCount} obra${graveyardCount>1?"s":""} esquecida${graveyardCount>1?"s":""} no Planejo há 6+ meses` },
    avgThisMonth && { icon: "★", text: lang==="en" ? `Your avg rating this month: ${avgThisMonth}` : `Média de rating este mês: ${avgThisMonth}` },
    completed.length > 0 && { icon: "◉", text: lang==="en" ? `${completed.length} titles completed overall` : `${completed.length} obras completadas no total` },
  ].filter(Boolean);
  if (pool.length === 0) return null;
  const pick1 = pool[daySeed % pool.length];
  const pick2 = pool[(daySeed + 3) % pool.length];
  const picks = pick1 === pick2 ? [pick1] : [pick1, pick2];
  return (
    <div style={{ margin: "0 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
      {picks.map((insight, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: `${accent}0d`, border: `1px solid ${accent}30`, borderRadius: 12, padding: "10px 14px" }}>
          <span style={{ fontSize: 13, flexShrink: 0, color: accent, fontWeight: 900, width: 20, textAlign: "center" }}>{insight.icon}</span>
          <span style={{ fontSize: 13, color: darkMode ? "#8b949e" : "#64748b", fontWeight: 600, lineHeight: 1.4 }}>{insight.text}</span>
        </div>
      ))}
    </div>
  );
}
