# 📘 TrackAll — Developer Guide

> **Última atualização:** 2026-10-16 (Fases 1–5 concluídas; fase atual: "pequenos detalhes" de UI/UX no PC e telemóvel; a seguir: parte social/amigos, Conquistas, preparação para partilhar)
> **Estado:** App estável, em polimento visual. `App.jsx` ~2660 linhas.

---

## 🎯 Visão Geral

**TrackAll** é uma aplicação web para tracking de media (anime, manga, séries, filmes, jogos, livros, manhwa, light novels, comics).

- **Stack:** React + Vite + Supabase
- **Deploy:** Vercel (via GitHub)
- **Língua:** PT/EN (i18n via `translations.js`)
- **PWA:** instalável, com service worker; fundo escuro desde o 1.º frame (ver secção PWA)
- **Estado:** `App.jsx` ~2660 linhas (CollectionViewer, TierListEditor, TierListViewer, RatingOverlay e SidebarSearch já extraídos para `components/`)

---

## ⚠️ Contrato entre módulos — lições da refatorização (2026-09-01)

A separação do `App.jsx` monolítico em `config/` e `lib/` introduziu 4 bugs em produção, todos pela mesma causa raiz: **um módulo novo foi escrito a partir do que "fazia sentido" ou do que o `DEV_GUIDE.md` dizia, sem confirmar contra as chamadas reais já existentes no `App.jsx`.** Regras para não repetir:

1. **`App.jsx` é a fonte da verdade, não este guia.** Antes de implementar ou alterar qualquer função em `config/` ou `lib/`, corre `grep -n "nomeDaFuncao(" src/App.jsx` e lê **todos** os call sites — assinatura de argumentos e forma do valor devolvido. Só depois escreve a função. Este guia deve ser atualizado a seguir, nunca ao contrário.
2. **Nunca assumir nomes de colunas do Supabase.** Confirma no dashboard (ou no SQL editor) antes de escrever `.eq()`/`.or()`. Um nome de coluna errado dá erro 400 que não aparece como crash imediato — só quebra silenciosamente mais tarde num `useMemo` que espera dados que nunca chegaram.
3. **Qualquer wrapper que leia uma tabela em forma de "biblioteca" (`library`, e no futuro semelhantes) tem de devolver exatamente a forma que o resto da app espera** — neste caso um objeto `{ [id]: item }`, nunca o array de linhas do Supabase. Verifica isso com `Object.entries`/`Object.values` nos consumidores antes de decidir a forma de retorno.
4. **Se o `DEV_GUIDE.md` lista uma função que não está exportada** (aconteceu com `normalizeMediaItem`, documentada mas nunca implementada), trata isso como um bug a corrigir, não como documentação a ignorar — procura todos os usos antes de assumir que "não é preciso".
5. **Depois de qualquer alteração a `config/supabase.js` ou `lib/mediaIds.js`, testar manualmente o fluxo completo**, não só o que motivou a alteração: login → biblioteca carrega com capas e tipos corretos → adicionar item → dar rating → remover item → pedidos de amizade. Estes 5 pontos cobrem quase todos os call sites críticos destes dois ficheiros.

6. **Mudanças de UI: confirmar no telemóvel *e* no PC.** Várias correções falharam à primeira por só se testar um dos lados (hover cortado = snap + overflow; modal cortado = stacking context). Ver "Padrões de UI".

---

## 📁 Estrutura do Projeto

TrackAll/
- DEV_GUIDE.md (este ficheiro)
- index.html
- package.json
- vite.config.js
- public/ (favicon, manifest, sw.js, etc.)
- src/
  - App.jsx (componente principal)
  - main.jsx
  - translations.js
  - config/
    - constants.js (MEDIA_TYPES, STATUS, TIERS, COLORS)
    - theme.js (ACCENT_PRESETS, BG_PRESETS, color utils)
    - supabase.js (cliente Supabase + wrapper supa)
  - lib/
    - mediaIds.js (normalização de IDs)
    - consumptionTime.js (lógica "Quando Consumir?")
  - api/ (Fase 2 — anilist.js, tmdb.js, igdb.js, books.js, comicvine.js, details.js, recommendations.js, smartSearch.js)
  - components/ (ActionIcon, AppearanceSettings, AuthScreen, CollectionCard, CollectionModal, CollectionViewer, CoverEditModal, CoverImg, CropModal, DetailModal, FeaturedPickerModal, FeedTab, FriendsView, LandingPage, LetterboxdImportModal, LibGroupedList, MediaCard, MihonImportModal, Notification, PaperbackImportModal, ProfileCard, ProfileEstatisticas, ProfileStats, ProfileTabCompletos, ProfileTabDiario, ProfileView, RatingOverlay, RecentSection, RecoCarousel, SidebarSearch, Skeleton, StarRating, TierListCard, TierListEditor, TierListViewer, TiltCard, TypeIcon, VirtualGrid)
  - contexts/ (ThemeContext: useTheme/useAccent/useDarkMode/useIsMobile; LangContext: useLang)
  - lib/ (inclui utils.js, importParsers.js, **bootCache.js**, **imageStore.js**)
  - views/ (HomeView, LibraryView, SearchView — estado fica no TrackAll, a vista recebe props)

