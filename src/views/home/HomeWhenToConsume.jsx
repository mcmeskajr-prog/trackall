import { useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, getMediaTypeLabel } from "../../config/constants";
import { getConsumptionTime } from "../../lib/consumptionTime";
import { HomeSection } from "./HomeSection";
import { HOME_R, homeLine, homeMuted, homePanel, homeText } from "./homeUtils";

// «Quando consumir?»: separadores Hoje / Fim de semana / Férias com sugestões do Planejo.
export function HomeWhenToConsume({ items, setSelectedItem }) {
  const { accent, darkMode, panelBg } = useTheme();
  const { lang } = useLang();
  const nowD = new Date();
  const isWeekend = nowD.getDay() === 0 || nowD.getDay() === 6;
  const [tab, setTab] = useState(null);
  const plannedStatuses = new Set(["planejado", "planeado"]);
  const planned = items.filter((i) => i && plannedStatuses.has(i.userStatus));
  if (planned.length === 0) return null;
  const groups = { hoje: [], fimdesemana: [], ferias: [] };
  planned.forEach((i) => { const ct = getConsumptionTime(i); if (ct) groups[ct.slot].push(i); });
  const daySeed = nowD.getFullYear() * 10000 + (nowD.getMonth() + 1) * 100 + nowD.getDate();
  const monday = new Date(nowD); monday.setDate(nowD.getDate() - ((nowD.getDay() + 6) % 7));
  const weekSeed = monday.getFullYear() * 10000 + (monday.getMonth() + 1) * 100 + monday.getDate();
  const seededPicks = (arr, seed, n) => { const out = []; for (let i = 0; i < n && i < arr.length; i++) out.push(arr[(seed + i) % arr.length]); return out; };
  const slots = [
    { key: "hoje", label: lang === "en" ? "Today" : "Hoje", picks: seededPicks(groups.hoje, daySeed, 3) },
    { key: "fimdesemana", label: lang === "en" ? "Weekend" : "Fim de semana", picks: seededPicks(groups.fimdesemana, weekSeed + 1, 3) },
    { key: "ferias", label: lang === "en" ? "Holidays" : "Férias", picks: seededPicks(groups.ferias, weekSeed, 3) },
  ].filter((s) => s.picks.length > 0);
  if (!slots.length) return null;
  const preferred = isWeekend ? "fimdesemana" : "hoje";
  const activeKey = slots.find((s) => s.key === tab) ? tab : (slots.find((s) => s.key === preferred) || slots[0]).key;
  const active = slots.find((s) => s.key === activeKey);
  const line = homeLine(darkMode);
  return (
    <HomeSection title={lang === "en" ? "When to consume?" : "Quando consumir?"} style={{ padding: 0 }}>
      <div style={{ border: `1px solid ${line}`, borderRadius: HOME_R, background: homePanel(darkMode, panelBg), overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${line}`, padding: "0 6px" }}>
          {slots.map((s) => {
            const on = s.key === activeKey;
            return <button key={s.key} onClick={() => setTab(s.key)} style={{ background: "none", border: "none", borderBottom: `2px solid ${on ? accent : "transparent"}`, marginBottom: -1, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: on ? homeText(darkMode) : homeMuted(darkMode) }}>{s.label}</button>;
          })}
        </div>
        {active.picks.map((item, i) => (
          <button key={item.id + i} onClick={() => setSelectedItem(item)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 14px", background: "none", border: "none", borderTop: i ? `1px solid ${line}` : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "inherit" }}>
            <div style={{ width: 34, height: 51, borderRadius: HOME_R - 1 > 0 ? HOME_R - 1 : 0, overflow: "hidden", background: darkMode ? "#0d1117" : "#e2e8f0", flexShrink: 0, border: `1px solid ${line}` }}>
              {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 14 }}>{MEDIA_TYPES.find((t) => t.id === item.type)?.icon || "★"}</div>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: homeText(darkMode), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: homeMuted(darkMode) }}>{getMediaTypeLabel(item.type, lang)}{item.episodes ? ` · ${item.episodes} ep` : item.chapters ? ` · ${item.chapters} cap` : ""}</div>
            </div>
            <span style={{ fontSize: 12, color: homeMuted(darkMode), flexShrink: 0 }}>{lang === "en" ? "Open" : "Abrir"} →</span>
          </button>
        ))}
      </div>
    </HomeSection>
  );
}
