import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { MESSAGES, podiumFor } from '../config.js';
import {
  requireTeamForEvent,
  computeSubFileStates,
  eventViewable,
  assertSubmittable,
  assertCaseOpen,
} from '../services/unlock.js';
import { normalize, isAnswerCorrect, sanitizeAnswer } from '../services/validation.js';
import { applyScore } from '../services/scoring.js';
import { cases, subfiles, answers, hints, hintUsages, evidence, subs, closings, teams, events } from '../db/repo.js';
import { refs, runTransaction } from '../db/repo.js';

function submissionsAllowed(event) {
  return (
    event.status === 'LIVE' &&
    (!event.startTime || new Date(event.startTime).getTime() <= Date.now()) &&
    (!event.endTime || new Date(event.endTime).getTime() >= Date.now())
  );
}

async function loadCase(eid, cid) {
  const cas = await cases.get(cid);
  if (!cas || cas.eventId !== eid) throw new AppError(404, MESSAGES.notFound);
  return cas;
}

// Full per-team view of one Case: sub-file states, closing challenge state,
// podium standings, and the next thing the team should do.
export const getCase = asyncHandler(async (req, res) => {
  const { eid, cid } = req.params;
  const cas = await loadCase(eid, cid);
  const event = await events.get(eid);
  if (!eventViewable(event)) throw new AppError(403, MESSAGES.notStarted);

  const { team } = await requireTeamForEvent(eid, req.user.id);

  const [fileMeta, solved, attemptsByCase, usedHints, myClosing, closureRows, allTeams] = await Promise.all([
    subfiles.list(cid),
    subs.solvedFileIds(team.id, cid),
    subs.attemptsByCase(team.id, cid),
    hintUsages.listForTeam(team.id),
    closings.getByTeam(cid, team.id),
    closings.listCase(cid),
    teams.list(eid),
  ]);

  const states = computeSubFileStates(cas, fileMeta, solved);
  const hintsUsedByFile = new Map();
  for (const u of usedHints) {
    hintsUsedByFile.set(u.fileId, (hintsUsedByFile.get(u.fileId) || 0) + 1);
  }

  const files = fileMeta
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((f) => {
      const st = states.states.get(f.id);
      const used = attemptsByCase.get(f.id) || 0;
      return {
        id: f.id,
        order: f.order,
        title: f.title,
        type: f.type,
        points: f.points,
        status: st?.status ?? 'LOCKED',
        solved: solved.has(f.id),
        attemptsUsed: used,
        attemptsLeft: f.maxAttempts == null ? null : Math.max(0, f.maxAttempts - used),
        hintsUsed: hintsUsedByFile.get(f.id) || 0,
      };
    });

  const teamById = new Map(allTeams.map((t) => [t.id, t]));

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
      plot: cas.plot,
      status: cas.status,
      startsAt: cas.startsAt,
      closedAt: cas.closedAt,
      published: cas.published,
      podium: podiumFor(cas),
      giver: cas.giver ?? null,
      submissionAllowed: submissionsAllowed(event),
      closing: {
        released: states.allFilesSolved,
        open: states.closingUnlocked,
        closed: states.closed,
        myClosing: myClosing
          ? { rank: myClosing.rank, bonus: myClosing.bonus, closedAt: myClosing.closedAt }
          : null,
      },
      continue: states.continueTarget,
      files,
      closers: closureRows.map((cr) => ({
        rank: cr.rank,
        teamId: cr.teamId,
        teamName: teamById.get(cr.teamId)?.name ?? '?',
        bonus: cr.bonus,
        closedAt: cr.closedAt,
      })),
    },
  });
});

// Full detail for ONE sub-file (the participant-facing puzzle): story, question,
// GitHub link, options, hints (with per-team "used" flags) and evidence. Locked
// sub-files return only their header, never the puzzle contents.
export const getFile = asyncHandler(async (req, res) => {
  const { eid, cid, fid } = req.params;
  const cas = await loadCase(eid, cid);
  const event = await events.get(eid);
  if (!eventViewable(event)) throw new AppError(403, MESSAGES.notStarted);

  const { team } = await requireTeamForEvent(eid, req.user.id);
  const fileRow = await subfiles.get(cid, fid);
  if (!fileRow) throw new AppError(404, MESSAGES.notFound);

  const metas = await subfiles.list(cid);
  const solved = await subs.solvedFileIds(team.id, cid);
  const states = computeSubFileStates(cas, metas, solved);
  const st = states.states.get(fid);
  const locked = !st || st.status === 'LOCKED';

  let hintsOut = [];
  let evidenceOut = [];
  if (!locked) {
    const [hintsIn, usedHints, evidenceIn, used] = await Promise.all([
      hints.list(cid, fid),
      hintUsages.byFile(team.id, cid, fid),
      evidence.list(cid, fid),
      subs.attempts(team.id, cid, fid),
    ]);
    const usedIds = new Set(usedHints.map((u) => u.hintId));
    hintsOut = hintsIn.map((h) => ({ ...h, used: usedIds.has(h.id) }));
    evidenceOut = evidenceIn;
  }

  res.json({
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      startTime: event.startTime,
      endTime: event.endTime,
      pausedAt: event.pausedAt,
    },
    case: { id: cas.id, order: cas.order, title: cas.title, status: cas.status, giver: cas.giver ?? null },
    file: {
      id: fileRow.id,
      order: fileRow.order,
      title: fileRow.title,
      type: fileRow.type,
      points: fileRow.points,
      story: fileRow.story,
      question: fileRow.question,
      githubUrl: fileRow.githubUrl,
      options: fileRow.options,
      maxAttempts: fileRow.maxAttempts,
      solved: solved.has(fid),
      status: st?.status ?? 'LOCKED',
      hints: hintsOut,
      evidence: evidenceOut,
    },
    continue: states.continueTarget,
    submissionAllowed: submissionsAllowed(event),
  });
});

