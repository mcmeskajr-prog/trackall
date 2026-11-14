import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa, supabase } from "../config/supabase";
import { gradientFor } from "../lib/utils";
import { fetchFriendHighlights, timeAgo } from "../lib/friendHighlights";
import { CoverImg } from "./CoverImg";
import { FriendAvatar } from "./FriendAvatar";
import { TypeIcon } from "./TypeIcon";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";

// Cópia em memória (voltar à Home não refaz os pedidos durante 2 min)
let cache = { uid: "", ts: 0, rows: [], infoById: {}, hi: { fav: new Set(), hall: new Set() } };

// Ao abrir um título de um amigo, tirar os dados PESSOAIS dele (como no FriendsView)
const stripPersonal = (it) => {
  const { userStatus, userRating, addedAt, userNote, note, notes, lastChapter, chaptersRead, totalChapters, ...rest } = it || {};
  return rest;
};

// Faixa «Amigos acabaram de completar» da Home: capas com nota, quem, quando, e etiquetas ♥ / 🌸
export function HomeFriendsFeed({ user, onOpenItem, onOpenFriend, onSeeAll }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang } = useLang();
  const cardW = isMobileDevice ? "clamp(90px, 26vw, 130px)" : 150;
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
      <style>{`.home-rail .card{border-radius:3px !important}.home-rail .media-thumb,.home-rail .media-thumb .rating-hover{border-radius:2px !important}`}</style>
      <div className="recents-row home-rail" style={{ display: "flex", gap: isMobileDevice ? 8 : 14, overflowX: "auto", scrollbarWidth: "none", padding: "18px 16px 30px", margin: "-18px -16px -30px" }}>
        {rows.map(it => {
          const info = state.infoById[it.userId] || {};
          const src = it.customCover || it.cover || it.thumbnailUrl;
          const tag = tagOf(it);
          return (
            <div key={`${it.userId}|${it.id}`} style={{ width: cardW, flexShrink: 0 }}>
              {/* Mesmo cartão dos «Completados»: capa 2:3 + linha de categoria/ano por baixo */}
              <div className="card" role="button" tabIndex={0} title={it.title} onClick={() => onOpenItem && onOpenItem(stripPersonal(it))}
                onKeyDown={e => { if (e.key === "Enter") onOpenItem && onOpenItem(stripPersonal(it)); }} style={{ cursor: "pointer" }}>
                <div className="media-thumb" style={{ width: "100%", aspectRatio: "2/3", background: gradientFor(it.id) }}>
                  {src ? <CoverImg src={src} alt={it.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                    : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><TypeIcon id={it.type} /></div>}
                  <div className="rating-hover no-tc">
                    <div style={{ textAlign: "center", padding: "0 8px", width: "100%" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6, opacity: 0.9 }}>{it.title}</p>
                      {it.userRating > 0 ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><span style={{ fontSize: 16, color: "#f59e0b" }}>★</span><span style={{ fontSize: 18, color: "#f59e0b", fontWeight: 900 }}>{it.userRating}</span></div> : <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>★ {en ? "no rating" : "sem nota"}</span>}
                    </div>
                  </div>
                </div>
                <div className="card-info" style={{ padding: "6px 8px 8px" }}>
                  <p className="card-info-title card-title-text" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{it.title}</p>
                  <p className="card-info-meta" style={{ fontSize: 11, color: "#484f58" }}>{(() => { const t = MEDIA_TYPES.find(x => x.id === it.type); return t ? mediaLabel(t, lang) : ""; })()}{it.year ? ` · ${it.year}` : ""}</p>
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
