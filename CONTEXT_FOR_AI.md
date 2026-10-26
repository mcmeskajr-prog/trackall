# TrackAll — Contexto para IA (complemento ao DEV_GUIDE.md)

> Este documento cobre o que **não** está no `DEV_GUIDE.md`: decisões recentes, bugs já corrigidos (para não os repetir), e ideias discutidas mas ainda não implementadas. Lê os dois juntos.

---

## ⚠️ Armadilhas já apanhadas — não repetir

1. **`position: fixed` quebrado por um ancestor com `transform`**
   Há uma `div` (`mainSwipeContentRef`) que envolve quase todo o conteúdo da app (usada para o gesto de deslizar entre separadores no mobile) com `transform: translate3d(0,0,0)` sempre ativo. Qualquer modal com `position: fixed` renderizado *dentro* dela fica desalinhado (aparece fora do ecrã visível, obrigando a scroll para o encontrar), porque o `transform` cria um novo containing block.
   **Regra:** qualquer modal/overlay novo tem de ser renderizado com `createPortal(..., document.body)` (de `react-dom`), nunca só `position: fixed` direto dentro da árvore normal. Já corrigido em `CropModal`, `CollectionModal`, `TierListEditor`, `TierListViewer`. O `DetailModal` também passou a portal (2026-10: a barra de ações ficava cortada pela barra de navegação do telemóvel por causa do stacking context). Se criares um modal novo, portal desde o início.

2. **Hooks chamados depois de um `return` condicional**
   Uma secção do Início ("Provavelmente nunca vais consumir") tinha um `useState` a meio de uma função só executada às vezes — viola as Regras dos Hooks e causava ecrã branco (`ReferenceError: React is not defined` + crash) assim que a condição mudava. Já corrigido (o estado subiu para o topo do componente, chamado sempre). **Nunca** puderem hooks (`useState`, `useEffect`, etc.) depois de um `if (...) return` dentro de uma função/IIFE — têm de estar sempre no topo do componente, chamados incondicionalmente.

3. **Imagens guardadas como base64 direto na base de dados**
   O avatar/banner do perfil eram recortados e guardados como string base64 gigante (às vezes >1MB de texto) diretamente na coluna `profiles`. Isso fazia o "Guardar" encravar silenciosamente. Corrigido: agora as imagens recortadas são enviadas para o **Supabase Storage** (bucket `profile-images`, público, com policies de INSERT+UPDATE para `authenticated`, caminho `{user_id}/{ficheiro}`) e só o URL curto resultante é guardado na base de dados. Ver `supa.uploadImage(userId, blob, filename)` em `config/supabase.js`. **Qualquer funcionalidade nova de upload de imagem deve usar este padrão, nunca base64 direto.**

4. **`toggleTierlistLike` não devolvia valor**
   Causava contagem de likes sempre a decrescer (mesmo ao dar like, não só ao tirar). Corrigido para devolver `true`/`false`, e o frontend agora bloqueia cliques sobrepostos enquanto um toggle está em curso (`likingTierlistRef`).

5. **Vistas ficam montadas em segundo plano (`display:none`)**
   `App.jsx` monta Home/Biblioteca/Amigos/Perfil em simultâneo e só esconde as inativas. Um `useEffect` com cleanup num componente de uma vista **não** corre ao mudares de página. Foi assim que o tema do amigo ficou "preso" ao ir para o teu Perfil. **Regra:** estado global que depende de uma vista ser a ativa tem de ser derivado de `view` (ex.: `friendTheme = view === "friends" ? friendThemeRaw : null`), não só de mount/unmount.

6. **Barra lateral/inferior e tema temporário**
   Qualquer tema temporário (ex.: o do amigo) não pode mexer na barra lateral nem na `.bottom-nav`: usar `ownDark`/`ownBgColor` (o teu tema), nunca `activeDarkMode`. A regra CSS `!activeDarkMode` força a barra a branco.

