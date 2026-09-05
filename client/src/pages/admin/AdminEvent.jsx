import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Pause, Square, RotateCcw, Download } from 'lucide-react';
import { api, downloadCsv } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Alert } from '../../components/ui/alert.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

const STATUS_TONE = { DRAFT: 'default', READY: 'info', LIVE: 'success', PAUSED: 'gold', ENDED: 'danger' };

export default function AdminEvent() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/admin/events/${eventId}`));
    } catch (e) {
      setError(e.message);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action) {
    setBusy(action);
    setError(null);
    try {
      await api(`/admin/events/${eventId}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading event…" />;

  const { event, stats, scoring } = data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-type text-2xl text-ink">{event.name}</h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-faint">
            <span className="font-mono">CODE: {event.code}</span>
            <Badge tone={STATUS_TONE[event.status]}>{event.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          {(event.status === 'DRAFT' || event.status === 'READY' || event.status === 'PAUSED') && (
            <Button onClick={() => act('start')} disabled={busy}>
              <Play className="h-4 w-4" /> {event.status === 'PAUSED' ? 'Resume' : 'Start'}
            </Button>
          )}
          {event.status === 'LIVE' && (
            <>
              <Button variant="outline" onClick={() => act('pause')} disabled={busy}>
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button variant="danger" onClick={() => act('end')} disabled={busy}>
                <Square className="h-4 w-4" /> End
              </Button>
            </>
          )}
          {event.status !== 'DRAFT' && (
            <Button variant="ghost" onClick={() => act('reset')} title="Reset to draft" disabled={busy}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Teams', stats.teams],
          ['Participants', stats.participants],
          ['Cases solved', stats.solvedSubs],
          ['Submissions', stats.totalSubs],
          ['Final reports', stats.finals],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="text-center">
              <p className="font-type text-2xl text-ink">{value}</p>
              <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-faint">Starts</span><span className="font-mono">{event.startTime ? new Date(event.startTime).toLocaleString() : '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Ends</span><span className="font-mono">{event.endTime ? new Date(event.endTime).toLocaleString() : '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Duration</span><span>{event.durationMinutes} minutes</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Team size</span><span>{event.teamMinSize}–{event.teamMaxSize}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Leaderboard poll</span><span>{event.pollIntervalSeconds}s</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final Case Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(scoring).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="capitalize text-ink-faint">{k.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Export Results (CSV)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              ['participants', 'Participants'],
              ['teams', 'Teams'],
              ['scores', 'Scores'],
              ['submissions', 'Submissions'],
              ['finals', 'Final results'],
            ].map(([type, label]) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => downloadCsv(`/admin/events/${eventId}/export/${type}`, `${event.code}-${type}.csv`)}
              >
                <Download className="h-4 w-4" /> {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}