---

## 🧩 Módulos — Fase 1 (Concluída)

### `src/config/constants.js`
**O que contém:**
- `MEDIA_TYPES` — Array de todos os tipos de media suportados (id, label PT/EN, ícone)
- `STATUS_OPTIONS` — Estados possíveis (assistindo, completo, planejado, dropado, pausado)
- `TIER_LEVELS` — Níveis S/A/B/C/D com cores
- `TYPE_COLORS` — Mapa de cor por tipo de media
- `MONTH_PT` / `MONTH_EN` — Meses abreviados
- `mediaLabel(m, lang)` — Retorna label no idioma correto
- `getMediaTypeLabel(type, lang)` — Label de um tipo específico
- `statusLabel(s, lang)` — Label de um status específico

**Quando editar:**
- Adicionar novo tipo de media → adicionar entrada em `MEDIA_TYPES` + cor em `TYPE_COLORS`
- Mudar cores dos tiers → editar `TIER_LEVELS`
- Adicionar novo status → editar `STATUS_OPTIONS`

---

### `src/config/theme.js`
**O que contém:**
- `ACCENT_PRESETS` — 8 cores de destaque pré-definidas (Laranja, Roxo, Ciano, Rosa, Verde, Azul, Amarelo, Vermelho)
- `BG_PRESETS` — 8 fundos pré-definidos (4 escuros + 4 claros)
- `isColorDark(hex)` — Detecta se uma cor hex é escura ou clara (luminância)
- `accentShade(hex, shiftDeg)` — Gera variação da cor com rotação de matiz
- `accentVariant(hex, index)` — Gera 6 variações subtis (hue ±10°, brilho ±8%)

**Quando editar:**
- Adicionar nova cor de destaque → adicionar em `ACCENT_PRESETS`
- Adicionar novo fundo → adicionar em `BG_PRESETS`
- Ajustar algoritmo de cor → editar as funções

---

### `src/config/supabase.js`
**O que contém:**
- `supabase` — Cliente oficial do Supabase (SDK)
- `supa` — Wrapper com métodos de alto nível:
  - **Auth:** `signUp`, `signIn`, `signOut`, `getSession`
  - **Profile:** `getProfile`, `upsertProfile`, `updateUsername`
  - **Library:** `getLibrary`, `upsertLibraryItem`, `deleteLibraryItem`
  - **Favorites:** `updateFavorites`
  - **Friends:** `searchUsers`, `sendFriendRequest`, `acceptFriendRequest`, `declineFriendRequest`, `removeFriend`, `getFriendships`, `getFriendLibrary`, `getFriendProfile`
  - **Tier Lists:** `getPopularTierlists`, `getUserTierlists`, `createTierlist`, `updateTierlist`, `deleteTierlist`, `toggleTierlistLike`, `getUserLikes`
  - **Collections:** `getUserCollections`, `createCollection`, `updateCollection`, `deleteCollection`, `toggleCollectionLike`, `getUserCollectionLikes`

**Quando editar:**
- Mudar URL/Key do Supabase → editar `SUPABASE_URL` / `SUPABASE_KEY` no topo
- Adicionar nova tabela → adicionar método em `supa`
- Mudar schema → atualizar queries nos métodos
- **Confirmar sempre os nomes reais das colunas no dashboard do Supabase antes de escrever `.eq()`/`.or()`** — a tabela `friendships` usa `requester_id`/`addressee_id`, não `user_id`/`friend_id`; assumir nomes "óbvios" já causou um 400 silencioso em produção.
- `getLibrary(userId)` **tem de devolver um objeto `{ [media_id]: item }`**, nunca o array de linhas cru do Supabase — todo o resto da app (`items`, `saveLibrary`, `findLibraryEntry`) assume essa forma.

---

### `src/lib/mediaIds.js`
**O que contém (assinaturas reais, confirmadas contra as chamadas em `App.jsx` — ver ⚠️ abaixo):**
- `normalizeMediaId(id, type)` — Normaliza IDs (lowercase, remove espaços e chars especiais). `type` existe só por compatibilidade com as chamadas, não afeta o resultado.
- `mediaIdCandidates(id, type)` — Recebe um **id + type** (não um objeto `item`!) e devolve um array de IDs candidatos, para procurar correspondências na biblioteca.
- `findLibraryEntry(library, id, type)` — Procura um item na biblioteca (`library` é sempre um objeto `{ [id]: item }`). Devolve **`{ key, item }`** ou `null` — nunca o item "nu".
- `normalizeMediaItem(item)` — Recebe um item vindo de uma API externa e garante `id`/`type`/`title`/`cover` preenchidos, preservando os restantes campos. Usado em `addToLibrary`, `toggleFavorite`, `toggleHallOfFame`, log rápido.

**Quando editar:**
- Mudar lógica de matching → editar `normalizeMediaId`
- Adicionar novo campo de ID → editar `mediaIdCandidates`
- **Antes de mudar qualquer assinatura aqui, corre `grep -n "findLibraryEntry(\|mediaIdCandidates(\|normalizeMediaId(\|normalizeMediaItem(" src/App.jsx`** e confirma que todas as chamadas continuam compatíveis — este ficheiro já esteve completamente dessincronizado do `App.jsx` (ver secção ⚠️).

