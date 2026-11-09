import { lazy } from "react";

// Carrega um componente só quando é preciso (code splitting). Os nossos componentes são exports nomeados,
// por isso o React.lazy precisa de { default }.  Uso: const X = lazyNamed(() => import("./X"), "X");
// Cada sítio onde se usa tem de estar dentro de <Suspense fallback={null}> (só esconde o próprio modal enquanto carrega).
// Se o pedaço já não existe (saiu uma versão nova e esta página ainda aponta para o antigo), recarrega uma vez para apanhar a versão nova.
const loadFresh = (loader) => loader().catch((err) => {
  try {
    const k = "trackall_chunk_reload";
    const last = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - last > 15000) {
      sessionStorage.setItem(k, String(Date.now()));
      if (navigator.serviceWorker?.getRegistrations) navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.update().catch(() => {})))).finally(() => window.location.reload());
      else window.location.reload();
      return new Promise(() => {}); // fica à espera enquanto a página recarrega
    }
  } catch { /* ignora */ }
  throw err;
});
export const lazyNamed = (loader, name) => lazy(() => loadFresh(loader).then((m) => ({ default: m[name] })));

// Descarrega um pedaço em segundo plano, quando o browser está parado, para o primeiro clique ser instantâneo.
export const prefetchIdle = (...loaders) => {
  const run = () => loaders.forEach((l) => { try { l().catch(() => {}); } catch { /* ignora */ } });
  if (typeof window === "undefined") return;
  if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
};
