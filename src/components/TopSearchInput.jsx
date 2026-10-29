import { useState, useEffect, useRef } from "react";

// Caixa de pesquisa da barra de topo. O texto vive aqui (estado local), por isso cada tecla só renderiza este componente;
// o App recebe o texto com um pequeno atraso (debounce) em vez de re-renderizar a árvore inteira a cada letra.
export function TopSearchInput({ value, onValue, onSubmit, onEscape, autoFocus, placeholder, style }) {
  const [q, setQ] = useState(value || "");
  const timer = useRef(0);
  const last = useRef(value || "");
  // mudanças vindas de fora (ex.: clicar numa pesquisa do histórico) entram na caixa
  useEffect(() => { if ((value || "") !== last.current) { last.current = value || ""; setQ(value || ""); } }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { last.current = v; onValue(v); }, 220);
  };
  return (
    <input
      value={q}
      autoFocus={autoFocus}
      onChange={(e) => change(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer.current); last.current = q; onValue(q); onSubmit(q); }
        else if (e.key === "Escape") onEscape && onEscape();
      }}
      placeholder={placeholder}
      style={style}
    />
  );
}
