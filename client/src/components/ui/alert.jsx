const tones = {
  default: 'border-edge bg-ink/5 text-ink-soft',
  success: 'border-emerald-700/60 bg-emerald-500/10 text-emerald-200',
  danger: 'border-red-800/60 bg-red-500/10 text-red-200',
  gold: 'border-mark/40 bg-mark/10 text-mark-bright',
  info: 'border-sky-800/60 bg-sky-500/10 text-sky-200',
};

export const Alert = ({ tone = 'default', className = '', children }) => (
  <div className={`rounded-md border px-4 py-3 text-sm ${tones[tone]} ${className}`}>{children}</div>
);