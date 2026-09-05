import { forwardRef } from 'react';

export const Input = forwardRef(({ className = '', label, hint, ...props }, ref) => (
  <label className="block text-left">
    <InputBare ref={ref} className={`w-full ${className}`} {...props} />
  </label>
));
Input.displayName = 'Input';

export const InputBare = forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`h-10 rounded-md border border-edge bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-faint/60 focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25 ${className}`}
    {...props}
  />
));
InputBare.displayName = 'InputBare';

export const Textarea = forwardRef(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint/60 focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25 ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Field = ({ label, children, className = '' }) => (
  <label className={`block text-left ${className}`}>
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</span>
    {children}
  </label>
);