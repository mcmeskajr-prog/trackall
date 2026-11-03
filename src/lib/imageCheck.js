// Validação central de imagens enviadas pelo utilizador (avatar, banner, fundo, capas).
// Corre ANTES de ler/comprimir o ficheiro; o servidor-lado (supa.uploadImage) repete o limite como rede de segurança.
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;      // ficheiro original (as imagens são reduzidas antes de enviar)
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;      // o que realmente vai para o Storage
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const isEn = () => { try { return (localStorage.getItem("trackall_lang") || (navigator.language?.startsWith("pt") ? "pt" : "en")) === "en"; } catch { return false; } };

// Devolve null se estiver OK, ou a mensagem de erro (já traduzida)
export function imageProblem(file) {
  const en = isEn();
  if (!file) return en ? "No file selected" : "Nenhum ficheiro escolhido";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return en ? "Unsupported format. Use JPG, PNG, WebP or GIF." : "Formato não suportado. Usa JPG, PNG, WebP ou GIF.";
  if (file.size > MAX_IMAGE_BYTES) return en ? `Image too large (max ${MAX_IMAGE_BYTES / 1048576} MB).` : `Imagem demasiado grande (máx. ${MAX_IMAGE_BYTES / 1048576} MB).`;
  return null;
}

// Usa-se nos handlers: `const f = pickImage(e); if (!f) return;`
// Limpa o input e, se for inválida, avisa o utilizador (o App mostra a notificação).
export function pickImage(e) {
  const f = e?.target?.files?.[0];
  if (e?.target) { try { if (!f || imageProblem(f)) e.target.value = ""; } catch { /* noop */ } }
  if (!f) return null;
  const msg = imageProblem(f);
  if (msg) { try { window.dispatchEvent(new CustomEvent("trackall-notice", { detail: { message: msg, error: true } })); } catch { /* noop */ } return null; }
  return f;
}
