import type { CalendarGrid as CalendarGridType } from '../../types';
import { getWeekDayLabels } from '../../utils/calendar';
import { CalendarDay } from './CalendarDay';
import { CalendarHeader } from './CalendarHeader';

interface CalendarGridProps {
  grid: CalendarGridType;
  onSelectDay: (dateKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const WEEK_LABELS = getWeekDayLabels();

export function CalendarGrid({ grid, onSelectDay, onPrev, onNext, onToday }: CalendarGridProps) {
  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        monthLabel={grid.monthLabel}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
      />

      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_LABELS.map(label => (
          <div
            key={label}
            className="text-center text-[10px] font-medium text-[#3a3a3a] py-1.5 uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid de semanas */}
      <div className="flex flex-col gap-0.5 flex-1">
        {grid.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.days.map(day => (
              <CalendarDay key={day.dateKey} day={day} onSelect={onSelectDay} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
