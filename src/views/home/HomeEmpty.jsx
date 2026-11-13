import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { HOME_R, homeLine, homeMuted, homeText } from "./homeUtils";

// Biblioteca vazia: passos para começar.
export function HomeEmpty({ setView }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  const steps = [["🔎", lang === "en" ? "Search any title and add it" : "Pesquisa um título e adiciona"],
    ["＋", lang === "en" ? "Use Quick Log to mark what you finished" : "Usa o Log Rápido para marcar o que acabaste"],
    ["⇪", lang === "en" ? "Coming from AniList, Letterboxd or Goodreads? Import in Profile → Settings" : "Vens do AniList, Letterboxd ou Goodreads? Importa em Perfil → Definições"]];
  return (
    <div style={{ margin: "24px auto", maxWidth: 440, padding: 24, textAlign: "center", border: `1px solid ${homeLine(darkMode)}`, borderRadius: HOME_R }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: homeText(darkMode) }}>{lang === "en" ? "Your library is empty" : "A tua biblioteca está vazia"}</h3>
      <p style={{ fontSize: 13, color: homeMuted(darkMode), marginBottom: 16, lineHeight: 1.5 }}>{lang === "en" ? "Start adding anime, movies, games and much more" : "Começa a adicionar animes, filmes, jogos e muito mais"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "0 auto 22px", textAlign: "left" }}>
        {steps.map(([ic, tx]) => (
          <div key={tx} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: homeMuted(darkMode), lineHeight: 1.4 }}>
            <span style={{ width: 26, height: 26, borderRadius: HOME_R, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${accent}55`, color: accent, fontWeight: 800 }}>{ic}</span><span>{tx}</span>
          </div>
        ))}
      </div>
      <button className="btn-accent" style={{ padding: "11px 26px", fontSize: 14, borderRadius: HOME_R }} onClick={() => setView("search")}>
        {lang === "en" ? "+ Explore titles" : "+ Explorar títulos"}
      </button>
    </div>
  );
}
