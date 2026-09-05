import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { MESSAGES } from '../config.js';
import {
  requireTeamForEvent,
  solvedCaseIds,
  computeCaseStates,
  eventViewable,
  assertSubmittable,
} from '../services/unlock.js';
import { normalize, isAnswerCorrect, sanitizeAnswer } from '../services/validation.js';
import { applyScore } from '../services/scoring.js';
import { cases, answers, hints, hintUsages, subs, events } from '../db/repo.js';
import { refs, runTransaction } from '../db/repo.js';

function submissionsAllowed(event) {
  return (
    event.status === 'LIVE' &&
    (!event.startTime || new Date(event.startTime).getTime() <= Date.now()) &&
    (!event.endTime || new Date(event.endTime).getTime() >= Date.now())
  );
}

export const getCase = asyncHandler(async (req, res) => {
  const caseId = req.params.id;
  const cas = await cases.get(caseId);
  if (!cas) throw new AppError(404, MESSAGES.notFound);
  const event = await events.get(cas.eventId);
  if (!eventViewable(event)) throw new AppError(403, MESSAGES.notStarted);

  const { team } = await requireTeamForEvent(cas.eventId, req.user.id);
  const metas = await cases.list(cas.eventId);
  const solved = await solvedCaseIds(team.id);
  const states = computeCaseStates(metas, solved);
  const st = states.states.get(caseId);
  if (!st || st.status === 'LOCKED') throw new AppError(403, MESSAGES.locked);

  const [attempts, hintRows, usedHints, correctRow] = await Promise.all([
    subs.attempts(team.id, caseId),
    hints.list(caseId),
    hintUsages.byCase(team.id, caseId),
    subs.correctForTeamCase(team.id, caseId),
  ]);

  const usedSet = new Set(usedHints.map((u) => u.hintId));
  const isSolved = !!correctRow;

  res.json({
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      startTime: event.startTime,
      endTime: event.endTime,
      pausedAt: event.pausedAt,
    },
    case: {
      id: cas.id,
      order: cas.order,
      title: cas.title,
      finalCase: cas.finalCase,
      type: cas.type,
      story: cas.story,
      question: cas.question,
      githubUrl: cas.githubUrl,
      options: cas.type === 'MULTIPLE_CHOICE' ? cas.options?.options || [] : undefined,
      points: cas.points,
      wrongPenalty: cas.wrongPenalty,
      maxAttempts: cas.maxAttempts,
      solved: isSolved,
      attemptsUsed: attempts,
      attemptsLeft: cas.maxAttempts == null ? null : Math.max(0, cas.maxAttempts - attempts),
      submissionAllowed: submissionsAllowed(event),
      hints: hintRows.map((h) => ({ id: h.id, title: h.title, text: usedSet.has(h.id) ? h.text : undefined, cost: h.cost, order: h.order, used: usedSet.has(h.id) })),
    },
  });
});

export const submit = [
  validate(z.object({ answer: z.string().min(1).max(2000) })),
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const cas = await cases.get(caseId);
    if (!cas) throw new AppError(404, MESSAGES.notFound);
    if (cas.finalCase) {
      throw new AppError(400, 'The final case uses the Final Investigation form.');
    }
    const event = await events.get(cas.eventId);

    const { team } = await requireTeamForEvent(cas.eventId, req.user.id);
    assertSubmittable(event);

    const metas = await cases.list(cas.eventId);
    const solved = await solvedCaseIds(team.id);
    if (solved.has(caseId)) {
      return res.json({
        correct: true,
        solved: true,
        alreadySolved: true,
        score: team.score,
        message: 'This case is already solved.',
      });
    }
    const states = computeCaseStates(metas, solved);
    const st = states.states.get(caseId);
    if (!st || st.status === 'LOCKED') throw new AppError(403, MESSAGES.locked);

    const used = await subs.attempts(team.id, caseId);
    if (cas.maxAttempts != null && used >= cas.maxAttempts) {
      throw new AppError(400, MESSAGES.maxAttempts);
    }

    const answer = normalize(sanitizeAnswer(cas, req.body.answer), cas);
    const accepted = (await answers.list(caseId)).map((a) => a.value);
    const correct = isAnswerCorrect(cas, accepted, answer);

    const delta = correct ? +cas.points : cas.wrongPenalty > 0 ? -cas.wrongPenalty : 0;

    const result = await runTransaction(async (tx) => {
      const subRef = refs.submissionDoc();
      let score;
      if (delta) {
        const reason = correct ? `Correct answer: Case ${cas.title}` : `Wrong answer: Case ${cas.title}`;
        const applied = await applyScore(tx, cas.eventId, team.id, delta, reason, 'SUBMISSION', subRef.id);
        score = applied.score;
      } else {
        const snap = await tx.get(refs.team(team.id));
        score = snap.exists ? snap.data().score ?? 0 : 0;
      }
      tx.create(subRef, {
        eventId: cas.eventId,
        teamId: team.id,
        caseId,
        answer,
        correct,
        createdAt: new Date(),
      });
      return { score };
    });

    let unlockedNext = null;
    if (correct) {
      const nextSolved = new Set(solved);
      nextSolved.add(caseId);
      unlockedNext = computeCaseStates(metas, nextSolved).continueCaseId;
    }

    res.json({
      correct,
      solved: correct,
      answer: correct ? answer : undefined,
      score: result.score,
      unlockedNext,
      attemptsLeft: cas.maxAttempts == null ? null : Math.max(0, cas.maxAttempts - used - 1),
      message: correct ? 'Correct!' : MESSAGES.incorrect,
    });
  }),
];

export const useHint = asyncHandler(async (req, res) => {
  const caseId = req.params.id;
  const hintId = req.params.hintId;
  const cas = await cases.get(caseId);
  if (!cas) throw new AppError(404, MESSAGES.notFound);
  const event = await events.get(cas.eventId);

  const { team } = await requireTeamForEvent(cas.eventId, req.user.id);
  assertSubmittable(event);

  const metas = await cases.list(cas.eventId);
  const solved = await solvedCaseIds(team.id);
  const states = computeCaseStates(metas, solved);
  const st = states.states.get(caseId);
  if (!st || st.status === 'LOCKED') throw new AppError(403, MESSAGES.locked);

  const hint = await hints.get(caseId, hintId);
  if (!hint) throw new AppError(404, MESSAGES.notFound);

  const existing = await hintUsages.get(team.id, hintId);
  if (existing) throw new AppError(400, MESSAGES.hintUsed);

  let score;
  try {
    score = await runTransaction(async (tx) => {
      const applied = await applyScore(
        tx,
        cas.eventId,
        team.id,
        -hint.cost,
        `Hint used: ${hint.title || 'Hint'}`,
        'HINT',
        hintId,
      );
      tx.create(refs.hintUsageDoc(), {
        eventId: cas.eventId,
        teamId: team.id,
        caseId,
        hintId,
        cost: hint.cost,
        createdAt: new Date(),
      });
      return applied.score;
    });
  } catch {
    const raced = await hintUsages.get(team.id, hintId);
    if (raced) throw new AppError(400, MESSAGES.hintUsed);
    throw new AppError(400, MESSAGES.generic);
  }

  res.json({
    hint: { id: hint.id, title: hint.title, text: hint.text, cost: hint.cost },
    score,
  });
});