import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarDayData } from '../../types';
import { TaskDot } from './TaskDot';

interface CalendarDayProps {
  day: CalendarDayData;
  onSelect: (dateKey: string) => void;
}

export function CalendarDay({ day, onSelect }: CalendarDayProps) {
  const { dateKey, date, isCurrentMonth, isToday, isSelected, pendingCount, doneCount } = day;

  const baseClass = 'relative flex flex-col items-center justify-start pt-1.5 pb-1 h-12 w-full rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]';

  let stateClass = '';
  if (!isCurrentMonth) {
    stateClass = 'opacity-20 cursor-default pointer-events-none text-[#616161]';
  } else if (isSelected) {
    stateClass = 'bg-[#8b5cf6]/15 border border-[#8b5cf6]/50 text-[#E8E8E8] cursor-pointer';
  } else if (isToday) {
    stateClass = 'border border-[#8b5cf6]/40 text-[#8b5cf6] hover:bg-[#161616] cursor-pointer';
  } else {
    stateClass = 'text-[#E8E8E8] hover:bg-[#161616] cursor-pointer';
  }

  const dayName = format(date, 'EEEE', { locale: ptBR });
  const total = pendingCount + doneCount;
  const taskSummary = total === 0
    ? 'sem tarefas'
    : `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}, ${doneCount} concluída${doneCount !== 1 ? 's' : ''}`;
  const ariaLabel = `${dayName} ${date.getDate()}${isToday ? ', hoje' : ''}, ${taskSummary}`;

  return (
    <button
      onClick={() => isCurrentMonth && onSelect(dateKey)}
      disabled={!isCurrentMonth}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={`${baseClass} ${stateClass}`}
    >
      <span>{date.getDate()}</span>
      <TaskDot pendingCount={pendingCount} doneCount={doneCount} />
    </button>
  );
}
