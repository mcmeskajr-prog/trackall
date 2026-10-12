import { useState, useEffect, useRef } from "react";

export function SidebarSearch({ accent, darkMode, activeTab, doSearch, setSearchQuery, setView, useT }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const submit = () => {
    if (!q.trim()) return;
    setSearchQuery(q);
    setView("search");
    doSearch(q, activeTab);
    setOpen(false); setQ("");
  };
  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)} className="ds-nav-btn" style={{ padding: "11px 16px" }}>
          <span className="ds-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/>
              <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          {useT("search")}
        </button>
      ) : (
        <div ref={containerRef} style={{ margin: "2px 8px", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, background: darkMode ? "rgba(255,255,255,0.06)" : "#f1f5f9", borderRadius: 12, border: `1px solid ${accent}66`, boxShadow: `0 0 0 3px ${accent}1f`, minWidth: 0, width: "calc(100% - 16px)", boxSizing: "border-box" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="10.5" cy="10.5" r="6.5" stroke={accent} strokeWidth="2"/>
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setOpen(false); setQ(""); }
            }}
            placeholder={useT("search") + "..."}
            style={{ flex: 1, background: "transparent", border: "none", boxShadow: "none", borderRadius: 0, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 14, outline: "none", padding: 0, margin: 0, height: "auto", minWidth: 0, width: "100%" }} />
          <button onClick={() => { setOpen(false); setQ(""); }} aria-label="Fechar" style={{ background: "none", border: "none", color: darkMode ? "#8b949e" : "#64748b", cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0, padding: "6px 4px", margin: "-6px -4px" }}>✕</button>
        </div>
      )}
    </>
  );
}
