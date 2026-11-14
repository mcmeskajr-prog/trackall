// Planeados há mais de 6 meses contam como «esquecidos» (Home: lista e insights)
export const SIX_MONTHS = 1000 * 60 * 60 * 24 * 180;
export const THREE_MONTHS = 1000 * 60 * 60 * 24 * 90;

// ── Tokens visuais da Home ──
// Para mudar o carácter de toda a Home (0 = reto, 3 = quase reto, 6 = subtil) basta mudar HOME_R.
export const HOME_R = 3;
export const homeLine = (darkMode) => (darkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.12)");
export const homeLineStrong = (darkMode) => (darkMode ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.22)");
export const homeMuted = (darkMode) => (darkMode ? "#8b949e" : "#64748b");
export const homeText = (darkMode) => (darkMode ? "#f0f6fc" : "#0f172a");
export const homePanel = (darkMode, panelBg) => panelBg || (darkMode ? "rgba(14,16,20,0.72)" : "rgba(255,255,255,0.72)");

// ── Escolha com variedade ──
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pool já ordenado por pontuação (melhor primeiro). Sorteia entre os topN com mais peso para os de cima,
// evitando os ids em `exclude` (se não sobrar nada, ignora a exclusão).
export function pickDiverse(pool, { seed, exclude, topN = 8 }) {
  if (!pool || !pool.length) return null;
  let cands = pool.filter((i) => !exclude || !exclude.has(i.id));
  if (!cands.length) cands = pool;
  cands = cands.slice(0, topN);
  const weights = cands.map((_, i) => cands.length - i);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = seededRandom(seed)() * total;
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return cands[i]; }
  return cands[0];
}

export function dayNumber(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function monthsSince(ts, now = Date.now()) {
  if (!ts) return 0;
  return Math.max(0, Math.floor((now - ts) / (1000 * 60 * 60 * 24 * 30)));
}

// Sinopses vêm das APIs com etiquetas e entidades HTML (<br>, &mdash;…): limpa para texto simples.
export function cleanText(t) {
  if (!t) return "";
  let s = String(t).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
  try { const ta = document.createElement("textarea"); ta.innerHTML = s; s = ta.value; } catch { /* sem DOM */ }
  return s.replace(/\s+/g, " ").trim();
}
export function itemSynopsis(item) {
  return cleanText(item?.synopsis || item?.sinopse || item?.overview || item?.description || item?.plot || "");
}
export function itemBanner(item) {
  return item?.banner || item?.bannerImage || item?.backdrop || item?.backdropUrl || "";
}

// Linhas clicáveis das listas (Quando consumir, Nunca vais consumir): realce, seta que aparece e foco por teclado.
export const homeRowCss = (accent) => `.home-row{transition:background .15s,transform .15s;cursor:pointer}.home-row .row-go{opacity:.55;transition:opacity .15s,transform .15s}@media (hover:hover){.home-row:hover{background:${accent}14}.home-row:hover .row-go{opacity:1;transform:translateX(3px);color:${accent}}.home-row:hover .row-title{color:${accent}}}.home-row:focus-visible{outline:2px solid ${accent};outline-offset:-2px}.home-row:active{background:${accent}22}.home-danger{transition:all .15s}@media (hover:hover){.home-danger:hover{border-color:#e74c3c !important;color:#e74c3c !important;background:rgba(231,76,60,.1) !important}}`;
