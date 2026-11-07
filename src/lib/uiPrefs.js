// Preferências de interface guardadas neste dispositivo (localStorage) e partilhadas entre componentes
// sem passar props: quem muda uma preferência avisa os outros através de um evento.
import { useCallback, useEffect, useState } from "react";

export const UI_PREF_DEFAULTS = {
  trackall_sidebar_mode: "auto",   // auto | glass | solid | clear   («auto»: vidro com imagem de fundo, sólida sem imagem)
  trackall_sidebar_glass: "55",    // 0–100: intensidade do vidro
  trackall_profile_layout: "new",  // new (banner + duas colunas) | classic — só no PC
  trackall_top_accent: "profile",  // profile (brilho no Perfil + linha nas outras) | all (como antes) | none
};

const EVT = "trackall-ui-pref";

export function readUiPref(key) {
  try { const v = localStorage.getItem(key); return v == null ? UI_PREF_DEFAULTS[key] : v; } catch { return UI_PREF_DEFAULTS[key]; }
}

export function useUiPref(key) {
  const [val, setVal] = useState(() => readUiPref(key));
  useEffect(() => {
    const h = (e) => { if (!e.detail || e.detail.key === key) setVal(readUiPref(key)); };
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, [key]);
  const set = useCallback((v) => {
    try { localStorage.setItem(key, String(v)); } catch { /* noop */ }
    setVal(String(v));
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { key } })); } catch { /* noop */ }
  }, [key]);
  return [val, set];
}
