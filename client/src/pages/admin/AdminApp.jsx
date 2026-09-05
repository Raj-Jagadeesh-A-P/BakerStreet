import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Inbox, Scale, Trophy, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { useAuth } from '../../context/auth.jsx';
import { Brand } from '../../components/brand.jsx';
import AdminEvents from './AdminEvents.jsx';
import AdminEvent from './AdminEvent.jsx';
import AdminCases from './AdminCases.jsx';
import AdminTeams from './AdminTeams.jsx';
import AdminSubmissions from './AdminSubmissions.jsx';
import AdminFinals from './AdminFinals.jsx';
import AdminLeaderboard from './AdminLeaderboard.jsx';

const navFor = (eventId) => [
  { to: `/admin/events/${eventId}`, label: 'Overview', icon: LayoutDashboard, end: true },
  { to: `/admin/events/${eventId}/cases`, label: 'Cases', icon: FileText },
  { to: `/admin/events/${eventId}/teams`, label: 'Teams', icon: Users },
  { to: `/admin/events/${eventId}/submissions`, label: 'Submissions', icon: Inbox },
  { to: `/admin/events/${eventId}/finals`, label: 'Finals', icon: Scale },
  { to: `/admin/events/${eventId}/leaderboard`, label: 'Leaderboard', icon: Trophy },
];

export default function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const match = location.pathname.match(/^\/admin\/events\/(\d+)/);
  const eventId = match ? match[1] : null;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="noir-texture hidden w-56 shrink-0 border-r border-edge bg-surface/80 md:block">
        <div className="border-b border-edge px-5 py-4">
          <Brand />
          <p className="mt-1 font-type text-[10px] tracking-[0.3em] text-mark">Admin</p>
        </div>
        <nav className="p-3">
          <NavLink
            to="/admin/events"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-solid text-white' : 'text-ink-soft hover:bg-ink/5'}`
            }
          >
            <Plus className="h-4 w-4" /> Events
          </NavLink>
          {eventId &&
            navFor(eventId).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-solid text-white' : 'text-ink-soft hover:bg-ink/5'}`
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-edge p-3">
          <Button
            size="sm"
            variant="ghost"
            className="justify-start"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Logout ({user?.name})
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="noir-texture sticky top-0 z-10 border-b border-edge bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <Button size="sm" variant="ghost" onClick={async () => { await logout(); navigate('/'); }}>
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Routes>
            <Route index element={<Navigate to="/admin/events" replace />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="events/:eventId" element={<AdminEvent />} />
            <Route path="events/:eventId/cases" element={<AdminCases />} />
            <Route path="events/:eventId/teams" element={<AdminTeams />} />
            <Route path="events/:eventId/submissions" element={<AdminSubmissions />} />
            <Route path="events/:eventId/finals" element={<AdminFinals />} />
            <Route path="events/:eventId/leaderboard" element={<AdminLeaderboard />} />
            <Route path="*" element={<Navigate to="/admin/events" replace />} />
          </Routes>
        </main>
      </div>

      {/* mobile event nav */}
      {eventId && (
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-edge bg-surface md:hidden">
          {navFor(eventId).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-mark' : 'text-ink-faint'}`
              }
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}