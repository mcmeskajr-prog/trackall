import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, getMediaTypeLabel } from "../../config/constants";
import { getConsumptionTime } from "../../lib/consumptionTime";
import { TiltCard } from "../../components/TiltCard";

// «Melhor para hoje» + escolhas rápidas + botões Surpreende-me / Algo novo.
export function HomeQuickPicks({ items, homeDashboard, personalRecos, setSelectedItem }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const picks = homeDashboard.quickPicks;
  if (picks.length === 0) return null;
  const quickCopy = {
    focus: { title: lang === "en" ? "Current Focus" : "Foco Atual", desc: lang === "en" ? "Keep going." : "Continua." },
    continue: { title: lang === "en" ? "Continue now" : "Continuar agora", desc: lang === "en" ? "Keep the momentum." : "Mantém o embalo." },
    today: { title: lang === "en" ? "Best for Today" : "Melhor para Hoje", desc: lang === "en" ? "Strongest current pick." : "Aposta mais forte do momento." },
    forgotten: { title: lang === "en" ? "Forgotten in queue" : "Esquecido na fila", desc: lang === "en" ? "Has been waiting for a while." : "Já está contigo há algum tempo." },
    return: { title: lang === "en" ? "Worth returning" : "Vale regressar", desc: lang === "en" ? "A paused title still worth your time." : "Uma pausa que ainda merece o teu tempo." },
  };


  const todayPick = picks.find(p => p.slot === "today");
  const smallPicks = picks.filter(p => p.slot !== "today");
  return (
    <div style={{ padding: "14px 16px 0" }}>
      {/* Best for Today — card grande */}
      {todayPick && (() => {
        const item = todayPick.item;
        const typeObj = MEDIA_TYPES.find(t => t.id === item.type);
        return (
          <div onClick={() => setSelectedItem(item)} style={{ cursor: "pointer", borderRadius: 18, overflow: "hidden", border: `1px solid ${accent}26`, background: darkMode ? `linear-gradient(135deg, ${accent}12 0%, rgba(12,12,16,0.42) 58%, rgba(18,10,14,0.30) 100%)` : `linear-gradient(135deg, ${accent}0d 0%, rgba(255,255,255,0.54) 65%, rgba(255,250,250,0.36) 100%)`, boxShadow: darkMode ? `0 10px 24px ${accent}10` : `0 10px 22px rgba(15,23,42,0.06)`, marginBottom: smallPicks.length > 0 ? 12 : 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "96px 1fr" : "124px 1fr", gap: 14, padding: 14, alignItems: "stretch" }}>
              <TiltCard maxTilt={7} glare style={{ borderRadius: 14, overflow: "hidden", height: isMobileDevice ? 136 : 170, background: darkMode ? "#0d1117" : "#e2e8f0", flexShrink: 0, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
                {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", pointerEvents: "none" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 28 }}>{typeObj?.icon || "★"}</div>}
              </TiltCard>
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 4 }}>{lang === "en" ? "Best for Today" : "Melhor para Hoje"}</div>
                      <h3 style={{ fontSize: isMobileDevice ? 21 : 25, lineHeight: 1.05, fontWeight: 900, color: darkMode ? "#f8fafc" : "#0f172a", marginBottom: 6 }}>{item.title}</h3>
                    </div>
                    {(item.userRating > 0 || item.score) && <div style={{ flexShrink: 0, background: darkMode ? "rgba(10,10,10,0.28)" : "rgba(255,255,255,0.46)", border: `1px solid ${accent}22`, color: "#f59e0b", borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 900 }}>★ {item.userRating > 0 ? item.userRating : item.score}</div>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 8px", borderRadius: 999, background: `${accent}1d`, color: accent }}>{getMediaTypeLabel(item.type, lang)}</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: darkMode ? "#cbd5e1" : "#475569", margin: 0 }}>{lang === "en" ? "Strongest current pick." : "A aposta mais forte do momento."}</p>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: accent, fontSize: 12, fontWeight: 800 }}>
                  <span>{lang === "en" ? "Open title" : "Abrir obra"}</span>
                  <span style={{ fontSize: 14 }}>→</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Outros quick picks — cards pequenos */}
      {smallPicks.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: darkMode ? "#8b949e" : "#64748b" }}>
              {(lang === "en" ? "Quick picks" : "Escolhas rápidas").toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: "#484f58" }}>{smallPicks.length}</span>
          </div>
          {(() => {
            const plannedPool = items.filter(i => i.userStatus === "planejado" || i.userStatus === "planeado");
            const surpriseLibrary = () => { if (plannedPool.length) setSelectedItem(plannedPool[Math.floor(Math.random() * plannedPool.length)]); };
            const surpriseNew = () => { if (personalRecos.length) setSelectedItem(personalRecos[Math.floor(Math.random() * personalRecos.length)]); };
            return (
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <button className="qp-btn qp-btn-primary" onClick={surpriseLibrary} disabled={!plannedPool.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: `1px solid ${accent}70`, background: `${accent}20`, color: plannedPool.length ? (darkMode ? "#fff" : "#0f172a") : "#6e7681", fontSize: 12, fontWeight: 700, cursor: plannedPool.length ? "pointer" : "default", fontFamily: "inherit", opacity: plannedPool.length ? 1 : 0.5 }}>
                  🎲 {lang === "en" ? "Surprise me" : "Surpreende-me"}
                </button>
                <button className="qp-btn qp-btn-secondary" onClick={surpriseNew} disabled={!personalRecos.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: `1px solid ${darkMode ? "#30363d" : "#cbd5e1"}`, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)", color: personalRecos.length ? (darkMode ? "#e6edf3" : "#0f172a") : "#6e7681", fontSize: 12, fontWeight: 700, cursor: personalRecos.length ? "pointer" : "default", fontFamily: "inherit", opacity: personalRecos.length ? 1 : 0.5 }}>
                  ✦ {lang === "en" ? "Something new" : "Algo novo"}
                </button>
              </div>
            );
          })()}
          <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {smallPicks.map(({ slot, item }) => (
              <button key={`${slot}-${item.id}`} onClick={() => setSelectedItem(item)} style={{ textAlign: "left", border: `1px solid ${accent}26`, background: darkMode ? `linear-gradient(135deg, ${accent}12 0%, rgba(12,12,16,0.42) 58%, rgba(18,10,14,0.30) 100%)` : `linear-gradient(135deg, ${accent}0d 0%, rgba(255,255,255,0.54) 65%, rgba(255,250,250,0.36) 100%)`, borderRadius: 14, padding: "12px", cursor: "pointer", fontFamily: "inherit", display: "grid", gridTemplateColumns: "54px 1fr", gap: 10 }}>
                <div style={{ width: 54, height: 74, borderRadius: 10, overflow: "hidden", background: darkMode ? "#0d1117" : "#e2e8f0" }}>
                  {item.cover ? <img src={item.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e" }}>{MEDIA_TYPES.find(t => t.id === item.type)?.icon || "★"}</div>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: accent, marginBottom: 6 }}>{quickCopy[slot]?.title || (lang === "en" ? "Pick" : "Escolha")}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.15, fontWeight: 800, color: darkMode ? "#f8fafc" : "#0f172a", marginBottom: 5 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: darkMode ? "#94a3b8" : "#64748b", marginBottom: 6 }}>{quickCopy[slot]?.desc}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: darkMode ? "#cbd5e1" : "#475569", fontWeight: 700 }}>{getMediaTypeLabel(item.type, lang)}</span>
                    {(item.userRating > 0 || item.score) && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 800 }}>★ {item.userRating > 0 ? item.userRating : item.score}</span>}
                    {(() => { const ct = getConsumptionTime(item); return ct ? <span style={{ fontSize: 10, fontWeight: 800, color: ct.color, background: ct.color + "18", borderRadius: 5, padding: "1px 5px" }}>{ct.emoji} {lang === "en" ? ct.labelEn : ct.label}</span> : null; })()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
