import { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry } from "../lib/mediaIds";
import { fetchAniListUser } from "../lib/anilistImport";

const STATE_COLOR = { completo: "#34d399", assistindo: "#fb923c", planejado: "#60a5fa", dropado: "#f87171", pausado: "#fbbf24" };
const STATE_PT = { completo: "Completo", assistindo: "Em curso", planejado: "Planeado", dropado: "Dropado", pausado: "Pausado" };
const STATE_EN = { completo: "Completed", assistindo: "In progress", planejado: "Planned", dropado: "Dropped", pausado: "Paused" };
const MAX_ROWS = 80;

const fmtDate = (ms, en) => new Date(ms).toLocaleDateString(en ? "en-GB" : "pt-PT", { day: "2-digit", month: "short", year: "numeric" });

// Importar do AniList: escreves o utilizador → pré-visualização (nada é gravado) → importar
export function AniListImportModal({ onClose, onImport, library, workerUrl }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";
  const [step, setStep] = useState("input"); // input | loading | preview
  const [user, setUser] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [withDates, setWithDates] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const bg = darkMode ? "#161b22" : "#ffffff";
  const border = darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#9aa6b2" : "#64748b";
  const tile = darkMode ? "rgba(255,255,255,0.03)" : "#f8fafc";

  const titleSet = useMemo(() => new Set(Object.values(library || {}).map(e => (e.title || "").toLowerCase().trim()).filter(Boolean)), [library]);
  const have = (it) => !!findLibraryEntry(library || {}, it.id, it.type) || titleSet.has((it.title || "").toLowerCase().trim());

  const info = useMemo(() => {
    const owned = items.filter(have).length;
    const done = items.filter(i => i.userStatus === "completo");
    return { total: items.length, owned, withDate: done.filter(i => i.addedAt).length, noDate: done.filter(i => !i.addedAt).length };
    // eslint-disable-next-line
  }, [items, library]);

  const toImport = useMemo(() => (skipExisting ? items.filter(i => !have(i)) : items), [items, skipExisting, library]); // eslint-disable-line
  const shown = useMemo(() => items.filter(i => typeFilter === "all" || i.type === typeFilter), [items, typeFilter]);

  const search = async () => {
    setError(""); setStep("loading");
    try {
      const list = await fetchAniListUser(user, { workerUrl });
      if (!list.length) { setError(en ? "This list is empty." : "Esta lista está vazia."); setStep("input"); return; }
      setItems(list); setStep("preview");
    } catch (e) { setError(e.message || String(e)); setStep("input"); }
  };

  const doImport = () => { onImport(toImport, { withDates, skipExisting, username: user.trim().replace(/^@/, "") }); };

  const toggle = (on, set, title, desc) => (
    <button type="button" onClick={() => set(!on)} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: text, padding: 0 }}>
      <span style={{ width: 38, height: 22, borderRadius: 999, background: on ? accent : (darkMode ? "rgba(255,255,255,0.15)" : "#cbd5e1"), position: "relative", flexShrink: 0, marginTop: 1, transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </span>
      <span><span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{title}</span><span style={{ display: "block", fontSize: 12, color: muted, lineHeight: 1.45, marginTop: 1 }}>{desc}</span></span>
    </button>
  );
  const stat = (n, label, color) => (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 14px", borderRadius: 14, background: tile, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: muted, marginTop: 5 }}>{label}</div>
    </div>
  );
  const chip = (t, c) => <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c, background: c + "22", border: `1px solid ${c}55`, whiteSpace: "nowrap" }}>{t}</span>;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, width: "100%", maxWidth: step === "preview" ? 760 : 480, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", color: text }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "#2563eb", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>A</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{en ? "Import from AniList" : "Importar do AniList"}</div>
              <div style={{ fontSize: 12, color: muted }}>{step === "preview" ? `@${user.trim().replace(/^@/, "")} · ${info.total} ${en ? "titles" : "títulos"}` : (en ? "Anime and manga · status, rating and completion date" : "Anime e manga · estado, nota e data de conclusão")}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={en ? "Close" : "Fechar"} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 22, lineHeight: 1, minWidth: 44, minHeight: 44 }}>×</button>
        </div>

        {step !== "preview" && (
          <div style={{ padding: 22 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8 }}>{en ? "AniList username" : "Nome de utilizador do AniList"}</label>
            <input ref={inputRef} value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && user.trim() && step === "input") search(); }}
              placeholder="ex: noe" disabled={step === "loading"} autoCapitalize="off" autoCorrect="off" spellCheck={false}
              style={{ width: "100%", boxSizing: "border-box", height: 46, padding: "0 14px", borderRadius: 12, border: `1px solid ${border}`, background: tile, color: text, fontSize: 15, fontFamily: "inherit", outline: "none" }} />
            <p style={{ fontSize: 12, color: muted, lineHeight: 1.55, margin: "10px 0 0" }}>{en ? "Your AniList profile has to be public. Nothing is saved until you confirm on the next screen." : "O teu perfil do AniList tem de ser público. Nada é gravado até confirmares no ecrã seguinte."}</p>
            {error && <div role="alert" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>{error}</div>}
            <button onClick={search} disabled={!user.trim() || step === "loading"} className="btn-accent" style={{ marginTop: 18, width: "100%", height: 46, borderRadius: 12, fontSize: 14, opacity: !user.trim() || step === "loading" ? 0.6 : 1 }}>
              {step === "loading" ? (en ? "Reading your list…" : "A ler a tua lista…") : (en ? "Find my list" : "Procurar a minha lista")}
            </button>
          </div>
        )}

        {step === "preview" && (<>
          <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {stat(info.total, en ? "found in the list" : "encontrados na lista", text)}
              {stat(info.owned, en ? "already in your library" : "já estão na tua biblioteca", muted)}
              {stat(info.withDate, en ? "completed, with a date" : "completos com data", "#34d399")}
              {stat(info.noDate, en ? "completed, no date" : "completos sem data", "#60a5fa")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
              {toggle(withDates, setWithDates, en ? "Import completion dates" : "Importar datas de conclusão", en ? "Titles with a date show up in the Diary, in the right month." : "Os títulos com data aparecem no Diário, no mês certo.")}
              {toggle(skipExisting, setSkipExisting, en ? "Skip what I already have" : "Ignorar o que já tenho", en ? "Doesn't duplicate or change your current items." : "Não duplica nem altera os teus itens atuais.")}
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.28)", fontSize: 12.5, lineHeight: 1.5 }}>
              {en ? <>Titles <b>without a date</b> are imported with status and rating but stay <b>out of the Diary</b> (they never get today's date).</> : <>Os títulos <b>sem data</b> entram com o estado e a nota, mas <b>ficam fora do Diário</b> (nunca ficam com a data de hoje).</>}
            </div>
            <div style={{ display: "flex", gap: 6, margin: "18px 0 8px" }}>
              {[["all", en ? "All" : "Tudo"], ["anime", "Anime"], ["manga", "Manga"]].map(([id, label]) => (
                <button key={id} onClick={() => setTypeFilter(id)} style={{ minHeight: 36, padding: "0 14px", borderRadius: 999, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${typeFilter === id ? accent : border}`, background: typeFilter === id ? accent : "transparent", color: typeFilter === id ? "#fff" : muted }}>{label}</button>
              ))}
            </div>
            <div>
              {shown.slice(0, MAX_ROWS).map(it => {
                const owned = have(it);
                const st = STATE_COLOR[it.userStatus] || muted;
                return (
                  <div key={it.id} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 92px 50px 96px 62px", alignItems: "center", gap: 12, padding: "8px 0", borderTop: `1px solid ${border}`, opacity: owned && skipExisting ? 0.55 : 1 }}>
                    <div style={{ width: 34, height: 48, borderRadius: 6, background: darkMode ? "#21262d" : "#e2e8f0", flexShrink: 0, overflow: "hidden" }}>
                      {it.cover && <img src={it.cover} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</div>
                      <div style={{ fontSize: 11.5, color: muted }}>{it.type === "anime" ? "Anime" : "Manga"}{it.year ? ` · ${it.year}` : ""}</div>
                    </div>
                    <div>{chip((en ? STATE_EN : STATE_PT)[it.userStatus] || it.userStatus, st)}</div>
                    <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 800, color: "#fbbf24" }}>{it.userRating ? `★ ${it.userRating}` : <span style={{ color: muted, fontWeight: 400 }}>—</span>}</div>
                    <div style={{ textAlign: "right", fontSize: 12, color: it.addedAt && withDates ? text : muted, fontStyle: it.addedAt && withDates ? "normal" : "italic" }}>
                      {it.userStatus !== "completo" ? "" : it.addedAt && withDates ? fmtDate(it.addedAt, en) : (en ? "no date" : "sem data")}
                    </div>
                    <div style={{ textAlign: "right" }}>{owned ? chip(en ? "Have it" : "Já tens", muted) : null}</div>
                  </div>
                );
              })}
              {shown.length > MAX_ROWS && <div style={{ fontSize: 12, color: muted, padding: "10px 0 0" }}>{en ? `Showing ${MAX_ROWS} of ${shown.length}` : `A mostrar ${MAX_ROWS} de ${shown.length}`}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
            <button onClick={() => setStep("input")} style={{ height: 44, padding: "0 18px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{en ? "Back" : "Voltar"}</button>
            <button onClick={doImport} disabled={!toImport.length} className="btn-accent" style={{ height: 44, padding: "0 22px", borderRadius: 12, fontSize: 14, opacity: toImport.length ? 1 : 0.5 }}>
              {toImport.length ? (en ? `Import ${toImport.length} titles` : `Importar ${toImport.length} títulos`) : (en ? "Nothing new to import" : "Nada de novo para importar")}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
