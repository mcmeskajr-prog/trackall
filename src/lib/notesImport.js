// ─── Importar a partir de notas (lista de títulos em texto) ───
// Sem IA: lê o texto linha a linha, procura cada título nas APIs da pesquisa e escolhe pelo nome mais parecido.
// Funções puras (parseNotes, similarity, pickMatch) + resolveNotes, que recebe a função de pesquisa por injeção (testável).
import { normalizeMediaId } from "./mediaIds";

const STATUS_WORDS = {
  completo: ["completo", "completa", "completado", "completed", "complete", "visto", "vista", "lido", "lida", "terminado", "acabado", "done", "finished", "watched", "read", "completos", "vistos", "lidos"],
  assistindo: ["a ver", "em curso", "a ler", "a jogar", "assistindo", "watching", "reading", "playing", "current", "em andamento", "a assistir"],
  planejado: ["planeado", "planejado", "planned", "plan", "por ver", "por ler", "quero ver", "quero ler", "to watch", "to read", "backlog", "wishlist", "planeados"],
  dropado: ["dropado", "largado", "abandonado", "dropped", "desisti"],
  pausado: ["pausado", "paused", "em pausa", "on hold"],
};
const TYPE_WORDS = {
  anime: ["anime", "animes"], manga: ["manga", "mangá", "mangas", "mangás"], manhwa: ["manhwa", "manhwas", "webtoon", "webtoons"],
  lightnovels: ["light novel", "light novels", "lightnovel", "ln"], filmes: ["filme", "filmes", "movie", "movies", "film", "films"],
  series: ["serie", "série", "series", "séries", "tv", "show", "shows"], jogos: ["jogo", "jogos", "game", "games"],
  livros: ["livro", "livros", "book", "books"], comics: ["comic", "comics", "bd"],
};
const lookup = (table, word) => { const w = word.toLowerCase().trim(); return Object.keys(table).find(k => table[k].includes(w)) || null; };
export const statusFromWord = (w) => lookup(STATUS_WORDS, w);
export const typeFromWord = (w) => lookup(TYPE_WORDS, w);

const roundHalf = (n) => Math.max(0, Math.min(10, Math.round(n * 2) / 2));
const num = (s) => parseFloat(String(s).replace(",", "."));

// "9", "9/10", "4.5/5", "★9" → nota 0–10 (meias estrelas); outra coisa → null
export function parseRating(seg) {
  const s = String(seg).trim();
  let m = /^(\d+(?:[.,]\d+)?)\s*\/\s*(5|10|100)$/.exec(s);
  if (m) return roundHalf((num(m[1]) / Number(m[2])) * 10);
  m = /^★\s*(\d+(?:[.,]\d+)?)$/.exec(s) || /^(\d+(?:[.,]\d+)?)\s*★$/.exec(s) || /^(\d+(?:[.,]\d+)?)$/.exec(s);
  if (m) { const n = num(m[1]); return n >= 0 && n <= 10 ? roundHalf(n) : null; }
  return null;
}

// Texto → entradas { line, raw, title, year, rating, status, type }
export function parseNotes(text) {
  const out = [];
  let sectionType = null, sectionStatus = null;
  String(text || "").split(/\r?\n/).forEach((rawLine, idx) => {
    let line = rawLine.trim();
    if (!line) return;
    // cabeçalhos de secção: "Animes:", "# Manga", "Completos:" definem o tipo/estado das linhas seguintes
    if (/^#+\s*\S/.test(line) || /[:：]$/.test(line)) {
      const head = line.replace(/^#+\s*/, "").replace(/[:：]+$/, "").trim();
      const t = typeFromWord(head), st = statusFromWord(head);
      if (t) { sectionType = t; return; }
      if (st) { sectionStatus = st; return; }
      if (/^#+/.test(line)) return; // outro título qualquer com #: ignora
    }
    let checkbox = null;
    const cb = /^\s*[-*•]?\s*\[([ xX])\]\s+/.exec(line);
    if (cb) { checkbox = cb[1] === " " ? "planejado" : "completo"; line = line.slice(cb[0].length); }
    line = line.replace(/^\s*(?:[-*•·>]|\d{1,3}[.)])\s+/, "").trim();
    if (!line) return;

    let rating = null, status = checkbox, type = null, year = null;
    // nota colada ao fim: "Frieren 9/10", "Frieren ★9"
    let m = /\s+(\d+(?:[.,]\d+)?\s*\/\s*(?:5|10|100))\s*$/.exec(line) || /\s+(★\s*\d+(?:[.,]\d+)?)\s*$/.exec(line);
    if (m) { rating = parseRating(m[1]); line = line.slice(0, m.index).trim(); }

    const segs = line.split(/\s+[-–—|]\s+|\s*;\s*|\t+/).map(x => x.trim()).filter(Boolean);
    let title = segs.shift() || "";
    segs.forEach(seg => {
      const r = parseRating(seg);
      if (r !== null && rating === null) { rating = r; return; }
      const st = statusFromWord(seg), ty = typeFromWord(seg);
      if (st && !status) status = st; else if (ty && !type) type = ty;
    });
    // "(2021)", "(manga)", "(completo)" no fim do título
    for (let k = 0; k < 2; k++) {
      const p = /\s*\(([^)]+)\)\s*$/.exec(title);
      if (!p) break;
      const inner = p[1].trim();
      if (/^\d{4}$/.test(inner)) { year = inner; title = title.slice(0, p.index).trim(); }
      else if (typeFromWord(inner)) { type = type || typeFromWord(inner); title = title.slice(0, p.index).trim(); }
      else if (statusFromWord(inner)) { status = status || statusFromWord(inner); title = title.slice(0, p.index).trim(); }
      else break;
    }
    title = title.replace(/^["“”']+|["“”']+$/g, "").trim();
    if (!title) return;
    out.push({ line: idx + 1, raw: rawLine.trim(), title, year, rating: rating ?? 0, status: status || sectionStatus || "planejado", type: type || sectionType || null });
  });
  return out;
}

// ─── Semelhança entre títulos (0–1) ───
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().replace(/^(the|an|a|o|os|as)\s+/, "");

const bigrams = (s) => { const out = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); out.set(g, (out.get(g) || 0) + 1); } return out; };

