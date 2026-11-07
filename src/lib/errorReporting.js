// Monitorização de erros (opcional). Só liga se existir VITE_SENTRY_KEY (a «public key» do projeto Sentry,
// a parte antes de ".min.js" no «Loader Script»). Sem chave não faz nada e não carrega nenhum script.
// Além disso guarda localmente os últimos erros (window.__trackallErrors) para ajudar a diagnosticar.
let started = false;

export function initErrorReporting() {
  if (started || typeof window === "undefined") return;
  started = true;
  const log = (kind, msg) => {
    try {
      const arr = (window.__trackallErrors = window.__trackallErrors || []);
      arr.push({ t: new Date().toISOString(), kind, msg: String(msg).slice(0, 300) });
      if (arr.length > 20) arr.shift();
    } catch { /* noop */ }
  };
  window.addEventListener("error", (e) => log("error", e?.message || e));
  window.addEventListener("unhandledrejection", (e) => log("promise", e?.reason?.message || e?.reason));

  let key = "";
  try { key = import.meta.env?.VITE_SENTRY_KEY || ""; } catch { /* noop */ }
  if (!key || !/^[a-z0-9]{16,64}$/i.test(key)) return;
  const s = document.createElement("script");
  // Conta na UE → js-de.sentry-cdn.com (conta nos EUA: js.sentry-cdn.com). Dá para mudar com VITE_SENTRY_HOST.
  let host = "js-de.sentry-cdn.com";
  try { const h = import.meta.env?.VITE_SENTRY_HOST; if (h && /^js(-[a-z]+)?\.sentry-cdn\.com$/.test(h)) host = h; } catch { /* noop */ }
  s.src = `https://${host}/${key}.min.js`;
  s.crossOrigin = "anonymous";
  s.async = true;
  document.head.appendChild(s);
}
