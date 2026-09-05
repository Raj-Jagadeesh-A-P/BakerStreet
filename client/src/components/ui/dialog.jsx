import { useEffect } from 'react';

export function Dialog({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg border border-edge bg-surface shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="font-type text-base text-ink">{title}</h2>
          <button
            className="rounded p-1 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}