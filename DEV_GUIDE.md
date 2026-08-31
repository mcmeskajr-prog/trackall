# 📘 TrackAll — Developer Guide

> **Última atualização:** 2026-09-01 (Fase 1 concluída)
> **Estado:** Em refatorização ativa

---

## 🎯 Visão Geral

**TrackAll** é uma aplicação web para tracking de media (anime, manga, séries, filmes, jogos, livros, manhwa, light novels, comics).

- **Stack:** React + Vite + Supabase
- **Deploy:** Vercel (via GitHub)
- **Língua:** PT/EN (i18n via `translations.js`)
- **Estado:** Single-file App.jsx (~9500 linhas → sendo refatorizado)

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
  - api/ (Fase 2 - vazio por agora)
  - components/ (Fase 3 - vazio por agora)
  - contexts/ (Fase 4 - vazio por agora)
  - hooks/ (Fase 4 - vazio por agora)
  - views/ (Fase 5 - vazio por agora)   

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

---

### `src/lib/mediaIds.js`
**O que contém:**
- `normalizeMediaId(id)` — Normaliza IDs (lowercase, remove espaços e chars especiais)
- `mediaIdCandidates(item)` — Gera lista de IDs possíveis para um item
- `findLibraryEntry(library, item)` — Procura item na biblioteca por ID normalizado
- `normalizeMediaItem(item)` — Normaliza um objeto de media

**Quando editar:**
- Mudar lógica de matching → editar `normalizeMediaId`
- Adicionar novo campo de ID → editar `mediaIdCandidates`

---

### `src/lib/consumptionTime.js`
**O que contém:**
- `getConsumptionTime(item)` — Determina slot ideal (hoje / fim de semana / férias) baseado no tipo de media e status "planejado"

**Quando editar:**
- Mudar lógica de slots → editar a função
- Adicionar novo tipo de media → adicionar regra no `if/else`

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

### 🔄 Fase 2 — APIs (Próxima)
- [ ] `src/api/anilist.js`
- [ ] `src/api/tmdb.js`
- [ ] `src/api/igdb.js`
- [ ] `src/api/books.js`
- [ ] `src/api/comicvine.js`
- [ ] `src/api/details.js`
- [ ] `src/api/recommendations.js`
- [ ] `src/api/smartSearch.js`

### ⏳ Fase 3 — Componentes UI
- [ ] `StarRating`
- [ ] `Notification`
- [ ] `MediaCard`
- [ ] `VirtualGrid`

###  Fase 4 — Modais + Contexts + Hooks
- [ ] `DetailModal`
- [ ] `CropModal`
- [ ] `CollectionModal`
- [ ] Contextos React
- [ ] Custom hooks

### ⏳ Fase 5 — Views
- [ ] `HomeView`
- [ ] `LibraryView`
- [ ] `SearchView`
- [ ] `FriendsView`
- [ ] `ProfileView`
- [ ] `AuthScreen`
- [ ] `LandingPage`

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