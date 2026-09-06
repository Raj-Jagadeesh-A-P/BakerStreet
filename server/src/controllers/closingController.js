import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { MESSAGES } from '../config.js';
import { requireTeamForEvent, computeSubFileStates, assertSubmittable } from '../services/unlock.js';
import { normalize, isAnswerCorrect } from '../services/validation.js';
import { applyScore, podiumBonus } from '../services/scoring.js';
import { cases, subfiles, subs, closings, teams, events } from '../db/repo.js';
import { refs, runTransaction } from '../db/repo.js';

// Auto-checks the closing (final) answer of a Case and awards the podium
// bonus. Rank is decided inside a transaction by reading/advancing the Case's
// closureCount, so the first three teams to commit a correct closing get 1st,
// 2nd and 3rd in a deterministic order.
export const submitClosing = [
  validate(z.object({ answer: z.string().min(1).max(2000) })),
  asyncHandler(async (req, res) => {
    const { eid, cid } = req.params;
    const cas = await cases.get(cid);
    if (!cas || cas.eventId !== eid) throw new AppError(404, MESSAGES.notFound);
    const event = await events.get(eid);

    const { team } = await requireTeamForEvent(eid, req.user.id);
    assertSubmittable(event);

    const existing = await closings.getByTeam(cid, team.id);
    if (existing) {
      return res.json({
        correct: true,
        closed: true,
        alreadyClosed: true,
        rank: existing.rank,
        bonus: existing.bonus,
        score: team.score,
        message: MESSAGES.alreadyClosed,
      });
    }

    if (cas.status === 'CLOSED') throw new AppError(400, MESSAGES.caseClosed);
    if (cas.status !== 'OPEN') throw new AppError(400, MESSAGES.caseNotOpen);

    const fileRows = await subfiles.list(cid);
    const solved = await subs.solvedFileIds(team.id, cid);
    const states = computeSubFileStates(cas, fileRows, solved);
    if (!states.allFilesSolved) throw new AppError(400, MESSAGES.notAllFiles);

    const closing = cas.closing || {};
    const accepted = Array.isArray(closing.answers) ? closing.answers : [];
    const pseudo = {
      type: 'TEXT',
      regex: closing.regex || '',
      caseInsensitive: closing.caseInsensitive !== false,
      normalize: closing.normalize !== false,
    };
    const raw = String(req.body.answer ?? '');
    const correct = isAnswerCorrect(pseudo, accepted, raw);

    if (!correct) {
      return res.json({ correct: false, message: MESSAGES.incorrect });
    }

    const answer = normalize(raw, pseudo);

    let out;
    try {
      out = await runTransaction(async (tx) => {
        const caseRef = refs.case(cid);
        const caseSnap = await tx.get(caseRef);
        const count = caseSnap.exists ? caseSnap.data().closureCount ?? 0 : 0;
        const rank = count + 1;

        const closingRef = refs.closingDoc();
        const bonus = podiumBonus(cas, rank);

        let score;
        if (bonus) {
          const applied = await applyScore(
            tx,
            eid,
            team.id,
            bonus,
            `Case closed: ${cas.title} (rank #${rank})`,
            'CLOSING',
            closingRef.id,
          );
          score = applied.score;
        } else {
          const teamSnap = await tx.get(refs.team(team.id));
          score = teamSnap.exists ? teamSnap.data().score ?? 0 : 0;
        }

        tx.update(caseRef, { closureCount: rank });
        tx.create(closingRef, {
          eventId: eid,
          caseId: cid,
          teamId: team.id,
          rank,
          bonus,
          answer,
          closedAt: new Date(),
        });
        return { rank, bonus, score };
      });
    } catch {
      const raced = await closings.getByTeam(cid, team.id);
      if (raced) {
        const teamRow = await teams.get(team.id);
        return res.json({
          correct: true,
          closed: true,
          alreadyClosed: true,
          rank: raced.rank,
          bonus: raced.bonus,
          score: teamRow?.score ?? team.score,
          message: MESSAGES.alreadyClosed,
        });
      }
      throw new AppError(400, MESSAGES.generic);
    }

    res.json({
      correct: true,
      closed: true,
      rank: out.rank,
      bonus: out.bonus,
      score: out.score,
      message: 'Case closed!',
    });
  }),
];