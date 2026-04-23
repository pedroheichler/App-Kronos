import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, CheckCircle2 } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useIsMobile } from '../../hooks/useIsMobile';
import { parseDateKey } from '../../utils/calendar';
import { TaskItem } from '../tasks/TaskItem';
import { TaskForm } from '../tasks/TaskForm';
import { FilterBar } from '../tasks/FilterBar';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import type { Task, TaskFormData } from '../../types';

export function TodayView() {
  const isMobile = useIsMobile();
  const { filter, setFilter, tasksGroupedByDate, addTask, updateTask, deleteTask, toggleStatus } = useTasks();

  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const todayKey   = format(new Date(), 'yyyy-MM-dd');
  const dateLabel  = format(parseDateKey(todayKey), "EEEE, d 'de' MMMM", { locale: ptBR });

  const allTodayTasks = tasksGroupedByDate[todayKey] ?? [];
  const displayTasks  = useMemo(
    () => filter === 'all' ? allTodayTasks : allTodayTasks.filter(t => t.status === filter),
    [allTodayTasks, filter],
  );
  const counts = useMemo(() => ({
    all:     allTodayTasks.length,
    pending: allTodayTasks.filter(t => t.status === 'pending').length,
    done:    allTodayTasks.filter(t => t.status === 'done').length,
  }), [allTodayTasks]);

  const openCreate = () => { setEditingTask(null); setShowForm(true); };
  const openEdit   = (task: Task) => { setEditingTask(task); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditingTask(null); };

  const handleSubmit = (data: TaskFormData) => {
    if (editingTask) updateTask({ ...editingTask, ...data });
    else             addTask(data);
    closeForm();
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '20px 16px' : '36px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8E8E8', margin: 0 }}>Hoje</h1>
          <p style={{ fontSize: 12, color: '#616161', marginTop: 4, textTransform: 'capitalize' }}>
            {dateLabel}
          </p>
        </div>
        {isMobile && (
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: '#8b5cf6', border: 'none',
            borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>
            <Plus size={14} />
            Nova
          </button>
        )}
      </div>

      {/* Filtro */}
      {allTodayTasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <FilterBar filter={filter} onFilterChange={setFilter} counts={counts} />
        </div>
      )}

      {/* Lista de tarefas */}
      <div>
        {displayTasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} />}
            message={
              counts.all === 0
                ? 'Tudo limpo! Adicione tarefas para hoje.'
                : 'Nenhuma tarefa com este filtro.'
            }
          />
        ) : (
          displayTasks.map(task => (
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

      {/* Adicionar tarefa inline */}
      <AddTaskRow onClick={openCreate} />

      <Modal isOpen={showForm} onClose={closeForm} title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}>
        <TaskForm
          initialDate={todayKey}
          taskToEdit={editingTask}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      </Modal>
    </div>
  );
}

export function AddTaskRow({ onClick, label = 'Adicionar tarefa' }: { onClick: () => void; label?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 4, padding: '8px 4px',
        background: 'transparent', border: 'none',
        color: hovered ? '#8b5cf6' : '#3a3a3a',
        cursor: 'pointer', fontSize: 13, width: '100%', borderRadius: 8,
        transition: 'color 0.15s',
      }}
    >
      <Plus size={15} />
      {label}
    </button>
  );
}
