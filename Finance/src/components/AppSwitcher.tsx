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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 10,
          background: 'rgba(231,255,94,0.08)',
          border: '1px solid rgba(231,255,94,0.3)',
          boxShadow: '0 0 10px rgba(231,255,94,0.1)',
          color: '#e7ff5e',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,255,94,0.15)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(231,255,94,0.2)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,255,94,0.08)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 10px rgba(231,255,94,0.1)';
        }}
      >
        <span style={{ fontSize: 16 }}>{current.emoji}</span>
        <span>{current.nome}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />

          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: 14,
            padding: 8,
            minWidth: 210,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(231,255,94,0.05)',
            zIndex: 100,
          }}>
            {userEmail && (
              <div style={{ padding: '6px 10px 10px', borderBottom: '1px solid #222', marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Conectado como
                </div>
                <div style={{ fontSize: 13, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
              </div>
            )}

            {others.map(app => (
              <a key={app.id} href={app.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(231,255,94,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 20 }}>{app.emoji}</span>
                <span>Ir para {app.nome}</span>
                <span style={{ marginLeft: 'auto', color: '#444' }}>→</span>
              </a>
            ))}

            <div style={{ borderTop: '1px solid #222', marginTop: 8, paddingTop: 8 }}>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
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