---

### `src/lib/consumptionTime.js`
**O que contém:**
- `getConsumptionTime(item)` — Determina slot ideal (hoje / fim de semana / férias) baseado no tipo de media e status "planejado"

**Quando editar:**
- Mudar lógica de slots → editar a função
- Adicionar novo tipo de media → adicionar regra no `if/else`

---

## 🧩 Módulos — Fase 2 (Concluída)

Todas as chamadas a APIs externas saíram do `App.jsx` para `src/api/`. Ordem de extração (por dependência — os últimos dependem dos primeiros):

### `src/api/anilist.js`
- `searchAniList(query, type, workerUrl, format?, country?)` — pesquisa anime/manga/manhwa/light novels
- `fetchAniListSafe(urls, body)` — tenta várias URLs (direta + proxy) em paralelo, devolve o primeiro resultado válido. **Exportada e usada diretamente** noutros módulos (`recommendations.js`) e no `App.jsx` (queries GraphQL à medida — modal de personagens, export Mihon), não só internamente.
- `fetchTrendingAnime(workerUrl)`, `fetchTrendingManga(workerUrl)`

### `src/api/tmdb.js`
- `searchTMDB(query, type, key, workerUrl)` — `type` é `"filmes"` ou `"series"`
- `fetchTrendingMovies(tmdbKey, workerUrl)`, `fetchTrendingSeries(tmdbKey, workerUrl)`

### `src/api/igdb.js`
- `searchIGDB(query, workerUrl)`, `searchSteam(query)` (fallback quando IGDB não encontra nada), `fetchTrendingGames(workerUrl)`
- Contém localmente os helpers `SC`/`SB` (URLs de capa/backdrop Steam) — só usados aqui, não exportados

### `src/api/books.js`
- `searchGoogleBooks(query, workerUrl)`

### `src/api/comicvine.js`
- `searchComicVine(query, workerUrl)`

### `src/api/details.js`
- `fetchMediaDetails(item, tmdbKey, workerUrl)` — deteta a fonte pelo prefixo do `item.id` (`tmdb-`, `igdb-`, `gb-`, `cv-`, `al-`) e busca detalhes extra (elenco, temporadas, trailers, etc.). O maior ficheiro de `api/`, mas autocontido — sem dependências de outros módulos de `api/`.

### `src/api/recommendations.js`
- `fetchPersonalizedRecos(library, workerUrl)` — usa a biblioteca do utilizador como "seed" para recomendações. Importa `fetchAniListSafe` de `anilist.js` em vez de duplicar.

### `src/api/smartSearch.js`
- `smartSearch(query, mediaType, keys)` — escolhe a API certa consoante `mediaType` e trata o cache
- `CACHE` (Map) e `cacheKey(q, type)` — **exportados**, porque o `App.jsx` apaga entradas do cache diretamente (`CACHE.delete(cacheKey(q, type))`) ao trocar de tipo de pesquisa, para forçar resultados frescos

### `src/lib/utils.js` (criado durante a Fase 2)
- `shuffle(arr)` — partilhado por `anilist.js`, `tmdb.js` e `igdb.js` (as suas funções de "trending"); não pertence a nenhum ficheiro específico, por isso ficou aqui em vez de duplicado

**Quando editar qualquer ficheiro de `api/`:**
- Confirmar sempre call sites no `App.jsx` com `grep` antes de mudar uma assinatura (ver regra 1 da secção ⚠️ acima)
- Se uma função for usada por mais do que um ficheiro de `api/`, importar entre eles (ex: `recommendations.js` → `anilist.js`) em vez de duplicar
- Validar sintaxe com `esbuild` antes de entregar (`esbuild.transformSync(código, { loader: 'jsx' })`), não confiar em contagem manual de chavetas/parênteses

---

### `src/translations.js`
**O que contém:**
- `STRINGS` — Objeto com todas as strings PT e EN
- `t(key, lang)` — Função de tradução
- `detectLang()` — Deteta idioma do browser
- `saveLang(lang)` — Guarda preferência em localStorage
- `_globalLang` — Variável global de idioma atual

**Quando editar:**
- Adicionar nova string → adicionar em `STRINGS.pt` e `STRINGS.en`
- Corrigir tradução → editar a string correspondente

---

### `src/App.jsx`
**O que contém:**
- Componente principal da aplicação
- Todos os Contexts (Theme, Lang)
- Lógica de routing/views
- Modais e interações
- **Estado atual:** ~2660 linhas (orquestração: estado global, auth/arranque, sincronização da biblioteca, navegação, gesto de deslizar entre separadores)

**Quando editar:**
- Só editar diretamente se for lógica de orquestração
- Nova feature → criar componente/hook/view separado e importar

---

