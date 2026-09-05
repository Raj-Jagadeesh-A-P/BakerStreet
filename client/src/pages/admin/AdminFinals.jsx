import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Scale, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Dialog } from '../../components/ui/dialog.jsx';
import { Field, InputBare } from '../../components/ui/input.jsx';
import { Alert } from '../../components/ui/alert.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

const STATUS_TONE = { SUBMITTED: 'info', SCORED: 'gold', REJECTED: 'danger' };
const FIELDS = [
  ['suspectedContributor', 'Suspected Contributor'],
  ['commitSha', 'Commit SHA'],
  ['relatedIssue', 'Related Issue'],
  ['relatedPr', 'Related PR'],
  ['whatHappened', 'What happened'],
  ['fix', 'Proposed fix'],
  ['evidenceExplanation', 'Evidence'],
];

const KEYS = ['contributor', 'commit', 'issue', 'pr', 'rootCause', 'fix', 'evidence'];

export default function AdminFinals() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [judgeError, setJudgeError] = useState(null);
  const [scores, setScores] = useState({});

  const load = useCallback(async () => {
    try {
      setData(await api(`/admin/events/${eventId}/finals`));
    } catch (e) {
      setError(e.message);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openRow(row) {
    setOpen(row);
    setJudgeError(null);
    setScores({});
    try {
      const res = await api(`/admin/finals/${row.id}`);
      setDetail(res.submission);
      const fallback = {};
      for (const k of KEYS) fallback[k] = res.submission.breakdown?.[k] ?? '';
      setScores(fallback);
    } catch (e) {
      setJudgeError(e.message);
    }
  }

  async function judge(status) {
    setBusy(true);
    setJudgeError(null);
    try {
      const breakdown = {};
      let totalScore = 0;
      for (const k of KEYS) {
        const v = Number(scores[k]) || 0;
        breakdown[k] = v;
        totalScore += v;
      }
      await api(`/admin/finals/${open.id}/judge`, {
        method: 'POST',
        body: { status, totalScore: status === 'SCORED' ? totalScore : undefined, breakdown },
      });
      setOpen(null);
      await load();
    } catch (e) {
      setJudgeError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading finals…" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-type text-2xl text-ink">Final Investigation</h1>
          <p className="text-sm text-ink-faint">Judge the open-ended final case submissions.</p>
        </div>
        {data.blankFinalCaseExists && (
          <Badge tone="default">Final case template ready</Badge>
        )}
      </div>

      <div className="space-y-2">
        {data.rows.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-faint">No final submissions yet.</CardContent>
          </Card>
        )}
        {data.rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.teamName}</p>
                <p className="text-xs text-ink-faint">Submitted {new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[r.status]}>
                  {r.status} {r.totalScore != null ? `· ${r.totalScore}` : ''}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => openRow(r)}>
                  <Scale className="h-4 w-4" /> {r.status === 'SUBMITTED' ? 'Judge' : 'Review'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={`Judge — ${open?.teamName}`} wide>
        {!detail ? (
          <PageState message="Loading submission…" />
        ) : (
          <div className="space-y-5">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{detail[key] || '—'}</p>
              </div>
            ))}

            {detail.attachmentPath && (
              <a
                href={`/uploads/${encodeURIComponent(detail.attachmentPath)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-mark underline"
              >
                View attachment <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <div className="rounded-md border border-edge p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">Scoring breakdown (max per the event config)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {KEYS.map((k) => (
                  <Field key={k} label={k.replace(/([a-z])([A-Z])/g, '$1 $2')}>
                    <InputBare
                      type="number"
                      min={0}
                      value={scores[k] ?? ''}
                      onChange={(e) => setScores((s) => ({ ...s, [k]: e.target.value }))}
                      placeholder={data.scoring[k] ?? 0}
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Total: <span className="font-bold text-ink">{KEYS.reduce((a, k) => a + (Number(scores[k]) || 0), 0)}</span>
              </p>
            </div>

            {judgeError && <Alert tone="danger">{judgeError}</Alert>}

            <div className="flex justify-end gap-2">
              <Button variant="danger" disabled={busy} onClick={() => judge('REJECTED')}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button disabled={busy} onClick={() => judge('SCORED')}>
                <CheckCircle2 className="h-4 w-4" /> Score {busy ? '…' : ''}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}