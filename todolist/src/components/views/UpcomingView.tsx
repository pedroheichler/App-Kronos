import { useState, useRef, useMemo } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useIsMobile } from '../../hooks/useIsMobile';
import { parseDateKey } from '../../utils/calendar';
import { TaskItem } from '../tasks/TaskItem';
import { TaskForm } from '../tasks/TaskForm';
import { Modal } from '../ui/Modal';
import { AddTaskRow } from './TodayView';
import type { Task, TaskFormData } from '../../types';

const UPCOMING_DAYS = 30;

export function UpcomingView() {
  const isMobile = useIsMobile();
  const { filter, tasksGroupedByDate, addTask, updateTask, deleteTask, toggleStatus } = useTasks();

  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm]     = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formDate, setFormDate]     = useState('');

  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const today    = parseDateKey(todayKey);

  // Faixa semanal: domingo–sábado da semana atual + offset
  const weekStart = addDays(
    startOfWeek(new Date(), { weekStartsOn: 0 }),
    weekOffset * 7,
  );
  const stripDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Mês exibido na faixa (pode mudar com offset)
  const stripMonthLabel = useMemo(() => {
    const label = format(stripDays[0], 'MMMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [weekOffset]); // eslint-disable-line

  // Dias futuros para a lista (hoje + UPCOMING_DAYS)
  const upcomingDates = useMemo(
    () => Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i)),
    [todayKey], // eslint-disable-line
  );

  const openAddForDay = (dateKey: string) => {
    setFormDate(dateKey); setEditingTask(null); setShowForm(true);
  };
  const openEdit = (task: Task) => {
    setEditingTask(task); setFormDate(task.date); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingTask(null); };
  const handleSubmit = (data: TaskFormData) => {
    if (editingTask) updateTask({ ...editingTask, ...data });
    else             addTask(data);
    closeForm();
  };

  const scrollToDay = (dateKey: string) => {
    dayRefs.current[dateKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Botão de nav da faixa
  const navBtn = (onClick: () => void, children: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 8,
        background: 'transparent', border: 'none',
        color: '#616161', cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#161616'; (e.currentTarget as HTMLButtonElement).style.color = '#E8E8E8'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#616161'; }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Cabeçalho sticky ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0A0A0A', borderBottom: '1px solid #1F1F1F',
        padding: isMobile ? '16px 16px 0' : '20px 32px 0',
        flexShrink: 0,
      }}>
        {/* Título + navegação de semana */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8E8E8', margin: 0, flex: 1 }}>
            Em breve
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#616161', marginRight: 4, textTransform: 'capitalize' }}>
              {stripMonthLabel}
            </span>
            {navBtn(() => setWeekOffset(w => w - 1), <ChevronLeft size={15} />, 'Semana anterior')}
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 12,
                background: 'transparent', border: '1px solid #1F1F1F',
                color: '#9a9a9a', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1F1F1F')}
            >
              Hoje
            </button>
            {navBtn(() => setWeekOffset(w => w + 1), <ChevronRight size={15} />, 'Próxima semana')}
          </div>
        </div>

        {/* Faixa de 7 dias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 1 }}>
          {stripDays.map(day => {
            const dayKey    = format(day, 'yyyy-MM-dd');
            const isToday   = isSameDay(day, today);
            const isPast    = day < today && !isToday;
            const taskCount = (tasksGroupedByDate[dayKey] ?? []).length;
            const shortName = format(day, 'EEE', { locale: ptBR });

            return (
              <button
                key={dayKey}
                onClick={() => !isPast && scrollToDay(dayKey)}
                title={format(day, 'dd/MM/yyyy')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '8px 4px 10px', borderRadius: '8px 8px 0 0',
                  background: isToday ? 'rgba(139,92,246,0.07)' : 'transparent',
                  border: 'none',
                  borderBottom: isToday ? '2px solid #8b5cf6' : '2px solid transparent',
                  cursor: isPast ? 'default' : 'pointer',
                  opacity: isPast ? 0.35 : 1,
                  gap: 4, transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isPast && !isToday) (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
                onMouseLeave={e => { if (!isToday) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 10, color: '#616161', textTransform: 'capitalize', fontWeight: 500 }}>
                  {shortName}
                </span>
                <span style={{
                  fontSize: 15, fontWeight: 600,
                  color: isToday ? '#8b5cf6' : '#E8E8E8',
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? 'rgba(139,92,246,0.15)' : 'transparent',
                }}>
                  {day.getDate()}
                </span>
                {taskCount > 0 && (
                  <span style={{ fontSize: 10, color: isToday ? '#8b5cf6' : '#616161' }}>
                    {taskCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista de dias scrollável ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px' : '0 32px' }}>
        {upcomingDates.map(day => {
          const dateKey    = format(day, 'yyyy-MM-dd');
          const isToday    = isSameDay(day, today);
          const isTomorrow = isSameDay(day, addDays(today, 1));
          const allTasks   = tasksGroupedByDate[dateKey] ?? [];
          const displayTasks = filter === 'all' ? allTasks : allTasks.filter(t => t.status === filter);

          const dayNumStr  = format(day, "d 'de' MMM", { locale: ptBR });
          const qualifier  = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : null;
          const weekDayStr = format(day, 'EEEE', { locale: ptBR });

          return (
            <div
              key={dateKey}
              ref={el => { dayRefs.current[dateKey] = el; }}
              style={{ paddingTop: 28 }}
            >
              {/* Cabeçalho do dia */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                paddingBottom: 10, marginBottom: 4,
                borderBottom: '1px solid #1a1a1a',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#E8E8E8', textTransform: 'capitalize' }}>
                  {dayNumStr}
                </span>
                {qualifier && (
                  <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 500 }}>
                    · {qualifier}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#3a3a3a', textTransform: 'capitalize' }}>
                  · {weekDayStr}
                </span>
              </div>

              {/* Tarefas do dia */}
              {displayTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={toggleStatus}
                  onEdit={openEdit}
                  onDelete={deleteTask}
                />
              ))}

              {/* Adicionar tarefa neste dia */}
              <AddTaskRow onClick={() => openAddForDay(dateKey)} />
            </div>
          );
        })}
        <div style={{ height: 48 }} />
      </div>

      <Modal isOpen={showForm} onClose={closeForm} title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}>
        <TaskForm
          initialDate={formDate}
          taskToEdit={editingTask}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      </Modal>
    </div>
  );
}
