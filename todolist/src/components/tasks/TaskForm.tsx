import { useState, useEffect, type FormEvent } from 'react';
import { Flame } from 'lucide-react';
import type { Task, TaskFormData, Recurrence, Priority } from '../../types';
import { Button } from '../ui/Button';
import { supabase } from '../../services/supabase';
import { useTaskContext } from '../../context/TaskContext';
import { useProjectsContext } from '../../context/ProjectsContext';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high',   label: 'Alta',   color: '#ef4444' },
  { value: 'medium', label: 'Média',  color: '#f59e0b' },
  { value: 'low',    label: 'Baixa',  color: '#3b82f6' },
];

interface TaskFormProps {
  initialDate?: string;
  taskToEdit?: Task | null;
  onSubmit: (data: TaskFormData) => void;
  onClose: () => void;
  hideDate?: boolean;
}

const inputClass = 'w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg px-3 py-2.5 text-sm text-[#E8E8E8] placeholder-[#2a2a2a] outline-none focus:border-[#8b5cf6]/50 transition-colors';

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DAY_NAMES  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function TaskForm({ initialDate, taskToEdit, onSubmit, onClose, hideDate = false }: TaskFormProps) {
  const { session } = useTaskContext();
  const { projects } = useProjectsContext();
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState(initialDate ?? '');
  const [time, setTime]               = useState('');
  const [priority, setPriority]       = useState<Priority | undefined>(undefined);
  const [projectId, setProjectId]     = useState<string | undefined>(undefined);
  const [recurrence, setRecurrence]   = useState<Recurrence | 'none'>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [makeHabit, setMakeHabit]     = useState(false);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description ?? '');
      setDate(taskToEdit.date);
      setTime(taskToEdit.time ?? '');
      setPriority(taskToEdit.priority);
      setProjectId(taskToEdit.projectId);
      setRecurrence(taskToEdit.recurrence ?? 'none');
      setRecurrenceDays(taskToEdit.recurrenceDays ?? []);
    } else {
      setTitle('');
      setDescription('');
      setDate(initialDate ?? '');
      setTime('');
      setPriority(undefined);
      setProjectId(undefined);
      setRecurrence('none');
      setRecurrenceDays([]);
      setMakeHabit(false);
    }
  }, [taskToEdit, initialDate]);

  const toggleDay = (day: number) => {
    setRecurrenceDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    if (!hideDate && !date) return;
    if (recurrence === 'weekly' && recurrenceDays.length === 0) return;

    onSubmit({
      title: trimmedTitle,
      description: description.trim() || undefined,
      date: hideDate ? '' : date,
      time: time || undefined,
      status: taskToEdit?.status ?? 'pending',
      priority,
      projectId,
      recurrence: recurrence === 'none' ? undefined : recurrence,
      recurrenceDays: recurrence === 'weekly' ? recurrenceDays : undefined,
    });

    if (makeHabit && !taskToEdit && session?.user?.id) {
      await supabase.from('habits').insert({
        id: crypto.randomUUID(),
        user_id: session.user.id,
        name: trimmedTitle,
        color: '#8b5cf6',
        frequency: 'daily',
        frequency_days: null,
      });
    }
  };

  const isValid =
    title.trim().length > 0 &&
    (hideDate || date.length > 0) &&
    (recurrence !== 'weekly' || recurrenceDays.length > 0);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-[#616161] mb-1.5">
          Título <span className="text-red-400">*</span>
        </label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="O que precisa ser feito?"
          maxLength={200}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#616161] mb-1.5">
          Descrição
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Detalhes opcionais..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {!hideDate && (
        <>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#616161] mb-1.5">
                Data <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
            <div style={{ width: 120 }}>
              <label className="block text-xs font-medium text-[#616161] mb-1.5">
                Horário
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>

          {/* Recorrência — só para tarefas novas (não ao editar) */}
          {!taskToEdit && (
            <div>
              <label className="block text-xs font-medium text-[#616161] mb-2">
                Repetir
              </label>
              <div className="flex gap-1.5">
                {(['none', 'daily', 'weekly'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRecurrence(r)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      background: recurrence === r ? 'rgba(139,92,246,0.15)' : 'transparent',
                      borderColor: recurrence === r ? '#8b5cf6' : '#1F1F1F',
                      color: recurrence === r ? '#8b5cf6' : '#616161',
                    }}
                  >
                    {r === 'none' ? 'Não repete' : r === 'daily' ? 'Todo dia' : 'Dias da semana'}
                  </button>
                ))}
              </div>

              {recurrence === 'weekly' && (
                <div className="flex gap-1.5 mt-2.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      title={DAY_NAMES[i]}
                      className="w-8 h-8 rounded-full text-xs font-medium border transition-colors cursor-pointer flex-shrink-0"
                      style={{
                        background: recurrenceDays.includes(i) ? '#8b5cf6' : 'transparent',
                        borderColor: recurrenceDays.includes(i) ? '#8b5cf6' : '#1F1F1F',
                        color: recurrenceDays.includes(i) ? '#fff' : '#616161',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Prioridade */}
      <div>
        <label className="block text-xs font-medium text-[#616161] mb-2">Prioridade</label>
        <div className="flex gap-1.5">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(prev => prev === p.value ? undefined : p.value)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{
                background: priority === p.value ? `${p.color}18` : 'transparent',
                borderColor: priority === p.value ? p.color : '#1F1F1F',
                color: priority === p.value ? p.color : '#616161',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: priority === p.value ? p.color : '#3a3a3a' }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projeto */}
      {projects.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#616161] mb-2">Projeto</label>
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setProjectId(undefined)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{
                background: !projectId ? 'rgba(139,92,246,0.1)' : 'transparent',
                borderColor: !projectId ? '#8b5cf6' : '#1F1F1F',
                color: !projectId ? '#8b5cf6' : '#616161',
              }}
            >
              Nenhum
            </button>
            {projects.map(proj => (
              <button
                key={proj.id}
                type="button"
                onClick={() => setProjectId(prev => prev === proj.id ? undefined : proj.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
                style={{
                  background: projectId === proj.id ? `${proj.color}18` : 'transparent',
                  borderColor: projectId === proj.id ? proj.color : '#1F1F1F',
                  color: projectId === proj.id ? proj.color : '#616161',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: proj.color }} />
                {proj.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tornar hábito — só para tarefas novas */}
      {!taskToEdit && (
        <button
          type="button"
          onClick={() => setMakeHabit(m => !m)}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border transition-colors text-left"
          style={{
            background: makeHabit ? 'rgba(139,92,246,0.08)' : 'transparent',
            borderColor: makeHabit ? '#8b5cf6' : '#1F1F1F',
          }}
        >
          <div
            className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: makeHabit ? '#8b5cf6' : 'transparent',
              borderColor: makeHabit ? '#8b5cf6' : '#3a3a3a',
            }}
          >
            {makeHabit && <Flame size={9} color="#fff" />}
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: makeHabit ? '#8b5cf6' : '#9a9a9a' }}>
              Tornar hábito
            </p>
            <p className="text-xs" style={{ color: '#3a3a3a' }}>
              Adiciona também na aba Hábitos para acompanhar
            </p>
          </div>
        </button>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {taskToEdit ? 'Salvar alterações' : recurrence !== 'none' ? 'Criar recorrente' : 'Criar tarefa'}
        </Button>
      </div>
    </form>
  );
}
