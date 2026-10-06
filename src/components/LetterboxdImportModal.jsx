import { useState, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { parseLetterboxdCSV } from "../lib/importParsers";

export function LetterboxdImportModal({ onClose, onImport }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [step, setStep] = useState('upload');
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
      const text = await file.text();
      const parsed = parseLetterboxdCSV(text);
      if (!parsed.length) { setError('Nenhum filme encontrado. Certifica-te que é o ficheiro diary.csv ou watched.csv do Letterboxd.'); setLoading(false); return; }
      const sel = {}; parsed.forEach(m => { sel[m.id] = true; });
      setItems(parsed); setSelected(sel); setStep('preview');
    } catch (err) { setError('Erro: ' + err.message); }
    setLoading(false);
  };

  const toggleAll = (v) => { const s = {}; items.forEach(m => { s[m.id] = v; }); setSelected(s); };
  const handleImport = () => { onImport(items.filter(m => selected[m.id])); setStep('done'); };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#00e05422', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎬</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{lang === "en" ? "Import from Letterboxd" : "Importar do Letterboxd"}</h3>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{step === 'preview' ? `${items.length} filmes encontrados` : 'CSV de filmes vistos'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div style={{ background: darkMode ? '#0d1117' : '#f8fafc', borderRadius: 12, padding: 20, textAlign: 'center', border: `2px dashed ${darkMode ? '#30363d' : '#e2e8f0'}`, marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎞️</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{lang === "en" ? "Select CSV file" : "Seleciona o ficheiro CSV"}</p>
              <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>diary.csv ou watched.csv exportado do Letterboxd</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? '⏳ A processar...' : 'Escolher ficheiro .csv'}
              </button>
            </div>
            <div style={{ background: darkMode ? '#161b2288' : '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
              💡 <strong>Como exportar do Letterboxd:</strong><br />
              letterboxd.com → <strong>Settings</strong> → <strong>Import & Export</strong> → <strong>Export Your Data</strong> → usar <code>watched.csv</code>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: selected[item.id] ? `${accent}11` : (darkMode ? '#0d1117' : '#f8fafc'), border: `1px solid ${selected[item.id] ? accent + '44' : (darkMode ? '#21262d' : '#e2e8f0')}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: '#8b949e', marginTop: 1 }}>🎬 {item.year || '—'}{item.userRating > 0 ? ` · ★ ${item.userRating}/10` : ''}</p>
                  </div>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{selected[item.id] ? '☑' : '☐'}</span>
                </div>
              ))}
            </div>
            <button onClick={handleImport} style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}
              disabled={!Object.values(selected).some(Boolean)}>
              Importar {Object.values(selected).filter(Boolean).length} filmes
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{lang === "en" ? "Import complete!" : "Importação concluída!"}</p>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>{lang === "en" ? "Your Letterboxd films are now in your library." : "Os teus filmes do Letterboxd já estão na biblioteca."}</p>
            <button onClick={onClose} style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, borderRadius: 10, background: '#00e054', border: 'none', color: '#0d1117', cursor: 'pointer', fontFamily: 'inherit' }}>{lang === "en" ? "Close" : "Fechar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