### 👤 Perfil — redesign v2 (desktop e telemóvel concluídos)
Layout desktop (separador Perfil, `ProfileView.jsx`):
- Linha de cima: `ProfileCard` (330px, estica até ao fundo da 2.ª fila do Hall of Fame) + coluna da direita com `ProfileStats` e o Hall of Fame (5 por linha, 2 filas).
- Largura total: filtros partilhados → Recentes → Favoritos (uma fila por tipo, 6 posters + "+N ver todos") → cartões Tier Lists / Minhas Listas → Top géneros.
Layout telemóvel (só `isMobileDevice`; o PC não muda):
- `ProfileCard` compacto numa linha (avatar, nome, editar, sair) → `ProfileStats` com 3 mosaicos + distribuição → **Hall of Fame** → filtros → Recentes (4 por linha) → Favoritos (fila de scroll horizontal por tipo, posters leves de 82px, **máx. 24 por tipo**, sem `TiltCard`/sombras; imagens `loading="lazy"`) → Tier Lists / Listas (2 cartões).
- **Hall of Fame no telemóvel (2026-10):** carrossel de **2 filas** (`.hscroll` com `display:grid; grid-template-rows: repeat(2,auto); grid-auto-flow: column; grid-auto-columns: clamp(104px,29vw,128px)`), capas 2:3 com `CoverImg`, nota (★) no canto e título em gradiente por baixo; **máximo 10** (`hallOfFame.slice(0,10)`, contador "x/10"). Vêem-se ~6–8 sem scroll e a coluna seguinte espreita. Se o item em destaque estiver no Hall of Fame fica com contorno + etiqueta "DESTAQUE" (já **não** é antecipado/duplicado no início da lista — isso fazia passar de 10 itens).
- Separadores: Perfil, Completos, Tier Lists, Listas, Diário, **Definições**.

Componentes:
- `ProfileCard.jsx`: desktop com item em destaque (`TiltCard`, `hiRes()`), troca de destaque, editar e sair; ramo próprio compacto no telemóvel.
- `ProfileStats.jsx`: números, barra por tipo, estados e histograma de **20 barras (meias estrelas)**. **Interativo**: a prop `onFilter({type,status,rating,sort})` abre a Biblioteca já filtrada (`openLibraryFiltered` no `App.jsx`; `filterRating` = `null | "rated" | nota`; a Biblioteca mostra um chip "★ 8.5 ✕" para limpar).
- `FeaturedPickerModal.jsx`, `ProfileTabDiario.jsx` (v2), `Sakura` (local do ProfileView).
- `Skeleton.jsx`: `Skeleton`, `PosterGridSkeleton`, `AppSkeleton` (ecrã de arranque com barra lateral/inferior + forma da Home; respeita `prefers-reduced-motion`). Usado no arranque (`authLoading`) e na pesquisa.
- `StarRating.jsx`: arrastar pelas estrelas (metade esquerda = meia estrela), botões − / +, tocar na nota atual limpa, vibração 8ms, guarda **ao largar**. `variant="stars"|"bar"`; se omitido, lê `localStorage.trackall_rating_style` (evento `trackall-rating-style` atualiza ao vivo).

Definições (separador "Definições" do Perfil):
- Navegação: Aparência · Importar · APIs · Geral · Zona de perigo (os modais de importação vivem fora do separador Perfil).
- `AppearanceSettings.jsx`: 5 estilos prontos (Carmim, Meia-noite, Oceano, Floresta, Claro), cor de destaque, fundo (cor PC/mobile, imagem, escurecer, desfoque, parallax), painéis (cor + transparência), texto (contraste), barra lateral, dispositivos separados, estrelas/barra, temas guardados — com pré-visualização ao vivo. Todas as opções antigas foram mantidas.
- **Painéis**: `ThemeContext` expõe `panelBg` (CSS pronto, ou `null` = automático). Aplicado em `ProfileCard`, `ProfileStats`, `ProfileTabDiario`, painéis da Home e `TierListCard`. Novos painéis devem usar `const { panelBg } = useTheme()` → `background: panelBg || <default>`.

Regras e dados:
- O filtro `favFilter` filtra Recentes e Favoritos ao mesmo tempo.
- Limites: Hall of Fame 10, Favoritos 30.
- **Persistência do Hall of Fame (importante):** guarda-se em `library` na linha `__hall_of_fame__` como `{ hall, featured }`, mais cópia local por utilizador (`trackall_hall_of_fame_<id>`, `trackall_featured_<id>`). `loadUserData` junta as fontes (BD, coluna `profiles`, localStorage) e fica com a lista **mais completa**; só se grava depois de carregado (`hallRef.loaded`) através de `persistHall` — nunca gravar `hall: []` por omissão. `saveLibrary` ignora ids que começam por `__`.
- **Sincronização da biblioteca:** `saveLibrary` faz diff por item (`libraryRef`), escreve em fila (`saveQueueRef`) e mostra aviso se falhar. `upsertLibraryItem` tenta upsert por `(user_id, media_id)` e cai para update/insert; `deleteLibraryItem` lança erro.
- Sem barras de cor nos posters (a cor do tipo só aparece em gráficos).
- O botão × de remover favorito é `.fav-rm` (hover, só desktop).

Desenhos de referência: artifact "TrackAll Perfil Redesign" (Claude Design): "FINAL v2", "Estrelas", "Definições · Aparência", "Perfil telemóvel · novo".

Backlog do Perfil: usar o mesmo "destaque dentro do Hall of Fame" no PC; redesenhar Tier Lists e Listas (personagens + itens manuais); redesenhar o modal de detalhe; rever o Perfil inteiro no telemóvel (distribuição e estatísticas ainda pensadas para PC); faixa de **Conquistas** por baixo do Hall of Fame (ver secção Conquistas); remover `compressBanner` e restos do banner.

