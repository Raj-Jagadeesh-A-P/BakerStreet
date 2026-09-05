import { refs } from '../db/repo.js';

// Applies a score delta to a team inside a Firestore transaction, floors at
// zero, and records a ScoreEvent for audit. The recorded delta is the change
// that was actually applied, so SUM(ScoreEvent.delta) always equals Team.score.
// Callers must ensure all reads happen before any writes inside the
// transaction: applyScore's own reads come first, then its writes.
export async function applyScore(tx, eventId, teamId, delta, reason, refType, refId) {
  if (!delta) return null;
  const teamRef = refs.team(teamId);
  const snap = await tx.get(teamRef);
  const score = snap.exists ? snap.data().score ?? 0 : 0;
  const next = Math.max(0, score + delta);
  const applied = next - score;
  if (applied === 0) return { applied: 0, score: next };
  tx.update(teamRef, { score: next });
  tx.create(refs.scoreEventDoc(), {
    eventId,
    teamId,
    delta: applied,
    reason,
    refType,
    refId,
    createdAt: new Date(),
  });
  return { applied, score: next };
}