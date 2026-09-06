import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Check, FolderOpen, Copy, Trophy } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { Timer } from '../components/timer.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert } from '../components/ui/alert.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

const ACTIVE = ['LIVE', 'PAUSED', 'ENDED'];
const IDENTITY_LABELS = {
  PRIVATE_CLIENT: 'Private Client',
  SCOTLAND_YARD: 'Scotland Yard',
  MYCROFT_HOLMES: 'Mycroft Holmes',
};

function openTarget(navigate, cid, continueTarget) {
  if (!continueTarget) return;
  if (continueTarget.type === 'CLOSING') {
    navigate(`/final/${cid}`);
  } else {
    navigate(`/case/${cid}/${continueTarget.id}`);
  }
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
  const current = data.currentCase;
  const cont = data.continue;

  function copyCode() {
    navigator.clipboard?.writeText(data.team.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const identityLabel = IDENTITY_LABELS[data.team.identity] || null;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {started && data.event.status !== 'LIVE' && (
          <Alert tone="info" className="mb-4">
            {data.event.status === 'ENDED'
              ? 'The investigation has ended.'
              : data.event.status === 'PAUSED'
                ? 'The investigation is paused. Submissions are disabled.'
                : 'The investigation has not started yet.'}
          </Alert>
        )}
        {!started && data.event.status !== 'DRAFT' && data.event.status !== 'READY' && (
          <Alert tone="info" className="mb-4">
            {data.event.status === 'ENDED' ? 'The investigation has ended.' : 'The investigation has not started yet.'}
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
              {identityLabel && <Badge tone="gold">Working for: {identityLabel}</Badge>}
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

        <Card className="mb-6 overflow-hidden">
          <div className="noir-texture border-b border-edge bg-solid px-5 py-4 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-type text-xs tracking-[0.3em] text-mark-bright/80">
                {current ? `Case ${String(current.order).padStart(2, '0')} — In Progress` : 'Current Case'}
              </p>
              {current && <Badge tone="gold" className="ml-auto">{current.status}</Badge>}
            </div>
            <h1 className="mt-1 font-type text-2xl">{current ? current.title : 'No case is open'}</h1>
          </div>
          <CardContent className="space-y-4">
            {current ? (
              <>
                {current.plot && (
                  <div className="rounded-md border border-edge bg-surface/60 px-4 py-3">
                    <p className="whitespace-pre-wrap font-type text-[15px] leading-7 text-ink-soft">{current.plot}</p>
                  </div>
                )}
                {current.giver && (
                  <p className="text-xs text-ink-faint">
                    Handed to you by <span className="font-medium text-ink-soft">{IDENTITY_LABELS[current.giver]}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4">
<div className="flex items-center gap-1.5 text-xs text-ink-faint">
                    <Trophy className="h-4 w-4 text-mark" />
                    <span>
                      Podium bonus: 1st {current.podium.first} / 2nd {current.podium.second} / 3rd {current.podium.third}
                    </span>
                  </div>
                <Button
                  disabled={!started || !cont}
                  onClick={() => openTarget(navigate, current.id, cont)}
                >
                  {cont ? (cont.type === 'CLOSING' ? 'Close the Case' : 'Continue to next sub-file') : 'Waiting for the next case'}
                  {cont && <ArrowRight className="h-4 w-4" />}
                </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-faint">An admin will open the next case. Sub-files unlock in order once it is live.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cases</CardTitle>
            <span className="font-mono text-xs text-ink-faint">
              {data.cases.reduce((n, c) => n + (c.files?.solved ?? 0), 0)}/
              {data.cases.reduce((n, c) => n + (c.files?.total ?? 0), 0)} sub-files solved
            </span>
          </CardHeader>
          <div className="divide-y divide-edge/60">
            {data.cases.map((c) => {
              const isOpen = c.status === 'OPEN';
              const isClosed = c.status === 'CLOSED';
              const isCurrent = current && current.id === c.id;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    {isClosed ? (
                      <Check className="h-5 w-5 text-emerald-400" />
                    ) : isOpen ? (
                      <FolderOpen className="h-5 w-5 text-mark" />
                    ) : (
                      <Lock className="h-5 w-5 text-ink-faint/50" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${isOpen || isClosed ? 'text-ink' : 'text-ink-faint/70'}`}>
                        <span className={`font-type ${isOpen || isClosed ? 'text-mark' : 'text-ink-faint/50'}`}>
                          {String(c.order).padStart(2, '0')}
                        </span>
                        <span className="ml-1">{c.title}</span>
                        {isCurrent && <span className="ml-2 rounded bg-mark/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mark">Now</span>}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {c.files?.total ? `${c.files.solved}/${c.files.total} sub-files` : started ? 'No sub-files yet' : 'Locked until the case opens'}
                      </p>
                    </div>
                  </div>
                  {isOpen ? (
                    <Button size="sm" onClick={() => openTarget(navigate, c.id, cont)}>
                      Open
                    </Button>
                  ) : isClosed ? (
                    <Badge tone="success">Closed</Badge>
                  ) : (
                    <Badge>Locked</Badge>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-edge px-5 py-4">
            {cont ? (
              started ? (
                <Button
                  className="w-full"
                  onClick={() => openTarget(navigate, current.id, cont)}
                >
                  Continue Investigation <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  The investigation begins when the event starts
                </Button>
              )
            ) : (
              <Button className="w-full" variant="outline" disabled>
                {started ? 'Waiting for the next case' : 'The investigation begins when the event starts'}
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
              <p className="text-sm text-ink-faint">No evidence yet. Solve sub-files to collect evidence.</p>
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