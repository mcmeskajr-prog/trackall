export function LandingPage({ accent, onEnter, onDemo, lang = "en", useT = (k) => k, changeLang }) {
  const accentRgb = `${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}`;
  const features = [
    { icon: "📚", title: useT("feature1Title"), desc: "Anime, manga, filmes, séries, jogos, livros, comics e mais — numa biblioteca unificada." },
    { icon: "⭐", title: useT("feature2Title"), desc: "Sistema de rating, estados personalizados e diário com histórico de tudo o que concluíste." },
    { icon: "👥", title: useT("feature3Title"), desc: "Segue amigos, vê o que estão a ver e descobre nova mídia através do feed de atividade." },
    { icon: "🎨", title: useT("feature4Title"), desc: "Cores, fundos, sidebar — personaliza a app ao teu gosto e guarda múltiplos temas." },
    { icon: "📊", title: useT("feature5Title"), desc: "Vê quantos completaste, a tua média de rating e o teu histórico por mês no diário." },
    { icon: "🔍", title: useT("feature6Title"), desc: "Pesquisa em AniList, TMDB, IGDB, Google Books e ComicVine ao mesmo tempo." },
    { icon: "🏆", title: "Tier Lists", desc: "Cria e partilha tier lists da tua mídia favorita. Arrasta, ordena e dá like nas listas da comunidade." },
    { icon: "🎭", title: "Personagens & Cast", desc: "Vê o elenco completo, personagens, voice actors e explora a filmografia de cada ator ou realizador." },
  ];
  const mediaTypes = ["🎌 Anime", "📖 Manga", "🎬 Filmes", "📺 Séries", "🎮 Jogos", "📚 Livros", "🇰🇷 Manhwa", "💬 Comics"];

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'Outfit', 'Segoe UI', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradAnim { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        .land-fade { animation: fadeUp 0.7s ease forwards; }
        .land-float { animation: float 4s ease-in-out infinite; }
        .land-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 40px rgba(${accentRgb},0.5) !important; }
        .land-btn2:hover { transform: translateY(-2px) !important; background: rgba(255,255,255,0.12) !important; }
        .feat-card:hover { transform: translateY(-4px); border-color: ${accent}55 !important; }
        .feat-card { transition: all 0.2s; }
      `}</style>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid #21262d", position: "sticky", top: 0, background: "rgba(13,17,23,0.9)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white" }}>T</div>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#e6edf3", letterSpacing: "-0.5px" }}>TrackAll</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onDemo} className="land-btn2" style={{ padding: "9px 20px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>{useT("landingDemoBtn")}</button>
          <button onClick={onEnter} className="land-btn" style={{ padding: "9px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 4px 20px rgba(${accentRgb},0.3)` }}>{useT("signIn")}</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "100px 20px 80px", position: "relative", overflow: "hidden" }}>
        {/* Glow blobs */}
        <div style={{ position: "absolute", top: -100, left: "20%", width: 500, height: 500, background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 50, right: "10%", width: 300, height: 300, background: `radial-gradient(circle, #8b5cf620 0%, transparent 70%)`, pointerEvents: "none", animation: "pulse 4s ease-in-out infinite" }} />

        <div className="land-fade" style={{ animationDelay: "0.1s", opacity: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${accent}18`, border: `1px solid ${accent}44`, borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: accent, marginBottom: 28, letterSpacing: "0.05em" }}>
          </div>
        </div>
        <div className="land-fade" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: 24, backgroundImage: `linear-gradient(135deg, #e6edf3 30%, ${accent} 70%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Toda a tua mídia.<br/>Num só lugar.
          </h1>
        </div>
        <div className="land-fade" style={{ animationDelay: "0.35s", opacity: 0 }}>
          <p style={{ fontSize: 20, color: "#8b949e", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7, fontWeight: 400 }}>
            Anime, manga, filmes, séries, jogos, livros e comics — acompanha tudo, avalia, partilha com amigos.
          </p>
        </div>
        <div className="land-fade" style={{ animationDelay: "0.5s", opacity: 0, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onEnter} className="land-btn" style={{ padding: "16px 40px", borderRadius: 14, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 16, fontWeight: 800, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 8px 32px rgba(${accentRgb},0.4)` }}>
            Começar grátis →
          </button>
          <button onClick={onDemo} className="land-btn2" style={{ padding: "16px 36px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
            Ver demonstração
          </button>
        </div>

        {/* Media type pills */}
        <div className="land-fade" style={{ animationDelay: "0.7s", opacity: 0, marginTop: 56, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 600, margin: "56px auto 0" }}>
          {mediaTypes.map((m, i) => (
            <span key={m} style={{ padding: "8px 18px", borderRadius: 20, background: "#161b22", border: "1px solid #21262d", fontSize: 13, fontWeight: 600, color: "#8b949e", animation: `float ${3 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}>{m}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "0 20px 40px", maxWidth: 900, margin: "0 auto" }}>
        {/* Screenshot da app */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${accent}33`, boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px #21262d`, background: "#161b22", position: "relative" }}>
          <div style={{ background: "#161b22", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #21262d" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#ef4444", opacity: 0.7 }} />
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#eab308", opacity: 0.7 }} />
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#10b981", opacity: 0.7 }} />
            <span style={{ fontSize: 11, color: "#484f58", marginLeft: 8 }}>trackall.app</span>
          </div>
          <img src="/og-image.png" alt="TrackAll app screenshot" style={{ width: "100%", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "40px 20px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px", marginBottom: 12 }}>{lang === "en" ? "Everything you need" : "Tudo o que precisas"}</h2>
          <p style={{ color: "#484f58", fontSize: 16 }}>{lang === "en" ? "Made for those who take media seriously" : "Feito para quem leva a mídia a sério"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} className="feat-card" style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: "28px 24px" }}>
              <div style={{ width: 48, height: 48, background: `${accent}18`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#e6edf3", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", background: `linear-gradient(135deg, ${accent}18 0%, #8b5cf618 100%)`, border: `1px solid ${accent}33`, borderRadius: 24, padding: "60px 40px" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px", marginBottom: 16 }}>{useT("landingReadyTitle")}</h2>
          <p style={{ color: "#8b949e", fontSize: 16, marginBottom: 36, lineHeight: 1.6 }}>Cria a tua conta gratuita e começa a organizar a tua biblioteca hoje.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onEnter} className="land-btn" style={{ padding: "14px 36px", borderRadius: 12, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: "none", color: "white", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "inherit", transition: "all 0.2s", boxShadow: `0 6px 24px rgba(${accentRgb},0.35)` }}>
              Criar conta grátis
            </button>
            <button onClick={onDemo} className="land-btn2" style={{ padding: "14px 28px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
              Ver demo primeiro
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #21262d", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "white" }}>T</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#484f58" }}>TrackAll</span>
        </div>
        <span style={{ fontSize: 12, color: "#30363d" }}>{useT("landingMadeWith")}</span>
      </footer>
    </div>
  );
}
