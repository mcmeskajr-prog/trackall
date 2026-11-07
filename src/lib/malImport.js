// ─── Importar a lista exportada do MyAnimeList (XML) ───
// O MAL só exporta ficheiros (animelist_….xml.gz / mangalist_….xml.gz). Passos:
//   1) ler o XML (parseMalXml, puro)  2) descobrir o título equivalente no AniList pelo id do MAL (idMal)
//   3) montar itens iguais aos do AniList (mapAniListEntry) → ficam ligados às APIs e entram no mesmo circuito de importação.
import { mapAniListEntry } from "./anilistImport";

const MAL_STATUS = {
  watching: "CURRENT", reading: "CURRENT", completed: "COMPLETED", "on-hold": "PAUSED", onhold: "PAUSED",
  dropped: "DROPPED", "plan to watch": "PLANNING", "plan to read": "PLANNING",
  "1": "CURRENT", "2": "COMPLETED", "3": "PAUSED", "4": "DROPPED", "6": "PLANNING",
};

const unescapeXml = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const v = m[1].trim();
  const cd = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cd ? cd[1] : unescapeXml(v)).trim();
};

// "2021-03-14" → { year, month, day }; "0000-00-00" ou parcial → null
export const parseMalDate = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (!y || !mo || !d) return null;
  return { year: y, month: mo, day: d };
};

// Texto XML → [{ type, malId, title, status, score, finish }]. Aceita o ficheiro de anime ou de manga.
export function parseMalXml(xml) {
  const text = String(xml || "");
  const out = [];
  for (const [type, tagName, idTag] of [["ANIME", "anime", "series_animedb_id"], ["MANGA", "manga", "manga_mangadb_id"]]) {
    const re = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "g");
    let m;
    while ((m = re.exec(text))) {
      const b = m[1];
      const malId = parseInt(tag(b, idTag) || tag(b, "series_mangadb_id"), 10);
      if (!malId) continue;
      const st = MAL_STATUS[tag(b, "my_status").toLowerCase()];
      out.push({
        type, malId, title: tag(b, "series_title"),
        status: st || "PLANNING",
        score: Math.max(0, Math.min(10, Number(tag(b, "my_score")) || 0)),
        finish: parseMalDate(tag(b, "my_finish_date")),
      });
    }
  }
  const seen = new Set();
  return out.filter(e => { const k = e.type + e.malId; return seen.has(k) ? false : (seen.add(k), true); });
}

// Ficheiro (.xml ou .xml.gz) → texto
export async function readMalFile(file) {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") throw new Error("Este navegador não consegue abrir ficheiros .gz. Descompacta o ficheiro e escolhe o .xml.");
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return new TextDecoder("utf-8").decode(u8);
}

// Entradas do MAL + media do AniList (com idMal) → itens da biblioteca
export function buildMalItems(entries, mediaByKey) {
  const items = [], missing = [];
  for (const e of entries) {
    const media = mediaByKey[e.type + e.malId];
    if (!media) { missing.push(e); continue; }
    const it = mapAniListEntry({ status: e.status, score: e.score, completedAt: e.finish, media });
    if (it) items.push(it); else missing.push(e);
  }
  const seen = new Set();
  return { items: items.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true))), missing };
}

const QUERY = `query($ids:[Int],$t:MediaType){Page(perPage:50){media(idMal_in:$ids,type:$t){id idMal type title{romaji english native} coverImage{large medium} startDate{year} genres episodes chapters description(asHtml:false) averageScore}}}`;

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body });
  let d = null; try { d = await r.json(); } catch { /* sem JSON */ }
  return { ok: r.ok, status: r.status, d };
}

// Procura no AniList os títulos do MAL (50 de cada vez). onProgress(feitos, total).
export async function resolveMalEntries(entries, { workerUrl, onProgress } = {}) {
  const urls = ["https://graphql.anilist.co", ...(workerUrl ? [workerUrl.replace(/\/$/, "") + "/anilist"] : [])];
  const mediaByKey = {};
  let done = 0;
  for (const type of ["ANIME", "MANGA"]) {
    const ids = entries.filter(e => e.type === type).map(e => e.malId);
    for (let i = 0; i < ids.length; i += 50) {
      const body = JSON.stringify({ query: QUERY, variables: { ids: ids.slice(i, i + 50), t: type } });
      let res = null;
      for (let attempt = 0; attempt < 3 && !(res && res.d?.data?.Page); attempt++) {
        for (const url of urls) {
          try { res = await post(url, body); } catch { res = null; }
          if (res?.d?.data?.Page) break;
        }
        if (res?.status === 429) await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
        else if (!res?.d?.data?.Page && attempt < 2) await new Promise(r => setTimeout(r, 1200));
      }
      if (!res) throw new Error("Não consegui ligar ao AniList. Verifica a ligação e tenta outra vez.");
      if (res.status === 429) throw new Error("O AniList pediu para abrandar. Espera um minuto e tenta outra vez.");
      const page = res.d?.data?.Page;
      if (!page) throw new Error("O AniList não respondeu como esperado. Tenta outra vez dentro de instantes.");
      for (const m of page.media || []) if (m.idMal) mediaByKey[type + m.idMal] = m;
      done += Math.min(50, ids.length - i);
      onProgress && onProgress(done, entries.length);
    }
  }
  return mediaByKey;
}
