import type { FilterStatus } from '../../types';

interface FilterBarProps {
  filter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  counts: { all: number; pending: number; done: number };
}

const OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all',     label: 'Todas'     },
  { value: 'pending', label: 'Pendentes' },
  { value: 'done',    label: 'Concluídas'},
];

export function FilterBar({ filter, onFilterChange, counts }: FilterBarProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Filtrar tarefas">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onFilterChange(opt.value)}
          aria-pressed={filter === opt.value}
          className={[
            'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            filter === opt.value
              ? 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30'
              : 'text-[#616161] hover:text-[#E8E8E8] hover:bg-[#161616]',
          ].join(' ')}
        >
          {opt.label}
          <span className={`ml-1 text-[10px] tabular-nums ${filter === opt.value ? 'text-[#8b5cf6]/60' : 'text-[#2a2a2a]'}`}>
            {counts[opt.value]}
          </span>
        </button>
      ))}
    </div>
  );
}
