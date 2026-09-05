const tones = {
  default: 'bg-ink/10 text-ink-soft',
  success: 'bg-emerald-500/15 text-emerald-300',
  danger: 'bg-red-500/15 text-red-300',
  gold: 'bg-mark/15 text-mark-bright',
  info: 'bg-sky-500/15 text-sky-300',
};

export const Badge = ({ className = '', tone = 'default', ...props }) => (
  <span
    className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tones[tone]} ${className}`}
    {...props}
  />
);