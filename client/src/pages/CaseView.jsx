import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink, Lightbulb, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { useAuth } from '../context/auth.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert } from '../components/ui/alert.jsx';
import { InputBare } from '../components/ui/input.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

const IDENTITY_LABELS = {
  PRIVATE_CLIENT: 'Private Client',
  SCOTLAND_YARD: 'Scotland Yard',
  MYCROFT_HOLMES: 'Mycroft Holmes',
};

function AnswerInput({ type, options, value, onChange }) {
  if (type === 'MULTIPLE_CHOICE') {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              value === o ? 'border-mark bg-mark/10 font-medium text-ink' : 'border-edge text-ink-soft hover:bg-ink/5'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }
  return (
    <InputBare
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderFor(type)}
      className={`font-mono ${type === 'COMMIT_SHA' || type === 'NUMBER' ? 'tracking-wide' : ''}`}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

function placeholderFor(type) {
  switch (type) {
    case 'GITHUB_REPOSITORY':
      return 'owner/repository';
    case 'COMMIT_SHA':
      return 'full 40-character commit SHA…';
    case 'NUMBER':
      return '…';
    case 'URL':
      return 'https://…';
    case 'USERNAME':
      return 'username';
    default:
      return 'Your answer…';
  }
}

function SectionLabel({ children }) {
  return <h2 className="font-type text-xs tracking-[0.28em] text-mark">{children}</h2>;
}

export default function CaseView() {
  const { cid, fid } = useParams();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const [eventId, setEventId] = useState(membership?.eventId ?? null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [answer, setAnswer] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justSolved, setJustSolved] = useState(false);
  const [next, setNext] = useState(null);
  const [revealedHints, setRevealedHints] = useState({});
  const [hintBusy, setHintBusy] = useState(null);
  const [hintError, setHintError] = useState(null);

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
        const d = await api(`/events/${eid}/cases/${cid}/files/${fid}`);
        if (!alive) return;
        setData(d);
        const revealed = {};
        d.file.hints.forEach((h) => (revealed[h.id] = h.used ? h : false));
        setRevealedHints(revealed);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cid, fid, membership?.eventId, navigate]);

  if (loading) return <PageState message="Opening sub-file…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { event, case: parent } = data;
  const f = data.file;
  const locked = f.status === 'LOCKED';
  const canSubmit = !f.solved && !locked && data.submissionAllowed;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setBusy(true);
    try {
      const r = await api(`/events/${eventId}/cases/${cid}/files/${fid}/submit`, {
        method: 'POST',
        body: { answer },
      });
      if (r.correct) {
        setJustSolved(true);
        setNext(r.continue);
        setData((prev) => ({ ...prev, file: { ...prev.file, solved: true } }));
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

  async function useHint(hintId) {
    setHintBusy(hintId);
    setHintError(null);
    try {
      const r = await api(`/events/${eventId}/cases/${cid}/files/${fid}/hints/${hintId}/use`, {
        method: 'POST',
      });
      setRevealedHints((prev) => ({ ...prev, [hintId]: r.hint }));
    } catch (err) {
      setHintError(err.message);
    } finally {
      setHintBusy(null);
    }
  }

  function goNext() {
    if (!next) {
      navigate('/dashboard');
      return;
    }
    if (next.type === 'CLOSING') {
      navigate(`/final/${cid}`);
    } else {
      navigate(`/case/${cid}/${next.id}`);
    }
  }

  function getHint(id) {
    return revealedHints[id];
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <nav className="mb-4 font-mono text-xs text-ink-faint">
          <button className="underline" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">
            Case {String(parent.order).padStart(2, '0')} · Sub-file {String(f.order).padStart(2, '0')}
          </span>
        </nav>

        <Card className="mb-6 overflow-hidden">
          <div className="noir-texture border-b border-edge bg-solid px-5 py-4 text-white">
            <p className="font-type text-xs tracking-[0.3em] text-mark-bright/80">
              {parent.title}
              {parent.giver ? ` · from ${IDENTITY_LABELS[parent.giver]}` : ''} · Sub-file {String(f.order).padStart(2, '0')}
            </p>
            <h1 className="mt-1 font-type text-2xl">{f.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-white/70">
              <span>Worth {f.points} pts</span>
              {f.maxAttempts != null && <span>• {f.attemptsLeft} of {f.maxAttempts} attempts left</span>}
              <Badge tone={f.solved ? 'success' : 'gold'} className="ml-auto">
                {f.solved ? 'Solved' : locked ? 'Locked' : 'Unlocked'}
              </Badge>
            </div>
          </div>

          <CardContent className="space-y-7">
            {locked ? (
              <section className="space-y-3">
                <Alert tone="info">
                  This sub-file is locked. Solve the earlier sub-files first — the case unlocks strictly in order.
                </Alert>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Back to dashboard
                </Button>
              </section>
            ) : (
              <>
                {f.story && (
                  <section className="space-y-2">
                    <SectionLabel>Case File</SectionLabel>
                    <div className="rounded-md border border-edge bg-surface/60 px-4 py-3">
                      <p className="whitespace-pre-wrap font-type text-[15px] leading-7 text-ink-soft">{f.story}</p>
                    </div>
                  </section>
                )}

                {f.question && (
                  <section className="space-y-2">
                    <SectionLabel>Question</SectionLabel>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{f.question}</p>
                    {f.githubUrl && (
                      <a
                        href={f.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-edge px-3 font-mono text-sm font-medium text-ink-soft hover:bg-ink/5"
                      >
                        Open GitHub <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </section>
                )}

                {f.evidence.length > 0 && (
                  <section className="space-y-2">
                    <SectionLabel>Evidence in this file</SectionLabel>
                    <div className="overflow-hidden rounded-md border border-edge">
                      <div className="divide-y divide-edge/60">
                        {f.evidence.map((e, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                            <span className="w-44 shrink-0 font-medium text-ink-faint">{e.label}</span>
                            <span className="truncate font-mono text-ink">{e.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                <section className="space-y-3">
                  <SectionLabel>Your Answer</SectionLabel>
                  {justSolved ? (
                    <div className="space-y-4">
                      <Alert tone="success" className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" /> Correct! Evidence has been recorded.
                        {next && next.type === 'CLOSING' && <span>All sub-files solved — you can close the case.</span>}
                      </Alert>
                      <Button onClick={goNext}>
                        {next ? (next.type === 'CLOSING' ? 'Close the Case →' : 'Continue to next sub-file →') : 'Back to dashboard'}
                      </Button>
                    </div>
                  ) : f.solved ? (
                    <Alert tone="success">This sub-file is already solved by your team.</Alert>
                  ) : (
                    <form onSubmit={onSubmit} className="space-y-3">
                      <AnswerInput type={f.type} options={f.options?.options} value={answer} onChange={setAnswer} />
                      {!data.submissionAllowed && (
                        <Alert tone="info">
                          {event.status === 'PAUSED'
                            ? 'The investigation is paused. Submissions are disabled.'
                            : 'Submissions are currently disabled.'}
                        </Alert>
                      )}
                      {submitError && <Alert tone="danger">{submitError}</Alert>
                      }
                      <Button type="submit" disabled={busy || !canSubmit || answer.trim().length === 0}>
                        {busy ? 'Checking…' : 'Submit Answer'}
                      </Button>
                    </form>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>

        {!locked && f.hints.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="flex items-center gap-2 font-type text-xs tracking-[0.28em] text-mark">
                <Lightbulb className="h-4 w-4" /> Need help?
              </h2>
              {hintError && <Alert tone="danger" className="mt-3">{hintError}</Alert>}
              <div className="mt-3 space-y-2">
                {f.hints.map((h) => {
                  const revealed = getHint(h.id);
                  return (
                    <div key={h.id} className="rounded-md border border-edge p-3">
                      {revealed ? (
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-ink">
                            {h.title} <Badge tone="gold">-{h.cost} pts</Badge>
                          </div>
                          <p className="mt-1 font-type text-[15px] leading-7 text-ink-soft">{revealed.text}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-ink-soft">
                              {h.title} <span className="text-ink-faint">— costs {h.cost} points</span>
                            </p>
                            <span className="redacted mt-1 inline-block h-3.5 w-40 opacity-50" aria-hidden title="Redacted — use a hint to read this" />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={hintBusy === h.id || !data.submissionAllowed || f.solved}
                            onClick={() => useHint(h.id)}
                          >
                            {hintBusy === h.id ? '…' : 'Use Hint'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}