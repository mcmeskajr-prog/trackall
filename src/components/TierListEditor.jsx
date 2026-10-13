import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { TIER_LEVELS, MEDIA_TYPES, mediaLabel } from "../config/constants";
import { fetchAniListSafe } from "../api/anilist";
import { gradientFor } from "../lib/utils";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { TIER_NAMES } from "./TierListViewer";

// Editor de tier lists: linhas à esquerda, painel de itens à direita (gaveta no telemóvel).
// Colocar: escolhe um item e toca na letra do tier (ou arrasta, no PC).
const EXT_TYPES = [{ id: "anime", label: "Anime" }, { id: "manga", label: "Manga" }, { id: "filmes", label: "Filmes" }, { id: "series", label: "Séries" }];

export function TierListEditor({ initialData, library, onSave, onClose, workerUrl, tmdbKey }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const [title, setTitle] = useState(initialData?.title || "");
  const [tiers, setTiers] = useState(() => {
    const base = { S: [], A: [], B: [], C: [], D: [] };
    TIER_LEVELS.forEach(t => { base[t.id] = []; });
    return { ...base, ...(initialData?.tiers || {}) };
  });
  const [poolTab, setPoolTab] = useState("biblioteca"); // biblioteca | pesquisar | personagens | manual
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [extSearch, setExtSearch] = useState("");
  const [extType, setExtType] = useState("anime");
  const [extResults, setExtResults] = useState([]);
  const [extSearching, setExtSearching] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualCover, setManualCover] = useState("");
  const [selected, setSelected] = useState(null); // { item, from }  from = tierId | null
  const [dragItem, setDragItem] = useState(null);
  const [overTier, setOverTier] = useState(null);
  const [saving, setSaving] = useState(false);

  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.72)" : "#f8fafc";
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${line}`, color: text, fontFamily: "inherit", fontSize: 13, outline: "none" };

  const rankedIds = useMemo(() => new Set(Object.values(tiers).flat().map(i => i.id)), [tiers]);
  const placed = rankedIds.size;
  const libItems = useMemo(() => Object.values(library || {}), [library]);
  const unranked = useMemo(() => {
    const q = search.trim().toLowerCase();
    return libItems.filter(i => !rankedIds.has(i.id) && (typeFilter === "all" || i.type === typeFilter) && (!q || (i.title || "").toLowerCase().includes(q)));
  }, [libItems, rankedIds, typeFilter, search]);
  const typeChips = useMemo(() => [{ id: "all", label: lang === "en" ? "All" : "Tudo" }, ...MEDIA_TYPES.filter(t => t.id !== "all" && libItems.some(i => i.type === t.id)).map(t => ({ id: t.id, label: mediaLabel(t, lang) }))], [libItems, lang]);

  const place = (item, tierId) => {
    setTiers(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = prev[k].filter(i => i.id !== item.id); });
      next[tierId] = [...(next[tierId] || []), item];
      return next;
    });
    setSelected(null);
  };
  const unplace = (item) => {
    setTiers(prev => { const next = {}; Object.keys(prev).forEach(k => { next[k] = prev[k].filter(i => i.id !== item.id); }); return next; });
    setSelected(null);
  };

  const searchExternal = async () => {
    const q = extSearch.trim();
    if (!q) return;
    setExtSearching(true); setExtResults([]);
    try {
      let results = [];
      if (poolTab === "personagens") {
        const gql = `{ Page(perPage:20) { characters(search:"${q.replace(/"/g, "'")}") { id name{full} image{large} } } }`;
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrl}/anilist`], JSON.stringify({ query: gql }));
        results = (data?.data?.Page?.characters || []).map(c => ({ id: `al-char-${c.id}`, title: c.name?.full || "", cover: c.image?.large || "", type: "personagem" }));
      } else if (extType === "anime" || extType === "manga") {
        const aniType = extType === "anime" ? "ANIME" : "MANGA";
        const gql = `{ Page(perPage:20) { media(search:"${q.replace(/"/g, "'")}",type:${aniType}) { id title{romaji} coverImage{large} averageScore } } }`;
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrl}/anilist`], JSON.stringify({ query: gql }));
        results = (data?.data?.Page?.media || []).map(m => ({ id: `al-${extType}-${m.id}`, title: m.title?.romaji || "", cover: m.coverImage?.large || "", type: extType, score: m.averageScore || 0 }));
      } else {
        const ep = extType === "filmes" ? "movie" : "tv";
        const res = await fetch(`${wUrl}/tmdb?endpoint=/search/${ep}&query=${encodeURIComponent(q)}&language=en-US`);
        const data = await res.json();
        results = (data?.results || []).slice(0, 20).map(m => ({ id: `tmdb-${extType}-${m.id}`, title: m.title || m.name || "", cover: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "", type: extType, score: m.vote_average || 0 }));
      }
      setExtResults(results.filter(r => !rankedIds.has(r.id)));
    } catch (e) { console.error(e); }
    setExtSearching(false);
  };

  const addManual = () => {
    const t = manualTitle.trim();
    if (!t) return;
    const item = { id: `manual-${Date.now()}`, title: t, cover: manualCover.trim(), type: "manual" };
    setManualTitle(""); setManualCover("");
    setSelected({ item, from: null });
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try { await onSave(title.trim(), tiers); } finally { setSaving(false); }
  };

  const poster = (item, w, h, opts = {}) => {
    const cover = item.customCover || item.cover || item.thumbnailUrl;
    const isSel = selected?.item?.id === item.id;
    return (
      <div key={item.id} title={item.title} draggable={!isMobileDevice}
        onDragStart={() => setDragItem(item)} onDragEnd={() => { setDragItem(null); setOverTier(null); }}
        onClick={() => setSelected(isSel ? null : { item, from: opts.from || null })}
        style={{ width: w, flexShrink: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <div style={{ position: "relative", width: w, height: h, borderRadius: 9, overflow: "hidden", background: gradientFor(item.id), boxShadow: isSel ? `0 0 0 2.5px ${accent}, 0 0 16px ${accent}99` : "0 3px 10px rgba(0,0,0,0.3)", transition: "box-shadow 0.12s" }}>
          {cover ? <img src={cover} alt="" loading="lazy" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 4, fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{item.title}</span>}
        </div>
      </div>
    );
  };

  const tierBtn = (t) => (
    <button key={t.id} onClick={() => place(selected.item, t.id)} aria-label={`Colocar em ${t.id}`}
      style={{ flex: 1, height: 38, borderRadius: 11, background: selected.from === t.id ? t.color : `${t.color}33`, border: `1.5px solid ${t.color}`, color: selected.from === t.id ? "#fff" : t.color, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{t.id}</button>
  );

  const rowsH = isMobileDevice ? 68 : 98, rowsW = isMobileDevice ? 46 : 66;
  const tabs = [["biblioteca", lang === "en" ? "Library" : "Biblioteca"], ["pesquisar", lang === "en" ? "Search" : "Pesquisar"], ["personagens", isMobileDevice ? "Pers." : (lang === "en" ? "Characters" : "Personagens")], ["manual", "Manual"]];
  const extList = poolTab === "biblioteca" ? unranked.slice(0, 150) : extResults;
  const pw = isMobileDevice ? 64 : 62, ph = isMobileDevice ? 94 : 92;

  const pool = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0, flex: 1 }}>
      <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 12, background: darkMode ? "rgba(0,0,0,0.35)" : "#e8ecf1", border: `1px solid ${line}`, flexShrink: 0 }}>
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => { setPoolTab(id); setExtResults([]); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", background: poolTab === id ? (darkMode ? "rgba(255,255,255,0.1)" : "#fff") : "transparent", color: poolTab === id ? text : muted }}>{l}</button>
        ))}
      </div>

      {selected && (
        <div style={{ padding: "10px 12px", borderRadius: 14, background: `${accent}1a`, border: `1px solid ${accent}55`, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: darkMode ? "#fca5a5" : accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.item.title} · {selected.from ? "mover para" : "colocar em"}</div>
            {selected.from && <button onClick={() => unplace(selected.item)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>Tirar</button>}
            <button onClick={() => setSelected(null)} aria-label="Cancelar" style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>{TIER_LEVELS.map(tierBtn)}</div>
        </div>
      )}

      {poolTab === "biblioteca" && (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
            {typeChips.map(c => (
              <button key={c.id} onClick={() => setTypeFilter(c.id)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 99, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${typeFilter === c.id ? accent : line}`, background: typeFilter === c.id ? `${accent}26` : "transparent", color: typeFilter === c.id ? (darkMode ? "#fca5a5" : accent) : muted }}>{c.label}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "en" ? "Filter your library…" : "Filtrar a biblioteca…"} style={field} />
        </>
      )}

      {(poolTab === "pesquisar" || poolTab === "personagens") && (
        <>
          {poolTab === "pesquisar" && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
              {EXT_TYPES.map(c => (
                <button key={c.id} onClick={() => { setExtType(c.id); setExtResults([]); }} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 99, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${extType === c.id ? accent : line}`, background: extType === c.id ? `${accent}26` : "transparent", color: extType === c.id ? (darkMode ? "#fca5a5" : accent) : muted }}>{c.label}</button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <input value={extSearch} onChange={e => setExtSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchExternal()} placeholder={poolTab === "personagens" ? "Nome da personagem…" : "Pesquisar título…"} style={{ ...field, flex: 1, width: "auto" }} />
            <button onClick={searchExternal} disabled={extSearching} style={{ padding: "0 16px", borderRadius: 12, background: accent, border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{extSearching ? "…" : "Ir"}</button>
          </div>
        </>
      )}

      {poolTab === "manual" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>Para qualquer coisa que não esteja nas pesquisas: um nome e, se quiseres, o endereço de uma imagem.</p>
          <input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Nome" style={field} />
          <input value={manualCover} onChange={e => setManualCover(e.target.value)} placeholder="Endereço da imagem (opcional)" style={field} />
          <button onClick={addManual} disabled={!manualTitle.trim()} style={{ padding: "11px", borderRadius: 12, background: accent, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: manualTitle.trim() ? 1 : 0.5 }}>Criar e escolher tier</button>
        </div>
      ) : (
        <div style={{ overflowY: "auto", minHeight: 0, flex: 1, display: "flex", flexWrap: "wrap", gap: 9, alignContent: "flex-start", paddingBottom: 4 }}>
          {extList.map(item => poster(item, pw, ph))}
          {extList.length === 0 && !extSearching && (
            <p style={{ fontSize: 12, color: muted, width: "100%", textAlign: "center", padding: "16px 0" }}>
              {poolTab === "biblioteca" ? (libItems.length ? "Todos os itens já estão colocados." : "A biblioteca está vazia.") : (extSearch ? "Sem resultados." : "Pesquisa acima.")}
            </p>
          )}
        </div>
      )}
      {poolTab === "biblioteca" && unranked.length > 0 && <div style={{ fontSize: 11, color: muted, textAlign: "center", flexShrink: 0 }}>{unranked.length} por colocar · os já colocados ficam escondidos</div>}
    </div>
  );

  const rows = (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobileDevice ? 8 : 10 }}>
      {TIER_LEVELS.map(tier => {
        const list = tiers[tier.id] || [];
        const over = overTier === tier.id;
        const canDrop = !!selected && !dragItem;
        return (
          <div key={tier.id}
            onDragOver={e => { e.preventDefault(); setOverTier(tier.id); }}
            onDragLeave={() => setOverTier(o => (o === tier.id ? null : o))}
            onDrop={e => { e.preventDefault(); if (dragItem) place(dragItem, tier.id); setDragItem(null); setOverTier(null); }}
            style={{ display: "flex", alignItems: "stretch", borderRadius: isMobileDevice ? 14 : 16, overflow: "hidden", background: glass, border: `1px solid ${over ? accent : line}`, boxShadow: over ? `0 0 0 2px ${accent}55` : "none", transition: "border-color 0.12s, box-shadow 0.12s" }}>
            <div style={{ width: isMobileDevice ? 44 : 72, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${tier.color}, ${tier.color}99)` }}>
              <div style={{ fontSize: isMobileDevice ? 22 : 30, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{tier.id}</div>
              {!isMobileDevice && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.85)", textTransform: "uppercase", marginTop: 2 }}>{TIER_NAMES[tier.id]}</div>}
            </div>
            <div onClick={() => canDrop && place(selected.item, tier.id)} style={{ flex: 1, minWidth: 0, padding: isMobileDevice ? 8 : 12, display: "flex", flexWrap: "wrap", gap: isMobileDevice ? 6 : 8, alignItems: "center", cursor: canDrop ? "pointer" : "default" }}>
              {list.map(item => poster(item, rowsW, rowsH, { from: tier.id }))}
              {list.length === 0 && (
                <div style={{ flex: 1, minHeight: rowsH, borderRadius: 12, border: `1.5px dashed ${canDrop ? accent : line}`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 10px", fontSize: isMobileDevice ? 11.5 : 12.5, color: canDrop ? accent : muted }}>
                  {canDrop ? `Toca para colocar em ${tier.id}` : (isMobileDevice ? `Escolhe um item e toca em ${tier.id}` : `Arrasta para aqui, ou escolhe um item e toca em ${tier.id}`)}
                </div>
              )}
              {list.length > 0 && canDrop && <div style={{ width: rowsW, height: rowsH, borderRadius: 9, border: `1.5px dashed ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: 20, flexShrink: 0 }}>＋</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobileDevice ? "14px 16px" : "20px 28px", borderBottom: `1px solid ${line}`, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", color: muted, marginBottom: 2 }}>{initialData ? "EDITAR TIER LIST" : "NOVA TIER LIST"}</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Dá um nome à tier list…" maxLength={80}
          style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", outline: "none", color: text, fontFamily: "inherit", fontSize: isMobileDevice ? 17 : 26, fontWeight: 800, padding: 0 }} />
      </div>
      {!isMobileDevice && <span style={{ padding: "7px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: 700, color: muted, border: `1px solid ${line}`, whiteSpace: "nowrap" }}>{placed} colocados</span>}
      {!isMobileDevice && <button onClick={onClose} style={{ padding: "11px 18px", borderRadius: 12, background: "transparent", border: `1px solid ${line}`, color: text, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>Cancelar</button>}
      <button onClick={handleSave} disabled={!title.trim() || saving} style={{ padding: "11px 18px", borderRadius: 12, background: accent, border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, opacity: !title.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>{saving ? "A guardar…" : "Guardar"}</button>
      {isMobileDevice && <button onClick={onClose} aria-label="Fechar" style={{ width: 36, height: 36, borderRadius: 99, background: "transparent", border: `1px solid ${line}`, color: muted, cursor: "pointer", fontSize: 15 }}>✕</button>}
    </div>
  );

  return createPortal(
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 160 }}>
      <div className="modal fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: isMobileDevice ? "100%" : 1180, width: "100%", height: isMobileDevice ? "92vh" : "90vh", maxHeight: "none", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: darkMode ? `radial-gradient(circle at 85% 0%, ${accent}24, transparent 45%), #0e1014` : "#ffffff", border: `1px solid ${line}`, borderRadius: isMobileDevice ? undefined : 24, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        {header}
        {isMobileDevice ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto", padding: 12 }}>{rows}</div>
            <div style={{ flex: "0 0 48%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "22px 22px 0 0", background: darkMode ? "#12151a" : "#f8fafc", borderTop: `1px solid ${line}`, boxShadow: "0 -14px 30px rgba(0,0,0,0.35)", padding: "10px 14px calc(14px + env(safe-area-inset-bottom, 0px))" }}>
              <div style={{ width: 36, height: 4, borderRadius: 9, background: "rgba(255,255,255,0.2)", margin: "0 auto 10px", flexShrink: 0 }} />
              {pool}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 20, padding: "20px 28px" }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 4 }}>{rows}</div>
            <div style={{ width: 370, flexShrink: 0, borderRadius: 20, padding: 16, background: glass, border: `1px solid ${line}`, display: "flex", flexDirection: "column", minHeight: 0 }}>{pool}</div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
