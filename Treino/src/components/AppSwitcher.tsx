import { useState } from 'react';
import { supabase } from '../services/supabase';

const APPS = [
  { id: 'finance', nome: 'Finance', emoji: '💰', url: '/finance/' },
  { id: 'treino', nome: 'Treino', emoji: '🏋️', url: '/treino/' },
];

interface AppSwitcherProps {
  currentApp: 'finance' | 'treino';
  userEmail?: string;
}

export function AppSwitcher({ currentApp, userEmail }: AppSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = APPS.find(a => a.id === currentApp)!;
  const others = APPS.filter(a => a.id !== currentApp);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = import.meta.env.PROD ? '/' : 'http://localhost:5173';
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', cursor: 'pointer', fontSize: 14,
        }}
      >
        {current.emoji} {current.nome} ▾
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#111', border: '1px solid #222',
            borderRadius: 14, padding: 8, minWidth: 200,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 100,
          }}>
            {userEmail && (
              <div style={{ padding: '6px 10px 10px', borderBottom: '1px solid #222', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Conectado como</div>
                <div style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
              </div>
            )}

            {others.map(app => (
              <a key={app.id} href={app.url}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px', borderRadius: 8,
                  textDecoration: 'none', color: '#fff', fontSize: 14,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 20 }}>{app.emoji}</span>
                <span>Ir para {app.nome}</span>
              </a>
            ))}

            <div style={{ borderTop: '1px solid #222', marginTop: 8, paddingTop: 8 }}>
              <button onClick={handleSignOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px', borderRadius: 8,
                  background: 'transparent', border: 'none',
                  color: '#f87171', cursor: 'pointer', fontSize: 14,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                🚪 Sair da conta
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}