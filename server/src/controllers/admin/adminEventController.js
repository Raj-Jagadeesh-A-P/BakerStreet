import { z } from 'zod';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { MESSAGES, finalScoring } from '../../config.js';
import { events, cases, subs, finals } from '../../db/repo.js';

const eventFields = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(50),
  description: z.string().max(2000).optional().or(z.literal('')),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  teamMinSize: z.number().int().min(1).max(20).optional(),
  teamMaxSize: z.number().int().min(1).max(20).optional(),
  pollIntervalSeconds: z.number().int().min(3).max(300).optional(),
  finalScoring: z.record(z.string(), z.number().int().min(0)).nullable().optional(),
});

export const listEvents = asyncHandler(async (req, res) => {
  const eventRows = await events.list();
  const out = [];
  for (const e of eventRows) {
    const [teamCount, caseCount] = await Promise.all([events.teamCount(e.id), cases.count(e.id)]);
    out.push({
      id: e.id,
      name: e.name,
      code: e.code,
      status: e.status,
      createdAt: e.createdAt,
      teamCount,
      caseCount,
    });
  }
  res.json({ events: out });
});

export const createEvent = [
  validate(eventFields),
  asyncHandler(async (req, res) => {
    const { name, code, ...rest } = req.body;
    const codeUpper = code.trim().toUpperCase();
    const dup = await events.getByCode(codeUpper);
    if (dup) throw new AppError(409, 'An event with this code already exists.');
    const event = await events.create({
      name: name.trim(),
      code: codeUpper,
      description: rest.description ?? '',
      durationMinutes: rest.durationMinutes ?? 180,
      teamMinSize: rest.teamMinSize ?? 2,
      teamMaxSize: rest.teamMaxSize ?? 3,
      pollIntervalSeconds: rest.pollIntervalSeconds ?? 8,
      finalScoring: rest.finalScoring ?? undefined,
    });
    res.status(201).json({ event });
  }),
];

export const getEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const eventData = await events.get(eventId);
  if (!eventData) throw new AppError(404, MESSAGES.notFound);

  const caseRows = await cases.list(eventId);
  const event = {
    ...eventData,
    cases: caseRows.map((c) => ({ id: c.id, order: c.order, title: c.title, finalCase: c.finalCase, published: c.published })),
  };

  const [teams, participants, solvedSubs, totalSubs, finalCount] = await Promise.all([
    events.teamCount(eventId),
    events.participantCount(eventId),
    subs.solvedTotal(eventId),
    subs.total(eventId),
    finals.count(eventId),
  ]);

  res.json({
    event,
    scoring: finalScoring(event),
    stats: { teams, participants, solvedSubs, totalSubs, finals: finalCount },
  });
});

export const updateEvent = [
  validate(eventFields.partial()),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const existing = await events.get(eventId);
    if (!existing) throw new AppError(404, MESSAGES.notFound);

    const data = { ...req.body };
    if (typeof data.code === 'string' && data.code.trim().toUpperCase() !== existing.code) {
      const codeUpper = data.code.trim().toUpperCase();
      const dup = await events.getByCode(codeUpper);
      if (dup) throw new AppError(409, 'An event with this code already exists.');
      data.code = codeUpper;
    }
    if (data.teamMaxSize != null && data.teamMinSize != null && data.teamMaxSize < data.teamMinSize) {
      throw new AppError(400, 'Maximum team size cannot be less than minimum team size.');
    }
    if (typeof data.name === 'string') data.name = data.name.trim();

    const event = await events.update(eventId, data);
    res.json({ event });
  }),
];

export const startEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const ev = await events.get(eventId);
  if (!ev) throw new AppError(404, MESSAGES.notFound);
  if (ev.status === 'ENDED') throw new AppError(400, 'Event has ended and cannot be restarted.');

  const nowDate = new Date();
  let data;
  if (ev.status === 'PAUSED' && ev.pausedAt) {
    const pauseMs = nowDate.getTime() - new Date(ev.pausedAt).getTime();
    data = {
      status: 'LIVE',
      pausedAt: null,
      endTime: ev.endTime ? new Date(new Date(ev.endTime).getTime() + pauseMs) : null,
    };
  } else {
    const startTime = ev.startTime ?? nowDate;
    data = {
      status: 'LIVE',
      pausedAt: null,
      startTime,
      endTime: ev.endTime ?? new Date(startTime.getTime() + ev.durationMinutes * 60000),
    };
  }
  const event = await events.update(eventId, data);
  res.json({ event });
});

export const pauseEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const ev = await events.get(eventId);
  if (!ev) throw new AppError(404, MESSAGES.notFound);
  if (ev.status !== 'LIVE') throw new AppError(400, 'Only a live event can be paused.');
  const event = await events.update(eventId, { status: 'PAUSED', pausedAt: new Date() });
  res.json({ event });
});

export const endEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const ev = await events.get(eventId);
  if (!ev) throw new AppError(404, MESSAGES.notFound);
  const event = await events.update(eventId, {
    status: 'ENDED',
    pausedAt: null,
    endTime: ev.endTime ?? new Date(),
  });
  res.json({ event });
});

export const resetEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const ev = await events.get(eventId);
  if (!ev) throw new AppError(404, MESSAGES.notFound);
  const event = await events.update(eventId, {
    status: 'DRAFT',
    startTime: null,
    endTime: null,
    pausedAt: null,
  });
  res.json({ event });
});