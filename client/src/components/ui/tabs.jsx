export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-md border border-edge bg-ink/5 p-0.5 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            active === t.value ? 'bg-surface text-mark shadow-sm' : 'text-ink-faint hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}