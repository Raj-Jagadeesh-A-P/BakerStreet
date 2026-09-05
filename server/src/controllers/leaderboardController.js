import { AppError, asyncHandler } from '../middleware/errors.js';
import { MESSAGES } from '../config.js';
import { events, teams, subs, finals } from '../db/repo.js';

export const leaderboard = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const [teamRows, solvedCounts, finalRows] = await Promise.all([
    teams.list(eventId),
    subs.solvedCounts(eventId),
    finals.list(eventId),
  ]);
  const finalByTeam = new Map(finalRows.map((f) => [f.teamId, f]));

  const teamsOut = teamRows.map((t, i) => ({
    rank: i + 1,
    id: t.id,
    name: t.name,
    score: t.score,
    solved: solvedCounts.get(t.id) || 0,
    memberCount: t.memberCount ?? 0,
    finalSubmitted: finalByTeam.has(t.id),
  }));

  res.json({
    event: { id: event.id, name: event.name, code: event.code, status: event.status },
    pollIntervalSeconds: event.pollIntervalSeconds,
    updatedAt: new Date().toISOString(),
    teams: teamsOut,
  });
});