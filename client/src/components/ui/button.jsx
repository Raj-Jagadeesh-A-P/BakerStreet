import { forwardRef } from 'react';

const variants = {
  default: 'bg-solid text-white hover:bg-solid-soft',
  outline: 'border border-edge text-ink hover:bg-ink/5',
  ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink',
  gold: 'bg-mark text-black hover:bg-mark-bright',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes = {
  sm: 'h-8 px-3 text-[11px]',
  default: 'h-10 px-4 text-xs',
  lg: 'h-11 px-6 text-sm',
};

export const Button = forwardRef(({ className = '', variant = 'default', size = 'default', ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/60 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  />
));
Button.displayName = 'Button';