export const submitFile = [
  validate(z.object({ answer: z.string().min(1).max(2000) })),
  asyncHandler(async (req, res) => {
    const { eid, cid, fid } = req.params;
    const cas = await loadCase(eid, cid);
    const fileRow = await subfiles.get(cid, fid);
    if (!fileRow) throw new AppError(404, MESSAGES.notFound);
    const event = await events.get(eid);

    const { team } = await requireTeamForEvent(eid, req.user.id);
    assertSubmittable(event);
    assertCaseOpen(cas);

    const metas = await subfiles.list(cid);
    const solved = await subs.solvedFileIds(team.id, cid);

    // Re-solving an already solved sub-file is a non-error; tell the client its
    // state is stale and hand it the next target (never a dead end).
    if (solved.has(fid)) {
      return res.json({
        correct: true,
        solved: true,
        alreadySolved: true,
        score: team.score,
        message: MESSAGES.alreadySolved,
        continue: computeSubFileStates(cas, metas, solved).continueTarget,
      });
    }
    const states = computeSubFileStates(cas, metas, solved);
    const st = states.states.get(fid);
    if (!st || st.status === 'LOCKED') throw new AppError(403, MESSAGES.locked);

    const used = await subs.attempts(team.id, cid, fid);
    if (fileRow.maxAttempts != null && used >= fileRow.maxAttempts) {
      throw new AppError(400, MESSAGES.maxAttempts);
    }

    const answer = normalize(sanitizeAnswer(fileRow, req.body.answer), fileRow);
    const accepted = (await answers.list(cid, fid)).map((a) => a.value);
    const correct = isAnswerCorrect(fileRow, accepted, answer);

    const delta = correct ? +fileRow.points : fileRow.wrongPenalty > 0 ? -fileRow.wrongPenalty : 0;

    const result = await runTransaction(async (tx) => {
      const subRef = refs.submissionDoc();
      let score;
      if (delta) {
        const reason = correct ? `Solved sub-file: ${fileRow.title}` : `Wrong answer: ${fileRow.title}`;
        const applied = await applyScore(tx, eid, team.id, delta, reason, 'SUBMISSION', subRef.id);
        score = applied.score;
      } else {
        const snap = await tx.get(refs.team(team.id));
        score = snap.exists ? snap.data().score ?? 0 : 0;
      }
      tx.create(subRef, {
        eventId: eid,
        teamId: team.id,
        caseId: cid,
        fileId: fid,
        answer,
        correct,
        createdAt: new Date(),
      });
      return { score };
    });

    let cont = null;
    if (correct) {
      const nextSolved = new Set(solved);
      nextSolved.add(fid);
      cont = computeSubFileStates(cas, metas, nextSolved).continueTarget;
    }

    res.json({
      correct,
      solved: correct,
      answer: correct ? answer : undefined,
      score: result.score,
      continue: cont,
      attemptsLeft: fileRow.maxAttempts == null ? null : Math.max(0, fileRow.maxAttempts - used - 1),
      message: correct ? 'Correct!' : MESSAGES.incorrect,
    });
  }),
];

export const useHint = asyncHandler(async (req, res) => {
  const { eid, cid, fid, hintId } = req.params;
  const cas = await loadCase(eid, cid);
  const fileRow = await subfiles.get(cid, fid);
  if (!fileRow) throw new AppError(404, MESSAGES.notFound);
  const event = await events.get(eid);

  const { team } = await requireTeamForEvent(eid, req.user.id);
  assertSubmittable(event);
  assertCaseOpen(cas);

  const metas = await subfiles.list(cid);
  const solved = await subs.solvedFileIds(team.id, cid);
  const states = computeSubFileStates(cas, metas, solved);
  const st = states.states.get(fid);
  if (!st || st.status === 'LOCKED') throw new AppError(403, MESSAGES.locked);

  const hint = await hints.get(cid, fid, hintId);
  if (!hint) throw new AppError(404, MESSAGES.notFound);

  const existing = await hintUsages.get(team.id, hintId);
  if (existing) throw new AppError(400, MESSAGES.hintUsed);

  let score;
  try {
    score = await runTransaction(async (tx) => {
      const applied = await applyScore(
        tx,
        eid,
        team.id,
        -hint.cost,
        `Hint used: ${hint.title || 'Hint'}`,
        'HINT',
        hintId,
      );
      tx.create(refs.hintUsageDoc(), {
        eventId: eid,
        teamId: team.id,
        caseId: cid,
        fileId: fid,
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