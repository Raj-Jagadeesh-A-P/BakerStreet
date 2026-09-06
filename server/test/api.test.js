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

const state = {
  event: null,
  cas: {},
  file: {},
  closing: {},
  team: {},
  adminId: null,
};

async function setupEvent(a, code) {
  const ev = await a.post('/api/admin/events').send({
    name: 'Test Event',
    code,
    durationMinutes: 60,
    teamMinSize: 1,
    teamMaxSize: 3,
    pollIntervalSeconds: 8,
  });
  expect(ev.status).toBe(201);
  return ev.body.event;
}

async function addCase(a, eventId, data) {
  return a.post(`/api/admin/events/${eventId}/cases`).send(data).expect(201).then((r) => r.body.case);
}

async function addFile(a, eventId, caseId, data) {
  return a.post(`/api/admin/events/${eventId}/cases/${caseId}/files`).send(data).expect(201).then((r) => r.body.file);
}

async function login(email, password) {
  const idToken = await testSignInToken(email, password);
  const ag = agent();
  await ag.post('/api/auth/login').send({ idToken }).expect(200);
  return ag;
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

  it('registers users (with identity) and rejects duplicates and bad credentials', async () => {
    const aliceToken = await testSignInToken('alice@test.dev', PW);
    await agent().post('/api/auth/register').send({ name: 'Dup', idToken: aliceToken }).expect(409);
    await agent().post('/api/auth/login').send({ idToken: 'bogus-token' }).expect(401);

    const dave = await testSignUpToken('dave@test.dev', PW);
    const r = await agent().post('/api/auth/register').send({ name: 'Dave', identity: 'SCOTLAND_YARD', idToken: dave.idToken });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('PARTICIPANT');
    expect(r.body.user.identity).toBe('SCOTLAND_YARD');
    expect(r.headers['set-cookie']).toBeDefined();

    const login = await agent().post('/api/auth/login').send({ idToken: await testSignInToken('dave@test.dev', PW) });
    expect(login.body.user.identity).toBe('SCOTLAND_YARD');

    await agent().post('/api/auth/register').send({ name: 'Dave', idToken: dave.idToken }).expect(409);

    const eve = await testSignUpToken('eve@test.dev', PW);
    const noIdentity = await agent().post('/api/auth/register').send({ name: 'Eve', idToken: eve.idToken });
    expect(noIdentity.body.user.identity).toBeNull();
  });

  it('lets an admin build an event with cases, sub-files and closings', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);

    const ev = await setupEvent(a, 'TESTEV1');
    state.event = ev;

    await a.post('/api/admin/events').send({ name: 'Dup', code: 'TESTEV1' }).expect(409);

    // Case 1: two sub-files + closing
    const c1 = await addCase(a, ev.id, {
      title: 'Genesis',
      plot: 'Identify the project behind the case files.',
      published: true,
      closing: {
        answers: ['react', 'facebook/react'],
        caseInsensitive: true,
        normalize: true,
        regex: null,
      },
      podium: {},
    });
    state.cas.c1 = c1;

    const f1 = await addFile(a, ev.id, c1.id, {
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
    state.file.f1 = f1;

    const f2 = await addFile(a, ev.id, c1.id, {
      title: 'First commit',
      type: 'COMMIT_SHA',
      story: 'Find the first commit.',
      question: 'Full SHA of the initial commit?',
      points: 120,
      wrongPenalty: 10,
      maxAttempts: 5,
      caseInsensitive: false,
      answers: [{ value: '75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4' }],
    });
    state.file.f2 = f2;

    // Case 2: single sub-file + closing
    const c2 = await addCase(a, ev.id, {
      title: 'Second',
      plot: 'Pick the correct token.',
      published: true,
      closing: { answers: ['beta'], caseInsensitive: true, normalize: true, regex: null },
      podium: {},
    });
    state.cas.c2 = c2;

    const f3 = await addFile(a, ev.id, c2.id, {
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
    state.file.f3 = f3;

    // Case 3: single sub-file with a tight attempt limit + closing
    const c3 = await addCase(a, ev.id, {
      title: 'Third',
      plot: 'The last case.',
      published: true,
      closing: { answers: ['gamma'], caseInsensitive: true, normalize: true, regex: null },
      podium: {},
    });
    state.cas.c3 = c3;

    const f4 = await addFile(a, ev.id, c3.id, {
      title: 'The number',
      type: 'NUMBER',
      story: 'What number?',
      question: 'Give the number.',
      points: 200,
      wrongPenalty: 0,
      maxAttempts: 1,
      answers: [{ value: '42' }],
    });
    state.file.f4 = f4;

    const list = await a.get(`/api/admin/events/${ev.id}/cases`).expect(200);
    expect(list.body.cases.map((c) => c.order)).toEqual([1, 2, 3]);
    expect(list.body.cases.every((c) => c.status === 'LOCKED' && c.subFileCount >= 1)).toBe(true);
    expect(list.body.cases[0].closing.answers).toContain('react');
  });

  it('creates teams, rejects duplicate names, and joins by code', async () => {
    const alice = await login('alice@test.dev', PW);

    const look = await alice.post('/api/events/join').send({ code: 'TESTEV1' }).expect(200);
    expect(look.body.event.code).toBe('TESTEV1');

    const team = await alice.post(`/api/events/${state.event.id}/teams`).send({ name: 'Alpha' }).expect(201);
    expect(team.body.team.code).toMatch(/^[A-Z0-9]{6}$/);
    const teamCode = team.body.team.code;
    state.team.alpha = team.body.team.id;

    await alice.post(`/api/events/${state.event.id}/teams`).send({ name: 'Beta' }).expect(400);

    const bob = await login('bob@test.dev', PW);
    const join = await bob.post(`/api/events/${state.event.id}/teams/join`).send({ code: teamCode }).expect(200);
    expect(join.body.team.name).toBe('Alpha');

    // Duplicate team names are rejected now.
    const carolEarly = await login('carol@test.dev', PW);
    await carolEarly.post(`/api/events/${state.event.id}/teams`).send({ name: 'Alpha' }).expect(409);

    const carolTeam = await carolEarly.post(`/api/events/${state.event.id}/teams`).send({ name: 'Charlie' }).expect(201);
    state.team.charlie = carolTeam.body.team.id;

    // Never joined users get a clean 404 on a bad code (Dave has no team).
    const dave = await login('dave@test.dev', PW);
    await dave.post(`/api/events/${state.event.id}/teams/join`).send({ code: 'XXXXXX' }).expect(404);

    const me = await bob.get('/api/auth/me').expect(200);
    expect(me.body.membership.teamId).toBe(join.body.team.id);
  });

  it('previews the dashboard before start (submissions disabled, closing locked)', async () => {
    const alice = await login('alice@test.dev', PW);
    const d = await alice.get(`/api/events/${state.event.id}/dashboard`).expect(200);
    expect(d.body.team.name).toBe('Alpha');
    expect(d.body.team.rank).toBe(1);
    expect(d.body.team.score).toBe(0);
    expect(d.body.submissionAllowed).toBe(false);
    expect(d.body.cases.map((c) => c.status)).toEqual(['LOCKED', 'LOCKED', 'LOCKED']);
    expect(d.body.continue).toBeNull();

    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'react/react' })
      .expect(400);

    const lb = await alice.get(`/api/events/${state.event.id}/leaderboard`).expect(200);
    expect(lb.body.teams).toHaveLength(2);
    expect(lb.body.cases).toHaveLength(3);
    expect(lb.body.pollIntervalSeconds).toBe(8);
  });

  it('starts the event and the first case, enforcing sequential sub-files', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);
    await a.post(`/api/admin/events/${state.event.id}/start`).expect(200);

    // A case that is not open yet rejects submissions.
    const alice = await login('alice@test.dev', PW);
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'react/react' })
      .expect(400);

    const st = await a.post(`/api/admin/cases/${state.cas.c1.id}/start`).expect(200);
    expect(st.body.case.status).toBe('OPEN');

    // The second sub-file is strictly locked until the first is solved.
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f2.id}/submit`)
      .send({ answer: '75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4' })
      .expect(403);

    const view = await alice.get(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f2.id}`).expect(200);
    expect(view.body.file.status).toBe('LOCKED');
    expect(view.body.file.hints).toEqual([]);

    // Wrong answer: penalty hits a zero floor.
    const wrong = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'nope' }).expect(200);
    expect(wrong.body.correct).toBe(false);
    expect(wrong.body.score).toBe(0);

    const good = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: '  React/  react ' }).expect(200);
    expect(good.body.correct).toBe(true);
    expect(good.body.answer).toBe('react/react');
    expect(good.body.score).toBe(100);
    expect(good.body.continue.type).toBe('FILE');
    expect(good.body.continue.id).toBe(state.file.f2.id);

    const again = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'react/react' }).expect(200);
    expect(again.body.alreadySolved).toBe(true);
    expect(again.body.continue.id).toBe(state.file.f2.id);

    // Hints cost points, once each.
    const h = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/hints/${state.file.f1.hints[0].id}/use`)
      .expect(200);
    expect(h.body.hint.text).toBe('It is lowercase.');
    expect(h.body.score).toBe(90);
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/hints/${state.file.f1.hints[0].id}/use`)
      .expect(400);

    const detail = await alice.get(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}`).expect(200);
    expect(detail.body.file.solved).toBe(true);
    expect(detail.body.file.hints[0].used).toBe(true);

    // COMMIT_SHA is normalized; solving the last sub-file releases the closing.
    const sha = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f2.id}/submit`)
      .send({ answer: '75897C2DCD1DD3A6CA46284DD37E13D22B4B16B4' }).expect(200);
    expect(sha.body.correct).toBe(true);
    expect(sha.body.answer).toBe('75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4');
    expect(sha.body.score).toBe(210);
    expect(sha.body.continue.type).toBe('CLOSING');

    const casView = await alice.get(`/api/events/${state.event.id}/cases/${state.cas.c1.id}`).expect(200);
    expect(casView.body.case.closing.released).toBe(true);
    expect(casView.body.case.closing.open).toBe(true);
    expect(casView.body.case.continue.type).toBe('CLOSING');
    expect(casView.body.case.files.find((f) => f.id === state.file.f2.id).status).toBe('SOLVED');

    const dash = await alice.get(`/api/events/${state.event.id}/dashboard`).expect(200);
    const ev = dash.body.evidence.find((e) => e.caseOrder === 1);
    expect(ev.label).toBe('Repository');
    expect(ev.value).toBe('react/react');
    expect(dash.body.continue.type).toBe('CLOSING');
  });

  it('awards podium bonuses on closing (rank order, participants tie-conflict safe)', async () => {
    const alice = await login('alice@test.dev', PW);

    // Wrong closings are rejected without committing anything.
    const wrongClose = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/close`)
      .send({ answer: 'wrongpeg' }).expect(200);
    expect(wrongClose.body.correct).toBe(false);

    const first = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/close`)
      .send({ answer: 'React' }).expect(200);
    expect(first.body.correct).toBe(true);
    expect(first.body.rank).toBe(1);
    expect(first.body.bonus).toBe(300);
    expect(first.body.score).toBe(510); // 90 + 120 + 300

    const dup = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/close`)
      .send({ answer: 'react' }).expect(200);
    expect(dup.body.alreadyClosed).toBe(true);
    expect(dup.body.rank).toBe(1);

    // Carol races to close second and gets 2nd place.
    const carol = await login('carol@test.dev', PW);
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'nope' }).expect(200);
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'react/react' }).expect(200);
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f2.id}/submit`)
      .send({ answer: '75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4' }).expect(200);
    const second = await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/close`)
      .send({ answer: 'react' }).expect(200);
    expect(second.body.rank).toBe(2);
    expect(second.body.bonus).toBe(200);
    expect(second.body.score).toBe(420); // 100 + 120 + 200

    const a = await login(ADMIN_EMAIL, ADMIN_PW);
    const closings = await a.get(`/api/admin/events/${state.event.id}/closings`).expect(200);
    expect(closings.body.closings).toHaveLength(2);
    expect(closings.body.closings.map((cl) => cl.rank)).toEqual([1, 2]);

    const lb = await alice.get(`/api/events/${state.event.id}/leaderboard`).expect(200);
    expect(lb.body.cases[0].closers.map((cl) => `${cl.rank}:${cl.teamName}`)).toEqual(['1:Alpha', '2:Charlie']);
    expect(lb.body.teams.find((t) => t.name === 'Alpha').casesClosed).toBe(1);
    expect(lb.body.teams.find((t) => t.name === 'Charlie').score).toBe(420);
  });

  it('case-level open/close gating and max attempts', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);
    const alice = await login('alice@test.dev', PW);
    const carol = await login('carol@test.dev', PW);

    // Closing the case locks sub-file submissions for it.
    await a.post(`/api/admin/cases/${state.cas.c1.id}/close`).expect(200);
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/files/${state.file.f1.id}/submit`)
      .send({ answer: 'react/react' }).expect(400);
    // A team that already closed it is told so, rather than given an error.
    const reClose = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c1.id}/close`)
      .send({ answer: 'react' }).expect(200);
    expect(reClose.body.alreadyClosed).toBe(true);

    // Opening the next case works; starting a third closes the second.
    await a.post(`/api/admin/cases/${state.cas.c2.id}/start`).expect(200);

    // Multiple choice, then close Case 2 (rank 1 for Alpha).
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c2.id}/files/${state.file.f3.id}/submit`)
      .send({ answer: 'C' }).expect(200);
    const c2close = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c2.id}/close`)
      .send({ answer: 'beta' }).expect(200);
    expect(c2close.body.rank).toBe(1);
    expect(c2close.body.bonus).toBe(300);
    expect(c2close.body.score).toBe(960); // 510 + 150 + 300

    // Carol cannot close a case before solving every sub-file.
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c2.id}/close`)
      .send({ answer: 'beta' }).expect(400);

    // Starting Case 3 auto-closes Case 2.
    await a.post(`/api/admin/cases/${state.cas.c3.id}/start`).expect(200);
    const list = await a.get(`/api/admin/events/${state.event.id}/cases`).expect(200);
    expect(list.body.cases.find((c) => c.id === state.cas.c2.id).status).toBe('CLOSED');
    expect(list.body.cases.find((c) => c.id === state.cas.c3.id).status).toBe('OPEN');

    // A closed case rejects closings from teams that have not closed it yet,
    // and tells teams that already did so.
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c2.id}/close`)
      .send({ answer: 'beta' }).expect(400);
    const reClose2 = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c2.id}/close`)
      .send({ answer: 'beta' }).expect(200);
    expect(reClose2.body.alreadyClosed).toBe(true);
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c2.id}/files/${state.file.f3.id}/submit`)
      .send({ answer: 'c' }).expect(400);

    // Max attempts: one wrong burns the only attempt.
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/files/${state.file.f4.id}/submit`)
      .send({ answer: 'x' }).expect(200);
    await carol.post(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/files/${state.file.f4.id}/submit`)
      .send({ answer: '42' }).expect(400);

    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/files/${state.file.f4.id}/submit`)
      .send({ answer: '42' }).expect(200);
    const done = await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/close`)
      .send({ answer: 'gamma' }).expect(200);
    expect(done.body.rank).toBe(1);
    expect(done.body.bonus).toBe(300);
    expect(done.body.score).toBe(1460); // 960 + 200 + 300
  });

  it('reports progress through every admin surface', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);

    const teams = await a.get(`/api/admin/events/${state.event.id}/teams`).expect(200);
    const alpha = teams.body.teams.find((t) => t.name === 'Alpha');
    const charlie = teams.body.teams.find((t) => t.name === 'Charlie');
    expect(alpha.solved).toBe(4); // f1, f2, f3, f4
    expect(alpha.casesClosed).toBe(3);
    expect(charlie.solved).toBe(2); // f1, f2
    expect(charlie.casesClosed).toBe(1);

    const subs = await a.get(`/api/admin/events/${state.event.id}/submissions`).expect(200);
    const f1row = subs.body.submissions.find((s) => s.file.id === state.file.f1.id && s.correct);
    expect(f1row.case.id).toBe(state.cas.c1.id);
    expect(f1row.file.title).toBe('Find the repo');

    const closings = await a.get(`/api/admin/events/${state.event.id}/closings`).expect(200);
    expect(closings.body.closings).toHaveLength(4); // c1 x2 (rank 1+2), c2 x1, c3 x1
    expect(closings.body.closings.filter((cl) => cl.caseId === state.cas.c1.id)).toHaveLength(2);

    // Reorder cases and verify the leaderboard reflects the standings.
    const lb = await a.get(`/api/events/${state.event.id}/leaderboard`).expect(200);
    expect(lb.body.teams[0].name).toBe('Alpha');
    expect(lb.body.teams[0].score).toBe(1460);
    expect(lb.body.teams[0].solved).toBe(4);
    expect(lb.body.teams[1].name).toBe('Charlie');
  });

  it('pauses, ends, then exports everything as CSV', async () => {
    const a = await login(ADMIN_EMAIL, ADMIN_PW);
    const alice = await login('alice@test.dev', PW);

    await a.post(`/api/admin/events/${state.event.id}/pause`).expect(200);
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/files/${state.file.f4.id}/submit`)
      .send({ answer: 'x' }).expect(400);

    const resume = await a.post(`/api/admin/events/${state.event.id}/start`).expect(200);
    expect(resume.body.event.status).toBe('LIVE');

    await a.post(`/api/admin/events/${state.event.id}/end`).expect(200);
    await alice.post(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/files/${state.file.f4.id}/submit`)
      .send({ answer: 'x' }).expect(400);
    await alice.get(`/api/events/${state.event.id}/cases/${state.cas.c3.id}/files/${state.file.f4.id}`).expect(200);

    for (const type of ['participants', 'teams', 'scores', 'submissions', 'closings']) {
      const res = await a.get(`/api/admin/events/${state.event.id}/export/${type}`).expect(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text.startsWith('\uFEFF')).toBe(true);
    }
    const teams = await a.get(`/api/admin/events/${state.event.id}/export/teams`).expect(200);
    expect(teams.text).toContain('Team Name');
    await a.get('/api/admin/events/9999/export/bogus').expect(404);
  });
});