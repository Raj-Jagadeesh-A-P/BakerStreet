import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/table.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await api('/auth/me');
        if (!me.membership) {
          navigate('/join', { replace: true });
          return;
        }
        const d = await api(`/events/${me.membership.eventId}/leaderboard`);
        setData(d);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(load, (data?.pollIntervalSeconds || 8) * 1000);
    return () => clearInterval(timer.current);
  }, [navigate]);

  useEffect(() => {
    if (timer.current && data?.pollIntervalSeconds) {
      clearInterval(timer.current);
      timer.current = setInterval(
        async () => {
          try {
            const me = await api('/auth/me');
            if (!me.membership) return;
            const d = await api(`/events/${me.membership.eventId}/leaderboard`);
            setData(d);
          } catch {
            /* keep last snapshot */
          }
        },
        data.pollIntervalSeconds * 1000,
      );
    }
  }, [data?.pollIntervalSeconds]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading leaderboard…" />;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-type text-[11px] tracking-[0.3em] text-mark">Open Source Detective</p>
            <h1 className="mt-1 font-type text-2xl text-ink">Leaderboard</h1>
            <p className="mt-0.5 font-mono text-xs text-ink-faint">{data.event.name}</p>
          </div>
          <span className="font-mono text-xs text-ink-faint">
            auto-refreshes every {data.pollIntervalSeconds}s
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-edge bg-surface">
          <Table>
            <THead>
              <TR>
                <TH className="w-14">Rank</TH>
                <TH>Team</TH>
                <TH className="text-right">Solved</TH>
                <TH className="text-right">Closed</TH>
                <TH className="text-right">Score</TH>
              </TR>
            </THead>
            <TBody>
              {data.teams.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    No teams yet.
                  </TD>
                </TR>
              )}
              {data.teams.map((t) => (
                <TR key={t.id}>
                  <TD className={`font-type ${t.rank <= 3 ? 'text-mark' : 'text-ink'}`}>
                    {t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : `#${t.rank}`}
                  </TD>
                  <TD>
                    <span className="font-medium text-ink">{t.name}</span>
                    <span className="ml-2 text-xs text-ink-faint">({t.memberCount})</span>
                  </TD>
                  <TD className="text-right tabular-nums">{t.solved}</TD>
                  <TD className="text-right tabular-nums">{t.casesClosed}</TD>
                  <TD className="text-right font-bold tabular-nums text-ink">{t.score}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {data.cases.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Case Closings</CardTitle>
              <span className="font-mono text-xs text-ink-faint">first three teams to close a case win the podium bonus</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.cases.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">
                      <span className="font-type mr-1.5 text-mark">{String(c.order).padStart(2, '0')}</span>
                      {c.title}
                    </p>
                    <Badge tone={c.status === 'OPEN' ? 'gold' : c.status === 'CLOSED' ? 'success' : 'default'}>
                      {c.status}
                    </Badge>
                  </div>
                  {c.closers.length === 0 ? (
                    <p className="mt-1 text-xs text-ink-faint">No team has closed this case yet.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {c.closers.map((cl) => (
                        <span key={cl.teamId} className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-soft">
                          {cl.rank <= 3 && <Trophy className="h-3 w-3 text-mark" />}
                          <span className="font-mono text-ink-faint">#{cl.rank}</span>
                          {cl.teamName}
                          <span className="font-mono text-mark">+{cl.bonus}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}