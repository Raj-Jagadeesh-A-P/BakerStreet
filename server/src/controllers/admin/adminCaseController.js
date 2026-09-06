import { z } from 'zod';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { IDENTITIES, MESSAGES } from '../../config.js';
import { events, cases, subfiles, subs, closings } from '../../db/repo.js';
import { refs, firestore } from '../../db/repo.js';

const CASE_TYPES = ['TEXT', 'NUMBER', 'URL', 'GITHUB_REPOSITORY', 'COMMIT_SHA', 'USERNAME', 'MULTIPLE_CHOICE'];

const PUSH_SCHEMA = z.object({
  first: z.number().int().min(0).max(100000).optional(),
  second: z.number().int().min(0).max(100000).optional(),
  third: z.number().int().min(0).max(100000).optional(),
  participation: z.number().int().min(0).max(100000).optional(),
});
const CLOSING_SCHEMA = z.object({
  answers: z.array(z.string().trim().min(1).max(500)).min(1).optional(),
  caseInsensitive: z.boolean().optional(),
  normalize: z.boolean().optional(),
  regex: z.string().max(500).nullable().optional().or(z.literal('')),
});

const caseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  plot: z.string().max(10000).optional().or(z.literal('')),
  published: z.boolean().optional(),
  order: z.number().int().min(1).optional(),
  giver: z.enum(IDENTITIES).nullable().optional(),
  closing: CLOSING_SCHEMA.optional(),
  podium: PUSH_SCHEMA.optional(),
});

const answerSchema = z.object({ value: z.string().trim().min(1).max(500) });
const hintSchema = z.object({
  title: z.string().trim().max(120).optional().or(z.literal('')),
  text: z.string().trim().min(1).max(5000),
  cost: z.number().int().min(0).max(1000),
});
const evidenceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(2000),
});

const fileSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(CASE_TYPES),
  story: z.string().max(10000).optional().or(z.literal('')),
  question: z.string().max(5000).optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  published: z.boolean().optional(),
  caseInsensitive: z.boolean().optional(),
  normalize: z.boolean().optional(),
  regex: z.string().max(500).nullable().optional().or(z.literal('')),
  points: z.number().int().min(0).max(100000).optional(),
  wrongPenalty: z.number().int().min(0).max(10000).optional(),
  maxAttempts: z.number().int().min(1).max(1000).nullable().optional(),
  options: z
    .object({ options: z.array(z.string().min(1).max(500)).min(1) })
    .optional()
    .nullable(),
  answers: z.array(answerSchema).optional(),
  hints: z.array(hintSchema).optional(),
  evidence: z.array(evidenceSchema).optional(),
});

function normalizeFileInput(body) {
  const data = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.type !== undefined) data.type = body.type;
  if (body.published !== undefined) data.published = body.published;
  if (body.caseInsensitive !== undefined) data.caseInsensitive = body.caseInsensitive;
  if (body.normalize !== undefined) data.normalize = body.normalize;
  if (body.points !== undefined) data.points = body.points;
  if (body.wrongPenalty !== undefined) data.wrongPenalty = body.wrongPenalty;
  if (body.maxAttempts !== undefined) data.maxAttempts = body.maxAttempts === null ? null : body.maxAttempts;

  const clean = (v, d) => (v === undefined || v === '' ? d : v);
  data.story = clean(body.story, '');
  data.question = clean(body.question, '');
  data.githubUrl = clean(body.githubUrl, null);
  data.regex = clean(body.regex, null);
  data.options = body.type === 'MULTIPLE_CHOICE' && body.options ? body.options : null;
  return data;
}

// ---------------------------------------------------------------------------
// Cases (parent)
// ---------------------------------------------------------------------------

export const listCases = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);
  const caseRows = await cases.list(eventId);

  const out = [];
  for (const c of caseRows) {
    const [files, closedCount] = await Promise.all([
      subfiles.list(c.id),
      closings.listCase(c.id),
    ]);
    out.push({
      id: c.id,
      order: c.order,
      title: c.title,
      plot: c.plot ?? '',
      status: c.status,
      published: c.published ?? true,
      startsAt: c.startsAt,
      closedAt: c.closedAt,
      closing: c.closing ?? { answers: [] },
      podium: c.podium ?? {},
      giver: c.giver ?? null,
      subFileCount: files.length,
      closureCount: closedCount.length,
      files: files.map((f) => ({
        id: f.id,
        order: f.order,
        title: f.title,
        type: f.type,
        points: f.points,
        published: f.published,
      })),
    });
  }
  res.json({ cases: out });
});

