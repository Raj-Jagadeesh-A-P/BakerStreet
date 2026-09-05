import { AppError, asyncHandler } from '../middleware/errors.js';
import { MESSAGES } from '../config.js';
import { teams } from '../db/repo.js';
import { teamEvidenceRows } from '../services/evidence.js';

export const getEvidence = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  let eventId;
  const team = await teams.get(teamId);
  if (!team) throw new AppError(404, MESSAGES.notFound);
  if (req.user.role === 'ADMIN') {
    eventId = team.eventId;
  } else {
    const isMember = await teams.isMember(teamId, req.user.id);
    if (!isMember) throw new AppError(403, MESSAGES.notJoined);
    eventId = team.eventId;
  }
  const rows = await teamEvidenceRows(teamId, eventId);
  res.json({ evidence: rows });
});