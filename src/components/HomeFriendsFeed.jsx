import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa, supabase } from "../config/supabase";
import { gradientFor } from "../lib/utils";
import { fetchFriendHighlights, timeAgo } from "../lib/friendHighlights";
import { CoverImg } from "./CoverImg";
import { FriendAvatar } from "./FriendAvatar";
import { TypeIcon } from "./TypeIcon";

// Cópia em memória (voltar à Home não refaz os pedidos durante 2 min)
let cache = { uid: "", ts: 0, rows: [], infoById: {}, hi: { fav: new Set(), hall: new Set() } };

// Ao abrir um título de um amigo, tirar os dados PESSOAIS dele (como no FriendsView)
const stripPersonal = (it) => {
  const { userStatus, userRating, addedAt, userNote, note, notes, lastChapter, chaptersRead, totalChapters, ...rest } = it || {};
  return rest;
};

// Faixa «Amigos acabaram de completar» da Home: capas com nota, quem, quando, e etiquetas ♥ / 🌸
export function HomeFriendsFeed({ user, onOpenItem, onOpenFriend, onSeeAll }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";
  const fresh = cache.uid === user?.id && Date.now() - cache.ts < 120000;
  const [state, setState] = useState(cache.uid === user?.id ? cache : null);

  useEffect(() => {
    if (!user?.id || fresh) return;
    let dead = false;
    // Espera que o arranque acalme: o feed não é o que aparece primeiro
    const t = setTimeout(async () => {
      try {
        const fr = await supa.getFriendships(user.id);
        const accepted = fr.filter(f => f.status === "accepted");
        const infoById = {};
        accepted.forEach(f => { const i = f.requester_id === user.id ? f.addressee : f.requester; if (i?.id) infoById[i.id] = i; });
        const ids = Object.keys(infoById);
        if (!ids.length) { cache = { uid: user.id, ts: Date.now(), rows: [], infoById, hi: { fav: new Set(), hall: new Set() } }; if (!dead) setState(cache); return; }
        const [act, hi] = await Promise.all([supa.getFriendsActivity(ids, 60), fetchFriendHighlights(supabase, ids)]);
        const rows = act.filter(i => i.userStatus === "completo").slice(0, 10);
        cache = { uid: user.id, ts: Date.now(), rows, infoById, hi };
        if (!dead) setState(cache);
      } catch (e) { console.warn("[TrackAll] feed da Home:", e?.message || e); }
    }, 900);
    return () => { dead = true; clearTimeout(t); };
  }, [user?.id, fresh]);

  const rows = state?.rows || [];
  const muted = darkMode ? "#8b949e" : "#64748b";
  const text = darkMode ? "#e6edf3" : "#0f172a";
  const tagOf = useMemo(() => (it) => {
    const k = `${it.userId}|${it.id}`;
    if (state?.hi.hall.has(k)) return { icon: "🌸", label: "Hall of Fame", c: "#f472b6" };
    if (state?.hi.fav.has(k)) return { icon: "♥", label: en ? "Favorite" : "Favorito", c: "#fb7185" };
    return null;
  }, [state, en]);

  if (!rows.length) return null;
  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: muted, whiteSpace: "nowrap" }}>{en ? "Friends just completed" : "Amigos acabaram de completar"}</div>
        <span style={{ flex: 1, height: 1, background: darkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.12)" }} />
        {onSeeAll && <button type="button" onClick={onSeeAll} style={{ background: "none", border: "none", color: accent, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>{en ? "See all →" : "Ver tudo →"}</button>}
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingTop: 18, paddingBottom: 30, paddingLeft: 16, paddingRight: 16, marginLeft: -16, marginRight: -16, marginTop: -18, marginBottom: -30 }}>
        {rows.map(it => {
          const info = state.infoById[it.userId] || {};
          const src = it.customCover || it.cover || it.thumbnailUrl;
          const tag = tagOf(it);
          return (
            <div key={`${it.userId}|${it.id}`} style={{ width: 108, flexShrink: 0 }}>
              <div className="recent-card" style={{ width: 108, height: 162 }}>
                <div onClick={() => onOpenItem && onOpenItem(stripPersonal(it))} role="button" tabIndex={0} title={it.title}
                onKeyDown={e => { if (e.key === "Enter") onOpenItem && onOpenItem(stripPersonal(it)); }}
                style={{ position: "relative", width: 108, height: 162, borderRadius: 3, overflow: "hidden", cursor: "pointer", background: gradientFor(it.id) }}>
                {src ? <CoverImg src={src} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><TypeIcon id={it.type} /></div>}
                {it.userRating > 0 && <div className="no-tc" style={{ position: "absolute", top: 8, right: 8, padding: "2px 7px", borderRadius: 2, background: "rgba(0,0,0,0.7)", color: "#fbbf24", fontSize: 12, fontWeight: 800 }}>★ {it.userRating}</div>}
                <div className="recent-hover-overlay no-tc" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "34px 8px 8px", opacity: 0, transition: "opacity 0.18s ease", background: "linear-gradient(transparent, rgba(0,0,0,0.9))", color: "#fff", fontSize: 11.5, fontWeight: 800, lineHeight: 1.15, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{it.title}</div>
              </div>
              </div>
              <button type="button" onClick={() => onOpenFriend && onOpenFriend(it.userId, info)} title={info.name || info.username || ""}
                style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "2px 0 2px 3px", width: "100%", minWidth: 0, background: "none", border: "none", cursor: onOpenFriend ? "pointer" : "default", fontFamily: "inherit", textAlign: "left", color: "inherit" }}>
                <FriendAvatar src={info.avatar} name={info.name || info.username} size={20} ring={accent} ringWidth={1.5} />
                <span style={{ fontSize: 11.5, fontWeight: 800, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{info.name || info.username || "—"}</span>
                <span style={{ fontSize: 10.5, color: muted, whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgo(it.addedAt, en)}</span>
              </button>
              <div style={{ marginTop: 1, minHeight: 14 }}>
                {tag && <span className="no-tc" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "0 0 0 3px", fontSize: 10, fontWeight: 700, color: tag.c, opacity: 0.8 }}>{tag.icon} {tag.label}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
