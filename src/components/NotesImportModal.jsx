import { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry, normalizeMediaId } from "../lib/mediaIds";
import { smartSearch } from "../api/smartSearch";
import { parseNotes, resolveNotes, toLibraryItem, rankOptions, AUTO_TYPES } from "../lib/notesImport";

const TYPES = [["auto", "Auto"], ["anime", "Anime"], ["manga", "Manga"], ["series", "Séries"], ["filmes", "Filmes"], ["jogos", "Jogos"], ["livros", "Livros"]];
const TYPE_LABEL = { anime: "Anime", manga: "Manga", manhwa: "Manhwa", lightnovels: "Light novel", filmes: "Filme", series: "Série", jogos: "Jogo", livros: "Livro", comics: "Comic" };
const STATE_COLOR = { completo: "#34d399", assistindo: "#fb923c", planejado: "#60a5fa", dropado: "#f87171", pausado: "#fbbf24" };
const STATE_PT = { completo: "Completo", assistindo: "Em curso", planejado: "Planeado", dropado: "Dropado", pausado: "Pausado" };
const STATE_EN = { completo: "Completed", assistindo: "In progress", planejado: "Planned", dropado: "Dropped", pausado: "Paused" };

// Importar de notas: colas os títulos → a app procura cada um → confirmas os duvidosos → importar. Sem IA.
export function NotesImportModal({ onClose, onImport, library, tmdbKey, workerUrl }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";
  const [step, setStep] = useState("input"); // input | resolving | review
  const [text, setText] = useState("");
  const [typeChoice, setTypeChoice] = useState("auto");
  const [progress, setProgress] = useState([0, 0]);
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState({});   // índice → candidato escolhido (linhas "ask")
  const [skipped, setSkipped] = useState({}); // índice → true (ignorar)
  const [man, setMan] = useState({});       // índice → { open, q, type, busy, opts, done } (pesquisa manual por linha)
  const [statusOv, setStatusOv] = useState({}); // índice → estado escolhido na revisão
  const [more, setMore] = useState({});     // índice → mostrar todas as opções
  const stopRef = useRef(false);
  const taRef = useRef(null);
  useEffect(() => { taRef.current?.focus(); return () => { stopRef.current = true; }; }, []);

  const bg = darkMode ? "#161b22" : "#ffffff";
  const border = darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const txt = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#9aa6b2" : "#64748b";
  const tile = darkMode ? "rgba(255,255,255,0.03)" : "#f8fafc";

  const entries = useMemo(() => parseNotes(text), [text]);
  const search = (q, t) => smartSearch(q, t, { tmdb: tmdbKey, workerUrl });
  const owned = (c) => !!c && !!findLibraryEntry(library || {}, normalizeMediaId(c.id, c.type), c.type);

  const run = async (list, keep = []) => {
    stopRef.current = false; setStep("resolving"); setProgress([0, list.length]);
    const res = await resolveNotes(list, { search, typeChoice, concurrency: 2, onProgress: (d, n) => setProgress([d, n]), shouldStop: () => stopRef.current });
    if (stopRef.current) return;
    return [...keep, ...res];
  };
  const start = async () => {
    const res = await run(entries);
    if (!res) return;
    setResults(res); setPicked({}); setSkipped({}); setStatusOv({}); setStep("review");
  };
  const retryMissing = async () => {
    const miss = results.filter(r => r.state === "none").map(r => r.entry);
    if (!miss.length) return;
    const keep = results.filter(r => r.state !== "none");
    const res = await run(miss, keep);
    if (!res) return;
    // mantém a ordem original das linhas
    res.sort((a, b) => a.entry.line - b.entry.line);
    setResults(res); setPicked({}); setSkipped({}); setStatusOv({}); setStep("review");
  };

  const statusOf = (r, i) => statusOv[i] || r.entry.status || "planejado";
  const setAllStatus = (st) => setStatusOv(Object.fromEntries(results.map((_, i) => [i, st])));
  const chosenFor = (r, i) => picked[i] || (r.state === "ok" ? r.chosen : null);
  const optsFor = (r, i) => man[i]?.opts || r.options || [];
  const openMan = (i) => setMan(m => ({ ...m, [i]: { q: results[i].entry.title, type: typeChoice, ...m[i], open: true } }));
  const setManF = (i, patch) => setMan(m => ({ ...m, [i]: { ...m[i], ...patch } }));
  const doMan = async (i) => {
    const s = man[i]; const q = (s?.q || "").trim(); if (!q) return;
    setManF(i, { busy: true });
    const types = s.type && s.type !== "auto" ? [s.type] : AUTO_TYPES;
    const found = await Promise.all(types.map(t => Promise.resolve().then(() => search(q, t)).catch(() => [])));
    const cands = found.flatMap((l, k) => (l || []).slice(0, 8).map(c => ({ ...c, type: c.type || types[k] })));
    setManF(i, { busy: false, done: true, opts: rankOptions({ title: q }, cands, { min: 0.25, limit: 12 }) });
    setMore(m => ({ ...m, [i]: true })); setPicked(p => ({ ...p, [i]: undefined }));
  };
  const stats = useMemo(() => {
    let ok = 0, ask = 0, none = 0, have = 0, go = 0;
    results.forEach((r, i) => {
      const c = chosenFor(r, i);
      if (c) ok++; else if (r.state === "ask") ask++; else none++;
      if (c && owned(c)) have++; else if (c && !skipped[i]) go++;
    });
    return { ok, ask, none, have, go, pending: results.filter((r, i) => r.state === "ask" && !picked[i]).length };
    // eslint-disable-next-line
  }, [results, picked, skipped, library]);

  const doImport = () => {
    const out = [];
    results.forEach((r, i) => { const c = chosenFor(r, i); if (c && !owned(c) && !skipped[i]) out.push(toLibraryItem({ ...r, entry: { ...r.entry, status: statusOf(r, i) } }, c)); });
    onImport(out);
  };

  const chip = (t, c) => <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c, background: c + "22", border: `1px solid ${c}55`, whiteSpace: "nowrap" }}>{t}</span>;
  const cover = (c, w = 34, h = 48) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: darkMode ? "#21262d" : "#e2e8f0", flexShrink: 0, overflow: "hidden" }}>
      {c?.cover && <img src={c.cover} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
  const meta = (c) => `${TYPE_LABEL[c.type] || c.type}${c.year ? ` · ${c.year}` : ""}`;
  const stLabel = (s) => (en ? STATE_EN : STATE_PT)[s] || s;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", color: txt }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "#ea580c", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>✎</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{en ? "Paste a list" : "Colar uma lista"}</div>
              <div style={{ fontSize: 12, color: muted }}>{en ? "The titles you keep in notes, one per line" : "Os nomes que tens em notas, um por linha"}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={en ? "Close" : "Fechar"} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 22, lineHeight: 1, minWidth: 44, minHeight: 44 }}>×</button>
        </div>

        {step === "input" && (
          <div style={{ padding: 22, overflowY: "auto" }}>
            <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} spellCheck={false} rows={10}
              placeholder={en ? "Frieren - 9 - completed\nBreaking Bad - 10\nElden Ring\nBerserk (manga)" : "Frieren - 9 - completo\nBreaking Bad - 10\nElden Ring\nBerserk (manga)"}
              style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 14, border: `1px solid ${border}`, background: darkMode ? "#0d1117" : "#f8fafc", color: txt, fontSize: 14, lineHeight: 1.7, fontFamily: "ui-monospace, Menlo, Consolas, monospace", resize: "vertical", outline: "none" }} />
            <p style={{ fontSize: 12, color: muted, lineHeight: 1.6, margin: "10px 0 16px" }}>
              {en ? <>Optionally add a rating and status: <b style={{ color: txt }}>Title - 9 - completed</b>. Without them it's imported as <i>Planned</i>. Headings like <b style={{ color: txt }}>Anime:</b> set the type of the lines below.</> : <>Se quiseres, junta a nota e o estado: <b style={{ color: txt }}>Título - 9 - completo</b>. Sem isso, entra como <i>Planeado</i>. Cabeçalhos como <b style={{ color: txt }}>Animes:</b> definem o tipo das linhas seguintes.</>}
            </p>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 8 }}>{en ? "Type" : "Tipo"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TYPES.map(([id, label]) => (
                <button key={id} onClick={() => setTypeChoice(id)} style={{ minHeight: 36, padding: "0 14px", borderRadius: 999, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${typeChoice === id ? accent : border}`, background: typeChoice === id ? accent : "transparent", color: typeChoice === id ? "#fff" : muted }}>{label}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: muted, margin: "8px 0 0", lineHeight: 1.5 }}>{en ? "In Auto the app searches everywhere and picks the likeliest. Choosing a type is faster." : "Em Auto a app procura em todos e escolhe o mais provável. Escolher um tipo é mais rápido."}</p>
            <button onClick={start} disabled={!entries.length} className="btn-accent" style={{ marginTop: 20, width: "100%", height: 46, borderRadius: 12, fontSize: 14, opacity: entries.length ? 1 : 0.55 }}>
              {entries.length ? (en ? `Search ${entries.length} titles` : `Procurar ${entries.length} títulos`) : (en ? "Paste your titles above" : "Cola os teus títulos acima")}
            </button>
          </div>
        )}

        {step === "resolving" && (
          <div style={{ padding: "36px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{en ? `Searching… ${progress[0]} of ${progress[1]}` : `A procurar… ${progress[0]} de ${progress[1]}`}</div>
            <div style={{ height: 10, borderRadius: 999, background: darkMode ? "rgba(255,255,255,0.08)" : "#e2e8f0", margin: "14px 0 10px", overflow: "hidden" }}>
              <div style={{ width: `${progress[1] ? (progress[0] / progress[1]) * 100 : 0}%`, height: "100%", background: accent, borderRadius: 999, transition: "width .2s" }} />
            </div>
            <div style={{ fontSize: 12.5, color: muted }}>{en ? "Nothing is saved yet." : "Ainda não foi gravado nada."}</div>
            <button onClick={() => { stopRef.current = true; setStep("input"); }} style={{ marginTop: 20, height: 42, padding: "0 18px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: txt, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
          </div>
        )}

        {step === "review" && (<>
          <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{en ? "Result" : "Resultado"}</span>
              {chip(`${stats.ok} ${en ? "sure" : "certos"}`, "#34d399")}
              {stats.ask > 0 && chip(`${stats.ask} ${en ? "to confirm" : "por confirmar"}`, "#fbbf24")}
              {stats.none > 0 && chip(`${stats.none} ${en ? "not found" : "não encontrados"}`, "#f87171")}
              {stats.have > 0 && chip(`${stats.have} ${en ? "already yours" : "já tens"}`, muted)}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: muted }}>{en ? "Set all to" : "Estado de todos"}
                <select value="" onChange={ev => ev.target.value && setAllStatus(ev.target.value)} style={{ height: 28, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: txt, fontFamily: "inherit", fontSize: 12, padding: "0 6px" }}>
                  <option value="">—</option>
                  {Object.keys(STATE_PT).map(k => <option key={k} value={k} style={{ color: "#000" }}>{stLabel(k)}</option>)}
                </select></label>
              {stats.none > 0 && <button onClick={retryMissing} style={{ marginLeft: "auto", background: "none", border: "none", color: accent, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", minHeight: 36 }}>{en ? "Retry the missing" : "Tentar outra vez os que faltam"}</button>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map((r, i) => {
                const c = chosenFor(r, i);
                const has = owned(c);
                const off = skipped[i] || has;
                const e = r.entry;
                const st = statusOf(r, i);
                const extra = (<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                  <select value={st} onClick={ev => ev.stopPropagation()} onChange={ev => setStatusOv(o => ({ ...o, [i]: ev.target.value }))} aria-label={en ? "Status" : "Estado"} style={{ height: 26, padding: "0 6px", borderRadius: 999, fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: STATE_COLOR[st] || muted, background: (STATE_COLOR[st] || muted) + "22", border: `1px solid ${(STATE_COLOR[st] || muted)}55`, cursor: "pointer", outline: "none" }}>
                    {Object.keys(STATE_PT).map(k => <option key={k} value={k} style={{ color: "#000" }}>{stLabel(k)}</option>)}
                  </select>
                  {e.rating > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#fbbf24" }}>★ {e.rating}</span>}</div>);
                return (
                  <div key={`${e.line}-${i}`} style={{ padding: "10px 14px", borderRadius: 14, background: tile, border: `1px solid ${border}`, opacity: off ? 0.5 : 1 }}>
                    {(r.state === "ask" || man[i]?.open) ? (<>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, color: muted }}>{r.state === "none" ? (en ? "Search for" : "Procurar") : (en ? "Several results for" : "Vários resultados para")} <b style={{ color: txt }}>“{e.title}”</b></span>
                        {!picked[i] && r.state === "ask" && chip(en ? "Pick one" : "Escolhe um", "#fbbf24")}
                        {extra}
                      </div>
                      {optsFor(r, i).length > 0 && (() => {
                        const all = optsFor(r, i), shown = more[i] ? all : all.slice(0, 4);
                        return (<>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, maxHeight: more[i] ? 280 : "none", overflowY: more[i] ? "auto" : "visible" }}>
                            {shown.map(o => {
                              const on = picked[i]?.id === o.id;
                              return (
                                <button key={o.id} onClick={() => setPicked(p => ({ ...p, [i]: on ? undefined : o }))} style={{ display: "flex", gap: 9, alignItems: "center", padding: 8, borderRadius: 12, textAlign: "left", fontFamily: "inherit", color: txt, cursor: "pointer", border: `1.5px solid ${on ? accent : border}`, background: on ? accent + "14" : "transparent" }}>
                                  {cover(o, 30, 42)}
                                  <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.title}</span><span style={{ display: "block", fontSize: 11, color: muted }}>{meta(o)}</span></span>
                                </button>
                              );
                            })}
                          </div>
                          {all.length > 4 && !more[i] && <button onClick={() => setMore(m => ({ ...m, [i]: true }))} style={{ marginTop: 6, background: "none", border: "none", color: accent, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", minHeight: 32 }}>{en ? `Show ${all.length - 4} more` : `Ver mais ${all.length - 4}`}</button>}
                        </>);
                      })()}
                      {man[i]?.done && !optsFor(r, i).length && <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>{en ? "Nothing found. Try another spelling." : "Nada encontrado. Tenta outra grafia."}</div>}
                      {man[i]?.open ? (
                        <form onSubmit={ev => { ev.preventDefault(); doMan(i); }} style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <input value={man[i].q} onChange={ev => setManF(i, { q: ev.target.value })} placeholder={en ? "Type the correct title" : "Escreve o título certo"} style={{ flex: "1 1 180px", minWidth: 0, height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${border}`, background: darkMode ? "#0d1117" : "#fff", color: txt, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                          <select value={man[i].type} onChange={ev => setManF(i, { type: ev.target.value })} style={{ height: 38, borderRadius: 10, border: `1px solid ${border}`, background: darkMode ? "#0d1117" : "#fff", color: txt, fontFamily: "inherit", fontSize: 12, padding: "0 8px" }}>
                            {TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                          </select>
                          <button type="submit" disabled={man[i].busy} className="btn-accent" style={{ height: 38, padding: "0 16px", borderRadius: 10, fontSize: 13 }}>{man[i].busy ? "…" : (en ? "Search" : "Procurar")}</button>
                          {r.state !== "none" && <button type="button" onClick={() => setManF(i, { open: false, opts: null, done: false })} style={{ height: 38, background: "none", border: "none", color: muted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>}
                        </form>
                      ) : (
                        <button onClick={() => openMan(i)} style={{ marginTop: 6, background: "none", border: "none", color: accent, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", minHeight: 32 }}>{en ? "Not it? Search another title" : "Não é este? Procurar outro título"}</button>
                      )}
                    </>) : r.state === "ok" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {cover(c)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                          <div style={{ fontSize: 12, color: muted }}>{meta(c)}</div>
                          {extra}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          {has ? chip(en ? "Already yours" : "Já tens", muted) : (
                            <button onClick={() => setSkipped(s => ({ ...s, [i]: !s[i] }))} style={{ background: "none", border: "none", color: skipped[i] ? accent : muted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{skipped[i] ? (en ? "Include" : "Incluir") : (en ? "Skip" : "Ignorar")}</button>
                          )}
                          <button onClick={() => { setMore(m => ({ ...m, [i]: false })); openMan(i); }} style={{ background: "none", border: "none", color: accent, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{en ? "Change" : "Mudar"}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 34, height: 48, borderRadius: 6, border: `1.5px dashed ${border}`, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>“{e.title}”</div>
                          <div style={{ fontSize: 12, color: muted }}>{en ? "Nothing found with this name." : "Não encontrei nada com este nome."}</div>
                        </div>
                        {chip(en ? "Not found" : "Não encontrado", "#f87171")}
                        <button onClick={() => openMan(i)} style={{ background: "none", border: "none", color: accent, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", minHeight: 36 }}>{en ? "Search" : "Procurar"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderTop: `1px solid ${border}`, flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: muted, flex: 1, minWidth: 180 }}>{en ? "Change the status per title or for all. Without a completion date they stay out of the Diary." : "Muda o estado em cada título ou em todos. Sem data de conclusão ficam fora do Diário."}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("input")} style={{ height: 44, padding: "0 18px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: txt, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{en ? "Back" : "Voltar"}</button>
              <button onClick={doImport} disabled={!stats.go} className="btn-accent" style={{ height: 44, padding: "0 22px", borderRadius: 12, fontSize: 14, opacity: stats.go ? 1 : 0.5 }}>
                {stats.go ? (en ? `Import ${stats.go}${stats.pending ? ` · ${stats.pending} to confirm` : ""}` : `Importar ${stats.go}${stats.pending ? ` · ${stats.pending} por confirmar` : ""}`) : (en ? "Nothing to import" : "Nada para importar")}
              </button>
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}
