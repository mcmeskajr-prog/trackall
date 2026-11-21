import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { TypeIcon } from "../components/TypeIcon";
import { CoverImg } from "../components/CoverImg";
import { gradientFor } from "../lib/utils";
import { findLibraryEntry } from "../lib/mediaIds";
import { EXPLORE_TYPES, EXPLORE_SORTS, EXPLORE_STATUS, fetchExplore } from "../api/explore";

// ─── Explorar: grelha por tipo (AniList), com ordenação, ano e estado, e «Carregar mais» ───
// A vista fica montada em segundo plano (como as outras): o estado dos filtros e as páginas já carregadas mantêm-se.

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1989 }, (_, i) => THIS_YEAR - i);

export function ExploreView({ view, library, setSelectedItem, addToLibrary, workerUrl, onBack }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";
  const [type, setType] = useState("anime");
  const [sort, setSort] = useState("trending");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reqId = useRef(0);
  const [justAdded, setJustAdded] = useState(() => new Set()); // «Adicionado ✓» durante ~1,5 s depois de tocar

  const text = darkMode ? "#e6edf3" : "#0f172a", muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.16)";

  const load = useCallback(async (p, reset) => {
    const id = ++reqId.current;
    setLoading(true); setError(false);
    try {
      const r = await fetchExplore({ type, sort, year: year ? Number(year) : null, status, page: p }, workerUrl);
      if (id !== reqId.current) return; // chegou uma resposta mais recente
      setItems((prev) => {
        if (reset) return r.items;
        const seen = new Set(prev.map((x) => x.id));
        return prev.concat(r.items.filter((x) => !seen.has(x.id)));
      });
      setPage(p); setHasNext(r.hasNext);
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [type, sort, year, status, workerUrl]);

  // Só pede dados quando a vista é aberta pela 1.ª vez e sempre que um filtro muda
  const opened = useRef(false);
  useEffect(() => {
    if (view === "explore") opened.current = true;
    if (!opened.current) return;
    setItems([]); setHasNext(false);
    load(1, true);
  }, [view === "explore", type, sort, year, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const pill = (on) => ({ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", color: on ? "#fff" : (darkMode ? "#d2dae3" : "#475569"), ...(on ? { border: `1px solid ${accent}`, background: accent } : {}) });
  const select = { padding: "7px 10px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", color: text, flex: "none" };
  const tabs = MEDIA_TYPES.filter((t) => EXPLORE_TYPES.includes(t.id));

  return (
    <div style={{ display: view === "explore" ? "block" : "none" }}>
      <style>{`.xp-card .xp-add{opacity:0;transform:translateY(6px);transition:opacity .18s,transform .18s,background .2s,box-shadow .2s}.xp-card:hover .xp-add,.xp-card:focus-within .xp-add,.xp-card .xp-add.xp-done{opacity:1;transform:none}.xp-card .xp-add:hover{filter:brightness(1.1);box-shadow:0 8px 20px rgba(0,0,0,.5)}.xp-card .xp-add:active{transform:scale(.95)}.xp-card .xp-add.xp-done{background:#10b981!important;animation:xp-pop .35s ease}.xp-badge{animation:xp-pop .35s ease}@keyframes xp-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}.xp-row{scrollbar-width:none}.xp-row::-webkit-scrollbar{display:none}`}</style>
      <div style={{ padding: isMobileDevice ? "16px 16px 120px" : "24px 28px 60px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {isMobileDevice && onBack && (
            <button type="button" onClick={onBack} aria-label={en ? "Back" : "Voltar"} style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${line}`, background: "transparent", color: text, fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}>←</button>
          )}
          <h1 style={{ fontSize: isMobileDevice ? 22 : 26, fontWeight: 800, color: text, margin: 0 }}>{en ? "Explore" : "Explorar"}</h1>
        </div>

        <div className="xp-row" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={type === t.id ? "" : "glass-ctl"} onClick={() => setType(t.id)} style={pill(type === t.id)}><TypeIcon id={t.id} /> {mediaLabel(t, lang)}</button>
          ))}
        </div>

        <div className="xp-row" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "12px 0 16px" }}>
          <select className="glass-ctl" aria-label={en ? "Sort" : "Ordenar"} value={sort} onChange={(e) => setSort(e.target.value)} style={select}>
            {EXPLORE_SORTS.map((s) => <option key={s.id} value={s.id}>{en ? s.en : s.pt}</option>)}
          </select>
          <select className="glass-ctl" aria-label={en ? "Year" : "Ano"} value={year} onChange={(e) => setYear(e.target.value)} style={select}>
            <option value="">{en ? "Year: all" : "Ano: todos"}</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="glass-ctl" aria-label={en ? "Status" : "Estado"} value={status} onChange={(e) => setStatus(e.target.value)} style={select}>
            {EXPLORE_STATUS.map((s) => <option key={s.id} value={s.id}>{en ? `Status: ${s.en.toLowerCase()}` : `Estado: ${s.pt.toLowerCase()}`}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobileDevice ? "repeat(3, minmax(0, 1fr))" : "repeat(auto-fill, minmax(150px, 1fr))", gap: isMobileDevice ? 8 : 14 }}>
          {items.map((it) => {
            const inLib = !!findLibraryEntry(library, it.id, it.type);
            return (
              <div key={it.id} className="xp-card" style={{ position: "relative", minWidth: 0 }}>
                <div role="button" tabIndex={0} title={it.title} onClick={() => setSelectedItem(it)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedItem(it); }}
                  style={{ position: "relative", aspectRatio: "2/3", borderRadius: 9, overflow: "hidden", cursor: "pointer", background: gradientFor(it.id), boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                  {it.cover && <CoverImg src={it.cover} alt={it.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "22px 7px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.82))", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.2, pointerEvents: "none", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{it.title}</div>
                  {it.score > 0 && <span style={{ position: "absolute", top: 6, right: 6, padding: "2px 6px", borderRadius: 6, background: "rgba(0,0,0,0.65)", color: "#fbbf24", fontSize: 10.5, fontWeight: 800 }}>★ {it.score}</span>}
                  {inLib && <span className="xp-badge" title={en ? "In your library" : "Na tua biblioteca"} style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>}
                </div>
                {!isMobileDevice && (!inLib || justAdded.has(it.id)) && (
                  <button type="button" className={`xp-add${justAdded.has(it.id) ? " xp-done" : ""}`} disabled={justAdded.has(it.id)}
                    onClick={() => { addToLibrary(it, "planejado", 0); setJustAdded((p) => new Set(p).add(it.id)); setTimeout(() => setJustAdded((p) => { const n = new Set(p); n.delete(it.id); return n; }), 1500); }}
                    style={{ position: "absolute", left: 8, right: 8, bottom: 40, padding: "7px 0", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 16px rgba(0,0,0,0.45)" }}>
                    {justAdded.has(it.id) ? `✓ ${en ? "Added" : "Adicionado"}` : `+ ${en ? "Planned" : "Planeado"}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {loading && items.length === 0 && <div style={{ textAlign: "center", padding: "50px 0", color: muted, fontSize: 14 }}>{en ? "Loading…" : "A carregar…"}</div>}
        {!loading && !error && items.length === 0 && opened.current && <div style={{ textAlign: "center", padding: "50px 0", color: muted, fontSize: 14 }}>{en ? "Nothing found with these filters." : "Nada encontrado com estes filtros."}</div>}
        {error && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ color: muted, fontSize: 14, marginBottom: 10 }}>{en ? "Couldn't load the list." : "Não foi possível carregar a lista."}</div>
            <button type="button" onClick={() => load(items.length ? page + 1 : 1, items.length === 0)} style={{ ...pill(false), borderColor: accent, color: accent }}>{en ? "Try again" : "Tentar de novo"}</button>
          </div>
        )}
        {hasNext && !error && items.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button type="button" disabled={loading} onClick={() => load(page + 1, false)} style={{ padding: "11px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: loading ? "default" : "pointer", border: `1px solid ${accent}88`, background: "transparent", color: accent, opacity: loading ? 0.6 : 1 }}>
              {loading ? (en ? "Loading…" : "A carregar…") : (en ? "Load more" : "Carregar mais")}
            </button>
            <div style={{ fontSize: 11.5, color: muted, marginTop: 6 }}>{en ? `Showing ${items.length}` : `A mostrar ${items.length}`}</div>
          </div>
        )}
      </div>
    </div>
  );
}
