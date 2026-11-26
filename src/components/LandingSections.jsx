import { TypeIcon } from "./TypeIcon";

// Secções do meio do ecrã de início: 4 destaques (Importar, Personalização, Tier lists, Listas) + restantes funcionalidades.
// Ilustrações feitas só com elementos da app (gradientes), sem imagens de obras.

const poster = (h, w = "100%", r = 6) => ({ width: w, aspectRatio: "2 / 3", borderRadius: r, flex: "none", background: `linear-gradient(160deg, hsl(${h % 360},50%,40%), hsl(${(h + 40) % 360},56%,13%))`, boxShadow: "0 10px 24px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.1)" });
const P = ({ h, w, r }) => <div style={poster(h, w, r)} />;
const Card = ({ children, pad = 22 }) => <div className="ls-card" style={{ padding: pad }}>{children}</div>;

function Import({ T }) {
  const srcs = ["MyAnimeList", "AniList", "Letterboxd", "Goodreads", "Mihon", "Paperback"];
  return (
    <Card pad={26}>
      <div className="ls-import">
        <div className="ls-srcs">
          {srcs.map((s) => <div key={s} className="ls-src">{s}</div>)}
          <div className="ls-src ls-src-dash">+ {T("Paste a list from your notes", "Colar lista de notas")}</div>
        </div>
        <div className="ls-arrow"><div style={{ fontSize: 30 }}>→</div><span>{T("LINKED TO\nREAL DATABASES", "LIGADO ÀS\nBASES DE DADOS")}</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e6edf3" }}>{T("Your library", "A tua biblioteca")}</span>
            <span style={{ padding: "3px 10px", borderRadius: 8, background: "#10b98122", color: "#34d399", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>✓ 184 {T("imported", "importados")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>{[235, 140, 35, 350, 190, 340, 265, 320].map((h) => <P key={h} h={h} />)}</div>
        </div>
      </div>
    </Card>
  );
}

function Personalize({ T }) {
  const mini = (h, name, acc) => (
    <div key={name} className="ls-mini" style={{ background: `hsl(${h},35%,12%)` }}>
      <div style={{ height: 74, background: `linear-gradient(120deg, hsl(${h},55%,35%), hsl(${h + 30},60%,18%))` }} />
      <div style={{ padding: "0 12px 12px", marginTop: -22, textAlign: "center" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: `hsl(${h + 80},40%,45%)`, border: `3px solid hsl(${h},35%,12%)`, margin: "0 auto" }} />
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginTop: 6 }}>{name}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>{[0, 1, 2].map((i) => <span key={i} style={{ flex: 1, height: 22, borderRadius: 6, background: `${acc}33`, border: `1px solid ${acc}55` }} />)}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 10, justifyContent: "center" }}>{[0, 1, 2, 3].map((i) => <P key={i} h={h + i * 30} w={30} r={3} />)}</div>
      </div>
    </div>
  );
  return (
    <Card>
      <div className="ls-minis">{mini(215, T("Midnight blue", "Azul noite"), "#5b86f5")}{mini(340, T("Sakura pink", "Rosa sakura"), "#ec4899")}{mini(145, T("Forest", "Floresta"), "#10b981")}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        {["#f97316", "#5b86f5", "#10b981", "#ec4899", "#a855f7", "#eab308"].map((c) => <span key={c} style={{ width: 26, height: 26, borderRadius: "50%", background: c, boxShadow: `0 0 0 2px #141a22, 0 0 0 3px ${c}66` }} />)}
        {[T("Wallpaper", "Wallpaper"), T("Panel opacity", "Transparência"), T("Banner", "Banner")].map((t) => <span key={t} className="ls-chip">{t}</span>)}
      </div>
    </Card>
  );
}

