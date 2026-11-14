import { useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, getMediaTypeLabel } from "../../config/constants";
import { getConsumptionTime } from "../../lib/consumptionTime";
import { HomeSection } from "./HomeSection";
import { HOME_R, homeLine, homeMuted, homePanel, homeRowCss, homeText } from "./homeUtils";

// «Quando consumir?»: separadores Hoje / Fim de semana / Férias com sugestões do Planejo. ↻ mostra outras; o rodapé abre o Planejo.
export function HomeWhenToConsume({ items, setSelectedItem, setView, setFilterStatus, embedded }) {
  const { accent, darkMode, panelBg, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const nowD = new Date();
  const isWeekend = nowD.getDay() === 0 || nowD.getDay() === 6;
  const [tab, setTab] = useState(null);
  const [shift, setShift] = useState(0);
  const plannedStatuses = new Set(["planejado", "planeado"]);
  const planned = items.filter((i) => i && plannedStatuses.has(i.userStatus));
  if (planned.length === 0) return null;
  const groups = { hoje: [], fimdesemana: [], ferias: [] };
  planned.forEach((i) => { const ct = getConsumptionTime(i); if (ct) groups[ct.slot].push(i); });
  const daySeed = nowD.getFullYear() * 10000 + (nowD.getMonth() + 1) * 100 + nowD.getDate();
  const monday = new Date(nowD); monday.setDate(nowD.getDate() - ((nowD.getDay() + 6) % 7));
  const weekSeed = monday.getFullYear() * 10000 + (monday.getMonth() + 1) * 100 + monday.getDate();
  const seededPicks = (arr, seed, n) => { const out = []; for (let i = 0; i < n && i < arr.length; i++) out.push(arr[(seed + shift * 3 + i) % arr.length]); return out; };
  const slots = [
    { key: "hoje", label: lang === "en" ? "Today" : "Hoje", all: groups.hoje, picks: seededPicks(groups.hoje, daySeed, 3) },
    { key: "fimdesemana", label: lang === "en" ? "Weekend" : "Fim de semana", all: groups.fimdesemana, picks: seededPicks(groups.fimdesemana, weekSeed + 1, 3) },
    { key: "ferias", label: lang === "en" ? "Holidays" : "Férias", all: groups.ferias, picks: seededPicks(groups.ferias, weekSeed, 3) },
  ].filter((s) => s.picks.length > 0);
  if (!slots.length) return null;
  const preferred = isWeekend ? "fimdesemana" : "hoje";
  const activeKey = slots.find((s) => s.key === tab) ? tab : (slots.find((s) => s.key === preferred) || slots[0]).key;
  const active = slots.find((s) => s.key === activeKey);
  const line = homeLine(darkMode);
  const pad = isMobileDevice ? 16 : 24;
  const canShuffle = active.all.length > active.picks.length;
  return (
    <HomeSection fill title={lang === "en" ? "When to consume?" : "Quando consumir?"} action={canShuffle ? `↻ ${lang === "en" ? "Others" : "Outras"}` : null} onAction={() => setShift((v) => v + 1)} style={embedded ? { padding: 0 } : { padding: `0 ${pad}px 28px` }}>
      <style>{homeRowCss(accent)}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: `1px solid ${line}`, borderRadius: HOME_R, background: homePanel(darkMode, panelBg), overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${line}`, padding: "0 6px", overflowX: "auto", scrollbarWidth: "none" }}>
          {slots.map((s) => {
            const on = s.key === activeKey;
            return (
              <button key={s.key} onClick={() => { setTab(s.key); setShift(0); }} style={{ background: "none", border: "none", borderBottom: `2px solid ${on ? accent : "transparent"}`, marginBottom: -1, padding: "12px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: on ? homeText(darkMode) : homeMuted(darkMode), whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7 }}>
                {s.label}
                <span style={{ fontSize: 10.5, fontWeight: 800, color: on ? accent : homeMuted(darkMode), border: `1px solid ${on ? accent + "66" : line}`, borderRadius: HOME_R, padding: "1px 6px" }}>{s.all.length}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }}>
          {active.picks.map((item, i) => (
            <div key={item.id + i} className="home-row" role="button" tabIndex={0} onClick={() => setSelectedItem(item)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedItem(item); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderTop: i ? `1px solid ${line}` : "none" }}>
              <div style={{ width: 40, height: 60, borderRadius: HOME_R - 1 > 0 ? HOME_R - 1 : 0, overflow: "hidden", background: darkMode ? "#0d1117" : "#e2e8f0", flexShrink: 0, border: `1px solid ${line}` }}>
                {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 14 }}>{MEDIA_TYPES.find((t) => t.id === item.type)?.icon || "★"}</div>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row-title" style={{ fontSize: 14.5, fontWeight: 800, color: homeText(darkMode), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color .15s" }}>{item.title}</div>
                <div style={{ fontSize: 12, color: homeMuted(darkMode), marginTop: 2 }}>{getMediaTypeLabel(item.type, lang)}{item.episodes ? ` · ${item.episodes} ep` : item.chapters ? ` · ${item.chapters} cap` : ""}</div>
              </div>
              <span className="row-go" style={{ fontSize: 16, color: homeMuted(darkMode), flexShrink: 0 }}>→</span>
            </div>
          ))}
        </div>
        {setView && setFilterStatus && (
          <button className="home-row" onClick={() => { setView("library"); setFilterStatus("planejado"); }} style={{ background: "none", border: "none", borderTop: `1px solid ${line}`, padding: "11px 16px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: homeMuted(darkMode), textAlign: "left", display: "flex", justifyContent: "space-between" }}>
            <span>{lang === "en" ? `See all ${planned.length} planned` : `Ver os ${planned.length} planeados`}</span><span className="row-go">→</span>
          </button>
        )}
      </div>
    </HomeSection>
  );
}
