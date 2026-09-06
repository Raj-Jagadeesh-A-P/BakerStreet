import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

export default function AdminClosings() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api(`/admin/events/${eventId}/closings`));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [eventId]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading closings…" />;

  const byCase = new Map();
  for (const cl of data.closings) {
    const list = byCase.get(cl.caseId) || [];
    list.push(cl);
    byCase.set(cl.caseId, list);
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-type text-2xl text-ink">Closings</h1>
        <p className="text-sm text-ink-faint">
          First three teams to close a case win the podium bonus. A case is read-only once closed.
        </p>
      </div>

      {data.closings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-faint">No closings yet.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Rank</TH>
                  <TH>Team</TH>
                  <TH>Case</TH>
                  <TH className="text-right">Bonus</TH>
                  <TH className="text-right">When</TH>
                </TR>
              </THead>
              <TBody>
                {data.closings.map((cl) => (
                  <TR key={cl.id}>
                    <TD className={cl.rank <= 3 ? 'font-type text-mark' : 'font-type text-ink'}>{cl.rank}</TD>
                    <TD className="font-medium text-ink">{cl.teamName}</TD>
                    <TD>
                      <span className="text-xs text-ink-faint">#{cl.caseOrder}</span> {cl.caseTitle}
                    </TD>
                    <TD className="text-right">
                      <Badge tone={cl.rank <= 3 ? 'gold' : 'default'}>+{cl.bonus}</Badge>
                    </TD>
                    <TD className="text-right text-xs text-ink-faint">{new Date(cl.closedAt).toLocaleString()}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 space-y-1">
        {data.cases.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs text-ink-faint">#{c.order}</span>
            <span className="text-ink">{c.title}</span>
            {byCase.get(c.id)?.length ? (
              <span className="flex items-center gap-1 font-mono text-xs text-mark">
                <Trophy className="h-3 w-3" /> {byCase.get(c.id).length} closing{byCase.get(c.id).length === 1 ? '' : 's'}
              </span>
            ) : (
              <Badge>{c.status}</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}