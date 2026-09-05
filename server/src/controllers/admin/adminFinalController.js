import { z } from 'zod';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { MESSAGES, finalScoring } from '../../config.js';
import { applyScore } from '../../services/scoring.js';
import { events, cases, teams, finals } from '../../db/repo.js';
import { refs, runTransaction } from '../../db/repo.js';

export const listFinals = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const [caseRows, finalRows] = await Promise.all([cases.list(eventId), finals.list(eventId)]);
  const finalCases = caseRows.filter((c) => c.finalCase);

  const rows = [];
  for (const r of finalRows) {
    const team = await teams.get(r.teamId);
    rows.push({
      id: r.id,
      teamId: r.teamId,
      teamName: team?.name ?? '?',
      status: r.status,
      totalScore: r.totalScore,
      breakdown: r.breakdown,
      createdAt: r.createdAt,
      judgedAt: r.judgedAt,
      hasAttachment: !!r.attachmentPath,
      attachmentPath: r.attachmentPath,
    });
  }

  res.json({
    scoring: finalScoring(event),
    rows,
    blankFinalCaseExists: finalCases.length > 0,
  });
});

export const getFinal = asyncHandler(async (req, res) => {
  const finalId = req.params.id;
  const row = await finals.get(finalId);
  if (!row) throw new AppError(404, MESSAGES.notFound);
  const team = await teams.get(row.teamId);
  res.json({
    submission: {
      ...row,
      team: team ? { id: team.id, name: team.name, score: team.score } : null,
    },
  });
});

const judgeSchema = z.object({
  status: z.enum(['SCORED', 'REJECTED']),
  totalScore: z.number().int().min(0).max(100000).optional(),
  breakdown: z.record(z.string(), z.number().int().min(0)).optional(),
});

export const judgeFinal = [
  validate(judgeSchema),
  asyncHandler(async (req, res) => {
    const finalId = req.params.id;
    const row = await finals.get(finalId);
    if (!row) throw new AppError(404, MESSAGES.notFound);
    const event = await events.get(row.eventId);
    if (req.body.status === 'SCORED' && req.body.totalScore == null) {
      throw new AppError(400, 'A total score is required to mark a submission as scored.');
    }

    const previousScore = row.status === 'SCORED' ? row.totalScore ?? 0 : 0;
    const newTotal = req.body.status === 'SCORED' ? req.body.totalScore : 0;
    const delta = newTotal - previousScore;

    await runTransaction(async (tx) => {
      if (delta !== 0) {
        await applyScore(tx, row.eventId, row.teamId, delta, 'Final case judged', 'FINAL', finalId);
      }
      tx.update(refs.final(finalId), {
        status: req.body.status,
        totalScore: req.body.status === 'SCORED' ? req.body.totalScore : null,
        breakdown: req.body.status === 'SCORED' ? req.body.breakdown ?? null : null,
        judgedAt: new Date(),
      });
    });

    const updated = await finals.get(finalId);
    const team = await teams.get(updated.teamId);
    res.json({
      submission: {
        ...updated,
        team: team ? { id: team.id, name: team.name, score: team.score } : null,
      },
    });
  }),
];