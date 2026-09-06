import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

export default function AdminSubmissions() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [correct, setCorrect] = useState('');
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api(`/admin/events/${eventId}/cases`);
        setCases(res.cases);
      } catch {
        /* non-fatal */
      }
    })();
  }, [eventId]);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page, limit: 30 });
      if (correct) q.set('correct', correct);
      if (caseId) q.set('caseId', caseId);
      setData(await api(`/admin/events/${eventId}/submissions?${q}`));
    } catch (e) {
      setError(e.message);
    }
  }, [eventId, page, correct, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [correct, caseId]);

  function resetFilters() {
    setCorrect('');
    setCaseId('');
  }

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading submissions…" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-type text-2xl text-ink">Submissions</h1>
          <p className="text-sm text-ink-faint">{data.total} total responses</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-10 rounded-md border border-edge bg-surface px-2 text-sm text-ink" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">All cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>#{c.order} {c.title}</option>
            ))}
          </select>
          <select className="h-10 rounded-md border border-edge bg-surface px-2 text-sm text-ink" value={correct} onChange={(e) => setCorrect(e.target.value)}>
            <option value="">All results</option>
            <option value="true">Correct</option>
            <option value="false">Incorrect</option>
          </select>
          {(correct || caseId) && (
            <Button size="sm" variant="ghost" onClick={resetFilters}>Clear</Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Team</TH>
                <TH>Case</TH>
                <TH>Sub-File</TH>
                <TH className="w-1/3">Answer</TH>
                <TH>Result</TH>
                <TH className="text-right">When</TH>
              </TR>
            </THead>
            <TBody>
              {data.submissions.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">No submissions match.</TD>
                </TR>
              )}
              {data.submissions.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium text-ink">{s.team.name}</TD>
                  <TD>
                    <span className="text-xs text-ink-faint">#{s.case.order}</span> {s.case.title}
                  </TD>
                  <TD className="max-w-0 truncate text-ink-soft">
                    <span className="text-xs text-ink-faint">#{s.file.order}</span> {s.file.title}
                  </TD>
                  <TD className="max-w-0 truncate font-mono text-xs text-ink-soft">{s.answer}</TD>
                  <TD>
                    <Badge tone={s.correct ? 'success' : 'danger'}>{s.correct ? 'correct' : 'wrong'}</Badge>
                  </TD>
                  <TD className="text-right text-xs text-ink-faint">{new Date(s.createdAt).toLocaleString()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {data.total > data.limit && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-ink-faint">{page} / {Math.ceil(data.total / data.limit)}</span>
          <Button size="sm" variant="outline" disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}