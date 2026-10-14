// Imagens grandes (capas personalizadas, fundos) vão para o Supabase Storage;
// na base de dados fica só o URL curto. Reutiliza o bucket "profile-images".
import { supa } from '../config/supabase';

let _uid = null;
export const setImageUser = (id) => { _uid = id || null; };
export const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:image');

// Nome do ficheiro = hash do conteúdo → a mesma imagem nunca é enviada duas vezes
async function sha1(blob) {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Envia uma imagem base64 e devolve o URL público. Lança erro se falhar (nunca devolve um URL por confirmar).
export async function uploadDataUrl(dataUrl, userId = _uid) {
  if (!userId) throw new Error('sem utilizador');
  if (!isDataUrl(dataUrl)) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  return supa.uploadImage(userId, blob, `img-${await sha1(blob)}.${ext}`);
}

// Para novos uploads: tenta o Storage; se falhar mantém o base64 (a migração tenta mais tarde)
export async function persistImage(dataUrl) {
  if (!isDataUrl(dataUrl) || !_uid) return dataUrl;
  try { return await uploadDataUrl(dataUrl); } catch (e) { console.warn('[TrackAll] upload falhou, a manter local:', e?.message || e); return dataUrl; }
}
