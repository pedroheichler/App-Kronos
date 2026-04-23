interface TaskDotProps {
  pendingCount: number;
  doneCount: number;
}

export function TaskDot({ pendingCount, doneCount }: TaskDotProps) {
  if (pendingCount === 0 && doneCount === 0) return null;

  return (
    <div className="flex gap-0.5 justify-center mt-0.5">
      {pendingCount > 0 && (
        <span
          className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0"
          title={`${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
        />
      )}
      {doneCount > 0 && (
        <span
          className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0"
          title={`${doneCount} concluída${doneCount > 1 ? 's' : ''}`}
        />
      )}
    </div>
  );
}
