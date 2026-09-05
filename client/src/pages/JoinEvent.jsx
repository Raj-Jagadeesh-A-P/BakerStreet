import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { Button } from '../components/ui/button.jsx';
import { Field, InputBare } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert } from '../components/ui/alert.jsx';

export default function JoinEvent() {
  const navigate = useNavigate();
  const [eventCode, setEventCode] = useState('');
  const [event, setEvent] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function findEvent(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const d = await api('/events/join', { method: 'POST', body: { code: eventCode } });
      if (d.team) {
        navigate('/dashboard', { replace: true });
      }
      setEvent(d.event);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createTeam(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/events/${event.id}/teams`, { method: 'POST', body: { name: teamName } });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinTeam(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/events/${event.id}/teams/join`, { method: 'POST', body: { code: teamCode } });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <ParticipantHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="font-mono text-xs text-mark-faint">EVENT ACCESS</p>
        <h1 className="mt-1 font-type text-3xl text-ink">Join the Investigation</h1>

        {!event && (
          <>
            <p className="mt-1 text-sm text-ink-faint">Enter the event code provided by the organizers.</p>
            <form className="mt-6 space-y-4" onSubmit={findEvent}>
              <Field label="Event Code">
                <div className="flex gap-2">
                  <InputBare
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value)}
                    placeholder="OSD2026"
                    className="font-mono uppercase tracking-widest"
                    required
                  />
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Checking…' : 'Continue'}
                  </Button>
                </div>
              </Field>
              {error && <Alert tone="danger">{error}</Alert>}
            </form>
          </>
        )}

        {event && (
          <div className="mt-6 space-y-6">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-ink">{event.name}</p>
                    <p className="font-mono text-sm text-ink-faint">CODE: {event.code}</p>
                  </div>
                  <Badge tone={event.status === 'LIVE' ? 'success' : event.status === 'PAUSED' ? 'gold' : 'default'}>
                    {event.status}
                  </Badge>
                </div>
                {event.description && <p className="mt-3 text-sm text-ink-faint">{event.description}</p>}
                <p className="mt-3 text-xs text-ink-faint">
                  Team size: {event.teamMinSize}–{event.teamMaxSize} members
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardContent>
                  <h2 className="font-semibold text-ink">Create a team</h2>
                  <p className="mt-1 text-xs text-ink-faint">Start a team and share its code with friends.</p>
                  <form className="mt-4 space-y-3" onSubmit={createTeam}>
                    <Field label="Team Name">
                      <InputBare value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={60} required />
                    </Field>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? 'Creating…' : 'Create team'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h2 className="font-semibold text-ink">Join a team</h2>
                  <p className="mt-1 text-xs text-ink-faint">Use the code your teammate created.</p>
                  <form className="mt-4 space-y-3" onSubmit={joinTeam}>
                    <Field label="Team Code">
                      <InputBare
                        value={teamCode}
                        onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                        className="font-mono uppercase"
                        maxLength={10}
                        required
                      />
                    </Field>
                    <Button type="submit" variant="outline" className="w-full" disabled={busy}>
                      {busy ? 'Joining…' : 'Join team'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}
            <button className="text-sm text-ink-faint underline" onClick={() => setEvent(null)}>
              ← Use a different event code
            </button>
          </div>
        )}
      </main>
    </div>
  );
}