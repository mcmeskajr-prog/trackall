import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa } from "../config/supabase";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, STATUS_OPTIONS, mediaLabel, statusLabel } from "../config/constants";
import { FeedTab } from "./FeedTab";
import { ProfileTabCompletos } from "./ProfileTabCompletos";
import { ProfileTabDiario } from "./ProfileTabDiario";
import { isColorDark } from "../config/theme";
import { TYPE_COLORS, MONTH_EN, MONTH_PT } from "../config/constants";
import { TypeIcon } from "./TypeIcon";

export function FriendsView({user, accent, darkMode = true, isMobileDevice = false, library = {} }) {
  const { lang, useT } = useLang();
  const [tab, setTab] = useState("friends"); // friends | search | requests
  const [friendships, setFriendships] = useState([]);
  const [friendTab, setFriendTab] = useState("perfil");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [showAllDiary, setShowAllDiary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState("");

  const showNotif = (msg) => { setNotif(msg); setTimeout(() => setNotif(""), 2500); };

  useEffect(() => { loadFriendships(); }, []);

  const loadFriendships = async () => {
    setLoading(true);
    const data = await supa.getFriendships(user.id);
    setFriendships(data);
    setLoading(false);
  };

  const accepted = useMemo(() => friendships.filter(f => f.status === "accepted"), [friendships]);
  const pending = useMemo(() => friendships.filter(f => f.status === "pending" && f.addressee_id === user.id), [friendships, user.id]);
  const sent = useMemo(() => friendships.filter(f => f.status === "pending" && f.requester_id === user.id), [friendships, user.id]);

  const getFriendInfo = (f) => f.requester_id === user.id ? f.addressee : f.requester;

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    const results = await supa.searchUsers(searchQ);
    setSearchResults(results.filter(r => r.id !== user.id));
    setSearching(false);
  };

  const handleSendRequest = async (targetId) => {
    try {
      await supa.sendFriendRequest(user.id, targetId);
      showNotif("Pedido enviado!");
      await loadFriendships();
    } catch (e) {
      if (e.message?.includes("duplicate")) {
        showNotif("Pedido já enviado!");
      } else {
        showNotif("Erro: " + e.message);
      }
      await loadFriendships();
    }
  };

  const handleAccept = async (fId) => {
    await supa.acceptFriendRequest(fId);
    showNotif(useT("friendAdded"));
    await loadFriendships();
  };

  const handleDecline = async (fId) => {
    await supa.declineFriendRequest(fId);
    await loadFriendships();
  };

  const handleRemove = async (f) => {
    await supa.removeFriend(f.requester_id, f.addressee_id);
    showNotif(useT("friendRemoved"));
    await loadFriendships();
    setSelectedFriend(null);
  };

  const openFriendProfile = async (friendId, friendInfo) => {
    setSelectedFriend(friendInfo);
    const [prof, lib] = await Promise.all([supa.getFriendProfile(friendId), supa.getFriendLibrary(friendId)]);
    setFriendData({ profile: prof, library: lib });
    setFriendTab("perfil");
  };

  const friendshipStatus = (targetId) => {
    const f = friendships.find(f =>
      (f.requester_id === user.id && f.addressee_id === targetId) ||
      (f.addressee_id === user.id && f.requester_id === targetId)
    );
    if (!f) return null;
    return { status: f.status, isRequester: f.requester_id === user.id, id: f.id };
  };

  if (selectedFriend && friendData) {
    const libItems = Object.values(friendData.library || {});
    const favs = friendData.profile?.favorites || [];
    const byStatus = {};
    STATUS_OPTIONS.forEach(s => { byStatus[s.id] = libItems.filter(i => i.userStatus === s.id).length; });
    const rated = libItems.filter(i => i.userRating > 0);
    const avgRating = rated.length ? (rated.reduce((a, i) => a + i.userRating, 0) / rated.length).toFixed(1) : "—";
    const completados = libItems.filter(i => i.userStatus === "completo").sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    const inCurso = libItems.filter(i => i.userStatus === "assistindo").sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    // Usar a cor e background do amigo
    const fAccent = friendData.profile?.accent || "#dc2626";
    const fBgColor = friendData.profile?.bg_color || (darkMode ? "#0d1117" : "#f5f0e8");
    const fBgImage = isMobileDevice ? (friendData.profile?.bg_image_mobile || friendData.profile?.bg_image || "") : (friendData.profile?.bg_image || "");
    const fDark = isColorDark(fBgColor);

    const FriendCard = ({ item, size = 90 }) => {
      const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
      return (
        <div style={{ flexShrink: 0, width: size }}>
          <div style={{ width: size, height: Math.round(size * 1.45), borderRadius: 10, overflow: "hidden", background: gradientFor(item.id), position: "relative", border: `1px solid ${fAccent}22` }}>
            {coverSrc ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}><TypeIcon id={item.type} /></div>}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "16px 6px 6px" }}>
              <p style={{ fontSize: 10, color: "white", fontWeight: 700, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
            </div>
            {item.userRating > 0 && (
              <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.85)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>★ {item.userRating}</div>
            )}
            {item.lastChapter && item.userStatus === "assistindo" && (
              <div style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.85)", borderRadius: 4, padding: "1px 4px", fontSize: 9, color: accent, fontWeight: 700, maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.lastChapter.replace(/chapter /i,'Ch.').replace(/vol\.\d+\s*/i,'')}
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div style={{ position: "relative", minHeight: "100vh", maxWidth: isMobileDevice ? 600 : "100%", margin: "0 auto", paddingBottom: 20,
        background: fBgImage ? "transparent" : fBgColor,
        color: fDark ? "#e6edf3" : "#0d1117",
      }}>
        {/* Background do amigo */}
        {fBgImage && (
          <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url(${fBgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
            <div style={{ position: "absolute", inset: 0, background: `${fBgColor}cc`, backdropFilter: "blur(2px)" }} />
          </div>
        )}
        <div style={{ position: "relative", zIndex: 1 }}>

        {/* Banner + Avatar — Voltar sobreposto */}
        <div style={{ position: "relative", marginBottom: 56 }}>
          <div style={{
            height: 220, position: "relative", overflow: "hidden",
            background: friendData.profile?.banner
              ? `url(${friendData.profile.banner}) center/cover no-repeat`
              : fBgImage ? "transparent" : fBgColor,
          }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(0,0,0,0.4) 100%)" }} />
            {!friendData.profile?.banner && (
              <>
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} xmlns="http://www.w3.org/2000/svg">
                  <defs><pattern id="fhex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
                    <polygon points="28,4 52,16 52,32 28,44 4,32 4,16" fill="none" stroke={fAccent} strokeWidth="1"/>
                  </pattern></defs>
                  <rect width="100%" height="100%" fill="url(#fhex)"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 40% 50%, ${fAccent}28 0%, transparent 60%)` }} />
              </>
            )}
            {/* Botão Voltar sobreposto no banner */}
            <button onClick={() => { setSelectedFriend(null); setFriendData(null); }} style={{
              position: "absolute", top: 14, left: 14, zIndex: 10,
              background: "rgba(0,0,0,0.45)", 
              border: `1px solid rgba(255,255,255,0.2)`, color: "white",
              cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "6px 14px",
              borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
            }}>{useT("back")}</button>
          </div>
          <div style={{ position: "absolute", bottom: -44, left: "50%", transform: "translateX(-50%)" }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", border: `3px solid ${fBgColor}`, boxShadow: `0 0 0 3px ${fAccent}, 0 8px 24px rgba(0,0,0,0.5)`, background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
              {friendData.profile?.avatar ? <img src={friendData.profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
            </div>
          </div>
        </div>

        {/* Nome + bio */}
        <div style={{ textAlign: "center", padding: "0 16px 20px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, backgroundImage: `linear-gradient(90deg, ${fAccent}, ${fDark ? "#e6edf3" : "#0d1117"})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{friendData.profile?.name || selectedFriend.name || "Utilizador"}</h2>
          {friendData.profile?.username && <p style={{ color: fDark ? "#8b949e" : "#64748b", fontSize: 13, marginTop: 2 }}>@{friendData.profile.username}</p>}
          {friendData.profile?.bio && <p style={{ color: fDark ? "#8b949e" : "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{friendData.profile.bio}</p>}
        </div>

        {/* Layout PC: 2 colunas | Mobile: 1 coluna */}
        <div style={ !isMobileDevice ? { display: "flex", gap: 20, padding: "0 24px", alignItems: "flex-start", overflow: "hidden" } : {}}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `1px solid ${fDark ? "#21262d" : "#e2e8f0"}`, marginBottom: 0 }}>
          {["perfil","completos","diario"].map(tab => (
            <button key={tab} onClick={() => setFriendTab(tab)} style={{
              flex: 1, padding: isMobileDevice ? "10px 4px" : "12px 20px",
              background: "none", border: "none",
              borderBottom: friendTab === tab ? `2px solid ${fAccent}` : "2px solid transparent",
              color: friendTab === tab ? fAccent : "#484f58",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: isMobileDevice ? 11 : 13,
              fontWeight: friendTab === tab ? 700 : 500,
              marginBottom: -1, whiteSpace: "nowrap",
            }}>
              {tab === "perfil" ? useT("tabPerfil") : tab === "completos" ? useT("tabCompletos") : useT("tabDiario")}
            </button>
          ))}
        </div>

        {/* ── TAB: PERFIL ── */}
        <div style={{ display: friendTab === "perfil" ? "block" : "none" }}>

        {/* Stats */}
        <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
            {STATUS_OPTIONS.slice(0,3).map(s => (
              <div key={s.id} style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${s.color}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{statusLabel(s, lang)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {STATUS_OPTIONS.slice(3).map(s => (
              <div key={s.id} style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${s.color}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{byStatus[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{statusLabel(s, lang)}</div>
              </div>
            ))}
            <div style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid #f59e0b33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>{avgRating}</div>
              <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>★ Média</div>
            </div>
            <div style={{ background: fDark ? "rgba(22,27,34,0.8)" : "rgba(255,255,255,0.7)", border: `1px solid ${fAccent}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: fAccent }}>{libItems.length}</div>
              <div style={{ fontSize: 10, color: fDark ? "#8b949e" : "#64748b", marginTop: 2 }}>{useT("totalItems")}</div>
            </div>
          </div>
        </div>

        {/* Em comum */}
        {(() => {
          const myLib = Object.values(library || {});
          const emComum = libItems.filter(fi => myLib.some(mi => mi.id === fi.id && mi.userStatus === "completo" && fi.userStatus === "completo"));
          if (!emComum.length) return null;
          return (
            <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: fAccent, letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("inCommon").toUpperCase()}</h3>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${fAccent}55, transparent)` }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: fAccent, background: `${fAccent}18`, padding: "1px 7px", borderRadius: 20 }}>{emComum.length}</span>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                {emComum.slice(0, 12).map(item => {
                  const myItem = myLib.find(mi => mi.id === item.id);
                  const coverSrc = item.customCover || item.cover || item.thumbnailUrl;
                  return (
                    <div key={item.id} style={{ flexShrink: 0, width: 72 }}>
                      <div style={{ width: 72, height: 104, borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), position: "relative", border: `1px solid ${fAccent}22` }}>
                        {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        {myItem?.userRating > 0 && item.userRating > 0 && myItem.userRating !== item.userRating && (
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.85)", padding: "3px 4px", display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                            <span style={{ color: accent }}>★{myItem.userRating}</span>
                            <span style={{ color: fAccent }}>★{item.userRating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Favoritos */}
        {favs.length > 0 && (() => {
          const favByType = {};
          favs.forEach(f => { if (!favByType[f.type]) favByType[f.type] = []; favByType[f.type].push(f); });
          const activeTypes = MEDIA_TYPES.slice(1).filter(t => favByType[t.id]?.length > 0);
          return (
            <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("favorites").toUpperCase()}</h3>
                <span style={{ fontSize: 10, fontWeight: 800, color: fAccent, background: `${fAccent}18`, padding: "1px 7px", borderRadius: 20 }}>{favs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activeTypes.map(t => {
                  const tc = TYPE_COLORS[t.id] || fAccent;
                  return (
                    <div key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, textTransform: "uppercase", letterSpacing: "0.1em" }}>{mediaLabel(t, lang)}</span>
                        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${tc}55, transparent)` }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: tc, background: `${tc}18`, padding: "1px 7px", borderRadius: 20 }}>{favByType[t.id].length}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 120px))", gap: 8, maxWidth: 520, margin: "0 auto" }}>
                        {favByType[t.id].map(item => {
                          const coverSrc = item.customCover || item.cover;
                          return (
                            <div key={item.id} style={{ position: "relative" }}>
                              <div style={{ aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: gradientFor(item.id), border: `2px solid ${tc}33`, boxShadow: "0 2px 8px rgba(0,0,0,0.35)", position: "relative" }}>
                                {coverSrc ? <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />
                                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}><TypeIcon id={t.id} /></div>}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "16px 6px 6px" }}>
                                  <p style={{ fontSize: 10, color: "white", fontWeight: 700, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
                                </div>
                                {item.userRating > 0 && <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.85)", borderRadius: 5, padding: "2px 5px", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>★ {item.userRating}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Completados */}
        {completados.length > 0 && (
          <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("completedLabel").toUpperCase()}</h3>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {completados.slice(0, 15).map(item => <FriendCard key={item.id} item={item} size={110} />)}
            </div>
          </div>
        )}

        {/* Em Curso */}
        {inCurso.length > 0 && (
          <div style={{ padding: isMobileDevice ? "0 16px" : 0, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("inProgressLabel").toUpperCase()}</h3>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {inCurso.slice(0, 15).map(item => <FriendCard key={item.id} item={item} size={90} />)}
            </div>
          </div>
        )}

        </div>
        {/* Coluna direita — diário com mês atual + ver mais (só no PC na tab perfil) */}
        {!isMobileDevice && friendTab === "perfil" && (() => {
          const fCompletados = libItems.filter(i => i.userStatus === "completo" && i.addedAt).sort((a,b) => b.addedAt - a.addedAt);
          if (!fCompletados.length) return null;
          const now = new Date();
          const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2,"0")}`;
          const groups = {};
          fCompletados.forEach(item => {
            const d = new Date(item.addedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
            if (!groups[key]) groups[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [] };
            groups[key].items.push({ ...item, _day: d.getDate() });
          });
          const sortedGroups = Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
          // Mostrar mês atual + mês anterior se existir; resto com "Ver mais"
          const visibleGroups = showAllDiary ? sortedGroups : sortedGroups.slice(0, 2);
          return (
            <div style={{ width: 240, flexShrink: 0, borderLeft: `1px solid ${fDark ? "#21262d" : "#e2e8f0"}`, paddingLeft: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", letterSpacing: "0.12em", textTransform: "uppercase" }}>{useT("diary").toUpperCase()}</h3>
                <span style={{ fontSize: 11, color: "#484f58" }}>{fCompletados.length}</span>
              </div>
              {visibleGroups.map(group => (
                <div key={group.key} style={{ display: "flex", marginBottom: 16 }}>
                  <div style={{ flexShrink: 0, width: 46, marginRight: 10 }}>
                    <div style={{ background: "#21262d", borderRadius: 8, overflow: "hidden", textAlign: "center", border: "1px solid #30363d" }}>
                      <div style={{ background: "#30363d", padding: "3px 0", fontSize: 9, fontWeight: 800, color: "#e6edf3", letterSpacing: 1 }}>{group.year}</div>
                      <div style={{ padding: "3px 0 4px", fontSize: 14, fontWeight: 900, color: "#8b949e" }}>{(lang === "en" ? MONTH_EN : MONTH_PT)[group.month]}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {[...group.items].sort((a,b) => b._day - a._day).map((item, idx, arr) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: idx < arr.length-1 ? `1px solid ${fDark ? "#21262d" : "#e2e8f0"}` : "none" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#484f58", width: 12, textAlign: "right", flexShrink: 0 }}>{item._day}</span>
                        {(item.cover || item.thumbnailUrl) ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 20, height: 28, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} onError={e => e.currentTarget.style.display="none"} /> : <div style={{ width: 20, height: 28, borderRadius: 3, background: gradientFor(item.id), flexShrink: 0 }} />}
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: fDark ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                        {item.userRating > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, flexShrink: 0 }}>★{item.userRating}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {sortedGroups.length > 2 && (
                <button onClick={() => setShowAllDiary(v => !v)} style={{ width: "100%", background: "none", border: `1px solid ${fAccent}44`, borderRadius: 8, color: fAccent, fontSize: 11, fontWeight: 700, padding: "6px 0", cursor: "pointer", fontFamily: "inherit" }}>
                  {showAllDiary ? "↑ Menos" : `Ver tudo (${fCompletados.length} entradas)`}
                </button>
              )}
            </div>
          );
        })()}
        </div>{/* fim layout PC */}
        </div> {/* fim tab perfil */}

        {/* Tab Completos do amigo */}
        {friendTab === "completos" && (
          <ProfileTabCompletos
            items={libItems} library={friendData.library} accent={fAccent}
            darkMode={fDark} isMobileDevice={isMobileDevice} lang={lang}
            onOpen={null}
          />
        )}

        {/* Tab Diário do amigo */}
        {friendTab === "diario" && (
          <ProfileTabDiario
            items={libItems} accent={fAccent}
            darkMode={fDark} isMobileDevice={isMobileDevice} lang={lang}
            onOpen={null}
          />
        )}

        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: isMobileDevice ? 600 : 860, margin: "0 auto", padding: isMobileDevice ? "16px 0 20px" : "24px 28px 20px", minHeight: "100vh" }}>
      {notif && <div style={{ margin: "0 16px 12px", padding: "10px 14px", background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 10, fontSize: 13, color: accent, textAlign: "center" }}>{notif}</div>}

      {/* Tabs */}
      <div className="tabs-scroll" style={{ display: "flex", gap: 8, padding: "0 16px", marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { id: "feed", label: "🕐 Feed" },
          { id: "friends", label: `${lang === "en" ? "Friends" : "Amigos"} (${accepted.length})` },
          { id: "search", label: useT("searchFriends") },
          { id: "requests", label: `${lang === "en" ? "Requests" : "Pedidos"}${pending.length > 0 ? ` (${pending.length})` : ""}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0,
            padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: tab === t.id ? accent : "#21262d",
            color: tab === t.id ? "white" : "#8b949e",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Feed de Atividade ── */}
      {tab === "feed" && <FeedTab accepted={accepted} getFriendInfo={getFriendInfo} />}

      {/* Friends list */}
      {tab === "friends" && (
        <div style={{ padding: "0 16px" }}>
          {loading ? <p style={{ color: "#484f58", textAlign: "center" }}>{useT("loading")}</p>
          : accepted.length === 0 ? <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>{lang === "en" ? "No friends yet. Search by name or username!" : "Ainda não tens amigos. Pesquisa pelo nome ou username!"}</p>
          : accepted.map(f => {
            const info = getFriendInfo(f);
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: darkMode ? "#161b22" : "rgba(255,255,255,0.7)", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}
                onClick={() => openFriendProfile(info.id, info)}
                onMouseEnter={e => e.currentTarget.style.borderColor = accent + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = darkMode ? "#21262d" : "#e2e8f0"}>
                {/* Avatar */}
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${accent}44, ${accent}22)`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: `2px solid ${accent}33` }}>
                  {info?.avatar ? <img src={info.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: darkMode ? "#e6edf3" : "#0d1117" }}>{info?.name || "Utilizador"}</p>
                  {info?.username && <p style={{ fontSize: 11, color: "#484f58", marginTop: 1 }}>@{info.username}</p>}
                </div>
                <span style={{ color: accent, fontSize: 16, opacity: 0.6 }}>→</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      {tab === "search" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Pesquisar por nome ou username..."
              style={{ flex: 1, padding: "10px 14px", background: "#161b22", border: "1px solid #30363d", borderRadius: 10, color: "#e6edf3", fontFamily: "inherit", fontSize: 14 }} />
            <button onClick={handleSearch} style={{ padding: "10px 16px", background: accent, border: "none", borderRadius: 10, color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              {searching ? "..." : "🔍"}
            </button>
          </div>
          {searchResults.map(r => {
            const fs = friendshipStatus(r.id);
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {r.avatar ? <img src={r.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{r.name || "Utilizador"}</p>
                  {r.username && <p style={{ fontSize: 12, color: "#484f58" }}>@{r.username}</p>}
                </div>
                {!fs ? (
                  <button onClick={() => handleSendRequest(r.id)} style={{ padding: "6px 12px", background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 8, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>+ Adicionar</button>
                ) : fs.status === "accepted" ? (
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>✓ {lang === "en" ? "Friends" : "Amigos"}</span>
                ) : fs.isRequester ? (
                  <span style={{ fontSize: 12, color: "#484f58" }}>{lang === "en" ? "Pending" : "Pendente"}</span>
                ) : (
                  <button onClick={() => handleAccept(fs.id)} style={{ padding: "6px 12px", background: "#10b98122", border: "1px solid #10b98144", borderRadius: 8, color: "#10b981", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>{lang === "en" ? "Accept" : "Aceitar"}</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Requests */}
      {tab === "requests" && (
        <div style={{ padding: "0 16px" }}>
          {pending.length === 0 && sent.length === 0 && <p style={{ color: "#484f58", textAlign: "center", padding: 20 }}>{lang === "en" ? "No pending requests." : "Sem pedidos pendentes."}</p>}
          {pending.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8 }}>{lang === "en" ? "INCOMING REQUESTS" : "PEDIDOS RECEBIDOS"}</p>
              {pending.map(f => {
                const info = f.requester;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{info?.name || "Utilizador"}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleAccept(f.id)} style={{ padding: "6px 10px", background: "#10b98122", border: "1px solid #10b98144", borderRadius: 8, color: "#10b981", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>✓</button>
                      <button onClick={() => handleDecline(f.id)} style={{ padding: "6px 10px", background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {sent.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "#8b949e", fontWeight: 700, marginBottom: 8, marginTop: 16 }}>{lang === "en" ? "SENT REQUESTS" : "PEDIDOS ENVIADOS"}</p>
              {sent.map(f => {
                const info = f.addressee;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{info?.name || "Utilizador"}</p>
                    </div>
                    <span style={{ fontSize: 12, color: "#484f58" }}>{lang === "en" ? "Waiting..." : "Aguarda..."}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