7. **`darkMode` da página ≠ do painel**
   Em fundos claros/wallpapers, o texto sobre painéis tem de usar `panelDark ?? darkMode` (ver DEV_GUIDE, "Legibilidade"). Misturar em luminância linear dá o resultado errado; usar sRGB (`lib/contrast.js`).

5. **`mediaIds.js` e `config/supabase.js` já foram dessincronizados do `App.jsx` no passado**
   Antes de mudar a assinatura de qualquer função em `src/lib/` ou `src/config/`, correr `grep` no `App.jsx` por todos os call sites — já aconteceu mais do que uma vez uma função ser reescrita com uma assinatura diferente da que o resto do código espera.

6. **Verificação de sintaxe antes de entregar código**
   Uso `esbuild.transformSync(código, { loader: 'jsx' })` para validar sintaxe antes de dar qualquer ficheiro ao Noé — já apanhou erros reais (declarações duplicadas, vírgulas em falta) que uma leitura visual não apanhava. Recomendo o mesmo processo a quem mexer no código.

7. **`scroll-snap-type: x mandatory` esconde o padding das filas**
   O snap alinhava o 1.º cartão à borda esquerda da fila e "comia" o padding criado para o hover/brilho — por isso o hover do primeiro item colado à barra lateral aparecia cortado. Usar `proximity` + `scroll-padding-inline` igual ao padding (ver "Padrões de UI" no DEV_GUIDE). Filas com `overflow-x:auto` cortam sempre sombras/scale: padding + margem negativa.

8. **Aumentar margens não resolve se a causa é outra**
   O hover cortado foi "corrigido" duas vezes só com padding antes de se descobrir o snap. Antes de repetir uma correção que não resultou, procurar a causa (`grep` por `scroll-snap`, `overflow`, `transform` nos ancestrais).

9. **Arranque da PWA: o fundo tem de existir antes do React**
   As barras brancas no arranque eram o fundo por defeito do browser antes do CSS carregar. Fundo escuro inline no `index.html` + `theme_color`/`background_color` escuros no manifest. A PWA instalada só apanha alterações do manifest depois de reinstalar.

10. **O gesto de deslizar entre separadores usa o conteúdo todo**
   `mainSwipeContentRef` recebe `translate3d` e opacidade durante o gesto; o "peek" é só um indicador pequeno. Não voltar a pôr um fundo opaco no peek (tapava a página e o fundo da app).

11. **Dependências de `isMobileDevice`**
   É reativo (`matchMedia`), mas há código que ainda lê `window.innerWidth` uma vez. Ao mexer em layout mobile, testar rodar o ecrã/redimensionar.

12. **APIs: `chapters` só vem em obras terminadas**
   AniList devolve `chapters: null` para mangás/manhwas em publicação. Nunca assumir um total para barras de progresso.

---

## ✅ Trabalho recente concluído

**Outubro de 2026 (polimento):** HoF mobile em 2 filas (máx. 10); barras do telemóvel mais escuras (`mkNavBg`/`mixHex`); lupa de pesquisa expansível no topo; scroll lateral com inércia/snap suave (`.hscroll`); gesto entre separadores com indicador pequeno em vez de cortina; fundo escuro desde o 1.º frame na PWA; "Removido · Desfazer"; esqueletos por capa (`CoverImg`) e nos carrosséis de recomendações; ícones SVG (`TypeIcon`, `ActionIcon`); modal de detalhe mobile com barra compacta (rating + Favorito/HoF só ícone); cópia local de arranque (`bootCache`) e migração de imagens base64 → Storage (`imageStore`); `DetailModal` em portal.

