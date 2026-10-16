import { useMemo, useState } from "react";
import { ThemeContext, useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { TypeIcon } from "./TypeIcon";
import { CoverImg } from "./CoverImg";
import { FriendAvatar } from "./FriendAvatar";
import { ProfileStats } from "./ProfileStats";
import { ProfileTabCompletos } from "./ProfileTabCompletos";
import { ProfileTabDiario } from "./ProfileTabDiario";

const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

// ── Componentes estáveis (definidos fora para não remontarem a cada render) ──
function Star({ size = 10 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#fbbf24" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg>;
}

function Poster({ item, onOpen, darkMode, outline, badge }) {
  const src = item.customCover || item.cover || item.thumbnailUrl;
  return (
    <div className="recent-card" onClick={() => onOpen && onOpen(item)} title={item.title} style={{ minWidth: 0, cursor: onOpen ? "pointer" : "default" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", background: gradientFor(item.id),
        border: `1px solid ${outline || (darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)")}`, boxShadow: "0 14px 24px -14px rgba(0,0,0,0.85)" }}>
        {src ? <CoverImg src={src} alt={item.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff" }}><TypeIcon id={item.type} /></div>}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "46%", background: "linear-gradient(to top, rgba(0,0,0,0.82), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 7, fontSize: 11.5, fontWeight: 700, lineHeight: 1.25, color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", pointerEvents: "none" }}>{item.title}</div>
        {item.userRating > 0 && (
          <div style={{ position: "absolute", right: 6, top: 6, display: "flex", alignItems: "center", gap: 3, padding: "2px 7px 2px 5px", borderRadius: 8, background: "rgba(0,0,0,0.62)", color: "#fff", fontSize: 10.5, fontWeight: 800, pointerEvents: "none" }}><Star />{item.userRating}</div>
        )}
        {badge}
      </div>
    </div>
  );
}

function Section({ title, count, children, muted, accent, right }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, margin: 0 }}>{title}</h3>
        {count != null && <span style={{ fontSize: 10, fontWeight: 800, color: accent, background: `${accent}1c`, padding: "1px 8px", borderRadius: 20 }}>{count}</span>}
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)" }} />
        {right}
      </div>
      {children}
    </section>
  );
}

export function FriendProfile({ info, data, library, onBack, onRemove, onOpenItem }) {
  const theme = useTheme();
  const { darkMode, isMobileDevice, panelBg } = theme;
  const { lang } = useLang();
  const en = lang === "en";
  const prof = data.profile || {};
  const fAccent = isHex(prof.accent) ? prof.accent : theme.accent;
  const accent = fAccent;
  const [tab, setTab] = useState("perfil");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const libItems = useMemo(() => Object.values(data.library || {}), [data.library]);
  const name = prof.name || info?.name || prof.username || (en ? "User" : "Utilizador");
  const completed = useMemo(() => libItems.filter(i => i.userStatus === "completo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [libItems]);
  const inProgress = useMemo(() => libItems.filter(i => i.userStatus === "assistindo").sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [libItems]);
  const hall = useMemo(() => (data.hall || []).slice(0, 10).map(h => {
    const lib = data.library?.[h.id];
    return lib ? { ...h, userRating: lib.userRating ?? h.userRating } : h;
  }), [data.hall, data.library]);
  const featuredId = data.featured?.id;
  const favs = Array.isArray(prof.favorites) ? prof.favorites : [];

  // Em comum + afinidade (diferença média entre notas dadas ao mesmo título)
  const common = useMemo(() => {
    const out = [];
    libItems.forEach(fi => {
      const m = findLibraryEntry(library || {}, fi.id, fi.type)?.item;
      if (m) out.push({ fi, m });
    });
    const pairs = out.filter(({ fi, m }) => fi.userRating > 0 && m.userRating > 0);
    const affinity = pairs.length >= 3 ? Math.max(0, Math.round(100 - (pairs.reduce((a, { fi, m }) => a + Math.abs(fi.userRating - m.userRating), 0) / pairs.length) * 10)) : null;
    return { all: out, both: out.filter(({ fi, m }) => fi.userStatus === "completo" && m.userStatus === "completo"), affinity };
  }, [libItems, library]);

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)";
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || glass, borderRadius: 20, border: `1px solid ${line}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };
  const pad = isMobileDevice ? 16 : 0;

  const gridCols = isMobileDevice ? "repeat(3, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))";
  const openItem = (it) => onOpenItem && onOpenItem(it);

  const row = (list, cols = 15) => (
    <div className="hscroll" style={{ padding: "6px 4px 12px", margin: "-6px -4px -8px", gap: 12 }}>
      {list.slice(0, cols).map(it => <div key={it.id} style={{ width: isMobileDevice ? 104 : 124 }}><Poster item={it} onOpen={openItem} darkMode={darkMode} /></div>)}
    </div>
  );

  const hofBlock = hall.length > 0 && (
    <Section title="Hall of Fame" count={`${hall.length}/10`} muted={muted} accent={accent}>
      {isMobileDevice ? (
        <div className="hscroll" style={{ padding: "4px 16px 14px", margin: "0 -16px", gap: 10, display: "grid", gridTemplateRows: "repeat(2, auto)", gridAutoFlow: "column", gridAutoColumns: "clamp(104px, 29vw, 128px)" }}>
          {hall.map(h => <Poster key={h.id} item={h} onOpen={openItem} darkMode={darkMode} outline={h.id === featuredId ? accent : null}
            badge={h.id === featuredId ? <div title={en ? "Featured" : "Em destaque"} aria-label={en ? "Featured" : "Em destaque"} style={{ position: "absolute", left: 6, top: 6, width: 20, height: 20, borderRadius: 7, background: accent, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg></div> : null} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14, padding: "6px 4px 10px", margin: "-6px -4px -10px" }}>
          {hall.map(h => <Poster key={h.id} item={h} onOpen={openItem} darkMode={darkMode} outline={h.id === featuredId ? accent : null}
            badge={h.id === featuredId ? <div title={en ? "Featured" : "Em destaque"} aria-label={en ? "Featured" : "Em destaque"} style={{ position: "absolute", left: 6, top: 6, width: 20, height: 20, borderRadius: 7, background: accent, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg></div> : null} />)}
        </div>
      )}
    </Section>
  );

  const favByType = {};
  favs.forEach(f => { (favByType[f.type] = favByType[f.type] || []).push(f); });
  const favTypes = MEDIA_TYPES.slice(1).filter(t => favByType[t.id]?.length);

  const tabs = [
    { id: "perfil", label: en ? "Profile" : "Perfil" },
    { id: "completos", label: en ? "Completed" : "Completos" },
    { id: "diario", label: en ? "Diary" : "Diário" },
  ];

  return (
    <ThemeContext.Provider value={{ ...theme, accent: fAccent }}>
      <div style={{ maxWidth: isMobileDevice ? 600 : 1100, margin: "0 auto", padding: isMobileDevice ? "12px 0 28px" : "24px 28px 40px", color: text }}>
        {/* Barra de topo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${pad}px`, marginBottom: 14 }}>
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px 7px 10px", borderRadius: 999, border: `1px solid ${line}`, background: "transparent", color: text, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>{en ? "Friends" : "Amigos"}
          </button>
          {confirmRemove ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: muted }}>{en ? "Remove friend?" : "Remover amigo?"}</span>
              <button onClick={onRemove} style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid #ef444466", background: "#ef444422", color: "#f87171", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{en ? "Remove" : "Remover"}</button>
              <button onClick={() => setConfirmRemove(false)} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${line}`, background: "transparent", color: muted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${line}`, background: "transparent", color: muted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{en ? "Remove friend" : "Remover amigo"}</button>
          )}
        </div>

        {/* Cartão principal (sem banner — os banners já não existem no teu perfil) */}
        <div style={{ ...card, margin: `0 ${pad}px 18px`, position: "relative", overflow: "hidden", padding: isMobileDevice ? "18px 16px" : "22px 24px" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 0% 0%, ${accent}30, transparent 60%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: isMobileDevice ? 14 : 18, flexWrap: "wrap" }}>
            <FriendAvatar src={prof.avatar || info?.avatar} name={name} size={isMobileDevice ? 68 : 84} ring={accent} ringWidth={3} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontSize: isMobileDevice ? 21 : 25, fontWeight: 800, lineHeight: 1.15, margin: 0, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</h2>
              {prof.username && <div style={{ fontSize: 13, color: muted, marginTop: 3 }}>@{prof.username}</div>}
              {prof.bio && <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5, color: darkMode ? "#aab4c0" : "#475569" }}>{prof.bio}</p>}
            </div>
            {common.all.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 14, background: `${accent}18`, border: `1px solid ${accent}44`, fontSize: 12.5, fontWeight: 700, color: text }}>
                {common.affinity != null && <span style={{ color: accent, fontSize: 20, fontWeight: 800 }}>{common.affinity}%</span>}
                <span style={{ color: muted, fontWeight: 600 }}>{common.affinity != null ? (en ? "taste match · " : "afinidade · ") : ""}{common.all.length} {en ? "in common" : "em comum"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Separadores */}
        <div style={{ display: "flex", gap: 4, margin: `0 ${pad}px 20px`, borderBottom: `1px solid ${line}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: isMobileDevice ? "10px 14px" : "11px 20px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? accent : "transparent"}`, marginBottom: -1, color: tab === t.id ? accent : muted, fontFamily: "inherit", fontSize: 13, fontWeight: tab === t.id ? 800 : 600, cursor: "pointer" }}>{t.label}</button>
          ))}
        </div>

        {tab === "perfil" && (
          <div style={{ padding: `0 ${pad}px` }}>
            {libItems.length === 0 ? (
              <div style={{ ...card, padding: "40px 20px", textAlign: "center", color: muted, fontSize: 14 }}>{en ? "This library is empty (or private)." : "Esta biblioteca está vazia (ou privada)."}</div>
            ) : (
              <>
                <div style={{ marginBottom: 26 }}><ProfileStats items={libItems} panelBg={panelBg} /></div>
                {hofBlock}
                {common.both.length > 0 && (
                  <Section title={en ? "Completed by both" : "Completos por ambos"} count={common.both.length} muted={muted} accent={accent}>
                    <div className="hscroll" style={{ padding: "6px 4px 12px", margin: "-6px -4px -8px", gap: 12 }}>
                      {common.both.slice(0, 15).map(({ fi, m }) => (
                        <div key={fi.id} style={{ width: isMobileDevice ? 104 : 124 }}>
                          <Poster item={fi} onOpen={openItem} darkMode={darkMode}
                            badge={m.userRating > 0 && fi.userRating > 0 && m.userRating !== fi.userRating ? (
                              <div style={{ position: "absolute", left: 6, top: 6, padding: "2px 7px", borderRadius: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 800, pointerEvents: "none" }}>{en ? "You" : "Tu"} ★{m.userRating}</div>
                            ) : null} />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {favTypes.length > 0 && (
                  <Section title={en ? "Favorites" : "Favoritos"} count={favs.length} muted={muted} accent={accent}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {favTypes.map(t => (
                        <div key={t.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: text, marginBottom: 9 }}>
                            <TypeIcon id={t.id} />{mediaLabel(t, lang)}<span style={{ color: muted, fontWeight: 600 }}>{favByType[t.id].length}</span>
                          </div>
                          {isMobileDevice ? row(favByType[t.id], 24) : (
                            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, padding: "6px 4px 10px", margin: "-6px -4px -10px" }}>
                              {favByType[t.id].slice(0, 12).map(f => <Poster key={f.id} item={f} onOpen={openItem} darkMode={darkMode} />)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {completed.length > 0 && <Section title={en ? "Completed" : "Completados"} count={completed.length} muted={muted} accent={accent}>{row(completed, 15)}</Section>}
                {inProgress.length > 0 && <Section title={en ? "In progress" : "Em curso"} count={inProgress.length} muted={muted} accent={accent}>{row(inProgress, 15)}</Section>}
              </>
            )}
          </div>
        )}
        {tab === "completos" && (
          <ProfileTabCompletos items={libItems} library={data.library} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={openItem} />
        )}
        {tab === "diario" && (
          <ProfileTabDiario items={libItems} accent={accent} darkMode={darkMode} isMobileDevice={isMobileDevice} lang={lang} onOpen={openItem} />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
