export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink ${className}`}
    />
  );
}

export function PageState({ message }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <Spinner className="mx-auto h-6 w-6" />
        <p className="mt-3 text-sm text-ink-faint">{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-ink-faint">{error || 'Something went wrong. Please retry.'}</p>
        {onRetry && (
          <button className="mt-3 text-sm font-medium text-mark underline" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}