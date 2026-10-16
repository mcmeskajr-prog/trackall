import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync, createPortal } from "react-dom";
import { createClient } from '@supabase/supabase-js';
import { StarRating } from './components/StarRating';
import { AppSkeleton } from './components/Skeleton';
import { Notification } from './components/Notification';
import { MediaCard } from './components/MediaCard';
import { VirtualGrid } from './components/VirtualGrid';
import { TiltCard } from './components/TiltCard';
import { CropModal } from './components/CropModal';
import { CollectionModal } from './components/CollectionModal';
import { CoverEditModal } from './components/CoverEditModal';
import { DetailModal } from './components/DetailModal';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { FriendsView } from './components/FriendsView';
import { FeedTab } from './components/FeedTab';
import { ProfileView } from './components/ProfileView';
import { ProfileTabCompletos } from './components/ProfileTabCompletos';
import { ProfileTabDiario } from './components/ProfileTabDiario';
import { TierListCard } from './components/TierListCard';
import { CollectionCard } from './components/CollectionCard';
import { RecentSection } from './components/RecentSection';
import { CollectionViewer } from './components/CollectionViewer';
import { TierListEditor } from './components/TierListEditor';
import { TierListViewer } from './components/TierListViewer';
import { RatingOverlay } from './components/RatingOverlay';
import { SidebarSearch } from './components/SidebarSearch';
import { MihonImportModal } from './components/MihonImportModal';
import { PaperbackImportModal } from './components/PaperbackImportModal';
import { LetterboxdImportModal } from './components/LetterboxdImportModal';
import { parseMihonBackup, parsePaperbackBackup, parseLetterboxdCSV } from './lib/importParsers';
import { t, detectLang, saveLang } from './translations';
// ─── Config imports ───────────────────────────────────────────────────────────
import { MEDIA_TYPES, STATUS_OPTIONS, TIER_LEVELS, TYPE_COLORS, MONTH_PT, MONTH_EN, mediaLabel, getMediaTypeLabel, statusLabel } from './config/constants';
import { ACCENT_PRESETS, BG_PRESETS, isColorDark, accentShade, accentVariant } from './config/theme';
import { supabase, supa } from './config/supabase';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { HomeView } from './views/HomeView';

// ─── Lib imports ──────────────────────────────────────────────────────────────
import { normalizeMediaId, mediaIdCandidates, findLibraryEntry, normalizeMediaItem } from './lib/mediaIds';
import { getConsumptionTime } from './lib/consumptionTime';
import { shuffle, gradientFor, compressImage } from './lib/utils';
import { cacheGet, cacheSet, cacheClearAll } from './lib/bootCache';
import { setImageUser, isDataUrl, uploadDataUrl } from './lib/imageStore';

// ─── API imports ──────────────────────────────────────────────────────────────
import { searchAniList, fetchAniListSafe, fetchTrendingAnime, fetchTrendingManga } from './api/anilist';
import { searchTMDB, fetchTrendingMovies, fetchTrendingSeries } from './api/tmdb';
import { searchIGDB, searchSteam, fetchTrendingGames } from './api/igdb';
import { searchGoogleBooks } from './api/books';
import { searchComicVine } from './api/comicvine';
import { fetchMediaDetails } from './api/details';
import { fetchPersonalizedRecos } from './api/recommendations';
import { smartSearch, CACHE, cacheKey } from './api/smartSearch';

// ─── Contexts ─────────────────────────────────────────────────────────────────
import { ThemeContext, useTheme, useAccent, useDarkMode, useIsMobile } from './contexts/ThemeContext';
import { LangContext, useLang } from './contexts/LangContext';
import { TypeIcon } from "./components/TypeIcon";

// ─── Configurações padrão ────────────────────────────────────────────────────
const DEFAULT_TMDB_KEY = ""; // Chave movida para o Cloudflare Worker (variável TMDB_KEY)
const DEFAULT_WORKER_URL = "https://trackall-proxy.mcmeskajr.workers.dev";

// Wrapper simples para manter compatibilidade com o resto do código

// ─── Theme Context ────────────────────────────────────────────────────────────
// ─── Storage (Claude artifact + localStorage para APK/Capacitor) ──────────────
const DB = {
  async get(key) {
    // Tenta window.storage (Claude artifact)
    try {
      if (window.storage) {
        const r = await window.storage.get(key);
        if (r?.value != null) return r.value;
      }
    } catch {}
    // Fallback localStorage (APK / browser normal)
    try { return localStorage.getItem(key); } catch {}
    return null;
  },
  async set(key, val) {
    let ok = false;
    // Tenta window.storage primeiro
    try {
      if (window.storage) {
        const result = await window.storage.set(key, val);
        if (result) ok = true;
      }
    } catch {}
    // localStorage sempre (como backup e para APK)
    try { localStorage.setItem(key, val); ok = true; } catch {}
    return ok;
  },
};


function normalizeAniListType(type) {
  if (!type) return "";
  if (type === "ANIME" || type === "anime") return "anime";
  if (type === "MANGA" || type === "manga" || type === "manhwa" || type === "lightnovels") return "manga";
  return "";
}


// ─── APIs ─────────────────────────────────────────────────────────────────────

// 1. AniList — ver src/api/anilist.js (searchAniList, fetchAniListSafe, fetchTrendingAnime, fetchTrendingManga)

// 2. TMDB — ver src/api/tmdb.js (searchTMDB, fetchTrendingMovies, fetchTrendingSeries)

// fetchMediaDetails — ver src/api/details.js
// 3. Google Books — ver src/api/books.js (searchGoogleBooks)

// 4. IGDB, Steam — ver src/api/igdb.js (searchIGDB, searchSteam, fetchTrendingGames)

// 5. ComicVine — ver src/api/comicvine.js (searchComicVine)

// smartSearch, CACHE, cacheKey — ver src/api/smartSearch.js

// ─── Placeholder Gradients ─────────────────────────────────────────────────────
// GRADIENTS, gradientFor — ver src/lib/utils.js
// StarRating — ver components/StarRating.jsx

// Notification — ver components/Notification.jsx

// ─── Image utils ───────────────────────────────────────────────────────────────
// Compresses an image File to a base64 JPEG ≤ 300 KB (portrait 400×600)
// compressImage, compressBanner — ver src/lib/utils.js

// ─── Mihon Backup Parser ──────────────────────────────────────────────────────

// parseMihonBackup — ver lib/importParsers.js
// ─── Google Drive OAuth helper ────────────────────────────────────────────────
// Client ID criado em console.cloud.google.com — o utilizador tem de inserir o seu
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// MihonImportModal — ver components/MihonImportModal.jsx



// CropModal — ver components/CropModal.jsx

// CoverEditModal — ver components/CoverEditModal.jsx
// DetailModal — ver components/DetailModal.jsx
// ─── Media Card ────────────────────────────────────────────────────────────────
// VirtualGrid — ver components/VirtualGrid.jsx

// TiltCard — ver components/TiltCard.jsx

// MediaCard — ver components/MediaCard.jsx

// ─── Profile / Settings View ──────────────────────────────────────────────────

// RecentSection — ver components/RecentSection.jsx
// ─── Tier List Components ─────────────────────────────────────────────────────

// ─── Collection Components ────────────────────────────────────────────────────

// CollectionCard — ver components/CollectionCard.jsx
// CollectionModal — ver components/CollectionModal.jsx


// TierListCard — ver components/TierListCard.jsx


