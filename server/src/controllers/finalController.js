import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { uploadSingle } from '../middleware/upload.js';
import { MESSAGES } from '../config.js';
import { requireTeamForEvent, solvedCaseIds, computeCaseStates } from '../services/unlock.js';
import { memberships, teams, events, cases, finals } from '../db/repo.js';
import { refs, runTransaction } from '../db/repo.js';

const finalSchema = z.object({
  suspectedContributor: z.string().trim().min(1).max(100),
  commitSha: z.string().trim().min(1).max(100),
  relatedIssue: z.string().trim().max(100).optional().or(z.literal('')),
  relatedPr: z.string().trim().max(100).optional().or(z.literal('')),
  whatHappened: z.string().trim().min(10).max(5000),
  fix: z.string().trim().min(10).max(5000),
  evidenceExplanation: z.string().trim().min(10).max(5000),
});

export const submitFinal = [
  uploadSingle,
  validate(finalSchema),
  asyncHandler(async (req, res) => {
    const membership = await memberships.lookup(req.user.id);
    if (!membership) throw new AppError(403, MESSAGES.notJoined);

    const team = await teams.get(membership.teamId);
    if (!team) throw new AppError(403, MESSAGES.notJoined);
    const eventId = team.eventId;

    const { team: requireTeam } = await requireTeamForEvent(eventId, req.user.id);
    void requireTeam;

    const event = await events.get(eventId);
    const existing = await finals.getByTeam(team.id);
    if (existing) throw new AppError(400, MESSAGES.finalExists);

    // Event must be LIVE and the final case must be unlocked.
    if (event.status !== 'LIVE') throw new AppError(400, event.status === 'PAUSED' ? MESSAGES.paused : MESSAGES.notStarted);
    if (event.endTime && new Date(event.endTime).getTime() < Date.now()) throw new AppError(400, MESSAGES.ended);

    const metas = await cases.list(eventId);
    const solved = await solvedCaseIds(team.id);
    const states = computeCaseStates(metas, solved);
    const finalMeta = metas.find((m) => m.finalCase && m.published);
    if (!finalMeta || states.states.get(finalMeta.id)?.status !== 'UNLOCKED') {
      throw new AppError(403, MESSAGES.finalLocked);
    }

    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;

    let id;
    try {
      id = await runTransaction(async (tx) => {
        const ref = refs.finalDoc();
        tx.create(ref, {
          eventId,
          teamId: team.id,
          suspectedContributor: req.body.suspectedContributor.trim(),
          commitSha: req.body.commitSha.trim(),
          relatedIssue: (req.body.relatedIssue || '').trim(),
          relatedPr: (req.body.relatedPr || '').trim(),
          whatHappened: req.body.whatHappened.trim(),
          fix: req.body.fix.trim(),
          evidenceExplanation: req.body.evidenceExplanation.trim(),
          attachmentPath,
          status: 'SUBMITTED',
          createdAt: new Date(),
        });
        return ref.id;
      });
    } catch {
      const raced = await finals.getByTeam(team.id);
      if (raced) throw new AppError(400, MESSAGES.finalExists);
      throw new AppError(400, MESSAGES.generic);
    }

    res.status(201).json({ submitted: true, id });
  }),
];