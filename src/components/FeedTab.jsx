import { useState, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { supa } from "../config/supabase";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { findLibraryEntry } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { TypeIcon } from "./TypeIcon";
import { CoverImg } from "./CoverImg";
import { FriendAvatar } from "./FriendAvatar";
import { Skeleton, SkeletonStyles } from "./Skeleton";

// Cópia em memória: ao voltar ao separador o feed aparece logo e atualiza por baixo (máx. 90 s)
let feedCache = { key: "", ts: 0, items: [] };

const DAY = 86400000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function FeedTab({ accepted, getFriendInfo, library, onOpenFriend, onOpenItem, onGoSearch }) {
  const { accent, darkMode, isMobileDevice, panelBg } = useTheme();
  const { lang } = useLang();
  const en = lang === "en";

  const friendIds = useMemo(() => accepted.map(f => getFriendInfo(f)?.id).filter(Boolean), [accepted]);
  const key = friendIds.slice().sort().join(",");
  const [items, setItems] = useState(feedCache.key === key ? feedCache.items : []);
  const [loading, setLoading] = useState(!(feedCache.key === key && feedCache.items.length));
  const [error, setError] = useState(false);
  const [statusF, setStatusF] = useState("all");
  const [typeF, setTypeF] = useState("all");

  const load = useCallback(async (force = false) => {
    if (!friendIds.length) { setItems([]); setLoading(false); return; }
    if (!force && feedCache.key === key && Date.now() - feedCache.ts < 90000) { setItems(feedCache.items); setLoading(false); return; }
    if (!(feedCache.key === key && feedCache.items.length)) setLoading(true);
    setError(false);
    try {
      const list = await supa.getFriendsActivity(friendIds);
      feedCache = { key, ts: Date.now(), items: list };
      setItems(list);
    } catch (e) { console.error("[TrackAll] feed:", e?.message || e); setError(true); }
    setLoading(false);
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const infoById = useMemo(() => {
    const m = {};
    accepted.forEach(f => { const i = getFriendInfo(f); if (i?.id) m[i.id] = i; });
    return m;
  }, [accepted]);

  const typesPresent = useMemo(() => MEDIA_TYPES.slice(1).filter(t => items.some(i => i.type === t.id)), [items]);
  const filtered = useMemo(() => items.filter(i => (statusF === "all" || i.userStatus === statusF) && (typeF === "all" || i.type === typeF)), [items, statusF, typeF]);

  // Agrupa por dia e, dentro do dia, por amigo (vários títulos seguidos do mesmo amigo → um só cartão)
  const sections = useMemo(() => {
    const today = startOfDay(Date.now());
    const label = (t) => {
      const d = startOfDay(t);
      if (d >= today) return en ? "Today" : "Hoje";
      if (d >= today - DAY) return en ? "Yesterday" : "Ontem";
      if (d >= today - 6 * DAY) return en ? "This week" : "Esta semana";
      if (d >= today - 29 * DAY) return en ? "This month" : "Este mês";
      return en ? "Earlier" : "Mais antigo";
    };
    const secs = [];
    filtered.forEach(it => {
      const lab = label(it.addedAt);
      let sec = secs[secs.length - 1];
      if (!sec || sec.label !== lab) { sec = { label: lab, groups: [] }; secs.push(sec); }
      const day = startOfDay(it.addedAt);
      const last = sec.groups[sec.groups.length - 1];
      if (last && last.userId === it.userId && last.day === day && last.status === it.userStatus) last.items.push(it);
      else sec.groups.push({ userId: it.userId, day, status: it.userStatus, items: [it] });
    });
    return secs;
  }, [filtered, en]);

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return en ? "now" : "agora";
    if (m < 60) return en ? `${m}m ago` : `há ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return en ? `${h}h ago` : `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return en ? `${d}d ago` : `há ${d} d`;
    return en ? `${Math.floor(d / 30)}mo ago` : `há ${Math.floor(d / 30)} mes`;
  };

  const text = darkMode ? "#e6edf3" : "#0f172a";
  const muted = darkMode ? "#8b949e" : "#64748b";
  const glass = darkMode ? "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)), rgba(12,14,18,0.6)" : "rgba(255,255,255,0.85)";
  const card = { background: panelBg || glass, borderRadius: 16, border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };

  const empty = (title, sub, cta) => (
    <div style={{ ...card, margin: "0 16px", padding: "44px 20px", textAlign: "center" }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 12 }}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2" /><path d="M17 5.4a3.2 3.2 0 0 1 0 6M18.5 14.8c1.6.6 2.7 2.2 3 4.6" /></svg>
      <p style={{ fontSize: 15, fontWeight: 800, color: text, marginBottom: 6 }}>{title}</p>
      {sub && <p style={{ fontSize: 13, color: muted, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>{sub}</p>}
      {cta}
    </div>
  );
  const ctaBtn = (label, onClick) => (
    <button onClick={onClick} style={{ marginTop: 16, padding: "9px 18px", borderRadius: 11, border: `1px solid ${accent}66`, background: `${accent}22`, color: accent, fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{label}</button>
  );

  if (accepted.length === 0) return empty(en ? "No friends yet" : "Ainda não tens amigos", en ? "Add friends to see what they complete and watch." : "Adiciona amigos para veres o que andam a completar e a ver.", onGoSearch && ctaBtn(en ? "Find friends" : "Procurar amigos", onGoSearch));

  const chip = (active, onClick, children) => (
    <button onClick={onClick} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      border: `1px solid ${active ? accent : (darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)")}`, background: active ? `${accent}26` : "transparent", color: active ? accent : muted }}>{children}</button>
  );

  const Rating = ({ v }) => v > 0 ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: "#fbbf24" }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24" aria-hidden="true"><path d="M12 3.2l2.5 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.8 19.6l1.2-6L3.5 9.5l6-.7z" /></svg>{v}
    </span>
  ) : null;

  const verb = (status, count) => status === "completo"
    ? (en ? "completed" : "completou")
    : (en ? "is following" : "está a seguir");

  const mine = (it) => findLibraryEntry(library || {}, it.id, it.type)?.item;

  const cover = (it, w, h, radius = 10) => {
    const src = it.customCover || it.cover || it.thumbnailUrl;
    return (
      <div className="recent-card" style={{ width: w, height: h, flexShrink: 0 }}>
        <div onClick={() => onOpenItem && onOpenItem(it)} title={it.title} style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", background: gradientFor(it.id), cursor: onOpenItem ? "pointer" : "default", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)"}` }}>
          {src ? <CoverImg src={src} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" }}><TypeIcon id={it.type} /></div>}
          <div className="recent-hover-overlay no-tc" style={{ position: "absolute", inset: 0, opacity: 0, transition: "opacity 0.18s ease", display: "flex", alignItems: "flex-end", padding: "0 7px 7px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 50%, transparent 80%)", pointerEvents: "none" }}>
            <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{it.title}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (g) => {
    const info = infoById[g.userId] || {};
    const name = info.name || info.username || (en ? "User" : "Utilizador");
    const first = g.items[0];
    const ring = info.accent || `${accent}66`;
    const header = (
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button onClick={() => onOpenFriend && onOpenFriend(g.userId, info)} aria-label={name} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
          <FriendAvatar src={info.avatar} name={name} size={36} ring={ring} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.35, color: muted }}>
          <button onClick={() => onOpenFriend && onOpenFriend(g.userId, info)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: text }}>{name}</button>
          {" "}{verb(g.status, g.items.length)}{g.items.length > 1 ? ` ${g.items.length} ${en ? "titles" : "títulos"}` : ""}
        </div>
        <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>{timeAgo(first.addedAt)}</span>
      </div>
    );

    if (g.items.length === 1) {
      const m = mine(first);
      const mt = MEDIA_TYPES.find(t => t.id === first.type);
      return (
        <div style={{ ...card, padding: 14 }}>
          {header}
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            {cover(first, 64, 96)}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
              <div onClick={() => onOpenItem && onOpenItem(first)} style={{ fontSize: 15, fontWeight: 800, color: text, lineHeight: 1.25, cursor: onOpenItem ? "pointer" : "default", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{first.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {mt && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: muted }}><TypeIcon id={mt.id} />{mediaLabel(mt, lang)}</span>}
                <Rating v={first.userRating} />
              </div>
              {m && (
                <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, color: accent, background: `${accent}1c`, border: `1px solid ${accent}40`, borderRadius: 8, padding: "2px 8px" }}>
                  {m.userStatus === "completo" ? (en ? "You completed it too" : "Também completaste") : (en ? "In your library" : "Na tua biblioteca")}{m.userRating > 0 ? ` · ★ ${m.userRating}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    const shown = g.items.slice(0, isMobileDevice ? 4 : 6);
    return (
      <div style={{ ...card, padding: 14 }}>
        {header}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobileDevice ? 4 : 6}, minmax(0, 1fr))`, gap: 8, marginTop: 12 }}>
          {shown.map((it, i) => (
            <div key={it.id} style={{ minWidth: 0 }}>
              <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 10, overflow: "hidden" }}>
                {cover(it, "100%", "100%")}
                {it.userRating > 0 && <div style={{ position: "absolute", left: 4, bottom: 4, padding: "1px 6px", borderRadius: 7, background: "rgba(0,0,0,0.72)", pointerEvents: "none" }}><Rating v={it.userRating} /></div>}
                {i === shown.length - 1 && g.items.length > shown.length && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, pointerEvents: "none" }}>+{g.items.length - shown.length + 1}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <SkeletonStyles />
      {/* Filtros */}
      <div className="hscroll" style={{ padding: "0 16px", marginBottom: 14, alignItems: "center" }}>
        {chip(statusF === "all", () => setStatusF("all"), en ? "All" : "Tudo")}
        {chip(statusF === "completo", () => setStatusF("completo"), en ? "Completed" : "Completos")}
        {chip(statusF === "assistindo", () => setStatusF("assistindo"), en ? "In progress" : "A seguir")}
        {typesPresent.length > 1 && <span aria-hidden="true" style={{ width: 1, height: 18, background: darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)", flexShrink: 0 }} />}
        {typesPresent.length > 1 && typesPresent.map(t => <span key={t.id} style={{ display: "contents" }}>{chip(typeF === t.id, () => setTypeF(typeF === t.id ? "all" : t.id), <><TypeIcon id={t.id} />{mediaLabel(t, lang)}</>)}</span>)}
        <button onClick={() => load(true)} disabled={loading} aria-label={en ? "Refresh" : "Atualizar"} title={en ? "Refresh" : "Atualizar"} style={{ marginLeft: "auto", flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)"}`, background: "transparent", color: muted, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }} aria-busy="true">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ ...card, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Skeleton width={36} height={36} radius={999} light={!darkMode} /><Skeleton width="55%" height={12} radius={6} light={!darkMode} /></div>
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}><Skeleton width={64} height={96} radius={10} light={!darkMode} /><div style={{ flex: 1 }}><Skeleton width="75%" height={14} radius={6} light={!darkMode} style={{ marginBottom: 10 }} /><Skeleton width="40%" height={11} radius={6} light={!darkMode} /></div></div>
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        empty(en ? "Couldn't load the feed" : "Não foi possível carregar o feed", en ? "Check your connection and try again." : "Verifica a ligação e tenta outra vez.", ctaBtn(en ? "Try again" : "Tentar de novo", () => load(true)))
      ) : filtered.length === 0 ? (
        empty(items.length ? (en ? "Nothing matches these filters" : "Nada com estes filtros") : (en ? "No recent activity yet" : "Ainda sem atividade recente"), items.length ? null : (en ? "When your friends complete or start something, it shows up here." : "Quando os teus amigos completarem ou começarem algo, aparece aqui."))
      ) : (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 22 }}>
          {sections.map(sec => (
            <section key={sec.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, margin: 0 }}>{sec.label}</h3>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)"}, transparent)` }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sec.groups.map((g, i) => <div key={`${g.userId}-${g.day}-${g.status}-${i}`}>{renderGroup(g)}</div>)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