---

## 🚀 Arranque, dados e sincronização

**Fluxo de arranque (`App.jsx`):**
1. `authLoading === true` → mostra `AppSkeleton` (forma da Home, barra lateral/inferior).
2. Com sessão: lê a **cópia local** `cacheGet("boot_<userId>")` (`lib/bootCache.js`, IndexedDB `trackall_cache`/`kv`, falha sempre em silêncio). Se existir `{v:1, lib}` com itens → abre **logo** com perfil (leve, do servidor, timeout 8 s) + biblioteca da cópia; em segundo plano `fetchHeavyData` traz biblioteca + Hall of Fame frescos e `applyUserData` atualiza por baixo (`setDataFresh(true)`).
3. Sem cópia (1.º arranque / cache limpa) → `loadUserData` espera até 30 s no esqueleto; se falhar mostra erro e recupera sozinho se os dados chegarem.
- A cópia é regravada depois de cada alteração (`scheduleBootCache`, debounced) e `cacheClearAll()` corre no logout. **Esqueletos só aparecem no 1.º carregamento sem cópia** — com cópia a app nunca mostra o ecrã de esqueleto.
- `fetchLibrary` exclui a linha especial `__hall_of_fame__`; qualquer id que comece por `__` é ignorado pelo `saveLibrary`.
- `dataFresh` = dados confirmados do servidor. Operações perigosas (migração de imagens, reparações) só correm com `dataFresh === true`, nunca com dados só vindos da cópia local.

**`saveLibrary(lib)`:** atualiza `libraryRef` + estado, agenda cópia local e escreve no Supabase **em fila** (`saveQueueRef`) fazendo diff item a item contra o estado anterior (upsert dos alterados, delete dos removidos). Se falhar mostra aviso "Não foi possível sincronizar". Repor um item removido = `saveLibrary({ ...libraryRef.current, [key]: item })` (o diff volta a fazer o upsert).

**Imagens (`lib/imageStore.js`):** capas personalizadas, fundos e avatar **nunca** ficam em base64 na BD. `persistImage(dataUrl)` envia para o bucket `profile-images` (nome = SHA-1 do conteúdo → a mesma imagem nunca é enviada duas vezes); se falhar mantém o base64 e a **migração única** (`migrateImages`, flag `trackall_img_migrated_<uid>` = `"2"`) tenta mais tarde. O bucket `covers` já não é usado (pode ser apagado).

**Aviso com ação (`Notification.jsx`):** `showNotif(msg, cor, action?)` — `action = { label, onClick }` mostra um botão e prolonga o aviso para 6,5 s. Usado no **"Removido · Desfazer"** (`removeFromLibrary`): repõe o item na biblioteca (não repõe Hall of Fame/favoritos). No telemóvel o aviso fica em baixo, acima da barra de navegação; no PC no canto superior direito. Um temporizador único (`notifTimerRef`) evita que um aviso antigo apague o novo.

---

## 📱 Telemóvel e PWA

**Detetar telemóvel:** `isMobileDevice` no `App.jsx` é **reativo** (`matchMedia('(max-width: 767px)')`), por isso muda ao redimensionar/rodar. Ainda há código que lê `window.innerWidth` uma só vez (gesto de deslizar, alguns handlers) — se mexeres nisso, passa para `isMobileDevice`.
**Ver o telemóvel no PC:** Chrome/Edge → F12 → ícone "Toggle device toolbar" (Ctrl+Shift+M) → escolher um dispositivo. Para toque real (gestos) usar o modo de dispositivo, não só redimensionar a janela.

**Barras (topo e fundo):** `mkNavBg(dark, bg)` (módulo, antes de `DEMO_PROFILE`) devolve um fundo quase preto derivado da cor de fundo do tema (`color-mix` com `#07090c`); `.bottom-nav` e a barra do topo usam-no, com linha fina `rgba(255,255,255,.07)`. `mixHex` calcula a cor da meta `theme-color` (a barra de estado do sistema) para bater com isto.
**Pesquisa no topo (mobile):** `mobileSearchOpen` — por omissão só uma lupa 38×38; ao tocar, a barra abre por cima do logo/avatar com autoFocus, Enter pesquisa, Esc/"Cancelar" fecha. No PC/tablet a barra de pesquisa continua sempre visível.
**Gesto de deslizar entre separadores** (`MAIN_SWIPE_VIEWS = home, library, friends, profile`, só `canUseMainSwipe`): o conteúdo (`mainSwipeContentRef`, `translate3d`) acompanha o dedo; o "peek" (`mainSwipePeekRef`) é agora um **indicador pequeno** (ícone + nome do destino) centrado no espaço revelado, que aparece/cresce com a distância; a página que sai perde até 50 % de opacidade. **Já não há cortina preta** a tapar o fundo. `applyMainSwipeStyle(offset, transition)` controla ambos; ao terminar repõe `opacity:1`. Scroll horizontal dentro da página (filas, chips) **bloqueia** o gesto (`isMainSwipeBlockedTarget`, `hasHorizontalScrollableParent`).

