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
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 360, padding: 24, border: "1px solid #e7ff5e", borderRadius: 16, background: "#111111", boxSizing: "border-box" }}>
        <h2 style={{ marginBottom: 4, color: "#ffffff" }}>App Kronos</h2>
        <p style={{ marginBottom: 20, color: "#888", fontSize: 14 }}>Acesse sua conta para continuar</p>

        <label style={{ display: "block", marginBottom: 6, color: "#ffffff", fontSize: 14 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seuemail@gmail.com"
          type="email"
          style={{ width: "100%", padding: 12, marginBottom: 12, background: "#2e2e2e", border: "1px solid #333", borderRadius: 8, color: "#ffffff", boxSizing: "border-box", fontSize: 16 }}
        />

        <label style={{ display: "block", marginBottom: 6, color: "#ffffff", fontSize: 14 }}>Senha</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && signIn()}
          type="password"
          placeholder="••••••••"
          style={{ width: "100%", padding: 12, marginBottom: 16, background: "#2e2e2e", border: "1px solid #333", borderRadius: 8, color: "#ffffff", boxSizing: "border-box", fontSize: 16 }}
        />

        {erro && (
          <p style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: erro.includes("Erro") || erro.includes("incorretos") ? "#2a0a0a" : "#0a2a0a", color: erro.includes("Erro") || erro.includes("incorretos") ? "#f87171" : "#4ade80", fontSize: 13 }}>
            {erro}
          </p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={signIn} disabled={loading}
            style={{ flex: 1, padding: 14, background: "#e7ff5e", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1, fontSize: 15 }}>
            {loading ? "..." : "Entrar"}
          </button>
          <button onClick={signUp} disabled={loading}
            style={{ flex: 1, padding: 14, background: "transparent", border: "1px solid #444", borderRadius: 8, color: "#ffffff", cursor: "pointer", opacity: loading ? 0.6 : 1, fontSize: 15 }}>
            {loading ? "..." : "Criar conta"}
          </button>
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
    { nome: "Finance", descricao: "Controle suas finanças", url: "/finance/", emoji: "💰", cor: "#e7ff5e" },
    { nome: "Treino", descricao: "Gerencie seus treinos", url: "/treino/", emoji: "🏋️", cor: "#a78bfa" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ color: "#ffffff", fontSize: 26, marginBottom: 8 }}>Olá! 👋</h1>
          <p style={{ color: "#888", fontSize: 14 }}>{session.user.email}</p>
          <p style={{ color: "#888", fontSize: 14, marginTop: 4 }}>Para onde você quer ir?</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {apps.map((app) => (
            <a key={app.nome} href={app.url}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 20px", background: "#111", border: "1px solid #222", borderRadius: 16, textDecoration: "none", color: "#fff", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = app.cor)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}>
              <span style={{ fontSize: 36 }}>{app.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{app.nome}</div>
                <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>{app.descricao}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "#555", fontSize: 22 }}>→</span>
            </a>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={handleSignOut}
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 14, padding: "8px 16px" }}>
            Sair da conta
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