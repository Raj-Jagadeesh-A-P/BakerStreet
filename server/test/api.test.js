// Integration suite for the BakerStreet open source detective API.
//
// The suite shares mutable state across its `it` blocks, which are therefore
// ORDER DEPENDENT and must stay in this exact sequence (vitest runs them in
// declaration order within the file). Run with `npm test`, which boots the
// Firestore and Auth emulators via firebase emulators:exec.

import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { resetDb, testSignInToken, testSignUpToken } from './helpers.js';
import { users } from '../src/db/repo.js';
import { adminAuth } from '../src/db/firebase.js';
import { createApp } from '../src/app.js';

const app = createApp();
const agent = () => request.agent(app);

const ADMIN_EMAIL = 'root@test.dev';
const ADMIN_PW = 'adminpassword';
const PW = 'password123';

const state = { event: null, finalCase: null, c: {}, adminId: null };

async function setupEvent(a, code) {
  const ev = await a
    .post('/api/admin/events')
    .send({ name: 'Test Event', code, durationMinutes: 60, teamMinSize: 1, teamMaxSize: 3, pollIntervalSeconds: 8 });
  expect(ev.status).toBe(201);
  return ev.body.event;
}

async function addCase(a, eventId, data) {
  return a.post(`/api/admin/events/${eventId}/cases`).send(data).expect(201).then((r) => r.body.case);
}

async function login(email, password) {
  const idToken = await testSignInToken(email, password);
  const a = agent();
  await a.post('/api/auth/login').send({ idToken }).expect(200);
  return a;
}

// Creates a Firebase Auth user and the matching Firestore profile document.
async function provisionUser(name, email, password, role) {
  const fb = await adminAuth.createUser({ email, password, displayName: name });
  await users.create({ name, email, role }, fb.uid);
  return fb.uid;
}

beforeAll(async () => {
  await resetDb();

  await provisionUser('Root', ADMIN_EMAIL, ADMIN_PW, 'ADMIN');
  for (const [name, email] of [
    ['Alice', 'alice@test.dev'],
    ['Bob', 'bob@test.dev'],
    ['Carol', 'carol@test.dev'],
  ]) {
    await provisionUser(name, email, PW, 'PARTICIPANT');
  }
});

