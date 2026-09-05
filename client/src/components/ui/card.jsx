export const Card = ({ className = '', ...props }) => (
  <div className={`rounded-lg border border-edge bg-surface shadow-[0_2px_12px_rgb(0_0_0/0.25)] ${className}`} {...props} />
);

export const CardHeader = ({ className = '', ...props }) => (
  <div className={`flex items-start justify-between gap-4 border-b border-edge px-5 py-4 ${className}`} {...props} />
);

export const CardTitle = ({ className = '', ...props }) => (
  <h3 className={`font-type text-base leading-snug text-ink ${className}`} {...props} />
);

export const CardContent = ({ className = '', ...props }) => (
  <div className={`px-5 py-4 ${className}`} {...props} />
);