import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, getMediaTypeLabel } from "../../config/constants";
import { getConsumptionTime } from "../../lib/consumptionTime";

// «Quando consumir?»: sugestões do Planejo por momento (hoje / fim de semana / férias).
export function HomeWhenToConsume({ items, setSelectedItem }) {
  const { darkMode, panelBg } = useTheme();
  const { lang } = useLang();
  const plannedStatuses = new Set(["planejado","planeado"]);
  const planned = items.filter(i => i && plannedStatuses.has(i.userStatus));
  if (planned.length === 0) return null;
  const groups = { hoje: [], fimdesemana: [], ferias: [] };
  planned.forEach(i => {
    const ct = getConsumptionTime(i);
    if (ct) groups[ct.slot].push({ item: i, ct });
  });
  const hasAny = groups.hoje.length > 0 || groups.fimdesemana.length > 0 || groups.ferias.length > 0;
  if (!hasAny) return null;
  const nowD = new Date();
  const isWeekend = nowD.getDay() === 0 || nowD.getDay() === 6;
  const daySeed = nowD.getFullYear() * 10000 + (nowD.getMonth()+1) * 100 + nowD.getDate();
  const monday = new Date(nowD); monday.setDate(nowD.getDate() - ((nowD.getDay()+6)%7));
  const weekSeed = monday.getFullYear() * 10000 + (monday.getMonth()+1) * 100 + monday.getDate();
  const seededPicks = (arr, seed, n) => {
    if (!arr.length) return [];
    const picks = [];
    for (let i = 0; i < n && i < arr.length; i++) picks.push(arr[(seed + i) % arr.length]);
    return picks;
  };
  const picksHoje = seededPicks(groups.hoje, daySeed, 2);
  const picksFds = seededPicks(groups.fimdesemana, weekSeed + 1, 2);
  const picksFerias = seededPicks(groups.ferias, weekSeed, 2);
  const slots = [
    picksHoje.length > 0 && { key: "hoje", emoji: "⚡", label: "Para hoje", labelEn: "For today", color: "#10b981", picks: picksHoje, all: groups.hoje, total: groups.hoje.length },
    picksFds.length > 0 && { key: "fimdesemana", emoji: "📅", label: "Fim de semana", labelEn: "Weekend", color: "#06b6d4", picks: picksFds, all: groups.fimdesemana, total: groups.fimdesemana.length },
    picksFerias.length > 0 && { key: "ferias", emoji: "🏖️", label: "Para as férias", labelEn: "For holidays", color: "#f59e0b", picks: picksFerias, all: groups.ferias, total: groups.ferias.length },
  ].filter(Boolean);
  if (slots.length === 0) return null;
  return (
    <div style={{ margin: "20px 0 4px", padding: "0 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#8b949e" : "#64748b", marginBottom: 10 }}>
        {lang === "en" ? "When to consume?" : "Quando consumir?"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slots.map(({ key, emoji, label, labelEn, color, picks, all, total }) => (
          <div key={key} style={{ background: panelBg || (darkMode ? "rgba(12,12,16,0.30)" : "rgba(255,255,255,0.28)"), border: `1px solid ${color}30`, borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 900, color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              {lang === "en" ? labelEn : label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {picks.map((p, pi) => (
                <button key={p.item.id + pi} onClick={() => setSelectedItem(p.item)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 0", textAlign: "left", width: "100%" }}>
                  <div style={{ width: 34, height: 48, borderRadius: 6, overflow: "hidden", background: darkMode ? "#0d1117" : "#e2e8f0", flexShrink: 0 }}>
                    {p.item.cover ? <img src={p.item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 14 }}>{MEDIA_TYPES.find(t => t.id === p.item.type)?.icon || "★"}</div>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: darkMode ? "#f0f6fc" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.item.title}</div>
                    <div style={{ fontSize: 11, color: darkMode ? "#8b949e" : "#64748b" }}>
                      {getMediaTypeLabel(p.item.type, lang)}{p.item.episodes ? ` · ${p.item.episodes} ep` : p.item.chapters ? ` · ${p.item.chapters} cap` : ""}
                    </div>
                  </div>
                </button>
              ))}

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
