import { useState, useEffect } from "react";
import { TypeIcon } from "./TypeIcon";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { fetchExplore } from "../api/explore";
import { LandingSections } from "./LandingSections";

// Capas do ecrã de início: tipos variados para mostrar que há de tudo
const COVER_SLOTS = ["anime", "jogos", "filmes", "manga", "series", "visualnovels", "manhwa", "lightnovels", "anime", "jogos", "filmes", "manga", "series", "anime", "jogos"];
const COVER_HUE = { anime: 235, manga: 350, series: 190, filmes: 35, jogos: 140, visualnovels: 340, manhwa: 320, lightnovels: 280 };
const LAND_TYPES = ["anime", "manga", "filmes", "series", "jogos", "visualnovels", "livros", "manhwa", "lightnovels", "comics"];

function useLandingCovers(workerUrl) {
  const [byType, setByType] = useState({});
  useEffect(() => {
    let off = false;
    [...new Set(COVER_SLOTS)].forEach((type) => {
      fetchExplore({ type, sort: "trending", year: null, status: "", page: 1 }, workerUrl)
        .then((r) => { if (!off) setByType((p) => ({ ...p, [type]: (r.items || []).filter((i) => i.cover) })); })
        .catch(() => {});
    });
    return () => { off = true; };
  }, [workerUrl]);
  const used = {};
  return COVER_SLOTS.map((type, idx) => {
    const list = byType[type] || [];
    const item = list[used[type] = (used[type] ?? -1) + 1];
    return { type, idx, item };
  });
}

