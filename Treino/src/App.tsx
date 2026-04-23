import { useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './services/supabase';
import {
  addExercise as addExerciseToDB,
  saveExercise as saveExerciseToDB,
  deleteExercise as deleteExerciseFromDB,
} from './services/exercises';
import {
  LayoutDashboard,
  Calendar,
  Users,
  TrendingUp,
  Settings as SettingsIcon,
  Plus,
  CheckCircle2,
  Trash2,
  Copy,
  Edit3,
  RotateCcw,
  Dumbbell,
} from 'lucide-react';
import { AppSwitcher } from './components/AppSwitcher';
import { motion, AnimatePresence } from 'motion/react';
import { Squad, ViewType, Exercise } from './types';
import { Settings } from './components/Settings';


// Retorna "YYYY-MM-DD" no fuso local (evita bug UTC-3 após 21h)
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Calcula sequência de treinos consecutivos respeitando dias de descanso.
// trainingDays: índices dos dias com treino (Seg=0…Dom=6). Vazio = todos os dias contam.
function calcStreak(dates: string[], trainingDays: number[] = []): number {
  if (!dates.length) return 0;

  const doneSet  = new Set(dates);
  const allDays  = trainingDays.length === 0;
  const todayStr = localDateStr();

  let streak = 0;
  let d = new Date();

  for (let i = 0; i < 400; i++) {
    const dateStr  = localDateStr(d);
    const dow      = (d.getDay() + 6) % 7; // JS Dom=0 → converte para Seg=0

    if (!allDays && !trainingDays.includes(dow)) {
      // Dia de descanso — não conta nem quebra a sequência
      d.setDate(d.getDate() - 1);
      continue;
    }

    if (doneSet.has(dateStr)) {
      streak++;
    } else if (dateStr !== todayStr) {
      break; // Dia de treino passado perdido → sequência quebrada
    }
    // Se for hoje e não treinou ainda → não penaliza, continua contando para trás

    d.setDate(d.getDate() - 1);
  }

  return streak;
}

function getStreakStyle(days: number): { color: string; badge: string } {
  if (days >= 60) return { color: '#ffd700', badge: '60 dias 🏆' };
  if (days >= 45) return { color: '#8b5cf6', badge: '45 dias ⚡' };
  if (days >= 30) return { color: '#ef4444', badge: '30 dias 💪' };
  if (days >= 15) return { color: '#f97316', badge: '15 dias 🔥' };
  if (days >= 7)  return { color: '#fbbf24', badge: '7 dias 🏅' };
  return { color: '#E8E8E8', badge: '' };
}

function parseRestSeconds(rest: string): number {
  if (!rest) return 60;
  const m = rest.match(/^(\d+):(\d+)$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const s = rest.match(/^(\d+)/);
  return s ? parseInt(s[1]) : 60;
}

function DevLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#09090b' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#fff', marginBottom: 8 }}>Login (dev)</h2>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email"
          style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="senha" type="password"
          style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
        <button onClick={() => supabase.auth.signInWithPassword({ email, password })}
          style={{ padding: 12, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

export default function App() {

  // ── Todos os hooks primeiro ──
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [squad, setSquad] = useState<Squad>({
    id: '',
    name: '',
    icon: '',
    members: [],
    weeklyPlan: [],
    templates: [],
  });
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{dayId: string, exercise: Exercise} | null>(null);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [checkingSquad, setCheckingSquad] = useState(true);
  const [squadLoading, setSquadLoading] = useState(false);
  const [selectedWeekDay, setSelectedWeekDay] = useState<number>(() => (new Date().getDay() + 6) % 7);
  const [diasTreinados, setDiasTreinados] = useState(0);
  const [memberStreaks, setMemberStreaks] = useState<Record<string, number>>({});
  const [progressStats, setProgressStats] = useState<{
    thisWeekByDate: Record<string, number>;
    lastWeekByDate: Record<string, number>;
    loading: boolean;
  }>({ thisWeekByDate: {}, lastWeekByDate: {}, loading: false });

  // Exercícios rastreados pelo usuário (independente do plano)
  type TrackedExercise = { id: string; name: string };
  type LoadEntry       = { id: string; date: string; load_notes: string };
  const [trackedExercises, setTrackedExercises] = useState<TrackedExercise[]>([]);
  const [loadHistory, setLoadHistory]           = useState<Record<string, LoadEntry[]>>({});
  const [loadInputs, setLoadInputs]             = useState<Record<string, string>>({});
  const [savedLoadIds, setSavedLoadIds]         = useState<Set<string>>(new Set());
  const [loadsLoading, setLoadsLoading]         = useState(false);

  // ── Features: set tracking, rest timer, per-set loads, PR ───────────────────
  const [setProgress, setSetProgress] = useState<Record<string, boolean[]>>({});
  const [restTimer, setRestTimer] = useState<{ exerciseId: string; remaining: number; total: number } | null>(null);
  const [setLoadData, setSetLoadData] = useState<Record<string, Array<{ weight: string; reps: string }>>>(() => {
    try { return JSON.parse(localStorage.getItem('kronos_set_loads') ?? '{}'); } catch { return {}; }
  });
  const [prIds, setPrIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
  if (!session) {
    setCheckingSquad(false);
    return;
  }

  supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', session.user.id)
    .limit(1)
    .then(({ data }) => {
      setSquadId(data?.[0]?.squad_id || null);
      setCheckingSquad(false);
    });
}, [session?.user?.id]);

useEffect(() => {
  if (!squadId) return;

  const load = async () => {
    setSquadLoading(true);
    const today = localDateStr();
    const oneYearAgo = localDateStr(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

    // ── Batch 1: 3 requisições em paralelo ──────────────────────────────────
    const [
      { data: squadData },
      { data: membersData },
      { data: daysData },
    ] = await Promise.all([
      supabase.from('squads').select('id, name, icon, invite_code').eq('id', squadId).single(),
      supabase.from('squad_members').select('user_id, role').eq('squad_id', squadId),
      supabase.from('workout_days').select('id, name, focus, day_order').eq('squad_id', squadId).order('day_order'),
    ]);

    if (!squadData || !daysData) { setSquadLoading(false); return; }

    const dayIds = daysData.map((d: any) => d.id);
    const memberUserIds = (membersData || []).map((m: any) => m.user_id);
    const allUserIds = [...new Set([...memberUserIds, session.user.id])];

    // ── Batch 2: 4 requisições em paralelo ──────────────────────────────────
    // Exercícios: 1 query com .in() em vez de N queries separadas
    const [
      { data: exercisesData },
      { data: progressData },
      { data: profilesData },
      { data: allProgressData },
      { data: membersProgressData },
    ] = await Promise.all([
      supabase.from('exercises').select('id, name, sets, reps, rest, notes, workout_day_id').in('workout_day_id', dayIds).order('created_at', { ascending: true }),
      supabase.from('exercise_progress').select('exercise_id, completed').eq('user_id', session.user.id).eq('date', today),
      supabase.from('profiles').select('id, name, avatar_url').in('id', allUserIds),
      supabase.from('exercise_progress').select('date').eq('user_id', session.user.id).eq('completed', true).gte('date', oneYearAgo),
      memberUserIds.length > 0
        ? supabase.from('exercise_progress').select('user_id, date').in('user_id', memberUserIds).eq('completed', true).gte('date', oneYearAgo)
        : Promise.resolve({ data: [] }),
    ]);

    // ── Montar estado completo de uma vez ────────────────────────────────────
    const progressMap = new Map((progressData || []).map((p: any) => [p.exercise_id, p.completed]));
    const profileMap  = new Map((profilesData  || []).map((p: any) => [p.id, p]));

    // Agrupar exercícios por dia
    const exercisesByDay = new Map<string, Exercise[]>();
    for (const ex of (exercisesData || [])) {
      const arr = exercisesByDay.get(ex.workout_day_id) ?? [];
      arr.push({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        notes: ex.notes ?? undefined,
        completed: progressMap.get(ex.id) ?? false,
      });
      exercisesByDay.set(ex.workout_day_id, arr);
    }

    setSquad({
      id: squadData.id,
      name: squadData.name,
      icon: squadData.icon || '',
      inviteCode: squadData.invite_code,
      templates: [],
      members: (membersData || []).map((m: any) => ({
        id: m.user_id,
        name: profileMap.get(m.user_id)?.name || (m.user_id === session.user.id ? session.user.email : 'Membro'),
        avatar: profileMap.get(m.user_id)?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_id}`,
        role: m.role,
        isOnline: m.user_id === session.user.id,
      })),
      weeklyPlan: daysData.map((day: any) => ({
        id: day.id,
        name: day.name,
        focus: day.focus || '',
        exercises: exercisesByDay.get(day.id) ?? [],
      })),
    });

    // Índices dos dias com treino (Seg=0…Dom=6) — dias sem exercícios = descanso
    const trainingDayIndices = daysData
      .map((_: any, idx: number) =>
        (exercisesByDay.get(daysData[idx].id) ?? []).length > 0 ? idx : -1
      )
      .filter((i: number) => i !== -1);

    // Dias treinados (streak consecutivo) — dados já vêm no batch 2
    const myDates = (allProgressData || []).map((r: any) => r.date as string);
    setDiasTreinados(calcStreak(myDates, trainingDayIndices));

    // Streak consecutivo por membro do squad (mesmo plano = mesmos dias de treino)
    const streaksByMember: Record<string, number> = {};
    const mpData = (membersProgressData || []) as { user_id: string; date: string }[];
    const datesByMember: Record<string, string[]> = {};
    for (const row of mpData) {
      if (!datesByMember[row.user_id]) datesByMember[row.user_id] = [];
      datesByMember[row.user_id].push(row.date);
    }
    for (const uid of memberUserIds) {
      streaksByMember[uid] = calcStreak(datesByMember[uid] || [], trainingDayIndices);
    }
    setMemberStreaks(streaksByMember);
    setSquadLoading(false);
  };

  load().catch(console.error);
}, [squadId]);

  const fetchDiasTreinados = useCallback(async () => {
    if (!session?.user?.id) return;

    const trainingDayIndices = squad.weeklyPlan
      .map((day, idx) => day.exercises.length > 0 ? idx : -1)
      .filter(i => i !== -1);

    const oneYearAgo = localDateStr(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    const { data } = await supabase
      .from('exercise_progress')
      .select('date')
      .eq('user_id', session.user.id)
      .eq('completed', true)
      .gte('date', oneYearAgo);
    const myDates = (data || []).map((r: any) => r.date as string);
    setDiasTreinados(calcStreak(myDates, trainingDayIndices));
  }, [session?.user?.id, squad.weeklyPlan]);

  const fetchProgressStats = useCallback(async () => {
    if (!session?.user?.id) return;
    setProgressStats(p => ({ ...p, loading: true }));

    const getWeekRange = (offsetWeeks = 0) => {
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // Seg=0
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + offsetWeeks * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: localDateStr(monday),
        end: localDateStr(sunday),
      };
    };

    const thisWeek = getWeekRange(0);
    const lastWeek = getWeekRange(-1);

    const [{ data: thisData }, { data: lastData }] = await Promise.all([
      supabase.from('exercise_progress').select('date').eq('user_id', session.user.id).eq('completed', true).gte('date', thisWeek.start).lte('date', thisWeek.end),
      supabase.from('exercise_progress').select('date').eq('user_id', session.user.id).eq('completed', true).gte('date', lastWeek.start).lte('date', lastWeek.end),
    ]);

    const countByDate = (rows: { date: string }[]) => {
      const result: Record<string, number> = {};
      for (const row of (rows || [])) result[row.date] = (result[row.date] ?? 0) + 1;
      return result;
    };

    setProgressStats({
      thisWeekByDate: countByDate(thisData ?? []),
      lastWeekByDate: countByDate(lastData ?? []),
      loading: false,
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (currentView === 'progress') fetchProgressStats();
  }, [currentView, fetchProgressStats]);

  useEffect(() => {
    if (currentView !== 'progress' || !session?.user?.id) return;
    setLoadsLoading(true);

    supabase
      .from('tracked_exercises')
      .select('id, name')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .then(async ({ data: exData }) => {
        const exList = (exData || []) as { id: string; name: string }[];
        setTrackedExercises(exList);

        if (exList.length === 0) { setLoadsLoading(false); return; }

        const { data: loadsData } = await supabase
          .from('exercise_loads')
          .select('id, tracked_exercise_id, date, load_notes')
          .eq('user_id', session.user.id)
          .in('tracked_exercise_id', exList.map(e => e.id))
          .order('date', { ascending: false });

        const grouped: Record<string, { id: string; date: string; load_notes: string }[]> = {};
        for (const row of (loadsData || [])) {
          if (!grouped[row.tracked_exercise_id]) grouped[row.tracked_exercise_id] = [];
          grouped[row.tracked_exercise_id].push({ id: row.id, date: row.date, load_notes: row.load_notes });
        }
        setLoadHistory(grouped);

        // Pré-preenche o campo com o último registro
        const inputs: Record<string, string> = {};
        for (const [exId, entries] of Object.entries(grouped)) {
          if (entries[0]) inputs[exId] = entries[0].load_notes;
        }
        setLoadInputs(inputs);
        setLoadsLoading(false);
      });
  }, [currentView, session?.user?.id]); // eslint-disable-line

  // Initialize setProgress when squad weeklyPlan loads
  useEffect(() => {
    setSetProgress(prev => {
      const next = { ...prev };
      for (const day of squad.weeklyPlan) {
        for (const ex of day.exercises) {
          if (!(ex.id in next)) {
            next[ex.id] = Array(ex.sets).fill(ex.completed);
          }
        }
      }
      return next;
    });
  }, [squad.weeklyPlan]);

  // Rest timer countdown + notificação ao zerar
  useEffect(() => {
    if (!restTimer) return;
    if (restTimer.remaining <= 0) {
      setRestTimer(null);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Descanse acabou! 💪', {
          body: 'Hora da próxima série',
          icon: '/kronos-icon.png',
          silent: false,
        });
      }
      return;
    }
    const id = setTimeout(() => {
      setRestTimer(prev => prev ? { ...prev, remaining: prev.remaining - 1 } : null);
    }, 1000);
    return () => clearTimeout(id);
  }, [restTimer]);

  // Persist load data to localStorage
  useEffect(() => {
    localStorage.setItem('kronos_set_loads', JSON.stringify(setLoadData));
  }, [setLoadData]);

  // Request notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Returns condicionais (só depois de todos os hooks) ──
  if (authLoading || checkingSquad) return <div style={{ color: '#fff', padding: 40, background: '#09090b', minHeight: '100vh' }}>Carregando...</div>;

  if (!session) {
    if (import.meta.env.PROD) {
      window.location.href = '/';
      return null;
    }
    return <DevLogin />;
  }

  const refreshSquad = () => {
    supabase
      .from('squad_members')
      .select('squad_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .then(({ data }) => {
        setSquadId(data?.[0]?.squad_id || null);
      });
  };

  const openEditor = (dayId: string, exercise: Exercise) => {
    setEditingExercise({ dayId, exercise });
    setIsEditorOpen(true);
  };

  const saveExercise = (updatedEx: Exercise) => {
    if (!editingExercise) return;
    saveExerciseToDB(updatedEx).catch(console.error);
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

  const createTrackedExercise = async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    const { data, error } = await supabase
      .from('tracked_exercises')
      .insert({ user_id: session.user.id, name: name.trim() })
      .select('id, name')
      .single();
    if (error) {
      console.error('Erro ao criar exercício:', error);
      alert('Erro ao criar exercício.');
      return false;
    }
    if (data) setTrackedExercises(prev => [...prev, data as { id: string; name: string }]);
    return true;
  };

  const deleteTrackedExercise = async (id: string) => {
    await supabase.from('tracked_exercises').delete().eq('id', id);
    setTrackedExercises(prev => prev.filter(e => e.id !== id));
    setLoadHistory(prev => { const n = { ...prev }; delete n[id]; return n; });
    setLoadInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveLoad = async (trackedExId: string, notes: string) => {
    if (!notes.trim()) return;
    const today = localDateStr();
    const { data, error } = await supabase
      .from('exercise_loads')
      .insert({ tracked_exercise_id: trackedExId, user_id: session.user.id, date: today, load_notes: notes.trim() })
      .select('id, date, load_notes')
      .single();
    if (!error && data) {
      setLoadHistory(prev => ({
        ...prev,
        [trackedExId]: [{ id: data.id, date: data.date, load_notes: data.load_notes }, ...(prev[trackedExId] ?? [])],
      }));
      setLoadInputs(prev => ({ ...prev, [trackedExId]: '' }));
      setSavedLoadIds(prev => new Set(prev).add(trackedExId));
      setTimeout(() => setSavedLoadIds(prev => { const s = new Set(prev); s.delete(trackedExId); return s; }), 2000);
    }
  };

  const deleteLoad = async (trackedExId: string, loadId: string) => {
    await supabase.from('exercise_loads').delete().eq('id', loadId);
    setLoadHistory(prev => ({
      ...prev,
      [trackedExId]: (prev[trackedExId] ?? []).filter(e => e.id !== loadId),
    }));
  };

  const todayIndex = (new Date().getDay() + 6) % 7; // Adjust to Monday = 0
  const todayId = squad.weeklyPlan[todayIndex]?.id ?? squad.weeklyPlan[0]?.id ?? '';

  const toggleExercise = async (dayId: string, exerciseId: string) => {
    const day = squad.weeklyPlan.find(d => d.id === dayId);
    const ex = day?.exercises.find(e => e.id === exerciseId);
    if (!ex) return;

    const newCompleted = !ex.completed;

    await supabase
      .from('exercise_progress')
      .upsert({
        exercise_id: exerciseId,
        user_id: session.user.id,
        completed: newCompleted,
        date: localDateStr(),
      }, { onConflict: 'exercise_id,user_id,date' });

    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day =>
        day.id === dayId
          ? { ...day, exercises: day.exercises.map(ex =>
              ex.id === exerciseId ? { ...ex, completed: newCompleted } : ex
            )}
          : day
      )
    }));

    fetchDiasTreinados();
  };

  const resetDay = async (dayId: string) => {
    const day = squad.weeklyPlan.find(d => d.id === dayId);
    if (day && day.exercises.length > 0) {
      await supabase
        .from('exercise_progress')
        .delete()
        .eq('user_id', session.user.id)
        .eq('date', localDateStr())
        .in('exercise_id', day.exercises.map(e => e.id));
    }
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(d =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.map(ex => ({ ...ex, completed: false })) }
          : d
      )
    }));
    fetchDiasTreinados();
  };

  const handleSetToggle = (dayId: string, exercise: Exercise, setIndex: number) => {
    const current = setProgress[exercise.id] ?? Array(exercise.sets).fill(false);
    const updated = [...current];
    updated[setIndex] = !updated[setIndex];

    const allDone = updated.every(Boolean);
    const wasAllDone = current.every(Boolean);

    setSetProgress(prev => ({ ...prev, [exercise.id]: updated }));

    if (allDone && !wasAllDone && !exercise.completed) toggleExercise(dayId, exercise.id);
    if (!allDone && wasAllDone && exercise.completed) toggleExercise(dayId, exercise.id);

    if (updated[setIndex]) {
      const secs = parseRestSeconds(exercise.rest);
      if (secs > 0) setRestTimer({ exerciseId: exercise.id, remaining: secs, total: secs });

      // PR check
      const weight = parseFloat(setLoadData[exercise.id]?.[setIndex]?.weight ?? '');
      if (!isNaN(weight) && weight > 0) {
        const stored: Record<string, number> = JSON.parse(localStorage.getItem('kronos_pr') ?? '{}');
        if (weight > (stored[exercise.id] ?? 0)) {
          stored[exercise.id] = weight;
          localStorage.setItem('kronos_pr', JSON.stringify(stored));
          setPrIds(prev => new Set(prev).add(exercise.id));
          setTimeout(() => setPrIds(prev => { const s = new Set(prev); s.delete(exercise.id); return s; }), 6000);
        }
      }
    } else {
      setRestTimer(prev => prev?.exerciseId === exercise.id ? null : prev);
    }
  };

  const handleLoadChange = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', val: string) => {
    setSetLoadData(prev => {
      const sets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      while (sets.length <= setIndex) sets.push({ weight: '', reps: '' });
      sets[setIndex] = { ...sets[setIndex], [field]: val };
      return { ...prev, [exerciseId]: sets };
    });
  };

  const addExercise = (dayId: string) => {
    const newEx: Exercise = {
      id: crypto.randomUUID(),
      name: 'Novo Exercício',
      sets: 3,
      reps: '12',
      rest: '60s',
      completed: false
    };
    addExerciseToDB(dayId, newEx).catch(console.error);
    setSquad(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(day =>
        day.id === dayId ? { ...day, exercises: [...day.exercises, newEx] } : day
      )
    }));
    openEditor(dayId, newEx);
  };

  const deleteExercise = (dayId: string, exId: string) => {
    deleteExerciseFromDB(exId).catch(console.error);
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

    supabase
      .from('workout_days')
      .update({ focus })
      .eq('id', dayId)
      .then(({ error }) => {
        if (error) console.error('Erro ao salvar foco:', error);
      });
  };

  const saveAsTemplate = (dayId: string) => {
    const day = squad.weeklyPlan.find(d => d.id === dayId);
    if (!day || !day.focus || day.exercises.length === 0) return;

    const newTemplate = {
      id: crypto.randomUUID(),
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
          ? { ...day, focus: template.name, exercises: template.exercises.map(ex => ({ ...ex, id: Math.random().toString(36).substring(2, 11) })) }
          : day
      )
    }));
  };

  const currentDayPlan = squad.weeklyPlan.find(d => d.id === todayId) ?? squad.weeklyPlan[0] ?? { id: '', name: '', focus: '', exercises: [] };
  const completedCount = currentDayPlan.exercises.filter(ex => ex.completed).length;
  const totalCount = currentDayPlan.exercises.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-[#E8E8E8] font-sans overflow-hidden">
      {/* Sidebar — só aparece em telas md+ */}
      <aside className="hidden md:flex w-52 border-r border-[#1F1F1F] flex-col py-6 bg-[#0A0A0A] z-20 shrink-0">
        <div className="px-5 mb-8">
          <p className="text-[10px] text-[#616161] font-medium uppercase tracking-widest mb-1.5">Squad</p>
          <p className="text-sm font-semibold text-[#E8E8E8] truncate">{squad.name || 'Kronos'}</p>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={<Calendar size={16} />} label="Semana" active={currentView === 'week'} onClick={() => setCurrentView('week')} />
          <NavItem icon={<Users size={16} />} label="Equipe" active={currentView === 'squad'} onClick={() => setCurrentView('squad')} />
          <NavItem icon={<TrendingUp size={16} />} label="Progresso" active={currentView === 'progress'} onClick={() => setCurrentView('progress')} />
        </nav>

        <div className="px-3">
          <NavItem icon={<SettingsIcon size={16} />} label="Configurações" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pb-28 md:pb-10">
          {/* Header */}
          <header className="flex items-center justify-between mb-5 md:mb-8">
            <div>
              <h2 className="text-lg font-semibold text-[#E8E8E8]">
                {currentView === 'dashboard' && 'Hoje'}
                {currentView === 'week' && 'Semana'}
                {currentView === 'squad' && 'Equipe'}
                {currentView === 'progress' && 'Progresso'}
                {currentView === 'settings' && 'Configurações'}
              </h2>
              <p className="text-xs text-[#616161] mt-0.5 capitalize">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <AppSwitcher currentApp="treino" userEmail={session?.user?.email} />
          </header>

          {currentView === 'dashboard' && squadLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl h-48" />
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl h-14" />
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl h-14" />
              </div>
              <div className="space-y-4">
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl h-24" />
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl h-40" />
              </div>
            </div>
          )}

          {currentView === 'dashboard' && !squadLoading && (
            <>
            {/* Mobile: quick stats row (streak + mini-week) */}
            <div className="flex gap-3 mb-4 lg:hidden">
              {(() => {
                const { color } = getStreakStyle(diasTreinados);
                return (
                  <div className="flex-1 bg-[#111111] border border-[#1F1F1F] rounded-xl p-4">
                    <p className="text-[10px] text-[#616161] uppercase tracking-widest mb-1.5">Sequência</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums" style={{ color }}>{diasTreinados}</span>
                      <span className="text-xs text-[#616161]">dias</span>
                    </div>
                  </div>
                );
              })()}
              <div className="flex-1 bg-[#111111] border border-[#1F1F1F] rounded-xl p-4">
                <p className="text-[10px] text-[#616161] uppercase tracking-widest mb-3">Esta semana</p>
                <div className="flex gap-1 items-end">
                  {squad.weeklyPlan.map((day, idx) => {
                    const isDone = day.exercises.length > 0 && day.exercises.every(e => e.completed);
                    const isToday = idx === todayIndex;
                    return (
                      <div key={day.id} className={`flex-1 rounded-sm transition-all ${
                        isDone ? 'bg-emerald-500 h-5' :
                        isToday ? 'bg-emerald-500/40 h-4' :
                        day.exercises.length > 0 ? 'bg-[#2a2a2a] h-3' : 'bg-[#1a1a1a] h-2'
                      }`} />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-4">

                {/* Hero card: foco + progresso */}
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-5 md:p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex-1 group relative">
                      <p className="text-[10px] text-[#3a3a3a] mb-2 uppercase tracking-[0.2em] font-semibold">{currentDayPlan.name}</p>
                      <input
                        type="text"
                        value={currentDayPlan.focus || ''}
                        onChange={(e) => updateDayFocus(todayId, e.target.value)}
                        placeholder="FOCO DO TREINO"
                        className="bg-transparent border-none text-[#E8E8E8] p-0 focus:ring-0 outline-none placeholder:text-[#1e1e1e] w-full uppercase"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', letterSpacing: '0.06em' }}
                      />
                      {squad.templates.length > 0 && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-[#161616] border border-[#1F1F1F] rounded-xl z-30 hidden group-focus-within:block max-h-44 overflow-y-auto">
                          {squad.templates.map(t => (
                            <button key={t.id} onClick={() => loadTemplate(todayId, t.id)}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#E8E8E8] hover:bg-[#1F1F1F] transition-colors flex justify-between items-center">
                              <span>{t.name}</span>
                              <span className="text-xs text-[#616161]">{t.exercises.length} exs</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => resetDay(todayId)}
                      className="p-2 rounded-lg text-[#3a3a3a] hover:text-[#616161] hover:bg-[#1a1a1a] transition-colors ml-3 shrink-0"
                      title="Resetar">
                      <RotateCcw size={15} />
                    </button>
                  </div>

                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className="text-4xl font-bold text-[#E8E8E8] tabular-nums">{completedCount}</span>
                      <span className="text-xl text-[#616161] font-medium"> / {totalCount}</span>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${progress === 100 ? 'text-emerald-400' : 'text-[#616161]'}`}>
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1a1a1a] h-1 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className={`h-full rounded-full transition-colors ${progress === 100 ? 'bg-emerald-400' : 'bg-[#E8E8E8]'}`}
                    />
                  </div>
                </div>

                {/* Lista de exercícios */}
                <div className="space-y-2">
                  {currentDayPlan.exercises.length > 0 ? (
                    currentDayPlan.exercises.map((ex) => (
                      <ExerciseItem
                        key={ex.id}
                        exercise={ex}
                        setsDone={setProgress[ex.id] ?? Array(ex.sets).fill(ex.completed)}
                        loadData={setLoadData[ex.id] ?? []}
                        onSetToggle={(setIndex) => handleSetToggle(todayId, ex, setIndex)}
                        onLoadChange={(setIndex, field, val) => handleLoadChange(ex.id, setIndex, field, val)}
                        isPR={prIds.has(ex.id)}
                        showEdit={false}
                      />
                    ))
                  ) : (
                    <div className="py-16 text-center">
                      <Dumbbell className="w-8 h-8 text-[#1F1F1F] mx-auto mb-3" />
                      <p className="text-sm text-[#616161]">Nenhum exercício para hoje</p>
                      <p className="text-xs text-[#3a3a3a] mt-1">Descanso merecido</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — desktop only for streak/week, squad always */}
              <div className="space-y-4">

                {/* Streak — hidden on mobile (shown in quick-stats above) */}
                {(() => {
                  const { color, badge } = getStreakStyle(diasTreinados);
                  return (
                    <div className="hidden lg:block bg-[#111111] border border-[#1F1F1F] rounded-xl p-5"
                      style={diasTreinados >= 7 ? { borderColor: color + '40' } : undefined}>
                      <p className="text-xs text-[#616161] uppercase tracking-widest font-medium mb-3">Sequência</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{diasTreinados}</span>
                        <span className="text-sm text-[#616161]">dias</span>
                      </div>
                      {badge && (
                        <p className="text-xs mt-2 font-medium" style={{ color }}>{badge}</p>
                      )}
                    </div>
                  );
                })()}

                {/* Squad */}
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-5">
                  <p className="text-xs text-[#616161] uppercase tracking-widest font-medium mb-4">Squad</p>
                  <div className="space-y-3">
                    {squad.members.map(member => {
                      const streak = memberStreaks[member.id] ?? 0;
                      return (
                        <div key={member.id} className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img src={member.avatar} alt={member.name}
                              className="w-8 h-8 rounded-full bg-[#1a1a1a]"
                              referrerPolicy="no-referrer" />
                            {member.isOnline && (
                              <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border border-[#111111] rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-[#E8E8E8] font-medium truncate flex-1">{member.name}</p>
                          {streak > 0 && (
                            <span className="text-xs shrink-0 font-medium" style={{ color: getStreakStyle(streak).color }}>
                              🔥 {streak}
                            </span>
                          )}
                          {member.role === 'admin' && (
                            <span className="text-[10px] text-[#616161] shrink-0">admin</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Semana — hidden on mobile (shown in quick-stats above) */}
                <div className="hidden lg:block bg-[#111111] border border-[#1F1F1F] rounded-xl p-5">
                  <p className="text-xs text-[#616161] uppercase tracking-widest font-medium mb-4">Esta Semana</p>
                  <div className="space-y-2">
                    {squad.weeklyPlan.map((day, idx) => {
                      const isToday = idx === todayIndex;
                      const isDone = day.exercises.length > 0 && day.exercises.every(e => e.completed);
                      return (
                        <div key={day.id} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${isToday ? 'bg-[#1a1a1a]' : ''}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isDone ? 'bg-emerald-500' : isToday ? 'bg-[#2a2a2a] ring-1 ring-emerald-500/40' : 'bg-[#1a1a1a]'
                          }`}>
                            {isDone && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          <p className={`text-sm flex-1 ${isToday ? 'text-[#E8E8E8] font-medium' : 'text-[#616161]'}`}>{day.name}</p>
                          <span className="text-[10px] text-[#3a3a3a]">{day.exercises.length}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {currentView === 'week' && (
            <>
              {/* Mobile: horizontal day tabs */}
              <div className="md:hidden">
                {/* Day selector */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {squad.weeklyPlan.map((day, idx) => {
                    const isDone = day.exercises.length > 0 && day.exercises.every(e => e.completed);
                    const isToday = idx === todayIndex;
                    const isSelected = idx === selectedWeekDay;
                    return (
                      <button key={day.id} onClick={() => setSelectedWeekDay(idx)}
                        className="flex flex-col items-center gap-1 shrink-0 transition-all"
                        style={{ minWidth: 44 }}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all text-xs font-semibold
                          ${isSelected
                            ? isDone ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500'
                            : isDone ? 'bg-emerald-500/15 text-emerald-600'
                            : isToday ? 'bg-[#1a1a1a] text-[#E8E8E8] ring-1 ring-[#2a2a2a]'
                            : 'bg-transparent text-[#3a3a3a]'
                          }`}>
                          {isDone ? <CheckCircle2 size={16} /> : day.name.slice(0, 3)}
                        </div>
                        {isToday && (
                          <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-[#2a2a2a]'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected day content */}
                {(() => {
                  const day = squad.weeklyPlan[selectedWeekDay];
                  if (!day) return null;
                  const isToday = selectedWeekDay === todayIndex;
                  return (
                    <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden">
                      {/* Day header */}
                      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a1a]">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-semibold text-[#E8E8E8]">{day.name}</h3>
                            {isToday && <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">Hoje</span>}
                          </div>
                          <input
                            type="text"
                            value={day.focus || ''}
                            onChange={(e) => updateDayFocus(day.id, e.target.value)}
                            placeholder="Foco do treino..."
                            className="bg-transparent border-none text-xs text-[#616161] p-0 focus:ring-0 outline-none placeholder:text-[#2a2a2a] w-full"
                          />
                        </div>
                        <button onClick={() => addExercise(day.id)}
                          className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#616161] shrink-0 ml-2">
                          <Plus size={14} />
                        </button>
                      </div>
                      {/* Exercises */}
                      <div className="divide-y divide-[#1a1a1a]">
                        {day.exercises.length > 0 ? (
                          day.exercises.map(ex => (
                            <div key={ex.id} className="flex items-center gap-3 px-4 py-3.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#E8E8E8] truncate">{ex.name}</p>
                                <p className="text-xs text-[#3a3a3a] mt-0.5">{ex.sets}×{ex.reps} · {ex.rest}</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => openEditor(day.id, ex)}
                                  className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#616161]">
                                  <Edit3 size={13} />
                                </button>
                                <button onClick={() => deleteExercise(day.id, ex.id)}
                                  className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#3a3a3a]">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-12 flex flex-col items-center gap-2 text-[#3a3a3a]">
                            <Dumbbell size={24} />
                            <p className="text-xs">Dia de descanso</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Desktop: grid view */}
              <div className="hidden md:grid grid-cols-2 xl:grid-cols-4 gap-4">
                {squad.weeklyPlan.map((day, idx) => (
                  <div key={day.id} className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${idx === todayIndex ? 'bg-[#111111] border-[#2a2a2a]' : 'bg-[#0e0e0e] border-[#1F1F1F]'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold ${idx === todayIndex ? 'text-[#E8E8E8]' : 'text-[#616161]'}`}>{day.name}</h3>
                          {idx === todayIndex && <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">Hoje</span>}
                        </div>
                        <div className="relative group/focus mt-0.5">
                          <input
                            type="text"
                            value={day.focus || ''}
                            onChange={(e) => updateDayFocus(day.id, e.target.value)}
                            placeholder="Foco..."
                            className="bg-transparent border-none text-[10px] text-[#616161] p-0 focus:ring-0 outline-none placeholder:text-[#2a2a2a] w-full"
                          />
                          {squad.templates.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-44 bg-[#161616] border border-[#1F1F1F] rounded-lg z-30 hidden group-focus-within/focus:block max-h-36 overflow-y-auto">
                              {squad.templates.map(t => (
                                <button key={t.id} onClick={() => loadTemplate(day.id, t.id)}
                                  className="w-full text-left px-3 py-2 text-xs text-[#E8E8E8] hover:bg-[#1F1F1F] transition-colors flex justify-between">
                                  <span>{t.name}</span>
                                  <span className="text-[#616161]">{t.exercises.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => addExercise(day.id)}
                        className="p-1.5 rounded-lg text-[#3a3a3a] hover:text-[#616161] hover:bg-[#1a1a1a] transition-colors shrink-0">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="space-y-1.5 flex-1">
                      {day.exercises.length > 0 ? (
                        day.exercises.map(ex => (
                          <div key={ex.id} onClick={() => openEditor(day.id, ex)}
                            className="group relative flex items-center gap-2.5 p-2.5 rounded-lg border border-[#1a1a1a] hover:border-[#2a2a2a] bg-[#0A0A0A] transition-all cursor-pointer">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[#E8E8E8] truncate">{ex.name}</p>
                              <p className="text-[10px] text-[#3a3a3a] mt-0.5">{ex.sets}×{ex.reps} · {ex.rest}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); openEditor(day.id, ex); }}
                                className="p-1 text-[#616161] hover:text-[#E8E8E8]"><Edit3 size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteExercise(day.id, ex.id); }}
                                className="p-1 text-[#616161] hover:text-rose-400"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 flex flex-col items-center gap-2 opacity-20">
                          <Plus size={20} />
                          <p className="text-[10px]">Vazio</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {currentView === 'squad' && (
            <div className="max-w-lg space-y-4">

              {/* Código de convite */}
              {squad.members.find(m => m.id === session?.user?.id)?.role === 'admin' && (
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-5">
                  <p className="text-xs text-[#616161] uppercase tracking-widest font-medium mb-3">Código de Convite</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg px-4 py-3 font-mono text-lg font-bold tracking-widest text-[#E8E8E8] text-center">
                      {squad.inviteCode || '...'}
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(squad.inviteCode || ''); alert('Copiado!'); }}
                      className="p-3 bg-[#1a1a1a] hover:bg-[#222] border border-[#1F1F1F] rounded-lg text-[#616161] hover:text-[#E8E8E8] transition-all"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Membros */}
              <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1F1F1F]">
                  <p className="text-xs text-[#616161] uppercase tracking-widest font-medium">Membros · {squad.members.length}</p>
                </div>
                <div className="divide-y divide-[#1a1a1a]">
                  {squad.members.map(member => (
                    <div key={member.id} className="px-5 py-4 flex items-center gap-4 hover:bg-[#161616] transition-colors">
                      <img src={member.avatar} alt={member.name}
                        className="w-9 h-9 rounded-full bg-[#1a1a1a] shrink-0" referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#E8E8E8] truncate">{member.name}</p>
                        <p className="text-xs text-[#616161] capitalize">{member.role}</p>
                      </div>
                      {member.role === 'admin' && (
                        <span className="text-[10px] text-[#616161] bg-[#1a1a1a] px-2 py-0.5 rounded font-medium">admin</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentView === 'progress' && (() => {
            // Datas seg–dom da semana atual (Seg=0 … Dom=6)
            const todayD = new Date();
            const dowOffset = (todayD.getDay() + 6) % 7;
            const weekDates = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(todayD);
              d.setDate(todayD.getDate() - dowOffset + i);
              return localDateStr(d);
            });

            const { thisWeekByDate, lastWeekByDate, loading } = progressStats;

            const totalDone       = Object.values(thisWeekByDate).reduce((a, b) => a + b, 0);
            const daysCompleted   = Object.keys(thisWeekByDate).length;
            const daysPlanned     = squad.weeklyPlan.filter(d => d.exercises.length > 0).length;
            const consistency     = daysPlanned > 0 ? Math.round((daysCompleted / daysPlanned) * 100) : 0;

            const lastDaysComp    = Object.keys(lastWeekByDate).length;
            const lastConsistency = daysPlanned > 0 ? Math.round((lastDaysComp / daysPlanned) * 100) : 0;
            const consistencyDiff = consistency - lastConsistency;

            // Máximo de exercícios num único dia (para escala das barras)
            const maxCompleted = Math.max(1, ...weekDates.map(d => thisWeekByDate[d] ?? 0));

            const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

            return (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                  <StatCard
                    title="Total de Exercícios"
                    value={loading ? '—' : String(totalDone)}
                    subtitle="Esta semana"
                    icon={<Dumbbell className="text-emerald-500" />}
                  />
                  <StatCard
                    title="Dias Concluídos"
                    value={loading ? '—' : `${daysCompleted}/7`}
                    subtitle="Meta semanal"
                    icon={<CheckCircle2 className="text-blue-500" />}
                  />
                  <StatCard
                    title="Consistência"
                    value={loading ? '—' : `${consistency}%`}
                    subtitle={
                      loading ? '' :
                      consistencyDiff === 0 ? 'Igual à semana passada' :
                      `${consistencyDiff > 0 ? '+' : ''}${consistencyDiff}% que semana passada`
                    }
                    icon={<TrendingUp className="text-purple-500" />}
                  />
                </div>

                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-4 md:p-8">
                  <h3 className="text-base md:text-xl font-bold mb-4 md:mb-6">Histórico de Atividade</h3>
                  {loading ? (
                    <div className="h-44 md:h-64 flex items-center justify-center text-sm text-[#616161]">Carregando...</div>
                  ) : (
                    <div className="h-44 md:h-64 flex items-end justify-between gap-1.5 md:gap-2">
                      {weekDates.map((dateKey, i) => {
                        const completed = thisWeekByDate[dateKey] ?? 0;
                        const pct = Math.round((completed / maxCompleted) * 100);
                        const isToday = dateKey === localDateStr(todayD);
                        return (
                          <div key={dateKey} className="flex-1 flex flex-col items-center gap-3">
                            <div className="w-full bg-[#1a1a1a] rounded-t-lg relative group" style={{ height: '100%' }}>
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: pct > 0 ? `${pct}%` : completed === 0 ? '2px' : `${pct}%` }}
                                className={`w-full rounded-t-lg transition-all group-hover:opacity-80 ${isToday ? 'bg-emerald-500/30 border-t-2 border-emerald-400' : 'bg-emerald-500/15 border-t-2 border-emerald-600'}`}
                              />
                              {completed > 0 && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  {completed} ex
                                </div>
                              )}
                            </div>
                            <span className={`text-xs font-medium ${isToday ? 'text-emerald-400' : 'text-zinc-500'}`}>
                              {dayLabels[i]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Breakdown por dia */}
                <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1F1F1F]">
                    <p className="text-xs text-[#616161] uppercase tracking-widest font-medium">Dias desta semana</p>
                  </div>
                  <div className="divide-y divide-[#1a1a1a]">
                    {weekDates.map((dateKey, i) => {
                      const day = squad.weeklyPlan[i];
                      const completed = thisWeekByDate[dateKey] ?? 0;
                      const planned   = day?.exercises.length ?? 0;
                      const isToday   = i === todayIndex;
                      const isDone    = planned > 0 && completed >= planned;
                      const dayName   = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][i];
                      return (
                        <div key={dateKey} className={`px-5 py-3.5 flex items-center gap-4 ${isToday ? 'bg-[#161616]' : ''}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isDone ? 'bg-emerald-500' : completed > 0 ? 'bg-emerald-500/30' : 'bg-[#1a1a1a]'
                          }`}>
                            {isDone && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isToday ? 'text-[#E8E8E8]' : 'text-[#616161]'}`}>
                              {dayName} {isToday && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded ml-1">Hoje</span>}
                            </p>
                            {day?.focus && <p className="text-xs text-[#3a3a3a] mt-0.5">{day.focus}</p>}
                          </div>
                          <span className="text-xs text-[#616161] tabular-nums shrink-0">
                            {planned > 0 ? `${completed}/${planned}` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Evolução de Cargas ── */}
                <LoadTracker
                  trackedExercises={trackedExercises}
                  loadHistory={loadHistory}
                  loadInputs={loadInputs}
                  savedLoadIds={savedLoadIds}
                  loading={loadsLoading}
                  onSetInput={(id, val) => setLoadInputs(prev => ({ ...prev, [id]: val }))}
                  onSave={saveLoad}
                  onDelete={deleteTrackedExercise}
                  onDeleteEntry={deleteLoad}
                  onCreate={createTrackedExercise}
                />
              </div>
            );
          })()}

          {currentView === 'settings' && (
            <Settings
              session={session}
              squad={squad}
              onSquadUpdate={(name, icon) => setSquad(prev => ({ ...prev, name, icon }))}
              onLeaveSquad={() => setSquadId(null)}
              onSquadJoined={refreshSquad}
              onProfileUpdate={(name, avatarUrl) => setSquad(prev => ({
                ...prev,
                members: prev.members.map(m =>
                  m.id === session.user.id
                    ? { ...m, name: name || m.name, avatar: avatarUrl || m.avatar }
                    : m
                ),
              }))}
            />
          )}
        </div>
      </main>

      {/* Bottom Nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#1F1F1F] flex items-center justify-around px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)', paddingTop: 8 }}>
        <MobileNavItem icon={<LayoutDashboard size={21} />} label="Hoje"   active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <MobileNavItem icon={<Calendar size={21} />}        label="Semana" active={currentView === 'week'}      onClick={() => setCurrentView('week')} />
        <MobileNavItem icon={<Users size={21} />}           label="Equipe" active={currentView === 'squad'}     onClick={() => setCurrentView('squad')} />
        <MobileNavItem icon={<TrendingUp size={21} />}      label="Stats"  active={currentView === 'progress'}  onClick={() => setCurrentView('progress')} />
        <MobileNavItem icon={<SettingsIcon size={21} />}    label="Config" active={currentView === 'settings'}  onClick={() => setCurrentView('settings')} />
      </nav>

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
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rest Timer Overlay */}
      <AnimatePresence>
        {restTimer && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-[#111111] border border-[#1F1F1F] rounded-2xl px-5 py-3.5 flex items-center gap-4 shadow-2xl min-w-[220px]">
              <div className="flex-1">
                <p className="text-[10px] text-[#616161] uppercase tracking-widest font-medium mb-0.5">Descanso</p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold tabular-nums ${restTimer.remaining <= 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {String(Math.floor(restTimer.remaining / 60)).padStart(2, '0')}:{String(restTimer.remaining % 60).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-[#3a3a3a]">/ {String(Math.floor(restTimer.total / 60)).padStart(2, '0')}:{String(restTimer.total % 60).padStart(2, '0')}</span>
                </div>
                <div className="w-full bg-[#1a1a1a] h-1 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${restTimer.remaining <= 5 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                    style={{ width: `${(restTimer.remaining / restTimer.total) * 100}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => setRestTimer(null)}
                className="px-3 py-2 text-xs text-[#616161] hover:text-[#E8E8E8] bg-[#1a1a1a] hover:bg-[#222] rounded-lg transition-all font-medium"
              >
                Pular
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1 px-3 py-1 transition-all relative"
      style={{ color: active ? '#10b981' : '#505050', minWidth: 56 }}>
      {active && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-500" />
      )}
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all
        ${active ? 'bg-[#1a1a1a] text-[#E8E8E8]' : 'text-[#616161] hover:text-[#E8E8E8] hover:bg-[#141414]'}`}>
      <span className={active ? 'text-emerald-400' : ''}>{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function formatRestDisplay(rest: string): string {
  const secs = parseRestSeconds(rest);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function ExerciseItem({
  exercise, setsDone, loadData, onSetToggle, onLoadChange, isPR = false, onEdit, showEdit = true,
}: {
  exercise: Exercise;
  setsDone: boolean[];
  loadData: Array<{ weight: string; reps: string }>;
  onSetToggle: (setIndex: number) => void;
  onLoadChange: (setIndex: number, field: 'weight' | 'reps', val: string) => void;
  isPR?: boolean;
  onEdit?: () => void;
  showEdit?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const doneCount = setsDone.filter(Boolean).length;
  const allDone = doneCount === exercise.sets;
  const displayWeight = loadData.find(l => l.weight)?.weight;

  return (
    <motion.div layout
      className={`rounded-xl border overflow-hidden transition-all ${allDone ? 'border-[#1a1a1a] opacity-50' : isPR ? 'border-amber-500/40' : 'border-[#252525]'}`}
      style={{ background: '#141414' }}>

      {/* Compact row */}
      <div className="flex items-center gap-3 px-3 py-3">

        {/* Icon square */}
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all
          ${isPR ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#1c1c1c] border-[#282828]'}`}>
          {isPR
            ? <span className="text-sm">🏆</span>
            : <Dumbbell size={13} className={allDone ? 'text-[#2a2a2a]' : 'text-[#505050]'} />
          }
        </div>

        {/* Name + meta — tap to expand inputs */}
        <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold leading-tight ${allDone ? 'text-[#2a2a2a] line-through' : 'text-[#E0E0E0]'}`}>
              {exercise.name}
            </p>
            {isPR && (
              <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                PR
              </span>
            )}
          </div>
          <p className="text-[10px] font-medium tracking-wider mt-0.5 flex flex-wrap gap-x-1.5">
            <span className="text-[#404040]">{exercise.sets} SÉRIES</span>
            <span className="text-[#282828]">·</span>
            <span className="text-[#404040]">{exercise.reps} REPS</span>
            {displayWeight && (
              <>
                <span className="text-[#282828]">·</span>
                <span style={{ color: '#c2410c' }}>{displayWeight} KG</span>
              </>
            )}
            <span className="text-[#282828]">·</span>
            <span className="text-[#404040]">DESCANSO {formatRestDisplay(exercise.rest)}</span>
          </p>
        </button>

        {showEdit && onEdit && (
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="text-[#282828] hover:text-[#505050] transition-colors shrink-0 mr-1">
            <Edit3 size={12} />
          </button>
        )}

        {/* Set squares */}
        <div className="flex gap-1 shrink-0">
          {Array.from({ length: exercise.sets }, (_, i) => {
            const done = setsDone[i] ?? false;
            return (
              <button key={i}
                onClick={() => onSetToggle(i)}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all active:scale-90
                  ${done ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-[#2e2e2e] hover:border-[#484848]'}`}>
                {done && <CheckCircle2 size={11} className="text-[#0A0A0A]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable per-set inputs */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-[#1e1e1e]">
            <div className="px-3 py-2.5 space-y-1.5">
              {Array.from({ length: exercise.sets }, (_, i) => {
                const done = setsDone[i] ?? false;
                const load = loadData[i] ?? { weight: '', reps: '' };
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] w-12 shrink-0 ${done ? 'text-[#252525]' : 'text-[#505050]'}`}>
                      Série {i + 1}
                    </span>
                    <input
                      type="number" inputMode="decimal" placeholder="—"
                      value={load.weight}
                      onChange={e => onLoadChange(i, 'weight', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`flex-1 h-7 bg-[#1a1a1a] border border-[#252525] rounded-lg text-center text-xs tabular-nums outline-none focus:border-[#383838] transition-colors min-w-0 ${done ? 'text-[#2a2a2a]' : 'text-[#C0C0C0]'}`}
                    />
                    <span className="text-[9px] text-[#282828] shrink-0">kg ×</span>
                    <input
                      type="number" inputMode="numeric" placeholder={exercise.reps}
                      value={load.reps}
                      onChange={e => onLoadChange(i, 'reps', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`w-12 h-7 bg-[#1a1a1a] border border-[#252525] rounded-lg text-center text-xs tabular-nums outline-none focus:border-[#383838] transition-colors shrink-0 ${done ? 'text-[#2a2a2a]' : 'text-[#C0C0C0]'}`}
                    />
                    <span className="text-[9px] text-[#282828] shrink-0">reps</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── LoadTracker ────────────────────────────────────────────────────────────────
type TrackedExercise = { id: string; name: string };
type LoadEntry       = { id: string; date: string; load_notes: string };

function LoadTracker({
  trackedExercises, loadHistory, loadInputs, savedLoadIds, loading,
  onSetInput, onSave, onDelete, onDeleteEntry, onCreate,
}: {
  trackedExercises: TrackedExercise[];
  loadHistory: Record<string, LoadEntry[]>;
  loadInputs: Record<string, string>;
  savedLoadIds: Set<string>;
  loading: boolean;
  onSetInput: (id: string, val: string) => void;
  onSave: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onDeleteEntry: (exId: string, loadId: string) => void;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding]     = useState(false);
  const [creating, setCreating] = useState(false);

  const commit = async () => {
    const v = newName.trim();
    if (!v) return;
    setCreating(true);
    const ok = await onCreate(v);
    setCreating(false);
    if (ok) { setNewName(''); setAdding(false); }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  };

  // Tendência: compara último e penúltimo registro
  const trend = (history: LoadEntry[]) => {
    if (history.length < 2) return null;
    const last = parseFloat(history[0].load_notes);
    const prev = parseFloat(history[1].load_notes);
    if (isNaN(last) || isNaN(prev)) return null;
    if (last > prev) return '↑';
    if (last < prev) return '↓';
    return '→';
  };

  return (
    <div>
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#E8E8E8]">Evolução de Cargas</h3>
          <p className="text-xs text-[#616161] mt-0.5">Registre sua carga a cada sessão</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs text-white font-medium transition-all shrink-0"
        >
          <Plus size={13} /> Novo exercício
        </button>
      </div>

      {/* Form criar */}
      {adding && (
        <div className="bg-[#111111] border border-emerald-500/30 rounded-xl p-4 mb-4 flex gap-2 items-center">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setNewName(''); setAdding(false); } }}
            placeholder="Nome do exercício — ex: Supino"
            className="flex-1 bg-[#0A0A0A] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-[#E8E8E8] placeholder-[#3a3a3a] outline-none focus:border-emerald-500/50 transition-colors"
          />
          <button onClick={commit} disabled={creating}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded-lg text-xs text-white font-semibold min-w-[64px] transition-all">
            {creating ? '...' : 'Criar'}
          </button>
          <button onClick={() => { setNewName(''); setAdding(false); }}
            className="px-3 py-2.5 bg-transparent border border-[#1F1F1F] rounded-lg text-xs text-[#616161] hover:text-[#E8E8E8] transition-colors">
            Cancelar
          </button>
        </div>
      )}

      {loading && (
        <div className="py-10 text-sm text-[#616161] text-center">Carregando...</div>
      )}

      {!loading && trackedExercises.length === 0 && !adding && (
        <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl py-12 flex flex-col items-center gap-3 text-[#3a3a3a]">
          <Dumbbell size={32} />
          <p className="text-sm text-[#616161]">Nenhum exercício cadastrado.</p>
          <button onClick={() => setAdding(true)} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            + Adicionar primeiro exercício
          </button>
        </div>
      )}

      {/* Grid de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trackedExercises.map(ex => {
          const history  = loadHistory[ex.id] ?? [];
          const inputVal = loadInputs[ex.id] ?? '';
          const isSaved  = savedLoadIds.has(ex.id);
          const t        = trend(history);
          const latest   = history[0];

          return (
            <div key={ex.id} className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-5 flex flex-col gap-4 hover:border-[#2a2a2a] transition-colors">

              {/* Cabeçalho do card */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-[#E8E8E8] capitalize leading-tight">{ex.name}</p>
                  {latest && (
                    <p className="text-xs text-[#616161] mt-0.5">
                      Último: <span className="text-emerald-400 font-medium">{latest.load_notes}</span>
                      <span className="text-[#3a3a3a]"> · {formatDate(latest.date)}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t && (
                    <span className={`text-sm font-bold leading-none ${t === '↑' ? 'text-emerald-400' : t === '↓' ? 'text-red-400' : 'text-[#616161]'}`}>
                      {t}
                    </span>
                  )}
                  <button
                    onClick={() => { if (confirm(`Excluir "${ex.name}" e todo o histórico?`)) onDelete(ex.id); }}
                    className="text-[#2a2a2a] hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Input novo registro */}
              <div className="flex gap-2">
                <input
                  value={inputVal}
                  onChange={e => onSetInput(ex.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onSave(ex.id, inputVal); }}
                  placeholder="Ex: 14kg · 3×10"
                  className="flex-1 bg-[#0A0A0A] border border-[#1F1F1F] focus:border-emerald-500/40 rounded-lg px-3 py-2 text-sm text-[#E8E8E8] placeholder-[#2a2a2a] outline-none transition-colors"
                />
                <button
                  onClick={() => onSave(ex.id, inputVal)}
                  disabled={!inputVal.trim()}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all disabled:opacity-30 ${
                    isSaved
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#1a1a1a] text-[#9a9a9a] border border-[#2a2a2a] hover:text-white hover:bg-[#222] hover:border-[#3a3a3a]'
                  }`}
                >
                  {isSaved ? '✓' : 'Salvar'}
                </button>
              </div>

              {/* Histórico em chips */}
              {history.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#3a3a3a] uppercase tracking-widest mb-2">Histórico</p>
                  <div className="flex flex-col gap-1.5">
                    {history.slice(0, 5).map((entry, idx) => {
                      const prevEntry  = history[idx + 1];
                      const curr = parseFloat(entry.load_notes);
                      const prev = prevEntry ? parseFloat(prevEntry.load_notes) : NaN;
                      const hasDiff = !isNaN(curr) && !isNaN(prev) && curr !== prev;

                      return (
                        <div key={entry.id} className="flex items-center gap-3 group">
                          <span className="text-[11px] text-[#3a3a3a] w-9 shrink-0 tabular-nums">{formatDate(entry.date)}</span>
                          <span className={`text-sm flex-1 ${idx === 0 ? 'text-[#E8E8E8] font-semibold' : 'text-[#616161]'}`}>
                            {entry.load_notes}
                          </span>
                          {hasDiff && (
                            <span className={`text-[11px] font-medium shrink-0 ${curr > prev ? 'text-emerald-400' : 'text-red-400'}`}>
                              {curr > prev ? '+' : ''}{(curr - prev).toFixed(1)}kg
                            </span>
                          )}
                          <button
                            onClick={() => onDeleteEntry(ex.id, entry.id)}
                            className="opacity-0 group-hover:opacity-100 text-[#2a2a2a] hover:text-red-400 transition-all shrink-0"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string, value: string, subtitle: string, icon: ReactNode }) {
  return (
    <div className="bg-[#111111] border border-[#1F1F1F] p-4 md:p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-3 md:mb-4 text-[#616161]">
        {icon}
        <p className="text-[10px] md:text-xs font-medium uppercase tracking-widest truncate">{title}</p>
      </div>
      <h4 className="text-2xl md:text-3xl font-bold text-[#E8E8E8] mb-1 tabular-nums">{value}</h4>
      <p className="text-[10px] md:text-xs text-[#616161] leading-tight">{subtitle}</p>
    </div>
  );
}
