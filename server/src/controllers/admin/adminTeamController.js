import { AppError, asyncHandler } from '../../middleware/errors.js';
import { MESSAGES } from '../../config.js';
import { events, teams, subs, closings } from '../../db/repo.js';
import { refs, firestore } from '../../db/repo.js';

export const listTeams = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const search = String(req.query.search || '').trim();

  let teamRows = await teams.list(eventId);
  if (search) {
    const q = search.toLowerCase();
    teamRows = teamRows.filter(
      (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q),
    );
  }
  const total = teamRows.length;
  const slice = teamRows.slice((page - 1) * limit, page * limit);

  const [solvedCounts, closureRows] = await Promise.all([subs.solvedCounts(eventId), closings.list(eventId)]);
  const closedByTeam = new Map();
  for (const cl of closureRows) closedByTeam.set(cl.teamId, (closedByTeam.get(cl.teamId) || 0) + 1);

  const out = [];
  for (const t of slice) {
    const members = await teams.members(t.id);
    out.push({
      id: t.id,
      name: t.name,
      code: t.code,
      score: t.score,
      createdAt: t.createdAt,
      solved: solvedCounts.get(t.id) || 0,
      casesClosed: closedByTeam.get(t.id) || 0,
      memberCount: t.memberCount ?? members.length,
      members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, isLeader: m.isLeader })),
    });
  }

  res.json({ total, page, limit, teams: out });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const team = await teams.get(teamId);
  if (!team) throw new AppError(404, MESSAGES.notFound);

  const hasSubs = await subs.hasForTeam(teamId);
  if (hasSubs) throw new AppError(400, 'Cannot delete a team that has submissions.');

  const members = await teams.members(teamId);
  await Promise.all(
    members.map((m) => firestore.doc(`users/${m.id}/memberships/${team.eventId}`).delete()).concat([
      firestore.recursiveDelete(refs.team(teamId)),
    ]),
  );
  res.json({ ok: true });
});