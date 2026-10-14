import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa } from "../config/supabase";
import { MEDIA_TYPES, TYPE_COLORS, mediaLabel, getMediaTypeLabel } from "../config/constants";
import { accentShade, accentVariant } from "../config/theme";
import { getConsumptionTime } from "../lib/consumptionTime";
import { MediaCard } from "../components/MediaCard";
import { TiltCard } from "../components/TiltCard";
import { RecoCarousel } from "../components/RecoCarousel";
import { TypeIcon } from "../components/TypeIcon";

// ─── Vista Home (dashboard) ───
// O estado e os cálculos (stats, homeDashboard, recos...) vivem no TrackAll; esta vista só os mostra.
export function HomeView({ view, setView, profile, user, items, library, setLibrary, stats, homeStatColors, homeDashboard, homeFilter, setHomeFilter, graveyardOpen, setGraveyardOpen, recos, personalRecos, recoLoading, loadRecos, setFilterStatus, setSelectedItem }) {
  const { accent, darkMode, isMobileDevice, panelBg } = useTheme();
  const { lang, useT } = useLang();
  return (
    <div style={{ display: view === "home" ? "block" : "none" }}>
        {/* ── HOME ── */}
          <div style={{ paddingLeft: 0, paddingRight: 0 }}>
            {/* Hero — Avatar + Stats side by side */}
            <div className="hero-gradient" style={{ padding: "16px 16px 14px" }}>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                {/* Avatar + Name + Stats */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  {/* Avatar compacto */}
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                    border: `2.5px solid ${accent}`,
                    boxShadow: `0 0 0 3px ${accent}33`,
                    background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                  }}>
                    {profile.avatar
                      ? <img src={profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : "👤"}
                  </div>
                  {/* Right: nome + stats numa linha */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1.1, marginBottom: 2, backgroundImage: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      {profile.name || "Utilizador"}
                    </h2>
                    <p style={{ fontSize: 12, color: darkMode ? "#6b7280" : "#94a3b8", marginBottom: 8, fontWeight: 500 }}>
                      <span style={{ color: darkMode ? "#c9d1d9" : "#475569", fontWeight: 700 }}>{items.length}</span> {useT("inLibraryCount")}
                    </p>
                    {/* Stats compactas numa linha */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { l: lang === "en" ? "Progress" : "Curso",   v: stats.assistindo, key: "assistindo" },
                        { l: useT("completo"),                        v: stats.completo,   key: "completo"   },
                        { l: lang === "en" ? "Paused" : "Pausa",     v: stats.pausa,      key: "pausa"      },
                        { l: useT("dropado"),                         v: stats.largado,    key: "largado"    },
                        { l: lang === "en" ? "Planned" : "Planej.",   v: stats.planejado,  key: "planejado"  },
                      ].filter(s => s.v > 0).map((s) => {
                        const col = homeStatColors[s.key];
                        return (
                          <div key={s.l} style={{
                            flex: "1 1 0", minWidth: 0,
                            background: `${col}14`,
                            borderLeft: `2px solid ${col}`,
                            borderRadius: "0 6px 6px 0",
                            padding: "4px 5px",
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: col, lineHeight: 1 }}>{s.v}</div>
                            <div style={{ color: "#8b949e", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 1 }}>{s.l}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Filter tags — tab style */}
                <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                  {MEDIA_TYPES.slice(1).map((t) => {
                    const active = homeFilter.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => {
                        setHomeFilter(prev =>
                          prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                        );
                      }} style={{
                        flexShrink: 0, background: "none", border: "none",
                        borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
                        marginBottom: -1,
                        color: active ? accent : (darkMode ? "#8b949e" : "#64748b"),
                        padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        WebkitTapHighlightColor: "transparent",
                      }}>
                        {mediaLabel(t, lang)}
                      </button>
                    );
                  })}
                  {homeFilter.length > 0 && (
                    <button onClick={() => setHomeFilter([])} style={{
                      flexShrink: 0, background: "none", border: "none",
                      borderBottom: "2px solid transparent", marginBottom: -1,
                      color: "#ef4444", padding: "8px 10px",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                      WebkitTapHighlightColor: "transparent",
                    }}>✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats strip rápido ── */}
            {items.length > 0 && (() => {
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
            })()}

            {items.length > 0 && homeDashboard.quickPicks.length > 0 && (() => {
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
            })()}

            {/* Recent — filtered by homeFilter */}
            {items.length === 0 && (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🎬</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: darkMode ? "#e6edf3" : "#0d1117" }}>{lang === "en" ? "Your library is empty" : "A tua biblioteca está vazia"}</h3>
                <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 24, lineHeight: 1.5 }}>{lang === "en" ? "Start adding anime, movies, games and much more" : "Começa a adicionar animes, filmes, jogos e muito mais"}</p>
                <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 14, borderRadius: 12 }} onClick={() => setView("search")}>
                  {lang === "en" ? "+ Explore titles" : "+ Explorar títulos"}
                </button>
              </div>
            )}

            {items.length > 0 && (() => {
              const inCurso = items
                .filter(i => i.userStatus === "assistindo")
                .filter(i => homeFilter.length === 0 || homeFilter.includes(i.type))
                .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
                .slice(0, 20);

              const completados = items
                .filter(i => i.userStatus === "completo")
                .filter(i => homeFilter.length === 0 || homeFilter.includes(i.type))
                .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
                .slice(0, 20);

              if (inCurso.length === 0 && completados.length === 0 && homeFilter.length > 0) return (
                <div style={{ padding: "28px 16px", textAlign: "center", color: darkMode ? "#484f58" : "#94a3b8" }}>
                  <p style={{ fontSize: 14 }}>{lang === "en" ? "No items with this filter" : "Nenhum item com esse filtro"}</p>
                </div>
              );

              const RowSection = ({ title, icon, items: rowItems, filterBtn, collapsed, onToggleCollapse }) => rowItems.length === 0 ? null : (
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
                  {!collapsed && <div className="recents-row" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 8px 20px", margin: "-8px -8px -10px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                    {rowItems.map((item) => (
                      <div key={item.id} style={{ flexShrink: 0, width: "clamp(90px, 26vw, 130px)" }}>
                        <MediaCard item={item} library={library} onOpen={setSelectedItem} accent={accent} />
                      </div>
                    ))}
                  </div>}
                </div>
              );

              return (
                <>
                  <RowSection
                    title={useT("completedLabel")}
                    icon="✓"
                    items={completados}
                    filterBtn={
                      <button onClick={() => { setView("library"); setFilterStatus("completo"); }} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, paddingRight: 16 }}>{useT("verTudo")}</button>
                    }
                  />


                </>
              );
            })()}


            {/* ── Quando consumir? ── */}
            {(() => {
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
            })()}

            {/* ── Provavelmente nunca vais consumir ── */}
            {(() => {
              const SIX_MONTHS = 1000 * 60 * 60 * 24 * 180;
              const now = Date.now();
              const recentCompleted = items.filter(i => i?.userStatus === "completo").sort((a,b) => (b.addedAt||0)-(a.addedAt||0)).slice(0,20);
              const genreCounts = {};
              recentCompleted.forEach(i => (i.genres||[]).forEach(g => { genreCounts[g] = (genreCounts[g]||0)+1; }));
              const topGenres = new Set(Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([g])=>g));
              const graveyard = items.filter(i => {
                if (!i) return false;
                if (i.userStatus !== "planejado" && i.userStatus !== "planeado") return false;
                return (now - (i.addedAt || now)) > SIX_MONTHS;
              }).map(i => {
                const outOfPattern = topGenres.size > 0 && !(i.genres||[]).some(g => topGenres.has(g));
                const monthsOld = Math.floor((now-(i.addedAt||now))/(1000*60*60*24*30));
                const reason = outOfPattern ? (lang==="en" ? "out of your pattern" : "fora do teu padrão") : (lang==="en" ? `forgotten for ${monthsOld}m` : `esquecido há ${monthsOld}m`);
                return { ...i, reason, monthsOld };
              }).sort((a,b) => b.monthsOld-a.monthsOld);
              if (graveyard.length === 0) return null;
              const open = graveyardOpen;
              const visible = open ? graveyard : graveyard.slice(0,3);
              const removeItem = async (item) => {
                const cat = item.type+"s";
                setLibrary(prev => { const next={...prev}; if(next[cat]){next[cat]={...next[cat]};delete next[cat][item.id];} return next; });
                if (user) try { await supa.removeFromLibrary(user.id, item.id, item.type); } catch {}
              };
              return (
                <div style={{ margin: "20px 0 4px", padding: "0 16px" }}>
                  <div style={{ background: panelBg || (darkMode ? "rgba(12,12,16,0.30)" : "rgba(255,255,255,0.28)"), border: "1px solid #e74c3c30", borderRadius: 14, padding: "10px 12px 4px", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div>
                        <h3 style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e74c3c", marginBottom: 2 }}>
                          {lang==="en" ? "Probably never consuming this" : "Provavelmente nunca vais consumir"}
                        </h3>
                        <div style={{ fontSize: 11, color: "#8b949e" }}>{graveyard.length} {lang==="en" ? "titles · added 6+ months ago" : "títulos · adicionados há 6+ meses"}</div>
                      </div>
                    </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {visible.map(item => {
                      const cover = item.customCover || item.cover;
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "0.5px solid rgba(231,76,60,0.15)" }}>
                          <div onClick={() => setSelectedItem(item)} style={{ width: 52, height: 74, borderRadius: 6, overflow: "hidden", background: "#161b22", cursor: "pointer", flexShrink: 0 }}>
                            {cover ? <img src={cover} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={e=>e.currentTarget.style.display="none"}/> : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#484f58",fontSize:18 }}>?</div>}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 2 }}>{getMediaTypeLabel(item.type, lang)}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#f8fafc" : "#0f172a", marginBottom: 4, lineHeight: 1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                            <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 5 }}>{lang==="en" ? `Added ${item.monthsOld}m ago` : `Adicionado há ${item.monthsOld}m`}</div>
                            <span style={{ fontSize: 10, color: "#e2a84a", background: "rgba(226,168,74,0.12)", padding: "2px 7px", borderRadius: 4 }}>{item.reason}</span>
                          </div>
                          <button onClick={() => removeItem(item)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "0.5px solid rgba(231,76,60,0.4)", background: "transparent", color: "#e74c3c", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {lang==="en" ? "remove" : "remover"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {graveyard.length > 3 && (
                    <button onClick={() => setGraveyardOpen(v=>!v)} style={{ display:"block",width:"100%",padding:"10px 0",background:"none",border:"none",borderTop:"0.5px solid rgba(231,76,60,0.15)",color:"#8b949e",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"center" }}>
                      {open ? (lang==="en" ? "show less" : "mostrar menos") : `${lang==="en" ? "see all" : "ver todos"} (${graveyard.length})`}
                    </button>
                  )}
                  </div>
                </div>
              );
            })()}

            {/* Divider */}
            <div style={{ borderTop: "1px solid #21262d", margin: "0 16px 28px" }} />

            {/* ── Mini Insights ── */}
            {(() => {
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
              const SIX_MONTHS = 1000*60*60*24*180;
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
            })()}

            {/* Recommendations */}
            <div style={{ paddingBottom: 8 }}>
              <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", backgroundImage: `linear-gradient(90deg, ${accent}, ${accentShade(accent, 40)})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{lang === "en" ? "Featured" : "Em Destaque"}</h3>
                <button onClick={() => loadRecos(true)} disabled={recoLoading} style={{
                  background: "none", border: "none", color: recoLoading ? "#484f58" : accent,
                  cursor: recoLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: 0,
                }}>
                  <span style={{ display: "inline-block", animation: recoLoading ? "spin 0.7s linear infinite" : "none", fontSize: 14 }}>↻</span>
                  {recoLoading ? useT("loading") : useT("refresh")}
                </button>
              </div>
              <RecoCarousel title={lang === "en" ? "For You" : "Para Ti"} icon="✦" items={personalRecos} library={library} onOpen={setSelectedItem} loading={recoLoading} isPersonal={true} />
              <RecoCarousel title={useT("animeTrending")} icon="⛩️" items={recos.anime} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("mangaTrending")} icon="📖" items={recos.manga} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("moviesWeek")} icon="🎬" items={recos.filmes} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("seriesWeek")} icon="📺" items={recos.series} library={library} onOpen={setSelectedItem} loading={recoLoading} />
              <RecoCarousel title={useT("topGames")} icon="🎮" items={recos.jogos} library={library} onOpen={setSelectedItem} loading={recoLoading} />
            </div>
          </div>
    </div>
  );
}
