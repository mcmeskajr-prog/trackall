# 📘 TrackAll — Developer Guide

> **Última atualização:** 2026-10-10 (Fases 1–4 concluídas; Fase 5: Home/Biblioteca/Pesquisa extraídas; falta SidebarSearch, TierListEditor/Viewer, CollectionViewer)
> **Estado:** Em refatorização ativa

---

## 🎯 Visão Geral

**TrackAll** é uma aplicação web para tracking de media (anime, manga, séries, filmes, jogos, livros, manhwa, light novels, comics).

- **Stack:** React + Vite + Supabase
- **Deploy:** Vercel (via GitHub)
- **Língua:** PT/EN (i18n via `translations.js`)
- **Estado:** Single-file App.jsx (~9500 linhas → sendo refatorizado)

---

## ⚠️ Contrato entre módulos — lições da refatorização (2026-09-01)

A separação do `App.jsx` monolítico em `config/` e `lib/` introduziu 4 bugs em produção, todos pela mesma causa raiz: **um módulo novo foi escrito a partir do que "fazia sentido" ou do que o `DEV_GUIDE.md` dizia, sem confirmar contra as chamadas reais já existentes no `App.jsx`.** Regras para não repetir:

1. **`App.jsx` é a fonte da verdade, não este guia.** Antes de implementar ou alterar qualquer função em `config/` ou `lib/`, corre `grep -n "nomeDaFuncao(" src/App.jsx` e lê **todos** os call sites — assinatura de argumentos e forma do valor devolvido. Só depois escreve a função. Este guia deve ser atualizado a seguir, nunca ao contrário.
2. **Nunca assumir nomes de colunas do Supabase.** Confirma no dashboard (ou no SQL editor) antes de escrever `.eq()`/`.or()`. Um nome de coluna errado dá erro 400 que não aparece como crash imediato — só quebra silenciosamente mais tarde num `useMemo` que espera dados que nunca chegaram.
3. **Qualquer wrapper que leia uma tabela em forma de "biblioteca" (`library`, e no futuro semelhantes) tem de devolver exatamente a forma que o resto da app espera** — neste caso um objeto `{ [id]: item }`, nunca o array de linhas do Supabase. Verifica isso com `Object.entries`/`Object.values` nos consumidores antes de decidir a forma de retorno.
4. **Se o `DEV_GUIDE.md` lista uma função que não está exportada** (aconteceu com `normalizeMediaItem`, documentada mas nunca implementada), trata isso como um bug a corrigir, não como documentação a ignorar — procura todos os usos antes de assumir que "não é preciso".
5. **Depois de qualquer alteração a `config/supabase.js` ou `lib/mediaIds.js`, testar manualmente o fluxo completo**, não só o que motivou a alteração: login → biblioteca carrega com capas e tipos corretos → adicionar item → dar rating → remover item → pedidos de amizade. Estes 5 pontos cobrem quase todos os call sites críticos destes dois ficheiros.

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
  - components/ (AuthScreen, CollectionCard, CollectionModal, CoverEditModal, CropModal, DetailModal, FeedTab, FeaturedPickerModal, FriendsView, LandingPage, LetterboxdImportModal, LibGroupedList, MediaCard, MihonImportModal, Notification, PaperbackImportModal, ProfileCard, ProfileStats, ProfileTabCompletos, ProfileTabDiario, ProfileView, RecentSection, RecoCarousel, StarRating, TierListCard, TiltCard, VirtualGrid)
  - contexts/ (ThemeContext: useTheme/useAccent/useDarkMode/useIsMobile; LangContext: useLang)
  - lib/ (inclui utils.js e importParsers.js)
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
- **Estado atual:** ~8500 linhas (em refatorização)

**Quando editar:**
- Só editar diretamente se for lógica de orquestração
- Nova feature → criar componente/hook/view separado e importar

---

### 👤 Perfil — redesign v2 (desktop concluído; telemóvel por afinar)
Layout (separador Perfil, `ProfileView.jsx`):
- Linha de cima: `ProfileCard` (330px, à esquerda) + coluna da direita com `ProfileStats` (4 números, "Por tipo" + estados, ratings) e o Hall of Fame.
- Largura total, por esta ordem: barra de filtros partilhada → Recentes (`RecentSection`) → Favoritos → cartões Tier Lists / Minhas Listas → Top géneros → definições (temas, importações, legal, zona de perigo).
- Mobile: mesma ordem numa só coluna; Hall of Fame e cada fila de Favoritos são filas com scroll horizontal.

Componentes:
- `ProfileCard.jsx`: identidade centrada (avatar 104px com aro duplo + glow), item em destaque (`TiltCard`, `hiRes()` com fallback no `onError`), botão discreto de trocar destaque, "Editar perfil" e terminar sessão. Sem destaque escolhido, usa o item com maior rating.
- `FeaturedPickerModal.jsx`: escolher o destaque (portal, zIndex 170, pesquisa + chips por tipo + grelha).
- `ProfileStats.jsx`: números, barra por tipo, estados e histograma. A prop `stacked` empilha os painéis (já não é usada pelo ProfileView atual).
- `ProfileTabDiario.jsx` (v2): números do ano, atividade por mês, chips por tipo (filtro próprio do separador), entradas por mês e coluna lateral (ratings, por tipo, melhor do mês).
- `Sakura` (função local no ProfileView): badge do Hall of Fame.

Regras e dados:
- O filtro (`favFilter`, estado do ProfileView) filtra **Recentes e Favoritos ao mesmo tempo**. Em "Tudo", cada tipo tem a sua fila (6 posters + "+N ver todos", expandido por `favExpanded[tipo]`); com um tipo escolhido, só aparece essa fila.
- Limites: Hall of Fame 10 (`App.jsx` → `toggleHallOfFame` e `DetailModal`), Favoritos 30.
- O item em destaque guarda-se em `library` na linha especial `__hall_of_fame__` como `{ hall, featured }`. Sem migração (a tabela `profiles` não tem coluna para isto). `toggleHallOfFame` preserva sempre o `featured`.
- Sem barras de cor nos posters (decisão de design); a cor do tipo só aparece em gráficos.
- Estilo: vidro escuro (`rgba(12,14,18,.6)` + gradiente leve + `backdrop-filter`), igual no cartão, estatísticas e Diário. Evitar brancos por cima do destaque (`brightness(.9)` + gradiente escuro).
- O botão × de remover favorito é `.fav-rm` (opacity 0, visível no hover via CSS global em `App.jsx`); só no desktop.

Desenhos de referência: artifact "TrackAll Perfil Redesign" (Claude Design), quadros "FINAL v2" (desktop, telemóvel, Diário) e "Hall of Fame · tamanhos".

Backlog do perfil: afinar o telemóvel; estatísticas do topo interativas (clicar num tipo filtra); escolher o estilo do perfil por utilizador (Passaporte / Diário / Cartão); redesenhar Tier Lists e Listas; trocar o símbolo ou substituto das linhas de cor, se for preciso; remover `compressBanner` e restos do banner.

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
- [ ] `SidebarSearch`, `TierListEditor`, `TierListViewer`, `CollectionViewer` (ainda no `App.jsx`)

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