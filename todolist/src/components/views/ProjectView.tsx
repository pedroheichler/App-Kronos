import { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useProjectsContext } from '../../context/ProjectsContext';
import { useTasks } from '../../hooks/useTasks';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TaskItem } from '../tasks/TaskItem';
import { TaskForm } from '../tasks/TaskForm';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { AddTaskRow } from './TodayView';
import type { Task, TaskFormData } from '../../types';

export function ProjectView() {
  const isMobile = useIsMobile();
  const { projects, selectedProjectId } = useProjectsContext();
  const { tasks, addTask, updateTask, deleteTask, toggleStatus } = useTasks();

  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const project = projects.find(p => p.id === selectedProjectId);

  const projectTasks = useMemo(
    () => tasks
      .filter(t => t.projectId === selectedProjectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [tasks, selectedProjectId],
  );

  const pending = projectTasks.filter(t => t.status === 'pending');
  const done    = projectTasks.filter(t => t.status === 'done');

  const openCreate = () => { setEditingTask(null); setShowForm(true); };
  const openEdit   = (task: Task) => { setEditingTask(task); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditingTask(null); };

  const handleSubmit = (data: TaskFormData) => {
    if (editingTask) updateTask({ ...editingTask, ...data });
    else             addTask({ ...data, projectId: selectedProjectId ?? undefined });
    closeForm();
  };

  if (!project) return null;

  const doneRate = projectTasks.length > 0
    ? Math.round((done.length / projectTasks.length) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '24px 16px' : '36px 32px', flex: 1, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: project.color, flexShrink: 0,
          }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8E8E8', margin: 0, flex: 1 }}>
            {project.name}
          </h1>
        </div>

        {/* Barra de progresso */}
        {projectTasks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, height: 3, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                width: `${doneRate}%`, height: '100%',
                background: project.color, borderRadius: 4,
                transition: 'width 0.4s',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#616161', flexShrink: 0 }}>
              {done.length}/{projectTasks.length} concluídas
            </span>
          </div>
        )}
      </div>

      {/* Tarefas pendentes */}
      {projectTasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          message="Nenhuma tarefa neste projeto ainda."
        />
      ) : (
        <>
          {pending.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={toggleStatus}
              onEdit={openEdit}
              onDelete={deleteTask}
            />
          ))}

          {done.length > 0 && (
            <>
              <div style={{ height: 1, background: '#1a1a1a', margin: '12px 0' }} />
              {done.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={toggleStatus}
                  onEdit={openEdit}
                  onDelete={deleteTask}
                />
              ))}
            </>
          )}
        </>
      )}

      <AddTaskRow onClick={openCreate} />

      <Modal isOpen={showForm} onClose={closeForm} title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}>
        <TaskForm
          taskToEdit={editingTask}
          onSubmit={handleSubmit}
          onClose={closeForm}
          hideDate={false}
        />
      </Modal>

      <div style={{ height: 48 }} />
    </div>
  );
}
