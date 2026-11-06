import { SIX_MONTHS } from "./homeUtils";
import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { getMediaTypeLabel } from "../../config/constants";
import { supa } from "../../config/supabase";

// «Provavelmente nunca vais consumir»: planeados há 6+ meses.
export function HomeGraveyard({ items, user, setLibrary, graveyardOpen, setGraveyardOpen, setSelectedItem }) {
  const { darkMode, panelBg } = useTheme();
  const { lang } = useLang();
  const now = Date.now();
  const recentCompleted = items.filter(i => i?.userStatus === "completo").sort((a,b) => (b.addedAt||0)-(a.addedAt||0)).slice(0,20);
  const genreCounts = {};
  recentCompleted.forEach(i => (i.genres||[]).forEach(g => { genreCounts[g] = (genreCounts[g]||0)+1; }));
  const topGenres = new Set(Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([g])=>g));
  const graveyard = items.filter(i => {
    if (!i) return false;
    if (i.userStatus !== "planejado" && i.userStatus !== "planeado") return false;
    return (now - (i.addedAt || now)) > SIX_MONTHS;
  }).map(i => {
    const outOfPattern = topGenres.size > 0 && !(i.genres||[]).some(g => topGenres.has(g));
    const monthsOld = Math.floor((now-(i.addedAt||now))/(1000*60*60*24*30));
    const reason = outOfPattern ? (lang==="en" ? "out of your pattern" : "fora do teu padrão") : (lang==="en" ? `forgotten for ${monthsOld}m` : `esquecido há ${monthsOld}m`);
    return { ...i, reason, monthsOld };
  }).sort((a,b) => b.monthsOld-a.monthsOld);
  if (graveyard.length === 0) return null;
  const open = graveyardOpen;
  const visible = open ? graveyard : graveyard.slice(0,3);
  const removeItem = async (item) => {
    const cat = item.type+"s";
    setLibrary(prev => { const next={...prev}; if(next[cat]){next[cat]={...next[cat]};delete next[cat][item.id];} return next; });
    if (user) try { await supa.removeFromLibrary(user.id, item.id, item.type); } catch {}
  };
  return (
    <div style={{ margin: "20px 0 4px", padding: "0 16px" }}>
      <div style={{ background: panelBg || (darkMode ? "rgba(12,12,16,0.30)" : "rgba(255,255,255,0.28)"), border: "1px solid #e74c3c30", borderRadius: 14, padding: "10px 12px 4px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div>
            <h3 style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e74c3c", marginBottom: 2 }}>
              {lang==="en" ? "Probably never consuming this" : "Provavelmente nunca vais consumir"}
            </h3>
            <div style={{ fontSize: 11, color: "#8b949e" }}>{graveyard.length} {lang==="en" ? "titles · added 6+ months ago" : "títulos · adicionados há 6+ meses"}</div>
          </div>
        </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {visible.map(item => {
          const cover = item.customCover || item.cover;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "0.5px solid rgba(231,76,60,0.15)" }}>
              <div onClick={() => setSelectedItem(item)} style={{ width: 52, height: 74, borderRadius: 6, overflow: "hidden", background: "#161b22", cursor: "pointer", flexShrink: 0 }}>
                {cover ? <img src={cover} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={e=>e.currentTarget.style.display="none"}/> : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#484f58",fontSize:18 }}>?</div>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 2 }}>{getMediaTypeLabel(item.type, lang)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#f8fafc" : "#0f172a", marginBottom: 4, lineHeight: 1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 5 }}>{lang==="en" ? `Added ${item.monthsOld}m ago` : `Adicionado há ${item.monthsOld}m`}</div>
                <span style={{ fontSize: 10, color: "#e2a84a", background: "rgba(226,168,74,0.12)", padding: "2px 7px", borderRadius: 4 }}>{item.reason}</span>
              </div>
              <button onClick={() => removeItem(item)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "0.5px solid rgba(231,76,60,0.4)", background: "transparent", color: "#e74c3c", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                {lang==="en" ? "remove" : "remover"}
              </button>
            </div>
          );
        })}
      </div>
      {graveyard.length > 3 && (
        <button onClick={() => setGraveyardOpen(v=>!v)} style={{ display:"block",width:"100%",padding:"10px 0",background:"none",border:"none",borderTop:"0.5px solid rgba(231,76,60,0.15)",color:"#8b949e",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"center" }}>
          {open ? (lang==="en" ? "show less" : "mostrar menos") : `${lang==="en" ? "see all" : "ver todos"} (${graveyard.length})`}
        </button>
      )}
      </div>
    </div>
  );
}
