import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { gradientFor } from "../lib/utils";
import { findLibraryEntry } from "../lib/mediaIds";
import { MEDIA_TYPES, mediaLabel } from "../config/constants";
import { MAX_FAVORITES_PER_TYPE } from "../config/limits";
import { CoverImg } from "./CoverImg";
import { Sakura } from "./Sakura";

// ─── Hall of Fame 2×5 e favoritos em pilhas (telemóvel) ───
// Leve de propósito: sem desfoques, sem sombras pesadas, imagens preguiçosas, e o arrastar mexe direto no DOM (não re-renderiza a cada dedo).

const moveItem = (arr, from, to) => { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

// Arrastar para reordenar. Toque longo numa capa levanta-a; com `handle` arrasta-se logo pela pega (≡).
// Os filhos têm de ter data-ridx={índice}. Só impede o deslize da página enquanto estás mesmo a arrastar.
function useDragReorder(onReorder, { handle = null } = {}) {
  const ref = useRef(null);
  const cb = useRef(onReorder);
  cb.current = onReorder;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let st = null;
    const idxNode = (n) => { const t = n && n.closest ? n.closest("[data-ridx]") : null; return t && el.contains(t) ? t : null; };
    const clearOver = () => { if (st && st.over) { st.over.style.outline = ""; st.over = null; } };
    const begin = () => {
      if (!st || st.active) return;
      st.active = true;
      const n = st.node;
      n.style.transition = "none"; n.style.zIndex = "5"; n.style.pointerEvents = "none"; n.style.opacity = "0.92";
      n.style.willChange = "transform";
      if (navigator.vibrate) navigator.vibrate(15);
    };
    const reset = () => {
      if (!st) return;
      clearTimeout(st.timer); clearOver();
      const n = st.node;
      n.style.transform = ""; n.style.zIndex = ""; n.style.pointerEvents = ""; n.style.opacity = ""; n.style.willChange = ""; n.style.transition = "";
      st = null;
    };
    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      const node = idxNode(e.target);
      if (!node) return;
      if (handle && !(e.target.closest && e.target.closest(handle))) return;
      const t = e.touches[0];
      st = { node, from: Number(node.dataset.ridx), sx: t.clientX, sy: t.clientY, active: false, over: null, timer: 0 };
      if (handle) { begin(); e.preventDefault(); }
      else st.timer = setTimeout(begin, 380);
    };
    const onMove = (e) => {
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.sx, dy = t.clientY - st.sy;
      if (!st.active) { if (Math.abs(dx) + Math.abs(dy) > 10) reset(); return; }
      e.preventDefault();
      st.node.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
      const under = idxNode(document.elementFromPoint(t.clientX, t.clientY));
      const target = under && under !== st.node ? under : null;
      if (target !== st.over) { clearOver(); if (target) { target.style.outline = "2px solid var(--reorder-c, #fff)"; target.style.outlineOffset = "-2px"; } st.over = target; }
    };
    const onEnd = (e) => {
      if (!st) return;
      const was = st.active, from = st.from, to = st.over ? Number(st.over.dataset.ridx) : null;
      reset();
      if (was) { if (e.cancelable) e.preventDefault(); if (to != null && to !== from) cb.current(from, to); }
    };
    const ctx = (e) => { if (st && st.active) e.preventDefault(); };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    el.addEventListener("contextmenu", ctx);
    return () => {
      reset();
      el.removeEventListener("touchstart", onStart); el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd); el.removeEventListener("touchcancel", onEnd); el.removeEventListener("contextmenu", ctx);
    };
  }, [handle]);
  return ref;
}

