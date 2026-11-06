import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";

// Biblioteca vazia: passos para começar.
export function HomeEmpty({ setView }) {
  const { accent, darkMode } = useTheme();
  const { lang } = useLang();
  return (
    <div style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🎬</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: darkMode ? "#e6edf3" : "#0d1117" }}>{lang === "en" ? "Your library is empty" : "A tua biblioteca está vazia"}</h3>
      <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 16, lineHeight: 1.5 }}>{lang === "en" ? "Start adding anime, movies, games and much more" : "Começa a adicionar animes, filmes, jogos e muito mais"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320, margin: "0 auto 22px", textAlign: "left" }}>
        {[["🔎", lang === "en" ? "Search any title and add it" : "Pesquisa um título e adiciona"],
          ["＋", lang === "en" ? "Use Quick Log to mark what you finished" : "Usa o Log Rápido para marcar o que acabaste"],
          ["⇪", lang === "en" ? "Coming from AniList, Letterboxd or Goodreads? Import in Profile → Settings" : "Vens do AniList, Letterboxd ou Goodreads? Importa em Perfil → Definições"]].map(([ic, tx]) => (
          <div key={tx} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: "#8b949e", lineHeight: 1.4 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}1f`, color: accent, fontWeight: 800 }}>{ic}</span><span>{tx}</span>
          </div>
        ))}
      </div>
      <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 14, borderRadius: 12 }} onClick={() => setView("search")}>
        {lang === "en" ? "+ Explore titles" : "+ Explorar títulos"}
      </button>
    </div>
  );
}
