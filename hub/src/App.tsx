import { useState, useEffect } from "react";
import { supabase } from "./services/supabase";
import type { Session } from "@supabase/supabase-js";

// ─── Tela de Login/Cadastro ───────────────────────────────────────────────────
function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const signUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) { setErro("Preencha email e senha."); return; }
    setLoading(true); setErro("");
    const { error } = await supabase.auth.signUp({ email: cleanEmail, password: cleanPassword });
    setLoading(false);
    if (error) { setErro("Erro no cadastro: " + error.message); return; }
    setErro("Verifique seu email para confirmar o cadastro!");
  };

  const signIn = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) { setErro("Preencha email e senha."); return; }
    setLoading(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
    setLoading(false);
    if (error) { setErro("Email ou senha incorretos."); return; }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0A", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 380, boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/kronos-icon.png" alt="Kronos" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 20 }} />
          <h2 style={{ marginBottom: 0, color: "#ffffff", fontSize: 20, fontWeight: 700 }}>Kronos</h2>
        </div>

        <div style={{ padding: "0 4px" }}>
          <label style={{ display: "block", marginBottom: 6, color: "#aaa", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seuemail@gmail.com"
            type="email"
            style={{ width: "100%", padding: "14px 16px", marginBottom: 16, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, color: "#ffffff", boxSizing: "border-box", fontSize: 16, outline: "none" }}
          />

          <label style={{ display: "block", marginBottom: 6, color: "#aaa", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            type="password"
            placeholder="••••••••"
            style={{ width: "100%", padding: "14px 16px", marginBottom: 20, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, color: "#ffffff", boxSizing: "border-box", fontSize: 16, outline: "none" }}
          />

          {erro && (
            <p style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: erro.includes("Erro") || erro.includes("incorretos") ? "#2a0a0a" : "#0a2a0a", color: erro.includes("Erro") || erro.includes("incorretos") ? "#f87171" : "#4ade80", fontSize: 13 }}>
              {erro}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={signIn} disabled={loading}
              style={{ width: "100%", padding: 14, background: "#ffffff", border: "none", borderRadius: 10, color: "#000", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1, fontSize: 15 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button onClick={signUp} disabled={loading}
              style={{ width: "100%", padding: 14, background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", cursor: "pointer", opacity: loading ? 0.6 : 1, fontSize: 15 }}>
              {loading ? "..." : "Criar conta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Seletor de Apps ──────────────────────────────────────────────────────────
function AppSelector({ session }: { session: Session }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const apps = [
    { nome: "Finance", descricao: "Controle suas finanças", url: "/finance/", cor: "#10b981" },
    { nome: "Treino", descricao: "Gerencie seus treinos", url: "/treino/", cor: "#a78bfa" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0A", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 380, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <img src="/kronos-icon.png" alt="Kronos" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 20 }} />
          <p style={{ color: "#666", fontSize: 13 }}>{session.user.email}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {apps.map((app) => (
            <a key={app.nome} href={app.url}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, textDecoration: "none", color: "#fff", transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = app.cor; e.currentTarget.style.background = "#161616"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.background = "#111"; }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: app.cor, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{app.nome}</div>
                <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{app.descricao}</div>
              </div>
              <span style={{ color: "#333", fontSize: 16 }}>→</span>
            </a>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={handleSignOut}
            style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 13, padding: "8px 16px" }}>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A" }}>
        <p style={{ color: "#888" }}>Carregando...</p>
      </div>
    );
  }

  return session ? <AppSelector session={session} /> : <Auth />;
}