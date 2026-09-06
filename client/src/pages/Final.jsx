import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, CheckCircle2, ArrowRight, Lock } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { useAuth } from '../context/auth.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert } from '../components/ui/alert.jsx';
import { InputBare } from '../components/ui/input.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

function SectionLabel({ children }) {
  return <h2 className="font-type text-xs tracking-[0.28em] text-mark">{children}</h2>;
}

export default function Final() {
  const { cid } = useParams();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const [eventId, setEventId] = useState(membership?.eventId ?? null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let eid = membership?.eventId;
        if (!eid) {
          const me = await api('/auth/me');
          eid = me.membership?.eventId;
        }
        if (!eid) {
          navigate('/join', { replace: true });
          return;
        }
        setEventId(eid);
        const d = await api(`/events/${eid}/cases/${cid}`);
        if (alive) setData(d);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cid, membership?.eventId, navigate]);

  if (loading) return <PageState message="Opening the closing challenge…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const c = data.case;
  const closing = c.closing;
  const closedByUs = !!closing.myClosing;
  const locked = !closing.released || c.status !== 'OPEN';

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setBusy(true);
    try {
      const r = await api(`/events/${eventId}/cases/${cid}/close`, { method: 'POST', body: { answer } });
      if (r.correct) {
        setResult(r);
      } else {
        setSubmitError(r.message);
        setAnswer('');
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasClosers = c.closers.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <nav className="mb-4 font-mono text-xs text-ink-faint">
          <button className="underline" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">Closing challenge</span>
        </nav>

        <Card className="mb-6 overflow-hidden">
          <div className="noir-texture border-b border-edge bg-solid px-5 py-4 text-white">
            <p className="font-type text-xs tracking-[0.3em] text-mark-bright/80">Case {String(c.order).padStart(2, '0')}</p>
            <h1 className="mt-1 font-type text-2xl">{c.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-white/70">
              <span>Closing challenge</span>
              <span>• Podium: 1st {c.podium.first} / 2nd {c.podium.second} / 3rd {c.podium.third}</span>
            </div>
          </div>

          <CardContent className="space-y-7">
            {closedByUs || result ? (
              <div className="space-y-4">
                <Alert tone="success" className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Case closed!
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md border border-edge px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Closing rank</p>
                    <p className="font-type text-3xl text-ink">#{result?.rank ?? closing.myClosing.rank}</p>
                  </div>
                  <div className="rounded-md border border-edge px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Podium bonus</p>
                    <p className="font-type text-3xl text-ink">+{result?.bonus ?? closing.myClosing.bonus}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Back to dashboard
                </Button>
              </div>
            ) : locked ? (
              <div className="space-y-3">
                <Alert tone="info">
                  {c.status !== 'OPEN'
                    ? 'This case is not open for closing right now.'
                    : 'Solve every sub-file first — the closing challenge unlocks once the case is complete.'}
                </Alert>
                <Button onClick={() => navigate('/dashboard')}>
                  Back to dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3">
                <SectionLabel>Your closing answer</SectionLabel>
                {c.plot && (
                  <div className="rounded-md border border-edge bg-surface/60 px-4 py-3">
                    <p className="whitespace-pre-wrap font-type text-[15px] leading-7 text-ink-soft">{c.plot}</p>
                  </div>
                )}
                <InputBare
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter the case's closing answer…"
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                {!data.case.submissionAllowed && (
                  <Alert tone="info">Submissions are currently disabled.</Alert>
                )}
                {submitError && <Alert tone="danger">{submitError}</Alert>}
                <Button type="submit" disabled={busy || !data.case.submissionAllowed || answer.trim().length === 0}>
                  {busy ? 'Checking…' : 'Close the Case'}
                </Button>
              </form>
            )}

            {hasClosers && (
              <div className="space-y-2">
                <SectionLabel>Standings</SectionLabel>
                <div className="overflow-hidden rounded-md border border-edge">
                  <div className="divide-y divide-edge/60">
                    {c.closers.map((cl) => (
                      <div key={cl.teamId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        {cl.rank <= 3 ? (
                          <Trophy className={`h-4 w-4 ${cl.rank === 1 ? 'text-amber-400' : cl.rank === 2 ? 'text-slate-400' : 'text-orange-300'}`} />
                        ) : (
                          <Lock className="h-4 w-4 text-ink-faint/40" />
                        )}
                        <span className="font-mono text-xs text-ink-faint">#{cl.rank}</span>
                        <span className="truncate font-medium text-ink">{cl.teamName}</span>
                        <Badge tone="gold" className="ml-auto">+{cl.bonus}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}