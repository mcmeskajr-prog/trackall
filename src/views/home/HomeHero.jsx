import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { MEDIA_TYPES, mediaLabel } from "../../config/constants";

// Cabeçalho da Home: avatar, nome, contagens por estado e filtro por tipo.
export function HomeHero({ profile, items, stats, homeStatColors, homeFilter, setHomeFilter }) {
  const { accent, darkMode } = useTheme();
  const { lang, useT } = useLang();
  return (
    <div className="hero-gradient" style={{ padding: "16px 16px 14px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Avatar + Name + Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          {/* Avatar compacto */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            border: `2.5px solid ${accent}`,
            boxShadow: `0 0 0 3px ${accent}33`,
            background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>
            {profile.avatar
              ? <img src={profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : "👤"}
          </div>
          {/* Right: nome + stats numa linha */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1.1, marginBottom: 2, backgroundImage: `linear-gradient(90deg, ${accent}, #e6edf3)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {profile.name || "Utilizador"}
            </h2>
            <p style={{ fontSize: 12, color: darkMode ? "#6b7280" : "#94a3b8", marginBottom: 8, fontWeight: 500 }}>
              <span style={{ color: darkMode ? "#c9d1d9" : "#475569", fontWeight: 700 }}>{items.length}</span> {useT("inLibraryCount")}
            </p>
            {/* Stats compactas numa linha */}
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { l: lang === "en" ? "Progress" : "Curso",   v: stats.assistindo, key: "assistindo" },
                { l: useT("completo"),                        v: stats.completo,   key: "completo"   },
                { l: lang === "en" ? "Paused" : "Pausa",     v: stats.pausa,      key: "pausa"      },
                { l: useT("dropado"),                         v: stats.largado,    key: "largado"    },
                { l: lang === "en" ? "Planned" : "Planej.",   v: stats.planejado,  key: "planejado"  },
              ].filter(s => s.v > 0).map((s) => {
                const col = homeStatColors[s.key];
                return (
                  <div key={s.l} style={{
                    flex: "1 1 0", minWidth: 0,
                    background: `${col}14`,
                    borderLeft: `2px solid ${col}`,
                    borderRadius: "0 6px 6px 0",
                    padding: "4px 5px",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: col, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ color: "#8b949e", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 1 }}>{s.l}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter tags — tab style */}
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
          {MEDIA_TYPES.slice(1).map((t) => {
            const active = homeFilter.includes(t.id);
            return (
              <button key={t.id} onClick={() => {
                setHomeFilter(prev =>
                  prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                );
              }} style={{
                flexShrink: 0, background: "none", border: "none",
                borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
                marginBottom: -1,
                color: active ? accent : (darkMode ? "#8b949e" : "#64748b"),
                padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 700 : 500,
                WebkitTapHighlightColor: "transparent",
              }}>
                {mediaLabel(t, lang)}
              </button>
            );
          })}
          {homeFilter.length > 0 && (
            <button onClick={() => setHomeFilter([])} style={{
              flexShrink: 0, background: "none", border: "none",
              borderBottom: "2px solid transparent", marginBottom: -1,
              color: "#ef4444", padding: "8px 10px",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              WebkitTapHighlightColor: "transparent",
            }}>✕</button>
          )}
        </div>
      </div>
    </div>
  );
}
