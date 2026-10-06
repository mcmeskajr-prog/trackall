// ─── Parsers de importação (Mihon, Paperback, Letterboxd) ────────────────────
// Lógica pura, sem dependências de React — usados pelos 3 modais de importação.

export async function parseMihonBackup(file) {
  const ab = await file.arrayBuffer();
  let data = new Uint8Array(ab);

  // Gzip decompress
  try {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter();
    const r = ds.readable.getReader();
    w.write(data); w.close();
    const chunks = [];
    while (true) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    data = new Uint8Array(total); let off = 0;
    for (const c of chunks) { data.set(c, off); off += c.length; }
  } catch {}

  // Protobuf parser (supports varint, length-delimited, float32, int64)
  function readVarint(buf, pos) {
    let val = 0, shift = 0;
    while (pos < buf.length) {
      const b = buf[pos++]; val = val + ((b & 0x7F) * Math.pow(2, shift)); shift += 7;
      if (!(b & 0x80)) break;
    }
    return { val, pos };
  }

  function parseMsg(buf, start, end) {
    const fields = {}; let pos = start || 0; const lim = end ?? buf.length;
    while (pos < lim) {
      const tr = readVarint(buf, pos); pos = tr.pos;
      const fn = tr.val >>> 3, wt = tr.val & 7;
      if (!fields[fn]) fields[fn] = [];
      if (wt === 0) {
        const r = readVarint(buf, pos); pos = r.pos; fields[fn].push({ t: 0, v: r.val });
      } else if (wt === 2) {
        const lr = readVarint(buf, pos); pos = lr.pos; const len = lr.val;
        if (pos + len > lim) break;
        const bytes = buf.slice(pos, pos + len); pos += len;
        let str = null; try { str = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {}
        fields[fn].push(str !== null ? { t: 2, bytes, str } : { t: 2, bytes, str: null });
      } else if (wt === 5) {
        // 32-bit float (little-endian)
        if (pos + 4 <= lim) {
          const view = new DataView(buf.buffer, buf.byteOffset + pos, 4);
          fields[fn].push({ t: 5, v: view.getFloat32(0, true) });
        }
        pos += 4;
      } else if (wt === 1) {
        pos += 8; // skip 64-bit
      } else break;
    }
    return fields;
  }

  // Root: field 1 = repeated BackupManga
  const root = parseMsg(data, 0, data.length);
  const mangaEntries = root[1] || [];
  const results = [];

  for (const entry of mangaEntries) {
    if (entry.t !== 2) continue;
    const f = parseMsg(entry.bytes, 0, entry.bytes.length);

    const gs = (n) => f[n]?.[0]?.str || '';
    const gi = (n) => f[n]?.[0]?.v ?? 0;

    const title = gs(3); if (!title) continue;
    const url = gs(2);
    const thumbnailUrl = gs(9);
    // field 111 = isFavorite (1=true)
    const isFavorite = gi(111) === 1;

    // field 16 = repeated BackupChapter
    const chapRaw = f[16] || [];
    const chapters = chapRaw.map(cf => {
      if (cf.t !== 2) return null;
      const ch = parseMsg(cf.bytes, 0, cf.bytes.length);
      const name = ch[2]?.[0]?.str || '';
      // f4=1 means READ (boolean), f6>0 means lastPageRead (partially read)
      const read = (ch[4]?.[0]?.v ?? 0) === 1;
      const lastPage = ch[6]?.[0]?.v ?? 0;
      // f9 = float chapter number (wire type 5)
      const chNum = ch[9]?.[0]?.v ?? -1;
      return { name, read, lastPage, chNum };
    }).filter(Boolean);

    const total = chapters.length;
    const readList = chapters.filter(c => c.read);
    const readCount = readList.length;

    // Last read = highest chapter number among fully read ones
    // fallback to highest with lastPage>0 (partially opened)
    let lastChapter = null;
    if (readList.length > 0) {
      const byNum = [...readList].sort((a, b) => b.chNum - a.chNum);
      lastChapter = byNum[0].name || `Cap. ${Math.round(byNum[0].chNum)}`;
    } else {
      const partial = chapters.filter(c => c.lastPage > 0).sort((a, b) => b.chNum - a.chNum);
      if (partial.length > 0) lastChapter = partial[0].name || `Cap. ${Math.round(partial[0].chNum)}`;
    }

    let userStatus = 'planejado';
    if (readCount > 0 && readCount < total) userStatus = 'assistindo';
    else if (readCount > 0 && total > 0 && readCount >= total) userStatus = 'completo';

    results.push({
      id: `mihon-${url.replace(/[^a-z0-9]/gi, '-')}`,
      title, thumbnailUrl, url, type: 'manga',
      userStatus, chaptersRead: readCount, totalChapters: total,
      lastChapter, source: 'Mihon', cover: thumbnailUrl,
    });
  }
  return results;
}

export async function parsePaperbackBackup(file) {
  // Carregar JSZip dinamicamente
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar JSZip'));
      document.head.appendChild(s);
    });
  }
  const ab = await file.arrayBuffer();
  const zip = await window.JSZip.loadAsync(ab);

  const readJSON = async (name) => {
    const f = zip.file(name); if (!f) return {};
    const txt = await f.async('string'); return JSON.parse(txt);
  };

  const [libData, infoData, srcData, chapData, progData] = await Promise.all([
    readJSON('__LIBRARY_MANGA_V4'),
    readJSON('__MANGA_INFO_V4'),
    readJSON('__SOURCE_MANGA_V4'),
    readJSON('__CHAPTER_V4'),
    readJSON('__CHAPTER_PROGRESS_MARKER_V4-1'),
  ]);

  // sourceId → type mapping
  const sourceTypeMap = {
    ReadAllComics: 'comics', ReadComicsOnline: 'comics',
    MangaPlus: 'manga', Manganato: 'manga', MangaDex: 'manga',
    ReadBerserk: 'manga', ReadJujutsuKaisen: 'manga',
    Webtoons: 'manhwa', TappytoonComics: 'manhwa',
  };
  const guessType = (sid) => {
    if (!sid) return 'manga';
    if (/comic/i.test(sid)) return 'comics';
    if (/webtoon|tappy/i.test(sid)) return 'manhwa';
    return 'manga';
  };

  // Calcular progresso por info_id
  const mangaTotal = {}, mangaCompleted = {};
  for (const ch of Object.values(chapData)) {
    const srcId = ch?.sourceManga?.id;
    const infoId = srcData[srcId]?.mangaInfo?.id;
    if (infoId) mangaTotal[infoId] = (mangaTotal[infoId] || 0) + 1;
  }
  for (const p of Object.values(progData)) {
    const chId = p?.chapter?.id;
    const ch = chapData[chId];
    const srcId = ch?.sourceManga?.id;
    const infoId = srcData[srcId]?.mangaInfo?.id;
    if (infoId && p?.completed) mangaCompleted[infoId] = (mangaCompleted[infoId] || 0) + 1;
  }

  const results = [];
  for (const [, libItem] of Object.entries(libData)) {
    try {
      const srcId = libItem?.primarySource?.id;
      const src = srcData[srcId]; if (!src) continue;
      const infoId = src?.mangaInfo?.id;
      const manga = infoData[infoId]; if (!manga) continue;
      const titles = manga?.titles || []; if (!titles.length) continue;
      const title = titles[0];
      const cover = manga?.image || '';
      const sourceId = src?.sourceId || '';
      const type = sourceTypeMap[sourceId] || guessType(sourceId);
      const total = mangaTotal[infoId] || 0;
      const completed = mangaCompleted[infoId] || 0;
      let userStatus = 'planejado';
      if (completed > 0 && total > 0 && completed >= total) userStatus = 'completo';
      else if (completed > 0) userStatus = 'assistindo';
      // Apple timestamp: segundos desde 2001-01-01 → ms desde 1970-01-01
      const APPLE_EPOCH_OFFSET = 978307200;
      const addedAt = libItem.dateBookmarked
        ? Math.round((libItem.dateBookmarked + APPLE_EPOCH_OFFSET) * 1000)
        : Date.now();
      results.push({ id: `pb-${infoId}`, title, cover, type, userStatus, chaptersRead: completed, totalChapters: total, source: 'Paperback', addedAt });
    } catch {}
  }
  return results;
}

