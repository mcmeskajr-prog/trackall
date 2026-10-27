import { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry, normalizeMediaId } from "../lib/mediaIds";
import { searchGoogleBooks } from "../api/books";
import { parseGoodreads, resolveGoodreads, toLibraryItem } from "../lib/goodreadsImport";

const STATE_COLOR = { completo: "#34d399", assistindo: "#fb923c", planejado: "#60a5fa" };
const STATE_PT = { completo: "Lido", assistindo: "A ler", planejado: "Por ler" };
const STATE_EN = { completo: "Read", assistindo: "Reading", planejado: "To read" };
const MAX_ROWS = 80;
const fmtDate = (ms, en) => new Date(ms).toLocaleDateString(en ? "en-GB" : "pt-PT", { day: "numeric", month: "short", year: "numeric" });

// Importar do Goodreads: escolhes o CSV → cada livro é ligado ao Google Books → revês → importar. Nada é gravado antes.
export function GoodreadsImportModal({ onClose, onImport, library, workerUrl }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";
  const [step, setStep] = useState("input"); // input | resolving | review
  const [error, setError] = useState("");
  const [progress, setProgress] = useState([0, 0]);
  const [results, setResults] = useState([]);
  const [inc, setInc] = useState({});            // índice → incluir (true/false); em falta = regra por defeito
  const [withDates, setWithDates] = useState(true);
  const stopRef = useRef(false);
  const fileRef = useRef(null);
  useEffect(() => () => { stopRef.current = true; }, []);

  const bg = darkMode ? "#161b22" : "#ffffff";
  const border = darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#9aa6b2" : "#64748b";
  const tile = darkMode ? "rgba(255,255,255,0.03)" : "#f8fafc";

  const owned = (c) => !!c && !!findLibraryEntry(library || {}, normalizeMediaId(c.id, "livros"), "livros");
  const included = (r, i) => {
    const c = r.chosen || r.options?.[0];
    if (!c || owned(c)) return false;
    return inc[i] ?? r.state === "ok";
  };
  const shownBook = (r) => r.chosen || r.options?.[0] || null;

  const onFile = async (ev) => {
    const file = ev.target.files?.[0]; if (!file) return;
    setError("");
    try {
      const entries = parseGoodreads(await file.text());
      if (!entries.length) { setError(en ? "No books found. Use the CSV from Goodreads → My Books → Import and export." : "Não encontrei livros. Usa o CSV do Goodreads → Os meus livros → Importar e exportar."); return; }
      stopRef.current = false; setStep("resolving"); setProgress([0, entries.length]);
      const search = (q) => searchGoogleBooks(q, workerUrl);
      const res = await resolveGoodreads(entries, { search, concurrency: 3, onProgress: (d, n) => setProgress([d, n]), shouldStop: () => stopRef.current });
      if (stopRef.current) return;
      setResults(res); setInc({}); setStep("review");
    } catch (e) { setError(e.message || String(e)); setStep("input"); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const info = useMemo(() => {
    let ok = 0, ask = 0, none = 0, have = 0, go = 0, dated = 0;
    results.forEach((r, i) => {
      if (r.state === "ok") ok++; else if (r.state === "ask") ask++; else none++;
      const c = shownBook(r);
      if (c && owned(c)) have++;
      if (included(r, i)) { go++; if (r.entry.readAt) dated++; }
    });
    return { ok, ask, none, have, go, dated };
    // eslint-disable-next-line
  }, [results, inc, library]);

  const doImport = () => {
    const out = [];
    results.forEach((r, i) => { if (included(r, i)) out.push(toLibraryItem(r, shownBook(r), withDates)); });
    onImport(out);
  };

  const chip = (t, c) => <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c, background: c + "22", border: `1px solid ${c}55`, whiteSpace: "nowrap" }}>{t}</span>;
  const stat = (n, label, color) => (
    <div style={{ flex: 1, minWidth: 90, padding: "12px 14px", borderRadius: 14, background: tile, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: muted, marginTop: 5 }}>{label}</div>
    </div>
  );
  const toggle = (on, set, title, desc) => (
    <button type="button" onClick={() => set(!on)} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: text, padding: 0 }}>
      <span style={{ width: 38, height: 22, borderRadius: 999, background: on ? accent : (darkMode ? "rgba(255,255,255,0.15)" : "#cbd5e1"), position: "relative", flexShrink: 0, marginTop: 1, transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </span>
      <span><span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{title}</span><span style={{ display: "block", fontSize: 12, color: muted, lineHeight: 1.45, marginTop: 1 }}>{desc}</span></span>
    </button>
  );

  return (
    <div className="modal-bg" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", color: text }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "#7c5a3a", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📖</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{en ? "Import from Goodreads" : "Importar do Goodreads"}</div>
              <div style={{ fontSize: 12, color: muted }}>{en ? "Books, ratings and read dates" : "Livros, notas e datas de leitura"}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={en ? "Close" : "Fechar"} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 22, lineHeight: 1, minWidth: 44, minHeight: 44 }}>×</button>
        </div>

        {step === "input" && (
          <div style={{ padding: 22, overflowY: "auto" }}>
            <ol style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: muted }}>
              <li>{en ? <>On goodreads.com open <b style={{ color: text }}>My Books</b> → <b style={{ color: text }}>Import and export</b></> : <>No goodreads.com abre <b style={{ color: text }}>Os meus livros</b> → <b style={{ color: text }}>Importar e exportar</b></>}</li>
              <li>{en ? <>Click <b style={{ color: text }}>Export Library</b> and download the CSV</> : <>Carrega em <b style={{ color: text }}>Exportar biblioteca</b> e descarrega o CSV</>}</li>
              <li>{en ? "Choose that file below" : "Escolhe esse ficheiro aqui em baixo"}</li>
            </ol>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} className="btn-accent" style={{ width: "100%", height: 46, borderRadius: 12, fontSize: 14 }}>{en ? "Choose CSV file" : "Escolher ficheiro CSV"}</button>
            {error && <div role="alert" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>{error}</div>}
            <p style={{ fontSize: 12, color: muted, lineHeight: 1.55, margin: "12px 0 0" }}>{en ? "Each book is matched to Google Books (by ISBN, then by title) so it gets cover and synopsis. Nothing is saved until you confirm." : "Cada livro é ligado ao Google Books (por ISBN, depois por título) para ter capa e sinopse. Nada é gravado até confirmares."}</p>
          </div>
        )}

        {step === "resolving" && (
          <div style={{ padding: "36px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{en ? `Matching books… ${progress[0]} of ${progress[1]}` : `A ligar livros… ${progress[0]} de ${progress[1]}`}</div>
            <div style={{ height: 10, borderRadius: 999, background: darkMode ? "rgba(255,255,255,0.08)" : "#e2e8f0", margin: "14px 0 10px", overflow: "hidden" }}>
              <div style={{ width: `${progress[1] ? (progress[0] / progress[1]) * 100 : 0}%`, height: "100%", background: accent, borderRadius: 999, transition: "width .2s" }} />
            </div>
            <div style={{ fontSize: 12.5, color: muted }}>{en ? "Nothing is saved yet." : "Ainda não foi gravado nada."}</div>
            <button onClick={() => { stopRef.current = true; setStep("input"); }} style={{ marginTop: 20, height: 42, padding: "0 18px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{en ? "Cancel" : "Cancelar"}</button>
          </div>
        )}

        {step === "review" && (<>
          <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {stat(results.length, en ? "books in the file" : "livros no ficheiro", text)}
              {stat(info.ok, en ? "matched" : "ligados", "#34d399")}
              {stat(info.ask + info.none, en ? "unsure / not found" : "incertos / não encontrados", "#fbbf24")}
              {stat(info.have, en ? "already yours" : "já tens", muted)}
            </div>
            <div style={{ marginTop: 18 }}>
              {toggle(withDates, setWithDates, en ? "Import read dates" : "Importar datas de leitura", en ? `${info.dated} books with a date show up in the Diary, in the right month.` : `${info.dated} livros com data aparecem no Diário, no mês certo.`)}
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.28)", fontSize: 12.5, lineHeight: 1.5 }}>
              {en ? <>Books <b>unsure</b> or <b>not found</b> are left out by default, so you don't get the wrong cover. You can tick the unsure ones if the match looks right. Books without a read date stay <b>out of the Diary</b>.</> : <>Os livros <b>incertos</b> ou <b>não encontrados</b> ficam de fora por defeito, para não entrar uma capa errada. Podes marcar os incertos se a correspondência parecer certa. Livros sem data de leitura ficam <b>fora do Diário</b>.</>}
            </div>
            <div style={{ marginTop: 14 }}>
              {results.slice(0, MAX_ROWS).map((r, i) => {
                const c = shownBook(r), e = r.entry, has = owned(c), on = included(r, i);
                return (
                  <div key={`${e.line}-${i}`} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 84px 44px 92px 78px", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${border}`, opacity: on ? 1 : 0.55 }}>
                    <div style={{ width: 34, height: 48, borderRadius: 6, background: darkMode ? "#21262d" : "#e2e8f0", overflow: "hidden", border: c ? "none" : `1.5px dashed ${border}` }}>
                      {c?.cover && <img src={c.cover} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.title || e.title}</div>
                      <div style={{ fontSize: 11.5, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c ? (c.extra || e.author) : (en ? "Not found" : "Não encontrado")}{c && r.state === "ask" ? ` · ${en ? "unsure" : "incerto"}` : ""}</div>
                    </div>
                    <div>{chip((en ? STATE_EN : STATE_PT)[e.status] || e.status, STATE_COLOR[e.status] || muted)}</div>
                    <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 800, color: "#fbbf24" }}>{e.rating ? `★ ${e.rating}` : <span style={{ color: muted, fontWeight: 400 }}>—</span>}</div>
                    <div style={{ textAlign: "right", fontSize: 12, color: e.readAt && withDates ? text : muted, fontStyle: e.readAt && withDates ? "normal" : "italic" }}>
                      {e.status !== "completo" ? "" : e.readAt && withDates ? fmtDate(e.readAt, en) : (en ? "no date" : "sem data")}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {has ? chip(en ? "Have it" : "Já tens", muted)
                        : !c ? null
                        : r.state === "ask" ? <button onClick={() => setInc(m => ({ ...m, [i]: !on }))} style={{ background: "none", border: "none", color: on ? muted : accent, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{on ? (en ? "Leave out" : "Tirar") : (en ? "Include" : "Incluir")}</button>
                        : <button onClick={() => setInc(m => ({ ...m, [i]: !on }))} style={{ background: "none", border: "none", color: on ? muted : accent, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{on ? (en ? "Skip" : "Ignorar") : (en ? "Include" : "Incluir")}</button>}
                    </div>
                  </div>
                );
              })}
              {results.length > MAX_ROWS && <div style={{ fontSize: 12, color: muted, padding: "10px 0 0" }}>{en ? `Showing ${MAX_ROWS} of ${results.length}. The rest follow the same rules.` : `A mostrar ${MAX_ROWS} de ${results.length}. Os restantes seguem as mesmas regras.`}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
            <button onClick={() => setStep("input")} style={{ height: 44, padding: "0 18px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{en ? "Back" : "Voltar"}</button>
            <button onClick={doImport} disabled={!info.go} className="btn-accent" style={{ height: 44, padding: "0 22px", borderRadius: 12, fontSize: 14, opacity: info.go ? 1 : 0.5 }}>
              {info.go ? (en ? `Import ${info.go} books` : `Importar ${info.go} livros`) : (en ? "Nothing to import" : "Nada para importar")}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
