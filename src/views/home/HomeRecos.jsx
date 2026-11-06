import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { accentShade } from "../../config/theme";
import { RecoCarousel } from "../../components/RecoCarousel";

// «Em Destaque»: Para Ti + tendências por tipo.
export function HomeRecos({ recos, personalRecos, recoLoading, loadRecos, library, setSelectedItem }) {
  const { accent } = useTheme();
  const { lang, useT } = useLang();
  return (
    <div style={{ paddingBottom: 8 }}>
      <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", backgroundImage: `linear-gradient(90deg, ${accent}, ${accentShade(accent, 40)})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{lang === "en" ? "Featured" : "Em Destaque"}</h3>
        <button onClick={() => loadRecos(true)} disabled={recoLoading} style={{
          background: "none", border: "none", color: recoLoading ? "#484f58" : accent,
          cursor: recoLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
          fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: 0,
        }}>
          <span style={{ display: "inline-block", animation: recoLoading ? "spin 0.7s linear infinite" : "none", fontSize: 14 }}>↻</span>
          {recoLoading ? useT("loading") : useT("refresh")}
        </button>
      </div>
      <RecoCarousel title={lang === "en" ? "For You" : "Para Ti"} icon="✦" items={personalRecos} library={library} onOpen={setSelectedItem} loading={recoLoading} isPersonal={true} />
      <RecoCarousel title={useT("animeTrending")} icon="⛩️" items={recos.anime} library={library} onOpen={setSelectedItem} loading={recoLoading} />
      <RecoCarousel title={useT("mangaTrending")} icon="📖" items={recos.manga} library={library} onOpen={setSelectedItem} loading={recoLoading} />
      <RecoCarousel title={useT("moviesWeek")} icon="🎬" items={recos.filmes} library={library} onOpen={setSelectedItem} loading={recoLoading} />
      <RecoCarousel title={useT("seriesWeek")} icon="📺" items={recos.series} library={library} onOpen={setSelectedItem} loading={recoLoading} />
      <RecoCarousel title={useT("topGames")} icon="🎮" items={recos.jogos} library={library} onOpen={setSelectedItem} loading={recoLoading} />
    </div>
  );
}
