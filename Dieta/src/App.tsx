import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import { AppSwitcher } from './components/AppSwitcher';
import { Dieta } from './components/Dieta';

function DevLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0A0A' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#fff', marginBottom: 8 }}>Login (dev)</h2>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email"
          style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="senha" type="password"
          style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
        <button onClick={() => supabase.auth.signInWithPassword({ email, password })}
          style={{ padding: 12, background: '#38bdf8', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <div style={{ color: '#fff', padding: 40, background: '#0A0A0A', minHeight: '100vh' }}>Carregando...</div>;
  }

  if (!session) {
    if (import.meta.env.PROD) {
      window.location.href = '/';
      return null;
    }
    return <DevLogin />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E8E8E8] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-[#1F1F1F] bg-[#0A0A0A]/95">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-[#E8E8E8] text-sm tracking-wide">Dieta</h1>
            <p className="text-[10px] text-[#616161] capitalize">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <AppSwitcher currentApp="dieta" userEmail={session?.user?.email} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 pb-16">
        <Dieta session={session} />
      </main>
    </div>
  );
}