export function similarity(q, t) {
  const a = norm(q), b = norm(t);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = a.split(" "), tb = b.split(" ");
  if (b.startsWith(a + " ")) return 0.9 - Math.min(0.15, (tb.length - ta.length) * 0.03);
  if (a.startsWith(b + " ")) return 0.7;
  const setB = new Set(tb);
  if (ta.every(x => setB.has(x))) return 0.8 - Math.min(0.15, (tb.length - ta.length) * 0.02);
  const A = bigrams(a), B = bigrams(b);
  let inter = 0; A.forEach((n, g) => { inter += Math.min(n, B.get(g) || 0); });
  const tot = Math.max(1, a.length - 1) + Math.max(1, b.length - 1);
  return (2 * inter / tot) * 0.7;
}

// Escolhe o melhor candidato. state: "ok" (certo) | "ask" (vários bons: escolhe) | "none"
export function pickMatch(entry, candidates) {
  const scored = (candidates || []).filter(c => c && c.id && c.title).map((c, i) => {
    let s = Math.max(similarity(entry.title, c.title), c.titleEn ? similarity(entry.title, c.titleEn) : 0);
    if (entry.year && c.year) s += String(c.year) === String(entry.year) ? 0.15 : -0.2;
    return { c, s, i };
  }).sort((x, y) => (y.s - x.s) || (x.i - y.i));
  const seen = new Set();
  const uniq = scored.filter(x => (seen.has(x.c.id) ? false : (seen.add(x.c.id), true)));
  if (!uniq.length || uniq[0].s < 0.5) return { state: "none", options: [] };
  const top = uniq[0], next = uniq[1];
  const options = uniq.filter(x => x.s >= 0.4).slice(0, 3).map(x => x.c);
  if (top.s >= 0.9 && (!next || top.s - next.s >= 0.1)) return { state: "ok", chosen: top.c, options };
  return { state: "ask", options };
}

export const AUTO_TYPES = ["anime", "manga", "filmes", "series", "jogos", "livros"];

// Procura todas as entradas. search(query, type) → Promise<item[]>. Devolve [{ entry, state, chosen, options }]
export async function resolveNotes(entries, { search, typeChoice = "auto", concurrency = 2, onProgress, shouldStop } = {}) {
  const results = new Array(entries.length);
  let next = 0, done = 0;
  const worker = async () => {
    while (next < entries.length) {
      if (shouldStop && shouldStop()) return;
      const idx = next++;
      const entry = entries[idx];
      const types = entry.type ? [entry.type] : (typeChoice && typeChoice !== "auto" ? [typeChoice] : AUTO_TYPES);
      const found = await Promise.all(types.map(t => Promise.resolve().then(() => search(entry.title, t)).catch(() => [])));
      const cands = found.flatMap((list, k) => (list || []).slice(0, 6).map(c => ({ ...c, type: c.type || types[k] })));
      results[idx] = { entry, ...pickMatch(entry, cands) };
      done++;
      onProgress && onProgress(done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) || 1 }, worker));
  return results.filter(Boolean);
}

// Resultado escolhido → item da biblioteca (sem data de conclusão: fica fora do Diário)
export function toLibraryItem(result, chosen) {
  const c = chosen || result.chosen;
  return { ...c, id: normalizeMediaId(c.id, c.type), userStatus: result.entry.status || "planejado", userRating: result.entry.rating || 0 };
}
