import { useState, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { gradientFor, compressImage } from "../lib/utils";
import { persistImage } from "../lib/imageStore";

export function CoverEditModal({item, onSave, onClose }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [url, setUrl] = useState(item.customCover || item.cover || "");
  const [preview, setPreview] = useState(item.customCover || item.cover || "");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const compressed = await persistImage(await compressImage(file));
    setLoading(false);
    if (compressed) { setUrl(compressed); setPreview(compressed); }
  };

  const handleUrlChange = (v) => { setUrl(v); setPreview(v); };

  return (
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 170, ...(isMobileDevice ? { paddingBottom: 64 } : {}) }}>
      <div className="modal fade-in cover-modal" style={{ maxWidth: 440, padding: 0, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        {/* Conteúdo scrollável */}
        <div style={{ overflowY: "auto", padding: 24, paddingBottom: 8, flex: 1 }}>
          <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>🖼 {lang === "en" ? "Change Cover" : "Alterar Capa"}</h3>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            {/* Preview */}
            <div style={{
              width: 100, height: 144, borderRadius: 10, overflow: "hidden", flexShrink: 0,
              background: gradientFor(item.id), border: "2px dashed #30363d",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
              {loading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="spin" style={{ fontSize: 24 }}>◌</span>
                </div>
              )}
              {preview
                ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setPreview("")} />
                : <span style={{ color: "#484f58", fontSize: 32 }}>🖼</span>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder="URL da imagem..."
                value={url.startsWith("data:") ? "" : url}
                onChange={(e) => handleUrlChange(e.target.value)}
                style={{ padding: "10px 12px", fontSize: 13, width: "100%" }}
              />
              <div style={{ textAlign: "center", color: "#484f58", fontSize: 11 }}>ou</div>
              <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{
                padding: "10px", borderRadius: 8, border: "1px dashed #30363d",
                background: "transparent", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              }}>📁 {lang === "en" ? "Choose file" : "Escolher ficheiro"}</button>
              {url && (
                <button onClick={() => { setUrl(""); setPreview(""); }} style={{
                  padding: "8px", borderRadius: 8, border: "1px solid #ef444444",
                  background: "transparent", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                }}>🗑 {lang === "en" ? "Remove cover" : "Remover capa"}</button>
              )}
              <p style={{ fontSize: 10, color: "#484f58" }}>{lang === "en" ? "Files are compressed automatically" : "Ficheiros são comprimidos automaticamente"}</p>
            </div>
          </div>
        </div>
        {/* Botões fixos no fundo */}
        <div style={{ padding: "12px 24px", paddingBottom: isMobileDevice ? 24 : 16, borderTop: "1px solid #21262d", display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn-accent" style={{ flex: 1, padding: "13px" }} onClick={() => onSave(url)} disabled={loading}>
            {loading ? useT("compressing") : useT("saveProfile")}
          </button>
          <button onClick={onClose} style={{
            flex: 1, padding: "13px", background: "#21262d", border: "none",
            borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14,
          }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
        </div>
      </div>
    </div>
  );
}
