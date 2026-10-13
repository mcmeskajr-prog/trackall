// Cópia local (IndexedDB) dos dados pesados do arranque — a app abre logo com a última versão
// conhecida e atualiza por baixo. Falha sempre em silêncio: sem cache, tudo funciona como antes.
const DB_NAME = "trackall_cache";
const STORE = "kv";

const open = () => new Promise((resolve, reject) => {
  try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  } catch (e) { reject(e); }
});

const run = async (mode, fn) => {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
};

export const cacheGet = (key) => run("readonly", s => s.get(key)).catch(() => null);
export const cacheSet = (key, value) => run("readwrite", s => s.put(value, key)).catch(() => {});
export const cacheDelete = (key) => run("readwrite", s => s.delete(key)).catch(() => {});
export const cacheClearAll = () => run("readwrite", s => s.clear()).catch(() => {});
