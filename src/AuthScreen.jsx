import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "register" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const accent = "#f97316";
  const accentRgb = "249,115,22";

  const translate = (msg) => {
    if (msg.includes("Invalid login")) return "Email ou palavra-passe incorretos.";
    if (msg.includes("Email not confirmed")) return "Confirma o teu email antes de entrar.";
    if (msg.includes("already registered")) return "Este email já tem conta. Faz login!";
    if (msg.includes("Password should be")) return "A palavra-passe deve ter pelo menos 6 caracteres.";
    if (msg.includes("rate limit")) return "Demasiadas tentativas. Aguarda um momento.";
    return msg;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(translate(error.message));
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } },
    });
    if (error) {
      setError(translate(error.message));
    } else {
      setSuccess("Conta criada! Verifica o teu email para confirmar e depois faz login.");
      setMode("login");
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(translate(error.message));
    else setSuccess("Email de recuperação enviado! Verifica a tua caixa de entrada.");
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d1117",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit', 'Segoe UI', sans-serif", padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .ai { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 14px; padding: 13px 16px; width: 100%; transition: border-color 0.2s, box-shadow 0.2s; }
        .ai::placeholder { color: #484f58; }
        .ai:focus { outline: none; border-color: ${accent}; box-shadow: 0 0 0 3px rgba(${accentRgb},0.12); }
        .ab { width: 100%; padding: 13px; background: linear-gradient(135deg, ${accent}, ${accent}cc); color: white; border: none; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .ab:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 6px 24px rgba(${accentRgb},0.4); }
        .ab:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .al { background: none; border: none; color: ${accent}; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; padding: 0; text-decoration: underline; text-underline-offset: 2px; }
        .al:hover { opacity: 0.8; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .ac { animation: fadeUp 0.4s cubic-bezier(.34,1.56,.64,1); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; display: inline-block; }
      `}</style>

      <div className="ac" style={{
        width: "100%", maxWidth: 420,
        background: "#161b22", border: "1px solid #21262d",
        borderRadius: 20, padding: 36,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
            borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 900, color: "white", margin: "0 auto 14px",
            boxShadow: `0 8px 32px rgba(${accentRgb},0.3)`,
          }}>T</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#e6edf3", letterSpacing: "-0.5px" }}>TrackAll</h1>
          <p style={{ color: "#484f58", fontSize: 13, marginTop: 4 }}>
            {mode === "login" && "Bem-vindo de volta!"}
            {mode === "register" && "Cria a tua conta gratuita"}
            {mode === "reset" && "Recupera a tua conta"}
          </p>
        </div>

        {/* Mensagens */}
        {success && (
          <div style={{ background: "#10b98118", border: "1px solid #10b98144", borderRadius: 10, padding: "12px 14px", marginBottom: 20, color: "#10b981", fontSize: 13, lineHeight: 1.5 }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "12px 14px", marginBottom: 20, color: "#ef4444", fontSize: 13 }}>
            ✕ {error}
          </div>
        )}

        {/* LOGIN */}
        {mode === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="ai" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="ai" type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="ab" type="submit" disabled={loading}>
              {loading ? <span className="spin">◌</span> : "Entrar"}
            </button>
            <div style={{ textAlign: "right" }}>
              <button type="button" className="al" onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}>
                Esqueci a palavra-passe
              </button>
            </div>
            <p style={{ textAlign: "center", color: "#484f58", fontSize: 13, marginTop: 4 }}>
              Não tens conta?{" "}
              <button type="button" className="al" onClick={() => { setMode("register"); setError(""); setSuccess(""); }}>
                Regista-te
              </button>
            </p>
          </form>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="ai" type="text" placeholder="O teu nome" value={name} onChange={e => setName(e.target.value)} required />
            <input className="ai" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="ai" type="password" placeholder="Palavra-passe (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            <button className="ab" type="submit" disabled={loading}>
              {loading ? <span className="spin">◌</span> : "Criar Conta"}
            </button>
            <p style={{ textAlign: "center", color: "#484f58", fontSize: 13, marginTop: 4 }}>
              Já tens conta?{" "}
              <button type="button" className="al" onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
                Faz login
              </button>
            </p>
          </form>
        )}

        {/* RESET */}
        {mode === "reset" && (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="ai" type="email" placeholder="O teu email" value={email} onChange={e => setEmail(e.target.value)} required />
            <button className="ab" type="submit" disabled={loading}>
              {loading ? <span className="spin">◌</span> : "Enviar email de recuperação"}
            </button>
            <p style={{ textAlign: "center", color: "#484f58", fontSize: 13, marginTop: 4 }}>
              <button type="button" className="al" onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
                ← Voltar ao login
              </button>
            </p>
          </form>
        )}

        <p style={{ textAlign: "center", color: "#30363d", fontSize: 11, marginTop: 28, lineHeight: 1.5 }}>
          Os teus dados ficam associados à tua conta — privados e seguros.
        </p>
      </div>
    </div>
  );
}
