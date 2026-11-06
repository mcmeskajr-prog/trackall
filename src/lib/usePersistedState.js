import { useEffect, useState } from "react";

// useState que se lembra do valor neste dispositivo (localStorage).
// `isValid` protege contra valores antigos/inválidos (ex.: um tipo que já não existe) → cai no `initial`.
export function usePersistedState(key, initial, isValid = () => true) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved != null && isValid(saved) ? saved : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, value); } catch { /* modo privado / cheio: ignora */ }
  }, [key, value]);
  return [value, setValue];
}
