import type { Session } from '@supabase/supabase-js';

// ─── Domínio ──────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'done';
export type FilterStatus = 'all' | 'pending' | 'done';
export type AppView = 'hoje' | 'em-breve' | 'calendario' | 'relatorios' | 'lista' | 'habitos' | 'projeto';
export type Priority = 'high' | 'medium' | 'low';

export type Recurrence = 'daily' | 'weekly';

export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string;           // "YYYY-MM-DD" ou '' para sem data
  time?: string;          // "HH:MM" opcional
  status: TaskStatus;
  priority?: Priority;
  projectId?: string;
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  recurrence?: Recurrence;
  recurrenceDays?: number[]; // 0=Dom … 6=Sab (só para 'weekly')
  recurringGroupId?: string; // UUID que agrupa todas as instâncias
}

export type TaskFormData = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Calendário ───────────────────────────────────────────────────────────────

export interface CalendarDayData {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  tasks: Task[];
  pendingCount: number;
  doneCount: number;
}

export interface CalendarWeek {
  days: CalendarDayData[];
}

export interface CalendarGrid {
  weeks: CalendarWeek[];
  monthLabel: string;
  year: number;
  month: number;
}

// ─── Context State ────────────────────────────────────────────────────────────

export interface TaskState {
  tasks: Task[];
  filter: FilterStatus;
  selectedDate: string | null;
}

export type TaskAction =
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_STATUS'; payload: string }
  | { type: 'SET_FILTER'; payload: FilterStatus }
  | { type: 'SELECT_DATE'; payload: string | null }
  | { type: 'LOAD_TASKS'; payload: Task[] };

export interface CalendarState {
  year: number;
  month: number;
}

export type CalendarAction =
  | { type: 'PREV_MONTH' }
  | { type: 'NEXT_MONTH' }
  | { type: 'GO_TO_TODAY' }
  | { type: 'SET_MONTH'; payload: { year: number; month: number } };

// ─── Hábitos ─────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  name: string;
  color: string;
  frequency: 'daily' | 'weekly';
  frequencyDays?: number[];
  createdAt: string;
}

// ─── Projetos ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

// ─── Boards (Lista view) ──────────────────────────────────────────────────────

export interface Board {
  id: string;
  name: string;
  color: string;
}

export interface BoardItem {
  id: string;
  boardId: string;
  title: string;
  completed: boolean;
}

// ─── Context Values ───────────────────────────────────────────────────────────

export type DeleteRecurringMode = 'only_this' | 'this_and_following' | 'all';

export interface TaskContextValue {
  state: TaskState;
  session: Session | null;
  authLoading: boolean;
  filteredTasksForSelectedDate: Task[];
  tasksGroupedByDate: Record<string, Task[]>;
  addTask: (data: TaskFormData) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  deleteRecurring: (task: Task, mode: DeleteRecurringMode) => void;
  toggleStatus: (id: string) => void;
  setFilter: (filter: FilterStatus) => void;
  selectDate: (date: string | null) => void;
}

export interface CalendarContextValue {
  state: CalendarState;
  dispatch: (action: CalendarAction) => void;
  grid: CalendarGrid;
}
