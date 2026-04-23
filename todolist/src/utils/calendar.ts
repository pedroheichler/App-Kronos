import {
  startOfMonth,
  startOfWeek,
  addDays,
  eachDayOfInterval,
  format,
  isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarGrid, CalendarDayData, CalendarWeek, Task } from '../types';

/**
 * Converte "YYYY-MM-DD" para Date local sem bug de timezone.
 * new Date("2026-04-15") cria 2026-04-14T21:00:00 em UTC-3.
 * Esta função força interpretação local: new Date(2026, 3, 15).
 */
export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function sortByTime(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;  // com horário vem primeiro
  if (b.time) return 1;
  return a.createdAt.localeCompare(b.createdAt); // sem horário: ordem de criação
}

export function groupTasksByDate(tasks: Task[]): Record<string, Task[]> {
  const groups = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!acc[task.date]) acc[task.date] = [];
    acc[task.date].push(task);
    return acc;
  }, {});
  for (const key of Object.keys(groups)) {
    groups[key].sort(sortByTime);
  }
  return groups;
}

export function getWeekDayLabels(): string[] {
  // Gerado dinamicamente para não desalinhar com weekStartsOn: 1
  return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
}

export function buildCalendarGrid(
  year: number,
  month: number,
  tasks: Task[],
  selectedDateKey: string | null,
): CalendarGrid {
  const reference = new Date(year, month, 1);

  // Grid fixo de 42 células (6 semanas × 7 dias) começando na segunda-feira
  const gridStart = startOfWeek(startOfMonth(reference), { weekStartsOn: 1 });
  const gridEnd = addDays(gridStart, 41);
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Sempre agrupa TODAS as tarefas — o filtro de status só afeta a TaskList lateral,
  // nunca os dots do calendário (filtrar dots confundiria dias que "sumiram" tarefas)
  const grouped = groupTasksByDate(tasks);
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const calendarDays: CalendarDayData[] = allDays.map(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayTasks = grouped[dateKey] ?? [];

    return {
      date,
      dateKey,
      isCurrentMonth: isSameMonth(date, reference),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      tasks: dayTasks,
      pendingCount: dayTasks.filter(t => t.status === 'pending').length,
      doneCount: dayTasks.filter(t => t.status === 'done').length,
    };
  });

  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push({ days: calendarDays.slice(i, i + 7) });
  }

  const rawLabel = format(reference, 'MMMM yyyy', { locale: ptBR });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return { weeks, monthLabel, year, month };
}
