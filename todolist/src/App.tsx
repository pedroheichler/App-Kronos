import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { TaskProvider } from './context/TaskContext';
import { CalendarProvider } from './context/CalendarContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { useTaskContext } from './context/TaskContext';
import { useTasks } from './hooks/useTasks';
import { useIsMobile } from './hooks/useIsMobile';
import { supabase } from './services/supabase';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { TodayView } from './components/views/TodayView';
import { UpcomingView } from './components/views/UpcomingView';
import { ReportsView } from './components/views/ReportsView';
import { ListaView } from './components/views/ListaView';
import { HabitsView } from './components/views/HabitsView';
import { CalendarView } from './components/views/CalendarView';
import { ProjectView } from './components/views/ProjectView';
import { TaskForm } from './components/tasks/TaskForm';
import { Modal } from './components/ui/Modal';
import type { AppView, TaskFormData } from './types';

// ─── Login dev (só aparece em desenvolvimento) ────────────────────────────────

function DevLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('Email ou senha incorretos.');
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0A0A' }}>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ color: '#616161', fontSize: 11, marginBottom: 4 }}>DEV — login local</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required
            style={{ padding: '9px 12px', background: '#111', border: '1px solid #1F1F1F', borderRadius: 8, color: '#E8E8E8', fontSize: 13, outline: 'none' }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" type="password" required
            style={{ padding: '9px 12px', background: '#111', border: '1px solid #1F1F1F', borderRadius: 8, color: '#E8E8E8', fontSize: 13, outline: 'none' }} />
          {error && <p style={{ color: '#ef4444', fontSize: 11 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ padding: '9px 12px', background: '#8b5cf6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────

function KronosApp() {
  const { session, authLoading } = useTaskContext();
  const { tasksGroupedByDate, addTask } = useTasks();
  const isMobile = useIsMobile();

  const [currentView, setCurrentView] = useState<AppView>('hoje');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const todayKey   = format(new Date(), 'yyyy-MM-dd');
  const todayCount = useMemo(
    () => (tasksGroupedByDate[todayKey] ?? []).filter(t => t.status === 'pending').length,
    [tasksGroupedByDate, todayKey],
  );

  const handleQuickAdd = (data: TaskFormData) => {
    addTask(data);
    setShowQuickAdd(false);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0A0A' }}>
        <p style={{ color: '#3a3a3a', fontSize: 13 }}>Carregando...</p>
      </div>
    );
  }

  if (!session) {
    if (import.meta.env.DEV) return <DevLogin />;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0A0A' }}>
        <p style={{ color: '#616161', fontSize: 13 }}>Faça login pelo Hub para acessar.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0A0A0A', overflow: 'hidden' }}>
      {!isMobile && (
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onAddTask={() => setShowQuickAdd(true)}
          todayCount={todayCount}
        />
      )}

      <main style={{
        flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        paddingBottom: isMobile ? 64 : 0,
      }}>
        {currentView === 'hoje'       && <TodayView />}
        {currentView === 'em-breve'   && <UpcomingView />}
        {currentView === 'calendario' && <CalendarView />}
        {currentView === 'lista'      && <ListaView />}
        {currentView === 'habitos'    && <HabitsView />}
        {currentView === 'relatorios' && <ReportsView />}
        {currentView === 'projeto'    && <ProjectView />}
      </main>

      {isMobile && (
        <BottomNav
          currentView={currentView}
          onViewChange={setCurrentView}
          onAddTask={() => setShowQuickAdd(true)}
          todayCount={todayCount}
        />
      )}

      <Modal isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Nova tarefa">
        <TaskForm
          initialDate={todayKey}
          taskToEdit={null}
          onSubmit={handleQuickAdd}
          onClose={() => setShowQuickAdd(false)}
        />
      </Modal>
    </div>
  );
}

// ⚠️ Ordem importa: TaskProvider DEVE envolver os demais providers
export default function App() {
  return (
    <TaskProvider>
      <CalendarProvider>
        <ProjectsProvider>
          <KronosApp />
        </ProjectsProvider>
      </CalendarProvider>
    </TaskProvider>
  );
}
