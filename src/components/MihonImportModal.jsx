import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { parseMihonBackup } from "../lib/importParsers";

export function MihonImportModal({ onClose, onImport }) {
  const { accent, darkMode } = useTheme();
  const { lang, useT } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});
  const [step, setStep] = useState('upload'); // upload | preview | done
  const fileRef = useRef();

  const processFile = async (file) => {
    setLoading(true); setError('');
    try {
      const parsed = await parseMihonBackup(file);
      if (!parsed.length) { setError(lang === "en" ? "No manga found. Make sure it\'s a valid .tachibk file." : "Nenhum manga encontrado. Certifica-te que é um ficheiro .tachibk válido."); setLoading(false); return; }
      const sel = {};
      parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError((lang === "en" ? "Error: " : "Erro: ") + err.message); }
    setLoading(false);
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };

  const statusLabelLocal = (id) => { const s = STATUS_OPTIONS.find(x=>x.id===id); return s ? `${s.emoji} ${statusLabel(s,lang)}` : id; };
  const statusColor = { assistindo: accent, completo: '#10b981', planejado: '#06b6d4' };
  const bg = darkMode ? '#161b22' : '#ffffff';
  const border = darkMode ? '#30363d' : '#e2e8f0';
  const subBg = darkMode ? '#0d1117' : '#f8fafc';

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📚</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{lang === "en" ? "Import from Mihon" : "Importar do Mihon"}</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>
                {step === 'upload' && (lang === "en" ? "Select backup file" : "Seleciona o ficheiro de backup")}
                {step === 'preview' && `${items.length} ${lang === "en" ? "manga found" : "mangas encontrados"}`}
                {step === 'done' && (lang === "en" ? "Import complete!" : "Importação concluída!")}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: subBg, border: `2px dashed ${accent}44`, borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{lang === "en" ? "Select .tachibk backup file" : "Seleciona o ficheiro .tachibk"}</p>
              <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 16 }}>Mihon → {lang === "en" ? "More" : "Mais"} → {lang === "en" ? "Backup & Restore" : "Backup e Restauro"} → {lang === "en" ? "Create backup" : "Criar backup"}</p>
              <input ref={fileRef} type="file" accept=".tachibk,.proto.gz,.gz" onChange={e => e.target.files[0] && processFile(e.target.files[0])} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} disabled={loading} style={{ padding: '10px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
                {loading ? <span className="spin">◌</span> : (lang === "en" ? "Choose file" : "Escolher ficheiro")}
              </button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)} style={{ fontSize: 11, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{useT("all")}</button>
                <button onClick={() => toggleAll(false)} style={{ fontSize: 11, color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{useT("overlayNone")}</button>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {items.map(m => (
                <div key={m.id} onClick={() => setSelected(s => ({ ...s, [m.id]: !s[m.id] }))} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: selected[m.id] ? `${accent}11` : subBg,
                  border: `1px solid ${selected[m.id] ? accent + '44' : border}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected[m.id] ? accent : '#30363d'}`, background: selected[m.id] ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected[m.id] && <span style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>✓</span>}
                  </div>
                  {m.thumbnailUrl ? (
                    <img src={m.thumbnailUrl} alt="" style={{ width: 32, height: 46, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} onError={e => e.currentTarget.style.display='none'} />
                  ) : (
                    <div style={{ width: 32, height: 46, borderRadius: 4, background: '#21262d', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🗒</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[m.userStatus] }}>{statusLabelLocal(m.userStatus)}</span>
                      {m.lastChapter && <span style={{ fontSize: 10, color: '#8b949e' }}>· {m.lastChapter}</span>}
                      {m.totalChapters > 0 && <span style={{ fontSize: 10, color: '#484f58' }}>({m.chaptersRead}/{m.totalChapters})</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('choose')} style={{ flex: 1, padding: 12, background: darkMode ? '#21262d' : '#f1f5f9', border: 'none', borderRadius: 10, color: darkMode ? '#e6edf3' : '#0d1117', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{useT("back")}</button>
              <button onClick={handleImport} style={{ flex: 2, padding: 12, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14 }}>
                Importar {Object.values(selected).filter(Boolean).length} mangas
              </button>
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{useT("importSuccess")}</h3>
            <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 20 }}>{lang === "en" ? "Your Mihon manga are now in your library." : "Os teus mangas do Mihon já estão na biblioteca."}</p>
            <button onClick={onClose} className="btn-accent" style={{ padding: '10px 28px', fontSize: 14 }}>{lang === "en" ? "Close" : "Fechar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
