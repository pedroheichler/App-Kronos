import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendarContext } from '../../context/CalendarContext';
import { useTasks } from '../../hooks/useTasks';
import { useIsMobile } from '../../hooks/useIsMobile';
import { parseDateKey, getWeekDayLabels } from '../../utils/calendar';
import { TaskItem } from '../tasks/TaskItem';
import { TaskForm } from '../tasks/TaskForm';
import { Modal } from '../ui/Modal';
import type { Task, TaskFormData } from '../../types';

const PRIORITY_DOT: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
};

const navBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #1F1F1F', borderRadius: 8,
  color: '#616161', cursor: 'pointer', padding: '5px 8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export function CalendarView() {
  const isMobile = useIsMobile();
  const { dispatch, grid } = useCalendarContext();
  const { tasksGroupedByDate, addTask, updateTask, deleteTask, toggleStatus, selectDate, selectedDate } = useTasks();

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const selectedTasks = selectedDate ? (tasksGroupedByDate[selectedDate] ?? []) : [];
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekLabels = getWeekDayLabels();

  const handleDayClick = (dateKey: string) => {
    selectDate(selectedDate === dateKey ? null : dateKey);
  };

  const openCreate = () => { setEditingTask(null); setShowForm(true); };
  const openEdit   = (task: Task) => { setEditingTask(task); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditingTask(null); };

  const handleSubmit = (data: TaskFormData) => {
    if (editingTask) updateTask({ ...editingTask, ...data });
    else             addTask(data);
    closeForm();
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '20px 12px' : '36px 32px', flex: 1, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8E8E8', flex: 1, margin: 0 }}>Calendário</h1>
        <button onClick={() => dispatch({ type: 'PREV_MONTH' })} style={navBtnStyle}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#E8E8E8', minWidth: 130, textAlign: 'center' }}>
          {grid.monthLabel}
        </span>
        <button onClick={() => dispatch({ type: 'NEXT_MONTH' })} style={navBtnStyle}>
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => dispatch({ type: 'GO_TO_TODAY' })}
          style={{ ...navBtnStyle, padding: '5px 12px', fontSize: 12 }}
        >
          Hoje
        </button>
      </div>

      {/* Labels dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {weekLabels.map(label => (
          <div key={label} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: '#3a3a3a', paddingBottom: 8,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
        {grid.weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {week.days.map((day, di) => {
              const isSelected = day.dateKey === selectedDate;
              const isToday    = day.dateKey === todayKey;

              return (
                <button
                  key={day.dateKey}
                  onClick={() => handleDayClick(day.dateKey)}
                  style={{
                    border: 'none',
                    borderTop:  wi > 0 ? '1px solid #1a1a1a' : 'none',
                    borderLeft: di > 0 ? '1px solid #1a1a1a' : 'none',
                    padding: isMobile ? '6px 4px' : '8px 8px',
                    background: isSelected ? 'rgba(139,92,246,0.12)' : 'transparent',
                    cursor: 'pointer',
                    minHeight: isMobile ? 48 : 72,
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = '#0f0f0f'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isSelected ? 'rgba(139,92,246,0.12)' : 'transparent'; }}
                >
                  {/* Número do dia */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: isToday ? '#8b5cf6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#fff' : day.isCurrentMonth ? '#C8C8C8' : '#2a2a2a',
                  }}>
                    {day.date.getDate()}
                  </div>

                  {/* Dots de tarefas */}
                  {day.tasks.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 4 }}>
                      {day.tasks.slice(0, 3).map(t => (
                        <div key={t.id} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: t.status === 'done'
                            ? '#2a2a2a'
                            : t.priority ? PRIORITY_DOT[t.priority] : '#8b5cf6',
                        }} />
                      ))}
                      {day.tasks.length > 3 && (
                        <span style={{ fontSize: 8, color: '#616161', lineHeight: '5px' }}>
                          +{day.tasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Painel do dia selecionado */}
      {selectedDate && (
        <div style={{ marginTop: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            paddingBottom: 10, borderBottom: '1px solid #1a1a1a',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E8E8E8', flex: 1, textTransform: 'capitalize' }}>
              {format(parseDateKey(selectedDate), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
            {selectedTasks.length > 0 && (
              <span style={{ fontSize: 11, color: '#616161' }}>
                {selectedTasks.filter(t => t.status === 'pending').length} pendentes
              </span>
            )}
            <button
              onClick={openCreate}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', background: '#8b5cf6',
                border: 'none', borderRadius: 7, color: '#fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={12} /> Tarefa
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#3a3a3a', textAlign: 'center', padding: '24px 0' }}>
              Nenhuma tarefa para este dia.
            </p>
          ) : (
            selectedTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={toggleStatus}
                onEdit={openEdit}
                onDelete={deleteTask}
              />
            ))
          )}
        </div>
      )}

      <Modal isOpen={showForm} onClose={closeForm} title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}>
        <TaskForm
          initialDate={selectedDate ?? undefined}
          taskToEdit={editingTask}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      </Modal>

      <div style={{ height: 48 }} />
    </div>
  );
}