function Tiers({ T }) {
  const rows = [["S", "#ef4444", 5], ["A", "#f97316", 6], ["B", "#eab308", 7], ["C", "#22c55e", 4], ["D", "#3b82f6", 3]];
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#e6edf3" }}>{T("Best games of 2025", "Melhores jogos de 2025")}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#8b949e" }}>{T("Share", "Partilhar")} ↗</span>
      </div>
      {rows.map(([l, c, n], i) => (
        <div key={l} style={{ display: "flex", gap: 6, alignItems: "stretch", marginBottom: 6 }}>
          <div style={{ width: 50, borderRadius: 8, background: c, color: "#111", fontWeight: 900, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{l}</div>
          <div style={{ flex: 1, display: "flex", gap: 6, padding: 6, borderRadius: 8, background: "rgba(255,255,255,.04)", minHeight: 72, alignItems: "center", overflow: "hidden" }}>
            {Array.from({ length: n }, (_, j) => <P key={j} h={i * 61 + j * 29} w={38} r={4} />)}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 12, padding: 10, borderRadius: 10, border: "1px dashed #3a4350", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: "#6b7684", marginRight: 6 }}>{T("UNRANKED", "POR CLASSIFICAR")}</span>
        {[10, 80, 150, 220, 290].map((h) => <P key={h} h={h} w={34} r={4} />)}
      </div>
    </Card>
  );
}

function Lists({ T, accent }) {
  const lst = (name, desc, hs, n) => (
    <div key={name} className="ls-list">
      <div style={{ position: "relative", width: 150, height: 110, flex: "none" }}>
        {hs.map((h, i) => <div key={h} style={{ position: "absolute", left: i * 26, top: (i % 2) * 6, transform: `rotate(${(i - 1) * 5}deg)` }}><P h={h} w={62} r={6} /></div>)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#e6edf3" }}>{name}</div>
        <div style={{ fontSize: 12.5, color: "#8b949e", marginTop: 3 }}>{desc}</div>
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 800, color: accent }}>{n} {T("items · anime, movies, games", "itens · anime, filmes, jogos")}</div>
      </div>
    </div>
  );
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lst(T("To watch this winter", "Para ver no inverno"), T("The queue for the next few days", "A fila dos próximos dias"), [235, 35, 140], 12)}
        {lst(T("Stories that stayed with me", "Obras que me marcaram"), T("The ones I would go back to", "As que voltaria a ver"), [350, 265, 190], 9)}
        {lst(T("Visual Novels I'm playing", "Visual Novels a jogar"), T("From planned to finished", "Do planeado ao terminado"), [340, 280, 320], 6)}
      </div>
    </Card>
  );
}

function Showcase({ kicker, head, desc, bullets, visual, flip, color }) {
  return (
    <div className={`ls-show${flip ? " ls-flip" : ""}`}>
      <div className="ls-txt">
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".1em", color, marginBottom: 14 }}>{kicker}</div>
        <h3 className="ls-h3">{head}</h3>
        <p className="ls-desc">{desc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {bullets.map((b) => <div key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: "#c9d1d9", lineHeight: 1.5 }}><span style={{ color, fontWeight: 900 }}>✓</span>{b}</div>)}
        </div>
      </div>
      <div className="ls-vis">{visual}</div>
    </div>
  );
}

