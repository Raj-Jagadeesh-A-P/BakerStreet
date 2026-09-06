import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { MESSAGES, podiumFor } from '../config.js';
import {
  getMembership,
  requireTeamForEvent,
  computeSubFileStates,
  eventViewable,
} from '../services/unlock.js';
import { teamEvidenceRows } from '../services/evidence.js';
import { randomCode } from '../utils/random.js';
import { events, cases, subfiles, subs, teams } from '../db/repo.js';
import { refs, runTransaction, FieldValue } from '../db/repo.js';

const publicEvent = (event, now = null) => ({
  id: event.id,
  name: event.name,
  code: event.code,
  description: event.description,
  status: event.status,
  startTime: event.startTime,
  endTime: event.endTime,
  pausedAt: event.pausedAt,
  teamMinSize: event.teamMinSize,
  teamMaxSize: event.teamMaxSize,
  pollIntervalSeconds: event.pollIntervalSeconds,
  durationMinutes: event.durationMinutes,
  now: now ?? new Date().toISOString(),
});

export const joinByCode = [
  validate(z.object({ code: z.string().trim().min(1).max(50) })),
  asyncHandler(async (req, res) => {
    const code = req.body.code.trim().toUpperCase();
    const event = await events.getByCode(code);
    if (!event) throw new AppError(404, 'Invalid event code.');
    const membership = await getMembership(event.id, req.user.id);
    res.json({
      event: publicEvent(event),
      team: membership?.team ? { id: membership.team.id, name: membership.team.name } : null,
    });
  }),
];

export const getEvent = asyncHandler(async (req, res) => {
  const event = await events.get(req.params.id);
  if (!event) throw new AppError(404, MESSAGES.notFound);
  const membership = await getMembership(event.id, req.user.id);
  res.json({
    event: publicEvent(event),
    team: membership?.team ? { id: membership.team.id, name: membership.team.name } : null,
  });
});

export const createTeam = [
  validate(z.object({ name: z.string().trim().min(1).max(60) })),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const event = await events.get(eventId);
    if (!event) throw new AppError(404, MESSAGES.notFound);
    if (event.status === 'ENDED') throw new AppError(400, MESSAGES.ended);

    const existing = await getMembership(eventId, req.user.id);
    if (existing) throw new AppError(400, MESSAGES.alreadyInTeam);
    if (event.teamMaxSize < 1) throw new AppError(400, 'Invalid team size configuration.');

    const teamName = req.body.name.trim();
    const nameDup = await teams.getByName(eventId, teamName);
    if (nameDup) {
      throw new AppError(409, 'A team with this name already exists in this investigation.');
    }

    let code = randomCode(6);
    for (let i = 0; i < 5; i++) {
      const dup = await teams.getByCode(eventId, code);
      if (!dup) break;
      code = randomCode(6);
    }

    const teamId = await runTransaction(async (tx) => {
      const teamRef = refs.teams().doc();
      tx.create(teamRef, {
        eventId,
        name: teamName,
        code,
        score: 0,
        memberCount: 1,
        createdAt: new Date(),
      });
      const uid = req.user.id;
      tx.create(refs.member(teamRef.id, uid), {
        isLeader: true,
        name: req.user.name,
        email: req.user.email,
        createdAt: new Date(),
      });
      tx.create(refs.membership(uid, eventId), {
        teamId: teamRef.id,
        isLeader: true,
        createdAt: new Date(),
      });
      return teamRef.id;
    });
    res.status(201).json({ team: { id: teamId, name: teamName, code } });
  }),
];

export const joinTeam = [
  validate(z.object({ code: z.string().trim().min(1).max(20) })),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const event = await events.get(eventId);
    if (!event) throw new AppError(404, MESSAGES.notFound);
    if (event.status === 'ENDED') throw new AppError(400, MESSAGES.ended);

    const existing = await getMembership(eventId, req.user.id);
    if (existing) throw new AppError(400, MESSAGES.alreadyInTeam);

    const team = await teams.getByCode(eventId, req.body.code.trim().toUpperCase());
    if (!team) throw new AppError(404, 'Invalid team code.');

    const memberCount = team.memberCount ?? (await teams.members(team.id)).length;
    if (memberCount >= event.teamMaxSize) throw new AppError(400, MESSAGES.teamFull);

    await runTransaction(async (tx) => {
      const uid = req.user.id;
      tx.create(refs.member(team.id, uid), {
        isLeader: false,
        name: req.user.name,
        email: req.user.email,
        createdAt: new Date(),
      });
      tx.create(refs.membership(uid, eventId), {
        teamId: team.id,
        isLeader: false,
        createdAt: new Date(),
      });
      tx.update(refs.team(team.id), { memberCount: FieldValue.increment(1) });
    });
    res.json({ team: { id: team.id, name: team.name, code: team.code } });
  }),
];

export const dashboard = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const { team } = await requireTeamForEvent(eventId, req.user.id);

  const [caseRows, memberRows, solvedAll, teamScores, evidence] = await Promise.all([
    cases.list(eventId),
    teams.members(team.id),
    subs.solvedFileIdsAll(team.id),
    teams.list(eventId),
    teamEvidenceRows(team.id, eventId),
  ]);

  let continueTarget = null;
  const progress = [];
  for (const c of caseRows) {
    const fileMeta = await subfiles.list(c.id);
    const solvedCount = fileMeta.filter((f) => f.published && solvedAll.has(f.id)).length;
    const totalCount = fileMeta.filter((f) => f.published).length;
    progress.push({ id: c.id, solved: solvedCount, total: totalCount });
    if (c.status === 'OPEN' && !continueTarget) {
      const states = computeSubFileStates(c, fileMeta, solvedAll);
      continueTarget = states.continueTarget;
    }
  }

  const openCase = caseRows.find((c) => c.status === 'OPEN') || null;
  const rank = teamScores.findIndex((t) => t.id === team.id) + 1;

  res.json({
    event: publicEvent(event),
    submissionAllowed: eventViewable(event) && event.status === 'LIVE',
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      score: team.score,
      rank,
      identity: req.user.identity,
      isLeader: memberRows.some((m) => m.id === req.user.id && m.isLeader),
      members: memberRows.map((m) => ({ id: m.id, name: m.name, isLeader: m.isLeader })),
    },
    currentCase: openCase
      ? {
          id: openCase.id,
          order: openCase.order,
          title: openCase.title,
          plot: openCase.plot,
          status: openCase.status,
          startsAt: openCase.startsAt,
          closedAt: openCase.closedAt,
          podium: podiumFor(openCase),
        }
      : null,
    cases: caseRows.map((c) => {
      const p = progress.find((x) => x.id === c.id) || { solved: 0, total: 0 };
      return {
        id: c.id,
        order: c.order,
        title: c.title,
        published: c.published,
        status: c.status,
        startsAt: c.startsAt,
        closedAt: c.closedAt,
        files: p,
      };
    }),
    continue: continueTarget,
    evidence,
  });
});