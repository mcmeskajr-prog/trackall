import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";

// Nitidez leve (unsharp mask 4 vizinhos). Só RGB; o alfa fica igual.
function sharpen(ctx, w, h, amount) {
  try {
    const src = ctx.getImageData(0, 0, w, h);
    const d = src.data, o = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const avg = (d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c]) / 4;
          o[i + c] = d[i + c] + amount * (d[i + c] - avg) * 2;
        }
      }
    }
    src.data.set(o);
    ctx.putImageData(src, 0, 0);
  } catch { /* canvas protegido: segue sem nitidez */ }
}

export function CropModal({imageSrc, aspectRatio = 1, outputWidth, onSave, onClose, title = "Recortar imagem" }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [startDrag, setStartDrag] = useState(null);
  const imgRef = useRef(null);

  const CANVAS_W = outputWidth || (aspectRatio > 1 ? 900 : 320);
  const CANVAS_H = Math.round(CANVAS_W / aspectRatio);

  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoadError(false); setLoading(true);
    const img = new window.Image();
    const timeout = setTimeout(() => { setLoadError(true); setLoading(false); }, 12000);
    img.onload = () => {
      clearTimeout(timeout);
      imgRef.current = img;
      const initScale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
      setScale(initScale);
      setOffset({ x: (CANVAS_W - img.width * initScale) / 2, y: (CANVAS_H - img.height * initScale) / 2 });
      setImgSize({ w: img.width, h: img.height });
      setLoading(false);
    };
    img.onerror = () => { clearTimeout(timeout); setLoadError(true); setLoading(false); };
    img.src = imageSrc;
    return () => clearTimeout(timeout);
  }, [imageSrc]);

  useEffect(() => { drawCanvas(); }, [offset, scale, imgSize]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(imgRef.current, offset.x, offset.y, imgSize.w * scale, imgSize.h * scale);
  };

  const clampOffset = (ox, oy, s) => {
    const iw = imgSize.w * s, ih = imgSize.h * s;
    return {
      x: Math.min(0, Math.max(CANVAS_W - iw, ox)),
      y: Math.min(0, Math.max(CANVAS_H - ih, oy)),
    };
  };

  const kScale = () => { const r = canvasRef.current?.getBoundingClientRect(); return r && r.width ? CANVAS_W / r.width : 1; };
  const onMouseDown = (e) => { const k = kScale(); setDrag(true); setStartDrag({ x: e.clientX * k - offset.x, y: e.clientY * k - offset.y }); };
  const onMouseMove = (e) => {
    if (!drag || !startDrag) return;
    const k = kScale(); const newOff = clampOffset(e.clientX * k - startDrag.x, e.clientY * k - startDrag.y, scale);
    setOffset(newOff);
  };
  const onMouseUp = () => { setDrag(false); setStartDrag(null); };
  const onTouchStart = (e) => { const t = e.touches[0]; const k = kScale(); setDrag(true); setStartDrag({ x: t.clientX * k - offset.x, y: t.clientY * k - offset.y }); };
  const onTouchMove = (e) => {
    if (!drag || !startDrag) return;
    const t = e.touches[0];
    const k = kScale(); const newOff = clampOffset(t.clientX * k - startDrag.x, t.clientY * k - startDrag.y, scale);
    setOffset(newOff);
  };

  const handleZoom = (delta) => {
    const newScale = Math.max(scale + delta, Math.max(CANVAS_W / imgSize.w, CANVAS_H / imgSize.h));
    const newOff = clampOffset(offset.x, offset.y, newScale);
    setScale(newScale);
    setOffset(newOff);
  };

  // Recorta a zona visível a partir da imagem ORIGINAL (uma só reamostragem) e, quando é preciso
  // ampliar, sobe em passos de 2x com suavização "high" e aplica nitidez leve (só em ampliações).
  const renderCrop = () => {
    const img = imgRef.current;
    const sx = -offset.x / scale, sy = -offset.y / scale;
    const sw = CANVAS_W / scale, sh = CANVAS_H / scale;
    let cur = img, cx = sx, cy = sy, cw = sw, ch = sh;
    let w = Math.round(sw), h = Math.round(sh);
    while (w * 2 < CANVAS_W) {
      w *= 2; h *= 2;
      const step = document.createElement("canvas");
      step.width = w; step.height = h;
      const c = step.getContext("2d");
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      c.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
      cur = step; cx = 0; cy = 0; cw = w; ch = h;
    }
    const out = document.createElement("canvas");
    out.width = CANVAS_W; out.height = CANVAS_H;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, cx, cy, cw, ch, 0, 0, CANVAS_W, CANVAS_H);
    if (scale > 1.2) sharpen(ctx, CANVAS_W, CANVAS_H, Math.min(0.6, 0.2 + (scale - 1.2) * 0.15));
    return out;
  };

  const handleSave = () => {
    if (!imgRef.current) return;
    const canvas = renderCrop();
    onSave(canvas.toDataURL("image/jpeg", outputWidth ? 0.97 : 0.95));
  };

  const small = !loading && !loadError && scale > 1.25;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#161b22", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>{title}</h3>
        <div style={{ borderRadius: 12, overflow: "hidden", cursor: drag ? "grabbing" : "grab", marginBottom: 16, touchAction: "none", minHeight: loading || loadError ? 160 : undefined, display: loading || loadError ? "flex" : "block", alignItems: "center", justifyContent: "center", background: loading || loadError ? "#0d1117" : undefined }}>
          {loading && <p style={{ fontSize: 13, color: "#8b949e" }}>{lang === "en" ? "Loading image..." : "A carregar imagem..."}</p>}
          {loadError && <p style={{ fontSize: 13, color: "#ef4444", textAlign: "center", padding: "0 16px" }}>{lang === "en" ? "Couldn't load this image. Try a different file or a direct link instead." : "Não foi possível carregar esta imagem. Tenta outro ficheiro ou um link direto."}</p>}
          {!loading && !loadError && (
            <canvas
              ref={canvasRef}
              width={CANVAS_W} height={CANVAS_H}
              style={{ display: "block", width: "100%" }}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
            />
          )}
        </div>
        {small && <p style={{ fontSize: 11.5, color: "#f59e0b", textAlign: "center", marginBottom: 8, lineHeight: 1.5 }}>{lang === "en" ? "This image is small for this size and may look a bit soft. A larger one will look sharper." : "Esta imagem é pequena para este tamanho e pode ficar um pouco suave. Uma maior fica mais nítida."}</p>}
        <p style={{ fontSize: 11, color: "#484f58", textAlign: "center", marginBottom: 12 }}>{lang === "en" ? "Drag to reposition" : "Arrasta para reposicionar"}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <button onClick={() => handleZoom(-0.1)} disabled={loading || loadError} style={{ padding: "6px 16px", background: "#21262d", border: "none", borderRadius: 8, color: "#e6edf3", cursor: "pointer", fontSize: 18, fontFamily: "inherit", opacity: loading || loadError ? 0.4 : 1 }}>−</button>
          <span style={{ color: "#8b949e", fontSize: 12, alignSelf: "center" }}>Zoom</span>
          <button onClick={() => handleZoom(0.1)} disabled={loading || loadError} style={{ padding: "6px 16px", background: "#21262d", border: "none", borderRadius: 8, color: "#e6edf3", cursor: "pointer", fontSize: 18, fontFamily: "inherit", opacity: loading || loadError ? 0.4 : 1 }}>+</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={loading || loadError} style={{ flex: 1, padding: 12, background: "#f97316", border: "none", borderRadius: 10, color: "white", cursor: loading || loadError ? "default" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, opacity: loading || loadError ? 0.5 : 1 }}>{lang === "en" ? "✓ Save" : "✓ Guardar"}</button>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: "#21262d", border: "none", borderRadius: 10, color: "#e6edf3", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