const CSS = `
.ls-wrap { padding: 30px 80px 10px; max-width: 1440px; margin: 0 auto; }
.ls-sec-k { font-size: 12px; font-weight: 800; letter-spacing: .1em; color: var(--ls-acc); margin-bottom: 12px; text-align: center; }
.ls-sec-h { font-size: clamp(30px, 3.6vw, 44px); font-weight: 900; letter-spacing: -1.4px; color: #e6edf3; text-align: center; line-height: 1.1; }
.ls-sec-s { font-size: 16px; color: #6b7684; margin: 10px 0 0; text-align: center; }
.ls-show { display: flex; gap: 70px; align-items: center; padding: 40px 0; }
.ls-show.ls-flip { flex-direction: row-reverse; }
.ls-txt { flex: 1; min-width: 0; }
.ls-vis { flex: 1.15; min-width: 0; display: flex; justify-content: center; }
.ls-vis > * { width: 100%; }
.ls-h3 { font-size: clamp(28px, 3vw, 38px); font-weight: 900; line-height: 1.1; letter-spacing: -1.2px; color: #e6edf3; margin: 0 0 16px; }
.ls-desc { font-size: 16.5px; line-height: 1.7; color: #8b949e; margin: 0 0 22px; max-width: 470px; }
.ls-card { box-sizing: border-box; background: #141a22; border: 1px solid #232b36; border-radius: 20px; box-shadow: 0 30px 70px rgba(0,0,0,.45); }
.ls-import { display: flex; gap: 22px; align-items: center; }
.ls-srcs { display: flex; flex-direction: column; gap: 8px; width: 170px; flex: none; }
.ls-src { padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid #2a313b; font-size: 13px; font-weight: 800; color: #d4dbe3; }
.ls-src-dash { background: transparent; border: 1px dashed #3a4350; font-size: 12.5px; font-weight: 700; color: #8b949e; }
.ls-arrow { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--ls-acc); }
.ls-arrow span { font-size: 11px; font-weight: 800; letter-spacing: .06em; color: #8b949e; white-space: pre-line; text-align: center; }
.ls-minis { display: flex; gap: 12px; }
.ls-mini { flex: 1; min-width: 0; border-radius: 14px; overflow: hidden; border: 1px solid #2a313b; }
.ls-chip { padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,.06); border: 1px solid #2a313b; font-size: 12px; font-weight: 700; color: #c9d1d9; }
.ls-list { display: flex; gap: 16px; align-items: center; padding: 16px; border-radius: 14px; background: rgba(255,255,255,.04); border: 1px solid #2a313b; }
.ls-more { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-top: 30px; }
.ls-more > div { padding: 20px; border-radius: 16px; background: #141a22; border: 1px solid #232b36; transition: transform .2s, border-color .2s; }
.ls-more > div:hover { transform: translateY(-3px); border-color: #3a4350; }
@media (max-width: 960px) {
  .ls-wrap { padding: 20px 20px 0; }
  .ls-show, .ls-show.ls-flip { flex-direction: column; gap: 28px; padding: 28px 0; align-items: stretch; }
  .ls-vis { flex: none; }
  .ls-import { flex-direction: column; align-items: stretch; }
  .ls-srcs { width: auto; flex-direction: row; flex-wrap: wrap; }
  .ls-arrow { flex-direction: row; justify-content: center; }
  .ls-arrow div { transform: rotate(90deg); }
  .ls-minis { flex-direction: column; }
  .ls-more { grid-template-columns: repeat(2, 1fr); }
  .ls-list { flex-direction: column; align-items: flex-start; }
}
`;