- **Fase 1 e 2 da refatoração** (ver DEV_GUIDE.md) — `App.jsx` dividido em `config/`, `lib/`, `api/`. Fases 3-5 (componentes UI, modais, views) estão **pausadas de propósito**, para andarem a par do trabalho visual.
- **Pesquisa reformulada**: resultados por tipo deixaram de se apagar ao trocar de separador; corrigida uma condição de corrida em respostas fora de ordem; ordenação por relevância; limites de resultados subidos (15→24/40 consoante a API); `searchSteam` passou a usar o Worker (Cloudflare) em vez de chamar a Steam diretamente do browser (evita erro de CORS).
- **3 traduções corrigidas** em `translations.js`: `favorites`, `diary`, `password` (estavam em inglês dentro do bloco `pt:`).
- **Visual**: efeito "vidro fosco" (`backdrop-filter: blur` + fundo translúcido) nos cards de pesquisa e nos modais/cartões de Listas e Tier Lists (`.modal-glass`); hover consistente (título + rating no gradiente escuro) em Favoritos/Completados/Biblioteca, incluindo o modo Compacto; modo de tamanho "Grande" novo na Biblioteca e nas Listas (P/M/G); cabeçalhos sem ícone onde pedido ("Recentes", "Para Hoje", etc.); componente `TiltCard` reutilizável — inclinação 3D + brilho a seguir o rato no hover, sem custo de performance (mexe direto no DOM via `ref`, throttled a 1x por frame com `requestAnimationFrame`, nunca usa `useState` para a posição do rato). Aplicado no "Melhor para Hoje", Hall of Fame e Favoritos.
- **Tier Lists / Listas**: lista de itens do "Editar Coleção" passou de texto empilhado para grelha de mini-capas com hover; `TierListViewer` passou a ter filas tipo "prateleira" com scroll horizontal e contador por tier; itens da Tier List agora clicáveis (abrem o `DetailModal` por cima, usando o portal).

## 🧭 Ideias discutidas mas NÃO implementadas ainda

**Próximos passos combinados (2026-10-16):** rever Perfil no telemóvel → **parte social/Amigos** (rever, corrigir, melhorar) → **Conquistas** (16 × 3 níveis, faixa sob o Hall of Fame; desenho feito no canvas) → "+1 ep" opcional → checklist para partilhar (exportar dados, apagar conta, privacidade, limites de upload, termos TMDB/Vercel, monitorização). Detalhes no DEV_GUIDE ("Estado atual e roadmap").

Inspiração vinda do site **Passportdex** (referência visual dada pelo Noé — perfis de media com personalidade, tilt nos cards, organização em prateleiras com contagem):

- **Redesign do Perfil**: não pôr a foto de perfil ao centro com media à volta (decidido contra isto — não escala com 226+ itens, e desvia o foco de "o que gostas" para "quem és"). Direção acordada: um item em destaque (ex: Hall of Fame #1) com tilt no topo do Perfil, mantendo a foto pequena como identificador.
- **"A ver/jogar agora"**: chegámos a implementar um chip por baixo do nome no Perfil (capa + "A jogar: X"), mas foi removido a pedido — vai ser repensado a sério mais tarde, não como estava.
- **Badge de nota uniforme**: usar sempre o mesmo componente de "badge circular com nota" em vez de texto solto (★7.5) espalhado por vários sítios.
- **Barra de cor por tipo de media** nas capas das prateleiras (usar `TYPE_COLORS`, já existente no código mas pouco usado visualmente).
- **Tier Lists / Listas — funcionalidade** (âmbito futuro, explicitamente adiado): permitir incluir personagens misturados com media (as Listas já suportam personagens; confirmar se as Tier Lists também); inserção manual de um item quando não há informação disponível na API.

## 🗄️ Infraestrutura

- **Supabase Storage**: bucket `profile-images` (público; o bucket `covers` já não é usado), policies de INSERT/UPDATE para `authenticated`, restritas à pasta `{auth.uid()}/...`. Usado para avatar e banner do perfil.
- **Cloudflare Worker** (`trackall-proxy`): proxy para AniList, TMDB, IGDB, Steam, ComicVine, Google Books. Debug com `npx wrangler tail trackall-proxy` se aparecer 503 (muitas vezes é só cold start).
- **Workflow do Noé**: edita no VS Code → `npm run build` local → commit/push no GitHub Desktop → deploy automático no Vercel. É uma PWA com service worker — se uma correção parecer não ter efeito nenhum mesmo depois de deploy, suspeitar de cache do service worker antes de mais nada (Application → Service Workers → Unregister, e/ou Clear site data).
