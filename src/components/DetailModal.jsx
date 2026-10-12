import { useState, useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { findLibraryEntry, mediaIdCandidates } from "../lib/mediaIds";
import { gradientFor } from "../lib/utils";
import { MEDIA_TYPES, STATUS_OPTIONS, mediaLabel, statusLabel } from "../config/constants";
import { fetchMediaDetails } from "../api/details";
import { fetchAniListSafe } from "../api/anilist";
import { StarRating } from "./StarRating";
import { CoverEditModal } from "./CoverEditModal";

export function DetailModal({ item, library, onAdd, onRemove, onUpdateStatus, onUpdateRating, onChangeCover, onUpdateLastChapter, onClose, favorites = [], onToggleFavorite, hallOfFame = [], onToggleHallOfFame, onUpdateDuration, onUpdateNote, tmdbKey, workerUrl, showNotif = () => {}, setView = () => {}, setLibSearch = () => {} }) {
  const { accent, darkMode, isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const modalScrollRef = useRef(null);
  const detailCacheRef = useRef({}); // cache: id -> {detailExtra, extraData}
  const [itemStack, setItemStack] = useState([item]);
  const currentItem = itemStack[itemStack.length - 1];
  const canGoBack = itemStack.length > 1;
  const pushItem = (newItem) => setItemStack(prev => [...prev, newItem]);
  const popItem = () => setItemStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  const [coverEdit, setCoverEdit] = useState(false);
  const [addRating, setAddRating] = useState(0);
  const [detailExtra, setDetailExtra] = useState(null);
  const [chapterInput, setChapterInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [modalTab, setModalTab] = useState("info");
  const [barExtras, setBarExtras] = useState(false); // nota pessoal / capítulo na barra fixa
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personData, setPersonData] = useState(null);
  const [personLoading, setPersonLoading] = useState(false);
  // Novos estados
  const [omdbData, setOmdbData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [collection, setCollection] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [dlcs, setDlcs] = useState([]);
  const [similarGames, setSimilarGames] = useState([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reset stack when parent changes selectedItem
  useEffect(() => { setItemStack([item]); }, [item?.id]);

  const CHAPTER_TYPES = ["manga", "manhwa", "lightnovels", "comics"];
  const isAniList = (currentItem.id || "").startsWith("al-");
  const isTMDB = (currentItem.id || "").startsWith("tmdb-");
  const isIGDB = (currentItem.id || "").startsWith("igdb-");
  const isFilme = currentItem.type === "filmes";
  const isSerie = currentItem.type === "series";
  const hasCast = isAniList || isTMDB || currentItem?.id?.startsWith("cv-");
  const hasRelations = isAniList;
  const hasMedia = isTMDB || isIGDB || detailExtra?.videos?.length > 0 || detailExtra?.artworks?.length > 0;

  const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");

  useEffect(() => {
    setModalTab("info");
    setSelectedPerson(null);
    setPersonData(null);

    if (modalScrollRef.current) modalScrollRef.current.scrollTop = 0;

    const ci = currentItem;
    if (!ci?.id) return;

    // Usar cache se disponível E tiver dados reais (evita usar cache de erros anteriores)
    // Para jogos IGDB, apagar cache sempre para garantir dados frescos
    if (ci.id.startsWith("igdb-")) delete detailCacheRef.current[ci.id];
    const cached = detailCacheRef.current[ci.id];
    if (cached && (cached.detailExtra?.synopsis || cached.detailExtra?.cast?.length || cached.detailExtra?.episodes || cached.detailExtra?.chapters || cached.detailExtra?.pages)) {
      setDetailExtra(cached.detailExtra ?? {});
      setDetailLoading(false);
      setScreenshots(cached.screenshots || []);
      setCollection(cached.collection || null);
      setRecommendations(cached.recommendations || []);
      setDlcs(cached.dlcs || []);
      setSimilarGames(cached.similarGames || []);
      setOmdbData(cached.omdbData || null);
      setExtraLoading(false);
      const lb = findLibraryEntry(library, ci.id, ci.type)?.item;
      setChapterInput(lb?.lastChapter || "");
      return;
    }

    // Não há cache — limpar e fazer fetch
    setDetailExtra(null);
    setDetailLoading(true);
    setOmdbData(null);
    setScreenshots([]);
    setCollection(null);
    setRecommendations([]);
    setDlcs([]);
    setSimilarGames([]);
    setExtraLoading(false);

    fetchMediaDetails(ci, tmdbKey, workerUrl).then(d => {
      setDetailExtra(d || {});
      setDetailLoading(false);
      // Só guarda no cache se tiver dados reais
      if (d && (d.synopsis || d.cast?.length || d.episodes || d.chapters || d.pages || d.platforms)) {
        detailCacheRef.current[ci.id] = { ...detailCacheRef.current[ci.id], detailExtra: d };
        // Persistir duração — localStorage
        if (d.episodes || d.chapters || d.runtime) {
          try {
            const durData = JSON.stringify({ episodes: d.episodes || null, chapters: d.chapters || null, runtime: d.runtime || null });
            mediaIdCandidates(ci.id, ci.type).forEach(cid => { try { localStorage.setItem("trackall_dur_" + cid, durData); } catch {} });
          } catch {}
          if (onUpdateDuration) try { onUpdateDuration(ci.id, ci.type, { episodes: d.episodes, chapters: d.chapters, runtime: d.runtime }); } catch {}
        }

      }
    }).catch((err) => {
      console.error('[DetailModal] fetchMediaDetails falhou:', ci.id, err);
      setDetailExtra({});
      setDetailLoading(false);
      // Não guarda erro no cache para permitir retry
    });

    fetchExtraData(ci);
    const lb = findLibraryEntry(library, ci?.id, ci?.type)?.item;
    setChapterInput(lb?.lastChapter || "");
    setNoteInput(lb?.userNote || "");
  }, [currentItem?.id]);

  const fetchExtraData = async (capturedItem) => {
    setExtraLoading(true);
    const cid = capturedItem.id || "";
    const cacheEntry = detailCacheRef.current[cid] || {};
    try {
      const id = capturedItem.id || "";

      // ── TMDB filmes ──
      if (id.startsWith("tmdb-filmes-") || id.startsWith("tmdb-movie-")) {
        const tmdbId = id.replace("tmdb-filmes-", "").replace("tmdb-movie-", "");
        const [imagesRes, recoRes, detailRes] = await Promise.allSettled([
          fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/images`).then(r => r.json()),
          fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}/recommendations&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()),
          fetch(`${wUrl}/tmdb?endpoint=/movie/${tmdbId}&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()),
        ]);
        // Screenshots
        if (imagesRes.status === "fulfilled") {
          const imgs = imagesRes.value?.backdrops?.slice(0, 12) || [];
          setScreenshots(imgs.map(i => `https://image.tmdb.org/t/p/w780${i.file_path}`));
        }
        // Recomendações
        if (recoRes.status === "fulfilled") {
          setRecommendations((recoRes.value?.results || []).slice(0, 12).map(m => ({
            id: `tmdb-filmes-${m.id}`, title: m.title || m.name || "",
            cover: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
            type: "filmes", year: (m.release_date || "").slice(0, 4),
          })));
        }
        // Coleção
        if (detailRes.status === "fulfilled" && detailRes.value?.belongs_to_collection) {
          const col = detailRes.value.belongs_to_collection;
          const colRes = await fetch(`${wUrl}/tmdb?endpoint=/collection/${col.id}&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()).catch(() => null);
          if (colRes?.parts) {
            setCollection({
              name: colRes.name,
              parts: colRes.parts.sort((a, b) => (a.release_date || "").localeCompare(b.release_date || "")).map(p => ({
                id: `tmdb-filmes-${p.id}`, title: p.title || "",
                cover: p.poster_path ? `https://image.tmdb.org/t/p/w185${p.poster_path}` : null,
                year: (p.release_date || "").slice(0, 4),
              }))
            });
          }
        }
        // OMDb
        const omdbTitle = capturedItem.title || "";
        const omdbYear = capturedItem.year || "";
        const omdbRes = await fetch(`${wUrl}/omdb?title=${encodeURIComponent(omdbTitle)}${omdbYear ? `&year=${omdbYear}` : ""}`).then(r => r.json()).catch(() => null);
        if (omdbRes?.Response === "True") setOmdbData(omdbRes);
      }

      // ── TMDB séries ──
      else if (id.startsWith("tmdb-series-") || id.startsWith("tmdb-tv-")) {
        const tmdbId = id.replace("tmdb-series-", "").replace("tmdb-tv-", "");
        const [imagesRes, recoRes] = await Promise.allSettled([
          fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/images`).then(r => r.json()),
          fetch(`${wUrl}/tmdb?endpoint=/tv/${tmdbId}/recommendations&language=${lang === "pt" ? "en-US" : "en-US"}`).then(r => r.json()),
        ]);
        if (imagesRes.status === "fulfilled") {
          const imgs = imagesRes.value?.backdrops?.slice(0, 12) || [];
          setScreenshots(imgs.map(i => `https://image.tmdb.org/t/p/w780${i.file_path}`));
        }
        if (recoRes.status === "fulfilled") {
          setRecommendations((recoRes.value?.results || []).slice(0, 12).map(m => ({
            id: `tmdb-series-${m.id}`, title: m.title || m.name || "",
            cover: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
            type: "series", year: (m.first_air_date || "").slice(0, 4),
          })));
        }
        // OMDb
        const omdbRes = await fetch(`${wUrl}/omdb?title=${encodeURIComponent(capturedItem.title || "")}${capturedItem.year ? `&year=${capturedItem.year}` : ""}`).then(r => r.json()).catch(() => null);
        if (omdbRes?.Response === "True") setOmdbData(omdbRes);
      }

      // ── AniList ──
      else if (id.startsWith("al-")) {
        const alId = id.replace(/^al-[a-z]+-/, "").replace(/^al-/, "");
        if (alId && !isNaN(Number(alId))) {
          const recoBody = JSON.stringify({ query: `{ Media(id:${alId}) { recommendations(perPage:12, sort:RATING_DESC) { nodes { rating mediaRecommendation { id title { romaji } coverImage { medium } type format } } } } }` });
          const recoRes = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrl}/anilist`], recoBody).catch(() => null);
          if (recoRes?.data?.Media?.recommendations?.nodes) {
            setRecommendations(
              recoRes.data.Media.recommendations.nodes
                .filter(n => n.rating > 0 && n.mediaRecommendation)
                .map(n => {
                  const m = n.mediaRecommendation;
                  const mType = m.type === "ANIME" ? "anime" : "manga";
                  return { id: `al-${mType}-${m.id}`, title: m.title?.romaji || "", cover: m.coverImage?.medium || null, type: mType };
                })
            );
          }
        }
      }

      // ── IGDB jogos ──
      else if (id.startsWith("igdb-")) {
        const igdbId = id.replace("igdb-", "");
        const [ssRes, simRes, dlcRes] = await Promise.allSettled([
          fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "screenshots", body: `fields image_id; where game = ${igdbId}; limit 12;` }) }).then(r => r.json()),
          fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "games", body: `fields name,cover.image_id,similar_games.name,similar_games.cover.image_id,similar_games.id; where id = ${igdbId}; limit 1;` }) }).then(r => r.json()),
          fetch(`${wUrl}/igdb-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "games", body: `fields name,cover.image_id,category; where parent_game = ${igdbId} & category = (1,2); limit 10;` }) }).then(r => r.json()),
        ]);
        // Screenshots
        if (ssRes.status === "fulfilled" && Array.isArray(ssRes.value)) {
          setScreenshots(ssRes.value.map(s => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`));
        }
        // Jogos similares
        if (simRes.status === "fulfilled" && simRes.value?.[0]?.similar_games) {
          setSimilarGames(simRes.value[0].similar_games.slice(0, 12).map(g => ({
            id: `igdb-${g.id}`, title: g.name || "",
            cover: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
            type: "jogos",
          })));
        }
        // DLCs e expansões
        if (dlcRes.status === "fulfilled" && Array.isArray(dlcRes.value)) {
          setDlcs(dlcRes.value.map(g => ({
            id: `igdb-${g.id}`, title: g.name || "",
            cover: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
            category: g.category === 1 ? "DLC" : "Expansão",
          })));
        }
      }
    } catch (err) {
      console.error("[ExtraData] Erro:", err);
    }
    // Guardar no cache usando setState callbacks para obter valores actuais
    setScreenshots(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), screenshots: prev }; return prev; });
    setRecommendations(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), recommendations: prev }; return prev; });
    setCollection(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), collection: prev }; return prev; });
    setSimilarGames(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), similarGames: prev }; return prev; });
    setDlcs(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), dlcs: prev }; return prev; });
    setOmdbData(prev => { detailCacheRef.current[cid] = { ...(detailCacheRef.current[cid]||{}), omdbData: prev }; return prev; });
    setExtraLoading(false);
  };

  // Fetch perfil da pessoa quando selecionada
  useEffect(() => {
    if (!selectedPerson) return;
    setPersonData(null);
    setPersonLoading(true);
    const wUrl = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
    Promise.all([
      fetch(`${wUrl}/tmdb?endpoint=/person/${selectedPerson.id}&language=en-US`).then(r => r.json()),
      fetch(`${wUrl}/tmdb?endpoint=/person/${selectedPerson.id}/combined_credits&language=en-US`).then(r => r.json()),
    ]).then(([person, credits]) => {
      const filmografia = (credits.cast || [])
        .filter(m => m.poster_path)
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 20)
        .map(m => ({
          id: m.id, title: m.title || m.name || "",
          cover: `https://image.tmdb.org/t/p/w185${m.poster_path}`,
          year: (m.release_date || m.first_air_date || "").slice(0, 4),
          character: m.character || "",
          mediaType: m.media_type,
        }));
      setPersonData({
        name: person.name || selectedPerson.name,
        image: person.profile_path ? `https://image.tmdb.org/t/p/w342${person.profile_path}` : selectedPerson.image,
        bio: person.biography || "",
        birthday: person.birthday || "",
        placeOfBirth: person.place_of_birth || "",
        filmografia,
      });
      setPersonLoading(false);
    }).catch(() => setPersonLoading(false));
  }, [selectedPerson?.id]);

  const matchedLib = findLibraryEntry(library, currentItem.id, currentItem.type);
  const inLib = !!matchedLib;
  const libItem = matchedLib?.item;
  const isChapterType = CHAPTER_TYPES.includes(currentItem.type);
  const coverSrc = libItem?.customCover || currentItem.customCover || currentItem.cover;
  const isFavorite = favorites.some(f => f.id === currentItem.id);
  const canAddFavorite = !isFavorite && favorites.length < 30;
  const isHallOfFame = hallOfFame.some(f => f.id === currentItem.id);
  const canAddHallOfFame = !isHallOfFame && hallOfFame.length < 10;
  const RELATION_LABELS = lang === "en"
    ? { PREQUEL: "Prequel", SEQUEL: "Sequel", SOURCE: "Source", ALTERNATIVE: "Alternative", SIDE_STORY: "Side Story", PARENT: "Parent" }
    : { PREQUEL: "Prequel", SEQUEL: "Sequel", SOURCE: "Fonte", ALTERNATIVE: "Alternativo", SIDE_STORY: "História Paralela", PARENT: "Principal" };

  return (
    <>
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 160 }}>
      <div ref={modalScrollRef} className="modal" style={{ maxWidth: isMobileDevice ? 640 : 880, maxHeight: "90vh", overflowY: "auto", padding: 0, animation: "modalSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }} onClick={(e) => e.stopPropagation()}>

        {/* ── Vista: Perfil da Pessoa (TMDB) ── */}
        {selectedPerson ? (
          <div>
            {/* Header pessoa */}
            <div style={{ position: "relative", height: 120, background: `linear-gradient(135deg, ${accent}33, #0d1117)`, borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
              {canGoBack && <button onClick={popItem} style={{ position: "absolute", top: 12, left: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>←</button>}
              <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div className="modal-bottom-pad" style={{ padding: "0 24px 24px" }}>
              <div style={{ display: "flex", gap: 16, marginTop: -50, position: "relative", zIndex: 2, marginBottom: 20 }}>
                <div style={{ width: 80, height: 110, borderRadius: 10, overflow: "hidden", border: "3px solid #161b22", background: "#21262d", flexShrink: 0, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  {(personData?.image || selectedPerson.image) && <img src={personData?.image || selectedPerson.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                </div>
                <div style={{ paddingTop: 56 }}>
                  <button onClick={() => { setSelectedPerson(null); setPersonData(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: accent, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 6 }}>← Voltar</button>
                  <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{personData?.name || selectedPerson.name}</h2>
                  {personData?.birthday && <p style={{ fontSize: 11, color: "#6e7681", marginTop: 3 }}>🎂 {personData.birthday}{personData.placeOfBirth ? ` · ${personData.placeOfBirth}` : ""}</p>}
                </div>
              </div>

              {personLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                  <div className="spin" style={{ fontSize: 24 }}>⟳</div>
                </div>
              ) : (
                <>
                  {personData?.bio && (
                    <p style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.7, marginBottom: 20 }}>
                      {personData.bio.length > 500 ? personData.bio.slice(0, 500) + "…" : personData.bio}
                    </p>
                  )}
                  {personData?.filmografia?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6e7681", marginBottom: 12, letterSpacing: "0.5px" }}>FILMOGRAFIA</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 10 }}>
                        {personData.filmografia.map(m => (
                          <div key={m.id} style={{ textAlign: "center" }}>
                            <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 6, overflow: "hidden", background: "#21262d", marginBottom: 4 }}>
                              <img src={m.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                            </div>
                            <p style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                            {m.year && <p style={{ fontSize: 9, color: "#6e7681" }}>{m.year}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          // ── Vista: Modal normal ──
          <div>
            {/* Hero backdrop */}
            {(() => {
              const heroBg = detailExtra?.bannerImage || currentItem.backdrop || null;
              const useBanner = !!heroBg;
              const bgStyle = heroBg ? `url(${heroBg}) center/cover` : (coverSrc ? `url(${coverSrc}) center/cover` : gradientFor(currentItem.id));
              return (
              <div style={{ height: isMobileDevice ? (useBanner ? 200 : 180) : 250, background: bgStyle, position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden", transition: "height 0.3s ease" }}>
                <div style={{ position: "absolute", inset: 0, background: useBanner ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(22,27,34,0.97) 100%)" : "linear-gradient(to bottom, transparent 40%, rgba(22,27,34,0.95) 100%)" }} />
              {canGoBack && <button onClick={popItem} style={{ position: "absolute", top: 12, left: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>←</button>}
              <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              );
            })()}

            <div style={{ padding: isMobileDevice ? "0 20px 20px" : "0 32px 28px" }}>
              {/* Header: cover + title */}
              <div style={{ display: "flex", gap: isMobileDevice ? 16 : 28, marginTop: isMobileDevice ? -60 : -110, position: "relative", zIndex: 2 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: isMobileDevice ? 110 : 190, height: isMobileDevice ? 160 : 285, borderRadius: isMobileDevice ? 10 : 16, overflow: "hidden", border: "3px solid " + (darkMode ? "#161b22" : "#ffffff"), background: gradientFor(currentItem.id), boxShadow: "0 14px 40px rgba(0,0,0,0.55)" }}>
                    {coverSrc && <img src={coverSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { const fb = currentItem.coverFallback; if (fb && e.currentTarget.src !== fb) { e.currentTarget.src = fb; } else { e.currentTarget.style.display = "none"; } }} />}
                  </div>
                  {inLib && (
                    <button onClick={() => setCoverEdit(true)} style={{ position: "absolute", bottom: 4, right: 4, width: 26, height: 26, borderRadius: 999, background: `${accent}`, border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }} title={useT("customCover")}>🖊</button>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: isMobileDevice ? 40 : 118 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    <span style={{ background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                      {MEDIA_TYPES.find((t) => t.id === currentItem.type)?.icon} {MEDIA_TYPES.find((t) => t.id === currentItem.type) ? mediaLabel(MEDIA_TYPES.find(t => t.id === currentItem.type), lang) : ""}
                    </span>
                    {currentItem.year && <span style={{ background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{currentItem.year}</span>}
                    {currentItem.score && <span style={{ background: "#1a2e1a", color: "#10b981", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>⭐ {currentItem.score}</span>}
                    {currentItem.source && <span style={{ background: "#1a1f2e", color: "#6e9cf7", padding: "2px 8px", borderRadius: 6, fontSize: 10 }}>{currentItem.source}</span>}
                  </div>
                  <h2
                    onClick={(e) => {
                      if (!isMobileDevice) return;
                      navigator.clipboard?.writeText(currentItem.title).then(() => {
                        const el = e.currentTarget;
                        const orig = el.style.opacity;
                        el.style.opacity = "0.4";
                        setTimeout(() => { el.style.opacity = orig; }, 500);
                        showNotif("✓ " + currentItem.title, "#10b981");
                      }).catch(() => {});
                    }}
                    title={isMobileDevice ? "Toque para copiar" : undefined}
                    style={{ fontSize: isMobileDevice ? 20 : 30, fontWeight: 800, lineHeight: 1.15, marginBottom: 4, cursor: isMobileDevice ? "pointer" : "default" }}>
                    {currentItem.title}
                  </h2>
                  {currentItem.titleEn && currentItem.titleEn !== currentItem.title && <p style={{ color: "#8b949e", fontSize: 13 }}>{currentItem.titleEn}</p>}
                  {currentItem.extra && <p style={{ color: "#8b949e", fontSize: 13 }}>✍ {currentItem.extra}</p>}
                </div>
              </div>

              {/* Tabs */}
              {(hasCast || hasRelations || hasMedia) && (
                <div style={{ display: "flex", marginTop: 20, borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, overflowX: "auto", scrollbarWidth: "none" }}>
                  {["info", ...(hasCast ? ["cast"] : []), ...(hasRelations ? ["relacoes"] : []), ...(hasMedia ? ["media"] : [])].map(tab => (
                    <button key={tab} onClick={() => setModalTab(tab)} style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: `2px solid ${modalTab === tab ? accent : "transparent"}`, color: modalTab === tab ? accent : "#8b949e", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "color 0.15s", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {tab === "info" ? "Info" : tab === "cast" ? (isAniList ? (lang === "en" ? "Characters" : "Personagens") : "Cast") : tab === "relacoes" ? (lang === "en" ? "Relations" : "Relações") : "Media"}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab: Info */}
              {modalTab === "info" && (
                <div>
                  <div style={{ display: "flex", gap: 16, marginTop: 16, padding: "12px 0", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, flexWrap: "wrap" }}>
                    {(detailExtra?.episodes || currentItem.episodes) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.episodes || currentItem.episodes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("episodes")}</div></div>}
                    {detailExtra?.seasons && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra.seasons}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("seasons")}</div></div>}
                    {(detailExtra?.chapters || currentItem.chapters) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.chapters || currentItem.chapters}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("chapters")}</div></div>}
                    {(detailExtra?.volumes || currentItem.volumes) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra?.volumes || currentItem.volumes}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("volumes")}</div></div>}
                    {detailExtra?.runtime && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{detailExtra.runtime}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("runtime")}</div></div>}
                    {(detailExtra?.status || currentItem.status) && <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{detailExtra?.status || currentItem.status}</div><div style={{ fontSize: 11, color: "#8b949e" }}>{useT("status")}</div></div>}
                  </div>

                  {/* OMDb ratings */}
                  {omdbData?.Ratings?.length > 0 && (
                    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                      {omdbData.Ratings.map(r => {
                        const isRT = r.Source === "Rotten Tomatoes";
                        const isMeta = r.Source === "Metacritic";
                        const isIMDb = r.Source === "Internet Movie Database";
                        const color = isRT ? "#fa320a" : isMeta ? "#ffcc33" : "#f5c518";
                        const label = isRT ? "🍅 RT" : isMeta ? "Ⓜ Meta" : "⭐ IMDb";
                        return (
                          <div key={r.Source} style={{ background: darkMode ? "#161b22" : "#f1f5f9", border: `1px solid ${color}44`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color }}>{r.Value}</div>
                            <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600 }}>{label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentItem.genres?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                      {currentItem.genres.slice(0, 6).map((g) => (
                        <button key={g} onClick={() => {
                          onClose();
                          setTimeout(() => {
                            setView("library");
                            setLibSearch(g);
                          }, 150);
                        }} style={{ background: "#1a1f2e", color: "#6e9cf7", padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "none", cursor: "pointer", fontFamily: "inherit" }}>{g}</button>
                      ))}
                    </div>
                  )}
                  {(detailExtra?.synopsis || currentItem.synopsis) && (
                    <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.7, marginTop: 16 }}>{detailExtra?.synopsis || currentItem.synopsis || ""}</p>
                  )}

                  {/* Tempo de jogo IGDB */}


                  {/* Plataformas IGDB */}
                  {detailExtra?.platforms?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                      {detailExtra.platforms.map(p => <span key={p} style={{ background: darkMode ? "#21262d" : "#f1f5f9", color: "#8b949e", padding: "3px 8px", borderRadius: 6, fontSize: 11 }}>{p}</span>)}
                    </div>
                  )}

                  {/* Franchises IGDB */}
                  {detailExtra?.franchises?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <span style={{ fontSize: 11, color: "#8b949e", marginRight: 6 }}>Franchise:</span>
                      {detailExtra.franchises.map(f => <span key={f} style={{ fontSize: 12, color: accent, fontWeight: 700, marginRight: 8 }}>{f}</span>)}
                    </div>
                  )}

                  {/* Developer IGDB */}
                  {detailExtra?.developer && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#8b949e", marginRight: 6 }}>Developer:</span>
                      <span style={{ fontSize: 12, color: darkMode ? "#c9d1d9" : "#374151", fontWeight: 600 }}>{detailExtra.developer}</span>
                    </div>
                  )}

                  {/* Google Books — páginas e publisher */}
                  {detailExtra?.pages && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#8b949e", marginRight: 6 }}>Páginas:</span>
                      <span style={{ fontSize: 12, color: darkMode ? "#c9d1d9" : "#374151", fontWeight: 600 }}>{detailExtra.pages}</span>
                    </div>
                  )}
                  {detailExtra?.publisher && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#8b949e", marginRight: 6 }}>Editora:</span>
                      <span style={{ fontSize: 12, color: darkMode ? "#c9d1d9" : "#374151", fontWeight: 600 }}>{detailExtra.publisher}</span>
                    </div>
                  )}

                  {/* Keywords TMDB */}
                  {detailExtra?.keywords?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Keywords</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {detailExtra.keywords.map(k => <span key={k} style={{ background: darkMode ? "#161b22" : "#f1f5f9", border: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, color: darkMode ? "#8b949e" : "#64748b", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{k}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Temporadas TMDB */}
                  {detailExtra?.seasonsList?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Temporadas</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {detailExtra.seasonsList.map(s => (
                          <div key={s.number} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: darkMode ? "#161b22" : "#f1f5f9" }}>
                            {s.poster && <img src={s.poster} alt="" style={{ width: 32, height: 44, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#f0f6fc" : "#0f172a" }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: "#8b949e" }}>{s.episodes} ep{s.airDate ? ` · ${s.airDate}` : ""}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arcs ComicVine */}
                  {detailExtra?.issueCount && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#8b949e", marginRight: 6 }}>Issues:</span>
                      <span style={{ fontSize: 12, color: darkMode ? "#c9d1d9" : "#374151", fontWeight: 600 }}>{detailExtra.issueCount}</span>
                      {detailExtra.startYear && <span style={{ fontSize: 11, color: "#8b949e", marginLeft: 8 }}>· desde {detailExtra.startYear}</span>}
                    </div>
                  )}

                  {/* Coleção TMDB */}
                  {collection && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📦 {collection.name}</h4>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {collection.parts.map(p => (
                          <div key={p.id}
                            onClick={() => p.id !== currentItem.id && pushItem(p)}
                            style={{ flexShrink: 0, width: 70, cursor: p.id !== currentItem.id ? "pointer" : "default", opacity: p.id === currentItem.id ? 1 : 0.75, WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 70, height: 100, borderRadius: 8, overflow: "hidden", background: gradientFor(p.id), border: p.id === currentItem.id ? `2px solid ${accent}` : "2px solid transparent" }}>
                              {p.cover && <img src={p.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <p style={{ fontSize: 9, color: "#8b949e", marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                            {p.year && <p style={{ fontSize: 9, color: "#484f58" }}>{p.year}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DLCs e Expansões (jogos) */}
                  {dlcs.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🎮 DLCs & Expansões</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {dlcs.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: darkMode ? "#161b22" : "#f1f5f9" }}>
                            <div style={{ width: 36, height: 48, borderRadius: 6, overflow: "hidden", background: gradientFor(d.id), flexShrink: 0 }}>
                              {d.cover && <img src={d.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</p>
                              <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>{d.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recomendações */}
                  {recommendations.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>✨ {lang === "en" ? "Recommendations" : "Recomendações"}</h4>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {recommendations.map(r => (
                          <div key={r.id}
                            onClick={() => pushItem(r)}
                            style={{ flexShrink: 0, width: 70, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 70, height: 100, borderRadius: 8, overflow: "hidden", background: gradientFor(r.id) }}>
                              {r.cover && <img src={r.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <p style={{ fontSize: 9, color: "#8b949e", marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Jogos similares */}
                  {similarGames.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🎮 {lang === "en" ? "Similar Games" : "Jogos Similares"}</h4>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                        {similarGames.map(g => (
                          <div key={g.id}
                            onClick={() => pushItem(g)}
                            style={{ flexShrink: 0, width: 70, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 70, height: 100, borderRadius: 8, overflow: "hidden", background: gradientFor(g.id) }}>
                              {g.cover && <img src={g.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={e => e.currentTarget.style.display="none"} />}
                            </div>
                            <p style={{ fontSize: 9, color: "#8b949e", marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Media (Screenshots) */}
              {modalTab === "media" && (
                <div style={{ marginTop: 16 }}>
                  {extraLoading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                      <div className="spin" style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                      <p style={{ fontSize: 13 }}>A carregar...</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Vídeos/Trailers — TMDB e IGDB */}
                      {(detailExtra?.videos?.length > 0) && (
                        <div>
                          <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>🎬 Trailers</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {detailExtra.videos.map(v => (
                              <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: darkMode ? "#161b22" : "#f1f5f9", textDecoration: "none" }}>
                                <div style={{ width: 48, height: 34, borderRadius: 6, overflow: "hidden", flexShrink: 0, position: "relative", background: "#000" }}>
                                  <img src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 16, filter: "drop-shadow(0 0 3px rgba(0,0,0,0.8))" }}>▶</span>
                                  </div>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#f0f6fc" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                                  <div style={{ fontSize: 11, color: "#8b949e" }}>{v.type || "YouTube"}</div>
                                </div>
                                <span style={{ color: accent, fontSize: 18, flexShrink: 0 }}>↗</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Artworks IGDB */}
                      {detailExtra?.artworks?.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>🖼 Artworks</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {detailExtra.artworks.map((src, i) => (
                              <div key={i} style={{ borderRadius: 10, overflow: "hidden", background: "#161b22" }}>
                                <img src={src} alt="" style={{ width: "100%", display: "block", borderRadius: 10 }} onError={e => e.currentTarget.parentElement.style.display="none"} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Screenshots */}
                      {screenshots.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: 11, fontWeight: 800, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>📸 Screenshots</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {screenshots.map((src, i) => (
                              <div key={i} style={{ borderRadius: 10, overflow: "hidden", background: "#161b22" }}>
                                <img src={src} alt="" style={{ width: "100%", display: "block", borderRadius: 10 }} onError={e => e.currentTarget.parentElement.style.display="none"} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!detailExtra?.videos?.length && !detailExtra?.artworks?.length && !screenshots.length && (
                        <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "32px 0" }}>Sem media disponível.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Cast / Personagens */}
              {modalTab === "cast" && (
                <div style={{ marginTop: 16 }}>
                  {detailLoading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                      <div className="spin" style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                      <p style={{ fontSize: 13 }}>{lang === "en" ? "Loading..." : "A carregar..."}</p>
                    </div>
                  ) : !detailExtra?.cast?.length && !detailExtra?.director ? (
                    <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "32px 0" }}>{lang === "en" ? "No cast information available." : "Sem informação de cast disponível."}</p>
                  ) : isAniList ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {detailExtra.cast.map((c) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1117", borderRadius: 10, padding: "8px 10px" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                            {c.image && <img src={c.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: c.role === "MAIN" ? accent : "#6e7681" }}>{c.role === "MAIN" ? "Main" : "Supporting"}</p>
                          </div>
                          {c.va && (
                            <>
                              <div style={{ width: 1, height: 36, background: "#21262d", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                                <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.va.name}</p>
                                <p style={{ fontSize: 10, color: "#6e7681" }}>JP</p>
                              </div>
                              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                                {c.va.image && <img src={c.va.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {/* Diretor no topo */}
                      {detailExtra.director && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6e7681", marginBottom: 8, letterSpacing: "0.5px" }}>{lang === "en" ? "DIRECTOR" : "REALIZADOR"}</p>
                          <div onClick={() => setSelectedPerson(detailExtra.director)} style={{ display: "flex", alignItems: "center", gap: 12, background: `${accent}11`, border: `1px solid ${accent}33`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                            <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                              {detailExtra.director.image ? <img src={detailExtra.director.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎬</div>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 800 }}>{detailExtra.director.name}</p>
                              <p style={{ fontSize: 11, color: accent }}>{lang === "en" ? "Director →" : "Realizador →"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Cast grid — clicável */}
                      {detailExtra.cast?.length > 0 && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6e7681", marginBottom: 8, letterSpacing: "0.5px" }}>{lang === "en" ? "CAST" : "ELENCO"}</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 12 }}>
                            {detailExtra.cast.map((c) => (
                              <div key={c.id} onClick={() => setSelectedPerson(c)} style={{ textAlign: "center", cursor: "pointer" }}>
                                <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: "#21262d", marginBottom: 6 }}>
                                  {c.image ? <img src={c.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>}
                                </div>
                                <p style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{c.name}</p>
                                <p style={{ fontSize: 10, color: "#6e7681", lineHeight: 1.3 }}>{c.character}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Relações */}
              {modalTab === "relacoes" && (
                <div style={{ marginTop: 16 }}>
                  {detailLoading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#484f58" }}>
                      <div className="spin" style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                      <p style={{ fontSize: 13 }}>{lang === "en" ? "Loading..." : "A carregar..."}</p>
                    </div>
                  ) : !detailExtra?.relations?.length ? (
                    <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "32px 0" }}>{lang === "en" ? "No relations available." : "Sem relações disponíveis."}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {detailExtra.relations.map((r, i) => (
                        <div key={r.id + i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0d1117", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ width: 42, height: 60, borderRadius: 6, overflow: "hidden", background: "#21262d", flexShrink: 0 }}>
                            {r.cover && <img src={r.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 11, color: accent, fontWeight: 700, marginBottom: 3 }}>{RELATION_LABELS[r.type] || r.type}</p>
                            <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                            <p style={{ fontSize: 11, color: "#6e7681", marginTop: 2 }}>{[r.format, r.status].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
            {/* ── Barra fixa: estado, nota e ações (registo rápido) ── */}
            <div style={{ position: "sticky", bottom: 0, zIndex: 5, padding: isMobileDevice ? "10px 14px calc(12px + env(safe-area-inset-bottom, 0px))" : "14px 20px 16px", background: darkMode ? "rgba(13,17,23,0.94)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`, display: "flex", flexDirection: "column", gap: 10 }}>
              {inLib ? (
                <>
                  {barExtras && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        onBlur={() => { if (onUpdateNote) onUpdateNote(currentItem.id, noteInput.trim()); }}
                        placeholder={lang === "en" ? "Your note..." : "A tua nota..."}
                        rows={2}
                        style={{ width: "100%", background: darkMode ? "rgba(255,255,255,0.05)" : "#f1f5f9", border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`, borderRadius: 10, padding: "8px 10px", color: darkMode ? "#c9d1d9" : "#334155", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }}
                      />
                      {isChapterType && libItem.userStatus === "assistindo" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" }}>📖 Capítulo:</span>
                          <input type="text" value={chapterInput} onChange={e => setChapterInput(e.target.value)} placeholder="ex: Cap. 42" onKeyDown={e => e.key === "Enter" && onUpdateLastChapter && onUpdateLastChapter(currentItem.id, chapterInput.trim())} style={{ flex: 1, minWidth: 0, background: darkMode ? "#21262d" : "#f1f5f9", border: `1px solid ${accent}44`, borderRadius: 8, padding: "6px 10px", color: darkMode ? "#e6edf3" : "#0f172a", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                          <button onClick={() => onUpdateLastChapter && onUpdateLastChapter(currentItem.id, chapterInput.trim())} style={{ background: accent, border: "none", borderRadius: 8, padding: "6px 14px", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>✓</button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Estado */}
                  <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 12, background: darkMode ? "rgba(0,0,0,0.35)" : "#f1f5f9", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`, overflowX: "auto", scrollbarWidth: "none" }}>
                    {STATUS_OPTIONS.map((st) => {
                      const on = libItem.userStatus === st.id;
                      return (
                        <button key={st.id} onClick={(e) => { const el=e.currentTarget; el.classList.remove("ta-bounce"); void el.offsetWidth; el.classList.add("ta-bounce"); onUpdateStatus(currentItem.id, st.id); }}
                          style={{ flex: "1 0 auto", padding: isMobileDevice ? "8px 10px" : "9px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", background: on ? (darkMode ? "rgba(255,255,255,0.1)" : "#ffffff") : "transparent", boxShadow: on && !darkMode ? "0 1px 3px rgba(0,0,0,0.12)" : "none", color: on ? st.color : "#8b949e", transition: "background 0.15s, color 0.15s" }}>
                          {st.emoji} {statusLabel(st, lang)}
                        </button>
                      );
                    })}
                  </div>
                  {/* Nota + ações */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
                    <StarRating value={libItem.userRating || 0} onChange={(v) => onUpdateRating(currentItem.id, v)} size={isMobileDevice ? 17 : 22} />
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {onToggleFavorite && (
                        <button onClick={(e) => { const el=e.currentTarget; el.classList.remove("ta-pop"); void el.offsetWidth; el.classList.add("ta-pop"); onToggleFavorite(currentItem); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: canAddFavorite || isFavorite ? "pointer" : "not-allowed", opacity: !canAddFavorite && !isFavorite ? 0.4 : 1, border: `1px solid ${isFavorite ? accent : (darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0")}`, background: isFavorite ? `${accent}22` : "transparent", color: isFavorite ? accent : "#8b949e" }}
                          title={isFavorite ? "Remover dos favoritos" : canAddFavorite ? "Adicionar aos favoritos" : useT("favoritesFull")}>
                          <span style={{ fontSize: 14 }}>{isFavorite ? "♥" : "♡"}</span>{!isMobileDevice && "Favorito"}
                        </button>
                      )}
                      {onToggleHallOfFame && (
                        <button onClick={(e) => { const el=e.currentTarget; el.classList.remove("ta-pop"); void el.offsetWidth; el.classList.add("ta-pop"); onToggleHallOfFame(currentItem); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: canAddHallOfFame || isHallOfFame ? "pointer" : "not-allowed", opacity: !canAddHallOfFame && !isHallOfFame ? 0.4 : 1, border: `1px solid ${isHallOfFame ? "#fbbf24" : (darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0")}`, background: isHallOfFame ? "#fbbf2422" : "transparent", color: isHallOfFame ? "#fbbf24" : "#8b949e" }}
                          title={isHallOfFame ? (lang === "en" ? "Remove from Hall of Fame" : "Remover do Hall of Fame") : canAddHallOfFame ? (lang === "en" ? "Add to Hall of Fame" : "Adicionar ao Hall of Fame") : (lang === "en" ? "Hall of Fame is full" : "Hall of Fame cheio")}>
                          <span style={{ fontSize: 14 }}>{isHallOfFame ? "★" : "☆"}</span>{!isMobileDevice && "Hall of Fame"}
                        </button>
                      )}
                      <button onClick={() => setBarExtras(v => !v)} title={lang === "en" ? "Note" : "Nota pessoal"} aria-label={lang === "en" ? "Note" : "Nota pessoal"}
                        style={{ position: "relative", width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 14, border: `1px solid ${barExtras ? accent : (darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0")}`, background: barExtras ? `${accent}22` : "transparent", color: barExtras ? accent : "#8b949e" }}>
                        ✎{(noteInput || libItem.userNote) && !barExtras && <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 99, background: accent }} />}
                      </button>
                      <button onClick={() => onRemove(currentItem.id)} title={lang === "en" ? "Remove" : "Remover"} aria-label={lang === "en" ? "Remove" : "Remover"}
                        style={{ width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 14, border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, background: "transparent", color: "#ef4444" }}>🗑</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{useT("addToLibrary")}</div>
                      <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>{lang === "en" ? "Pick a status to add it." : "Escolhe o estado para adicionar."}</div>
                    </div>
                    <StarRating value={addRating} onChange={setAddRating} size={isMobileDevice ? 16 : 20} />
                  </div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                    {STATUS_OPTIONS.map((st) => (
                      <button key={st.id} onClick={(e) => { const el=e.currentTarget; el.classList.remove("ta-bounce"); void el.offsetWidth; el.classList.add("ta-bounce"); setTimeout(() => { onAdd(currentItem, st.id, addRating); onClose(); }, 180); }}
                        style={{ flex: "1 0 auto", padding: "11px 14px", borderRadius: 12, border: `1px solid ${st.color}55`, background: `${st.color}18`, color: st.color, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                        {st.emoji} {statusLabel(st, lang)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    {coverEdit && inLib && (
      <CoverEditModal
        item={{ ...currentItem, customCover: libItem?.customCover }}
        onSave={(url) => { onChangeCover(currentItem.id, url); setCoverEdit(false); }}
        onClose={() => setCoverEdit(false)}
      />
    )}
    </>
  );
}
