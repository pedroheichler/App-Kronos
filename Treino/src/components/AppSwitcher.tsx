import { useState } from 'react';
import { supabase } from '../services/supabase';

const APPS = [
  { id: 'finance', nome: 'Finance', url: '/finance/' },
  { id: 'treino', nome: 'Treino', url: '/treino/' },
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
          padding: '6px 12px',
          borderRadius: 8,
          background: '#161616',
          border: '1px solid #1F1F1F',
          color: '#E8E8E8',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a';
          (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1F1F1F';
          (e.currentTarget as HTMLButtonElement).style.background = '#161616';
        }}
      >
        <span>{current.nome}</span>
        <span style={{ fontSize: 9, color: '#616161' }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />

          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#111111',
            border: '1px solid #1F1F1F',
            borderRadius: 12,
            padding: 6,
            minWidth: 200,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            zIndex: 100,
          }}>
            {userEmail && (
              <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid #1a1a1a', marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: '#3a3a3a', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Conta
                </div>
                <div style={{ fontSize: 12, color: '#616161', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
              </div>
            )}

            {others.map(app => (
              <a key={app.id} href={app.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 10px',
                  borderRadius: 7,
                  textDecoration: 'none',
                  color: '#E8E8E8',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>{app.nome}</span>
                <span style={{ color: '#3a3a3a', fontSize: 13 }}>→</span>
              </a>
            ))}

            <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 6, paddingTop: 6 }}>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 7,
                  background: 'transparent',
                  border: 'none',
                  color: '#616161',
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#616161';
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