**Filas de scroll horizontal (`.hscroll` e `.recents-row`):** `overflow-x:auto; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; scrollbar-width:none`; no telemóvel `scroll-snap-type: x proximity` com `scroll-snap-align:start` nos filhos, `scroll-padding-inline` igual ao padding da fila e um esbatido (`mask-image`) nas pontas. Usar `className="hscroll"` em qualquer fila nova (os filhos não encolhem: `.hscroll > * { flex:none }`).

**PWA — arranque sem barras brancas:** o `index.html` tem `<style>html,body,#root{background:#0d1117;min-height:100%}` e `color-scheme: dark` **inline no `<head>`**, para o fundo ser escuro desde o 1.º frame (antes do CSS do React). `theme-color` e `manifest.json` (`theme_color` e `background_color`) = `#0d1117`; `viewport-fit=cover`. O splash do Android usa `background_color` do manifest + ícone; se o ícone tiver margens claras, aparecem — usar um ícone **maskable** com fundo escuro até às bordas. Ao mudar manifest/ícones, a PWA instalada só apanha a alteração depois de **desinstalar e reinstalar** (ou limpar dados do site). Se uma correção não aparecer, suspeitar do **service worker** antes de tudo.

---

## 🎨 Padrões de UI (ler antes de mexer no visual)

- **Hover de cartões (tokens únicos):** 180 ms, `cubic-bezier(.2,.8,.2,1)`, `translateY(-4px) scale(1.03)`, anel `0 0 0 1px ${accent}88, 0 18px 30px -12px ${accent}80`. Seletores usam `> div:first-child` em `.recent-card` / `.fav-card-wrap` (o hover é na capa, não no texto). Desligado em toque (`@media (hover:none)`) e com `prefers-reduced-motion`.
- **Filas com `overflow-x:auto` cortam sombras/scale** (e `overflow-y` passa a `auto` também). Solução: padding à volta + margem negativa igual (`.recents-row` na Home: `padding:12px 12px 20px; margin:-8px -12px -10px`) e brilho mais curto dentro da fila. **Nunca** usar `scroll-snap-type: x mandatory` em filas com padding: o snap alinha o 1.º item à borda e **esconde o padding** (era a causa do "hover cortado junto à barra lateral"). Usar `proximity` + `scroll-padding-inline` = padding (no PC o snap está desligado para a roda do rato deslizar continuamente).
- **Roda do rato → scroll horizontal:** o `useEffect` do `App.jsx` liga a todos os `.recents-row, .tabs-scroll, [style*="overflowX: auto"]` (e setas ← → quando o rato está por cima).
- **Modais/overlays:** `createPortal(..., document.body)` sempre. `DetailModal` também passou a portal (z-index 160 tem de vencer `.bottom-nav` z 50; com o `transform` do conteúdo principal o `position:fixed` fica dentro de outro stacking context e a barra de ações ficava cortada pela navegação).
- **Esqueletos:** `Skeleton` / `SkeletonStyles` (shimmer, respeita reduced-motion) em `Skeleton.jsx`; `CoverImg` (esqueleto por capa + fade; o pai tem `position:relative`; usa a classe `.sk-cover` definida no CSS do `App.jsx`) em MediaCard, ProfileView, RecentSection, ProfileTabCompletos, LibraryView; `RecoCarousel` mostra esqueleto de 8 capas **só quando `loading` e ainda sem itens** (1.º carregamento); com dados já na lista mostra-os mesmo durante um refresh.
- **Ícones:** `TypeIcon` (SVG de linha por tipo de media, herda `currentColor` e `1em`) e `ActionIcon({name:'heart'|'star'|'note'|'trash', size, filled, slash, stroke})` (`slash` = risco por cima quando a ação está indisponível, ex.: Hall of Fame cheio). **Não usar emojis** em UI nova.
- **Modal de detalhe no telemóvel:** barra A (classificação sempre visível para mudar na hora) + botões só-ícone `flex:1`, altura 42, `aria-label`/`aria-pressed`, animação `ta-pop` ao ativar; Favorito e Hall of Fame com o mesmo ícone do PC e risco quando cheio (10/30).
- **Painéis:** `const { panelBg } = useTheme()` → `background: panelBg || <default>`.
- **Estilo visual aceite:** limpo e bonito, **não** exagerado; acento único (vermelho/carmim por defeito); cantos 12–18 px; vidro fosco leve. Evitar cores por nível/tipo a mais.

---

## 🗺️ Estado atual e roadmap

**Fase atual:** o Noé aponta pequenos detalhes de UI/UX um a um (PC e telemóvel). Feito em 2026-10: hover da Home sem corte, HoF mobile (2 filas, máx. 10), barras escuras, lupa de pesquisa, filas com scroll melhorado, gesto de deslizar sem cortina, arranque da PWA sem barras brancas, "Desfazer" ao remover, esqueletos por capa e nos carrosséis de recomendações.

**Ordem acordada a seguir:**
1. Rever o **Perfil no telemóvel** (distribuição/estatísticas).
2. **Parte social / Amigos** — rever, corrigir e melhorar (`FriendsView`, `FeedTab`, pedidos de amizade, perfil de amigo, "em comum", feed).
3. **Conquistas** (abaixo) e, no fim, "+1 ep".
4. **Preparar para partilhar** (abaixo).