// ─── Letterboxd CSV Parser ────────────────────────────────────────────────────
export function parseLetterboxdCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const nameIdx   = header.findIndex(h => h === 'Name');
  const yearIdx   = header.findIndex(h => h === 'Year');
  const ratingIdx = header.findIndex(h => h === 'Rating');
  const dateIdx   = header.findIndex(h => h === 'Watched Date' || h === 'Date');
  if (nameIdx === -1) return [];

  const parseRow = (line) => {
    // Handle quoted fields with commas
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  };

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
      const fields = parseRow(lines[i]);
      const title = fields[nameIdx]?.replace(/^"|"$/g, '') || ''; if (!title) continue;
      const year  = fields[yearIdx]?.replace(/^"|"$/g, '') || '';
      const ratingRaw = parseFloat(fields[ratingIdx] || '0');
      const rating = isNaN(ratingRaw) ? 0 : Math.round(ratingRaw * 2); // 0.5–5 → 1–10
      const dateStr = fields[dateIdx]?.replace(/^"|"$/g, '') || '';
      const addedAt = dateStr ? new Date(dateStr).getTime() || Date.now() : Date.now();
      results.push({
        id: `lb-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${year}`,
        title, year: parseInt(year) || undefined,
        type: 'filmes', userStatus: 'completo',
        userRating: rating, addedAt, source: 'Letterboxd',
      });
    } catch {}
  }
  return results;
}
