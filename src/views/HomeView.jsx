import { useTheme } from "../contexts/ThemeContext";
import { HomeHero } from "./home/HomeHero";
import { HomeStatsStrip } from "./home/HomeStatsStrip";
import { HomeQuickPicks } from "./home/HomeQuickPicks";
import { HomeEmpty } from "./home/HomeEmpty";
import { HomeRows } from "./home/HomeRows";
import { HomeWhenToConsume } from "./home/HomeWhenToConsume";
import { HomeGraveyard } from "./home/HomeGraveyard";
import { HomeInsights } from "./home/HomeInsights";
import { HomeRecos } from "./home/HomeRecos";
import { HomeFriendsFeed } from "../components/HomeFriendsFeed";

// ─── Vista Home (dashboard) ───
// O estado e os cálculos (stats, homeDashboard, recos...) vivem no TrackAll; esta vista só os compõe.
// Cada bloco vive em views/home/ (um ficheiro por secção). Tokens visuais em views/home/homeUtils.js (HOME_R, linhas, cores).
export function HomeView({ onOpenFriendItem, onOpenFriend, view, setView, profile, user, items, library, setLibrary, stats, homeStatColors, homeDashboard, homeFilter, setHomeFilter, graveyardOpen, setGraveyardOpen, recos, personalRecos, recoLoading, loadRecos, setFilterStatus, setSelectedItem }) {
  const { isMobileDevice } = useTheme();
  const hasItems = items.length > 0;
  const pad = isMobileDevice ? 16 : 24;
  const hasQuick = hasItems && homeDashboard.quickPicks.length > 0;
  return (
    <div style={{ display: view === "home" ? "block" : "none" }}>
      <div>
        <HomeHero profile={profile} items={items} stats={stats} homeStatColors={homeStatColors} homeFilter={homeFilter} setHomeFilter={setHomeFilter} />
        {hasItems && isMobileDevice && <HomeStatsStrip items={items} stats={stats} homeStatColors={homeStatColors} />}
        {hasQuick && <HomeQuickPicks items={items} homeDashboard={homeDashboard} personalRecos={personalRecos} setSelectedItem={setSelectedItem} />}
        {!hasItems && <HomeEmpty setView={setView} />}
        {hasItems && <HomeRows items={items} library={library} homeFilter={homeFilter} setView={setView} setFilterStatus={setFilterStatus} setSelectedItem={setSelectedItem} />}
        <style>{`.home-feed-wrap:empty{display:none}`}</style>
        <div className="home-feed-wrap" style={{ padding: `0 ${pad}px 28px` }}>
          <HomeFriendsFeed user={user} onOpenItem={onOpenFriendItem} onOpenFriend={onOpenFriend} onSeeAll={() => setView("friends")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))", gap: isMobileDevice ? 28 : 32, padding: `0 ${pad}px 28px`, alignItems: "stretch" }}>
          <HomeWhenToConsume embedded items={items} setSelectedItem={setSelectedItem} setView={setView} setFilterStatus={setFilterStatus} />
          <HomeGraveyard embedded items={items} user={user} setLibrary={setLibrary} graveyardOpen={graveyardOpen} setGraveyardOpen={setGraveyardOpen} setSelectedItem={setSelectedItem} />
        </div>
        <HomeInsights items={items} />
        <HomeRecos recos={recos} personalRecos={personalRecos} recoLoading={recoLoading} loadRecos={loadRecos} library={library} setSelectedItem={setSelectedItem} />
      </div>
    </div>
  );
}