export const createCase = [
  validate(caseSchema),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const event = await events.get(eventId);
    if (!event) throw new AppError(404, MESSAGES.notFound);

    const order = req.body.order ?? (await cases.lastOrder(eventId)) + 1;
    const caseRow = await cases.create(eventId, {
      title: req.body.title,
      plot: req.body.plot ?? '',
      order,
      published: req.body.published ?? true,
      status: 'LOCKED',
      startsAt: null,
      closedAt: null,
      closureCount: 0,
      closing: req.body.closing ?? { answers: [] },
      podium: req.body.podium ?? {},
      giver: req.body.giver ?? null,
    });
    res.status(201).json({ case: caseRow });
  }),
];

export const updateCase = [
  validate(caseSchema.partial()),
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const existing = await cases.get(caseId);
    if (!existing) throw new AppError(404, MESSAGES.notFound);

    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.plot !== undefined) data.plot = req.body.plot;
    if (req.body.published !== undefined) data.published = req.body.published;
    if (req.body.order !== undefined) data.order = req.body.order;
    if (req.body.closing !== undefined) data.closing = req.body.closing;
    if (req.body.podium !== undefined) data.podium = req.body.podium;
    if (req.body.giver !== undefined) data.giver = req.body.giver || null;

    const caseRow = await cases.update(caseId, data);
    res.json({ case: caseRow });
  }),
];

export const deleteCase = asyncHandler(async (req, res) => {
  const caseId = req.params.id;
  const existing = await cases.get(caseId);
  if (!existing) throw new AppError(404, MESSAGES.notFound);

  const [hasSubs, closures] = await Promise.all([subs.hasForCase(caseId), closings.listCase(caseId)]);
  if (hasSubs || closures.length) {
    throw new AppError(400, 'Cannot delete a case that already has submissions or closings.');
  }
  await cases.delete(caseId);
  res.json({ ok: true });
});

export const setPublished = [
  validate(z.object({ published: z.boolean() })),
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const existing = await cases.get(caseId);
    if (!existing) throw new AppError(404, MESSAGES.notFound);
    const updated = await cases.update(caseId, { published: req.body.published });
    res.json({ case: updated });
  }),
];

export const reorderCases = [
  validate(z.object({ orderedCaseIds: z.array(z.union([z.number(), z.string()])).min(1) })),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const caseRows = await cases.list(eventId);
    const ids = new Set(caseRows.map((c) => c.id));
    const given = req.body.orderedCaseIds.map(String);
    const givenSet = new Set(given);
    if (givenSet.size !== ids.size || [...givenSet].some((g) => !ids.has(g))) {
      throw new AppError(400, 'Reorder list must contain every case exactly once.');
    }
    const b = firestore.batch();
    given.forEach((id, i) => b.update(refs.case(id), { order: i + 1 }));
    await b.commit();

    const updated = await cases.list(eventId);
    res.json({ cases: updated.map((c) => ({ id: c.id, order: c.order, title: c.title, status: c.status })) });
  }),
];

// Administrative progression: opening a Case closes any other open Case in the
// same investigation, then marks this one OPEN.
export const startCase = asyncHandler(async (req, res) => {
  const caseId = req.params.id;
  const existing = await cases.get(caseId);
  if (!existing) throw new AppError(404, MESSAGES.notFound);
  if (existing.status === 'OPEN') throw new AppError(400, 'This case is already open.');
  if (existing.status === 'CLOSED') throw new AppError(400, 'This case is closed and cannot be reopened.');

  const openCase = await cases.open(existing.eventId);
  const b = firestore.batch();
  if (openCase) {
    b.update(refs.case(openCase.id), { status: 'CLOSED', closedAt: new Date() });
  }
  b.update(refs.case(caseId), { status: 'OPEN', startsAt: new Date(), closedAt: null });
  await b.commit();
  res.json({ case: await cases.get(caseId) });
});

export const closeCase = asyncHandler(async (req, res) => {
  const caseId = req.params.id;
  const existing = await cases.get(caseId);
  if (!existing) throw new AppError(404, MESSAGES.notFound);
  if (existing.status !== 'OPEN') throw new AppError(400, 'Only an open case can be closed.');
  const updated = await cases.update(caseId, { status: 'CLOSED', closedAt: new Date() });
  res.json({ case: updated });
});

