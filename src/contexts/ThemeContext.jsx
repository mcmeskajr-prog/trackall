import { createContext, useContext } from "react";

// ── Theme Context (temporary until fully refactored) ────────────────────────
export const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);
export const useAccent = () => useContext(ThemeContext)?.accent ?? "#f97316";
export const useDarkMode = () => useContext(ThemeContext)?.darkMode ?? true;
export const useIsMobile = () => useContext(ThemeContext)?.isMobileDevice ?? false;
