import { useState, useRef, useLayoutEffect } from "react";
import { hiRes } from "../lib/utils";

// Imagem de capa com esqueleto: mostra um brilho enquanto carrega e aparece com fade.
// O elemento pai tem de ter position: relative (todos os cartões de capa já têm).
// hi: pede a versão de maior resolução (TMDB/IGDB/AniList) e, se falhar, volta ao URL original.
export function CoverImg({ src, hi = false, style, onLoad, onError, ...rest }) {
  const [state, setState] = useState("loading");
  const [useOrig, setUseOrig] = useState(false);
  const ref = useRef(null);
  const shown = hi && !useOrig ? hiRes(src) : src;

  useLayoutEffect(() => { setUseOrig(false); }, [src]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.complete) setState(el.naturalWidth > 0 ? "ok" : "error");
    else setState("loading");
  }, [shown]);

  return (
    <>
      {state === "loading" && <span className="sk-cover" aria-hidden="true" />}
      <img
        ref={ref}
        src={shown}
        {...rest}
        onLoad={(e) => { setState("ok"); if (onLoad) onLoad(e); }}
        onError={(e) => { if (hi && !useOrig && shown !== src) { setUseOrig(true); return; } setState("error"); if (onError) onError(e); }}
        style={{ ...style, opacity: state === "loading" ? 0 : 1, transition: "opacity 0.3s ease" }}
      />
    </>
  );
}
