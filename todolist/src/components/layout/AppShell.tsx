import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A' }}>
      <header style={{
        height: 48,
        borderBottom: '1px solid #1F1F1F',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#616161', fontSize: 12 }}>Kronos</span>
          <span style={{ color: '#2a2a2a', fontSize: 12 }}>/</span>
          <span style={{ color: '#E8E8E8', fontSize: 12, fontWeight: 500 }}>Tarefas</span>
        </div>
      </header>
      <main style={{ height: 'calc(100vh - 48px)' }}>
        {children}
      </main>
    </div>
  );
}