const noSelect = { userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" };

// ── Hall of Fame: 2 filas de 5, sem números. Os lugares livres ficam a tracejado com "+" ──
export const HofGridMobile = memo(function HofGridMobile({ list, accent, darkMode, lang, library, onOpen, onReorder, onAdd }) {
  const ref = useDragReorder((from, to) => onReorder && onReorder(moveItem(list, from, to)));
  const slots = Array.from({ length: 10 }, (_, i) => list[i] || null);
  return (
    <div ref={ref} style={{ "--reorder-c": accent, padding: "2px 16px 0", gap: 8, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", ...noSelect }}>
      {slots.map((item, i) => {
        if (!item) return (
          <button key={`e${i}`} type="button" aria-label={lang === "en" ? "Add to Hall of Fame" : "Adicionar ao Hall of Fame"} onClick={onAdd}
            style={{ width: "100%", aspectRatio: "2/3", borderRadius: 10, border: `1.5px dashed ${accent}66`, background: "transparent", color: accent, fontSize: 22, fontWeight: 300, cursor: "pointer", padding: 0 }}>+</button>
        );
        const coverSrc = item.customCover || item.cover;
        const score = findLibraryEntry(library, item.id, item.type)?.item?.userRating ?? item.userRating ?? 0;
        return (
          <div key={item.id} data-ridx={i} onClick={() => onOpen && onOpen(item)} title={item.title}
            style={{ position: "relative", width: "100%", aspectRatio: "2/3", borderRadius: 10, overflow: "hidden", cursor: "pointer", background: gradientFor(item.id), boxShadow: item._feat ? `0 0 0 2px ${accent}` : "0 4px 10px -6px rgba(0,0,0,0.8)", transition: "transform .15s" }}>
            {coverSrc && <CoverImg hi src={coverSrc} alt={item.title} loading="lazy" decoding="async" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            {score > 0 && <div style={{ position: "absolute", right: 3, top: 3, padding: "1px 4px 1px 3px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#fbcfe8", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", gap: 2, lineHeight: 1.3, pointerEvents: "none" }}><Sakura size={8} />{score}</div>}
          </div>
        );
      })}
    </div>
  );
});

// ── Favoritos: uma pilha por tipo (capas sobrepostas), duas colunas; se sobrar uma, ocupa a largura toda ──
const STEP = 0.555; // avanço entre capas, em largura de capa
function Stack({ items, wide }) {
  // O tamanho das capas é sempre o de uma pilha cheia (4, ou 5 na larga); com menos itens ficam centradas
  const N = wide ? 5 : 4;
  const n = Math.min(items.length, N);
  const w = 100 / (1 + (N - 1) * STEP);
  const off = (100 - w * (1 + (Math.max(n, 1) - 1) * STEP)) / 2;
  return (
    <div style={{ position: "relative", width: wide ? "56%" : "100%", margin: wide ? "0 auto" : 0, aspectRatio: wide ? "3.22 / 1.5" : "2.67 / 1.5" }}>
      {items.slice(0, n).map((it, j) => {
        const src = it.customCover || it.cover;
        return (
          <div key={it.id} style={{ position: "absolute", left: `${off + j * w * STEP}%`, top: 0, width: `${w}%`, aspectRatio: "2/3", borderRadius: 7, overflow: "hidden", zIndex: n - j, background: gradientFor(it.id), boxShadow: "3px 0 8px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
            {src && <CoverImg hi src={src} alt={it.title} loading="lazy" decoding="async" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Ecrã de um tipo: lista com ≡ para reordenar; a primeira é o destaque ──
function TypeSheet({ t, list, accent, darkMode, lang, ratingOf, onOpen, onReorder, onClose }) {
  const text = darkMode ? "#e6edf3" : "#0f172a", muted = darkMode ? "#9aa6b2" : "#64748b";
  const line = darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)";
  const ref = useDragReorder((from, to) => onReorder(moveItem(list, from, to)), { handle: "[data-handle]" });
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 45, overflowY: "auto", WebkitOverflowScrolling: "touch", background: darkMode ? "#0b0d12" : "#f3f4f8", color: text, paddingBottom: 120 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 14px 10px", background: darkMode ? "#0b0d12" : "#f3f4f8" }}>
        <button type="button" onClick={onClose} aria-label={lang === "en" ? "Back" : "Voltar"} style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)", color: text, fontSize: 18, cursor: "pointer" }}>←</button>
        <div style={{ flex: 1, fontSize: 19, fontWeight: 800 }}>{mediaLabel(t, lang)}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: muted }}>{list.length}/{MAX_FAVORITES_PER_TYPE}</div>
      </div>
      <div ref={ref} style={{ padding: "0 14px", "--reorder-c": accent, ...noSelect }}>
        {(() => {
          const handleBtn = <div data-handle aria-label={lang === "en" ? "Drag to reorder" : "Arrastar para reordenar"} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#e6edf3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, touchAction: "none", cursor: "grab", flexShrink: 0 }}>≡</div>;
          const cover = (it, style) => { const src = it.customCover || it.cover; return (
            <div style={{ position: "relative", background: gradientFor(it.id), overflow: "hidden", ...style }}>
              {src && <CoverImg hi src={src} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            </div>); };
          const first = list[0], rest = list.slice(1);
          const fr = first ? ratingOf(first) : 0;
          return (<>
            {first && (
              <div data-ridx={0} style={{ position: "relative", borderRadius: 22, overflow: "hidden", padding: 16, background: darkMode ? `linear-gradient(135deg, ${accent}33, #161020 70%)` : `linear-gradient(135deg, ${accent}2e, #ffffff 75%)`, border: `1px solid ${accent}66`, transition: "transform .15s" }}>
                <div style={{ position: "relative", display: "flex", gap: 16 }}>
                  <div onClick={() => onOpen && onOpen(first)} style={{ cursor: "pointer", flexShrink: 0 }}>
                    {cover(first, { width: 132, height: 198, borderRadius: 14, boxShadow: `0 0 0 2px ${accent}, 0 16px 30px -10px rgba(0,0,0,0.6)` })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: "#1a0f18", background: accent }}>★ {lang === "en" ? "TOP PICK" : "DESTAQUE"}</span>
                      {handleBtn}
                    </div>
                    <div onClick={() => onOpen && onOpen(first)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                      <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.12, marginTop: 12, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{first.title}</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{mediaLabel(t, lang)}</div>
                      {fr > 0 && <div style={{ marginTop: "auto", fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>★ {fr}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
                {rest.map((it, k) => {
                  const i = k + 1, r = ratingOf(it);
                  const lone = rest.length % 2 === 1 && k === rest.length - 1; // sem fila órfã: a última fica centrada
                  return (
                    <div key={it.id} data-ridx={i} style={{ position: "relative", aspectRatio: "2/3", borderRadius: 16, overflow: "hidden", background: gradientFor(it.id), boxShadow: "0 10px 20px -12px rgba(0,0,0,0.8)", transition: "transform .15s", ...(lone ? { gridColumn: "1 / -1", width: "calc(50% - 5px)", justifySelf: "center" } : null) }}>
                      <div onClick={() => onOpen && onOpen(it)} style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
                        {(it.customCover || it.cover) && <CoverImg hi src={it.customCover || it.cover} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "36px 12px 11px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))", color: "#fff", pointerEvents: "none" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.title}</div>
                          {r > 0 && <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "#fbbf24" }}>★ {r}</div>}
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: 8, top: 8, minWidth: 24, height: 24, padding: "0 6px", borderRadius: 12, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{i + 1}</div>
                      <div style={{ position: "absolute", right: 8, top: 8 }}>{handleBtn}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: muted, marginTop: 14 }}>{lang === "en" ? "Drag ≡ onto another cover to change the order; the first one is the top pick." : "Arrasta o ≡ para cima de outra capa para mudar a ordem; a primeira é o destaque."}</div>
          </>);
        })()}
      </div>
    </div>, document.body);
}

export function FavStacksMobile({ favorites, library, accent, darkMode, lang, onOpen, onReorderFavorites, onOpenLibrary }) {
  const [openType, setOpenType] = useState(null);
  const text = darkMode ? "#e6edf3" : "#0f172a", muted = darkMode ? "#aab4c0" : "#64748b";
  const tileBg = darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)", tileBd = darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)";
  const ratingOf = (it) => findLibraryEntry(library, it.id, it.type)?.item?.userRating ?? it.userRating ?? 0;

  // ordem dos tipos = ordem em que aparecem na lista; dentro de cada tipo, a ordem da lista
  const typeOrder = [];
  favorites.forEach((f) => { if (!typeOrder.includes(f.type)) typeOrder.push(f.type); });
  const known = typeOrder.map((id) => MEDIA_TYPES.find((t) => t.id === id)).filter(Boolean);
  const byType = (id) => favorites.filter((f) => f.type === id);
  const empties = MEDIA_TYPES.slice(1).filter((t) => !typeOrder.includes(t.id));

  const flatten = (order, override) => {
    const out = order.flatMap((id) => (override && override.id === id ? override.list : byType(id)));
    const seen = new Set(out); // nada se perde (ex.: tipos que já não existem na lista de tipos)
    return out.concat(favorites.filter((f) => !seen.has(f)));
  };
  const reorderTypes = (from, to) => { const o = moveItem(known.map((t) => t.id), from, to); onReorderFavorites && onReorderFavorites(flatten(o)); };
  const ref = useDragReorder(reorderTypes);
  const sheetType = openType && known.find((t) => t.id === openType);
  useEffect(() => { // mudar de separador fecha a lista
    const close = () => setOpenType(null);
    window.addEventListener("trackall:nav", close);
    return () => window.removeEventListener("trackall:nav", close);
  }, []);

  return (
    <div style={{ padding: "0 16px" }}>
      <div ref={ref} style={{ "--reorder-c": accent, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, ...noSelect }}>
        {known.map((t, i) => {
          const list = byType(t.id);
          const wide = known.length % 2 === 1 && i === known.length - 1;
          return (
            <div key={t.id} data-ridx={i} role="button" tabIndex={0} onClick={() => setOpenType(t.id)}
              style={{ gridColumn: wide ? "1 / -1" : undefined, boxSizing: "border-box", borderRadius: 18, padding: 12, background: tileBg, border: `1px solid ${tileBd}`, cursor: "pointer", transition: "transform .15s" }}>
              <Stack items={list} wide={wide} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13, fontWeight: 800, color: text }}>
                {mediaLabel(t, lang)}<span style={{ color: muted, fontWeight: 700, fontSize: 12 }}>{list.length}/{MAX_FAVORITES_PER_TYPE}</span>
              </div>
            </div>
          );
        })}
      </div>
      {empties.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {empties.map((t) => (
            <button key={t.id} type="button" onClick={() => onOpenLibrary && onOpenLibrary({ type: t.id })}
              style={{ flex: "1 1 calc(50% - 8px)", minHeight: 52, borderRadius: 16, border: `1.5px dashed ${accent}77`, background: "transparent", color: accent, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              + {mediaLabel(t, lang)}
            </button>
          ))}
        </div>
      )}
      {sheetType && (
        <TypeSheet t={sheetType} list={byType(sheetType.id)} accent={accent} darkMode={darkMode} lang={lang} ratingOf={ratingOf} onOpen={onOpen}
          onReorder={(next) => onReorderFavorites && onReorderFavorites(flatten(typeOrder, { id: sheetType.id, list: next }))} onClose={() => setOpenType(null)} />
      )}
    </div>
  );
}