export function LandingSections({ lang, accent }) {
  const T = (en, pt) => (lang === "en" ? en : pt);
  const more = [
    ["search", T("Explore", "Explorar"), T("Discover by type, year and status.", "Descobre por tipo, ano e estado.")],
    ["anime", T("Rate & track", "Avalia e acompanha"), T("Ratings, statuses and dates.", "Notas, estados e datas.")],
    ["manga", T("Diary", "Diário"), T("Everything you finish, month by month.", "Tudo o que acabas, mês a mês.")],
    ["jogos", "Hall of Fame", T("Your top 10 and favourites per type.", "Os teus 10 melhores e favoritos por tipo.")],
    ["series", T("Friends & feed", "Amigos e feed"), T("See what your friends finish.", "Vê o que os teus amigos acabam.")],
    ["filmes", T("Search 7 databases", "Pesquisa em 7 bases"), T("One search box for everything.", "Uma caixa de pesquisa para tudo.")],
    ["livros", T("For you", "Para ti"), T("Suggestions and a pick for every day.", "Sugestões e uma escolha por dia.")],
    ["comics", T("Characters & cast", "Personagens e elenco"), T("Who is behind every title.", "Quem está por trás de cada obra.")],
    ["visualnovels", T("Quick log", "Log rápido"), T("Add and rate in two taps.", "Adiciona e avalia em dois toques.")],
    ["lightnovels", T("Goes with you", "Vai contigo"), T("Installable app, PT/EN, synced.", "App instalável, PT/EN, sincronizada.")],
  ];
  return (
    <section style={{ "--ls-acc": accent }}>
      <style>{CSS}</style>
      <div className="ls-wrap">
        <div className="ls-sec-k">{T("WHAT MAKES US DIFFERENT", "O QUE NOS DISTINGUE")}</div>
        <h2 className="ls-sec-h">{T("Built for people who take media seriously", "Pensado para quem leva a mídia a sério")}</h2>
        <p className="ls-sec-s">{T("Four things you won't find together in other apps", "Quatro coisas que não encontras juntas noutras apps")}</p>
        <Showcase color="#f97316" kicker={T("IMPORT", "IMPORTAR")} head={T("Don't start from zero", "Não recomeças do zero")}
          desc={T("Bring everything you've watched, read and played from wherever it lives. Every title is linked to the real databases, so it arrives with its cover, scores and full details.", "Traz tudo o que já viste, leste e jogaste de onde estiver. Cada obra é ligada às bases de dados, por isso fica com capa, notas e detalhes completos.")}
          bullets={[T("MyAnimeList, AniList, Letterboxd, Goodreads, Mihon and Paperback", "MyAnimeList, AniList, Letterboxd, Goodreads, Mihon e Paperback"), T("Paste a list from your notes and we find each title", "Cola uma lista de notas e a app encontra cada obra"), T("Completion dates carry over to your diary where the source has them", "As datas de conclusão passam para o diário quando a origem as tem")]}
          visual={<Import T={T} />} />
        <Showcase flip color="#ec4899" kicker={T("PERSONALISATION", "PERSONALIZAÇÃO")} head={T("Your profile, your look", "O teu perfil, com a tua cara")}
          desc={T("Accent colour, wallpaper, banner and panel transparency. Make the app look like you.", "Cor de destaque, wallpaper, banner e transparência dos painéis. Faz a app ter a tua cara.")}
          bullets={[T("Colours and themes of your choice", "Cores e temas à escolha"), T("Wallpaper and profile banner", "Wallpaper e banner do perfil"), T("Sync your look between desktop and phone", "Sincroniza o visual entre PC e telemóvel")]}
          visual={<Personalize T={T} />} />
        <Showcase color="#fbbf24" kicker="TIER LISTS" head={T("Rank what really matters", "Ordena o que realmente importa")}
          desc={T("Drag titles into S, A, B, C and D and build rankings of your media. Make one per type, per year or per theme, and share it with friends.", "Arrasta as obras para S, A, B, C e D e cria rankings da tua mídia. Faz uma por tipo, por ano ou por tema e partilha com amigos.")}
          bullets={[T("Simple drag-and-drop editor", "Editor simples de arrastar e largar"), T("Mix types or keep them separate", "Mistura tipos ou separa por categoria"), T("Browse and like other people's lists", "Vê e dá like às listas de outros")]}
          visual={<Tiers T={T} />} />
        <Showcase flip color="#06b6d4" kicker={T("LISTS", "LISTAS")} head={T("Every collection, your way", "Cada coleção, à tua maneira")}
          desc={T("Put anime, movies, games and books in the same list: a winter queue, the stories that stayed with you, the games you want to finish.", "Junta anime, filmes, jogos e livros na mesma lista: uma fila para o inverno, as obras que te marcaram, os jogos que queres terminar.")}
          bullets={[T("Mix every type of media", "Mistura todos os tipos de mídia"), T("Stacked covers you recognise at a glance", "Capas empilhadas para reconhecer à primeira"), T("Organised like folders", "Organizadas como pastas")]}
          visual={<Lists T={T} accent="#06b6d4" />} />
      </div>
      <div className="ls-wrap" style={{ paddingTop: 50, paddingBottom: 20 }}>
        <div className="ls-sec-k">{T("AND MUCH MORE", "E MUITO MAIS")}</div>
        <h2 className="ls-sec-h">{T("Everything else, already included", "Tudo o resto que já vem incluído")}</h2>
        <div className="ls-more">
          {more.map(([ic, t, d]) => (
            <div key={t}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}1c`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 17 }}><TypeIcon id={ic} /></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#e6edf3" }}>{t}</div>
              <div style={{ fontSize: 12.5, color: "#8b949e", marginTop: 4, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
