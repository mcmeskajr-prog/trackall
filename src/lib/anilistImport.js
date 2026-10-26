// ─── Importar a lista de um utilizador do AniList ───
// Funções puras (mapeamento, testáveis) + o pedido GraphQL. Sem React.
import { normalizeMediaId } from "./mediaIds";

const STATUS = {
  CURRENT: "assistindo", REPEATING: "assistindo", COMPLETED: "completo",
  PAUSED: "pausado", DROPPED: "dropado", PLANNING: "planejado",
};

// Nota do AniList (0–10, com decimais) → escala da app (meias estrelas, 0–10)
export const toAppRating = (score) => {
  const n = Number(score);
  if (!n || n <= 0) return 0;
  return Math.min(10, Math.round(n * 2) / 2);
};

// { year, month, day } → timestamp (meio-dia local). Só aceita datas completas: parciais contam como "sem data".
export const fuzzyDateToMs = (d) => {
  if (!d || !d.year || !d.month || !d.day) return null;
  const t = new Date(d.year, d.month - 1, d.day, 12).getTime();
  return Number.isFinite(t) ? t : null;
};

// Uma entrada da lista do AniList → item da biblioteca (mesma forma dos itens vindos da pesquisa)
export function mapAniListEntry(entry) {
  const m = entry?.media;
  if (!m || !m.id) return null;
  const type = m.type === "ANIME" ? "anime" : "manga";
  const userStatus = STATUS[entry.status] || "planejado";
  const doneAt = userStatus === "completo" ? fuzzyDateToMs(entry.completedAt) : null;
  return {
    id: normalizeMediaId(`al-${type}-${m.id}`, type),
    title: m.title?.english || m.title?.romaji || m.title?.native || "",
    titleEn: m.title?.english || "",
    cover: m.coverImage?.large || m.coverImage?.medium || "",
    type,
    year: String(m.startDate?.year || ""),
    score: m.averageScore ? +(m.averageScore / 10).toFixed(1) : null,
    synopsis: (m.description || "").replace(/<[^>]*>/g, "").slice(0, 220),
    genres: (m.genres || []).slice(0, 4),
    source: "AniList",
    episodes: m.episodes || null,
    chapters: m.chapters || null,
    userStatus,
    userRating: toAppRating(entry.score),
    ...(doneAt ? { addedAt: doneAt } : {}),
  };
}

// Várias listas (a "Completed", "Watching"…, mais as personalizadas) → itens sem repetidos
export function mapAniListLists(lists) {
  const seen = new Set(), out = [];
  for (const l of lists || []) {
    if (l?.isCustomList) continue; // as listas personalizadas repetem entradas das normais
    for (const e of l?.entries || []) {
      const it = mapAniListEntry(e);
      if (it && !seen.has(it.id)) { seen.add(it.id); out.push(it); }
    }
  }
  return out;
}

const QUERY = `query($u:String,$t:MediaType,$c:Int){MediaListCollection(userName:$u,type:$t,chunk:$c,perChunk:500){hasNextChunk lists{isCustomList entries{status score(format:POINT_10_DECIMAL) completedAt{year month day} media{id type title{romaji english native} coverImage{large medium} startDate{year} genres episodes chapters description(asHtml:false) averageScore}}}}}`;

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body });
  let d = null; try { d = await r.json(); } catch { /* resposta sem JSON */ }
  return { ok: r.ok, status: r.status, d };
}

// Lê a lista completa (anime + manga) de um utilizador público. Lança Error com mensagem legível.
export async function fetchAniListUser(username, { workerUrl, types = ["ANIME", "MANGA"] } = {}) {
  const user = String(username || "").trim().replace(/^@/, "");
  if (!user) throw new Error("Escreve o teu nome de utilizador do AniList.");
  const urls = ["https://graphql.anilist.co", ...(workerUrl ? [workerUrl.replace(/\/$/, "") + "/anilist"] : [])];
  const all = [];
  for (const t of types) {
    for (let chunk = 1; chunk <= 12; chunk++) {
      const body = JSON.stringify({ query: QUERY, variables: { u: user, t, c: chunk } });
      let res = null;
      for (const url of urls) {
        try { res = await post(url, body); } catch { res = null; }
        if (res && (res.d?.data?.MediaListCollection || res.status === 404 || res.status === 429)) break;
      }
      if (!res) throw new Error("Não consegui ligar ao AniList. Verifica a ligação e tenta outra vez.");
      if (res.status === 404 || res.d?.errors?.some(e => e.status === 404)) throw new Error(`Não encontrei o utilizador "${user}" no AniList (ou a lista é privada).`);
      if (res.status === 429) throw new Error("O AniList pediu para abrandar. Espera um minuto e tenta outra vez.");
      const col = res.d?.data?.MediaListCollection;
      if (!col) throw new Error("O AniList não devolveu a lista. Tenta outra vez dentro de instantes.");
      all.push(...mapAniListLists(col.lists));
      if (!col.hasNextChunk) break;
    }
  }
  // o mesmo id nunca aparece duas vezes (anime e manga têm ids diferentes)
  const seen = new Set();
  return all.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
