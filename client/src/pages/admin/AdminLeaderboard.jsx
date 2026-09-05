import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

export default function AdminLeaderboard() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api(`/events/${eventId}/leaderboard`));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [eventId]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageState message="Loading leaderboard…" />;

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-type text-2xl text-ink">Leaderboard</h1>
        <p className="text-sm text-ink-faint">
          {data.event.name} · <Badge tone="info">{data.event.status}</Badge>
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14">Rank</TH>
                <TH>Team</TH>
                <TH className="text-right">Solved</TH>
                <TH className="text-right">Score</TH>
              </TR>
            </THead>
            <TBody>
              {data.teams.map((t) => (
                <TR key={t.id}>
                  <TD className="font-bold text-ink">
                    {t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : `#${t.rank}`}
                  </TD>
                  <TD className="font-medium text-ink">{t.name}</TD>
                  <TD className="text-right tabular-nums">{t.solved}</TD>
                  <TD className="text-right font-bold tabular-nums text-ink">{t.score}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}