function LandCover({ type, item, idx, lang }) {
  const h = (COVER_HUE[type] ?? 220) + (idx >= 8 ? 14 : 0);
  return (
    <div className="land-cover" style={{ background: `linear-gradient(160deg, hsl(${h},50%,40%), hsl(${(h + 40) % 360},56%,12%))` }}>
      {item?.cover && <img src={item.cover} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      {item?.score > 0 && <span className="land-cover-score">★ {item.score}</span>}
      {item?.title && <div className="land-cover-title">{item.title}</div>}
    </div>
  );
}

export function LandingPage({ accent, onEnter, onDemo, lang = "en", useT = (k) => k, changeLang, workerUrl }) {
  const covers = useLandingCovers(workerUrl);
  const accentRgb = `${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}`;
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'Outfit', 'Segoe UI', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradAnim { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        .land-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); align-items: center; gap: 24px; padding: 0 64px; min-height: 730px; }
        .land-hero-text { padding: 56px 0; position: relative; z-index: 2; }
        .land-types { display: flex; flex-wrap: wrap; gap: 10px 22px; margin-top: 40px; max-width: 620px; font-size: 13.5px; font-weight: 700; color: #8b949e; }
        .land-types span { display: inline-flex; align-items: center; gap: 7px; }
        .land-link:hover { color: #fff !important; border-bottom-color: #9ca3af !important; }
        .land-covers { position: absolute; right: 24px; top: -40px; bottom: 0; width: 50%; display: flex; gap: 16px; justify-content: flex-end; transform: rotate(6deg); transform-origin: top right; pointer-events: none; -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 92%, transparent), linear-gradient(transparent, #000 4%, #000 82%, transparent); -webkit-mask-composite: source-in; mask-image: linear-gradient(90deg, transparent, #000 14%, #000 92%, transparent), linear-gradient(transparent, #000 4%, #000 82%, transparent); mask-composite: intersect; }
        .land-col { display: flex; flex-direction: column; gap: 16px; width: 168px; flex: none; align-self: flex-start; }
        .land-col-0 { margin-top: 20px; animation: landDrift 22s ease-in-out infinite alternate; }
        .land-col-1 { margin-top: -60px; animation: landDrift 26s ease-in-out infinite alternate-reverse; }
        .land-col-2 { margin-top: 60px; animation: landDrift 24s ease-in-out infinite alternate; }
        @keyframes landDrift { from { transform: translateY(-36px); } to { transform: translateY(36px); } }
        .land-cover { position: relative; overflow: hidden; flex: none; width: 100%; aspect-ratio: 2/3; border-radius: 10px; box-shadow: 0 18px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1); }
        .land-cover-score { position: absolute; top: 8px; right: 8px; padding: 2px 6px; border-radius: 6px; background: rgba(0,0,0,0.65); color: #fbbf24; font-size: 10.5px; font-weight: 800; }
        .land-cover-title { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 9px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.82)); font-size: 11.5px; font-weight: 800; color: #fff; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .land-nav button { white-space: nowrap; }
        @media (max-width: 960px) {
          .land-nav { padding: 14px 16px !important; }
          .land-nav button { padding: 8px 14px !important; font-size: 13px !important; }
          .land-cover-score { display: none; }
          .land-hero { grid-template-columns: 1fr; padding: 0 22px; min-height: 0; }
          .land-hero-text { padding: 40px 0 8px; }
          .land-covers { position: relative; right: auto; top: auto; bottom: auto; width: 100%; height: 330px; justify-content: center; transform: none; margin-top: 10px; }
          .land-col { width: 30%; max-width: 168px; }
        }
        @media (prefers-reduced-motion: reduce) { .land-col { animation: none !important; } }
        .land-fade { animation: fadeUp 0.7s ease forwards; }
        .land-float { animation: float 4s ease-in-out infinite; }
        .land-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 40px rgba(${accentRgb},0.5) !important; }
        .land-btn2:hover { transform: translateY(-2px) !important; background: rgba(255,255,255,0.12) !important; }
        .feat-card:hover { transform: translateY(-4px); border-color: ${accent}55 !important; }
        .feat-card { transition: all 0.2s; }
      `}</style>

      {/* Nav */}
      <nav className="land-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid #21262d", position: "sticky", top: 0, background: "rgba(13,17,23,0.9)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white" }}>T</div>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#e6edf3", letterSpacing: "-0.5px" }}>TrackAll</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onDemo} className="land-btn2" style={{ padding: "9px 20px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>{useT("landingDemoBtn")}</button>
          <button onClick={onEnter} className="land-btn" style={{ padding: "9px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 4px 20px rgba(${accentRgb},0.3)` }}>{useT("signIn")}</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="land-hero">
        <div className="land-hero-text land-fade" style={{ animationDelay: "0.1s", opacity: 0 }}>
          <h1 style={{ fontSize: "clamp(40px, 5.6vw, 72px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: 22, backgroundImage: `linear-gradient(135deg, #e6edf3 30%, ${accent} 75%)`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>
            {lang === "en" ? <>All your media.<br/>In one place.</> : <>Toda a tua mídia.<br/>Num só lugar.</>}
          </h1>
          <p style={{ fontSize: 19, color: "#8b949e", maxWidth: 560, lineHeight: 1.7, margin: "0 0 34px" }}>{useT("landingDesc")}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
            <button onClick={onEnter} className="land-btn" style={{ padding: "16px 44px", borderRadius: 12, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 16, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 12px 36px ${accent}44`, transition: "all 0.2s" }}>
              {useT("landingStart")}
            </button>
            <button onClick={onDemo} className="land-link" style={{ background: "none", border: "none", borderBottom: "1px solid #4b5563", padding: "0 0 3px", color: "#e6edf3", cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "inherit" }}>
              {useT("landingDemo")} →
            </button>
          </div>
          <div className="land-types">
            {LAND_TYPES.map((id) => {
              const t = MEDIA_TYPES.find((m) => m.id === id);
              return t ? <span key={id}><TypeIcon id={id} /> {mediaLabel(t, lang)}</span> : null;
            })}
          </div>
        </div>
        <div className="land-covers" aria-hidden="true">
          {[[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14]].map((col, ci) => (
            <div key={ci} className={`land-col land-col-${ci}`}>
              {col.map((i) => <LandCover key={i} {...covers[i]} lang={lang} />)}
            </div>
          ))}
        </div>
      </section>

      <LandingSections lang={lang} accent={accent} />

      {/* CTA Final */}
      <section style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", background: `linear-gradient(135deg, ${accent}18 0%, #8b5cf618 100%)`, border: `1px solid ${accent}33`, borderRadius: 24, padding: "60px 40px" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px", marginBottom: 16 }}>{useT("landingReadyTitle")}</h2>
          <p style={{ color: "#8b949e", fontSize: 16, marginBottom: 36, lineHeight: 1.6 }}>{lang === "en" ? "Create your free account and start organising your library today." : "Cria a tua conta gratuita e começa a organizar a tua biblioteca hoje."}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onEnter} className="land-btn" style={{ padding: "14px 36px", borderRadius: 12, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 6px 24px rgba(${accentRgb},0.35)` }}>
              {useT("landingCreateFree")}
            </button>
            <button onClick={onDemo} className="land-btn2" style={{ padding: "14px 28px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
              {useT("landingDemoFirst")}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #21262d", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "white" }}>T</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#484f58" }}>TrackAll</span>
        </div>
        <span style={{ fontSize: 12, color: "#30363d" }}>{useT("landingMadeWith")}</span>
      </footer>
    </div>
  );
}
