import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface CalendarHeaderProps {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarHeader({ monthLabel, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-[#E8E8E8]">{monthLabel}</h2>

      <div className="flex items-center gap-1">
        <button
          onClick={onToday}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#616161] hover:text-[#E8E8E8] hover:bg-[#161616] rounded-lg transition-colors cursor-pointer"
          title="Ir para hoje"
        >
          <CalendarDays size={12} />
          Hoje
        </button>
        <button
          onClick={onPrev}
          className="p-1.5 text-[#616161] hover:text-[#E8E8E8] hover:bg-[#161616] rounded-lg transition-colors cursor-pointer"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          onClick={onNext}
          className="p-1.5 text-[#616161] hover:text-[#E8E8E8] hover:bg-[#161616] rounded-lg transition-colors cursor-pointer"
          aria-label="Próximo mês"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
