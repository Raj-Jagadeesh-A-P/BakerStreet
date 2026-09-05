import { AppError } from '../middleware/errors.js';
import { MESSAGES } from '../config.js';
import { memberships, teams, subs } from '../db/repo.js';

export async function getMembership(eventId, userId) {
  const m = await memberships.get(userId, eventId);
  if (!m) return null;
  const team = await teams.get(m.teamId);
  return { ...m, team };
}

export async function requireTeamForEvent(eventId, userId) {
  const membership = await getMembership(eventId, userId);
  if (!membership) throw new AppError(403, MESSAGES.notJoined);
  return { team: membership.team, isLeader: membership.isLeader };
}

export async function solvedCaseIds(teamId) {
  return subs.solvedCaseIds(teamId);
}

// Builds per-case status for a team. Sequential unlock: the first published,
// non-final case without a correct submission is the unlocked one; the final
// case unlocks when every published non-final case is solved.
export function computeCaseStates(cases, solved) {
  const published = cases.filter((c) => c.published).sort((a, b) => a.order - b.order);
  const normalCases = published.filter((c) => !c.finalCase);
  const finalCase = published.find((c) => c.finalCase) || null;
  const firstUnsolved = normalCases.find((c) => !solved.has(c.id)) || null;
  // True when every published non-final case is solved (vacuous when there are none).
  const allNormalSolved = firstUnsolved === null;

  const states = new Map();
  for (const c of published) {
    let status;
    if (!c.finalCase) {
      if (solved.has(c.id)) status = 'SOLVED';
      else if (firstUnsolved && firstUnsolved.id === c.id) status = 'UNLOCKED';
      else status = 'LOCKED';
    } else {
      status = allNormalSolved ? 'UNLOCKED' : 'LOCKED';
    }
    states.set(c.id, {
      id: c.id,
      order: c.order,
      title: c.title,
      finalCase: c.finalCase,
      published: c.published,
      status,
      points: c.points,
    });
  }
  const hasActive = !!firstUnsolved || !!finalCase;
  const continueCaseId = firstUnsolved ? firstUnsolved.id : finalCase ? finalCase.id : null;

  return { states, firstUnsolved, finalCase, allNormalSolved, continueCaseId, hasActive };
}

export function eventViewable(event) {
  return event.status === 'LIVE' || event.status === 'PAUSED' || event.status === 'ENDED';
}

// Throws an AppError with a participant-safe message when the event state does
// not allow answering questions / using hints.
export function assertSubmittable(event) {
  if (event.status === 'PAUSED') throw new AppError(400, MESSAGES.paused);
  if (event.status !== 'LIVE') throw new AppError(400, MESSAGES.notStarted);
  if (event.startTime && new Date(event.startTime).getTime() > Date.now()) {
    throw new AppError(400, MESSAGES.notStarted);
  }
  if (event.endTime && new Date(event.endTime).getTime() < Date.now()) {
    throw new AppError(400, MESSAGES.ended);
  }
}

export async function attemptsUsed(teamId, caseId) {
  return subs.attempts(teamId, caseId);
}