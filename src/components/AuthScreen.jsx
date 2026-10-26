import { useState } from "react";
import { supa } from "../config/supabase";

export function AuthScreen({ onAuth, accent, onBack, lang = "en", useT = (k) => k }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const accentRgb = `${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}`;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError("Preenche todos os campos."); return; }
    if (password.length < 6) { setError("A password deve ter pelo menos 6 caracteres."); return; }
    if (mode === "register" && !inviteCode.trim()) { setError("Precisas de um código de convite para criar conta."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (mode === "register") {
        // O código é validado e consumido no servidor (trigger enforce_invite); se for inválido o registo falha com erro
        const { user: u } = await supa.signUp(email.trim(), password, inviteCode.trim().toUpperCase());
        if (u) {
          onAuth(u);
        } else {
          setAwaitingVerification(true);
          setSuccess(`Email de confirmação enviado para ${email.trim()}.`);
        }
      } else {
        const { user: u } = await supa.signIn(email.trim(), password);
        onAuth(u);
      }
    } catch (e) {
      setError(e.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', 'Segoe UI', sans-serif", position: "relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');`}</style>
      {onBack && <button onClick={onBack} style={{ position: "absolute", top: 20, left: 20, background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>{useT("back")}</button>}
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, background: `linear-gradient(135deg, ${accent}, ${accent}99)`, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "white", marginBottom: 16 }}>T</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#e6edf3", letterSpacing: "-1px" }}>TrackAll</h1>
          <p style={{ color: "#484f58", fontSize: 14, marginTop: 6 }}>{useT("landingTagline")}</p>
        </div>
        {awaitingVerification ? (
          <div style={{ background: "#161b22", border: `1px solid ${accent}44`, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#e6edf3", marginBottom: 12 }}>{useT("verifyEmail")}</h2>
            <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Enviámos um link de confirmação para<br/>
              <strong style={{ color: accent }}>{email}</strong>
            </p>
            <p style={{ color: "#484f58", fontSize: 12, marginBottom: 24 }}>Clica no link no email para ativar a tua conta. Verifica também a pasta de spam.</p>
            <button onClick={() => { setAwaitingVerification(false); setMode("login"); setSuccess(""); }} style={{ padding: "10px 24px", borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}44`, color: accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
              Já verifiquei — Entrar
            </button>
          </div>
        ) : (
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: 28 }}>
            <div style={{ display: "flex", background: "#0d1117", borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {["login", "register"].map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.15s", background: mode === m ? accent : "transparent", color: mode === m ? "white" : "#484f58" }}>
                  {m === "login" ? useT("signIn") : useT("createAccount")}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>{useT("email").toUpperCase()}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={useT("emailPlaceholder")} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>{useT("password").toUpperCase()}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={useT("passwordPlaceholder")} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              {mode === "register" && (
                <div>
                  <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 6 }}>CÓDIGO DE CONVITE</label>
                  <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Ex: TRACKALL-XXXX" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, background: "#0d1117", border: `1px solid ${accent}44`, color: "#e6edf3", fontFamily: "inherit", letterSpacing: "1px", boxSizing: "border-box" }} />
                  <p style={{ fontSize: 11, color: "#484f58", marginTop: 5 }}>O TrackAll está em acesso antecipado. Precisas de um código para criar conta.</p>
                </div>
              )}
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#ef444415", borderRadius: 8 }}>{error}</p>}
            {success && <p style={{ color: "#10b981", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#10b98115", borderRadius: 8 }}>{success}</p>}
            <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "white", fontFamily: "inherit", fontSize: 15, fontWeight: 700, opacity: loading ? 0.7 : 1, transition: "all 0.2s", boxShadow: `0 4px 20px rgba(${accentRgb},0.3)` }}>
              {loading ? useT("processing") : mode === "login" ? useT("signIn") : useT("createAccount")}
            </button>
          </div>
        )}
        <p style={{ textAlign: "center", color: "#30363d", fontSize: 11, marginTop: 20 }}>
          Os teus dados ficam guardados em segurança na nuvem
        </p>
      </div>
    </div>
  );
}
