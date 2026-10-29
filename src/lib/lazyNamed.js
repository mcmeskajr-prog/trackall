import { lazy } from "react";

// Carrega um componente só quando é preciso (code splitting). Os nossos componentes são exports nomeados,
// por isso o React.lazy precisa de { default }.  Uso: const X = lazyNamed(() => import("./X"), "X");
// Cada sítio onde se usa tem de estar dentro de <Suspense fallback={null}> (só esconde o próprio modal enquanto carrega).
export const lazyNamed = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

// Descarrega um pedaço em segundo plano, quando o browser está parado, para o primeiro clique ser instantâneo.
export const prefetchIdle = (...loaders) => {
  const run = () => loaders.forEach((l) => { try { l().catch(() => {}); } catch { /* ignora */ } });
  if (typeof window === "undefined") return;
  if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
};
