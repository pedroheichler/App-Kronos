import { useState, useEffect, ReactNode } from 'react';
import { supabase } from './services/supabase';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  TrendingUp, 
  Settings, 
  Plus, 
  MoreVertical, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronRight,
  UserPlus,
  Trash2,
  Copy,
  Edit3,
  RotateCcw,
  Search,
  Dumbbell,
  Info
} from 'lucide-react';
import { AppSwitcher } from './components/AppSwitcher';
import { motion, AnimatePresence } from 'motion/react';
import { Squad, ViewType, DayPlan, Exercise } from './types';
import { INITIAL_SQUAD } from './constants/mockData';
import { Onboarding } from './components/Onboarding';

export default function App() {

  // ── Todos os hooks primeiro ──
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [squad, setSquad] = useState<Squad>(INITIAL_SQUAD);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedDayId, setSelectedDayId] = useState<string>(squad.weeklyPlan[0].id);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{dayId: string, exercise: Exercise} | null>(null);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [checkingSquad, setCheckingSquad] = useState(true);
  function LoginTemp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    await supabase.auth.signInWithPassword({ email, password });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#09090b' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#fff', marginBottom: 8 }}>Login (dev)</h2>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email"
          style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="senha" type="password"
          style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
        <button onClick={login}
          style={{ padding: 12, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  
    useEffect(() => {
  console.log('session:', session);
  
  if (!session) {
    setCheckingSquad(false);
    return;
  }

  supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', session.user.id)
    .maybeSingle() // ← troca .single() por .maybeSingle()
    .then(({ data, error }) => {
      console.log('squad data:', data);
      console.log('squad error:', error);
      setSquadId(data?.squad_id || null);
      setCheckingSquad(false);
    });
}, [session]);

  // ── Returns condicionais (só depois de todos os hooks) ──
  if (authLoading) return <div style={{ color: '#fff', padding: 40 }}>Carregando...</div>;

  if (!session && !authLoading) {
    if (import.meta.env.PROD) {
      window.location.href = '/';
    }
  }

  if (!session) return <LoginTemp />;

if (!squadId) return (
  <Onboarding
    userId={session.user.id}
    onComplete={() => setCheckingSquad(true)}
  />
);

  const openEditor = (dayId: string, exercise: Exercise) => {
    setEditingExercise({ dayId, exercise });
    setIsEditorOpen(true);
  };

  const saveExercise = (updatedEx: Exercise) => {
    if (!editingExercise) return;
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === editingExercise.dayId 
          ? { ...day, exercises: day.exercises.map(ex => ex.id === updatedEx.id ? updatedEx : ex) }
          : day
      )
    }));
    setIsEditorOpen(false);
    setEditingExercise(null);
  };

  const todayIndex = (new Date().getDay() + 6) % 7; // Adjust to Monday = 0
  const todayId = squad.weeklyPlan[todayIndex].id;

  const toggleExercise = (dayId: string, exerciseId: string) => {
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === dayId 
          ? { ...day, exercises: day.exercises.map(ex => ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex) }
          : day
      )
    }));
  };

  const resetDay = (dayId: string) => {
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === dayId 
          ? { ...day, exercises: day.exercises.map(ex => ({ ...ex, completed: false })) }
          : day
      )
    }));
  };

  const addExercise = (dayId: string) => {
    const newEx: Exercise = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Novo Exercício',
      sets: 3,
      reps: '12',
      rest: '60s',
      completed: false
    };
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === dayId ? { ...day, exercises: [...day.exercises, newEx] } : day
      )
    }));
    openEditor(dayId, newEx);
  };

  const deleteExercise = (dayId: string, exId: string) => {
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === dayId ? { ...day, exercises: day.exercises.filter(ex => ex.id !== exId) } : day
      )
    }));
  };

  const updateDayFocus = (dayId: string, focus: string) => {
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === dayId ? { ...day, focus } : day
      )
    }));
  };

  const saveAsTemplate = (dayId: string) => {
    const day = squad.weeklyPlan.find(d => d.id === dayId);
    if (!day || !day.focus || day.exercises.length === 0) return;

    const newTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name: day.focus,
      exercises: day.exercises.map(ex => ({ ...ex, completed: false }))
    };

    setSquad(prev => {
      const existingIndex = prev.templates.findIndex(t => t.name.toLowerCase() === day.focus?.toLowerCase());
      const newTemplates = [...prev.templates];
      
      if (existingIndex >= 0) {
        newTemplates[existingIndex] = newTemplate;
      } else {
        newTemplates.push(newTemplate);
      }

      return { ...prev, templates: newTemplates };
    });
    
    alert(`Treino "${day.focus}" salvo nos modelos!`);
  };

  const loadTemplate = (dayId: string, templateId: string) => {
    const template = squad.templates.find(t => t.id === templateId);
    if (!template) return;

    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day => 
        day.id === dayId 
          ? { ...day, focus: template.name, exercises: template.exercises.map(ex => ({ ...ex, id: Math.random().toString(36).substr(2, 9) })) }
          : day
      )
    }));
  };

  const currentDayPlan = squad.weeklyPlan.find(d => d.id === todayId) || squad.weeklyPlan[0];
  const completedCount = currentDayPlan.exercises.filter(ex => ex.completed).length;
  const totalCount = currentDayPlan.exercises.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col p-6 gap-8 bg-[#09090b] z-20">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Dumbbell className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SquadFit</h1>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<Calendar size={20} />} 
            label="Semana" 
            active={currentView === 'week'} 
            onClick={() => setCurrentView('week')} 
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Equipe" 
            active={currentView === 'squad'} 
            onClick={() => setCurrentView('squad')} 
          />
          <NavItem 
            icon={<TrendingUp size={20} />} 
            label="Progresso" 
            active={currentView === 'progress'} 
            onClick={() => setCurrentView('progress')} 
          />
        </nav>

        <div className="mt-auto">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')} 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-7xl mx-auto p-8 pb-24">
          {/* Header */}
          <header className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <img 
                src={squad.icon} 
                alt={squad.name} 
                className="w-16 h-16 rounded-2xl object-cover border-2 border-zinc-800 shadow-xl"
                referrerPolicy="no-referrer"
              />
              <div>
                <h2 className="text-2xl font-bold">{squad.name}</h2>
                <p className="text-zinc-500 text-sm flex items-center gap-2">
                  <Users size={14} /> {squad.members.length} membros ativos
                </p>
              </div>
            </div>
            <AppSwitcher currentApp="treino" userEmail={session?.user?.email} />
          </header>

          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Today's Focus */}
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        Treino de Hoje <span className="text-zinc-500 font-normal text-sm">— {currentDayPlan.name}</span>
                      </h3>
                      <div className="flex items-center gap-2 group mt-1 relative">
                        <div className="flex-1 relative">
                          <input 
                            type="text"
                            value={currentDayPlan.focus || ''}
                            onChange={(e) => updateDayFocus(todayId, e.target.value)}
                            placeholder="Defina o foco do treino (ex: Peito)"
                            className="bg-transparent border-none text-emerald-500 font-bold text-xl p-0 focus:ring-0 outline-none placeholder:text-zinc-700 w-full"
                          />
                          {squad.templates.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-30 hidden group-focus-within:block max-h-48 overflow-y-auto">
                              <p className="p-2 text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-800">Seus Modelos</p>
                              {squad.templates.map(t => (
                                <button 
                                  key={t.id}
                                  onClick={() => loadTemplate(todayId, t.id)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors flex justify-between items-center"
                                >
                                  <span>{t.name}</span>
                                  <span className="text-[10px] text-zinc-500">{t.exercises.length} exs</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => saveAsTemplate(todayId)}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-emerald-500 transition-colors"
                            title="Salvar como modelo"
                          >
                            <Plus size={14} />
                          </button>
                          <Edit3 size={14} className="text-zinc-600" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => resetDay(todayId)}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                        title="Resetar progresso"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-zinc-400 text-sm mb-1">Progresso do Dia</p>
                        <h4 className="text-3xl font-bold">{completedCount} / {totalCount}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-500 font-bold text-xl">{Math.round(progress)}%</p>
                        <p className="text-zinc-500 text-xs">concluído</p>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {currentDayPlan.exercises.length > 0 ? (
                      currentDayPlan.exercises.map((ex) => (
                        <ExerciseItem 
                          key={ex.id} 
                          exercise={ex} 
                          onToggle={() => toggleExercise(todayId, ex.id)}
                          showEdit={false}
                        />
                      ))
                    ) : (
                      <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                        <p className="text-zinc-500">Nenhum exercício para hoje. Descanso merecido!</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Squad & Progress */}
              <div className="space-y-8">
                <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Squad Online</h3>
                  <div className="space-y-4">
                    {squad.members.map(member => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img 
                              src={member.avatar} 
                              alt={member.name} 
                              className="w-10 h-10 rounded-full bg-zinc-800"
                              referrerPolicy="no-referrer"
                            />
                            {member.isOnline && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#09090b] rounded-full" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-zinc-500 capitalize">{member.role}</p>
                          </div>
                        </div>
                        {member.role === 'admin' && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                  <h3 className="text-lg font-semibold mb-6">Sequência Semanal</h3>
                  <div className="flex flex-col items-center gap-4 relative">
                    {/* SVG Path for Duolingo feel */}
                    <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-zinc-800 -z-10" />
                    
                    {squad.weeklyPlan.map((day, idx) => {
                      const isToday = idx === todayIndex;
                      const isDone = day.exercises.length > 0 && day.exercises.every(e => e.completed);
                      const offset = (idx % 2 === 0 ? 0 : 20); // S-curve effect

                      return (
                        <div 
                          key={day.id} 
                          className="flex flex-col items-center w-full"
                          style={{ transform: `translateX(${offset}px)` }}
                        >
                          <div className="flex items-center gap-4 w-full">
                            <motion.div 
                              whileHover={{ scale: 1.1 }}
                              className={`
                                w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer
                                ${isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' : 
                                  isToday ? 'bg-zinc-100 text-zinc-900 scale-110 shadow-lg shadow-white/20 ring-4 ring-emerald-500/20' : 
                                  'bg-zinc-800 text-zinc-500 border border-zinc-700'}
                              `}
                            >
                              {isDone ? <CheckCircle2 size={20} /> : day.name.substring(0, 1)}
                            </motion.div>
                            <div className="flex-1">
                              <p className={`text-sm font-bold ${isToday ? 'text-zinc-100' : 'text-zinc-500'}`}>
                                {day.name}
                              </p>
                              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                                {day.exercises.length} EXS
                              </p>
                            </div>
                          </div>
                          {idx < 6 && (
                            <div className="h-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          )}

          {currentView === 'week' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {squad.weeklyPlan.map((day, idx) => (
                <div key={day.id} className={`flex flex-col gap-4 p-5 rounded-3xl border transition-all ${idx === todayIndex ? 'bg-zinc-900/80 border-zinc-700 shadow-2xl' : 'bg-zinc-900/30 border-zinc-800'}`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold ${idx === todayIndex ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {day.name}
                        {idx === todayIndex && <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase">Hoje</span>}
                      </h3>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors">
                          <Copy size={14} />
                        </button>
                        <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors">
                          <Plus size={14} onClick={() => addExercise(day.id)} />
                        </button>
                      </div>
                    </div>
                    <div className="relative group/focus">
                      <input 
                        type="text"
                        value={day.focus || ''}
                        onChange={(e) => updateDayFocus(day.id, e.target.value)}
                        placeholder="Foco do dia..."
                        className="bg-transparent border-none text-xs font-bold text-emerald-500/80 p-0 focus:ring-0 outline-none placeholder:text-zinc-700 w-full uppercase tracking-wider"
                      />
                      {squad.templates.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-30 hidden group-focus-within/focus:block max-h-40 overflow-y-auto">
                          {squad.templates.map(t => (
                            <button 
                              key={t.id}
                              onClick={() => loadTemplate(day.id, t.id)}
                              className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-zinc-800 transition-colors flex justify-between items-center"
                            >
                              <span>{t.name}</span>
                              <span className="text-zinc-500">{t.exercises.length} exs</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3 flex-1">
                    {day.exercises.length > 0 ? (
                      day.exercises.map(ex => (
                        <div 
                          key={ex.id} 
                          onClick={() => openEditor(day.id, ex)}
                          className="group relative bg-zinc-800/40 hover:bg-zinc-800 p-3 rounded-2xl border border-zinc-700/50 transition-all cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-semibold text-zinc-200 truncate pr-10">{ex.name}</p>
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={(e) => { e.stopPropagation(); openEditor(day.id, ex); }}
                                className="p-1 hover:text-emerald-400"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteExercise(day.id, ex.id); }}
                                className="p-1 hover:text-red-400"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                            <span>{ex.sets} sets</span>
                            <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                            <span>{ex.reps} reps</span>
                            <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                            <span className="flex items-center gap-1"><Clock size={10} /> {ex.rest}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30">
                        <Plus size={24} className="mb-2" />
                        <p className="text-xs">Vazio</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentView === 'squad' && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-1">Membros da Equipe</h3>
                  <p className="text-zinc-500 text-sm">Gerencie quem tem acesso aos treinos do squad.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar membro..." 
                      className="bg-zinc-800 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64"
                    />
                  </div>
                  <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                    Adicionar Novo
                  </button>
                </div>
              </div>
              <div className="divide-y divide-zinc-800">
                {squad.members.map(member => (
                  <div key={member.id} className="p-6 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-2xl bg-zinc-800" referrerPolicy="no-referrer" />
                      <div>
                        <p className="font-bold">{member.name}</p>
                        <p className="text-zinc-500 text-xs">Entrou em 12 de Jan, 2024</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-1">Permissão</p>
                        <select className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer">
                          <option value="admin">Administrador</option>
                          <option value="member">Membro</option>
                        </select>
                      </div>
                      <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500">
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'progress' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total de Exercícios" value="42" subtitle="Esta semana" icon={<Dumbbell className="text-emerald-500" />} />
                <StatCard title="Dias Concluídos" value="3/7" subtitle="Meta semanal" icon={<CheckCircle2 className="text-blue-500" />} />
                <StatCard title="Consistência" value="85%" subtitle="+12% que semana passada" icon={<TrendingUp className="text-purple-500" />} />
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6">Histórico de Atividade</h3>
                <div className="h-64 flex items-end justify-between gap-2">
                  {[40, 70, 45, 90, 65, 30, 50].map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-full bg-zinc-800 rounded-t-lg relative group">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${val}%` }}
                          className="w-full bg-emerald-500/20 border-t-2 border-emerald-500 rounded-t-lg transition-all group-hover:bg-emerald-500/40"
                        />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          {val}%
                        </div>
                      </div>
                      <span className="text-xs text-zinc-500 font-medium">
                        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditorOpen && editingExercise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-bold">Editar Exercício</h3>
                <button onClick={() => setIsEditorOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <Plus className="rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Exercício</label>
                  <input 
                    type="text" 
                    value={editingExercise.exercise.name}
                    onChange={(e) => setEditingExercise({ ...editingExercise, exercise: { ...editingExercise.exercise, name: e.target.value } })}
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Séries</label>
                    <input 
                      type="number" 
                      value={editingExercise.exercise.sets}
                      onChange={(e) => setEditingExercise({ ...editingExercise, exercise: { ...editingExercise.exercise, sets: parseInt(e.target.value) } })}
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Reps</label>
                    <input 
                      type="text" 
                      value={editingExercise.exercise.reps}
                      onChange={(e) => setEditingExercise({ ...editingExercise, exercise: { ...editingExercise.exercise, reps: e.target.value } })}
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Descanso</label>
                  <input 
                    type="text" 
                    value={editingExercise.exercise.rest}
                    onChange={(e) => setEditingExercise({ ...editingExercise, exercise: { ...editingExercise.exercise, rest: e.target.value } })}
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Observações</label>
                  <textarea 
                    value={editingExercise.exercise.notes || ''}
                    onChange={(e) => setEditingExercise({ ...editingExercise, exercise: { ...editingExercise.exercise, notes: e.target.value } })}
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                    placeholder="Ex: Focar na cadência..."
                  />
                </div>
              </div>
              <div className="p-6 bg-zinc-800/50 flex gap-3">
                <button 
                  onClick={() => setIsEditorOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-zinc-400 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => saveExercise(editingExercise.exercise)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
        ${active ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-lg' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}
      `}
    >
      <span className={`${active ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-200'}`}>{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function ExerciseItem({ exercise, onToggle, onEdit, showEdit = true }: { exercise: Exercise, onToggle: () => void, onEdit?: () => void, showEdit?: boolean, key?: string }) {
  return (
    <motion.div 
      layout
      className={`
        flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group
        ${exercise.completed ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-lg'}
      `}
      onClick={onToggle}
    >
      <div className={`
        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
        ${exercise.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-700 group-hover:border-zinc-500'}
      `}>
        {exercise.completed && <CheckCircle2 size={14} />}
      </div>
      
      <div className="flex-1">
        <h5 className={`font-semibold text-sm ${exercise.completed ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
          {exercise.name}
        </h5>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
          <span>{exercise.sets} Séries</span>
          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
          <span>{exercise.reps} Reps</span>
          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
          <span className="flex items-center gap-1"><Clock size={10} /> {exercise.rest}</span>
        </div>
        {exercise.notes && (
          <p className="text-[10px] text-zinc-600 mt-2 italic flex items-center gap-1">
            <Info size={10} /> {exercise.notes}
          </p>
        )}
      </div>

      {showEdit && onEdit && (
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-2 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 transition-all"
        >
          <Edit3 size={16} />
        </button>
      )}
    </motion.div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string, value: string, subtitle: string, icon: ReactNode }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-zinc-800 rounded-xl">
          {icon}
        </div>
        <Info size={16} className="text-zinc-600" />
      </div>
      <p className="text-zinc-500 text-sm mb-1">{title}</p>
      <h4 className="text-3xl font-bold mb-1">{value}</h4>
      <p className="text-xs text-zinc-600">{subtitle}</p>
    </div>
  );
}
