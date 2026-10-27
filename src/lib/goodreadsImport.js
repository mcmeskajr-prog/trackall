// ─── Importar do Goodreads (ficheiro CSV exportado) ───
// Funções puras (CSV, estados, datas, correspondência) + resolveGoodreads, que recebe a pesquisa por injeção (testável).
// Cada livro é ligado ao Google Books (ISBN primeiro, título+autor como alternativa) para ter capa, sinopse, etc.
import { normalizeMediaId } from "./mediaIds";
import { similarity, pickMatch } from "./notesImport";

// CSV completo (RFC 4180): aspas, vírgulas e quebras de linha dentro de campos. → array de linhas (arrays de texto)
export function parseCSV(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const rows = []; let row = [], cur = "", inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(c => c !== "")) rows.push(row);
  return rows;
}

// O Goodreads escreve ISBNs como ="9780441172719". Devolve só dígitos (ou X final) com 10/13 caracteres, senão "".
export function cleanIsbn(v) {
  const s = String(v || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  return s.length === 10 || s.length === 13 ? s : "";
}

// "Dune (Dune, #1)" → "Dune"; "Título: sub (Série #2)" → "Título: sub"
export const cleanTitle = (t) => String(t || "").replace(/\s*\([^()]*#\s*\d+[^()]*\)\s*$/, "").trim();

// "2023/05/14" ou "2023-05-14" → timestamp ao meio-dia local; vazio/inválido → null
export function parseGoodreadsDate(s) {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], 12).getTime();
  return Number.isFinite(t) ? t : null;
}

// Prateleira exclusiva → estado. Prateleiras personalizadas: com data de leitura contam como lidas.
export function statusFromShelf(shelf, readAt) {
  const s = String(shelf || "").trim().toLowerCase();
  if (s === "read") return "completo";
  if (s === "currently-reading") return "assistindo";
  if (s === "to-read") return "planejado";
  return readAt ? "completo" : "planejado";
}

// Texto do CSV → entradas { line, title, author, isbn, rating, status, readAt }. Sem as colunas certas → [].
export function parseGoodreads(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim());
  const col = (n) => head.indexOf(n);
  const iTitle = col("Title");
  if (iTitle < 0 || col("Exclusive Shelf") < 0) return [];
  const iAuthor = col("Author"), iIsbn13 = col("ISBN13"), iIsbn = col("ISBN"), iRate = col("My Rating"), iRead = col("Date Read"), iShelf = col("Exclusive Shelf");
  const out = [];
  rows.slice(1).forEach((r, k) => {
    const title = cleanTitle(r[iTitle]);
    if (!title) return;
    const readAt = parseGoodreadsDate(r[iRead]);
    const status = statusFromShelf(r[iShelf], readAt);
    const rating = Math.max(0, Math.min(10, (parseInt(r[iRate], 10) || 0) * 2)); // 1–5 estrelas → 2–10
    out.push({ line: k + 2, title, author: (r[iAuthor] || "").trim(), isbn: cleanIsbn(r[iIsbn13]) || cleanIsbn(r[iIsbn]), rating, status, readAt: status === "completo" ? readAt : null });
  });
  return out;
}

// Pesquisa cada livro. search(query) → Promise<item[]>. Devolve [{ entry, state: "ok"|"ask"|"none", chosen, options, by }]
//  ok  = ISBN que bate com o título, ou título muito parecido (ligado, entra por defeito)
//  ask = parecido mas com dúvidas (fica de fora até o utilizador incluir)
export async function resolveGoodreads(entries, { search, concurrency = 3, onProgress, shouldStop } = {}) {
  const results = new Array(entries.length);
  let next = 0, done = 0;
  const q = async (s) => { try { return (await search(s)) || []; } catch { return []; } };
  const worker = async () => {
    while (next < entries.length) {
      if (shouldStop && shouldStop()) return;
      const idx = next++;
      const e = entries[idx];
      let res = null;
      if (e.isbn) {
        const hit = (await q(`isbn:${e.isbn}`)).find(c => c && c.id && c.title && similarity(e.title, c.title) >= 0.4);
        if (hit) res = { state: "ok", chosen: { ...hit, type: "livros" }, options: [hit], by: "isbn" };
      }
      if (!res) {
        const cands = (await q(`${e.title} ${e.author}`.trim())).slice(0, 8);
        const pm = pickMatch({ title: e.title }, cands.map(c => ({ ...c, type: "livros" })));
        res = { ...pm, by: "titulo" };
        if (pm.state === "none") res.options = [];
      }
      results[idx] = { entry: e, ...res };
      done++;
      onProgress && onProgress(done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) || 1 }, worker));
  return results.filter(Boolean);
}

// Livro escolhido → item da biblioteca. Data de leitura só entra se withDates (e só em "completo" → aparece no Diário).
export function toLibraryItem(result, chosen, withDates = true) {
  const c = chosen || result.chosen;
  const e = result.entry;
  return {
    ...c, type: "livros", id: normalizeMediaId(c.id, "livros"),
    userStatus: e.status, userRating: e.rating || 0,
    ...(withDates && e.readAt && e.status === "completo" ? { addedAt: e.readAt } : {}),
  };
}
