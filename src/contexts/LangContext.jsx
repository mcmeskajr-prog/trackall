import { createContext, useContext } from "react";
import { STRINGS } from "../translations";

// Safety fallback for lang
let _globalLang = (() => { try { return localStorage.getItem("trackall_lang") || (navigator.language?.startsWith("pt") ? "pt" : "en"); } catch { return "en"; } })();

// ── Lang Context (temporary until fully refactored) ────────────────────────
const _safeT = (k) => { try { const s = STRINGS?.[_globalLang]; return s?.[k] ?? STRINGS?.["en"]?.[k] ?? k; } catch { return k; } };
export const LangContext = createContext({ lang: _globalLang, useT: _safeT });
export const useLang = () => { const ctx = useContext(LangContext); return ctx ?? { lang: _globalLang, useT: _safeT }; };
