import { useState, useEffect, useRef } from "react";

// Botão ⚙ (ou ⋯) com um pequeno menu. Usado no perfil do telemóvel no lugar de «Editar perfil / Personalizar / Sair».
// items: [{ label, onClick, danger? }] — entradas sem onClick são ignoradas.
export function ProfileMenu({ items, accent, darkMode, lang, style, glyph = "gear" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const list = (items || []).filter(i => i && i.onClick);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);
  if (!list.length) return null;
  return (
    <div ref={ref} style={{ position: "absolute", zIndex: 40, ...style }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={lang === "en" ? "Profile options" : "Opções do perfil"} aria-expanded={open}
        style={{ width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#f1f5f9",
          background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
        {glyph === "gear"
          ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          : <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>}
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: 46, minWidth: 190, borderRadius: 16, overflow: "hidden",
          background: darkMode ? "#1a1e27" : "#ffffff", border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)"}`, boxShadow: "0 20px 40px rgba(0,0,0,0.55)" }}>
          {list.map((it, i) => (
            <button key={i} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: it.danger ? "#fb7185" : (darkMode ? "#e6edf3" : "#0f172a"), borderTop: i ? `1px solid ${darkMode ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)"}` : "none" }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
