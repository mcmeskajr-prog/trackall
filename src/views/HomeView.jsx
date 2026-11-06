import { HomeHero } from "./home/HomeHero";
import { HomeStatsStrip } from "./home/HomeStatsStrip";
import { HomeQuickPicks } from "./home/HomeQuickPicks";
import { HomeEmpty } from "./home/HomeEmpty";
import { HomeRows } from "./home/HomeRows";
import { HomeWhenToConsume } from "./home/HomeWhenToConsume";
import { HomeGraveyard } from "./home/HomeGraveyard";
import { HomeInsights } from "./home/HomeInsights";
import { HomeRecos } from "./home/HomeRecos";

// ─── Vista Home (dashboard) ───
// O estado e os cálculos (stats, homeDashboard, recos...) vivem no TrackAll; esta vista só os compõe.
// Cada bloco vive em views/home/ (um ficheiro por secção).
export function HomeView({ onOpenFriendItem, onOpenFriend, view, setView, profile, user, items, library, setLibrary, stats, homeStatColors, homeDashboard, homeFilter, setHomeFilter, graveyardOpen, setGraveyardOpen, recos, personalRecos, recoLoading, loadRecos, setFilterStatus, setSelectedItem }) {
  const hasItems = items.length > 0;
  return (
    <div style={{ display: view === "home" ? "block" : "none" }}>
      <div style={{ paddingLeft: 0, paddingRight: 0 }}>
        <HomeHero profile={profile} items={items} stats={stats} homeStatColors={homeStatColors} homeFilter={homeFilter} setHomeFilter={setHomeFilter} />
        {hasItems && <HomeStatsStrip items={items} />}
        {hasItems && homeDashboard.quickPicks.length > 0 && <HomeQuickPicks items={items} homeDashboard={homeDashboard} personalRecos={personalRecos} setSelectedItem={setSelectedItem} />}
        {!hasItems && <HomeEmpty setView={setView} />}
        {hasItems && <HomeRows items={items} library={library} user={user} homeFilter={homeFilter} setView={setView} setFilterStatus={setFilterStatus} setSelectedItem={setSelectedItem} onOpenFriendItem={onOpenFriendItem} onOpenFriend={onOpenFriend} />}
        <HomeWhenToConsume items={items} setSelectedItem={setSelectedItem} />
        <HomeGraveyard items={items} user={user} setLibrary={setLibrary} graveyardOpen={graveyardOpen} setGraveyardOpen={setGraveyardOpen} setSelectedItem={setSelectedItem} />
        <div style={{ borderTop: "1px solid #21262d", margin: "0 16px 28px" }} />
        <HomeInsights items={items} />
        <HomeRecos recos={recos} personalRecos={personalRecos} recoLoading={recoLoading} loadRecos={loadRecos} library={library} setSelectedItem={setSelectedItem} />
      </div>
    </div>
  );
}
