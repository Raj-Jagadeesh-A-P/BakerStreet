import { AppError, asyncHandler } from '../../middleware/errors.js';
import { MESSAGES } from '../../config.js';
import { events, closings, teams, cases } from '../../db/repo.js';

export const listClosings = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const closureRows = await closings.list(eventId);
  const out = [];
  for (const cl of closureRows) {
    const [team, caseRow] = await Promise.all([teams.get(cl.teamId), cases.get(cl.caseId)]);
    out.push({
      id: cl.id,
      teamId: cl.teamId,
      teamName: team?.name ?? '?',
      caseId: cl.caseId,
      caseTitle: caseRow?.title ?? '?',
      caseOrder: caseRow?.order ?? 0,
      rank: cl.rank,
      bonus: cl.bonus,
      closedAt: cl.closedAt,
    });
  }

  const caseIds = [...new Set(closureRows.map((c) => c.caseId))];
  const caseRows = await Promise.all(caseIds.map((id) => cases.get(id)));

  res.json({
    closings: out,
    cases: caseRows
      .filter(Boolean)
      .map((c) => ({ id: c.id, order: c.order, title: c.title, status: c.status })),
  });
});