// ProfileTabCompletos — ver components/ProfileTabCompletos.jsx
// ProfileTabDiario — ver components/ProfileTabDiario.jsx
// ProfileView — ver components/ProfileView.jsx
// FeedTab — ver components/FeedTab.jsx
// FriendsView — ver components/FriendsView.jsx
// ─── Auth Screen ──────────────────────────────────────────────────────────────
// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_LIBRARY = {
  "al-1": { id: "al-1", title: "Attack on Titan", type: "anime", userStatus: "completo", userRating: 10, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg", addedAt: Date.now() - 86400000 * 2 },
  "al-2": { id: "al-2", title: "Demon Slayer", type: "anime", userStatus: "assistindo", userRating: 9, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg", addedAt: Date.now() - 86400000 * 4 },
  "al-3": { id: "al-3", title: "Tokyo Ghoul", type: "manga", userStatus: "completo", userRating: 9, cover: "https://cdn.myanimelist.net/images/manga/3/258224l.jpg", addedAt: Date.now() - 86400000 * 6 },
  "al-4": { id: "al-4", title: "Jujutsu Kaisen", type: "anime", userStatus: "planeado", userRating: 0, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg", addedAt: Date.now() - 86400000 * 8 },
  "al-5": { id: "al-5", title: "One Piece", type: "manga", userStatus: "assistindo", userRating: 10, cover: "https://cdn.myanimelist.net/images/manga/2/253146l.jpg", addedAt: Date.now() - 86400000 * 10 },
  "al-6": { id: "al-6", title: "Chainsaw Man", type: "manga", userStatus: "completo", userRating: 9, cover: "https://cdn.myanimelist.net/images/manga/3/216464l.jpg", addedAt: Date.now() - 86400000 * 12 },
  "tmdb-1": { id: "tmdb-1", title: "Oppenheimer", type: "filmes", userStatus: "completo", userRating: 9, cover: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", addedAt: Date.now() - 86400000 * 3 },
  "tmdb-2": { id: "tmdb-2", title: "Breaking Bad", type: "series", userStatus: "completo", userRating: 10, cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", addedAt: Date.now() - 86400000 * 5 },
  "tmdb-3": { id: "tmdb-3", title: "Dune: Part Two", type: "filmes", userStatus: "completo", userRating: 9, cover: "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg", addedAt: Date.now() - 86400000 * 1 },
  "tmdb-4": { id: "tmdb-4", title: "The Last of Us", type: "series", userStatus: "completo", userRating: 10, cover: "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", addedAt: Date.now() - 86400000 * 11 },
  "game-1": { id: "game-1", title: "Elden Ring", type: "jogos", userStatus: "completo", userRating: 10, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg", addedAt: Date.now() - 86400000 * 7 },
  "game-2": { id: "game-2", title: "Hollow Knight", type: "jogos", userStatus: "completo", userRating: 9, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg", addedAt: Date.now() - 86400000 * 14 },
};
// Cor das barras de navegação (topo e fundo): mais escura que o fundo, perto do preto dos modais
const mkNavBg = (dark, bg) => dark
  ? `color-mix(in srgb, color-mix(in srgb, ${bg || "#0d1117"} 22%, #07090c) 96%, transparent)`
  : "rgba(255,255,255,0.96)";
const mixHex = (hex, base, amt) => {
  try {
    const p = (h) => { const x = h.replace("#", ""); const f = x.length === 3 ? x.split("").map(c => c + c).join("") : x; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
    const [a, b] = [p(hex), p(base)];
    return "#" + a.map((v, i) => Math.round(v * amt + b[i] * (1 - amt)).toString(16).padStart(2, "0")).join("");
  } catch { return base; }
};

const DEMO_PROFILE = { name: "Demo User", bio: "A explorar o TrackAll ✨", avatar: "", accent: "#f97316", favorites: [
  { id: "al-1", title: "Attack on Titan", type: "anime", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg" },
  { id: "tmdb-2", title: "Breaking Bad", type: "series", cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
  { id: "game-1", title: "Elden Ring", type: "jogos", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg" },
], hallOfFame: [
  { id: "al-1", title: "Attack on Titan", type: "anime", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-73IhOXpJZiMF.jpg" },
  { id: "tmdb-2", title: "Breaking Bad", type: "series", cover: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
]};
const DEMO_FEED = [
  { user: "mrdk", avatar: "", action: "completou", item: "Chainsaw Man", type: "manga", rating: 9, time: "há 2h" },
  { user: "shutw", avatar: "", action: "adicionou à biblioteca", item: "Frieren", type: "anime", rating: 0, time: "há 5h" },
  { user: "wmans", avatar: "", action: "completou", item: "The Last of Us", type: "series", rating: 10, time: "há 1d" },
  { user: "mrdk", avatar: "", action: "avaliou", item: "Oppenheimer", type: "filmes", rating: 8, time: "há 1d" },
];

// LandingPage — ver components/LandingPage.jsx
// ─── Recommendations ──────────────────────────────────────────────────────────
// fetchAniListSafe, fetchTrendingAnime, fetchTrendingManga — ver src/api/anilist.js

// fetchTrendingMovies, fetchTrendingSeries — ver src/api/tmdb.js

// fetchTrendingGames — ver src/api/igdb.js

// fetchPersonalizedRecos — ver src/api/recommendations.js

// ─── Main App ──────────────────────────────────────────────────────────────────

// AuthScreen — ver components/AuthScreen.jsx
// ─── Sidebar Search ───────────────────────────────────────────────────────────

export default function TrackAll() {
  const [lang, setLang] = useState(() => detectLang());
  const useT = (key) => t(key, lang);
  const changeLang = (newLang) => { setLang(newLang); saveLang(newLang); };
  const [accent, setAccent] = useState("#f97316");
  const [bgColor, setBgColor] = useState("#0d1117");
  const [bgColorMobile, setBgColorMobile] = useState(""); // "" = igual ao PC
  const [sidebarColor, setSidebarColor] = useState(""); // "" = igual ao bgColor
  const [textContrast, setTextContrast] = useState(100);
  const [textContrastMobile, setTextContrastMobile] = useState(100);
  const [savedThemes, setSavedThemes] = useState(() => { try { return JSON.parse(localStorage.getItem("trackall_themes") || "[]"); } catch { return []; } });
  const [panelBg, setPanelBg] = useState("");
  const [panelOpacity, setPanelOpacity] = useState(100);

  const [bgImage, setBgImage] = useState("");
  const [bgImageMobile, setBgImageMobile] = useState("");
  const [bgSeparateDevices, setBgSeparateDevices] = useState(false);
  const [bgOverlay, setBgOverlay] = useState("rgba(0,0,0,0.55)");
  const [bgBlur, setBgBlur] = useState(0);
  const [bgParallax, setBgParallax] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState({ name: "", bio: "", avatar: "", hallOfFame: [] });
  const [library, setLibrary] = useState({});
  // Cópia sempre atualizada da biblioteca: os handlers leem daqui para nunca gravarem por cima de alterações recentes (ex.: rating + completado seguidos)
  const libraryRef = useRef({});
  const saveQueueRef = useRef(Promise.resolve());
  // Hall of Fame: só se escreve depois de carregado (evita gravar uma lista vazia por cima da real)
  const hallRef = useRef({ loaded: false, hall: [], featured: null });
  libraryRef.current = library;
  const [tmdbKey, setTmdbKey] = useState(DEFAULT_TMDB_KEY);
  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [view, setView] = useState("home");
  const [activeTab, setActiveTab] = useState("all");
  const [homeFilter, setHomeFilter] = useState([]);
  const [homeCollapsedCurso, setHomeCollapsedCurso] = useState(false);

  // ── PWA: Register service worker + inject manifest meta tags ──
  useEffect(() => {
    // Bloquear zoom no mobile
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    // Inject manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }
    // Theme color meta — segue a cor de fundo do dispositivo atual
    const isMobile = window.innerWidth < 768;
    const activeColor = (bgSeparateDevices && isMobile)
      ? (bgColorMobile || "#0d1117")  // mobile: usa cor mobile, nunca herda PC
      : bgColor;
    const barColor = /^#[0-9a-f]{3,6}$/i.test(activeColor || "") ? mixHex(activeColor, "#07090c", 0.22) : activeColor;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.content = barColor;
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = barColor;
      document.head.appendChild(meta);
    }
    // Apple mobile web app
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m1 = document.createElement('meta');
      m1.name = 'apple-mobile-web-app-capable';
      m1.content = 'yes';
      document.head.appendChild(m1);
      const m2 = document.createElement('meta');
      m2.name = 'apple-mobile-web-app-status-bar-style';
      m2.content = 'black-translucent';
      document.head.appendChild(m2);
      const m3 = document.createElement('meta');
      m3.name = 'apple-mobile-web-app-title';
      m3.content = 'TrackAll';
      document.head.appendChild(m3);
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/icon-192.png';
      document.head.appendChild(icon);
      // Favicon SVG inline — evita o globo do browser
      if (!document.querySelector('link[rel="icon"]')) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/svg+xml';
        favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23f97316'/><text x='16' y='23' text-anchor='middle' font-size='20' font-weight='900' font-family='Arial,sans-serif' fill='white'>T</text></svg>`;
        document.head.appendChild(favicon);
      }
    }
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => console.log('[PWA] SW registered:', reg.scope))
        .catch(err => console.log('[PWA] SW failed:', err));
    }
    // Capture install prompt
    const onPrompt = (e) => { e.preventDefault(); setPwaPrompt(e); };
    const onInstalled = () => { setPwaInstalled(true); setPwaPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Check if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) setPwaInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [bgColor, bgColorMobile, bgSeparateDevices]);

  // Attach mouse-wheel → horizontal scroll on all .recents-row elements
  // + keyboard arrow keys when hovering ANY horizontal scroll container
  useEffect(() => {
    let hoveredRow = null;

    const onKeyDown = (e) => {
      if (!hoveredRow) return;
      if (hoveredRow.scrollWidth <= hoveredRow.clientWidth) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); hoveredRow.scrollLeft -= 200; }
      if (e.key === "ArrowRight") { e.preventDefault(); hoveredRow.scrollLeft += 200; }
    };
    document.addEventListener('keydown', onKeyDown);

    // Selector que cobre todos os scrolls horizontais
    const SCROLL_SEL = '.recents-row, .tabs-scroll, [style*="overflowX: auto"], [style*="overflow-x: auto"]';

    const attachEl = (el) => {
      if (el._scrollKeyOk) return;
      el._scrollKeyOk = true;
      // wheel
      if (!el._wheelOk) {
        el._wheelOk = true;
        el.addEventListener('wheel', (e) => {
          if (el.scrollWidth <= el.clientWidth) return;
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }, { passive: false });
      }
      // keyboard hover
      el.addEventListener('mouseenter', () => { hoveredRow = el; });
      el.addEventListener('mouseleave', () => { if (hoveredRow === el) hoveredRow = null; });
    };

    const attach = () => {
      document.querySelectorAll(SCROLL_SEL).forEach(attachEl);
    };

    attach();
    const obs = new MutationObserver(attach);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); document.removeEventListener('keydown', onKeyDown); };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsByType, setSearchResultsByType] = useState({});
  const searchSeqRef = useRef(0);
  const searchQueryRef = useRef("");
  const [searchHistory, setSearchHistory] = useState(() => { try { return JSON.parse(localStorage.getItem("trackall_search_history") || "[]"); } catch { return []; } });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [notif, setNotif] = useState(null);
  const [pwaPrompt, setPwaPrompt] = useState(null); // deferred install prompt
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRating, setFilterRating] = useState(null); // null | "rated" | nota exata (vem das estatísticas do perfil)
  const [libSort, setLibSort] = useState("date");
  const [libSearch, setLibSearch] = useState("");
  const [libViewMode, setLibViewMode] = useState(() => { 
    try { 
      const saved = localStorage.getItem("trackall_lib_view") || "grid";
      // compact não existe no mobile
      if (saved === "compact" && typeof window !== 'undefined' && window.innerWidth < 600) return "grid";
      return saved;
    } catch { return "grid"; } 
  });
  const setLibViewModePersist = (mode) => { setLibViewMode(mode); try { localStorage.setItem("trackall_lib_view", mode); } catch {} };
  const [logOpen, setLogOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  // Refs para o back handler (lê estado actual sem deps no useEffect)
  const selectedItemRef = useRef(null);
  const logOpenRef = useRef(false);
  const showTierlistEditorRef = useRef(false);
  const viewingTierlistRef = useRef(null);
  const showCollectionEditorRef = useRef(false);
  const viewingCollectionRef = useRef(null);
  const viewRef = useRef("home");
  const [logQuery, setLogQuery] = useState("");
  const [logResults, setLogResults] = useState([]);
  const [logSearching, setLogSearching] = useState(false);
  const logInputRef = useRef(null);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchType, setQuickSearchType] = useState(null);
  const [logPendingItem, setLogPendingItem] = useState(null); // item awaiting rating after log
  const [favorites, setFavorites] = useState([]);
  const [recos, setRecos] = useState({});
  const [personalRecos, setPersonalRecos] = useState([]);
  const personalRecosLoadedRef = useRef(false);
  const recoLoadIdRef = useRef(0);
  const recosFetchedRef = useRef(false);
  const [recoLoading, setRecoLoading] = useState(false);
  const [userTierlists, setUserTierlists] = useState([]);
  const [userLikes, setUserLikes] = useState([]);
  const [viewingTierlist, setViewingTierlist] = useState(null);
  const [tierReturn, setTierReturn] = useState(null); // tier list a reabrir quando o detalhe fechar
  const [editingTierlist, setEditingTierlist] = useState(null);
  const [showTierlistEditor, setShowTierlistEditor] = useState(false);
  const [userCollections, setUserCollections] = useState([]);
  const [userCollectionLikes, setUserCollectionLikes] = useState([]);
  const [viewingCollection, setViewingCollection] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const [showCollectionEditor, setShowCollectionEditor] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const libDirtyRef = useRef(false); // true se alteraste a biblioteca nesta sessão
  const [bootError, setBootError] = useState(false); // servidor não respondeu ao carregar os dados
  const [showLanding, setShowLanding] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const mainSwipeRef = useRef({ tracking: false, blocked: false, isHorizontal: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const mainSwipeAnimRef = useRef(null);
  const mainSwipeContentRef = useRef(null);
  const mainSwipePeekRef = useRef(null);
  const mainSwipePeekState = useRef({ dir: 1 });
  const MAIN_SWIPE_VIEWS = ["home", "library", "friends", "profile"];

  // ── Restaurar sessão ao arrancar ──
  useEffect(() => {
    // Nunca fica preso no ecrã de arranque: cada passo tem limite de tempo.
    const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    const restore = async () => {
      try {
        const user = await withTimeout(supa.getSession(), 8000);
        if (user) {
          setUser(user);
          try { sessionStorage.removeItem("trackall_boot_retry"); } catch {}
          // os dados são pesados (capas personalizadas): espera até 30s no skeleton; depois mostra erro e recupera sozinho se chegarem
          // Com cópia local: abre logo (perfil do servidor, que é leve) e atualiza o resto por baixo
          const cached = await cacheGet(`boot_${user.id}`);
          if (cached?.lib && cached.v === 1 && Object.keys(cached.lib).length > 0) {
            let prof = null;
            try { prof = await withTimeout(fetchProfileRow(user.id), 8000); } catch {}
            applyUserData(user.id, { prof: prof || cached.prof, lib: cached.lib, hr: cached.hr }, true);
            setAuthLoading(false);
            (async () => {
              try {
                const freshProf = prof || await fetchProfileRow(user.id);
                const [freshLib, freshHr] = await fetchHeavyData(user.id);
                if (freshProf || freshHr?.data) {
                  // se mexeste na biblioteca entretanto, não a substitui (as tuas alterações já seguiram para o servidor)
                  applyUserData(user.id, { prof: freshProf || prof || cached.prof, lib: libDirtyRef.current ? null : freshLib, hr: freshHr });
                  if (freshLib) setDataFresh(true);
                  if (!libDirtyRef.current) cacheSet(`boot_${user.id}`, { v: 1, ts: Date.now(), prof: bootCacheRef.current.prof, hr: bootCacheRef.current.hr, lib: freshLib });
                }
              } catch (e) { console.warn("[TrackAll] atualização em segundo plano falhou:", e?.message); }
            })();
            return;
          }
          const loadP = loadUserData(user.id);
          let ok = false;
          try { ok = await withTimeout(loadP, 30000); }
          catch (e) {
            console.warn("[TrackAll] carregamento lento:", e?.message);
            // se os dados chegarem mais tarde, a app recupera sozinha
            loadP.then(r => { if (r) setBootError(false); }).catch(() => {});
          }
          if (!ok) setBootError(true);
        } else {
          try { sessionStorage.removeItem("trackall_boot_retry"); } catch {}
          setShowLanding(true);
        }
      } catch (e) {
        // a sessão não respondeu (bloqueio do cliente de auth): tenta recarregar uma vez, como fazias à mão
        let retry = false;
        try {
          const last = Number(sessionStorage.getItem("trackall_boot_retry") || 0);
          if (e?.message === "timeout" && Date.now() - last > 60000) { sessionStorage.setItem("trackall_boot_retry", String(Date.now())); retry = true; }
        } catch {}
        if (retry) { window.location.reload(); return; }
        setShowLanding(true);
      }
      setAuthLoading(false);
    };
    restore();
  }, []);

  // Pedidos ao servidor (separados da aplicação ao estado para poder usar a cópia local)
  const fetchProfileRow = (userId) => supa.getProfile(userId);
  // Se o pedido falhar devolve null (nunca uma biblioteca vazia) — assim não se mostra nem se guarda "vazio" por engano
  const fetchLibrary = async (userId) => {
    const { data, error } = await supabase.from("library").select("media_id, data").eq("user_id", userId).neq("media_id", "__hall_of_fame__");
    if (error) throw error;
    const lib = {};
    (data || []).forEach(row => {
      if (row.media_id && row.media_id !== "__hall_of_fame__" && row.data) lib[row.media_id] = { ...row.data, id: row.media_id };
    });
    return lib;
  };
  const fetchHeavyData = (userId) => Promise.all([
    fetchLibrary(userId).catch((e) => { console.warn("[TrackAll] biblioteca não carregou:", e?.message || e); return null; }),
    supabase.from("library").select("data").eq("user_id", userId).eq("media_id", "__hall_of_fame__").maybeSingle().then(r => r, e => ({ error: e })),
  ]);

  // Aplica perfil + biblioteca + Hall of Fame ao estado. fromCache: não repara a BD com dados possivelmente antigos.
  const applyUserData = (userId, { prof, lib, hr }, fromCache = false) => {
    setImageUser(userId);
    if (lib) setLibrary(lib); // primeiro: nada do que vem a seguir pode impedir a biblioteca de aparecer
    bootCacheRef.current = { prof: prof || bootCacheRef.current.prof, hr: hr ? { data: hr.data || null, error: null } : bootCacheRef.current.hr };
      if (prof) {
        const _savedHall = (() => { try { const s = localStorage.getItem("trackall_hall_of_fame"); return s ? JSON.parse(s) : null; } catch { return null; } })();
        // Tentar ler Hall of Fame da library (mais fiável que coluna profiles)
        let _featuredData = (() => { try { const s = localStorage.getItem("trackall_featured"); return s ? JSON.parse(s) : null; } catch { return null; } })();
        const _scoped = (k) => { try { const v = localStorage.getItem(`${k}_${userId}`); return v ? JSON.parse(v) : null; } catch { return null; } };
        const _cands = [];
        let _rowHall = null, _rowErr = false;
        try {
          if (hr?.error) _rowErr = true;
          else if (hr.data?.data) { _rowHall = hr.data.data; if (_rowHall.featured) _featuredData = _rowHall.featured; }
        } catch { _rowErr = true; }
        if (Array.isArray(_rowHall?.hall)) _cands.push(_rowHall.hall);
        if (Array.isArray(prof.hall_of_fame)) _cands.push(prof.hall_of_fame);
        const _sc = _scoped("trackall_hall_of_fame"); if (Array.isArray(_sc)) _cands.push(_sc);
        if (Array.isArray(_savedHall)) _cands.push(_savedHall);
        // escolhe a lista mais completa entre todas as fontes (nunca perde itens)
        let _hallData = _cands.reduce((best, c) => (c.length > best.length ? c : best), []);
        if (!_featuredData) _featuredData = _scoped("trackall_featured");
        hallRef.current = { loaded: !_rowErr || _hallData.length > 0, hall: _hallData, featured: _featuredData };
        try { localStorage.setItem(`trackall_hall_of_fame_${userId}`, JSON.stringify(_hallData)); if (_featuredData) localStorage.setItem(`trackall_featured_${userId}`, JSON.stringify(_featuredData)); } catch {}
        // auto-reparação: se a linha na BD está vazia/desatualizada mas há dados noutra fonte, volta a gravar
        if (!fromCache && !_rowErr && _hallData.length > (_rowHall?.hall?.length || 0)) {
          supa.upsertLibraryItem(userId, "__hall_of_fame__", { hall: _hallData, featured: _featuredData || null }).catch(() => {});
        }
        setProfile({ name: prof.name || "", bio: prof.bio || "", avatar: prof.avatar || "", banner: prof.banner || "", hideEmail: prof.hide_email || false, hideBannerMobile: prof.hide_banner_mobile || false, hallOfFame: _hallData, featuredItem: _featuredData });
        if (prof.accent) setAccent(prof.accent);
        if (prof.panel_bg !== undefined) setPanelBg(prof.panel_bg || "");
        if (prof.panel_opacity !== undefined) setPanelOpacity(prof.panel_opacity ?? 100);
        if (prof.sidebar_color !== undefined) setSidebarColor(prof.sidebar_color || "");
        if (prof.text_contrast !== undefined) setTextContrast(prof.text_contrast ?? 100);
        if (prof.text_contrast_mobile !== undefined) setTextContrastMobile(prof.text_contrast_mobile ?? 100);
        if (prof.bg_color_mobile) setBgColorMobile(prof.bg_color_mobile);

        if (prof.bg_color) {
          setBgColor(prof.bg_color);
          setDarkMode(isColorDark(prof.bg_color));
        }
        if (prof.bg_image) setBgImage(prof.bg_image);
        if (prof.bg_image_mobile) setBgImageMobile(prof.bg_image_mobile);
        if (prof.bg_separate_devices) setBgSeparateDevices(true);
        if (prof.bg_overlay !== undefined) setBgOverlay(prof.bg_overlay);
        if (prof.bg_blur !== undefined) setBgBlur(prof.bg_blur);
        if (prof.bg_parallax !== undefined) setBgParallax(prof.bg_parallax);
        if (prof.tmdb_key) setTmdbKey(prof.tmdb_key);
        else setTmdbKey(DEFAULT_TMDB_KEY);
        if (prof.worker_url) setWorkerUrl(prof.worker_url);
        else setWorkerUrl(DEFAULT_WORKER_URL);
        if (prof.favorites) setFavorites(prof.favorites);
      }
      if (lib) {
        setLibrary(lib);
        // Tentar cache do sessionStorage primeiro
        if (!personalRecosLoadedRef.current) {
          try {
            const cached = sessionStorage.getItem("trackall_personal_recos");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.length) { setPersonalRecos(parsed); personalRecosLoadedRef.current = true; }
            }
          } catch {}
        }
        // Carregar recos personalizadas logo após ter a library — só uma vez
        if (!personalRecosLoadedRef.current && Object.keys(lib).length > 0) {
          personalRecosLoadedRef.current = true;
          const workerU = prof?.worker_url || DEFAULT_WORKER_URL;
          fetchPersonalizedRecos(lib, workerU).then(personal => {
            if (personal?.length) {
              setPersonalRecos(personal);
              try { sessionStorage.setItem("trackall_personal_recos", JSON.stringify(personal)); } catch {}
            }
          });
        }
      }
    return !(!prof && hr?.error); // false = o servidor não respondeu (perfil em falta e pedido falhou)
  };

  // Guarda a cópia local (com pequeno atraso para juntar várias alterações seguidas)
  const bootCacheRef = useRef({ prof: null, hr: null });
  const bootCacheTimerRef = useRef(null);
  const scheduleBootCache = () => {
    if (!user?.id) return;
    clearTimeout(bootCacheTimerRef.current);
    bootCacheTimerRef.current = setTimeout(() => {
      cacheSet(`boot_${user.id}`, { v: 1, ts: Date.now(), prof: bootCacheRef.current.prof, hr: bootCacheRef.current.hr, lib: libraryRef.current });
    }, 2000);
  };

  // Arranque sem cópia local: tudo do servidor, como antes
  const loadUserData = async (userId) => {
    try {
      const [prof, [lib, hr]] = await Promise.all([fetchProfileRow(userId), fetchHeavyData(userId)]);
      const ok = applyUserData(userId, { prof, lib, hr }) && !!lib;
      if (ok) setDataFresh(true);
      if (ok && prof) cacheSet(`boot_${userId}`, { v: 1, ts: Date.now(), prof, hr: { data: hr?.data || null, error: null }, lib });
      return ok;
    } catch (err) {
      console.error('[TrackAll] Erro ao carregar dados do utilizador:', err);
      return false;
    }
  };

  // Carrega recos UMA VEZ — ref garante que não repete mesmo com re-renders
  const recosInitRef = useRef(false);
  useEffect(() => {
    if (user?.id && !recosInitRef.current) {
      recosInitRef.current = true;
      loadRecos();
    }
  });  // sem dependências — corre a cada render mas a ref para depois da 1ª vez

  // Carrega tierlists/collections uma vez
  const profileInitRef = useRef(false);
  useEffect(() => {
    if (user?.id && !profileInitRef.current) {
      profileInitRef.current = true;
      loadUserTierlists();
      loadUserCollections();
    }
  });  // sem dependências — idem

  useEffect(() => () => {
    if (mainSwipeAnimRef.current) clearTimeout(mainSwipeAnimRef.current);
  }, []);

  const loadRecos = async (manual = false) => {
    if (!manual && recosFetchedRef.current) return; // já carregou, não repetir
    recosFetchedRef.current = true;
    const loadId = ++recoLoadIdRef.current;
    setRecoLoading(true);
    if (!manual) {
      // Tentar restaurar de sessionStorage antes de fazer fetch
      try {
        const cached = sessionStorage.getItem("trackall_trending_recos");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Object.keys(parsed).length > 0) {
            setRecos(parsed);
            setRecoLoading(false);
            return;
          }
        }
      } catch {}
    }
    setRecos({});
    const applyRecoChunk = (key, items) => {
      if (recoLoadIdRef.current !== loadId) return;
      if (items?.length) setRecos(r => ({ ...r, [key]: items }));
    };
    if (manual) {
      setPersonalRecos([]);
      personalRecosLoadedRef.current = false;
      recosFetchedRef.current = false;
      try { sessionStorage.removeItem("trackall_personal_recos"); } catch {}
      try { sessionStorage.removeItem("trackall_trending_recos"); } catch {}
      // Re-fetch personalRecos with current library
      if (Object.keys(library).length > 0) {
        personalRecosLoadedRef.current = true;
        fetchPersonalizedRecos(library, workerUrl).then(personal => {
          if (recoLoadIdRef.current !== loadId) return;
          if (personal?.length) {
            setPersonalRecos(personal);
            try { sessionStorage.setItem("trackall_personal_recos", JSON.stringify(personal)); } catch {}
          }
        }).catch(() => {});
      }
    }
    try {
      // Carregar progressivamente — cada categoria aparece quando fica pronta
      await Promise.allSettled([
        fetchTrendingAnime(workerUrl).then(items => applyRecoChunk("anime", items)),
        fetchTrendingManga(workerUrl).then(items => applyRecoChunk("manga", items)),
        fetchTrendingMovies(tmdbKey, workerUrl).then(items => applyRecoChunk("filmes", items)),
        fetchTrendingSeries(tmdbKey, workerUrl).then(items => applyRecoChunk("series", items)),
        fetchTrendingGames(workerUrl).then(items => applyRecoChunk("jogos", items)),
      ]);
    } catch {}
    if (recoLoadIdRef.current === loadId) {
      setRecoLoading(false);
      // Guardar trending em cache para restaurar sem reload
      if (!manual) {
        setRecos(current => {
          try { sessionStorage.setItem("trackall_trending_recos", JSON.stringify(current)); } catch {}
          return current;
        });
      }
    }
  };

  const handleSaveTierlist = async (title, tiers) => {
    if (!user) return;
    if (editingTierlist?.id) {
      await supa.updateTierlist(editingTierlist.id, title, tiers);
      setUserTierlists(prev => prev.map(tl => tl.id === editingTierlist.id ? { ...tl, title, tiers } : tl));
    } else {
      const newTl = await supa.createTierlist(user.id, title, tiers);
      if (newTl) setUserTierlists(prev => [newTl, ...prev]);
    }
    setShowTierlistEditor(false);
    setEditingTierlist(null);
  };

  const loadUserTierlists = async () => {
    if (!user) return;
    const [tls, likes] = await Promise.all([
      supa.getUserTierlists(user.id),
      supa.getUserLikes(user.id),
    ]);
    setUserTierlists(tls);
    setUserLikes(likes);
  };

  const loadUserCollections = async () => {
    if (!user) return;
    const [cols, colLikes] = await Promise.all([
      supa.getUserCollections(user.id),
      supa.getUserCollectionLikes(user.id),
    ]);
    setUserCollections(cols);
    setUserCollectionLikes(colLikes);
  };

  const likingTierlistRef = useRef(new Set());
  const handleTierlistLike = async (tierlistId) => {
    if (!user) return;
    if (likingTierlistRef.current.has(tierlistId)) return; // já em curso, ignora clique repetido
    likingTierlistRef.current.add(tierlistId);
    try {
      const isLiked = await supa.toggleTierlistLike(user.id, tierlistId);
      setUserLikes(prev => isLiked ? [...prev, tierlistId] : prev.filter(id => id !== tierlistId));
      setUserTierlists(prev => prev.map(tl => tl.id === tierlistId ? { ...tl, likes_count: Math.max(0, (tl.likes_count || 0) + (isLiked ? 1 : -1)) } : tl));
      if (viewingTierlist?.id === tierlistId) {
        setViewingTierlist(prev => ({ ...prev, likes_count: Math.max(0, (prev.likes_count || 0) + (isLiked ? 1 : -1)) }));
      }
    } finally {
      likingTierlistRef.current.delete(tierlistId);
    }
  };

  const handleDeleteTierlist = async (id) => {
    await supa.deleteTierlist(id);
    setUserTierlists(prev => prev.filter(tl => tl.id !== id));
  };

  const handleSaveCollection = async (colData) => {
    if (!user) return;
    if (editingCollection) {
      await supa.updateCollection(editingCollection.id, colData);
      setUserCollections(prev => prev.map(c => c.id === editingCollection.id ? { ...c, ...colData } : c));
      if (viewingCollection?.id === editingCollection.id) setViewingCollection(prev => ({ ...prev, ...colData }));
    } else {
      const created = await supa.createCollection(user.id, colData);
      setUserCollections(prev => [created, ...prev]);
    }
    setShowCollectionEditor(false);
    setEditingCollection(null);
  };

  const handleCollectionLike = async (collectionId) => {
    if (!user) return;
    const isLiked = await supa.toggleCollectionLike(user.id, collectionId);
    setUserCollectionLikes(prev => isLiked ? [...prev, collectionId] : prev.filter(id => id !== collectionId));
    setUserCollections(prev => prev.map(c => c.id === collectionId ? { ...c, likes_count: (c.likes_count || 0) + (isLiked ? 1 : -1) } : c));
    if (viewingCollection?.id === collectionId) setViewingCollection(prev => ({ ...prev, likes_count: (prev.likes_count || 0) + (isLiked ? 1 : -1) }));
  };

  const handleDeleteCollection = async (id) => {
    await supa.deleteCollection(id);
    setUserCollections(prev => prev.filter(c => c.id !== id));
    if (viewingCollection?.id === id) setViewingCollection(null);
  };

  const handleAuth = async (u) => {
    setUser(u);
    await loadUserData(u.id);
  };

  const handleSignOut = async () => {
    await supa.signOut();
    cacheClearAll();
    libDirtyRef.current = false;
    setDataFresh(false);
    bootCacheRef.current = { prof: null, hr: null };
    setUser(null);
    setLibrary({});
    hallRef.current = { loaded: false, hall: [], featured: null };
    setProfile({ name: "", bio: "", avatar: "", hallOfFame: [] });
    setView("home");
  };

  const notifTimerRef = useRef(null);
  const showNotif = (msg, color, action) => {
    clearTimeout(notifTimerRef.current);
    setNotif({ msg, color, action });
    notifTimerRef.current = setTimeout(() => setNotif(null), action ? 6500 : Math.max(2000, Math.min(msg.length * 60, 4500)));
  };

  const saveLibrary = (lib) => {
    const prev = libraryRef.current;
    libraryRef.current = lib;
    libDirtyRef.current = true;
    setLibrary(lib);
    scheduleBootCache();
    if (!user) return Promise.resolve();
    // Escritas em fila: chegam ao Supabase pela mesma ordem em que foram feitas
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        for (const [id, item] of Object.entries(lib)) {
          if (JSON.stringify(prev[id]) !== JSON.stringify(item)) {
            await supa.upsertLibraryItem(user.id, id, item);
          }
        }
        for (const id of Object.keys(prev)) {
          if (!id.startsWith("__") && !lib[id]) await supa.deleteLibraryItem(user.id, id);
        }
      } catch (err) {
        console.error('[TrackAll] Erro ao guardar biblioteca:', err?.message || err, err?.details || '', err?.hint || '', err?.code || '');
        showNotif(lang === "en" ? "Could not sync — check your connection" : "Não foi possível sincronizar — verifica a ligação", "#ef4444");
      }
    });
    return saveQueueRef.current;
  };

  // ── Migração única: imagens base64 (capas personalizadas, fundos) → Supabase Storage ──
  // Só corre com dados confirmados do servidor. Cada ficheiro é enviado e só depois substituído; se algo falhar, fica o original.
  const [dataFresh, setDataFresh] = useState(false);
  const migratingRef = useRef(false);
  const favoritesRef = useRef([]);
  favoritesRef.current = favorites;
  const migrateImages = async () => {
    if (!user || demoMode || migratingRef.current) return;
    const flagKey = `trackall_img_migrated_${user.id}`;
    try { if (localStorage.getItem(flagKey) === "2") return; } catch {}
    const lib0 = libraryRef.current;
    const prof0 = bootCacheRef.current.prof || {};
    const hall0 = hallRef.current;
    if (!hall0.loaded) return;
    const profFields = ["bg_image", "bg_image_mobile", "bg_image_desktop", "stats_card_bg", "avatar", "banner"];
    const found = new Set();
    const collect = (o) => { if (!o || typeof o !== "object") return; for (const k of ["customCover", "cover"]) if (isDataUrl(o[k])) found.add(o[k]); };
    Object.entries(lib0).forEach(([id, it]) => { if (!id.startsWith("__")) collect(it); });
    (hall0.hall || []).forEach(collect); collect(hall0.featured);
    favoritesRef.current.forEach(collect);
    profFields.forEach(f => { if (isDataUrl(prof0[f])) found.add(prof0[f]); });
    if (!found.size) { try { localStorage.setItem(flagKey, "2"); } catch {} return; }

    migratingRef.current = true;
    try {
      // cópia de segurança local antes de mexer em qualquer coisa
      try { await cacheSet(`backup_pre_storage_${user.id}`, { ts: Date.now(), lib: lib0, hall: hall0.hall, featured: hall0.featured, favorites: favoritesRef.current, prof: prof0 }); } catch {}
      showNotif(lang === "en" ? "Moving images to cloud storage…" : "A mover imagens para o armazenamento…", accent);
      const map = new Map(); let fails = 0;
      for (const d of found) {
        if (fails >= 3) break; // provavelmente permissões/rede: pára e tenta noutra sessão
        try { map.set(d, await uploadDataUrl(d, user.id)); } catch (e) { fails++; console.warn("[TrackAll] migração: upload falhou:", e?.message || e); }
      }
      const sub = (v) => (isDataUrl(v) && map.has(v)) ? map.get(v) : v;
      const subObj = (o) => { if (!o || typeof o !== "object") return o; const out = { ...o }; let ch = false; for (const k of ["customCover", "cover"]) { const n = sub(o[k]); if (n !== o[k]) { out[k] = n; ch = true; } } return ch ? out : o; };
      let dbOk = true;
      if (map.size) {
        // biblioteca (sempre sobre o estado mais recente)
        const curLib = libraryRef.current; const nextLib = {}; let libCh = false;
        for (const [id, it] of Object.entries(curLib)) { const n = id.startsWith("__") ? it : subObj(it); if (n !== it) libCh = true; nextLib[id] = n; }
        if (libCh) await saveLibrary(nextLib);
        // Hall of Fame + destaque
        const h = hallRef.current; const nh = (h.hall || []).map(subObj); const nf = h.featured ? subObj(h.featured) : h.featured;
        if (nh.some((x, i) => x !== h.hall[i]) || nf !== h.featured) {
          setProfile(prev => ({ ...prev, hallOfFame: nh, featuredItem: nf || null }));
          await persistHall(nh, nf);
        }
        // favoritos
        const favs = favoritesRef.current.map(subObj);
        if (favs.some((x, i) => x !== favoritesRef.current[i])) {
          setFavorites(favs);
          const { error } = await supabase.from("profiles").update({ favorites: favs }).eq("id", user.id);
          if (error) dbOk = false;
        }
        // campos do perfil (fundos, etc.)
        const upd = {}; profFields.forEach(f => { const n = sub(prof0[f]); if (n !== prof0[f]) upd[f] = n; });
        if (Object.keys(upd).length) {
          const { error } = await supabase.from("profiles").update(upd).eq("id", user.id);
          if (error) { dbOk = false; console.warn("[TrackAll] migração: perfil não gravou:", error.message); }
          else {
            if (upd.bg_image) setBgImage(upd.bg_image);
            if (upd.bg_image_mobile) setBgImageMobile(upd.bg_image_mobile);
            if (upd.avatar || upd.banner) setProfile(prev => ({ ...prev, ...(upd.avatar ? { avatar: upd.avatar } : {}), ...(upd.banner ? { banner: upd.banner } : {}) }));
            bootCacheRef.current = { ...bootCacheRef.current, prof: { ...prof0, ...upd } };
          }
        }
        scheduleBootCache();
      }
      if (map.size === found.size && dbOk) {
        try { localStorage.setItem(flagKey, "2"); } catch {}
        showNotif(lang === "en" ? `Done: ${map.size} images moved` : `Feito: ${map.size} imagens migradas`, "#22c55e");
      } else {
        showNotif(lang === "en" ? "Could not move all images — will retry next time" : "Nem todas as imagens foram migradas — tento de novo na próxima vez", "#f59e0b");
      }
    } catch (err) {
      console.error("[TrackAll] migração de imagens:", err);
    } finally { migratingRef.current = false; }
  };
  const migrateRef = useRef(migrateImages);
  migrateRef.current = migrateImages;
  useEffect(() => {
    if (!user?.id || !dataFresh) return;
    const t = setTimeout(() => { migrateRef.current(); }, 4000);
    return () => clearTimeout(t);
  }, [user?.id, dataFresh]);

  const getLibraryMatch = (id, type = "") => findLibraryEntry(library, id, type);

  const saveProfile = async (p) => {
    setProfile(p);
    if (user) {
      try {
        await supa.upsertProfile(user.id, {
          name: p.name || "",
          bio: p.bio || "",
          avatar: p.avatar || "",
          banner: p.banner || "",
          hide_email: p.hideEmail || false,
          hide_banner_mobile: p.hideBannerMobile || false,
        });
      } catch (err) {
        console.error('[TrackAll] Erro ao guardar perfil:', err);
        showNotif(lang === "en" ? "Error saving profile. Check your connection." : "Erro ao guardar perfil. Verifica a ligação.", "#ef4444");
      }
    }
  };

  // Grava Hall of Fame + destaque num só sítio (linha especial na BD) com cópia local por utilizador.
  // Usa sempre o último valor conhecido (ref) e nunca grava antes de o Hall ter sido carregado.
  const persistHall = async (hall, featured) => {
    const cur = hallRef.current;
    const next = { loaded: cur.loaded, hall: hall !== undefined ? hall : cur.hall, featured: featured !== undefined ? featured : cur.featured };
    hallRef.current = next;
    bootCacheRef.current = { ...bootCacheRef.current, hr: { data: { data: { hall: next.hall, featured: next.featured || null } }, error: null } };
    scheduleBootCache();
    if (user) try {
      localStorage.setItem(`trackall_hall_of_fame_${user.id}`, JSON.stringify(next.hall));
      if (next.featured) localStorage.setItem(`trackall_featured_${user.id}`, JSON.stringify(next.featured)); else localStorage.removeItem(`trackall_featured_${user.id}`);
    } catch {}
    if (!user || !next.loaded) return;
    try { await supa.upsertLibraryItem(user.id, "__hall_of_fame__", { hall: next.hall, featured: next.featured || null }); }
    catch (err) { console.error("[TrackAll] Erro ao guardar Hall of Fame:", err); showNotif(lang === "en" ? "Could not sync Hall of Fame" : "Não foi possível sincronizar o Hall of Fame", "#ef4444"); }
  };

  const toggleHallOfFame = async (item) => {
    const normalizedItem = normalizeMediaItem(item);
    const currentHall = hallRef.current.loaded ? hallRef.current.hall : (Array.isArray(profile?.hallOfFame) ? profile.hallOfFame : []);
    const hallIds = new Set(mediaIdCandidates(normalizedItem.id, normalizedItem.type));
    const exists = currentHall.some(entry => hallIds.has(entry.id));
    let nextHall;
    if (exists) {
      nextHall = currentHall.filter(entry => !hallIds.has(entry.id));
      showNotif(lang === "en" ? "Removed from Hall of Fame" : "Removido do Hall of Fame", "#8b949e");
    } else {
      if (currentHall.length >= 10) {
        showNotif(lang === "en" ? "Hall of Fame max: 10 titles" : "Hall of Fame máximo: 10 obras", "#ef4444");
        return;
      }
      const libItem = getLibraryMatch(normalizedItem.id, normalizedItem.type)?.item;
      nextHall = [...currentHall, { id: normalizedItem.id, title: normalizedItem.title, cover: normalizedItem.cover, customCover: libItem?.customCover || normalizedItem.customCover || "", type: normalizedItem.type }];
      showNotif(lang === "en" ? "Added to Hall of Fame" : "Adicionado ao Hall of Fame", "#fbbf24");
      if (navigator.vibrate) navigator.vibrate(40);
    }
    setProfile(prev => ({ ...prev, hallOfFame: nextHall }));
    await persistHall(nextHall, undefined);
  };

  // Item em destaque do cartão de perfil — guardado na mesma linha especial do Hall of Fame (não precisa de coluna nova)
  const saveFeatured = async (item) => {
    const featured = item ? (() => {
      const n = normalizeMediaItem(item);
      const libItem = getLibraryMatch(n.id, n.type)?.item;
      return { id: n.id, type: n.type, title: n.title, cover: n.cover || "", customCover: libItem?.customCover || n.customCover || "" };
    })() : null;
    setProfile(prev => ({ ...prev, featuredItem: featured }));
    await persistHall(undefined, featured);
  };

  const saveAccent = async (c) => {
    setAccent(c);
    if (user) try { await supa.upsertProfile(user.id, { accent: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar accent:", err); }
  };
  const savePanelBg = async (c) => {
    setPanelBg(c);
    if (user) try { await supa.upsertProfile(user.id, { panel_bg: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar panel_bg:", err); }
  };
  const savePanelOpacity = async (v) => {
    setPanelOpacity(v);
    if (user) try { await supa.upsertProfile(user.id, { panel_opacity: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar panel_opacity:", err); }
  };
  const saveSidebarColor = async (c) => {
    setSidebarColor(c);
    if (user) try { await supa.upsertProfile(user.id, { sidebar_color: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar sidebar_color:", err); }
  };
  const saveSavedThemes = (themes) => {
    setSavedThemes(themes);
    try { localStorage.setItem("trackall_themes", JSON.stringify(themes)); } catch {}
  };
  const saveTextContrast = async (v) => {
    setTextContrast(v);
    if (user) try { await supa.upsertProfile(user.id, { text_contrast: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar text_contrast:", err); }
  };
  const saveTextContrastMobile = async (v) => {
    setTextContrastMobile(v);
    if (user) try { await supa.upsertProfile(user.id, { text_contrast_mobile: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar text_contrast_mobile:", err); }
  };
  const saveBgColorMobile = async (c) => {
    setBgColorMobile(c);
    if (user) try { await supa.upsertProfile(user.id, { bg_color_mobile: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_color_mobile:", err); }
  };
  const saveBg = async (c) => {
    setBgColor(c);
    setDarkMode(isColorDark(c));
    if (user) try { await supa.upsertProfile(user.id, { bg_color: c }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_color:", err); }
  };
  const saveBgOverlay = async (o) => {
    setBgOverlay(o);
    if (user) try { await supa.upsertProfile(user.id, { bg_overlay: o }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_overlay:", err); }
  };
  const saveBgBlur = async (v) => {
    setBgBlur(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_blur: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_blur:", err); }
  };
  const saveBgParallax = async (v) => {
    setBgParallax(v);
    if (user) try { await supa.upsertProfile(user.id, { bg_parallax: v }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_parallax:", err); }
  };
  // isMobile check — calculado uma vez, estável entre renders
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  // Reativo à largura (só muda ao cruzar os 768px; o teclado do telemóvel não altera a largura).
  // Permite ver o layout de telemóvel no PC só redimensionando a janela / usando o simulador do browser.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobileDevice(e.matches);
    setIsMobileDevice(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else mq.removeListener(onChange); };
  }, []);

  // Sincronizar refs com estados para o back handler
  useEffect(() => { selectedItemRef.current = selectedItem; }, [selectedItem]);
  useEffect(() => { logOpenRef.current = logOpen; }, [logOpen]);
  useEffect(() => { showTierlistEditorRef.current = showTierlistEditor; }, [showTierlistEditor]);
  useEffect(() => { viewingTierlistRef.current = viewingTierlist; }, [viewingTierlist]);
  useEffect(() => { showCollectionEditorRef.current = showCollectionEditor; }, [showCollectionEditor]);
  useEffect(() => { viewingCollectionRef.current = viewingCollection; }, [viewingCollection]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // ── Android Back Button ──
  useEffect(() => {
    if (!isMobileDevice) return;
    // Empurrar estado inicial para o history
    window.history.pushState({ trackall: true }, "");
    const onPop = () => {
      // Fechar o primeiro estado aberto encontrado
      if (selectedItemRef.current) { setSelectedItem(null); window.history.pushState({ trackall: true }, ""); return; }
      if (logOpenRef.current) { setLogOpen(false); window.history.pushState({ trackall: true }, ""); return; }
      if (showTierlistEditorRef.current) { setShowTierlistEditor(false); window.history.pushState({ trackall: true }, ""); return; }
      if (viewingTierlistRef.current) { setViewingTierlist(null); window.history.pushState({ trackall: true }, ""); return; }
      if (showCollectionEditorRef.current) { setShowCollectionEditor(false); window.history.pushState({ trackall: true }, ""); return; }
      if (viewingCollectionRef.current) { setViewingCollection(null); window.history.pushState({ trackall: true }, ""); return; }
      if (viewRef.current !== "home") { setView("home"); window.history.pushState({ trackall: true }, ""); return; }
      // Nada aberto + home → sair (deixar o browser fazer pop normal)
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isMobileDevice]);

  const canUseMainSwipe = isMobileDevice
    && MAIN_SWIPE_VIEWS.includes(view)
    && !selectedItem
    && !viewingTierlist
    && !showTierlistEditor
    && !showCollectionEditor
    && !logOpen
    && !logPendingItem;

  const hasHorizontalScrollableParent = (target, dx = 0) => {
    let el = target instanceof HTMLElement ? target : null;
    while (el && el !== document.body) {
      const ox = window.getComputedStyle(el)?.overflowX || "";
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 8) {
        if (dx === 0) return true;
        if (dx > 0 && el.scrollLeft > 2) return true;
        if (dx < 0 && el.scrollLeft < el.scrollWidth - el.clientWidth - 2) return true;
      }
      el = el.parentElement;
    }
    return false;
  };
  const isMainSwipeBlockedTarget = (target, dx = 0) => {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest('input,textarea,select,[contenteditable="true"],.modal,.bottom-nav,.top-nav-bar')) return true;
    if (target.closest(".recents-row,.tabs-scroll")) return true;
    if (hasHorizontalScrollableParent(target, dx)) return true;
    return false;
  };
  const resetMainSwipe = () => { mainSwipeRef.current = { tracking: false, blocked: false, isHorizontal: false, startX: 0, startY: 0, lastX: 0, lastY: 0, startTarget: null, peekShown: false }; };
  const hidePeek = () => {
    const el = mainSwipePeekRef.current; if (!el) return;
    el.style.opacity = "0";
    el.style.display = "none";
  };
  const showPeek = (targetView, dir) => {
    const el = mainSwipePeekRef.current; if (!el) return;
    mainSwipePeekState.current.dir = dir;
    const tabInfo = { home: ["home", "Home"], library: ["library", lang === "en" ? "Library" : "Biblioteca"], friends: ["friends", lang === "en" ? "Friends" : "Amigos"], profile: ["profile", lang === "en" ? "Profile" : "Perfil"] };
    const [icon, label] = tabInfo[targetView] || ["", ""];
    const icon_el = el.querySelector("[data-peek-icon]");
    const label_el = el.querySelector("[data-peek-label]");
    const glyph = { home: "⌂", library: "▤", friends: "◔", profile: "◉" }[icon] || "";
    if (icon_el) icon_el.textContent = glyph;
    if (label_el) { label_el.textContent = label; }
    el.style.display = "block";
    el.style.opacity = "1";
  };
  const applyMainSwipeStyle = (offset = 0, transition = "none") => {
    const W = window.innerWidth || 360;
    const cur = mainSwipeContentRef.current; const peek = mainSwipePeekRef.current;
    const dir = mainSwipePeekState.current.dir;
    if (cur) {
      cur.style.transition = transition === "none" ? "none" : transition.replace(/transform/g, "transform, opacity"); cur.style.transform = `translate3d(${offset}px,0,0)`; cur.style.willChange = offset !== 0 ? "transform, opacity" : "auto";
      cur.style.opacity = offset === 0 ? "1" : String(1 - Math.min(Math.abs(offset) / W, 1) * 0.5);
    }
    const pill = peek && peek.querySelector("[data-peek-content]");
    if (pill) {
      const abs = Math.abs(offset);
      const cx = dir > 0 ? W + offset / 2 : offset / 2;
      const t = Math.min(1, abs / 90);
      pill.style.transition = transition === "none" ? "none" : transition.replace(/transform/g, "transform, opacity");
      pill.style.transform = `translate3d(${cx}px, -50%, 0) translateX(-50%) scale(${0.7 + 0.3 * t})`;
      pill.style.opacity = String(t);
    }
  };
  const animateMainSwipeToView = (nextView, direction) => {
    const W = window.innerWidth || 360;
    if (mainSwipeAnimRef.current) clearTimeout(mainSwipeAnimRef.current);
    applyMainSwipeStyle(direction * -W, "transform 260ms cubic-bezier(0.25,0.46,0.45,0.94)");
    mainSwipeAnimRef.current = setTimeout(() => {
      // flushSync força o React a re-renderizar a nova view de forma síncrona
      // ANTES de escondermos o peek — assim nunca há flash de conteúdo vazio
      flushSync(() => { setView(nextView); });
      hidePeek();
      const cur = mainSwipeContentRef.current;
      if (cur) { cur.style.transition = "none"; cur.style.transform = "translate3d(0,0,0)"; cur.style.opacity = "1"; cur.style.willChange = "auto"; }
      mainSwipeAnimRef.current = null;
    }, 260);
  };
  const handleMainSwipeStart = (e) => {
    if (!canUseMainSwipe) return;
    const touch = e.touches?.[0]; if (!touch) return;
    if (mainSwipeAnimRef.current) { clearTimeout(mainSwipeAnimRef.current); mainSwipeAnimRef.current = null; }
    hidePeek();
    const cur = mainSwipeContentRef.current; if (cur) { cur.style.transition = "none"; cur.style.transform = "translate3d(0,0,0)"; cur.style.opacity = "1"; }
    mainSwipeRef.current = { tracking: true, blocked: !!(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"],.modal,.bottom-nav,.top-nav-bar')), startTarget: e.target, isHorizontal: false, peekShown: false, startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY };
  };
  const handleMainSwipeMove = (e) => {
    const state = mainSwipeRef.current;
    if (!state.tracking || state.blocked) return;
    const touch = e.touches?.[0]; if (!touch) return;
    state.lastX = touch.clientX; state.lastY = touch.clientY;
    const dx = touch.clientX - state.startX, dy = touch.clientY - state.startY;
    if (!state.isHorizontal && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 0.9) {
      if (isMainSwipeBlockedTarget(state.startTarget, dx)) { state.blocked = true; return; }
      state.isHorizontal = true;
    }
    if (state.isHorizontal) {
      const ci = MAIN_SWIPE_VIEWS.indexOf(view), atFirst = ci <= 0, atLast = ci >= MAIN_SWIPE_VIEWS.length - 1;
      if (!state.peekShown) { state.peekShown = true; if (dx < 0 && !atLast) showPeek(MAIN_SWIPE_VIEWS[ci + 1], 1); else if (dx > 0 && !atFirst) showPeek(MAIN_SWIPE_VIEWS[ci - 1], -1); }
      let off = dx * 0.98; if ((atFirst && dx > 0) || (atLast && dx < 0)) off = dx * 0.18;
      applyMainSwipeStyle(off, "none"); if (e.cancelable) e.preventDefault(); return;
    }
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { state.blocked = true; applyMainSwipeStyle(0, "transform 200ms ease"); }
  };
  const handleMainSwipeEnd = () => {
    const state = mainSwipeRef.current; resetMainSwipe();
    if (!canUseMainSwipe || !state.tracking || state.blocked || !state.isHorizontal) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    const dx = state.lastX - state.startX, dy = state.lastY - state.startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.1) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    const ci = MAIN_SWIPE_VIEWS.indexOf(view);
    if (ci === -1) { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); return; }
    if (dx < 0 && ci < MAIN_SWIPE_VIEWS.length - 1) animateMainSwipeToView(MAIN_SWIPE_VIEWS[ci + 1], 1);
    else if (dx > 0 && ci > 0) animateMainSwipeToView(MAIN_SWIPE_VIEWS[ci - 1], -1);
    else { hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); }
  };
  const handleMainSwipeCancel = () => { resetMainSwipe(); hidePeek(); applyMainSwipeStyle(0, "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)"); };
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  /* const mainSwipeTabs = [
    { id: "home", icon: "⌂", label: useT("home") },
    { id: "library", icon: "▤", label: useT("library") },
    { id: "friends", icon: "◔", label: useT("friends") },
    { id: "profile", icon: "◉", label: lang === "en" ? "Profile" : "Perfil" },
  ]; */
  const saveBgImage = async (img) => {
    if (bgSeparateDevices) {
      if (isMobileDevice) {
        setBgImageMobile(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image_mobile:", err); }
      } else {
        setBgImage(img);
        if (user) try { await supa.upsertProfile(user.id, { bg_image: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image:", err); }
      }
    } else {
      setBgImage(img);
      setBgImageMobile(img);
      if (user) try { await supa.upsertProfile(user.id, { bg_image: img, bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image:", err); }
    }
  };
  const saveMobileBgImage = async (img) => {
    setBgImageMobile(img);
    if (user) try { await supa.upsertProfile(user.id, { bg_image_mobile: img }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_image_mobile:", err); }
  };
  const saveBgSeparateDevices = async (val) => {
    setBgSeparateDevices(val);
    if (user) try { await supa.upsertProfile(user.id, { bg_separate_devices: val }); } catch (err) { console.error("[TrackAll] Erro ao guardar bg_separate_devices:", err); }
  };
  const saveTmdbKey = async (k) => {
    setTmdbKey(k);
    if (user) try { await supa.upsertProfile(user.id, { tmdb_key: k }); } catch (err) { console.error("[TrackAll] Erro ao guardar tmdb_key:", err); }
  };
  const saveWorkerUrl = async (k) => {
    setWorkerUrl(k);
    if (user) try { await supa.upsertProfile(user.id, { worker_url: k }); } catch (err) { console.error("[TrackAll] Erro ao guardar worker_url:", err); }
  };

  const addToLibrary = useCallback((item, status, rating = 0) => {
    const normalizedItem = normalizeMediaItem(item);
    const existing = findLibraryEntry(library, normalizedItem.id, normalizedItem.type);
    const canonicalId = normalizeMediaId(normalizedItem.id, normalizedItem.type);
    const lib = { ...library };
    if (existing?.key && existing.key !== canonicalId) delete lib[existing.key];
    lib[canonicalId] = {
      ...(existing?.item || {}),
      ...normalizedItem,
      id: canonicalId,
      userStatus: status,
      userRating: rating,
      addedAt: Date.now(),
    };
    saveLibrary(lib);
    showNotif(`"${(normalizedItem.title || "Item").slice(0, 30)}" adicionado!`, "#10b981");
    if (navigator.vibrate) navigator.vibrate(50);
  }, [library]);


  const importPaperback = async (pbItems) => {
    const lib = { ...library };
    let added = 0, updated = 0;
    const needsCover = []; // itens novos que precisam de capa
    const existingByTitle = {};
    Object.values(lib).forEach(e => { const n = (e.title||'').toLowerCase().trim(); if (n) existingByTitle[n] = e.id; });
    pbItems.forEach(item => {
      const norm = (item.title || "").toLowerCase().trim();
      const existingId = existingByTitle[norm];
      if (lib[item.id]) {
        lib[item.id] = { ...lib[item.id], userStatus: item.userStatus, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else if (existingId) {
        lib[existingId] = { ...lib[existingId], userStatus: item.userStatus, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else {
        lib[item.id] = { ...item, userRating: 0 };
        added++;
        // Marcar para enriquecimento de capa se não tiver cover fiável
        needsCover.push({ id: item.id, title: item.title, type: item.type });
      }
    });
    saveLibrary(lib);
    showNotif(`Paperback: ${added} adicionados, ${updated} atualizados ✓ — A buscar capas...`, "#10b981");

    // ── Enriquecimento de capas em background ──
    // Processa em lotes de 3 para não sobrecarregar as APIs
    const enrichCover = async (id, title, type) => {
      try {
        let cover = '';
        if (type === 'comics') {
          const results = await searchComicVine(title, workerUrl);
          if (results?.length) {
            // Tentar match exato primeiro, senão usar o primeiro resultado
            const exact = results.find(r => r.title.toLowerCase() === title.toLowerCase());
            cover = (exact || results[0]).cover;
          }
        } else {
          // manga / manhwa — usar AniList
          const results = await searchAniList(title, 'MANGA');
          if (results?.length) {
            const exact = results.find(r => r.title.toLowerCase() === title.toLowerCase());
            cover = (exact || results[0]).cover;
          }
        }
        if (cover) {
          // Usar setLibrary com callback para não perder atualizações concorrentes
          setLibrary(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev, [id]: { ...prev[id], cover } };
            // Persistir no Supabase em background
            if (user) supa.upsertLibraryItem(user.id, id, next[id]).catch(() => {});
            return next;
          });
        }
      } catch { /* silent */ }
    };

    // Processar em lotes
    for (let i = 0; i < needsCover.length; i += 3) {
      const batch = needsCover.slice(i, i + 3);
      await Promise.all(batch.map(({ id, title, type }) => enrichCover(id, title, type)));
      if (i + 3 < needsCover.length) await new Promise(r => setTimeout(r, 400)); // throttle
    }

    if (needsCover.length > 0) showNotif(`Capas atualizadas ✓`, "#10b981");
  };

  const importLetterboxd = async (lbItems) => {
    const lib = { ...library };
    let added = 0, updated = 0;
    const existingByTitle = {};
    Object.values(lib).forEach(e => { const n = (e.title||'').toLowerCase().trim(); if (n) existingByTitle[n] = e.id; });
    lbItems.forEach(item => {
      const norm = (item.title || "").toLowerCase().trim();
      const existingId = existingByTitle[norm];
      if (lib[item.id]) {
        lib[item.id] = { ...lib[item.id], userStatus: 'completo', userRating: item.userRating || lib[item.id].userRating };
        updated++;
      } else if (existingId) {
        lib[existingId] = { ...lib[existingId], userStatus: 'completo', userRating: item.userRating || lib[existingId].userRating };
        updated++;
      } else {
        lib[item.id] = { ...item };
        added++;
      }
    });
    saveLibrary(lib);
    showNotif(`Letterboxd: ${added} filmes adicionados, ${updated} atualizados ✓`, "#00e054");
  };

  const importMihon = async (items) => {
    const lib = { ...library };
    let added = 0, updated = 0, skipped = 0;

    // Build title lookup for existing library items (normalize to lowercase)
    const existingByTitle = {};
    Object.values(lib).forEach(entry => {
      const norm = (entry.title || '').toLowerCase().trim();
      if (norm) existingByTitle[norm] = entry.id;
    });

    const coversMissing = [];

    items.forEach(item => {
      const norm = item.title.toLowerCase().trim();
      const existingId = existingByTitle[norm];

      if (lib[item.id]) {
        // Exact ID match — update progress only
        lib[item.id] = { ...lib[item.id], userStatus: item.userStatus, lastChapter: item.lastChapter, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else if (existingId) {
        // Title match — update progress on existing entry, don't create duplicate
        lib[existingId] = { ...lib[existingId], userStatus: item.userStatus, lastChapter: item.lastChapter, chaptersRead: item.chaptersRead, totalChapters: item.totalChapters };
        updated++;
      } else {
        // New entry
        lib[item.id] = { ...item, userRating: 0, addedAt: Date.now() };
        added++;
        if (!item.thumbnailUrl || item.thumbnailUrl.includes('mangadex.org/covers')) {
          coversMissing.push(item);
        }
      }
    });

    saveLibrary(lib);
    showNotif(`Mihon: ${added} adicionados, ${updated} atualizados${skipped ? `, ${skipped} ignorados` : ''} ✓`, "#10b981");

    // Fetch missing covers from AniList
    if (!coversMissing.length) return;
    showNotif(`A buscar capas para ${coversMissing.length} mangas...`, accent);

    const chunkSize = 10;
    const updatedLib = { ...lib };
    for (let i = 0; i < coversMissing.length; i += chunkSize) {
      const chunk = coversMissing.slice(i, i + chunkSize);
      const queryParts = chunk.map((item, idx) => `
        m${idx}: Media(search: ${JSON.stringify(item.title)}, type: MANGA, sort: SEARCH_MATCH) {
          id coverImage { large medium } title { romaji english }
        }`).join('\n');
      try {
        const wUrlMihon = (workerUrl || "https://trackall-proxy.mcmeskajr.workers.dev").replace(/\/$/, "");
        const data = await fetchAniListSafe(["https://graphql.anilist.co", `${wUrlMihon}/anilist`], JSON.stringify({ query: `query { ${queryParts} }` }));
        if (data?.data) {
          chunk.forEach((item, idx) => {
            const result = data.data[`m${idx}`];
            if (result?.coverImage) {
              const cover = result.coverImage.large || result.coverImage.medium;
              if (cover && updatedLib[item.id]) {
                updatedLib[item.id] = { ...updatedLib[item.id], cover, thumbnailUrl: cover };
              }
            }
          });
        }
      } catch {}
      if (i + chunkSize < coversMissing.length) await new Promise(r => setTimeout(r, 500));
    }
    saveLibrary(updatedLib);
    showNotif(`Capas atualizadas ✓`, "#10b981");
  };
  const removeFromLibrary = (id) => {
   const matched = findLibraryEntry(library, id);
   if (!matched) return;
   const lib = { ...library };
   delete lib[matched.key];
   saveLibrary(lib);
   const removed = { key: matched.key, item: matched.item };
   showNotif(lang === "en" ? "Removed from library" : "Removido da biblioteca", "#ef4444", {
     label: lang === "en" ? "Undo" : "Desfazer",
     onClick: () => {
       if (libraryRef.current[removed.key]) return;
       saveLibrary({ ...libraryRef.current, [removed.key]: removed.item });
       showNotif(lang === "en" ? "Restored ✓" : "Reposto ✓", "#10b981");
     },
   });

  };
  const updateDuration = useCallback((id, type, dur) => {
    if (!dur.episodes && !dur.chapters && !dur.runtime) return;
    const matched = findLibraryEntry(libraryRef.current, id, type);
    if (!matched) return;
    // Só actualiza se faltar algum campo
    if (matched.item.episodes || matched.item.chapters || matched.item.runtime) return;
    const canonicalId = normalizeMediaId(id, type);
    const next = { ...libraryRef.current };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, episodes: dur.episodes || matched.item.episodes, chapters: dur.chapters || matched.item.chapters, runtime: dur.runtime || matched.item.runtime };
    saveLibrary(next);
  }, [library]);

  const updateNote = useCallback((id, note) => {
    const matched = findLibraryEntry(libraryRef.current, id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item.type);
    const next = { ...libraryRef.current };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, userNote: note };
    saveLibrary(next);
  }, [library]);

  const updateStatus = useCallback((id, status) => {
    const matched = findLibraryEntry(libraryRef.current, id);
    if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const update = { ...matched.item, id: canonicalId, userStatus: status };
    // Atualizar addedAt quando muda para completo — para o diário mostrar a data correta
    if (status === "completo") {
      update.addedAt = Date.now();
      if (!update.completedAt) update.completedAt = Date.now();
    }
    const next = { ...libraryRef.current };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = update;
    saveLibrary(next);
    showNotif(useT("statusUpdated"), accent);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [library, accent]);

  const updateLastChapter = useCallback((id, chapter) => {
    const matched = findLibraryEntry(libraryRef.current, id);
    if (!matched || !chapter) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...libraryRef.current };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, lastChapter: chapter };
    saveLibrary(next);
    showNotif(`Capítulo: ${chapter} ✓`, accent);
  }, [library, accent]);
  const updateRating = (id, rating) => {
   const matched = findLibraryEntry(libraryRef.current, id);
   if (!matched) return;
   const canonicalId = normalizeMediaId(id, matched.item?.type);
   const next = { ...libraryRef.current };
   if (matched.key !== canonicalId) delete next[matched.key];
   next[canonicalId] = { ...matched.item, id: canonicalId, userRating: rating };
   saveLibrary(next);
   showNotif(rating > 0 ? `${rating} ★` : useT("ratingRemoved"), "#f59e0b");

  };
  const updateCover = async (id, url) => {
   const matched = findLibraryEntry(library, id);
   if (!matched) return;
    const canonicalId = normalizeMediaId(id, matched.item?.type);
    const next = { ...library };
    if (matched.key !== canonicalId) delete next[matched.key];
    next[canonicalId] = { ...matched.item, id: canonicalId, customCover: url };
    saveLibrary(next);
    // Sincronizar cover nos favoritos se este item estiver lá
    const inFavs = favorites.some(f => f.id === id || f.id === matched.key || f.id === canonicalId);
    if (inFavs) {
      const newFavs = favorites.map(f => (f.id === id || f.id === matched.key || f.id === canonicalId) ? { ...f, id: canonicalId, customCover: url } : f);
      setFavorites(newFavs);
      if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
    }
    const currentHall = Array.isArray(profile?.hallOfFame) ? profile.hallOfFame : [];
    const inHall = currentHall.some(f => f.id === id || f.id === matched.key || f.id === canonicalId);
    if (inHall) {
      const newHall = currentHall.map(f => (f.id === id || f.id === matched.key || f.id === canonicalId) ? { ...f, id: canonicalId, customCover: url } : f);
      setProfile(prev => ({ ...prev, hallOfFame: newHall }));
      await persistHall(newHall, undefined);
    }
    showNotif(useT("coverUpdated"), accent);
  };

  const toggleFavorite = async (item) => {
    const normalizedItem = normalizeMediaItem(item);
    const favoriteIds = new Set(mediaIdCandidates(normalizedItem.id, normalizedItem.type));
    const exists = favorites.some(f => favoriteIds.has(f.id));
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => !favoriteIds.has(f.id));
      showNotif("Removido dos favoritos", "#8b949e");
    } else {
      if (favorites.length >= 30) { showNotif("Máximo de 30 favoritos!", "#ef4444"); return; }
      const libItem = getLibraryMatch(normalizedItem.id, normalizedItem.type)?.item;
      newFavs = [...favorites, { id: normalizedItem.id, title: normalizedItem.title, cover: normalizedItem.cover, customCover: libItem?.customCover || normalizedItem.customCover || "", type: normalizedItem.type }];
      showNotif(useT("addedToFavorites"), "#f59e0b");
      if (navigator.vibrate) navigator.vibrate(50);
    }
    setFavorites(newFavs);
    if (user) try { await supa.updateFavorites(user.id, newFavs); } catch {}
  };

  const doSearch = useCallback(async (q, type) => {
    if (!q.trim()) return;
    const mySeq = ++searchSeqRef.current;
    const qNorm = q.trim().toLowerCase();
    const isNewQuery = qNorm !== searchQueryRef.current;
    searchQueryRef.current = qNorm;
    setIsSearching(true); setSearchError(""); setView("search");
    if (isNewQuery) setSearchResultsByType({});
    try {
      if (type === "all") {
        const [anime, manga, manhwa, lightnovels, livros, filmes, series, jogos, comics] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manhwa", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "lightnovels", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "livros", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "jogos", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "comics", { tmdb: tmdbKey, workerUrl }),
        ]);
        const byType = {
          anime: anime.status === "fulfilled" ? anime.value || [] : [],
          manga: manga.status === "fulfilled" ? manga.value || [] : [],
          manhwa: manhwa.status === "fulfilled" ? manhwa.value || [] : [],
          lightnovels: lightnovels.status === "fulfilled" ? lightnovels.value || [] : [],
          livros: livros.status === "fulfilled" ? livros.value || [] : [],
          filmes: filmes.status === "fulfilled" ? filmes.value || [] : [],
          series: series.status === "fulfilled" ? series.value || [] : [],
          jogos: jogos.status === "fulfilled" ? jogos.value || [] : [],
          comics: comics.status === "fulfilled" ? comics.value || [] : [],
        };
        // Ignorar se entretanto já foi disparada outra pesquisa mais recente
        if (searchSeqRef.current !== mySeq) return;
        setSearchResultsByType(byType);
      } else {
        // Limpar cache para garantir resultados frescos ao trocar de tipo
        const ck = cacheKey(q, type);
        CACHE.delete(ck);
        const typeResults = (await smartSearch(q, type, { tmdb: tmdbKey, workerUrl })) || [];
        // Ignorar se entretanto já foi disparada outra pesquisa mais recente
        // (ex: trocaste de separador antes desta responder) — nunca apagar
        // os resultados já obtidos para os outros tipos.
        if (searchSeqRef.current !== mySeq) return;
        setSearchResultsByType(prev => ({ ...prev, [type]: typeResults }));
      }
      // Guardar no histórico
      if (q.trim()) {
        setSearchHistory(prev => {
          const next = [q.trim(), ...prev.filter(h => h.toLowerCase() !== q.trim().toLowerCase())].slice(0, 8);
          try { localStorage.setItem("trackall_search_history", JSON.stringify(next)); } catch {}
          return next;
        });
      }
    } catch (e) {
      if (searchSeqRef.current === mySeq) setSearchError("Erro ao pesquisar. Verifica a tua ligação à internet.");
    } finally {
      if (searchSeqRef.current === mySeq) setIsSearching(false);
    }
  }, [tmdbKey, workerUrl]);

  // Log quick-add search — respects quickSearchType filter
  const doLogSearch = useCallback(async (q) => {
    if (!q.trim()) { setLogResults([]); return; }
    setLogSearching(true);
    try {
      let results = [];
      if (quickSearchType) {
        results = await smartSearch(q, quickSearchType, { tmdb: tmdbKey, workerUrl });
      } else {
        const [anime, manga, filmes, series] = await Promise.allSettled([
          smartSearch(q, "anime", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "manga", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "filmes", { tmdb: tmdbKey, workerUrl }),
          smartSearch(q, "series", { tmdb: tmdbKey, workerUrl }),
        ]);
        const all = [...(anime.value||[]), ...(manga.value||[]), ...(filmes.value||[]), ...(series.value||[])];
        const seen = new Set();
        results = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      }
      setLogResults(results.slice(0, 8));
    } catch (err) {
      console.error('[QuickLog] Erro na pesquisa:', err);
      setLogResults([]);
    }
    setLogSearching(false);
  }, [tmdbKey, workerUrl, quickSearchType]);

  useEffect(() => {
    if (logOpen) setTimeout(() => logInputRef.current?.focus(), 80);
    else { setLogQuery(""); setLogResults([]); }
  }, [logOpen]);

  useEffect(() => {
    const t = setTimeout(() => { if (logQuery) doLogSearch(logQuery); else setLogResults([]); }, 600);
    return () => clearTimeout(t);
  }, [logQuery, quickSearchType]);

  const items = useMemo(() => {
    if (demoMode) return Object.values(DEMO_LIBRARY);
    return Object.values(library);
  }, [library, demoMode]);

  const activeProfile = demoMode ? DEMO_PROFILE : profile;
  const activeFavorites = demoMode ? DEMO_PROFILE.favorites : (Array.isArray(favorites) ? favorites : []);

  const stats = useMemo(() => ({
    assistindo: items.filter((i) => i.userStatus === "assistindo").length,
    completo: items.filter((i) => i.userStatus === "completo").length,
    planejado: items.filter((i) => i.userStatus === "planejado").length,
  }), [items]);

  const filteredLib = useMemo(() => items.filter((i) => {
    if (filterStatus !== "all" && i.userStatus !== filterStatus) return false;
    if (activeTab !== "all" && i.type !== activeTab) return false;
    if (filterRating === "rated" ? !(i.userRating > 0) : (filterRating !== null && i.userRating !== filterRating)) return false;
    if (libSearch.trim() && !i.title?.toLowerCase().includes(libSearch.toLowerCase().trim())) return false;
    return true;
  }), [items, filterStatus, activeTab, libSearch, filterRating]);

  // Estatísticas do perfil → abre a Biblioteca já filtrada
  const openLibraryFiltered = ({ type, status, rating, sort } = {}) => {
    setActiveTab(type || "all");
    setFilterStatus(status || "all");
    setFilterRating(rating ?? null);
    setLibSearch("");
    if (sort) setLibSort(sort);
    setView("library");
  };

  const sortedLib = useMemo(() => {
    const arr = [...filteredLib];
    if (libSort === "title") return arr.sort((a,b) => (a.title||"").localeCompare(b.title||""));
    if (libSort === "rating") return arr.sort((a,b) => (b.userRating||0) - (a.userRating||0));
    return arr.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
  }, [filteredLib, libSort]);

  const accentRgb = useMemo(() => `${parseInt(accent.slice(1, 3), 16)},${parseInt(accent.slice(3, 5), 16)},${parseInt(accent.slice(5, 7), 16)}`, [accent]);

  // Stat colors pré-calculados — evita accentShade() em cada render
  const homeStatColors = useMemo(() => ({
    assistindo: accentShade(accent, 0),
    completo:   accentShade(accent, 15),
    pausa:      accentShade(accent, 30),
    largado:    accentShade(accent, -20),
    planejado:  accentShade(accent, 45),
  }), [accent]);

  const homeDashboard = useMemo(() => {
    const plannedStatuses = new Set(["planejado", "planeado"]);
    const pausedStatuses = new Set(["pausado", "pausa"]);
    const watchTypes = new Set(["anime", "filmes", "series"]);
    const readTypes = new Set(["manga", "livros", "comics"]);
    const actionable = items.filter(i => i && i.userStatus !== "completo" && i.userStatus !== "largado" && i.userStatus !== "dropado");
    const withPriority = (list, extra = () => 0) => [...list].sort((a, b) => {
      const aScore = ((a.userRating || 0) * 20) + (a.score || 0) + extra(a);
      const bScore = ((b.userRating || 0) * 20) + (b.score || 0) + extra(b);
      if (bScore !== aScore) return bScore - aScore;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

    const inProgress = withPriority(actionable.filter(i => i.userStatus === "assistindo"), () => 30);
    const paused = withPriority(actionable.filter(i => pausedStatuses.has(i.userStatus)), () => 12);
    const planned = withPriority(actionable.filter(i => plannedStatuses.has(i.userStatus)), () => 4);
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const seededPick = (arr, offset = 0) => arr.length ? arr[(daySeed + offset) % arr.length] : null;

    const currentFocus = inProgress[0] || paused[0] || planned[0] || null;

    // Forgotten: mais antigo no Planejo, excluindo currentFocus
    const oldestPlanned = [...planned]
      .filter(i => i.id !== currentFocus?.id)
      .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    const forgottenPlanned = seededPick(oldestPlanned.slice(0, Math.min(8, oldestPlanned.length)), 1) || oldestPlanned[0] || null;

    // Worth Returning: pausados, excluindo currentFocus
    const pausedFiltered = paused.filter(i => i.id !== currentFocus?.id);
    const worthReturning = seededPick(pausedFiltered, 2) || pausedFiltered[0] || null;

    // Best for Today: candidatos excluindo currentFocus, forgotten e worthReturning
    // Com diversidade de tipos — não repetir o mesmo tipo que currentFocus
    const excludeIds = new Set([currentFocus?.id, forgottenPlanned?.id, worthReturning?.id].filter(Boolean));
    const bestCandidates = withPriority(actionable, (item) => {
      if (item.userStatus === "assistindo") return 28;
      if (pausedStatuses.has(item.userStatus)) return 14;
      if (watchTypes.has(item.type)) return 6;
      return 0;
    }).filter(item => !excludeIds.has(item.id));

    const prime = 31;
    const seededPickPrime = (arr, offset = 0) => arr.length ? arr[Math.abs((daySeed * prime + offset * 17)) % arr.length] : null;

    // Diversidade: para cada slot, preferir tipo diferente dos slots já preenchidos
    const pickWithDiversity = (candidates, usedTypes, seed, offset) => {
      if (!candidates.length) return null;
      // Primeiro tentar tipo não usado
      const fresh = candidates.filter(i => !usedTypes.has(i.type));
      if (fresh.length > 0) return seededPickPrime(fresh.slice(0, Math.min(10, fresh.length)), offset);
      // Fallback: qualquer candidato
      return seededPickPrime(candidates.slice(0, Math.min(10, candidates.length)), offset);
    };

    const usedTypes = new Set([currentFocus?.type].filter(Boolean));

    // Best for Today — tipo diferente do currentFocus
    const bestForToday = pickWithDiversity(bestCandidates, usedTypes, daySeed, 0) || bestCandidates[0] || null;
    if (bestForToday) usedTypes.add(bestForToday.type);

    // Forgotten — tipo diferente dos anteriores, dos mais antigos no planejo
    const forgottenDiverse = oldestPlanned.filter(i => !usedTypes.has(i.type));
    const forgottenFinal = forgottenDiverse.length > 0
      ? (seededPickPrime(forgottenDiverse.slice(0, Math.min(8, forgottenDiverse.length)), 1) || forgottenDiverse[0])
      : forgottenPlanned;
    if (forgottenFinal) usedTypes.add(forgottenFinal.type);

    // Worth Returning — tipo diferente dos anteriores
    const returnDiverse = pausedFiltered.filter(i => !usedTypes.has(i.type));
    const worthReturningFinal = returnDiverse.length > 0
      ? (seededPickPrime(returnDiverse, 2) || returnDiverse[0])
      : worthReturning;

    const quickPicks = [];
    const pushPick = (slot, item) => {
      if (!item || quickPicks.some(p => p.item?.id === item.id)) return;
      quickPicks.push({ slot, item });
    };
    if (currentFocus) pushPick("focus", currentFocus);
    pushPick("today", bestForToday);
    pushPick("forgotten", forgottenFinal || forgottenPlanned);
    pushPick("return", worthReturningFinal || worthReturning);

    return {
      currentFocus,
      quickPicks: quickPicks.slice(0, 4),
    };
  }, [items]);

  // Loading screen
  if (authLoading) return <AppSkeleton accent={accent} />;

  // Servidor não respondeu: não mostra uma app vazia (parece que perdeste os dados)
  if (bootError && user) {
    const hardLogout = async () => {
      try { await Promise.race([supa.signOut(), new Promise(r => setTimeout(r, 3000))]); } catch {}
      try { Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k)); } catch {}
      window.location.reload();
    };
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#0d1117", color: "#e6edf3", fontFamily: "'Outfit', 'Segoe UI', sans-serif" }}>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 34 }}>📡</div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Não consegui ligar ao servidor</h2>
          <p style={{ fontSize: 14, color: "#8b949e", lineHeight: 1.6 }}>Os teus dados estão seguros, mas não chegaram agora. Pode ser a ligação ou o serviço estar indisponível. Tenta outra vez dentro de instantes.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "13px", borderRadius: 12, background: accent, border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Tentar novamente</button>
          <button onClick={hardLogout} style={{ padding: "11px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#8b949e", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Terminar sessão e entrar de novo</button>
        </div>
      </div>
    );
  }

  // Auth screen
  if (!user && !demoMode) {
    if (showLanding) return <LandingPage accent={accent} onEnter={() => setShowLanding(false)} onDemo={() => { setDemoMode(true); setShowLanding(false); }} lang={lang} useT={useT} changeLang={changeLang} />;
    return <AuthScreen onAuth={handleAuth} accent={accent} onBack={() => setShowLanding(true)} lang={lang} useT={useT} />;
  }

  // Which bg image to show based on device + separate setting
  const activeBgImage = bgSeparateDevices
    ? (isMobileDevice ? bgImageMobile : bgImage)
    : bgImage;

  // Active bg color: mobile can have different color when bgSeparateDevices is on
  const activeBgColor = (bgSeparateDevices && isMobileDevice)
    ? (bgColorMobile || "#0d1117")  // mobile sem cor = noturno por defeito, nunca herda PC
    : bgColor;

  // darkMode separado: PC usa bgColor, mobile usa bgColorMobile quando separado está ligado
  // Se bgSeparateDevices ligado e no mobile: usa bgColorMobile se tiver valor, senão mantém darkMode independente do PC
  const activeDarkMode = (bgSeparateDevices && isMobileDevice)
    ? (bgColorMobile ? isColorDark(bgColorMobile) : true)  // mobile sem cor definida = noturno por defeito
    : darkMode;

  // Computed panel bg para uso no CSS global (lib-sidebar)
  const computedPanelBgCSS = (() => {
    if (!panelBg) return activeDarkMode ? "#161b22" : "rgba(255,255,255,0.7)";
    const op = (panelOpacity ?? 100) / 100;
    try {
      const hex = panelBg.replace("#", "");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16);
        const g = parseInt(hex.slice(2,4),16);
        const b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b},${op})`;
      }
    } catch {}
    return panelBg;
  })();

  // Active text contrast: mobile can have different value when bgSeparateDevices is on
  const activeTextContrast = (bgSeparateDevices && isMobileDevice) ? textContrastMobile : textContrast;
  const baseTextColor = activeDarkMode ? "#e6edf3" : "#0d1117";

  return (
    <ThemeContext.Provider value={{ accent, bg: activeBgColor, darkMode: activeDarkMode, isMobileDevice, panelBg: panelBg ? computedPanelBgCSS : null }}>
      <LangContext.Provider value={{ lang, useT }}>
      <div style={{
        minHeight: "100vh",
        background: activeBgColor,
        color: baseTextColor,
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        paddingBottom: 80,
        position: "relative",
        overflowX: "hidden",
      }}>
        {/* Demo mode banner */}
        {demoMode && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>👀 Modo Demonstração — os dados são fictícios</span>
            <button onClick={() => { setDemoMode(false); setShowLanding(false); }} style={{ padding: "5px 14px", borderRadius: 8, background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>{useT("landingCreateFree")}</button>
            <button onClick={() => { setDemoMode(false); setShowLanding(true); }} style={{ padding: "5px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>✕ Sair</button>
          </div>
        )}
        {activeBgImage && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 0,
            backgroundImage: `url(${activeBgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundAttachment: "scroll",
            backgroundRepeat: "no-repeat",
            filter: bgBlur > 0 ? `blur(${bgBlur}px)` : "none",
            transform: bgBlur > 0 ? "scale(1.05)" : "none",
          }} />
        )}
        {activeBgImage && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1,
            background: bgOverlay,
          }} />
        )}
        {/* ── Desktop Sidebar ── */}
        {!isMobileDevice && (() => {
          const libByType = Object.values(library);
          const navItems = [
            { id: "home", icon: "⌂", label: useT("home") },
            { id: "library", icon: "▤", label: useT("library") },
            { id: "profile", icon: "◉", label: useT("profile") },
          ];
          return (
            <aside className="desktop-sidebar">
              {/* Logo */}
              <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}`, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white", flexShrink: 0 }}>T</div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: darkMode ? "#e6edf3" : "#0d1117", letterSpacing: "-0.5px" }}>TrackAll</span>
                </div>
              </div>

              {/* Nav principal */}
              <div style={{ padding: "4px 0" }}>
                {navItems.map((n) => (
                  <button key={n.id} className={`ds-nav-btn${view === n.id ? " active" : ""}`}
                    onClick={() => setView(n.id)}
                    style={view === n.id ? { background: `${accent}1a`, color: accent } : {}}>
                    <span className="ds-icon" style={view === n.id ? { color: accent } : {}}>{n.icon}</span>
                    {n.label}
                  </button>
                ))}
                {/* Amigos */}
                <button className={`ds-nav-btn${view === "friends" ? " active" : ""}`}
                  onClick={() => setView("friends")}
                  style={view === "friends" ? { background: `${accent}1a`, color: accent } : {}}>
                  <span className="ds-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} />
                      <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} opacity="0.7" />
                      <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? accent : (darkMode ? "#8b949e" : "#64748b")} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
                    </svg>
                  </span>
                  {useT("friends")}
                </button>
                <SidebarSearch accent={accent} darkMode={activeDarkMode} activeTab={activeTab} doSearch={doSearch} setSearchQuery={setSearchQuery} setView={setView} useT={useT} />
              </div>

              {/* Botão + Log Rápido */}
              <div style={{ padding: "8px 8px 4px" }}>
                <button onClick={() => { setLogOpen(v => !v); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${accent}44`, background: `${accent}12`, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: accent, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accent}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${accent}12`; }}>
                  <span style={{ fontSize: 18 }}>+</span> {useT("quickLog")}
                </button>
              </div>

              {/* Biblioteca por tipo */}
              {libByType.length > 0 && (
                <>
                  <p className="ds-section" style={{ marginTop: 6, paddingBottom: 6 }}>{useT("library")}</p>
                  {MEDIA_TYPES.slice(1).filter(t => libByType.some(i => i.type === t.id)).map((t, tIdx) => {
                    const cnt = libByType.filter(i => i.type === t.id).length;
                    const isActive = view === "library" && activeTab === t.id;
                    
                    return (
                      <div key={t.id} className="ds-type-item" onClick={() => { setView("library"); setActiveTab(t.id); }}
                        style={{ background: isActive ? `${accent}18` : undefined, borderRadius: 8, color: isActive ? accent : (darkMode ? "#8b949e" : "#64748b") }}>
                        <span style={{ display: "flex", alignItems: "center", width: 18, flexShrink: 0, color: isActive ? accent : (darkMode ? "#8b949e" : "#64748b") }}><TypeIcon id={t.id} size={16} /></span>
                        <span style={{ flex: 1, color: isActive ? accent : (darkMode ? "#c9d1d9" : "#374151"), fontWeight: isActive ? 700 : 500, fontSize: 13 }}>{mediaLabel(t, lang)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? accent : "#484f58" }}>{cnt}</span>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
                </>
              )}

              {/* Avatar + nome em baixo */}
              <div style={{ marginTop: "auto", padding: "16px", borderTop: `1px solid ${darkMode ? "#21262d" : "#e2e8f0"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("profile")}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}66)`, border: `2px solid ${view === "profile" ? accent : "transparent"}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {profile.avatar ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Utilizador"}</p>
                    <p style={{ fontSize: 11, color: "#8b949e" }}>{Object.keys(library).length} {useT("inLibraryCount")}</p>
                  </div>
                </div>
              </div>
            </aside>
          );
        })()}

        <div className="desktop-main tc-zone" style={{ position: "relative", zIndex: 2, minHeight: "100vh", background: activeBgImage ? "transparent" : activeBgColor }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { overscroll-behavior: none; font-family: 'Outfit', 'Segoe UI', sans-serif; }
          :root { --tc: ${activeTextContrast / 100}; }
          ${(() => {
            if (activeTextContrast === 100) return '';
            const base = darkMode ? [230, 237, 243] : [13, 17, 23];
            let r, g, b;
            if (activeTextContrast < 100) {
              const t = activeTextContrast / 100;
              r = Math.round(base[0] * t); g = Math.round(base[1] * t); b = Math.round(base[2] * t);
            } else {
              const t = (activeTextContrast - 100) / 100;
              r = Math.round(base[0] + (255-base[0])*t); g = Math.round(base[1] + (255-base[1])*t); b = Math.round(base[2] + (255-base[2])*t);
            }
            const col = `rgb(${r},${g},${b})`;
            return `
          .tc-zone { color: ${col} !important; }
          .tc-zone p, .tc-zone span, .tc-zone h1, .tc-zone h2, .tc-zone h3,
          .tc-zone h4, .tc-zone h5, .tc-zone li, .tc-zone a { color: ${col} !important; }
          .tc-zone .no-tc, .tc-zone .no-tc *,
          .tc-zone .rating-hover, .tc-zone .rating-hover *,
          .tc-zone .fav-overlay, .tc-zone .fav-overlay *,
          .tc-zone .recent-hover-overlay, .tc-zone .recent-hover-overlay *,
          .tc-zone .btn-accent, .tc-zone .btn-accent * { color: unset !important; }
          `;
          })()}
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${activeDarkMode ? "#30363d" : "#cbd5e1"}; border-radius: 3px; }
          .btn-accent { background: linear-gradient(135deg, ${accent}, ${accent}cc); color: white; border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 700; transition: all 0.2s; }
          .btn-accent:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(${accentRgb},0.4); }
          .card { background: ${activeDarkMode ? "rgba(22,27,34,0.4)" : "rgba(255,252,247,0.55)"}; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid ${activeDarkMode ? "#21262d" : "#e8e0d5"}; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
          .card:hover .card-overlay { opacity: 1 !important; }
          .media-thumb { position: relative; overflow: hidden; border-radius: 10px; }
          .media-thumb .rating-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.52); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(-4px); transition: opacity 0.18s ease, transform 0.18s ease; border-radius: 10px; }
          .media-thumb:hover .rating-hover { opacity: 1; transform: translateY(0); }
          .media-thumb:hover img { transform: scale(1.04); transition: transform 0.25s ease; }
          .media-thumb img { transition: transform 0.25s ease; width: 100%; height: 100%; object-fit: cover; display: block; }
          .tab-btn { background: transparent; border: none; color: ${activeDarkMode ? "#8b949e" : "#64748b"}; cursor: pointer; padding: 7px 14px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s; }
          .tab-btn:hover { color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; background: ${activeDarkMode ? "#21262d" : "#e2e8f0"}; }
          .tab-btn.active { background: ${accent}; color: white; font-weight: 700; }
          input, select, textarea { background: ${activeDarkMode ? "#0d1117" : "#ffffff"}; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; border: 1px solid ${activeDarkMode ? "#30363d" : "#e2e8f0"}; border-radius: 10px; font-family: 'Outfit', sans-serif; transition: border-color 0.15s; }
          input::placeholder { color: ${activeDarkMode ? "#484f58" : "#94a3b8"}; }
          input:focus, select:focus { outline: none; border-color: ${accent}; box-shadow: 0 0 0 3px rgba(${accentRgb},0.1); }
          .modal-bg { font-family: 'Outfit', 'Segoe UI', sans-serif; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
          .modal { background: ${activeDarkMode ? "#161b22" : "#ffffff"}; border: 1px solid ${activeDarkMode ? "#30363d" : "#e2e8f0"}; border-radius: 16px; width: 100%; overflow: hidden; }
          .modal-glass { background: ${activeDarkMode ? "rgba(22,27,34,0.42)" : "rgba(255,255,255,0.5)"} !important; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
          .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
          @media (max-width: 480px) { .media-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
          .recents-row { -webkit-overflow-scrolling: touch; scroll-snap-type: none; scroll-padding-inline: 12px; overscroll-behavior-x: contain; }
          .recents-row > * { scroll-snap-align: start; }
          img { will-change: auto; }
          .card { contain: layout style; }
          @media (max-width: 768px) {
            .card { contain: layout; border: none; border-radius: 8px; transition: none !important; backdrop-filter: none; -webkit-backdrop-filter: none; }
            .fade-in { animation: none !important; }
            .view-transition { animation: none !important; }
            .media-thumb:hover img { transform: none !important; }
            .media-thumb .rating-hover { display: none; }
            .recents-row { -webkit-overflow-scrolling: touch; }
            * { -webkit-tap-highlight-color: transparent; }
            .card-info { display: none; }
            .card-info-title { display: block; font-size: 10px; font-weight: 700; padding: 5px 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: ${activeDarkMode ? "#e6edf3" : "#0d1117"}; }
            .card-info-meta { display: none; }
          }
          @media (max-width: 480px) {
            .modal-bg { backdrop-filter: none !important; background: rgba(0,0,0,0.88) !important; }
          }
          .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${mkNavBg(activeDarkMode, activeBgColor)}; backdrop-filter: blur(12px); border-top: 1px solid ${activeDarkMode ? "rgba(255,255,255,0.07)" : "#e2e8f0"}; display: flex; height: 64px; z-index: 50; }
          .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; transition: color 0.15s; color: ${activeDarkMode ? "#484f58" : "#94a3b8"}; }
          .nav-btn.active { color: ${accent}; }
          .nav-btn:hover { color: ${activeDarkMode ? "#8b949e" : "#64748b"}; }
          .nav-center-btn { flex: 1; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; height: 100%; position: relative; -webkit-tap-highlight-color: transparent; }
          .tabs-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .tabs-scroll::-webkit-scrollbar { display: none; }
          .lib-layout { display: flex; gap: 20px; align-items: flex-start; }
          .lib-sidebar { display: none; }
          .lib-mobile-controls { display: block; }
          @media (min-width: 768px) {
            .lib-sidebar { display: block; width: 180px; flex-shrink: 0; background: ${computedPanelBgCSS}; border: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; border-radius: 12px; padding: 14px 10px; position: sticky; top: 70px; }
            .lib-mobile-controls { display: none; }
          }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          .shimmer { background: linear-gradient(90deg, ${activeDarkMode ? "#21262d" : "#e2e8f0"} 25%, ${activeDarkMode ? "#30363d" : "#f1f5f9"} 50%, ${activeDarkMode ? "#21262d" : "#e2e8f0"} 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
          :root {
            --border: ${activeDarkMode ? "#21262d" : "#e2e8f0"};
            --border2: ${activeDarkMode ? "#30363d" : "#d0d7de"};
            --card-bg: ${activeDarkMode ? "#161b22" : "rgba(255,252,247,0.95)"};
            --card-bg2: ${activeDarkMode ? "#0d1117" : "#f6f8fa"};
            --text-primary: ${activeDarkMode ? "#e6edf3" : "#1a1a2e"};
            --text-secondary: ${activeDarkMode ? "#8b949e" : "#57606a"};
            --text-muted: ${activeDarkMode ? "#484f58" : "#8c959f"};
            --input-bg: ${activeDarkMode ? "#0d1117" : "#ffffff"};
            --hover-bg: ${activeDarkMode ? "#21262d" : "#f3f4f6"};
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes ta-pop { 0%{transform:scale(1)} 35%{transform:scale(1.28)} 65%{transform:scale(0.92)} 100%{transform:scale(1)} }
          @keyframes ta-bounce { 0%{transform:scale(1) translateY(0)} 30%{transform:scale(1.12) translateY(-3px)} 60%{transform:scale(0.96) translateY(1px)} 100%{transform:scale(1) translateY(0)} }
          @keyframes ta-star { 0%{transform:scale(1) rotate(0deg)} 40%{transform:scale(1.4) rotate(-12deg)} 70%{transform:scale(0.9) rotate(6deg)} 100%{transform:scale(1) rotate(0deg)} }
          .ta-pop { animation: ta-pop 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
          .ta-bounce { animation: ta-bounce 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
          .ta-star { animation: ta-star 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
          @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes modalSlideUp { from { opacity: 0; transform: translateY(32px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .fade-in { animation: fadeIn 0.2s ease; }
          .view-transition { animation: viewIn 0.18s ease both; }
          @keyframes viewIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .qp-btn { transition: background 0.15s, border-color 0.15s, transform 0.1s; }
          .qp-btn:not(:disabled):hover { transform: translateY(-1px); }
          .qp-btn-primary:not(:disabled):hover { background: ${accent}35 !important; border-color: ${accent} !important; }
          .qp-btn-secondary:not(:disabled):hover { background: ${activeDarkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)"} !important; border-color: ${activeDarkMode ? "#484f58" : "#94a3b8"} !important; }
          .recent-card:hover .recent-hover-overlay { opacity: 1 !important; }
          .fav-card-wrap:hover .fav-hover-overlay { opacity: 1 !important; }
          .recent-card:hover .fav-rm { opacity: 1 !important; }
          .hof-badge svg { transition: transform 0.4s ease; }
          .hof-rm { opacity: 0; transition: opacity 0.15s; }
          @media (hover: hover) and (prefers-reduced-motion: no-preference) {
            .hof-card:hover .hof-badge { background: rgba(190,24,93,0.55) !important; }
            .hof-card:hover .hof-badge svg { transform: rotate(72deg) scale(1.2); }
            .hof-card:hover .hof-rm { opacity: 1; }
          }
          /* ── Hover unificado (capas): mesma elevação, brilho e duração em todo o lado ── */
          .card, .recent-card > div:first-child, .fav-card-wrap > div:first-child, .hof-card > div:first-child, .ec-card { transition: transform 0.18s cubic-bezier(.2,.8,.2,1), box-shadow 0.18s ease, border-color 0.18s ease; }
          /* ── Scroll lateral: suave, com encaixe e sem "arrastar" a página ── */
          .hscroll { display: flex; gap: 10px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
          .hscroll::-webkit-scrollbar, .recents-row::-webkit-scrollbar { display: none; }
          .hscroll > * { flex: none; }
          .recents-row { overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
          @media (hover: hover) {
            /* dentro de filas com scroll o brilho é mais curto, para não ser cortado nas margens */
            .recents-row .card:hover { box-shadow: 0 0 0 1px ${accent}88, 0 12px 16px -10px ${accent}80 !important; }
          }
          @media (max-width: 767px) {
            .hscroll, .recents-row { scroll-snap-type: x proximity; }
            .hscroll { scroll-padding-inline: 16px; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%); mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%); }
            .recents-row { scroll-padding-inline: 12px; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent 100%); mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent 100%); }
            .hscroll > *, .recents-row > * { scroll-snap-align: start; }
          }
          /* ── Esqueleto de capa (CoverImg): brilho enquanto a imagem carrega ── */
          @keyframes skCover { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
          .sk-cover { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.05) 65%); background-size: 600px 100%; animation: skCover 1.3s linear infinite; }
          @media (prefers-reduced-motion: reduce) { .sk-cover { animation: none; } }
          .ec-act { opacity: 0; transform: translateY(4px); transition: opacity 0.16s ease, transform 0.16s ease; }
          @media (hover: hover) and (prefers-reduced-motion: no-preference) {
            .card:hover, .recent-card:hover > div:first-child, .fav-card-wrap:hover > div:first-child, .hof-card:hover > div:first-child, .ec-card:hover {
              transform: translateY(-4px) scale(1.03); position: relative; z-index: 2;
              box-shadow: 0 0 0 1px ${accent}88, 0 18px 30px -12px ${accent}80 !important;
              border-color: ${accent}88;
            }
            .ec-card:hover .ec-act { opacity: 1; transform: none; }
          }
          .media-grid .card { animation: cardIn 0.22s ease both; }
          .media-grid[data-key] .card { animation: cardIn 0.22s ease both; }
          .media-grid .card:nth-child(1)  { animation-delay: 0ms; }
          .media-grid .card:nth-child(2)  { animation-delay: 25ms; }
          .media-grid .card:nth-child(3)  { animation-delay: 50ms; }
          .media-grid .card:nth-child(4)  { animation-delay: 75ms; }
          .media-grid .card:nth-child(5)  { animation-delay: 100ms; }
          .media-grid .card:nth-child(6)  { animation-delay: 125ms; }
          .media-grid .card:nth-child(n+7) { animation-delay: 150ms; }
          @media (max-width: 768px) {
            .media-grid .card { animation: none !important; }
            .modal-bg { align-items: flex-end !important; padding: 0 !important; }
            .modal { border-radius: 24px 24px 0 0 !important; max-height: 88vh !important; max-height: 88dvh !important; width: 100% !important; max-width: 100% !important; overflow-y: auto !important; }
            .cover-modal { overflow: hidden !important; display: flex !important; flex-direction: column !important; max-height: calc(88vh - 64px) !important; margin-bottom: 64px !important; }
            .modal::before { content: ""; display: block; width: 36px; height: 4px; background: #30363d; border-radius: 99px; margin: 12px auto 4px; }
            .modal-bottom-pad { padding-bottom: 80px !important; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .spin { animation: spin 0.7s linear infinite; display: inline-block; }
          .hero-gradient { background: ${activeBgImage ? "transparent" : activeBgColor}; border-bottom: 1px solid ${activeDarkMode ? "#21262d" : "#e2e8f0"}; position: relative; }
          .hero-gradient::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 60% 80% at 50% 120%, ${accent}18 0%, transparent 70%); }
          ${!activeDarkMode ? `
            .desktop-sidebar { background: rgba(255,255,255,0.95) !important; border-right: 1px solid #e2e8f0 !important; }
            .bottom-nav { background: rgba(255,255,255,0.97) !important; }
            .top-nav-bar { background: rgba(255,255,255,0.97) !important; border-bottom: 1px solid #e2e8f0 !important; }
            /* Corrigir texto muted/secondary no modo claro */
            .tc-zone span[style*="color: rgb(72, 79, 88)"],
            .tc-zone p[style*="color: rgb(72, 79, 88)"],
            .tc-zone div[style*="color: rgb(72, 79, 88)"] { color: #57606a !important; }
            .tc-zone span[style*="#484f58"],
            .tc-zone p[style*="#484f58"] { color: #57606a !important; }
            .tc-zone span[style*="#8b949e"],
            .tc-zone p[style*="#8b949e"] { color: #57606a !important; }
            /* Bordas invisíveis no modo claro */
            .tc-zone [style*="border: 1px solid rgb(33, 38, 45)"] { border-color: #e2e8f0 !important; }
            .tc-zone [style*="border: 1px solid #21262d"] { border-color: #e2e8f0 !important; }
            .tc-zone [style*="border-top: 1px solid #21262d"] { border-top-color: #e2e8f0 !important; }
            .tc-zone [style*="border-bottom: 1px solid #21262d"] { border-bottom-color: #e2e8f0 !important; }
            /* Backgrounds escuros em cards/sections */
            .tc-zone [style*="background: rgb(13, 17, 23)"],
            .tc-zone [style*="background: #0d1117"] { background: #f6f8fa !important; }
            .tc-zone [style*="background: rgb(22, 27, 34)"],
            .tc-zone [style*="background: #161b22"] { background: rgba(255,255,255,0.9) !important; }
            .tc-zone [style*="background: rgb(33, 38, 45)"],
            .tc-zone [style*="background: #21262d"] { background: #e8ecf0 !important; }
          ` : ""}

          /* ── Desktop layout ── */
          @media (min-width: 900px) {
            .bottom-nav { display: none !important; }
            .top-nav-bar { display: none !important; }
            .desktop-sidebar { display: flex !important; }
            .desktop-main { margin-left: 220px !important; padding-bottom: 24px !important; }
            .media-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)) !important; gap: 16px !important; }
            .lib-sidebar { display: block !important; }
            .profile-desktop { display: grid !important; grid-template-columns: 300px 1fr !important; gap: 24px !important; align-items: flex-start !important; }
            .profile-desktop-left { display: block !important; }
            .profile-desktop-right { display: block !important; }
            .card-title-text { display: none !important; }
            .card-info { padding: 5px 8px 7px !important; }
            .card-info-meta { font-size: 11px; color: #8b949e; }
          }

          /* ── Desktop sidebar ── */
          .desktop-sidebar {
            display: none;
            position: fixed; left: 0; top: 0; bottom: 0; width: 220px; z-index: 50;
            flex-direction: column;
            background: ${sidebarColor || activeBgColor}f5;
            border-right: 1px solid ${darkMode ? "#21262d" : "#e2e8f0"};
            backdrop-filter: blur(20px);
            padding: 0 0 16px 0;
            overflow-y: hidden;
          }
          .ds-nav-btn {
            display: flex; align-items: center; gap: 12px;
            width: 100%; padding: 11px 16px; border: none; background: none;
            cursor: pointer; font-family: Outfit, sans-serif; font-size: 14px; font-weight: 600;
            color: ${darkMode ? "#8b949e" : "#64748b"}; border-radius: 10px; margin: 1px 8px; width: calc(100% - 16px);
            transition: all 0.15s; text-align: left;
          }
          .ds-nav-btn:hover { background: ${darkMode ? "#161b22" : "#f1f5f9"}; color: ${darkMode ? "#e6edf3" : "#0d1117"}; }
          .ds-nav-btn.active { background: ${accent}18; color: ${accent}; }
          .ds-nav-btn .ds-icon { font-size: 18px; width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
          .ds-section { font-size: 10px; font-weight: 800; color: #484f58; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 24px 4px; }
          .ds-type-item {
            display: flex; align-items: center; gap: 8px;
            padding: 4px 16px; font-size: 12px; cursor: pointer;
            color: ${darkMode ? "#8b949e" : "#64748b"}; border-radius: 8px; margin: 0 8px;
            transition: all 0.12s;
          }
          .ds-type-item:hover { background: ${darkMode ? "#161b22" : "#f1f5f9"}; }
        `}</style>

        <Notification notif={notif} isMobile={isMobileDevice} onDismiss={() => setNotif(null)} />




        {/* ── Rating prompt after quick-log ── */}
        {logPendingItem && (
          <RatingOverlay
            item={logPendingItem}
           
            library={library}
            onDone={(rating) => {
              if (rating > 0) {
                const normalizedPending = normalizeMediaItem(logPendingItem);
                const matched = getLibraryMatch(normalizedPending.id, normalizedPending.type);
                const canonicalId = normalizeMediaId(normalizedPending.id, normalizedPending.type);
                const next = { ...library };
                if (matched?.key && matched.key !== canonicalId) delete next[matched.key];
                const base = matched?.item || normalizedPending;
                next[canonicalId] = { ...base, id: canonicalId, userStatus: "completo", userRating: rating };
                saveLibrary(next);
                showNotif(`"${(logPendingItem.title || "Item").slice(0, 24)}" ✓  ★ ${rating}`, accent);
              } else {
                showNotif(`"${(logPendingItem.title || "Item").slice(0, 30)}" ✓`, accent);
              }
              setLogPendingItem(null);
            }}
          />
        )}

        {/* Detail Modal */}
        {selectedItem && (
          <DetailModal
            item={selectedItem}
            library={library}
            onAdd={addToLibrary}
            onRemove={(id) => { removeFromLibrary(id); setSelectedItem(null); }}
            onUpdateStatus={updateStatus}
            onUpdateDuration={updateDuration}
            onUpdateNote={updateNote}
            onUpdateLastChapter={updateLastChapter}
            onUpdateRating={updateRating}
            onChangeCover={updateCover}
            onClose={() => { setSelectedItem(null); if (tierReturn) { setViewingTierlist(tierReturn); setTierReturn(null); } }}
            accent={accent}
            favorites={activeFavorites}
            onToggleFavorite={toggleFavorite}
            hallOfFame={activeProfile.hallOfFame || []}
            onToggleHallOfFame={toggleHallOfFame}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onOpenItem={(newItem) => setSelectedItem(newItem)}
            showNotif={showNotif}
            setView={setView}
            setLibSearch={setLibSearch}
          />
        )}

        {/* NAV TOP */}
        <nav className="top-nav-bar" style={{ background: mkNavBg(activeDarkMode, activeBgColor), backdropFilter: "blur(14px)", borderBottom: `1px solid ${activeDarkMode ? "rgba(255,255,255,0.07)" : "#e2e8f0"}`, padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 56, position: "sticky", top: 0, zIndex: 40 }}>
          {!(isMobileDevice && mobileSearchOpen) && (
            <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white" }}>T</div>
              <span style={{ fontSize: 18, fontWeight: 900, color: activeDarkMode ? "#e6edf3" : "#0d1117", letterSpacing: "-0.5px" }}>TrackAll</span>
            </button>
          )}

          {isMobileDevice && !mobileSearchOpen ? (
            <>
              <div style={{ flex: 1 }} />
              <button onClick={() => setMobileSearchOpen(true)} aria-label={lang === "en" ? "Search" : "Pesquisar"}
                style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${activeDarkMode ? "rgba(255,255,255,0.10)" : "#e2e8f0"}`, background: activeDarkMode ? "rgba(255,255,255,0.04)" : "transparent", color: activeDarkMode ? "#c9d1d9" : "#334155", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </button>
            </>
          ) : (
          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#484f58", fontSize: 14, display: "flex" }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </span>
              <input
                value={searchQuery}
                autoFocus={isMobileDevice && mobileSearchOpen}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(searchQuery, activeTab); setMobileSearchOpen(false); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } else if (e.key === "Escape") setMobileSearchOpen(false); }}
                placeholder="Pesquisar..."
                style={{ width: "100%", padding: "9px 36px 9px 36px", fontSize: 13 }}
              />
              {searchQuery && (
                <span
                  onClick={() => { doSearch(searchQuery, activeTab); setMobileSearchOpen(false); }}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b949e", fontSize: 16, padding: "2px 6px", borderRadius: 6, background: "#21262d" }}
                >⏎</span>
              )}
            </div>
          </div>
          )}
          {isMobileDevice && mobileSearchOpen && (
            <button onClick={() => setMobileSearchOpen(false)} style={{ background: "none", border: "none", color: activeDarkMode ? "#aab4c0" : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "6px 2px" }}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
          )}

          {/* Avatar */}
          {!(isMobileDevice && mobileSearchOpen) && (<button onClick={() => setView("profile")} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${accent}66)`, border: `2px solid ${view === "profile" ? accent : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 16 }}>👤</span>}
            </div>
          </button>)}
        </nav>

        <div
          onTouchStart={handleMainSwipeStart}
          onTouchMove={handleMainSwipeMove}
          onTouchEnd={handleMainSwipeEnd}
          onTouchCancel={handleMainSwipeCancel}
          style={{
            touchAction: canUseMainSwipe ? "pan-y" : "auto",
            position: "relative",
            overflow: "hidden",
          }}
        >

        {canUseMainSwipe && (
          <div ref={mainSwipePeekRef} style={{ display: "none", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 5, pointerEvents: "none", overflow: "hidden" }}>
            <div data-peek-content style={{ position: "absolute", top: "50%", left: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0, willChange: "transform, opacity" }}>
              <span data-peek-icon style={{ width: 52, height: 52, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, lineHeight: 1, color: "#fff", background: "rgba(13,17,23,0.72)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: `0 8px 24px -8px ${accent}99` }}></span>
              <span data-peek-label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}></span>
            </div>
          </div>
        )}

        <div
          ref={mainSwipeContentRef}
          style={{
            transform: "translate3d(0, 0, 0)",
            willChange: canUseMainSwipe ? "transform" : "auto",
            backfaceVisibility: "hidden",
          }}
        >

        <HomeView view={view} setView={setView} profile={profile} user={user} items={items} library={library} setLibrary={setLibrary} stats={stats} homeStatColors={homeStatColors} homeDashboard={homeDashboard} homeFilter={homeFilter} setHomeFilter={setHomeFilter} graveyardOpen={graveyardOpen} setGraveyardOpen={setGraveyardOpen} recos={recos} personalRecos={personalRecos} recoLoading={recoLoading} loadRecos={loadRecos} setFilterStatus={setFilterStatus} setSelectedItem={setSelectedItem} />
        <SearchView view={view} activeTab={activeTab} setActiveTab={setActiveTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} doSearch={doSearch} isSearching={isSearching} searchError={searchError} searchResultsByType={searchResultsByType} searchHistory={searchHistory} setSearchHistory={setSearchHistory} library={library} setSelectedItem={setSelectedItem} />
        <LibraryView view={view} setView={setView} items={items} filteredLib={filteredLib} sortedLib={sortedLib} library={library} activeTab={activeTab} setActiveTab={setActiveTab} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterRating={filterRating} setFilterRating={setFilterRating} libSearch={libSearch} setLibSearch={setLibSearch} libSort={libSort} setLibSort={setLibSort} libViewMode={libViewMode} setLibViewModePersist={setLibViewModePersist} searchQuery={searchQuery} doSearch={doSearch} setSelectedItem={setSelectedItem} />
        <div style={{ display: view === "friends" ? "block" : "none" }}>
        {/* ── FRIENDS ── */}
          {demoMode || !user ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{lang === "en" ? "Friends are waiting!" : "Os teus amigos estão à espera!"}</h3>
              <p style={{ fontSize: 14, color: darkMode ? "#8b949e" : "#64748b", marginBottom: 24, maxWidth: 300, lineHeight: 1.6 }}>{lang === "en" ? "Create a free account to add friends and share your library." : "Cria uma conta gratuita para adicionar amigos e partilhar a tua biblioteca."}</p>
              <button className="btn-accent" style={{ padding: "12px 28px", fontSize: 15, borderRadius: 12 }} onClick={() => { setDemoMode(false); setShowLanding(false); }}>
                {lang === "en" ? "Create free account" : "Criar conta grátis"}
              </button>
            </div>
          ) : (
            <FriendsView user={user} accent={accent} darkMode={activeDarkMode} isMobileDevice={isMobileDevice} library={library} />
          )}
        </div>
        <div style={{ display: view === "profile" ? "block" : "none" }}>
          <div className="profile-desktop-wrap" style={{ padding: 0, background: activeBgImage ? "transparent" : activeBgColor, minHeight: "100vh" }}>
          <ProfileView
            onOpenLibrary={openLibraryFiltered}
            profile={activeProfile}
            library={library}
            accent={accent}
            bgColor={bgColor}
            bgColorMobile={bgColorMobile}
            bgImage={bgImage}
            bgOverlay={bgOverlay}
            bgBlur={bgBlur}
            bgParallax={bgParallax}
            darkMode={activeDarkMode}
            onUpdateProfile={saveProfile}
            onAccentChange={saveAccent}
            onBgChange={saveBg}
            onBgImage={saveBgImage}
            bgImageMobile={bgImageMobile}
            bgSeparateDevices={bgSeparateDevices}
            onBgSeparateDevices={saveBgSeparateDevices}
            onBgImageMobile={saveMobileBgImage}
            onBgColorMobile={saveBgColorMobile}
            isMobileDevice={isMobileDevice}
            onBgOverlay={saveBgOverlay}
            onBgBlur={saveBgBlur}
            onBgParallax={saveBgParallax}
            panelBg={panelBg}
            panelOpacity={panelOpacity}
            onPanelBg={savePanelBg}
            onPanelOpacity={savePanelOpacity}
            textContrast={textContrast}
            onTextContrast={saveTextContrast}
            textContrastMobile={textContrastMobile}
            onTextContrastMobile={saveTextContrastMobile}
            sidebarColor={sidebarColor}
            onSidebarColor={saveSidebarColor}
            lang={lang}
            useT={useT}
            onChangeLang={changeLang}
            userTierlists={userTierlists}
            userLikes={userLikes}
            currentUserId={user?.id}
            onCreateTierlist={() => { setEditingTierlist(null); setShowTierlistEditor(true); }}
            onViewTierlist={setViewingTierlist}
            onLikeTierlist={handleTierlistLike}
            onDeleteTierlist={handleDeleteTierlist}
            userCollections={userCollections}
            userCollectionLikes={userCollectionLikes}
            onCreateCollection={() => { setEditingCollection(null); setShowCollectionEditor(true); }}
            onViewCollection={(col) => { setViewingCollection(col); setView("collection"); }}
            onLikeCollection={handleCollectionLike}
            onDeleteCollection={handleDeleteCollection}
            onSavedThemes={{ themes: savedThemes, save: saveSavedThemes }}
            onTmdbKey={saveTmdbKey}
            tmdbKey={tmdbKey}
            workerUrl={workerUrl}
            onWorkerUrl={saveWorkerUrl}
            onSignOut={handleSignOut}
            userEmail={user?.email || ""}
            favorites={activeFavorites}
            onToggleFavorite={toggleFavorite}
            hallOfFame={activeProfile.hallOfFame || []}
            featuredItem={activeProfile.featuredItem || null}
            onSetFeatured={demoMode ? null : saveFeatured}
            onToggleHallOfFame={toggleHallOfFame}
            onImportMihon={importMihon}
            onImportPaperback={importPaperback}
            onImportLetterboxd={importLetterboxd}
            onOpen={setSelectedItem}
            diaryPanel={null}
          />
          </div>
        </div>
        <div style={{ display: view === "collection" ? "block" : "none" }}>
          {viewingCollection && (
            <div style={{ background: activeBgImage ? "transparent" : activeBgColor, minHeight: "100vh" }}>
              <CollectionViewer
                col={viewingCollection}
                onClose={() => { setViewingCollection(null); setView("profile"); }}
                onLike={handleCollectionLike}
                liked={userCollectionLikes.includes(viewingCollection.id)}
                currentUserId={user?.id}
                workerUrl={workerUrl}
                onEdit={(col) => { setEditingCollection(col); setShowCollectionEditor(true); }}
                onOpenMedia={(item) => {
                  const libItem = findLibraryEntry(library, item.id, item.type || item.mediaType || "anime")?.item;
                  if (libItem) { setSelectedItem(libItem); } else { setSelectedItem({ id: item.id, title: item.title, type: item.type || item.mediaType || "anime", cover: item.cover }); }
                }}
              />
            </div>
          )}
        </div>

        </div>
        </div>

        {/* TierList Viewer */}
        {viewingTierlist && (
          <TierListViewer
            tl={viewingTierlist}
            onClose={() => setViewingTierlist(null)}
            onLike={handleTierlistLike}
            liked={userLikes.includes(viewingTierlist.id)}
            currentUserId={user?.id}
            onEdit={(tl) => { setViewingTierlist(null); setEditingTierlist(tl); setShowTierlistEditor(true); }}
            onOpenItem={(item) => { setTierReturn(viewingTierlist); setViewingTierlist(null); setSelectedItem(item); }}
          />
        )}

        {/* TierList Editor */}
        {showTierlistEditor && (
          <TierListEditor
            initialData={editingTierlist}
            library={library}
            onSave={handleSaveTierlist}
            onClose={() => { setShowTierlistEditor(false); setEditingTierlist(null); }}
            workerUrl={workerUrl}
            tmdbKey={tmdbKey}
          />
        )}

        {/* Collection Editor */}
        {showCollectionEditor && (
          <CollectionModal
            initialData={editingCollection}
            library={Object.values(library)}
            onSave={handleSaveCollection}
            onClose={() => { setShowCollectionEditor(false); setEditingCollection(null); }}
            workerUrl={workerUrl}
          />
        )}

        {/* PWA Install Banner — mobile only */}
        {pwaPrompt && !pwaInstalled && isMobileDevice && (
          <div style={{ position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 60, background: '#161b22', border: `1px solid ${accent}44`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 28 }}>📲</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{useT("installApp")}</p>
              <p style={{ fontSize: 11, color: '#8b949e' }}>{useT("installDesc")}</p>
            </div>
            <button onClick={async () => { pwaPrompt.prompt(); const r = await pwaPrompt.userChoice; if (r.outcome === 'accepted') setPwaInstalled(true); setPwaPrompt(null); }} style={{ background: accent, border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{useT("install")}</button>
            <button onClick={() => setPwaPrompt(null)} style={{ background: 'none', border: 'none', color: '#484f58', fontSize: 18, cursor: 'pointer', padding: '4px', flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* LOG BOTTOM SHEET */}
        {logOpen && (
          <>
            <div onClick={() => { setLogOpen(false); setLogQuery(""); setLogResults([]); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }} />
            <div style={{ position: "fixed", bottom: isMobileDevice ? 64 : "auto", top: isMobileDevice ? "auto" : "50%", left: isMobileDevice ? 0 : "50%", right: isMobileDevice ? 0 : "auto", transform: isMobileDevice ? "none" : "translate(-50%, -50%)", width: isMobileDevice ? "auto" : 480, zIndex: 100, background: darkMode ? `radial-gradient(circle at 85% 0%, ${accent}1f, transparent 45%), #0e1014` : "#ffffff", borderRadius: isMobileDevice ? "24px 24px 0 0" : 24, border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, borderBottom: isMobileDevice ? "none" : undefined, padding: isMobileDevice ? "12px 16px 12px" : "20px 20px 14px", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", maxHeight: "70vh", overflowY: "auto" }}>
              {/* Handle */}
              {isMobileDevice && <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 14px" }} />}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b949e", marginBottom: 12 }}>{lang === "en" ? "Quick log" : "Log rápido"}</div>
              {/* Type filter pills */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none", marginBottom: 10 }}>
                {[{ id: null, icon: "🔍", label: "Todos" }, ...MEDIA_TYPES.filter(t => t.id !== "all")].map(t => (
                  <button key={t.id || "all"} onClick={() => setQuickSearchType(t.id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "7px 13px", borderRadius: 99, background: quickSearchType === t.id ? `${accent}26` : "transparent", border: `1px solid ${quickSearchType === t.id ? accent : (darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0")}`, color: quickSearchType === t.id ? (darkMode ? "#fca5a5" : accent) : (darkMode ? "#aab4c0" : "#64748b"), cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                    <span><TypeIcon id={t.id} /></span> {mediaLabel(t, lang) || useT("all")}
                  </button>
                ))}
              </div>
              <div style={{ position: "relative" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={darkMode ? "#6e7681" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input ref={logInputRef} type="text" value={logQuery} onChange={e => setLogQuery(e.target.value)}
                  placeholder={quickSearchType ? `Pesquisar ${MEDIA_TYPES.find(t => t.id === quickSearchType)?.label || ""}...` : "Pesquisar qualquer título..."}
                  style={{ width: "100%", padding: "14px 16px 14px 42px", borderRadius: 14, background: darkMode ? "rgba(255,255,255,0.05)" : "#f8fafc", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, color: darkMode ? "#e6edf3" : "#0d1117", fontFamily: "inherit", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s" }}
                  onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}26`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = darkMode ? "rgba(255,255,255,0.12)" : "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
              {logSearching && <p style={{ fontSize: 12, color: "#484f58", marginTop: 10 }}>{useT("searching")}</p>}
              {!logQuery && !logSearching && (
                <p style={{ fontSize: 12, color: "#6e7681", marginTop: 12, textAlign: "center" }}>{lang === "en" ? "Type to search · tap to mark as complete" : "Escreve para pesquisar · toca para marcar como completo"}</p>
              )}
              {logResults.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {logResults.map(item => (
                    <div key={item.id} onClick={() => {
                      if (findLibraryEntry(library, item.id, item.type)) updateStatus(item.id, "completo");
                      else addToLibrary(item, "completo");
                      setLogOpen(false); setLogQuery(""); setLogResults([]); setLogPendingItem(item);
                    }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 14, background: darkMode ? "rgba(255,255,255,0.04)" : "#f1f5f9", border: `1px solid ${darkMode ? "rgba(255,255,255,0.07)" : "transparent"}`, cursor: "pointer" }}>
                      {(item.cover || item.thumbnailUrl)
                        ? <img src={item.cover || item.thumbnailUrl} alt="" style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 50, borderRadius: 6, background: gradientFor(item.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}><TypeIcon id={item.type} /></div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#e6edf3" : "#0d1117", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{MEDIA_TYPES.find(t => t.id === item.type)? mediaLabel(MEDIA_TYPES.find(t=>t.id===item.type), lang) : ''}{item.year ? ` · ${item.year}` : ""}</p>
                      </div>
                      <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700, flexShrink: 0, padding: "4px 10px", borderRadius: 99, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>✓ {lang === "en" ? "Complete" : "Completo"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        </div>

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">
          {[
            { id: "home", icon: "⌂", label: useT("home") },
            { id: "library", icon: "▤", label: useT("library") },
          ].map((n) => (
            <button key={n.id} className={`nav-btn${view === n.id ? " active" : ""}`} onClick={() => setView(n.id)} style={{ color: view === n.id ? accent : undefined }}>
              <span style={{ fontSize: 22 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {/* Botão + central flutuante */}
          <button className="nav-center-btn" onClick={() => { setLogOpen(v => !v); setView("home"); }}>
            <div style={{
              width: 52, height: 52,
              borderRadius: "50%",
              background: logOpen ? `linear-gradient(135deg, ${accent}dd, ${accent})` : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 20px ${accent}66`,
              transform: logOpen ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 28, color: "white", lineHeight: 1, fontWeight: 300, marginTop: -2 }}>+</span>
            </div>
          </button>

          <button className={`nav-btn${view === "friends" ? " active" : ""}`} onClick={() => setView("friends")} style={{ color: view === "friends" ? accent : undefined }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
              <circle cx="9" cy="7" r="3.5" fill={view === "friends" ? accent : "#8b949e"} />
              <circle cx="17" cy="8" r="2.8" fill={view === "friends" ? accent : "#8b949e"} opacity="0.7" />
              <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={view === "friends" ? accent : "#8b949e"} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M17 13c2.2 0.4 4 2.2 4 4.5" stroke={view === "friends" ? accent : "#8b949e"} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
            </svg>
            {useT("friends")}
          </button>
          <button className={`nav-btn${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")} style={{ color: view === "profile" ? accent : undefined }}>
            <span style={{ fontSize: 22 }}>◉</span>
            Perfil
          </button>
        </nav>
      </div>
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