// ---------------------------------------------------------------------------
// Case sub-files
// ---------------------------------------------------------------------------

export const listFiles = asyncHandler(async (req, res) => {
  const { id: eventId, caseId } = req.params;
  const parent = await cases.get(caseId);
  if (!parent || parent.eventId !== eventId) throw new AppError(404, MESSAGES.notFound);
  const rows = await subfiles.listFull(caseId);
  res.json({ files: rows });
});

export const createFile = [
  validate(fileSchema),
  asyncHandler(async (req, res) => {
    const { id: eventId, caseId } = req.params;
    const parent = await cases.get(caseId);
    if (!parent || parent.eventId !== eventId) throw new AppError(404, MESSAGES.notFound);

    const { answers = [], hints: hintsIn = [], evidence: evidenceIn = [] } = req.body;
    const data = normalizeFileInput(req.body);
    const order = (await subfiles.lastOrder(caseId)) + 1;

    const fileRow = await subfiles.create(
      caseId,
      {
        title: data.title,
        type: data.type,
        story: data.story ?? '',
        question: data.question ?? '',
        githubUrl: data.githubUrl,
        published: data.published ?? true,
        caseInsensitive: data.caseInsensitive ?? true,
        normalize: data.normalize ?? true,
        regex: data.regex,
        points: data.points ?? 100,
        wrongPenalty: data.wrongPenalty ?? 5,
        maxAttempts: data.maxAttempts,
        options: data.options,
        order,
      },
      { answers, hints: hintsIn, evidence: evidenceIn },
    );
    res.status(201).json({ file: fileRow });
  }),
];

export const updateFile = [
  validate(fileSchema.partial()),
  asyncHandler(async (req, res) => {
    const { cid, fid } = req.params;
    const existing = await subfiles.get(cid, fid);
    if (!existing) throw new AppError(404, MESSAGES.notFound);

    const { answers, hints: hintsIn, evidence: evidenceIn } = req.body;
    const data = normalizeFileInput(req.body);
    data.story = data.story ?? existing.story;
    data.question = data.question ?? existing.question;

    const fileRow = await subfiles.update(cid, fid, data);
    await subfiles.replaceChildren(cid, fid, { answers, hints: hintsIn, evidence: evidenceIn });
    res.json({ file: await subfiles.get(cid, fid) });
  }),
];

export const deleteFile = asyncHandler(async (req, res) => {
  const { cid, fid } = req.params;
  const existing = await subfiles.get(cid, fid);
  if (!existing) throw new AppError(404, MESSAGES.notFound);

  const hasSubs = await subs.hasForFile(cid, fid);
  if (hasSubs) {
    throw new AppError(400, 'Cannot delete a sub-file that already has submissions.');
  }
  await subfiles.delete(cid, fid);
  res.json({ ok: true });
});

export const setFilePublished = [
  validate(z.object({ published: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { cid, fid } = req.params;
    const existing = await subfiles.get(cid, fid);
    if (!existing) throw new AppError(404, MESSAGES.notFound);
    const updated = await subfiles.update(cid, fid, { published: req.body.published });
    res.json({ file: updated });
  }),
];

export const reorderFiles = [
  validate(z.object({ orderedFileIds: z.array(z.union([z.number(), z.string()])).min(1) })),
  asyncHandler(async (req, res) => {
    const { id: eventId, caseId } = req.params;
    const parent = await cases.get(caseId);
    if (!parent || parent.eventId !== eventId) throw new AppError(404, MESSAGES.notFound);

    const fileRows = await subfiles.list(caseId);
    const ids = new Set(fileRows.map((f) => f.id));
    const given = req.body.orderedFileIds.map(String);
    const givenSet = new Set(given);
    if (givenSet.size !== ids.size || [...givenSet].some((g) => !ids.has(g))) {
      throw new AppError(400, 'Reorder list must contain every sub-file exactly once.');
    }

    const b = firestore.batch();
    given.forEach((id, i) => b.update(refs.subfile(caseId, id), { order: i + 1 }));
    await b.commit();

    const updated = await subfiles.list(caseId);
    res.json({ files: updated.map((f) => ({ id: f.id, order: f.order, title: f.title, published: f.published })) });
  }),
];