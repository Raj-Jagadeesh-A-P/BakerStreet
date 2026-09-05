export function Table({ children }) {
  return <table className="w-full text-left text-sm">{children}</table>;
}

export function THead({ children }) {
  return <thead className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">{children}</thead>;
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-edge/60">{children}</tbody>;
}

export function TR({ className = '', ...props }) {
  return <tr className={`hover:bg-ink/[0.03] ${className}`} {...props} />;
}

export function TH({ className = '', ...props }) {
  return <th className={`px-3 py-2 font-semibold ${className}`} {...props} />;
}

export function TD({ className = '', ...props }) {
  return <td className={`px-3 py-2 text-ink-soft ${className}`} {...props} />;
}