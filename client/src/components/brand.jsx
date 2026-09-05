import { Link, useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { useAuth } from '../context/auth.jsx';

export function Brand() {
  return (
    <Link to="/" className="no-underline">
      <div className="flex items-center gap-2.5">
        <Search className="h-6 w-6 -rotate-12 text-mark" strokeWidth={1.75} aria-hidden />
        <div className="leading-none">
          <span className="font-type text-xl tracking-[0.16em] text-ink">BakerStreet</span>
          <span className="mt-1 block text-[9px] font-medium tracking-[0.32em] text-ink-faint">
            OPEN SOURCE DETECTIVE
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ParticipantHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="noir-texture border-b border-edge bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Brand />
        <div className="flex items-center gap-2">
          {user?.role === 'ADMIN' && (
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/events')}>
              <ShieldCheck className="h-4 w-4" /> Admin
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={async () => { await logout(); navigate('/'); }}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Footer({ children }) {
  return (
    <footer className="border-t border-edge bg-surface/80">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-ink-faint">
        <span>BakerStreet</span>
        <div className="flex items-center gap-1">{children}</div>
      </div>
    </footer>
  );
}