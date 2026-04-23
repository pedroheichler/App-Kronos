import { useState } from 'react';
import { Check, Pencil, Trash2, Clock, Repeat2, ChevronsRight } from 'lucide-react';
import { format, addDays } from 'date-fns';
import type { Task, DeleteRecurringMode } from '../../types';
import { useTaskContext } from '../../context/TaskContext';

const PRIORITY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#3b82f6',
};

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  variant?: 'card' | 'row';
}

const DELETE_OPTIONS: { mode: DeleteRecurringMode; label: string }[] = [
  { mode: 'only_this',          label: 'Somente esta' },
  { mode: 'this_and_following', label: 'Esta e as seguintes' },
  { mode: 'all',                label: 'Todas' },
];

export function TaskItem({ task, onToggle, onEdit, onDelete, variant = 'row' }: TaskItemProps) {
  const { deleteRecurring, updateTask } = useTaskContext();
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [postponed, setPostponed] = useState(false);

  const handlePostpone = () => {
    const nextDay = format(addDays(new Date(task.date + 'T12:00:00'), 1), 'yyyy-MM-dd');
    updateTask({ ...task, date: nextDay });
    setPostponed(true);
    setTimeout(() => setPostponed(false), 1500);
  };
  const isDone      = task.status === 'done';
  const isRecurring = !!task.recurringGroupId;
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : null;

  const wrapperClass = variant === 'card'
    ? 'group flex items-start gap-3 p-3 rounded-xl bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2a2a2a] transition-colors'
    : 'group flex items-center gap-3 py-2 px-1 border-b border-[#111111] hover:bg-[#111111] transition-colors rounded-lg';

  const handleDeleteClick = () => {
    if (isRecurring) setShowDeleteMenu(true);
    else             onDelete(task.id);
  };

  return (
    <div
      className={`${wrapperClass} relative`}
      style={priorityColor && !isDone ? { borderLeft: `2px solid ${priorityColor}`, paddingLeft: variant === 'row' ? 6 : undefined } : undefined}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        aria-label={isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
        className={[
          'w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer',
          isDone ? 'bg-green-400 border-green-400' : 'border-[#3a3a3a] hover:border-[#8b5cf6]',
        ].join(' ')}
        style={priorityColor && !isDone ? { borderColor: priorityColor } : undefined}
      >
        {isDone && <Check size={10} strokeWidth={3} className="text-black" />}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm truncate leading-5 ${isDone ? 'line-through text-[#3a3a3a]' : 'text-[#E8E8E8]'}`}>
            {task.title}
          </p>
          {isRecurring && (
            <Repeat2 size={11} className="flex-shrink-0 text-[#3a3a3a]" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.time && (
            <span className="flex items-center gap-1 text-xs text-[#8b5cf6]">
              <Clock size={10} />
              {task.time}
            </span>
          )}
          {task.description && (
            <p className="text-xs text-[#616161] truncate">{task.description}</p>
          )}
        </div>
      </div>

      {/* Ações */}
      {!showDeleteMenu && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex-shrink-0">
          {!isDone && (
            <button
              onClick={handlePostpone}
              aria-label="Adiar para amanhã"
              title="Adiar para amanhã"
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: postponed ? '#8b5cf6' : '#616161' }}
            >
              <ChevronsRight size={12} />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            aria-label="Editar tarefa"
            className="p-1.5 text-[#616161] hover:text-[#E8E8E8] hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDeleteClick}
            aria-label="Deletar tarefa"
            className="p-1.5 text-[#616161] hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Menu de exclusão para tarefas recorrentes */}
      {showDeleteMenu && (
        <div
          className="absolute right-0 top-0 z-20 flex flex-wrap items-center gap-1 bg-[#161616] border border-[#1F1F1F] rounded-xl px-2 py-1.5 shadow-xl"
          style={{ maxWidth: 'calc(100vw - 32px)' }}
        >
          <span className="text-xs text-[#616161] mr-1 flex-shrink-0">Apagar:</span>
          {DELETE_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => { deleteRecurring(task, mode); setShowDeleteMenu(false); }}
              className="text-xs px-2 py-1 rounded-lg border border-[#2a2a2a] text-[#9a9a9a] hover:border-red-400/50 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowDeleteMenu(false)}
            className="text-xs px-2 py-1 text-[#3a3a3a] hover:text-[#616161] cursor-pointer flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
