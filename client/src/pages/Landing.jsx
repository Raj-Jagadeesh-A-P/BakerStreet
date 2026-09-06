import { Link } from 'react-router-dom';
import { Search, UserPlus, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/auth.jsx';

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div className="pointer-events-none absolute inset-0 noir-texture" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-edge bg-surface shadow-[0_0_70px_rgb(224_166_58/0.14)]">
          <Search className="h-9 w-9 text-mark" strokeWidth={1.5} />
        </div>
        <h1 className="font-type text-3xl tracking-[0.15em] text-ink sm:text-4xl md:text-5xl">BakerStreet</h1>
        <p className="mt-5 font-type text-sm tracking-[0.35em] text-ink-soft">
          OPEN SOURCE DETECTIVE
        </p>
        <p className="mt-3 font-mono text-xs text-ink-faint">Investigate. Discover. Solve.</p>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          {user ? (
            <Link
              to={user.role === 'ADMIN' ? '/admin/events' : '/dashboard'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-solid px-7 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-solid-soft"
            >
              Continue Investigation
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-solid px-7 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-solid-soft"
              >
                <UserPlus className="h-4 w-4" /> Join Event
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-edge bg-surface px-7 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ink/5"
              >
                <LogIn className="h-4 w-4" /> Login
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md px-7 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint transition-colors hover:text-ink"
              >
                <ShieldCheck className="h-4 w-4" /> Admin
              </Link>
            </>
          )}
        </div>

        <div className="mt-16 grid w-full max-w-md grid-cols-3 gap-4 border-t border-edge pt-8 text-left">
          <div>
            <p className="font-type text-2xl text-ink">6</p>
            <p className="mt-1 text-xs text-ink-faint">Connected cases</p>
          </div>
          <div>
            <p className="font-type text-2xl text-ink">2–3</p>
            <p className="mt-1 text-xs text-ink-faint">Members per team</p>
          </div>
          <div>
            <p className="font-type text-2xl text-ink">+</p>
            <p className="mt-1 text-xs text-ink-faint">Podium closing bonuses</p>
          </div>
        </div>
      </div>
    </div>
  );
}