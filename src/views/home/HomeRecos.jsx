import { useTheme } from "../../contexts/ThemeContext";
import { useLang } from "../../contexts/LangContext";
import { RecoCarousel } from "../../components/RecoCarousel";
import { HomeSection } from "./HomeSection";

// «Em Destaque»: Para Ti + tendências por tipo.
export function HomeRecos({ recos, personalRecos, recoLoading, loadRecos, library, setSelectedItem }) {
  const { isMobileDevice } = useTheme();
  const { lang, useT } = useLang();
  const pad = isMobileDevice ? 16 : 24;
  return (
    <div style={{ padding: `0 ${pad}px 8px` }}>
      <HomeSection title={lang === "en" ? "Featured" : "Em Destaque"} action={recoLoading ? useT("loading") : `↻ ${useT("refresh")}`} onAction={() => { if (!recoLoading) loadRecos(true); }} style={{ padding: "0 0 4px" }} />
      <div style={{ margin: `0 -${pad}px` }}>
        <RecoCarousel title={lang === "en" ? "For You" : "Para Ti"} icon="✦" items={personalRecos} library={library} onOpen={setSelectedItem} loading={recoLoading} isPersonal={true} />
        <RecoCarousel title={useT("animeTrending")} icon="⛩️" items={recos.anime} library={library} onOpen={setSelectedItem} loading={recoLoading} />
        <RecoCarousel title={useT("mangaTrending")} icon="📖" items={recos.manga} library={library} onOpen={setSelectedItem} loading={recoLoading} />
        <RecoCarousel title={useT("moviesWeek")} icon="🎬" items={recos.filmes} library={library} onOpen={setSelectedItem} loading={recoLoading} />
        <RecoCarousel title={useT("seriesWeek")} icon="📺" items={recos.series} library={library} onOpen={setSelectedItem} loading={recoLoading} />
        <RecoCarousel title={useT("topGames")} icon="🎮" items={recos.jogos} library={library} onOpen={setSelectedItem} loading={recoLoading} />
      </div>
    </div>
  );
}
