import { useState, useRef, useLayoutEffect } from "react";

// Imagem de capa com esqueleto: mostra um brilho enquanto carrega e aparece com fade.
// O elemento pai tem de ter position: relative (todos os cartões de capa já têm).
export function CoverImg({ src, style, onLoad, onError, ...rest }) {
  const [state, setState] = useState("loading");
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.complete) setState(el.naturalWidth > 0 ? "ok" : "error");
    else setState("loading");
  }, [src]);

  return (
    <>
      {state === "loading" && <span className="sk-cover" aria-hidden="true" />}
      <img
        ref={ref}
        src={src}
        {...rest}
        onLoad={(e) => { setState("ok"); if (onLoad) onLoad(e); }}
        onError={(e) => { setState("error"); if (onError) onError(e); }}
        style={{ ...style, opacity: state === "loading" ? 0 : 1, transition: "opacity 0.3s ease" }}
      />
    </>
  );
}
