import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import TrackAll from "./trackall_v13";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = a carregar

  useEffect(() => {
    // Sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Ouve login / logout / refresh de token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading inicial
  if (session === undefined) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0d1117",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 52, height: 52,
          background: "linear-gradient(135deg, #f97316, #f9731688)",
          borderRadius: 14, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 26, fontWeight: 900, color: "white",
          animation: "pulse 1.2s ease-in-out infinite",
        }}>T</div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.92); }
          }
        `}</style>
      </div>
    );
  }

  // Não autenticado → ecrã de login/registo
  if (!session) return <AuthScreen />;

  // Autenticado → app normal
  return (
    <TrackAll
      user={session.user}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}
