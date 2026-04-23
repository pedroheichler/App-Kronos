import type { ReactNode } from 'react';

interface EmptyStateProps {
  message?: string;
  icon?: ReactNode;
}

export function EmptyState({ message = 'Nenhuma tarefa para este dia', icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      {icon && <div className="text-[#2a2a2a]">{icon}</div>}
      <p className="text-[#3a3a3a] text-sm text-center">{message}</p>
    </div>
  );
}
