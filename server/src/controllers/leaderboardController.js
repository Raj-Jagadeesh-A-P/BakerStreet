import { AppError, asyncHandler } from '../middleware/errors.js';
import { MESSAGES } from '../config.js';
import { events, teams, subs, closings, cases } from '../db/repo.js';

export const leaderboard = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const [teamRows, solvedCounts, closureRows, caseRows] = await Promise.all([
    teams.list(eventId),
    subs.solvedCounts(eventId),
    closings.list(eventId),
    cases.list(eventId),
  ]);

  const closedByTeam = new Map();
  const closersByCase = new Map();
  for (const cl of closureRows) {
    closedByTeam.set(cl.teamId, (closedByTeam.get(cl.teamId) || 0) + 1);
    const list = closersByCase.get(cl.caseId) || [];
    list.push({ rank: cl.rank, teamId: cl.teamId, bonus: cl.bonus, closedAt: cl.closedAt });
    closersByCase.set(cl.caseId, list);
  }

  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));
  const casesOut = caseRows
    .map((c) => ({
      id: c.id,
      order: c.order,
      title: c.title,
      status: c.status,
      closers: (closersByCase.get(c.id) || [])
        .sort((a, b) => a.rank - b.rank)
        .map((cl) => ({ ...cl, teamName: teamNameById.get(cl.teamId) || '?' })),
    }))
    .sort((a, b) => a.order - b.order);

  const teamsOut = teamRows.map((t, i) => ({
    rank: i + 1,
    id: t.id,
    name: t.name,
    score: t.score,
    solved: solvedCounts.get(t.id) || 0,
    casesClosed: closedByTeam.get(t.id) || 0,
    memberCount: t.memberCount ?? 0,
  }));

  res.json({
    event: { id: event.id, name: event.name, code: event.code, status: event.status },
    pollIntervalSeconds: event.pollIntervalSeconds,
    updatedAt: new Date().toISOString(),
    cases: casesOut,
    teams: teamsOut,
  });
});