**Conquistas (desenho feito, código por fazer):** 16 conquistas × 3 níveis, todas **calculadas a partir da biblioteca já carregada**; guardar só o nível mais alto atingido numa linha especial da `library` (id `__achievements__`, excluída do `fetchLibrary`, tal como `__hall_of_fame__`) e toast ao desbloquear. Faixa de 117 px por baixo do Hall of Fame alinhada com o fundo do cartão de perfil; galeria completa em modal (PC) / bottom sheet (telemóvel) com filtros. Símbolos de linha tipo Lucide fixos, **número do nível num badge** (a separação entre níveis é no símbolo, não em cores), acento único, nomes **em inglês** bons (a confirmar com o Noé). Desenhos no canvas Claude Design ("ConquistasFaixa/Galeria/Mobile").

**"+1 ep" (opcional, no fim):** a app **não guarda progresso** por item (só `lastChapter` de texto vindo do Paperback). O AniList devolve `chapters` **só quando a obra terminou** (em publicação vem `null`); episódios de séries/animes também podem faltar. Se avançar: campo novo `progress`, mostrar só "Cap. 12 +" em itens "assistindo", **sem barra nem total**, e manter o modal leve.

**Ideias guardadas:** importar do MAL/AniList/Letterboxd; aviso "nova versão disponível"; imagem "resumo do ano"; paleta Ctrl+K; code splitting (`React.lazy`); pequenos testes automáticos.

**Antes de partilhar com outras pessoas (checklist):**
- [ ] Exportar os meus dados (JSON).
- [ ] Apagar conta + política de privacidade.
- [ ] Limites de upload no Storage (tamanho/tipo por utilizador).
- [ ] Verificar termos **comerciais** do TMDB (atribuição, uso não-comercial) e do plano **Vercel Hobby** (uso não-comercial) antes de aceitar doações/planos.
- [ ] Monitorização de erros (ex.: Sentry free) e RLS revista no Supabase.
- **Capacidade estimada** (free tier): ~50–200 utilizadores ativos; o gargalo é a instância gratuita do Supabase (CPU/ligações e cópias pesadas na BD); depois o Worker (100k pedidos/dia) e as APIs externas.

---

## 🧰 Workflow de trabalho com a IA

- Edita-se uma cópia em `/home/claude/<pasta>/src`; cada ficheiro alterado é entregue **com o caminho de destino** relativo ao `src/` do projeto (ex.: `ProfileView.jsx → src/components/`, `index.html → raiz`, `manifest.json → public/`). O Noé substitui os ficheiros, faz `npm run build`, commit e push.
- **Antes de entregar:** `npx esbuild <ficheiro> --loader:.jsx=jsx --log-level=error` (sintaxe) **e** `npx eslint --no-eslintrc -c .eslintrc.json --ext .jsx,.js <ficheiros>` (imports/variáveis em falta). Os dois, sempre.
- **Memória e idioma:** responder sempre em português de Portugal.
- **Desenhos:** propostas visuais no canvas Claude Design (artifact "TrackAll Perfil Redesign"); o Noé escolhe antes de se implementar.
- **Testar o telemóvel:** DevTools do browser em modo dispositivo (ver secção Telemóvel). Para a PWA instalada, reinstalar.

---

## 🛠️ Como Adicionar Novo Conteúdo

### Adicionar novo tipo de media
1. Editar `src/config/constants.js`:
   - Adicionar entrada em `MEDIA_TYPES`
   - Adicionar cor em `TYPE_COLORS`
2. Atualizar `src/lib/consumptionTime.js` se necessário
3. Atualizar `src/translations.js` com as novas strings

### Adicionar nova API externa
1. Criar ficheiro em `src/api/nomeApi.js` (Fase 2)
2. Exportar funções de pesquisa
3. Importar em `App.jsx` e usar

### Adicionar novo componente UI
1. Criar ficheiro em `src/components/NomeComponent.jsx`
2. Exportar o componente
3. Importar em `App.jsx` ou noutro componente

### Adicionar nova view/página
1. Criar ficheiro em `src/views/NomeView.jsx`
2. Exportar o componente
3. Adicionar routing em `App.jsx`

---

##  Como Debugar

### Erros no terminal (Vite)
- Verificar imports (caminhos relativos corretos)
- Verificar exports nomeados vs default
- Correr `npm install` se faltar dependência

### Erros no browser (Console F12)
- Verificar se o módulo está a ser importado corretamente
- Verificar se as variáveis existem no escopo
- Usar `console.log()` para rastrear valores

### Erros de Supabase
- Verificar `SUPABASE_URL` e `SUPABASE_KEY` em `src/config/supabase.js`
- Verificar RLS policies no dashboard do Supabase
- Verificar se as tabelas existem com o schema correto

