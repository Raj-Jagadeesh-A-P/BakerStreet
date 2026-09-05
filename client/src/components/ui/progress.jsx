export function Progress({ value = 0, className = '' }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-edge/70 ${className}`}>
      <div
        className="h-full rounded-full bg-mark transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}