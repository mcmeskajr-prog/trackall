import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, STATUS_OPTIONS, mediaLabel } from "../config/constants";
import { TypeIcon } from "./TypeIcon";

export function LibGroupedList({ items, library, onOpen }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();

  const [collapsed, setCollapsed] = useState({});
  const toggle = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const groups = MEDIA_TYPES.slice(1)
    .map(t => ({ type: t, items: items.filter(i => i.type === t.id) }))
    .filter(g => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map(({ type: t, items: gItems }) => (
        <div key={t.id}>
          <button onClick={() => toggle(t.id)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: "none", border: "none", cursor: "pointer", padding: "4px 0 8px",
            fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: 15 }}><TypeIcon id={t.id} /></span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: darkMode ? "#8b949e" : "#64748b" }}>{mediaLabel(t, lang)}</span>
            <span style={{ fontSize: 10, color: accent, background: `${accent}18`, padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{gItems.length}</span>
            <span style={{ marginLeft: "auto", color: "#484f58", fontSize: 13, transform: collapsed[t.id] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
          </button>
          {!collapsed[t.id] && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {gItems.map(item => {
                const libItem = findLibraryEntry(library, item.id, item.type)?.item;
                const status = STATUS_OPTIONS.find(s => s.id === libItem?.userStatus);
                const coverSrc = libItem?.customCover || item.cover || item.thumbnailUrl;
                return (
                  <div key={item.id} onClick={() => onOpen(item)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "7px 10px",
                    borderRadius: 8, cursor: "pointer",
                    background: darkMode ? "#161b22" : "rgba(255,252,247,0.8)",
                    border: `1px solid ${darkMode ? "#21262d" : "#e8e0d5"}`,
                    transition: "background 0.12s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1c2128" : "#fffcf7"}
                    onMouseLeave={e => e.currentTarget.style.background = darkMode ? "#161b22" : "rgba(255,252,247,0.8)"}>
                    <div style={{ width: 34, height: 48, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: gradientFor(item.id) }}>
                      {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: darkMode ? "#e6edf3" : "#1a1a2e" }}>{item.title}</p>
                      {item.year && <p style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>{item.year}</p>}
                    </div>
                    {status && <span style={{ fontSize: 12, flexShrink: 0 }}>{status.emoji}</span>}
                    {libItem?.userRating > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 800, flexShrink: 0 }}>★ {libItem.userRating}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


