import { useState, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { STATUS_OPTIONS, statusLabel } from "../config/constants";
import { parsePaperbackBackup } from "../lib/importParsers";

export function PaperbackImportModal({ onClose, onImport }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const bg = darkMode ? '#161b22' : '#ffffff';
  const border = darkMode ? '#30363d' : '#e2e8f0';

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setError('');
    try {
      const parsed = await parsePaperbackBackup(file);
      if (!parsed.length) { setError('Nenhum item encontrado. Certifica-te que é um backup Paperback (.zip) válido.'); setLoading(false); return; }
      const sel = {}; parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError('Erro: ' + err.message); }
    setLoading(false);
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };
  const statusColor = { assistindo: accent, completo: '#10b981', planejado: '#06b6d4' };
  const statusLabelLocal = (id) => { const s = STATUS_OPTIONS.find(x=>x.id===id); return s ? `${s.emoji} ${statusLabel(s,lang)}` : id; };
  const typeIcon = { manga: '🗒', comics: '💬' };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📖</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{lang === "en" ? "Import from Paperback" : "Importar do Paperback"}</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{step === 'preview' ? `${items.length} itens encontrados` : 'Backup iOS'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: darkMode ? '#0d1117' : '#f8fafc', borderRadius: 12, padding: 20, textAlign: 'center', border: `2px dashed ${darkMode ? '#30363d' : '#e2e8f0'}`, marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{lang === "en" ? "Select backup file" : "Seleciona o ficheiro de backup"}</p>
              <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>Ficheiro .zip ou .pas4 exportado pelo Paperback</p>
              <input ref={fileRef} type="file" accept=".zip,.pas4" onChange={handleFile} style={{ display: 'none' }} />
              <button className="btn-accent" onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', fontSize: 13 }}>
                {loading ? '⏳ A processar...' : 'Escolher ficheiro .zip'}
              </button>
            </div>
            <div style={{ background: darkMode ? '#161b2288' : '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
              💡 <strong>Como exportar do Paperback:</strong><br />
              Paperback → <strong>{lang === "en" ? "Settings" : "Definições"}</strong> → <strong>Backup</strong> → <strong>{lang === "en" ? "Create Backup" : "Criar Backup"}</strong> → {lang === "en" ? "share the .zip file" : "partilhar o ficheiro .zip"}
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#8b949e' }}>{Object.values(selected).filter(Boolean).length} selecionados</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAll(true)}  style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>{useT("all")}</button>
                <button onClick={() => toggleAll(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{useT("overlayNone")}</button>
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {items.map(item => (
                <div key={item.id} onClick={() => setSelected(s => ({ ...s, [item.id]: !s[item.id] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selected[item.id] ? `${accent}11` : (darkMode ? '#0d1117' : '#f8fafc'), border: `1px solid ${selected[item.id] ? accent + '44' : (darkMode ? '#21262d' : '#e2e8f0')}` }}>
                  <div style={{ width: 32, height: 44, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: '#21262d' }}>
                    {item.cover && <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display='none'} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <p style={{ fontSize: 10, color: '#8b949e', marginTop: 1 }}>{typeIcon[item.type] || '📖'} {item.type} · {item.chaptersRead}/{item.totalChapters} cap.</p>
                  </div>
                  <span style={{ fontSize: 10, color: statusColor[item.userStatus], fontWeight: 700, flexShrink: 0 }}>{statusLabelLocal(item.userStatus)}</span>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{selected[item.id] ? '☑' : '☐'}</span>
                </div>
              ))}
            </div>
            <button onClick={handleImport} className="btn-accent" disabled={!Object.values(selected).some(Boolean)} style={{ width: '100%', padding: '12px 0', fontSize: 14 }}>
              Importar {Object.values(selected).filter(Boolean).length} itens
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{lang === "en" ? "Import complete!" : "Importação concluída!"}</p>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>{lang === "en" ? "Your Paperback items are now in your library." : "Os teus itens do Paperback já estão na biblioteca."}</p>
            <button onClick={onClose} className="btn-accent" style={{ padding: '10px 28px', fontSize: 14 }}>{lang === "en" ? "Close" : "Fechar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
