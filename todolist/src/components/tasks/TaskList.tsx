import { useState, useMemo } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Task, TaskFormData } from '../../types';
import { useTasks } from '../../hooks/useTasks';
import { parseDateKey } from '../../utils/calendar';
import { TaskItem } from './TaskItem';
import { FilterBar } from './FilterBar';
import { TaskForm } from './TaskForm';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';

export function TaskList() {
  const {
    filter,
    selectedDate,
    filteredTasksForSelectedDate,
    tasksGroupedByDate,
    addTask,
    updateTask,
    deleteTask,
    toggleStatus,
    setFilter,
  } = useTasks();

  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const openCreate = () => { setEditingTask(null); setShowForm(true); };
  const openEdit   = (task: Task) => { setEditingTask(task); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditingTask(null); };

  const handleSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateTask({ ...editingTask, ...data });
    } else {
      addTask(data);
    }
    closeForm();
  };

  // Contagens do dia selecionado (todos os status, sem filtro) — memoizado para evitar recalcular a cada render
  const counts = useMemo(() => {
    const dayTasks = selectedDate ? (tasksGroupedByDate[selectedDate] ?? []) : [];
    return {
      all:     dayTasks.length,
      pending: dayTasks.filter(t => t.status === 'pending').length,
      done:    dayTasks.filter(t => t.status === 'done').length,
    };
  }, [selectedDate, tasksGroupedByDate]);

  const dateLabel = selectedDate
    ? format(parseDateKey(selectedDate), "d 'de' MMMM", { locale: ptBR })
    : 'Selecione um dia';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-semibold text-[#3a3a3a] uppercase tracking-widest mb-0.5">
              Tarefas
            </p>
            <h3 className="text-sm font-semibold text-[#E8E8E8] capitalize">{dateLabel}</h3>
          </div>
          <button
            onClick={openCreate}
            title="Nova tarefa"
            aria-label="Nova tarefa"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] transition-colors cursor-pointer flex-shrink-0"
          >
            <Plus size={14} className="text-white" />
          </button>
        </div>

        <FilterBar filter={filter} onFilterChange={setFilter} counts={counts} />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
        {filteredTasksForSelectedDate.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} />}
            message={
              !selectedDate
                ? 'Selecione um dia no calendário'
                : filter !== 'all'
                ? 'Nenhuma tarefa com este filtro'
                : 'Nenhuma tarefa para este dia'
            }
          />
        ) : (
          filteredTasksForSelectedDate.map(task => (
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

      {/* Modal de criação/edição */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}
      >
        <TaskForm
          initialDate={selectedDate ?? undefined}
          taskToEdit={editingTask}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      </Modal>
    </div>
  );
}
