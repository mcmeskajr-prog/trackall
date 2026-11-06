import { useState, Suspense } from "react";
import { exportAllData } from "../lib/exportData";
import { supa, supabase } from "../config/supabase";
import { AppearanceSettings } from "./AppearanceSettings";
import { PersonalizeMobile } from "./PersonalizeMobile";

// Separador «Definições» do Perfil: Aparência, Importar, APIs, Geral e Zona de perigo.
// Recebe os mesmos props do ProfileView (tema/ações) + o estado que vive lá (secção aberta, modais de importação).
export function ProfileSettings(props) {
  const {
    accent, bgBlur, bgColor, bgColorMobile, bgImage, bgImageMobile, bgOverlay, bgParallax, bgSeparateDevices, currentUserId, darkMode, isMobileDevice,
    onAccentChange, onBgBlur, onBgChange, onBgColorMobile, onBgImage, onBgImageMobile, onBgOverlay, onBgParallax, onBgSeparateDevices, onChangeLang,
    onPanelBg, onPanelOpacity, onSavedThemes, onSidebarColor, onSignOut, onTextContrast, onTextContrastMobile, panelBg, panelOpacity, sidebarColor,
    textContrast, textContrastMobile, userEmail, profile, library, favorites = [], hallOfFame = [],
  } = props;
  const {
    settingsSection, setSettingsSection, setShowMihon, setShowPaperback, setShowLetterboxd, setShowAniList, setShowNotes, setShowGoodreads,
    personalizeProps, panelDM, computedPanelBg, lang, useT,
  } = props;
  const [exporting, setExporting] = useState(false);
  // Exportar tudo (RGPD: acesso e portabilidade). Pede à base de dados o que não está em memória.
  const handleExportData = async () => {
    setExporting(true);
    try {
      await exportAllData({ supabase, userId: currentUserId, email: userEmail, profile, library, favorites, hallOfFame });
    } catch (e) { console.error("[TrackAll] exportar:", e?.message || e); }
    setExporting(false);
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
      <div style={{ padding: isMobileDevice ? "16px 16px 40px" : "24px 32px 48px", display: "flex", flexDirection: isMobileDevice ? "column" : "row", gap: isMobileDevice ? 16 : 32, alignItems: "flex-start" }}>
        <nav aria-label={lang === "en" ? "Settings sections" : "Secções das definições"} style={isMobileDevice ? { display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", width: "100%" } : { width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 16 }}>
          {[
            { id: "aparencia", label: lang === "en" ? "Appearance" : "Aparência" },
            { id: "importar", label: lang === "en" ? "Import" : "Importar" },
            { id: "apis", label: "APIs" },
            { id: "geral", label: lang === "en" ? "General" : "Geral" },
            { id: "perigo", label: lang === "en" ? "Danger zone" : "Zona de perigo" },
          ].map(s => {
            const on = settingsSection === s.id;
            const danger = s.id === "perigo";
            return (
              <button key={s.id} onClick={() => setSettingsSection(s.id)} style={{
                display: "flex", alignItems: "center", gap: 10, flexShrink: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                padding: isMobileDevice ? "8px 14px" : "11px 12px", minHeight: 40, borderRadius: isMobileDevice ? 999 : 12,
                border: isMobileDevice ? `1px solid ${on ? accent : (darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)")}` : "none",
                background: on ? (darkMode ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)") : "transparent",
                color: danger ? "#ef4444" : on ? (darkMode ? "#e6edf3" : "#0f172a") : (darkMode ? "#9aa6b2" : "#475569"),
                fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
              }}>
                {!isMobileDevice && <span style={{ width: 6, height: 6, borderRadius: 99, background: on ? (danger ? "#ef4444" : accent) : "transparent" }} />}
                {s.label}
              </button>
            );
          })}
        </nav>
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
          {settingsSection === "aparencia" && (
            <>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>{lang === "en" ? "Appearance" : "Aparência"}</h2>
              <p style={{ fontSize: 14, color: darkMode ? "#9aa6b2" : "#475569", margin: "0 0 22px" }}>{lang === "en" ? "Pick a style and fine-tune it. Everything shows live on the preview." : "Escolhe um estilo e afina por cima. Tudo se vê ao vivo na pré-visualização."}</p>
              {isMobileDevice ? (
                <PersonalizeMobile {...personalizeProps} />
              ) : (
              <AppearanceSettings
                accent={accent} bgColor={bgColor} bgColorMobile={bgColorMobile} sidebarColor={sidebarColor}
                textContrast={textContrast} textContrastMobile={textContrastMobile} bgSeparateDevices={bgSeparateDevices}
                darkMode={panelDM} panelBg={panelBg} panelOpacity={panelOpacity} bgImage={bgImage} bgImageMobile={bgImageMobile}
                bgOverlay={bgOverlay} bgBlur={bgBlur} bgParallax={bgParallax} isMobileDevice={isMobileDevice} lang={lang} useT={useT}
                savedThemes={onSavedThemes} computedPanelBg={computedPanelBg}
                onAccentChange={onAccentChange} onBgChange={onBgChange} onBgColorMobile={onBgColorMobile} onSidebarColor={onSidebarColor}
                onTextContrast={onTextContrast} onTextContrastMobile={onTextContrastMobile} onPanelBg={onPanelBg} onPanelOpacity={onPanelOpacity}
                onBgImage={onBgImage} onBgImageMobile={onBgImageMobile} onBgOverlay={onBgOverlay} onBgBlur={onBgBlur} onBgParallax={onBgParallax}
                onBgSeparateDevices={onBgSeparateDevices}
              />
              )}
            </>
          )}
          {settingsSection === "importar" && (<>
    {/* ── Import ── */}
    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{lang === "en" ? "IMPORT" : "IMPORTAR"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
    <div style={{ background: computedPanelBg, border: `1px solid ${panelDM ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📚</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Mihon</p>
          <p style={{ fontSize: 12, color: "#8b949e" }}>{lang === "en" ? "Library, progress and reading status" : "Biblioteca, progresso e estado de leitura"}</p>
        </div>
        <button onClick={() => setShowMihon(true)} className="btn-accent" style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>
          {lang === "en" ? "Import" : "Importar"}
        </button>
      </div>
      {/* Divider */}
      <div style={{ borderTop: `1px solid ${panelDM ? "#21262d" : "#e2e8f0"}`, margin: "10px 0" }} />
      {/* Paperback */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>📖</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>Paperback <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— iOS manga e comics</span></p>
        </div>
        <button onClick={() => setShowPaperback(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>{lang === "en" ? "Import" : "Importar"}</button>
      </div>
      {/* Colar uma lista (notas) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>✎</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>{lang === "en" ? "Paste a list" : "Colar uma lista"} <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>{lang === "en" ? "— titles from your notes" : "— títulos das tuas notas"}</span></p>
        </div>
        <button onClick={() => setShowNotes(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>{lang === "en" ? "Import" : "Importar"}</button>
      </div>
      {/* AniList */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>⛩</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>AniList <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>{lang === "en" ? "— anime and manga, with dates" : "— anime e manga, com datas"}</span></p>
        </div>
        <button onClick={() => setShowAniList(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>{lang === "en" ? "Import" : "Importar"}</button>
      </div>
      {/* Goodreads */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>📖</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>Goodreads <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>{lang === "en" ? "— books, with read dates (CSV)" : "— livros, com datas de leitura (CSV)"}</span></p>
        </div>
        <button onClick={() => setShowGoodreads(true)} className="btn-accent" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>{lang === "en" ? "Import" : "Importar"}</button>
      </div>
      {/* Letterboxd */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>🎬</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>Letterboxd <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>— filmes vistos</span></p>
        </div>
        <button onClick={() => setShowLetterboxd(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, background: "#00e05422", border: "1px solid #00e05444", color: "#00e054", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{useT("importMihon").replace("Import Mihon","Import").replace("Importar Mihon","Importar")}</button>
      </div>
    </div>


          </>)}
          {settingsSection === "apis" && (<>
    {/* API Status */}
    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 }}>{lang === "en" ? "API SETTINGS" : "CONFIGURAÇÕES API"}<span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #30363d, transparent)" }} /></h3>
    <div style={{ background: "#161b22", border: "1px solid #10b98133", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>✓ {lang === "en" ? "Everything is set up automatically" : "Tudo configurado automaticamente"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { icon: "⛩", label: "Anime/Manga", sub: "AniList" },
          { icon: "📚", label: useT("livros"), sub: "Google Books" },
          { icon: "🎮", label: useT("jogos"), sub: "IGDB + Steam" },
          { icon: "🎬", label: lang === "en" ? "Movies/Series" : "Filmes/Séries", sub: "TMDB" },
          { icon: "💬", label: useT("comics"), sub: "ComicVine" },
          { icon: "🇰🇷", label: "Manhwa/LN", sub: "AniList" },
        ].map(s => (
          <div key={s.label} style={{ background: "#0d1117", border: "1px solid #10b98122", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}><span style={{ color: "#10b981" }}>✓ </span>{s.icon} {s.label}</div>
            <div style={{ color: "#484f58", fontSize: 11, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* TMDB Attribution */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
        <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" style={{ height: 14 }} />
        <span style={{ fontSize: 10, color: "#484f58" }}>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      </div>
      <p style={{ fontSize: 10, color: "#484f58", marginTop: 8, lineHeight: 1.5 }}>
        {lang === "en" ? "Data and images from " : "Dados e imagens de "}AniList, TMDB, IGDB (Twitch), Google Books, Steam {lang === "en" ? "and" : "e"}{" "}
        <a href="https://comicvine.gamespot.com" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Comic Vine</a>.
      </p>
    </div>

          </>)}
          {settingsSection === "geral" && (<>
    {/* ── Legal ── */}
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: darkMode ? "#8b949e" : "#475569", display: "flex", alignItems: "center", gap: 10 }}>
        LEGAL
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${darkMode ? "#30363d" : "#e2e8f0"}, transparent)` }} />
      </h3>
      <div style={{ background: computedPanelBg, border: `1px solid ${panelDM ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: panelDM ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("language")}</p>
            <p style={{ fontSize: 11, color: "#8b949e" }}>PT / EN</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["pt", "en"].map(l => (
              <button key={l} onClick={() => onChangeLang(l)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${lang === l ? accent : "#30363d"}`, background: lang === l ? `${accent}22` : "transparent", color: lang === l ? accent : "#8b949e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {l === "pt" ? "🇵🇹 PT" : "🇬🇧 EN"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: computedPanelBg, border: `1px solid ${panelDM ? "#21262d" : "#e2e8f0"}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: panelDM ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("privacy")}</p>
            <p style={{ fontSize: 11, color: "#8b949e" }}>Como tratamos os teus dados · RGPD</p>
          </div>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}44`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
            {lang === "en" ? "View →" : "Ver →"}
          </a>
        </div>
        <div style={{ height: 1, background: panelDM ? "#21262d" : "#e8e0d5" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: panelDM ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{lang === "en" ? "Export my data" : "Exportar os meus dados"}</p>
            <p style={{ fontSize: 11, color: "#8b949e" }}>{lang === "en" ? "Everything you have in TrackAll, as a JSON file" : "Tudo o que tens no TrackAll, num ficheiro JSON"}</p>
          </div>
          <button type="button" onClick={handleExportData} disabled={exporting} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}44`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, cursor: exporting ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "…" : (lang === "en" ? "Download ↓" : "Descarregar ↓")}
          </button>
        </div>
        <div style={{ height: 1, background: panelDM ? "#21262d" : "#e8e0d5" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: panelDM ? "#e6edf3" : "#1a1a2e", marginBottom: 2 }}>{useT("version")}</p>
            <p style={{ fontSize: 11, color: "#8b949e" }}>TrackAll v64 · março 2026</p>
          </div>
        </div>
      </div>
    </div>

          </>)}
          {settingsSection === "perigo" && (<>
    {/* ── Zona de Perigo ── */}
    {(() => {
      const handleDeleteAccount = async () => {
        if (!confirmDelete) { setConfirmDelete(true); return; }
        setDeleting(true);
        try {
          // Função do servidor: apaga dados, imagens e a própria conta de login (ver docs/supabase_delete_account.sql)
          const { error: rpcError } = await supabase.rpc("delete_my_account");
          if (rpcError) {
            // Sem a função instalada: apaga pelo menos os dados (a conta de login fica)
            console.warn("[TrackAll] delete_my_account indisponível, a apagar tabelas:", rpcError.message);
            await supabase.from("collection_likes").delete().eq("user_id", currentUserId);
            await supabase.from("tierlist_likes").delete().eq("user_id", currentUserId);
            await supabase.from("collections").delete().eq("user_id", currentUserId);
            await supabase.from("tierlists").delete().eq("user_id", currentUserId);
            await supabase.from("library").delete().eq("user_id", currentUserId);
            await supabase.from("friendships").delete().or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
            await supabase.from("profile_private").delete().eq("id", currentUserId);
            await supabase.from("profiles").delete().eq("id", currentUserId);
          }
          await supabase.auth.signOut();
          onSignOut && onSignOut();
        } catch (e) {
          console.error(e);
          setDeleting(false);
          setConfirmDelete(false);
        }
      };
      return (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 10 }}>
            ZONA DE PERIGO
            <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #ef444433, transparent)" }} />
          </h3>
          <div style={{ background: "#1a0a0a", border: "1px solid #ef444433", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 14 }}>
              Apagar a conta remove permanentemente toda a tua biblioteca, perfil e dados. Esta ação não pode ser desfeita.
            </p>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #ef444455", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Apagar conta
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>⚠️ Tens a certeza? Esta ação é irreversível.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "#ef4444", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.6 : 1 }}>
                    {deleting ? useT("deleting") : "Sim, apagar tudo"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #30363d", background: "transparent", color: "#8b949e", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })()}

          </>)}
        </div>
      </div>
  );
}
