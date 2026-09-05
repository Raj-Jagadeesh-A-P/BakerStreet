import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Check, FolderOpen, Copy } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { Timer } from '../components/timer.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert } from '../components/ui/alert.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

const ACTIVE = ['LIVE', 'PAUSED', 'ENDED'];

function CaseRow({ c, started }) {
  const nav = useNavigate();
  const isSolved = c.status === 'SOLVED';
  const isUnlocked = started && c.status === 'UNLOCKED';

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 not-last:border-b not-last:border-edge/60">
      <div className="flex items-center gap-3">
        {isSolved ? (
          <Check className="h-5 w-5 text-emerald-400" />
        ) : isUnlocked ? (
          <FolderOpen className="h-5 w-5 text-mark" />
        ) : (
          <Lock className="h-5 w-5 text-ink-faint/50" />
        )}
        <div>
          <p className={`text-sm font-medium ${isSolved || isUnlocked ? 'text-ink' : 'text-ink-faint/70'}`}>
            <span className={`font-type ${isSolved || isUnlocked ? 'text-mark' : 'text-ink-faint/50'}`}>
              {String(c.order).padStart(2, '0')}
            </span>
            <span className="ml-1">{c.title}</span>
            {c.finalCase && <span className="ml-2 rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">Final</span>}
          </p>
          {isUnlocked ? (
            <p className="text-xs text-ink-faint">
              {c.points} pts
              {c.hintsUsed > 0 && ` • hint${c.hintsUsed > 1 ? 's' : ''} used`}
            </p>
          ) : (
            <span className="redacted inline-block h-3 w-28 opacity-40" aria-hidden />
          )}
        </div>
      </div>
      {isSolved ? (
        <Badge tone="success">Solved</Badge>
      ) : isUnlocked ? (
        <Button size="sm" onClick={() => nav(c.finalCase ? '/final' : `/case/${c.id}`)}>
          Open
        </Button>
      ) : (
        <Badge>Locked</Badge>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api('/auth/me');
        if (!me.membership) {
          navigate('/join', { replace: true });
          return;
        }
        const d = await api(`/events/${me.membership.eventId}/dashboard`);
        setData(d);
      } catch (err) {
        if (err.message === "You haven't joined an event yet.") {
          navigate('/join', { replace: true });
          return;
        }
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) return <PageState message="Loading your case files…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const started = ACTIVE.includes(data.event.status);
  const hidden = (s) => (started ? s : s === 'SOLVED' ? s : 'LOCKED');
  const caseRows = data.cases.map((c) => ({ ...c, status: hidden(c.status) }));
  const next = data.continueCaseId;

  function copyCode() {
    navigator.clipboard?.writeText(data.team.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {!started && data.event.status !== 'DRAFT' && data.event.status !== 'READY' && (
          <Alert tone="info" className="mb-4">
            {data.event.status === 'ENDED' ? 'This event has ended.' : 'This event has not started yet.'}
          </Alert>
        )}

        <Card className="mb-6 overflow-hidden">
          <div className="noir-texture border-b border-edge bg-surface px-5 py-4">
            <p className="font-type text-[11px] tracking-[0.32em] text-mark">BakerStreet</p>
            <h1 className="mt-1 font-type text-2xl text-ink">{data.event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>Team: <strong>{data.team.name}</strong></span>
              <button onClick={copyCode} className="flex items-center gap-1 rounded border border-edge px-1.5 py-0.5 font-mono text-xs text-ink-faint hover:bg-ink/5" title="Copy team code">
                {data.team.code} <Copy className="h-3 w-3" />
              </button>
              {copied && <span className="text-xs text-emerald-400">copied</span>}
            </div>
          </div>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Score</p>
                <p className="font-type text-3xl text-ink">{data.team.score}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Rank</p>
                <p className="font-type text-3xl text-ink">#{data.team.rank}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Time</p>
                <Timer event={data.event} className="font-type text-3xl text-ink" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Case Files</CardTitle>
            <span className="font-mono text-xs text-ink-faint">
              {data.cases.filter((c) => c.status === 'SOLVED').length}/{data.cases.length} solved
            </span>
          </CardHeader>
          <div className="divide-y divide-edge/60">
            {caseRows.map((c) => (
              <CaseRow key={c.id} c={c} started={started} />
            ))}
          </div>
          <div className="border-t border-edge px-5 py-4">
            {next ? (
              <Button
                className="w-full"
                onClick={() => navigate(data.cases.find((c) => c.id === next)?.finalCase ? '/final' : `/case/${next}`)}
              >
                Continue Investigation <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="w-full" variant="outline" disabled>
                Investigation complete
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence Collected</CardTitle>
          </CardHeader>
          {data.evidence.length === 0 ? (
            <CardContent>
              <p className="text-sm text-ink-faint">No evidence yet. Solve cases to collect evidence.</p>
            </CardContent>
          ) : (
            <div className="divide-y divide-edge/60">
              {data.evidence.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="w-44 shrink-0 font-medium text-ink-faint">{e.label}</span>
                  <span className="truncate font-mono text-ink">{e.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}