import {
  createContext, useContext, useMemo, useReducer,
  useEffect, useState, useCallback, type ReactNode,
} from 'react';
import { format } from 'date-fns';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type {
  Task, TaskState, TaskAction, TaskContextValue,
  FilterStatus, TaskFormData, TaskStatus, DeleteRecurringMode,
} from '../types';
import { groupTasksByDate } from '../utils/calendar';

// ─── Mapeamento DB ↔ TS ───────────────────────────────────────────────────────

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    date: row.date as string,
    time: (row.time as string | null) ?? undefined,
    status: row.status as TaskStatus,
    priority: (row.priority as string | null) as Task['priority'] ?? undefined,
    projectId: (row.project_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    recurrence: (row.recurrence as string | null) as Task['recurrence'] ?? undefined,
    recurrenceDays: row.recurrence_days
      ? JSON.parse(row.recurrence_days as string) as number[]
      : undefined,
    recurringGroupId: (row.recurring_group_id as string | null) ?? undefined,
  };
}

function taskToRow(task: Task, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description ?? null,
    date: task.date,
    time: task.time ?? null,
    status: task.status,
    priority: task.priority ?? null,
    project_id: task.projectId ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    recurrence: task.recurrence ?? null,
    recurrence_days: task.recurrenceDays ? JSON.stringify(task.recurrenceDays) : null,
    recurring_group_id: task.recurringGroupId ?? null,
  };
}

// Gera datas para os próximos `maxDays` dias que batem com a recorrência
function generateRecurringDates(
  startDate: string,
  recurrence: 'daily' | 'weekly',
  days: number[],
  maxDays = 365,
): string[] {
  const dates: string[] = [];
  const [y, m, d] = startDate.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + maxDays);
  while (cur <= end) {
    const key = format(cur, 'yyyy-MM-dd');
    if (recurrence === 'daily' || (recurrence === 'weekly' && days.includes(cur.getDay()))) {
      dates.push(key);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'LOAD_TASKS':
      return { ...state, tasks: action.payload };
    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'TOGGLE_STATUS':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload
            ? { ...t, status: t.status === 'pending' ? 'done' : 'pending', updatedAt: new Date().toISOString() }
            : t,
        ),
      };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'SELECT_DATE':
      return { ...state, selectedDate: action.payload };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [state, dispatch] = useReducer(reducer, {
    tasks: [],
    filter: 'all' as FilterStatus,
    selectedDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Carrega tarefas do Supabase ─────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) {
      dispatch({ type: 'LOAD_TASKS', payload: [] });
      return;
    }
    supabase
      .from('tasks')
      .select('id, title, description, date, time, status, priority, project_id, created_at, updated_at, recurrence, recurrence_days, recurring_group_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('[tasks] load error:', error.message); return; }
        dispatch({ type: 'LOAD_TASKS', payload: (data || []).map(rowToTask) });
      });
  }, [session?.user?.id]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const addTask = useCallback((data: TaskFormData) => {
    if (!session?.user?.id) return;
    const now = new Date().toISOString();

    if (data.recurrence && data.date) {
      // Tarefa recorrente: gera uma instância por data
      const groupId = crypto.randomUUID();
      const dates = generateRecurringDates(
        data.date,
        data.recurrence,
        data.recurrenceDays ?? [],
      );
      const tasks: Task[] = dates.map(date => ({
        ...data,
        id: crypto.randomUUID(),
        date,
        recurringGroupId: groupId,
        createdAt: now,
        updatedAt: now,
      }));
      tasks.forEach(t => dispatch({ type: 'ADD_TASK', payload: t }));
      supabase.from('tasks').insert(tasks.map(t => taskToRow(t, session.user.id)))
        .then(({ error }) => { if (error) console.error('[tasks] recurring insert error:', error.message); });
    } else {
      const task: Task = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      dispatch({ type: 'ADD_TASK', payload: task });
      supabase.from('tasks').insert(taskToRow(task, session.user.id))
        .then(({ error }) => { if (error) console.error('[tasks] insert error:', error.message); });
    }
  }, [session?.user?.id]);

  const updateTask = useCallback((task: Task) => {
    if (!session?.user?.id) return;
    const updated = { ...task, updatedAt: new Date().toISOString() };
    dispatch({ type: 'UPDATE_TASK', payload: updated });
    supabase.from('tasks').update({
      title: updated.title,
      description: updated.description ?? null,
      date: updated.date,
      time: updated.time ?? null,
      status: updated.status,
      updated_at: updated.updatedAt,
    }).eq('id', updated.id);
  }, [session?.user?.id]);

  const deleteTask = useCallback((id: string) => {
    if (!session?.user?.id) return;
    dispatch({ type: 'DELETE_TASK', payload: id });
    supabase.from('tasks').delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .then(({ error }) => { if (error) console.error('[tasks] delete error:', error.message); });
  }, [session?.user?.id]);

  const deleteRecurring = useCallback((task: Task, mode: DeleteRecurringMode) => {
    if (!task.recurringGroupId) { deleteTask(task.id); return; }
    const groupId = task.recurringGroupId;

    if (mode === 'only_this') {
      deleteTask(task.id);
    } else if (mode === 'this_and_following') {
      const toRemove = state.tasks
        .filter(t => t.recurringGroupId === groupId && t.date >= task.date)
        .map(t => t.id);
      toRemove.forEach(id => dispatch({ type: 'DELETE_TASK', payload: id }));
      supabase.from('tasks').delete()
        .eq('recurring_group_id', groupId)
        .eq('user_id', session!.user.id)
        .gte('date', task.date)
        .then(({ error }) => { if (error) console.error('[tasks] delete recurring error:', error.message); });
    } else {
      // all
      const toRemove = state.tasks
        .filter(t => t.recurringGroupId === groupId)
        .map(t => t.id);
      toRemove.forEach(id => dispatch({ type: 'DELETE_TASK', payload: id }));
      supabase.from('tasks').delete()
        .eq('recurring_group_id', groupId)
        .eq('user_id', session!.user.id)
        .then(({ error }) => { if (error) console.error('[tasks] delete recurring error:', error.message); });
    }
  }, [state.tasks, deleteTask]);

  const toggleStatus = useCallback((id: string) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus: TaskStatus = task.status === 'pending' ? 'done' : 'pending';
    const updatedAt = new Date().toISOString();
    dispatch({ type: 'TOGGLE_STATUS', payload: id });
    supabase.from('tasks').update({ status: newStatus, updated_at: updatedAt }).eq('id', id);
  }, [state.tasks]);

  const setFilter = useCallback((filter: FilterStatus) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const selectDate = useCallback((date: string | null) => {
    dispatch({ type: 'SELECT_DATE', payload: date });
  }, []);

  // ── Derivados ───────────────────────────────────────────────────────────────

  const tasksGroupedByDate = useMemo(() => groupTasksByDate(state.tasks), [state.tasks]);

  const filteredTasksForSelectedDate = useMemo(() => {
    if (!state.selectedDate) return [];
    const dayTasks = tasksGroupedByDate[state.selectedDate] ?? [];
    if (state.filter === 'all') return dayTasks;
    return dayTasks.filter(t => t.status === state.filter);
  }, [tasksGroupedByDate, state.selectedDate, state.filter]);

  return (
    <TaskContext.Provider value={{
      state, session, authLoading,
      filteredTasksForSelectedDate, tasksGroupedByDate,
      addTask, updateTask, deleteTask, deleteRecurring, toggleStatus, setFilter, selectDate,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTaskContext deve ser usado dentro de TaskProvider');
  return ctx;
}
