import { useEffect, useState } from "react";
import { fetchMediaDetails } from "../../api/details";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, getMediaTypeLabel } from "../../config/constants";
import { HOME_R, homeLine, homeLineStrong, homeMuted, homePanel, homeText, itemBanner, itemSynopsis, cleanText, monthsSince, seededRandom, dayNumber } from "./homeUtils";
import { useHomePicks } from "./useHomePicks";

function Cover({ item, w, h, darkMode }) {
  const typeObj = MEDIA_TYPES.find((t) => t.id === item.type);
  const src = item.customCover || item.cover;
  return (
    <div style={{ width: w, height: h, flexShrink: 0, borderRadius: HOME_R, overflow: "hidden", background: darkMode ? "#0d1117" : "#e2e8f0", border: `1px solid ${homeLine(darkMode)}` }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 22 }}>{typeObj?.icon || "★"}</div>}
    </div>
  );
}

const rating = (item) => (item.userRating > 0 ? item.userRating : item.score);

// «Melhor para hoje» (cartão clicável, com fundo) + 4 atalhos em linha.
export function HomeQuickPicks({ items, homeDashboard, personalRecos, setSelectedItem }) {
  const { accent, darkMode, panelBg, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const picks = useHomePicks(items);
  const dash = homeDashboard.quickPicks || [];
  const bySlot = (s) => dash.find((p) => p.slot === s)?.item;

  const hero = picks.today || bySlot("today");
  const forgotten = picks.forgotten || bySlot("forgotten");
  const focus = bySlot("focus") || bySlot("continue");
  const back = bySlot("return");
  const novo = (personalRecos && personalRecos.length) ? personalRecos[Math.floor(seededRandom(dayNumber() * 7)() * personalRecos.length)] : null;

  // Banner e sinopse completa vêm dos detalhes (mesma cache do modal); até chegarem usa a capa e a sinopse guardada.
  const [extra, setExtra] = useState({ id: null, d: null });
  const heroId = hero?.id;
  useEffect(() => {
    if (!hero) return undefined;
    let alive = true;
    fetchMediaDetails(hero).then((d) => { if (alive && d) setExtra({ id: heroId, d }); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroId]);
  const heroExtra = extra.id === heroId ? extra.d : null;

  const shortcuts = [
    focus && { key: "focus", label: lang === "en" ? "Current focus" : "Foco atual", item: focus },
    forgotten && { key: "forgotten", label: lang === "en" ? "Forgotten in queue" : "Esquecido na lista", item: forgotten, reroll: picks.rerollForgotten },
    back && { key: "return", label: lang === "en" ? "Worth returning" : "Vale voltar", item: back },
    novo && { key: "new", label: lang === "en" ? "Something new" : "Algo novo", item: novo },
  ].filter(Boolean);

  if (!hero && !shortcuts.length) return null;
  const line = homeLine(darkMode);
  const muted = homeMuted(darkMode);
  const pad = isMobileDevice ? 16 : 24;

  const heroCard = hero && (() => {
    const banner = itemBanner(hero) || heroExtra?.bannerImage || "";
    const bg = banner || hero.customCover || hero.cover || "";
    const syn = cleanText(heroExtra?.synopsis) || itemSynopsis(hero);
    const meta = [getMediaTypeLabel(hero.type, lang), hero.year, heroExtra?.runtime].filter(Boolean).join(" · ");
    const waited = monthsSince(hero.addedAt);
    const chips = [...(hero.genres || []).slice(0, 3), waited >= 1 ? (lang === "en" ? `Planned ${waited}m ago` : `Planeado há ${waited}m`) : null].filter(Boolean);
    const r = rating(hero);
    return (
      <div onClick={() => setSelectedItem(hero)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelectedItem(hero); }}
        style={{ position: "relative", cursor: "pointer", overflow: "hidden", borderRadius: HOME_R, border: `1px solid ${homeLineStrong(darkMode)}`, background: homePanel(darkMode, panelBg), minHeight: isMobileDevice ? 150 : 236 }}>
        {bg && <div aria-hidden style={{ position: "absolute", inset: banner ? 0 : -24, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: banner ? "center 30%" : "center", filter: banner ? "none" : "blur(26px) saturate(1.1)", opacity: banner ? 0.9 : 0.55 }} />}
        <div aria-hidden style={{ position: "absolute", inset: 0, background: darkMode ? "linear-gradient(90deg, rgba(10,12,16,0.96) 0%, rgba(10,12,16,0.8) 42%, rgba(10,12,16,0.12) 100%)" : "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.82) 42%, rgba(255,255,255,0.15) 100%)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
          <div style={{ width: isMobileDevice ? 96 : 160, flexShrink: 0, alignSelf: "stretch", position: "relative", background: darkMode ? "#0d1117" : "#e2e8f0", borderRight: `1px solid ${homeLineStrong(darkMode)}`, overflow: "hidden" }}>
            {(hero.customCover || hero.cover) ? <img src={hero.customCover || hero.cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} /> : <div style={{ width: "100%", height: "100%", minHeight: 130, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 28 }}>{(MEDIA_TYPES.find((t) => t.id === hero.type) || {}).icon || "★"}</div>}
          </div>
          <div style={{ minWidth: 0, flex: 1, maxWidth: 760, padding: isMobileDevice ? "14px 44px 14px 14px" : "22px 52px 22px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, border: `1px solid ${accent}66`, background: `${accent}14`, borderRadius: HOME_R, padding: "4px 10px" }}>{lang === "en" ? "Best for today" : "Melhor para hoje"}</span>
              <span style={{ fontSize: 12, color: muted }}>{meta}</span>
              {r > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#e8b04a" }}>★ {r}</span>}
            </div>
            <h3 style={{ fontSize: isMobileDevice ? 22 : 38, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.06, margin: isMobileDevice ? "8px 0 4px" : "10px 0 8px", color: homeText(darkMode) }}>{hero.title}</h3>
            {chips.length > 0 && !isMobileDevice && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {chips.map((c) => <span key={c} style={{ fontSize: 11.5, fontWeight: 700, color: darkMode ? "#c3c9d3" : "#475569", border: `1px solid ${homeLineStrong(darkMode)}`, borderRadius: HOME_R, padding: "3px 9px" }}>{c}</span>)}
              </div>
            )}
            {syn ? <p style={{ fontSize: isMobileDevice ? 12 : 13.5, lineHeight: 1.55, color: darkMode ? "#b9c0cb" : "#475569", margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{syn}</p>
              : !isMobileDevice && <p style={{ fontSize: 13.5, lineHeight: 1.55, color: darkMode ? "#b9c0cb" : "#475569", margin: 0 }}>{lang === "en" ? "Your strongest pick right now, based on your ratings, favourite genres and how long it has been waiting." : "A tua aposta mais forte neste momento, pela tua média, os teus géneros e o tempo que está à espera."}</p>}
          </div>
        </div>
        {(picks.today) && (
          <button onClick={(e) => { e.stopPropagation(); picks.rerollToday(); }} title={lang === "en" ? "Another suggestion" : "Outra sugestão"} aria-label={lang === "en" ? "Another suggestion" : "Outra sugestão"}
            style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: HOME_R, border: `1px solid ${homeLineStrong(darkMode)}`, background: darkMode ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)", color: darkMode ? "#c3c9d3" : "#475569", cursor: "pointer", fontSize: 15, fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>↻</button>
        )}
      </div>
    );
  })();

  const shortcutRow = shortcuts.length > 0 && (
    <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "1fr" : `repeat(${shortcuts.length}, minmax(0, 1fr))`, gap: isMobileDevice ? 0 : 12, marginTop: 12, ...(isMobileDevice ? { border: `1px solid ${line}`, borderRadius: HOME_R, background: homePanel(darkMode, panelBg) } : {}) }}>
      {shortcuts.map((s, i) => {
        const r = rating(s.item);
        return (
          <button key={s.key} onClick={() => setSelectedItem(s.item)} style={{ position: "relative", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, padding: isMobileDevice ? "10px 14px" : 12, color: "inherit", minWidth: 0,
            ...(isMobileDevice ? { background: "none", border: "none", borderTop: i ? `1px solid ${line}` : "none" } : { background: homePanel(darkMode, panelBg), border: `1px solid ${line}`, borderRadius: HOME_R }) }}>
            <Cover item={s.item} w={isMobileDevice ? 34 : 44} h={isMobileDevice ? 51 : 66} darkMode={darkMode} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: homeText(darkMode), margin: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.item.title}</div>
              <div style={{ fontSize: 12, color: muted }}>{getMediaTypeLabel(s.item.type, lang)}{r > 0 ? ` · ★ ${r}` : ""}</div>
            </div>
            {s.reroll && (
              <span role="button" tabIndex={0} title={lang === "en" ? "Another one" : "Outro"} onClick={(e) => { e.stopPropagation(); s.reroll(); }} style={{ flexShrink: 0, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${line}`, borderRadius: HOME_R, color: muted, fontSize: 13 }}>↻</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ padding: `0 ${pad}px 28px` }}>
      {heroCard}
      {shortcutRow}
    </div>
  );
}
