import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { MESSAGES } from '../config.js';
import {
  getMembership,
  requireTeamForEvent,
  solvedCaseIds,
  computeCaseStates,
  eventViewable,
} from '../services/unlock.js';
import { teamEvidenceRows } from '../services/evidence.js';
import { randomCode } from '../utils/random.js';
import { events, cases, subs, hintUsages, teams, finals } from '../db/repo.js';
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

    let code = randomCode(6);
    for (let i = 0; i < 5; i++) {
      const dup = await teams.getByCode(eventId, code);
      if (!dup) break;
      code = randomCode(6);
    }

    const teamName = req.body.name.trim();
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

  const [metas, solved, attemptsByCase, usages, memberRows, finalRow, teamScores] = await Promise.all([
    cases.list(eventId),
    solvedCaseIds(team.id),
    subs.countsByCase(team.id),
    hintUsages.listForTeam(team.id),
    teams.members(team.id),
    finals.getByTeam(team.id),
    teams.list(eventId),
  ]);

  const states = computeCaseStates(metas, solved);
  const hintsByCase = new Map();
  for (const u of usages) {
    hintsByCase.set(u.caseId, (hintsByCase.get(u.caseId) || 0) + 1);
  }

  const caseRows = metas
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const st = states.states.get(c.id);
      const used = attemptsByCase.get(c.id) || 0;
      return {
        id: c.id,
        order: c.order,
        title: c.title,
        finalCase: c.finalCase,
        published: c.published,
        status: st.status,
        points: c.points,
        attemptsUsed: used,
        attemptsLeft: c.maxAttempts == null ? null : Math.max(0, c.maxAttempts - used),
        hintsUsed: hintsByCase.get(c.id) || 0,
      };
    });

  const rank = teamScores.findIndex((t) => t.id === team.id) + 1;
  const evidence = await teamEvidenceRows(team.id, eventId);

  res.json({
    event: publicEvent(event),
    submissionAllowed:
      eventViewable(event) &&
      event.status === 'LIVE' &&
      (!event.endTime || new Date(event.endTime).getTime() > Date.now()) &&
      (!event.startTime || new Date(event.startTime).getTime() <= Date.now()),
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      score: team.score,
      rank,
      isLeader: memberRows.some((m) => m.id === req.user.id && m.isLeader),
      members: memberRows.map((m) => ({ id: m.id, name: m.name, isLeader: m.isLeader })),
      finalSubmitted: !!finalRow,
    },
    cases: caseRows,
    evidence,
    continueCaseId: states.continueCaseId,
  });
});