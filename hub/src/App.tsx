import { useState, useEffect } from "react";
import { supabase } from "./services/supabase";
import type { Session } from "@supabase/supabase-js";

const input: React.CSSProperties = {
  width: "100%", padding: "12px 16px",
  background: "#111111", border: "1px solid #1F1F1F", borderRadius: 10,
  color: "#E8E8E8", fontSize: 14, outline: "none", transition: "border-color 0.15s",
};

// ─── Login ────────────────────────────────────────────────────────────────────
function Auth() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");
  const [mode, setMode]         = useState<"login" | "signup" | "forgot">("login");

  const isError   = erro.includes("Erro") || erro.includes("incorretos") || erro.includes("Preencha");
  const isSuccess = !isError && !!erro;

  const handle = async () => {
    const e = email.trim().toLowerCase();
    setLoading(true); setErro("");

    if (mode === "forgot") {
      if (!e) { setErro("Preencha seu email."); setLoading(false); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/?reset=true`,
      });
      if (error) setErro("Erro ao enviar. Verifique o email.");
      else setErro("Link enviado! Verifique sua caixa de entrada.");
      setLoading(false);
      return;
    }

    const p = password.trim();
    if (!e || !p) { setErro("Preencha email e senha."); setLoading(false); return; }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      if (error) setErro("Email ou senha incorretos.");
    } else {
      const { error } = await supabase.auth.signUp({ email: e, password: p });
      if (error) setErro("Erro no cadastro.");
      else setErro("Verifique seu email para confirmar o cadastro!");
    }
    setLoading(false);
  };

  const switchMode = (next: typeof mode) => { setMode(next); setErro(""); };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: "#111111",
          border: "1px solid #1F1F1F", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 16px",
        }}>
          <img src="/kronos-icon.png" alt="Kronos" style={{ width: 32, height: 32, borderRadius: 6 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8E8", marginBottom: 4 }}>Kronos</h1>
        <p style={{ fontSize: 13, color: "#3a3a3a" }}>
          {mode === "login" ? "Entre na sua conta" : mode === "signup" ? "Crie sua conta" : "Recuperar senha"}
        </p>
      </div>

      {/* Form */}
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" type="email" style={input}
            onFocus={e => (e.target.style.borderColor = "#2a2a2a")}
            onBlur={e => (e.target.style.borderColor = "#1F1F1F")}
          />
          {mode !== "forgot" && (
            <input
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()}
              type="password" placeholder="Senha" style={input}
              onFocus={e => (e.target.style.borderColor = "#2a2a2a")}
              onBlur={e => (e.target.style.borderColor = "#1F1F1F")}
            />
          )}
        </div>

        {/* Esqueci minha senha — só no login */}
        {mode === "login" && (
          <div style={{ textAlign: "right", marginTop: -8, marginBottom: 14 }}>
            <button
              onClick={() => switchMode("forgot")}
              style={{ background: "none", border: "none", color: "#3a3a3a", fontSize: 12, cursor: "pointer", padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#616161")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3a3a3a")}
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {erro && (
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: isSuccess ? "#0a1a0a" : "#1a0a0a",
            border: `1px solid ${isSuccess ? "#1a3a1a" : "#2a1a1a"}`,
            color: isSuccess ? "#4ade80" : "#f87171",
          }}>
            {erro}
          </div>
        )}

        <button
          onClick={handle} disabled={loading}
          style={{
            width: "100%", padding: "12px", background: "#E8E8E8", border: "none",
            borderRadius: 10, color: "#0A0A0A", fontWeight: 600, fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            marginBottom: 10, transition: "opacity 0.15s",
          }}
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </button>

        {mode === "forgot" ? (
          <button
            onClick={() => switchMode("login")}
            style={{
              width: "100%", padding: "12px", background: "transparent",
              border: "1px solid #1F1F1F", borderRadius: 10, color: "#616161",
              fontSize: 14, cursor: "pointer",
            }}
            onMouseEnter={e => { (e.currentTarget.style.borderColor = "#2a2a2a"); (e.currentTarget.style.color = "#9a9a9a"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "#1F1F1F"); (e.currentTarget.style.color = "#616161"); }}
          >
            Voltar ao login
          </button>
        ) : (
          <button
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            style={{
              width: "100%", padding: "12px", background: "transparent",
              border: "1px solid #1F1F1F", borderRadius: 10, color: "#616161",
              fontSize: 14, cursor: "pointer",
            }}
            onMouseEnter={e => { (e.currentTarget.style.borderColor = "#2a2a2a"); (e.currentTarget.style.color = "#9a9a9a"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "#1F1F1F"); (e.currentTarget.style.color = "#616161"); }}
          >
            {mode === "login" ? "Criar conta" : "Já tenho conta"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Seletor de Apps ──────────────────────────────────────────────────────────
function AppSelector({ session }: { session: Session }) {
  const apps = [
    {
      nome: "Todolist",
      descricao: "Tarefas, hábitos e projetos",
      url: "/todolist/",
      cor: "#8b5cf6",
      icon: "✓",
    },
    {
      nome: "Finance",
      descricao: "Controle financeiro",
      url: "/finance/",
      cor: "#10b981",
      icon: "$",
    },
    {
      nome: "Treino",
      descricao: "Treinos e squad",
      url: "/treino/",
      cor: "#a78bfa",
      icon: "↗",
    },
  ];

  const userName = session.user.email?.split("@")[0] ?? "você";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: "#111111",
          border: "1px solid #1F1F1F", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 16px",
        }}>
          <img src="/kronos-icon.png" alt="Kronos" style={{ width: 32, height: 32, borderRadius: 6 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#E8E8E8", marginBottom: 4 }}>
          Olá, {userName}
        </p>
        <p style={{ fontSize: 12, color: "#3a3a3a" }}>Escolha um app</p>
      </div>

      {/* Apps */}
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
        {apps.map((app) => (
          <a
            key={app.nome}
            href={app.url}
            style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "16px 18px", background: "#111111",
              border: "1px solid #1F1F1F", borderRadius: 12,
              color: "#E8E8E8", transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = app.cor + "60";
              e.currentTarget.style.background = "#161616";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#1F1F1F";
              e.currentTarget.style.background = "#111111";
            }}
          >
            {/* Ícone */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: app.cor + "15", border: `1px solid ${app.cor}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: app.cor,
            }}>
              {app.icon}
            </div>

            {/* Texto */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#E8E8E8", marginBottom: 2 }}>
                {app.nome}
              </div>
              <div style={{ fontSize: 12, color: "#3a3a3a" }}>{app.descricao}</div>
            </div>

            {/* Seta */}
            <span style={{ color: "#2a2a2a", fontSize: 16, flexShrink: 0 }}>›</span>
          </a>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <p style={{ fontSize: 11, color: "#2a2a2a" }}>{session.user.email}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: "none", border: "none", color: "#3a3a3a",
            cursor: "pointer", fontSize: 12, padding: "6px 12px", borderRadius: 6,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#616161")}
          onMouseLeave={e => (e.currentTarget.style.color = "#3a3a3a")}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

// ─── Reset de senha ───────────────────────────────────────────────────────────
function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");
  const isError = msg.startsWith("Erro") || msg.startsWith("As senhas");

  const handle = async () => {
    if (!password || password !== confirm) { setMsg("As senhas não coincidem."); return; }
    if (password.length < 6) { setMsg("Mínimo 6 caracteres."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMsg("Erro ao redefinir senha.");
    else setMsg("Senha alterada! Redirecionando...");
    setLoading(false);
    if (!error) setTimeout(() => supabase.auth.signOut(), 1800);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8E8", marginBottom: 4 }}>Nova senha</h1>
        <p style={{ fontSize: 13, color: "#3a3a3a" }}>Escolha uma senha segura</p>
      </div>
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          value={password} onChange={e => setPassword(e.target.value)}
          type="password" placeholder="Nova senha" style={input}
          onFocus={e => (e.target.style.borderColor = "#2a2a2a")}
          onBlur={e => (e.target.style.borderColor = "#1F1F1F")}
        />
        <input
          value={confirm} onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handle()}
          type="password" placeholder="Confirmar senha" style={input}
          onFocus={e => (e.target.style.borderColor = "#2a2a2a")}
          onBlur={e => (e.target.style.borderColor = "#1F1F1F")}
        />
        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: isError ? "#1a0a0a" : "#0a1a0a",
            border: `1px solid ${isError ? "#2a1a1a" : "#1a3a1a"}`,
            color: isError ? "#f87171" : "#4ade80",
          }}>{msg}</div>
        )}
        <button
          onClick={handle} disabled={loading}
          style={{
            width: "100%", padding: "12px", background: "#E8E8E8", border: "none",
            borderRadius: 10, color: "#0A0A0A", fontWeight: 600, fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </div>
    </div>
  );
}

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReset, setIsReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setIsReset(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #1F1F1F", borderTopColor: "#616161", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (isReset) return <ResetPassword />;
  return session ? <AppSelector session={session} /> : <Auth />;
}
