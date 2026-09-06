import { AppError, asyncHandler } from '../../middleware/errors.js';
import { MESSAGES } from '../../config.js';
import { events, subs, teams, cases, subfiles } from '../../db/repo.js';

export const listSubmissions = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
  const { caseId, fileId, correct, teamId } = req.query;

  let rows = await subs.listForEvent(eventId);
  if (caseId) rows = rows.filter((r) => r.caseId === caseId);
  else if (fileId) rows = rows.filter((r) => r.fileId === fileId);
  if (correct !== undefined && correct !== '') rows = rows.filter((r) => r.correct === (correct === 'true'));
  if (teamId) rows = rows.filter((r) => r.teamId === teamId);

  const total = rows.length;
  const slice = rows.slice((page - 1) * limit, page * limit);

  const out = [];
  for (const r of slice) {
    const [team, caseRow, fileRow] = await Promise.all([
      teams.get(r.teamId),
      cases.get(r.caseId),
      subfiles.get(r.caseId, r.fileId),
    ]);
    out.push({
      id: r.id,
      answer: r.answer,
      correct: r.correct,
      createdAt: r.createdAt,
      team: { id: r.teamId, name: team?.name ?? '?' },
      case: { id: r.caseId, title: caseRow?.title ?? '?', order: caseRow?.order ?? 0 },
      file: { id: r.fileId, title: fileRow?.title ?? '?', order: fileRow?.order ?? 0 },
    });
  }

  res.json({ total, page, limit, submissions: out });
});