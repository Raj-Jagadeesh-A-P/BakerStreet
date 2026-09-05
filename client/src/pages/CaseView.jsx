import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink, Lightbulb, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert } from '../components/ui/alert.jsx';
import { InputBare } from '../components/ui/input.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

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
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [answer, setAnswer] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justSolved, setJustSolved] = useState(false);
  const [unlockedNext, setUnlockedNext] = useState(null);
  const [revealedHints, setRevealedHints] = useState({});
  const [hintBusy, setHintBusy] = useState(null);
  const [hintError, setHintError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api(`/cases/${id}`)
      .then((d) => {
        if (!alive) return;
        setCaseData(d);
        const revealed = {};
        d.case.hints.forEach((h) => (revealed[h.id] = h.used ? h : false));
        setRevealedHints(revealed);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <PageState message="Opening case file…" />;
  if (error) return <ErrorState error={error} />;
  if (!caseData) return null;

  const { event, case: c } = caseData;
  const isFinal = c.finalCase;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setBusy(true);
    try {
      const r = await api(`/cases/${c.id}/submit`, { method: 'POST', body: { answer } });
      if (r.correct) {
        setJustSolved(true);
        setUnlockedNext(r.unlockedNext);
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
      const r = await api(`/cases/${c.id}/hints/${hintId}/use`, { method: 'POST' });
      setRevealedHints((prev) => ({ ...prev, [hintId]: r.hint }));
    } catch (err) {
      setHintError(err.message);
    } finally {
      setHintBusy(null);
    }
  }

  function goNext() {
    if (isFinal) {
      navigate('/final');
    } else if (unlockedNext) {
      navigate(`/case/${unlockedNext}`);
    } else {
      navigate('/dashboard');
    }
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
            {isFinal ? 'Final Case' : `Case ${String(c.order).padStart(2, '0')}`}
          </span>
        </nav>

        <Card className="mb-6 overflow-hidden">
          <div className="noir-texture border-b border-edge bg-solid px-5 py-4 text-white">
            <p className="font-type text-xs tracking-[0.3em] text-mark-bright/80">
              {isFinal ? 'Final Case' : `Case ${String(c.order).padStart(2, '0')}`}
            </p>
            <h1 className="mt-1 font-type text-2xl">{c.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-white/70">
              <span>Worth {c.points} pts</span>
              {c.maxAttempts != null && <span>• {c.attemptsLeft} of {c.maxAttempts} attempts left</span>}
              <Badge tone={c.solved ? 'success' : 'gold'} className="ml-auto">{c.solved ? 'Solved' : 'Unlocked'}</Badge>
            </div>
          </div>

          <CardContent className="space-y-7">
            {c.story && (
              <section className="space-y-2">
                <SectionLabel>Case File</SectionLabel>
                <div className="rounded-md border border-edge bg-surface/60 px-4 py-3">
                  <p className="whitespace-pre-wrap font-type text-[15px] leading-7 text-ink-soft">{c.story}</p>
                </div>
              </section>
            )}

            <section className="space-y-2">
              <SectionLabel>Question</SectionLabel>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{c.question}</p>
              {c.githubUrl && (
                <a
                  href={c.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-edge px-3 font-mono text-sm font-medium text-ink-soft hover:bg-ink/5"
                >
                  Open GitHub <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </section>

            {!isFinal ? (
              <section className="space-y-3">
                <SectionLabel>Your Answer</SectionLabel>
                {justSolved ? (
                  <div className="space-y-4">
                    <Alert tone="success" className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" /> Correct! Evidence has been recorded.
                    </Alert>
                    <Button onClick={goNext}>
                      {isFinal || unlockedNext ? 'Continue to next case →' : 'Back to dashboard'}
                    </Button>
                  </div>
                ) : c.solved ? (
                  <Alert tone="success">This case is already solved by your team.</Alert>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-3">
                    <AnswerInput type={c.type} options={c.options} value={answer} onChange={setAnswer} />
                    {!c.submissionAllowed && (
                      <Alert tone="info">
                        {event.status === 'PAUSED' ? 'The event is paused. Submissions are disabled.' : 'Submissions are currently disabled.'}
                      </Alert>
                    )}
                    {submitError && <Alert tone="danger">{submitError}</Alert>}
                    <Button type="submit" disabled={busy || !c.submissionAllowed || answer.trim().length === 0}>
                      {busy ? 'Checking…' : 'Submit Answer'}
                    </Button>
                  </form>
                )}
              </section>
            ) : (
              <section className="space-y-3">
                <SectionLabel>Final Step</SectionLabel>
                <Alert tone="info">
                  This is the final investigation. Submit your full report through the Final Investigation form.
                </Alert>
                <Button className="mt-2" onClick={() => navigate('/final')}>
                  Open Final Investigation
                </Button>
              </section>
            )}
          </CardContent>
        </Card>

        {c.hints.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="flex items-center gap-2 font-type text-xs tracking-[0.28em] text-mark">
                <Lightbulb className="h-4 w-4" /> Need help?
              </h2>
              {hintError && <Alert tone="danger" className="mt-3">{hintError}</Alert>}
              <div className="mt-3 space-y-2">
                {c.hints.map((h) => {
                  const revealed = revealedHints[h.id];
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
                            disabled={hintBusy === h.id || !c.submissionAllowed || c.solved}
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