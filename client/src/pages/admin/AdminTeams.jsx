import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { InputBare } from '../../components/ui/input.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

export default function AdminTeams() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/admin/events/${eventId}/teams?page=${page}&limit=20&search=${encodeURIComponent(search)}`));
    } catch (e) {
      setError(e.message);
    }
  }, [eventId, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  async function remove(t) {
    if (!window.confirm(`Delete team “${t.name}”?`)) return;
    try {
      await api(`/admin/teams/${t.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading teams…" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-type text-2xl text-ink">Teams</h1>
          <p className="text-sm text-ink-faint">{data.total} teams registered</p>
        </div>
        <InputBare value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams…" className="w-56" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Team</TH>
                <TH>Members</TH>
                <TH className="text-right">Solved</TH>
                <TH className="text-right">Score</TH>
                <TH>Final</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {data.teams.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">No teams found.</TD>
                </TR>
              )}
              {data.teams.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <p className="font-medium text-ink">{t.name}</p>
                    <p className="font-mono text-xs text-ink-faint">{t.code}</p>
                  </TD>
                  <TD>
                    {t.members.map((m) => (
                      <span key={m.id} className="mr-2 inline-block rounded bg-ink/5 px-1.5 py-0.5 text-xs text-ink-soft">
                        {m.name}
                        {m.isLeader && ' 👑'}
                      </span>
                    ))}
                  </TD>
                  <TD className="text-right tabular-nums">{t.solved}</TD>
                  <TD className="text-right font-semibold tabular-nums text-ink">{t.score}</TD>
                  <TD>
                    {t.finalStatus ? (
                      <Badge tone={t.finalStatus === 'SCORED' ? 'gold' : t.finalStatus === 'REJECTED' ? 'danger' : 'info'}>
                        {t.finalStatus} {t.finalScore != null ? `· ${t.finalScore}` : ''}
                      </Badge>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </TD>
                  <TD>
                    <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </TD>
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
          <span className="text-ink-faint">Page {page}</span>
          <Button size="sm" variant="outline" disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}