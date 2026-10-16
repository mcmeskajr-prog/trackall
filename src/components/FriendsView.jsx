import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa } from "../config/supabase";
import { FeedTab } from "./FeedTab";
import { FriendProfile } from "./FriendProfile";
import { FriendAvatar } from "./FriendAvatar";
import { Skeleton, SkeletonStyles } from "./Skeleton";

// Ao abrir um título de um amigo, tirar os dados PESSOAIS dele (estado, nota, data…) para o modal não os mostrar como se fossem teus
const stripPersonal = (it) => {
  const { userStatus, userRating, addedAt, userNote, note, notes, lastChapter, chaptersRead, totalChapters, ...rest } = it || {};
  return rest;
};

const Icon = ({ name, size = 16 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "search") return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
  if (name === "check") return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (name === "x") return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
  if (name === "plus") return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "chevron") return <svg {...p}><path d="M9 5l7 7-7 7" /></svg>;
  return null;
};

// user, accent, darkMode, isMobileDevice, library vêm do App; o resto vem do tema.
export function FriendsView({ user, library = {}, onOpenItem }) {
  const { accent, darkMode, isMobileDevice, panelBg } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";

  const [tab, setTab] = useState("feed"); // feed | friends | search | requests
  const [friendships, setFriendships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null); // { id, info }
  const [friendData, setFriendData] = useState(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const searchSeq = useRef(0);

  const showToast = (msg, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const loadFriendships = useCallback(async () => {
    try {
      const data = await supa.getFriendships(user.id);
      setFriendships(data);
      setLoadError(false);
    } catch (e) { console.error("[TrackAll] amigos:", e?.message || e); setLoadError(true); }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadFriendships(); }, [loadFriendships]);
  // Ao voltar à app/separador, atualiza pedidos e amigos
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") loadFriendships(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [loadFriendships]);

  const accepted = useMemo(() => friendships.filter(f => f.status === "accepted"), [friendships]);
  const incoming = useMemo(() => friendships.filter(f => f.status === "pending" && f.addressee_id === user.id), [friendships, user.id]);
  const sent = useMemo(() => friendships.filter(f => f.status === "pending" && f.requester_id === user.id), [friendships, user.id]);
  const getFriendInfo = useCallback((f) => (f.requester_id === user.id ? f.addressee : f.requester), [user.id]);

  const statusOf = (targetId) => {
    const f = friendships.find(x => (x.requester_id === user.id && x.addressee_id === targetId) || (x.addressee_id === user.id && x.requester_id === targetId));
    return f ? { status: f.status, isRequester: f.requester_id === user.id, id: f.id } : null;
  };

  // Pesquisa com pequena espera enquanto se escreve (e Enter faz já)
  const runSearch = useCallback(async (q) => {
    const query = q.trim();
    const seq = ++searchSeq.current;
    if (query.length < 2) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    try {
      const res = await supa.searchUsers(query);
      if (seq !== searchSeq.current) return;
      setSearchResults(res.filter(r => r.id !== user.id));
    } catch (e) {
      if (seq !== searchSeq.current) return;
      showToast(en ? "Search failed" : "A pesquisa falhou", false);
      setSearchResults([]);
    }
    if (seq === searchSeq.current) setSearching(false);
  }, [user.id, en]);

  useEffect(() => {
    if (tab !== "search") return;
    const t = setTimeout(() => runSearch(searchQ), 350);
    return () => clearTimeout(t);
  }, [searchQ, tab, runSearch]);

  const act = async (id, fn, okMsg) => {
    setBusyId(id);
    try { await fn(); if (okMsg) showToast(okMsg); }
    catch (e) {
      const dup = /duplicate|unique/i.test(e?.message || "");
      showToast(dup ? (en ? "Request already sent" : "Pedido já enviado") : ((en ? "Error: " : "Erro: ") + (e?.message || "")), false);
    }
    await loadFriendships();
    setBusyId(null);
  };

  const openFriend = async (friendId, info) => {
    setSelected({ id: friendId, info });
    setFriendData(null); setFriendError(false); setFriendLoading(true);
    try { setFriendData(await supa.getFriendData(friendId)); }
    catch (e) { console.error("[TrackAll] perfil do amigo:", e?.message || e); setFriendError(true); }
    setFriendLoading(false);
  };
  const closeFriend = () => { setSelected(null); setFriendData(null); setFriendError(false); };
  const removeFriend = async () => {
    const f = accepted.find(x => getFriendInfo(x)?.id === selected?.id);
    if (!f) return closeFriend();
    await act(f.id, () => supa.removeFriend(user.id, selected.id), en ? "Friend removed" : "Amigo removido");
    closeFriend();
  };
  const openItem = (it) => onOpenItem && onOpenItem(stripPersonal(it));

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)";
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || glass, borderRadius: 16, border: `1px solid ${line}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };
  const wrap = { maxWidth: isMobileDevice ? 600 : 860, margin: "0 auto", padding: isMobileDevice ? "14px 0 28px" : "26px 28px 40px", minHeight: "100vh" };

  const toastEl = toast && (
    <div role="status" aria-live="polite" style={{ position: "fixed", zIndex: 9999, left: isMobileDevice ? 12 : "auto", right: isMobileDevice ? 12 : 20, top: isMobileDevice ? "auto" : 20, bottom: isMobileDevice ? "calc(88px + env(safe-area-inset-bottom, 0px))" : "auto", background: toast.ok ? "#10b981" : "#ef4444", color: "#fff", padding: "11px 18px", borderRadius: 12, fontWeight: 700, fontSize: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
  );

  // ── Perfil de um amigo ──
  if (selected) {
    if (friendLoading || (!friendData && !friendError)) return (
      <div style={wrap}>
        <SkeletonStyles />
        <div style={{ padding: isMobileDevice ? "0 16px" : 0 }} aria-busy="true">
          <Skeleton width={100} height={32} radius={999} light={!darkMode} style={{ marginBottom: 14 }} />
          <div style={{ ...card, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}><Skeleton width={80} height={80} radius={999} light={!darkMode} /><div style={{ flex: 1 }}><Skeleton width="50%" height={20} radius={6} light={!darkMode} style={{ marginBottom: 10 }} /><Skeleton width="30%" height={12} radius={6} light={!darkMode} /></div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>{[0, 1, 2].map(i => <Skeleton key={i} height={isMobileDevice ? 150 : 190} radius={14} light={!darkMode} />)}</div>
        </div>
      </div>
    );
    if (friendError || !friendData) return (
      <div style={wrap}>
        <div style={{ ...card, margin: isMobileDevice ? "0 16px" : 0, padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: text, marginBottom: 6 }}>{en ? "Couldn't load this profile" : "Não foi possível carregar este perfil"}</p>
          <p style={{ fontSize: 13, color: muted, marginBottom: 16 }}>{en ? "Check your connection and try again." : "Verifica a ligação e tenta outra vez."}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => openFriend(selected.id, selected.info)} style={{ padding: "9px 18px", borderRadius: 11, border: `1px solid ${accent}66`, background: `${accent}22`, color: accent, fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{en ? "Try again" : "Tentar de novo"}</button>
            <button onClick={closeFriend} style={{ padding: "9px 18px", borderRadius: 11, border: `1px solid ${line}`, background: "transparent", color: muted, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{en ? "Back" : "Voltar"}</button>
          </div>
        </div>
      </div>
    );
    return (
      <>
        <FriendProfile info={selected.info} data={friendData} library={library} onBack={closeFriend} onRemove={removeFriend} onOpenItem={openItem} />
        {toastEl}
      </>
    );
  }

  // ── Elementos partilhados ──
  const personRow = (p, right, onClick) => (
    <div key={p.id} style={{ minWidth: 0 }}>
      <div onClick={onClick} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
        <FriendAvatar src={p.avatar} name={p.name || p.username} size={46} ring={p.accent && /^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : `${accent}66`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || p.username || (en ? "User" : "Utilizador")}</div>
          {p.username && <div style={{ fontSize: 12, color: muted, marginTop: 1 }}>@{p.username}</div>}
        </div>
        {right}
      </div>
    </div>
  );
  const smallBtn = (label, onClick, { color = accent, icon, disabled } = {}) => (
    <button disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 10, border: `1px solid ${color}55`, background: `${color}1f`, color, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, whiteSpace: "nowrap" }}>{icon && <Icon name={icon} size={14} />}{label}</button>
  );
  const emptyBox = (title, sub) => (
    <div style={{ ...card, padding: "40px 20px", textAlign: "center" }}>
      <p style={{ fontSize: 15, fontWeight: 800, color: text, marginBottom: sub ? 6 : 0 }}>{title}</p>
      {sub && <p style={{ fontSize: 13, color: muted, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>{sub}</p>}
    </div>
  );

  const tabs = [
    { id: "feed", label: "Feed" },
    { id: "friends", label: en ? "Friends" : "Amigos", n: accepted.length },
    { id: "search", label: en ? "Find" : "Procurar" },
    { id: "requests", label: en ? "Requests" : "Pedidos", n: incoming.length, alert: true },
  ];

  const side = isMobileDevice ? 16 : 0;

  return (
    <div style={wrap}>
      <SkeletonStyles />
      {/* Separadores */}
      <div className="hscroll" style={{ padding: `0 ${side}px`, marginBottom: 18, gap: 6, borderBottom: `1px solid ${line}` }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${active ? accent : "transparent"}`, marginBottom: -1, color: active ? accent : muted, fontFamily: "inherit", fontSize: 13.5, fontWeight: active ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {t.label}
              {t.n > 0 && <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, background: t.alert ? accent : `${accent}22`, color: t.alert ? "#fff" : accent }}>{t.n}</span>}
            </button>
          );
        })}
      </div>

      {loadError && !loading && (
        <div style={{ ...card, margin: `0 ${side}px 16px`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderColor: "#ef444455" }}>
          <span style={{ flex: 1, fontSize: 13, color: text }}>{en ? "Couldn't load your friends." : "Não foi possível carregar os teus amigos."}</span>
          {smallBtn(en ? "Retry" : "Tentar", loadFriendships, { color: "#ef4444" })}
        </div>
      )}

      {tab === "feed" && (
        loading ? <div style={{ padding: `0 ${side}px` }}><Skeleton height={88} radius={16} light={!darkMode} style={{ marginBottom: 10 }} /><Skeleton height={88} radius={16} light={!darkMode} /></div>
        : <FeedTab accepted={accepted} getFriendInfo={getFriendInfo} library={library} onOpenFriend={openFriend} onOpenItem={openItem} onGoSearch={() => setTab("search")} />
      )}

      {tab === "friends" && (
        <div style={{ padding: `0 ${side}px`, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? [0, 1, 2].map(i => <Skeleton key={i} height={72} radius={16} light={!darkMode} />)
            : accepted.length === 0 ? <>{emptyBox(en ? "No friends yet" : "Ainda não tens amigos", en ? "Search by name or username to add your first friend." : "Pesquisa pelo nome ou username para adicionares o primeiro.")}<div style={{ textAlign: "center" }}>{smallBtn(en ? "Find friends" : "Procurar amigos", () => setTab("search"), { icon: "search" })}</div></>
            : accepted.map(f => { const info = getFriendInfo(f) || {}; return personRow({ ...info, id: f.id }, <span style={{ color: muted, display: "flex" }}><Icon name="chevron" /></span>, () => openFriend(info.id, info)); })}
        </div>
      )}

      {tab === "search" && (
        <div style={{ padding: `0 ${side}px` }}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: muted, display: "flex" }}><Icon name="search" /></span>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch(searchQ)} autoFocus={!isMobileDevice}
              placeholder={en ? "Search by name or username…" : "Pesquisar por nome ou username…"}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px 12px 40px", borderRadius: 14, border: `1px solid ${line}`, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)", color: text, fontFamily: "inherit", fontSize: 14, outline: "none" }} />
          </div>
          {searching && <Skeleton height={72} radius={16} light={!darkMode} />}
          {!searching && searchResults === null && <p style={{ textAlign: "center", color: muted, fontSize: 13, padding: "24px 0" }}>{en ? "Type at least 2 characters." : "Escreve pelo menos 2 caracteres."}</p>}
          {!searching && searchResults && searchResults.length === 0 && emptyBox(en ? "Nobody found" : "Ninguém encontrado", en ? "Try another name or username." : "Tenta outro nome ou username.")}
          {!searching && searchResults && searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {searchResults.map(r => {
                const fs = statusOf(r.id);
                const right = !fs ? smallBtn(en ? "Add" : "Adicionar", () => act(r.id, () => supa.sendFriendRequest(user.id, r.id), en ? "Request sent" : "Pedido enviado"), { icon: "plus", disabled: busyId === r.id })
                  : fs.status === "accepted" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 800, color: "#10b981" }}><Icon name="check" size={14} />{en ? "Friends" : "Amigos"}</span>
                  : fs.isRequester ? <span style={{ fontSize: 12.5, fontWeight: 700, color: muted }}>{en ? "Pending" : "Pendente"}</span>
                  : smallBtn(en ? "Accept" : "Aceitar", () => act(fs.id, () => supa.acceptFriendRequest(fs.id), en ? "Friend added" : "Amigo adicionado"), { color: "#10b981", icon: "check", disabled: busyId === fs.id });
                return personRow(r, right);
              })}
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div style={{ padding: `0 ${side}px` }}>
          {!loading && incoming.length === 0 && sent.length === 0 && emptyBox(en ? "No pending requests" : "Sem pedidos pendentes")}
          {incoming.length > 0 && (
            <>
              <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, margin: "0 0 10px" }}>{en ? "Received" : "Recebidos"}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                {incoming.map(f => personRow({ ...(f.requester || {}), id: f.id }, (
                  <div style={{ display: "flex", gap: 6 }}>
                    {smallBtn(en ? "Accept" : "Aceitar", () => act(f.id, () => supa.acceptFriendRequest(f.id), en ? "Friend added" : "Amigo adicionado"), { color: "#10b981", icon: "check", disabled: busyId === f.id })}
                    {smallBtn("", () => act(f.id, () => supa.declineFriendRequest(f.id)), { color: "#ef4444", icon: "x", disabled: busyId === f.id })}
                  </div>
                )))}
              </div>
            </>
          )}
          {sent.length > 0 && (
            <>
              <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, margin: "0 0 10px" }}>{en ? "Sent" : "Enviados"}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sent.map(f => personRow({ ...(f.addressee || {}), id: f.id }, smallBtn(en ? "Cancel" : "Cancelar", () => act(f.id, () => supa.declineFriendRequest(f.id), en ? "Request cancelled" : "Pedido cancelado"), { color: muted, disabled: busyId === f.id })))}
              </div>
            </>
          )}
        </div>
      )}
      {toastEl}
    </div>
  );
}