describe('BakerStreet API', () => {
  it('blocks unauthenticated and unauthorized access', async () => {
    await agent().get('/api/auth/me').expect(401);
    await agent().get('/api/events/1/dashboard').expect(401);
    await agent().post('/api/admin/events').send({}).expect(401);

    const alice = await login('alice@test.dev', PW);
    await alice.get('/api/admin/events').expect(403);
  });

  it('registers users and rejects duplicates and bad credentials', async () => {
    const aliceToken = await testSignInToken('alice@test.dev', PW);
    await agent().post('/api/auth/register').send({ name: 'Dup', idToken: aliceToken }).expect(409);
    await agent().post('/api/auth/login').send({ idToken: 'bogus-token' }).expect(401);

    const dave = await testSignUpToken('dave@test.dev', PW);
    const r = await agent().post('/api/auth/register').send({ name: 'Dave', idToken: dave.idToken });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('PARTICIPANT');
    expect(r.headers['set-cookie']).toBeDefined();

    // Registering the same Firebase account twice is rejected too.
    await agent().post('/api/auth/register').send({ name: 'Dave', idToken: dave.idToken }).expect(409);
  });

  it('lets an admin build an event with cases (final case included)', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);

    const ev = await setupEvent(a, 'TESTEV1');
    state.event = ev;

    await a.post('/api/admin/events').send({ name: 'Dup', code: 'TESTEV1' }).expect(409);

    const c1 = await addCase(a, ev.id, {
      title: 'Find the repo',
      type: 'TEXT',
      story: 'Identify the repository.',
      question: 'Owner/repo?',
      githubUrl: 'https://github.com/react/react',
      points: 100,
      wrongPenalty: 5,
      maxAttempts: 2,
      caseInsensitive: true,
      normalize: true,
      answers: [{ value: 'react/react' }, { value: 'React / React' }],
      hints: [{ title: 'Hint A', text: 'It is lowercase.', cost: 10 }],
      evidence: [{ label: 'Repository', value: '{{answer}}' }],
    });
    state.c.c1 = c1;

    const c2 = await addCase(a, ev.id, {
      title: 'First commit',
      type: 'COMMIT_SHA',
      story: 'Find the first commit.',
      question: 'Full SHA of the initial commit?',
      points: 120,
      wrongPenalty: 10,
      maxAttempts: 3,
      caseInsensitive: false,
      answers: [{ value: '75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4' }],
    });
    state.c.c2 = c2;

    const c3 = await addCase(a, ev.id, {
      title: 'Pick a letter',
      type: 'MULTIPLE_CHOICE',
      story: 'Choose.',
      question: 'Which option?',
      points: 150,
      wrongPenalty: 10,
      maxAttempts: null,
      options: { options: ['a', 'b', 'c'] },
      answers: [{ value: 'c' }],
    });
    state.c.c3 = c3;

    const f = await addCase(a, ev.id, {
      title: 'Final Investigation',
      type: 'TEXT',
      story: 'A full report.',
      question: 'Explain everything.',
      points: 500,
      wrongPenalty: 0,
      finalCase: true,
      published: true,
      answers: [],
    });
    state.finalCase = f;

    const list = await a.get(`/api/admin/events/${ev.id}/cases`).expect(200);
    expect(list.body.cases.map((c) => c.order)).toEqual([1, 2, 3, 4]);
    expect(list.body.scoring.commit).toBe(100);
  });

  it('creates a team and joins by code', async () => {
    const alice = await login('alice@test.dev', PW);

    const look = await alice.post('/api/events/join').send({ code: 'TESTEV1' }).expect(200);
    expect(look.body.event.code).toBe('TESTEV1');

    const team = await alice.post(`/api/events/${state.event.id}/teams`).send({ name: 'Alpha' }).expect(201);
    expect(team.body.team.code).toMatch(/^[A-Z0-9]{6}$/);
    const teamCode = team.body.team.code;

    await alice.post(`/api/events/${state.event.id}/teams`).send({ name: 'Beta' }).expect(400);

    const bob = await login('bob@test.dev', PW);
    const join = await bob.post(`/api/events/${state.event.id}/teams/join`).send({ code: teamCode }).expect(200);
    expect(join.body.team.name).toBe('Alpha');

    const carol = await login('carol@test.dev', PW);
    await carol.post(`/api/events/${state.event.id}/teams/join`).send({ code: 'XXXXXX' }).expect(404);

    const me = await bob.get('/api/auth/me').expect(200);
    expect(me.body.membership.teamId).toBe(join.body.team.id);
  });

  it('previews the dashboard before start (unlock order, submissions disabled)', async () => {
    const alice = await login('alice@test.dev', PW);
    const d = await alice.get(`/api/events/${state.event.id}/dashboard`).expect(200);
    expect(d.body.team.name).toBe('Alpha');
    expect(d.body.team.rank).toBe(1);
    expect(d.body.team.score).toBe(0);
    expect(d.body.submissionAllowed).toBe(false);

    expect(d.body.cases[0].status).toBe('UNLOCKED');
    expect(d.body.cases[1].status).toBe('LOCKED');
    expect(d.body.cases.find((c) => c.finalCase).status).toBe('LOCKED');
    expect(d.body.continueCaseId).toBe(state.c.c1.id);

    await alice.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: 'react/react' }).expect(400);

    const lb = await alice.get(`/api/events/${state.event.id}/leaderboard`).expect(200);
    expect(lb.body.teams).toHaveLength(1);
    expect(lb.body.pollIntervalSeconds).toBe(8);
  });

  it('starts the event, scores answers, and reveals hints/evidence', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);
    const st = await a.post(`/api/admin/events/${state.event.id}/start`).expect(200);
    expect(st.body.event.status).toBe('LIVE');
    expect(new Date(st.body.event.endTime).getTime() - new Date(st.body.event.startTime).getTime()).toBe(60 * 60000);

    const alice = await login('alice@test.dev', PW);

    await alice.get(`/api/cases/${state.c.c3.id}`).expect(403); // locked

    const wrong = await alice.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: 'nope' }).expect(200);
    expect(wrong.body.correct).toBe(false);
    expect(wrong.body.score).toBe(0); // already at floor, penalty never goes below 0

    const good = await alice.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: '  React/  react ' }).expect(200);
    expect(good.body.correct).toBe(true);
    expect(good.body.answer).toBe('react/react');
    expect(good.body.score).toBe(100);
    expect(good.body.unlockedNext).toBe(state.c.c2.id);

    const again = await alice.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: 'react/react' }).expect(200);
    expect(again.body.alreadySolved).toBe(true);
    expect(again.body.score).toBe(100);

    const h = await alice.post(`/api/cases/${state.c.c1.id}/hints/${state.c.c1.hints[0].id}/use`).expect(200);
    expect(h.body.hint.text).toBe('It is lowercase.');
    expect(h.body.score).toBe(90);
    await alice.post(`/api/cases/${state.c.c1.id}/hints/${state.c.c1.hints[0].id}/use`).expect(400);

    const reload = await alice.get(`/api/cases/${state.c.c1.id}`).expect(200);
    expect(reload.body.case.solved).toBe(true);
    expect(reload.body.case.hints[0].used).toBe(true);
    expect(reload.body.case.hints[0].text).toBe('It is lowercase.');

    const dash = await alice.get(`/api/events/${state.event.id}/dashboard`).expect(200);
    const ev = dash.body.evidence.find((e) => e.caseOrder === state.c.c1.order);
    expect(ev.label).toBe('Repository');
    expect(ev.value).toBe('react/react');

    const lb = await alice.get(`/api/events/${state.event.id}/leaderboard`).expect(200);
    expect(lb.body.teams[0].score).toBe(90);
    expect(lb.body.teams[0].solved).toBe(1);
  });

  it('sanitizes COMMIT_SHA, enforces attempts, and unlocks the final case', async () => {
    const alice = await login('alice@test.dev', PW);
    const carol = await login('carol@test.dev', PW);

    await carol.post(`/api/events/${state.event.id}/teams`).send({ name: 'Charlie' }).expect(201);
    await carol.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: 'react/react' }).expect(200);
    for (const bad of ['aaaa', 'bbbb', 'cccc']) {
      const r = await carol.post(`/api/cases/${state.c.c2.id}/submit`).send({ answer: bad }).expect(200);
      expect(r.body.correct).toBe(false);
    }
    const blocked = await carol.post(`/api/cases/${state.c.c2.id}/submit`).send({ answer: 'good' }).expect(400);
    expect(blocked.body.error).toMatch(/maximum attempts/i);

    await alice.get(`/api/cases/${state.c.c3.id}`).expect(403); // still locked

    const sha = await alice
      .post(`/api/cases/${state.c.c2.id}/submit`)
      .send({ answer: '75897C2DCD1DD3A6CA46284DD37E13D22B4B16B4' })
      .expect(200);
    expect(sha.body.correct).toBe(true);
    expect(sha.body.answer).toBe('75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4');
    expect(sha.body.score).toBe(210); // 90 + 120
    expect(sha.body.unlockedNext).toBe(state.c.c3.id);

    const mc = await alice.post(`/api/cases/${state.c.c3.id}/submit`).send({ answer: 'C' }).expect(200);
    expect(mc.body.correct).toBe(true);
    expect(mc.body.score).toBe(360); // 210 + 150
    expect(mc.body.unlockedNext).toBe(state.finalCase.id);

    const view = await alice.get(`/api/cases/${state.finalCase.id}`).expect(200);
    expect(view.body.case.finalCase).toBe(true);

    const dash = await alice.get(`/api/events/${state.event.id}/dashboard`).expect(200);
    expect(dash.body.continueCaseId).toBe(state.finalCase.id);
  });

  it('submits and judges the final investigation with a multipart attachment', async () => {
    const alice = await login('alice@test.dev', PW);
    const a = await login(ADMIN_EMAIL, ADMIN_PW);

    const sub = await alice
      .post('/api/final/submit')
      .field('suspectedContributor', 'zpao')
      .field('commitSha', '75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4')
      .field('relatedIssue', '42')
      .field('relatedPr', '68')
      .field('whatHappened', 'The initial public release of the repository shipped broken.')
      .field('fix', 'Re-verify the initial commit author account before release.')
      .field('evidenceExplanation', 'The first commit is attributed to the author login zpao.')
      .attach('attachment', Buffer.from('not-a-real-png'), { filename: 'screenshot.png', contentType: 'image/png' });
    expect(sub.status).toBe(201);
    expect(sub.body.submitted).toBe(true);

    const fail = await alice.post('/api/final/submit').field('suspectedContributor', 'zpao').expect(400);
    expect(typeof fail.body.error).toBe('string');

    const finals = await a.get(`/api/admin/events/${state.event.id}/finals`).expect(200);
    expect(finals.body.rows).toHaveLength(1);
    expect(finals.body.rows[0].status).toBe('SUBMITTED');
    expect(finals.body.rows[0].hasAttachment).toBe(true);

    const detail = await a.get(`/api/admin/finals/${finals.body.rows[0].id}`).expect(200);
    expect(detail.body.submission.suspectedContributor).toBe('zpao');

    await a
      .post(`/api/admin/finals/${finals.body.rows[0].id}/judge`)
      .send({ status: 'SCORED', totalScore: 540, breakdown: { contributor: 100, commit: 90, issue: 75, pr: 75, rootCause: 50, fix: 50, evidence: 100 } })
      .expect(200);

    const lb = await alice.get(`/api/events/${state.event.id}/leaderboard`).expect(200);
    const alpha = lb.body.teams.find((t) => t.name === 'Alpha');
    expect(alpha.score).toBe(360 + 540); // 900
    expect(alpha.finalSubmitted).toBe(true);
    expect(lb.body.teams.find((t) => t.name === 'Charlie').finalSubmitted).toBe(false);
  });

  it('pauses and ends the event, then exports everything as CSV', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);
    const alice = await login('alice@test.dev', PW);

    await a.post(`/api/admin/events/${state.event.id}/start`).expect(200);

    await a.post(`/api/admin/events/${state.event.id}/pause`).expect(200);
    await alice.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: 'x' }).expect(400);

    const resume = await a.post(`/api/admin/events/${state.event.id}/start`).expect(200);
    expect(resume.body.event.status).toBe('LIVE');

    await a.post(`/api/admin/events/${state.event.id}/end`).expect(200);
    await alice.post(`/api/cases/${state.c.c1.id}/submit`).send({ answer: 'x' }).expect(400);
    await alice.get(`/api/cases/${state.c.c1.id}`).expect(200); // still viewable

    for (const type of ['participants', 'teams', 'scores', 'submissions', 'finals']) {
      const res = await a.get(`/api/admin/events/${state.event.id}/export/${type}`).expect(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text.startsWith('\uFEFF')).toBe(true);
    }
    const teams = await a.get(`/api/admin/events/${state.event.id}/export/teams`).expect(200);
    expect(teams.text).toContain('Team Name');
    await a.get('/api/admin/events/9999/export/bogus').expect(404);
  });
});