### Erros no Cloudflare Worker (trackall-proxy)
- Se um pedido a `trackall-proxy.mcmeskajr.workers.dev/...` (tmdb, books, igdb, anilist, comicvine) devolver **503** sem razao aparente e o resto da app estiver bem, e provavel um *cold start* do Worker (instancia inativa) ou instabilidade pontual na API de origem, nao um bug de codigo.
- Para ver os logs do Worker em tempo real (o Cloudflare Dashboard tem os Workers Logs desativados por defeito): no terminal, dentro da pasta do projeto do Worker, correr `npx wrangler tail trackall-proxy`, autenticar via OAuth no browser quando pedido, e refazer o pedido que estava a falhar na app. O stream mostra os pedidos a chegar ao Worker em tempo real.
- Muitas vezes, o simples facto de abrir o `wrangler tail` e repetir o pedido ja resolve (a instancia "acorda"). Se o 503 persistir mesmo com o tail aberto, ai sim o log mostra a causa real (erro na API de origem, variavel de ambiente em falta, etc.).


**IGDB (token automático):** o Worker renova o token sozinho com `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` (secrets do Cloudflare; client_credentials, cache em `caches.default`, repete o pedido se der 401). `/health` mostra `igdbAutoRefresh`. Publicar com `npx wrangler deploy` na pasta `trackall-worker` (precisa de `wrangler.toml` com `name = "trackall-proxy"`).

### Erros de build (produção)
- Correr `npm run build` localmente para testar
- Verificar warnings do Vite
- Verificar se há imports circulares

---

##  Como Otimizar

### Performance
- Usar `useMemo` para cálculos pesados
- Usar `useCallback` para funções passadas como props
- Lazy load de views com `React.lazy()` + `Suspense`
- Virtualizar listas longas (VirtualGrid)

### Bundle size
- Importar apenas o necessário de cada módulo
- Usar tree-shaking (Vite já faz isto automaticamente)
- Code splitting por route

### Cache
- API calls com cache (ver `CACHE` em `smartSearch`)
- LocalStorage para preferências do utilizador
- Service Worker para assets estáticos (PWA)

---

## 📋 Fases de Refatorização

### ✅ Fase 1 — Config e Lib (Concluída)
- [x] `src/config/constants.js`
- [x] `src/config/theme.js`
- [x] `src/config/supabase.js`
- [x] `src/lib/mediaIds.js`
- [x] `src/lib/consumptionTime.js`

### ✅ Fase 2 — APIs (Concluída)
- [x] `src/api/anilist.js`
- [x] `src/api/tmdb.js`
- [x] `src/api/igdb.js`
- [x] `src/api/books.js`
- [x] `src/api/comicvine.js`
- [x] `src/api/details.js`
- [x] `src/api/recommendations.js`
- [x] `src/api/smartSearch.js`

### ✅ Fase 3 — Componentes UI (Concluída)
- [x] `StarRating`, `Notification`, `MediaCard`, `VirtualGrid`, `TiltCard`, `TierListCard`, `CollectionCard`, `RecentSection`

### ✅ Fase 4 — Modais + Contexts (Concluída)
- [x] `DetailModal`, `CoverEditModal`, `CropModal`, `CollectionModal`, import modals (Mihon/Paperback/Letterboxd)
- [x] `ThemeContext`, `LangContext`
- [ ] Custom hooks (não criados; avaliar se compensa)

### ⏳ Fase 5 — Views (parcial)
- [x] `FriendsView`, `ProfileView`, `AuthScreen`, `LandingPage`, `FeedTab`, `ProfileTabCompletos`, `ProfileTabDiario`
- [x] Perfil v2: `ProfileCard`, `FeaturedPickerModal`, `ProfileStats`, Diário novo (ver secção "Perfil")
- [x] `HomeView`, `LibraryView`, `SearchView` em `src/views/` (+ `LibGroupedList` e `RecoCarousel` em components/)
- [x] `SidebarSearch`, `TierListEditor`, `TierListViewer`, `CollectionViewer`, `RatingOverlay` extraídos para `components/`
- [ ] Custom hooks / dividir mais o `App.jsx` (arranque + sincronização da biblioteca seriam os próximos candidatos)

### 🧪 Verificação depois de extrair código
O esbuild só valida sintaxe e NÃO deteta imports em falta (causou um ecrã branco após o login). Correr sempre:
`npx eslint --no-eslintrc -c .eslintrc.json --ext .js,.jsx src` com `no-undef`, `react/jsx-uses-vars` e `react/jsx-no-undef` ativos, e exigir 0 erros.
Regras: modais novos usam `createPortal(..., document.body)` (ancestrais com `transform` quebram `position: fixed`); nunca chamar hooks depois de um `return` condicional.

---

## 📝 Convenções de Código

- **Ficheiros:** camelCase (`mediaIds.js`, `consumptionTime.js`)
- **Componentes:** PascalCase (`MediaCard.jsx`, `DetailModal.jsx`)
- **Exports:** nomeados (não default) para facilitar tree-shaking
- **Imports:** agrupados por tipo (config, lib, api, components)
- **Comentários:** em português, com separadores visuais (`// ─── Título ───`)
- **Commits:** formato `tipo: descrição` (ex: `refactor: extract constants`)

---

## 🚀 Comandos Úteis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento (localhost:5173)

# Build
npm run build        # Build de produção (pasta dist/)
npm run preview      # Preview do build de produção

# Dependências
npm install          # Instala dependências
npm install <pkg>    # Instala novo pacote
npm uninstall <pkg>  # Remove pacote

# Git (via GitHub Desktop ou terminal)
git add .
git commit -m "mensagem"
git push