import type { TaskStatus } from '../../types';

const styles: Record<TaskStatus, string> = {
  pending: 'bg-amber-400/10 text-amber-400',
  done:    'bg-green-400/10 text-green-400',
};

const labels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  done:    'Concluída',
};

export function Badge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
