import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { ParticipantHeader } from '../components/brand.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Field, Textarea } from '../components/ui/input.jsx';
import { Alert } from '../components/ui/alert.jsx';
import { PageState, ErrorState } from '../components/ui/state.jsx';

const FIELDS = [
  ['suspectedContributor', 'Suspected Contributor', 'GitHub username you believe is responsible'],
  ['commitSha', 'Suspicious Commit SHA', 'Full SHA of the commit that introduced the problem'],
  ['relatedIssue', 'Related Issue', 'Issue number / link'],
  ['relatedPr', 'Related Pull Request', 'PR number / link'],
  ['whatHappened', 'What happened?', 'Describe the bug and how it broke the release'],
  ['fix', 'How would you fix it?', 'Describe the fix you would propose'],
  ['evidenceExplanation', 'Evidence / Explanation', 'Cite the files, commits, issues that support your conclusion'],
];

export default function Final() {
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api('/auth/me');
        if (!me.membership) {
          navigate('/join', { replace: true });
          return;
        }
        const d = await api(`/events/${me.membership.eventId}/dashboard`);
        const nextId = d.continueCaseId;
        if (!nextId) throw new Error('The final case is not unlocked yet.');
        const c = await api(`/cases/${nextId}`);
        if (!c.case.finalCase) {
          navigate(`/case/${nextId}`, { replace: true });
          return;
        }
        setCaseData({ ...c, teamName: d?.team?.name || '' });
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  function set(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      for (const key of Object.keys(form)) fd.append(key, form[key]);
      if (file) fd.append('attachment', file);
      await api('/final/submit', { method: 'POST', body: fd });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageState message="Opening the final case…" />;
  if (loadError) return <ErrorState error={loadError} onRetry={() => navigate('/dashboard')} />;
  if (!caseData) return null;

  const { case: c } = caseData;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <nav className="mb-4 font-mono text-xs text-ink-faint">
          <button className="underline" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">Final Investigation</span>
        </nav>

        <Card className="mb-6 overflow-hidden">
          <div className="noir-texture border-b border-edge bg-solid px-5 py-4 text-white">
            <p className="font-type text-xs tracking-[0.3em] text-mark-bright/80">Final Case</p>
            <h1 className="mt-1 font-type text-2xl">{c.title}</h1>
          </div>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-edge bg-surface/60 px-4 py-3">
              <p className="whitespace-pre-wrap font-type text-[15px] leading-7 text-ink-soft">{c.story}</p>
            </div>
            <p className="whitespace-pre-wrap rounded-md bg-ink/5 p-3 font-type text-[15px] leading-7 text-ink">{c.question}</p>
          </CardContent>
        </Card>

        {done ? (
          <Card>
            <CardContent className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="font-semibold text-ink">Investigation submitted</p>
              <p className="text-sm text-ink-faint">
                A judge will review your findings and award points. Watch the leaderboard.
              </p>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <h2 className="font-type text-2xl tracking-[0.2em] text-ink">Final Investigation</h2>
              <p className="mt-1 text-xs text-ink-faint">Team: {caseData?.teamName || 'your team'}</p>
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                {FIELDS.map(([key, label, hint]) => (
                  <Field key={key} label={label}>
                    <Textarea
                      rows={key === 'whatHappened' || key === 'fix' || key === 'evidenceExplanation' ? 5 : 2}
                      required={key === 'suspectedContributor' || key === 'commitSha' || key === 'whatHappened' || key === 'fix' || key === 'evidenceExplanation'}
                      value={form[key] || ''}
                      onChange={set(key)}
                      placeholder={hint}
                      className="font-mono"
                    />
                  </Field>
                ))}
                <Field label="Evidence attachment (optional)">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-ink/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-ink/15"
                  />
                  <span className="mt-1 block text-xs text-ink-faint">PNG, JPG, WebP or PDF (max 5MB).</span>
                </Field>
                {error && <Alert tone="danger">{error}</Alert>}
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Submitting…' : 'Submit Investigation'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}