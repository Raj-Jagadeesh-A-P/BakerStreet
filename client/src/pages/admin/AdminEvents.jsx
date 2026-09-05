import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Dialog } from '../../components/ui/dialog.jsx';
import { Field, InputBare } from '../../components/ui/input.jsx';
import { Alert } from '../../components/ui/alert.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

const STATUS_TONE = { DRAFT: 'default', READY: 'info', LIVE: 'success', PAUSED: 'gold', ENDED: 'danger' };

export default function AdminEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    durationMinutes: 180,
    teamMinSize: 2,
    teamMaxSize: 3,
    pollIntervalSeconds: 8,
  });
  const [createError, setCreateError] = useState(null);

  async function load() {
    try {
      setEvents((await api('/admin/events')).events);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function set(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function create(e) {
    e.preventDefault();
    setCreateError(null);
    setBusy(true);
    try {
      const ev = await api('/admin/events', {
        method: 'POST',
        body: {
          ...form,
          durationMinutes: Number(form.durationMinutes),
          teamMinSize: Number(form.teamMinSize),
          teamMaxSize: Number(form.teamMaxSize),
          pollIntervalSeconds: Number(form.pollIntervalSeconds),
        },
      });
      setOpen(false);
      navigate(`/admin/events/${ev.event.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!events) return <PageState message="Loading events…" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-type text-[11px] tracking-[0.3em] text-mark">Field Office</p>
          <h1 className="mt-1 font-type text-2xl text-ink">Events</h1>
          <p className="mt-0.5 text-sm text-ink-faint">Create and manage competitions.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Event
        </Button>
      </div>

      <div className="space-y-2">
        {events.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-faint">
              No events yet. Create your first event.
            </CardContent>
          </Card>
        )}
        {events.map((ev) => (
          <Card key={ev.id} className="cursor-pointer transition-shadow hover:shadow-sm" onClick={() => navigate(`/admin/events/${ev.id}`)}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">{ev.name}</p>
                <p className="font-mono text-xs text-ink-faint">CODE: {ev.code}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-faint">
                <span>{ev.teamCount} teams</span>
                <span>{ev.caseCount} cases</span>
                <Badge tone={STATUS_TONE[ev.status]}>{ev.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create Event">
        <form className="space-y-4" onSubmit={create}>
          <Field label="Event Name">
            <InputBare required value={form.name} onChange={set('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Event Code">
              <InputBare required value={form.code} onChange={set('code')} className="font-mono uppercase" placeholder="OSD2026" />
            </Field>
            <Field label="Duration (minutes)">
              <InputBare type="number" min={1} value={form.durationMinutes} onChange={set('durationMinutes')} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Min team">
              <InputBare type="number" min={1} value={form.teamMinSize} onChange={set('teamMinSize')} />
            </Field>
            <Field label="Max team">
              <InputBare type="number" min={1} value={form.teamMaxSize} onChange={set('teamMaxSize')} />
            </Field>
            <Field label="Poll (sec)">
              <InputBare type="number" min={3} value={form.pollIntervalSeconds} onChange={set('pollIntervalSeconds')} />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-mark focus:outline-none"
              rows={3}
              value={form.description}
              onChange={set('description')}
            />
          </Field>
          {createError && <Alert tone="danger">{createError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create Event'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}