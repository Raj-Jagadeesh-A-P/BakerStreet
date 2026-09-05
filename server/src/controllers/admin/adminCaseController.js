import { z } from 'zod';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { MESSAGES, finalScoring } from '../../config.js';
import { events, cases, subs } from '../../db/repo.js';
import { refs, firestore } from '../../db/repo.js';

const CASE_TYPES = ['TEXT', 'NUMBER', 'URL', 'GITHUB_REPOSITORY', 'COMMIT_SHA', 'USERNAME', 'MULTIPLE_CHOICE'];

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

const caseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(CASE_TYPES),
  story: z.string().max(10000).optional().or(z.literal('')),
  question: z.string().max(5000).optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  finalCase: z.boolean().optional(),
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

function normalizeCaseInput(body) {
  const data = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.type !== undefined) data.type = body.type;
  if (body.finalCase !== undefined) data.finalCase = body.finalCase;
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

export const createCase = [
  validate(caseSchema),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const event = await events.get(eventId);
    if (!event) throw new AppError(404, MESSAGES.notFound);

    const { answers = [], hints: hintsIn = [], evidence: evidenceIn = [] } = req.body;
    const data = normalizeCaseInput(req.body);

    const order = (await cases.lastOrder(eventId)) + 1;
    const caseRow = await cases.create(
      eventId,
      {
        title: data.title,
        type: data.type,
        story: data.story ?? '',
        question: data.question ?? '',
        githubUrl: data.githubUrl,
        finalCase: data.finalCase ?? false,
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
    res.status(201).json({ case: caseRow });
  }),
];

export const updateCase = [
  validate(caseSchema),
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const existing = await cases.get(caseId);
    if (!existing) throw new AppError(404, MESSAGES.notFound);

    const { answers, hints: hintsIn, evidence: evidenceIn } = req.body;
    const data = normalizeCaseInput(req.body);
    data.story = data.story ?? existing.story;
    data.question = data.question ?? existing.question;
    data.githubUrl = data.githubUrl !== undefined ? data.githubUrl : existing.githubUrl;

    const caseRow = await cases.update(caseId, data);
    await cases.replaceChildren(caseId, { answers, hints: hintsIn, evidence: evidenceIn });

    const all = await cases.listFull(caseRow.eventId);
    res.json({ case: all.find((c) => c.id === caseId) });
  }),
];

export const deleteCase = asyncHandler(async (req, res) => {
  const caseId = req.params.id;
  const existing = await cases.get(caseId);
  if (!existing) throw new AppError(404, MESSAGES.notFound);

  const subCount = await subs.hasForCase(caseId);
  if (subCount) {
    throw new AppError(400, 'Cannot delete a case that already has submissions.');
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
    res.json({
      cases: updated.map((c) => ({ id: c.id, order: c.order, title: c.title, finalCase: c.finalCase, published: c.published })),
    });
  }),
];

export const listCases = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);
  const caseRows = await cases.listFull(eventId);
  res.json({ scoring: finalScoring(event), cases: caseRows });
});