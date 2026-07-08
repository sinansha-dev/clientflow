interface TaskProgressProps {
  completed: number;
  total: number;
  className?: string;
}

export function TaskProgress({ completed, total, className = '' }: TaskProgressProps) {
  if (total === 0) return null;
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      <div className="flex justify-between items-center text-[10px] font-medium text-foreground/50">
        <span>Progress</span>
        <span>
          {percentage}% ({completed}/{total})
        </span>
      </div>
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
