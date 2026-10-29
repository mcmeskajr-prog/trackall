import { useMemo, useCallback } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import { LangContext } from "../contexts/LangContext";
import { t } from "../translations";

// Os valores dos contextos só mudam quando um dos campos muda de facto. Antes eram objetos novos a cada render do App
// (e o App renderiza a cada tecla na pesquisa, aviso, etc.), o que acordava todos os componentes que usam useTheme()/useLang().
export function ThemeBridge({ accent, bg, darkMode, panelDark, isMobileDevice, panelBg, setFriendTheme, children }) {
  const value = useMemo(() => ({ accent, bg, darkMode, panelDark, isMobileDevice, panelBg, setFriendTheme }), [accent, bg, darkMode, panelDark, isMobileDevice, panelBg, setFriendTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function LangBridge({ lang, children }) {
  const useT = useCallback((key) => t(key, lang), [lang]);
  const value = useMemo(() => ({ lang, useT }), [lang, useT]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
