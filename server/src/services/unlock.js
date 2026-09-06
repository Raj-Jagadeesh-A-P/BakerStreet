import { AppError } from '../middleware/errors.js';
import { MESSAGES } from '../config.js';
import { memberships, teams } from '../db/repo.js';

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

// Builds per-sub-file status for a team within one Case. Unlock is strictly
// sequential: a sub-file is SOLVED, then the next published one is UNLOCKED,
// everything after is LOCKED. The closing challenge unlocks once every
// published sub-file is solved AND the Case is OPEN.
//
// The effective solved set is the longest valid prefix of the published,
// ordered sub-files. If the stored solved set has holes (e.g. legacy data with
// file 3 solved but not file 2) the hole is re-sealed: the solved files past
// the gap are ignored for navigation, so the team simply replays the missing
// step instead of dead-ending on an "already completed" case sub-file.
export function computeSubFileStates(caseRow, files, solved) {
  const published = files
    .filter((f) => f.published)
    .sort((a, b) => a.order - b.order);

  const effective = new Set();
  for (const f of published) {
    if (solved.has(f.id)) effective.add(f.id);
    else break;
  }

  const firstUnsolved = published.find((f) => !effective.has(f.id)) || null;
  const states = new Map();
  for (const f of published) {
    let status;
    if (effective.has(f.id)) status = 'SOLVED';
    else if (firstUnsolved && firstUnsolved.id === f.id) status = 'UNLOCKED';
    else status = 'LOCKED';
    states.set(f.id, {
      id: f.id,
      order: f.order,
      title: f.title,
      published: f.published,
      points: f.points,
      status,
    });
  }

  const allFilesSolved = firstUnsolved === null;
  const opening = caseRow?.status === 'OPEN';
  const closingUnlocked = allFilesSolved && opening;
  const closed = caseRow?.status === 'CLOSED';

  // continue points at the next sub-file, else the closing challenge, else null.
  const continueTarget = firstUnsolved
    ? { type: 'FILE', id: firstUnsolved.id }
    : closingUnlocked
      ? { type: 'CLOSING', id: caseRow?.id }
      : null;

  return { states, published, effective, firstUnsolved, allFilesSolved, closingUnlocked, closed, continueTarget };
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

// The Case must be admin-opened (global availability gate).
export function assertCaseOpen(caseRow) {
  if (!caseRow) throw new AppError(404, MESSAGES.notFound);
  if (caseRow.status === 'CLOSED') throw new AppError(400, MESSAGES.caseClosed);
  if (caseRow.status !== 'OPEN') throw new AppError(400, MESSAGES.caseNotOpen);
}