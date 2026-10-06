import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa } from "../config/supabase";
import { MEDIA_TYPES, TYPE_COLORS, mediaLabel } from "../config/constants";

export function FeedTab({ accepted, getFriendInfo }) {
  const { accent, darkMode, isMobileDevice } = useTheme();

  const { lang, useT } = useLang();
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    const loadFeed = async () => {
      setFeedLoading(true);
      try {
        const allActivity = [];
        await Promise.all(accepted.map(async (f) => {
          const friendInfo = getFriendInfo(f);
          const lib = await supa.getFriendLibrary(friendInfo.id);
          const libItems = Object.values(lib || {});
          const recent = libItems
            .filter(i => i.addedAt && (i.userStatus === "completo" || i.userStatus === "assistindo"))
            .map(i => ({ ...i, friendName: friendInfo.name || "Utilizador", friendAvatar: friendInfo.avatar || null, friendId: friendInfo.id }));
          allActivity.push(...recent);
        }));
        allActivity.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        setFeedItems(allActivity.slice(0, 80));
      } catch (e) { console.error(e); }
      setFeedLoading(false);
    };
    loadFeed();
  }, [accepted.length]);

  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "agora";
    if (m < 60) return `há ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d}d`;
    return `há ${Math.floor(d / 30)}mes`;
  };

  if (accepted.length === 0) return (
    <div style={{ padding: "60px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
      <p style={{ color: "#484f58", fontSize: 14 }}>{lang === "en" ? "Add friends to see activity here." : "Adiciona amigos para ver a atividade aqui."}</p>
    </div>
  );

  if (feedLoading) return (
    <div style={{ padding: "60px 16px", textAlign: "center", color: "#484f58" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      A carregar feed...
    </div>
  );

  if (feedItems.length === 0) return (
    <div style={{ padding: "60px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
      <p style={{ color: "#484f58", fontSize: 14 }}>{lang === "en" ? "No recent activity from your friends yet." : "Ainda não há atividade recente dos teus amigos."}</p>
    </div>
  );

  return (
    <div style={{ padding: "0 16px" }}>
      {feedItems.map((item, idx) => {
        const tc = TYPE_COLORS[item.type];
        const mt = MEDIA_TYPES.find(t => t.id === item.type);
        const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
        const isCompleto = item.userStatus === "completo";
        return (
          <div key={`${item.friendId}-${item.id}-${idx}`} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e8e0d5"}` }}>
            {/* Avatar */}
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#21262d", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: `2px solid ${accent}44` }}>
              {item.friendAvatar ? <img src={item.friendAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} /> : "👤"}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 5 }}>
                <span style={{ fontWeight: 800, color: accent }}>{item.friendName}</span>
                <span style={{ color: darkMode ? "#6b7280" : "#94a3b8" }}> {isCompleto ? "completou" : "está a ver"} </span>
                <span style={{ fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117" }}>{item.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {mt && tc && (
                  <span style={{ background: `${tc}18`, color: tc, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 800, letterSpacing: "0.03em" }}>
                    {mediaLabel(mt, lang)}
                  </span>
                )}
                {item.userRating > 0 && (
                  <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 800 }}>★ {item.userRating}</span>
                )}
                <span style={{ fontSize: 11, color: "#484f58", marginLeft: "auto" }}>{timeAgo(item.addedAt)}</span>
              </div>
            </div>
            {/* Capa */}
            <div style={{ width: 44, height: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1.5px solid ${tc || accent}33`, background: "#161b22" }}>
              {coverSrc
                ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display = "none"} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{mt?.icon}</div>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}
