import { useEffect, useState } from "react";

// Dicas discretas de PWA: «sem ligação» e convite a instalar a app (uma vez, dispensável).
const DISMISS_KEY = "trackall_install_dismissed";
const VISITS_KEY = "trackall_visits";

const isStandalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "") && !window.MSStream;

export function PwaHints({ accent, darkMode, lang, isMobile }) {
  const en = lang === "en";
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [deferred, setDeferred] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false, visits = 0;
    try {
      dismissed = !!localStorage.getItem(DISMISS_KEY);
      visits = (Number(localStorage.getItem(VISITS_KEY)) || 0) + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
    } catch { /* noop */ }
    if (dismissed || visits < 3) return; // só a partir da 3.ª visita
    const h = (e) => { e.preventDefault(); setDeferred(e); setHidden(false); };
    window.addEventListener("beforeinstallprompt", h);
    if (isIOS()) { setShowIos(true); setHidden(false); }
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ } };
  const install = async () => {
    if (!deferred) return;
    try { deferred.prompt(); await deferred.userChoice; } catch { /* noop */ }
    setDeferred(null); dismiss();
  };

  const bar = { position: "fixed", left: 12, right: 12, zIndex: 9000, margin: "0 auto", maxWidth: 420, display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px 10px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
    background: darkMode ? "#161b22" : "#ffffff", color: darkMode ? "#e6edf3" : "#0f172a", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}` };
  const btn = { padding: "6px 12px", borderRadius: 9, border: "none", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5, cursor: "pointer" };

  return (
    <>
      {offline && (
        <div role="status" style={{ ...bar, top: "calc(10px + env(safe-area-inset-top, 0px))", justifyContent: "center", background: "#f59e0b", color: "#1a1a1a", border: "none", padding: "8px 14px" }}>
          {en ? "No connection — your library still works, changes sync later" : "Sem ligação — a biblioteca continua a funcionar"}
        </div>
      )}
      {!hidden && !offline && (deferred || showIos) && (
        <div role="dialog" style={{ ...bar, bottom: isMobile ? "calc(92px + env(safe-area-inset-bottom, 0px))" : 20 }}>
          <span style={{ flex: 1, lineHeight: 1.35 }}>
            {deferred
              ? (en ? "Install TrackAll for faster, full-screen access" : "Instala o TrackAll para abrir mais rápido e em ecrã inteiro")
              : (en ? "Add to Home Screen: tap Share, then “Add to Home Screen”" : "Adicionar ao ecrã inicial: toca em Partilhar e depois «Adicionar ao ecrã principal»")}
          </span>
          {deferred && <button onClick={install} style={{ ...btn, background: accent, color: "#fff" }}>{en ? "Install" : "Instalar"}</button>}
          <button onClick={dismiss} aria-label="close" style={{ ...btn, background: "transparent", color: "#8b949e", padding: "6px 8px", fontSize: 16 }}>✕</button>
        </div>
      )}
    </>
  );
}
