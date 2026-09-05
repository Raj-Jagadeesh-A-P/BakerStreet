import { firestore, adminAuth } from '../src/db/firebase.js';
import { refs, users, events, cases, teams } from '../src/db/repo.js';
import { randomCode } from '../src/utils/random.js';
import { caseSeed } from '../seed/cases/index.js';

const EVENT_CODE = 'OSD2026';

const DEFAULT_FINAL_SCORING = {
  contributor: 100,
  commit: 100,
  issue: 75,
  pr: 75,
  rootCause: 100,
  fix: 100,
  evidence: 50,
  total: 600,
};

async function ensureFirebaseUser(email, password) {
  try {
    const record = await adminAuth.getUserByEmail(email);
    if (password) await adminAuth.updateUser(record.uid, { password });
    return record;
  } catch {
    return adminAuth.createUser({ email, password });
  }
}

async function upsertUser(email, name, password, role) {
  const fb = await ensureFirebaseUser(email, password);
  const existing = await users.get(fb.uid);
  if (existing) {
    return users.update(fb.uid, { name, email, role });
  }
  return users.create({ name, email, role }, fb.uid);
}

async function seedEvent() {
  const existing = await events.getByCode(EVENT_CODE);
  if (existing) {
    console.log(`Event ${EVENT_CODE} already exists; skipping seed.`);
    return existing;
  }

  const event = await events.create({
    name: 'BakerStreet 2026',
    code: EVENT_CODE,
    description:
      'Investigate real open-source projects on GitHub, connect the clues, and solve the mystery. Form a team of 2–3 and begin with Case 01.',
    status: 'DRAFT',
    durationMinutes: 180,
    teamMinSize: 2,
    teamMaxSize: 3,
    pollIntervalSeconds: 8,
    finalScoring: DEFAULT_FINAL_SCORING,
  });

  for (const c of caseSeed) {
    await cases.create(
      event.id,
      {
        title: c.title,
        order: c.order,
        finalCase: c.finalCase ?? false,
        published: true,
        type: c.type,
        story: c.story,
        question: c.question,
        githubUrl: c.githubUrl,
        caseInsensitive: c.caseInsensitive ?? true,
        normalize: c.normalize ?? true,
        regex: null,
        points: c.points,
        wrongPenalty: c.wrongPenalty,
        maxAttempts: null,
        options: null,
      },
      { answers: c.answers, hints: c.hints, evidence: c.evidence },
    );
  }

  console.log(`Seeded event ${event.name} (${EVENT_CODE}) with ${caseSeed.length} cases.`);
  return event;
}

async function seedDemoTeam(event) {
  const demoEmail = process.env.SEED_DEMO_EMAIL || 'demo@glugot.dev';
  const demoUser = await upsertUser(
    demoEmail,
    'Demo Detective',
    process.env.SEED_DEMO_PASSWORD || 'demo-password-123',
    'PARTICIPANT',
  );
  const partnerEmail = process.env.SEED_DEMO_PARTNER_EMAIL || 'partner@glugot.dev';
  const partner = await upsertUser(
    partnerEmail,
    'Partner Detective',
    process.env.SEED_DEMO_PARTNER_PASSWORD || 'partner-password-123',
    'PARTICIPANT',
  );

  const existingTeams = await teams.list(event.id);
  if (existingTeams.length > 0) return;

  const teamRef = refs.teams().doc();
  const teamCode = randomCode(6);
  await firestore.runTransaction(async (tx) => {
    tx.create(teamRef, {
      eventId: event.id,
      name: 'Ctrl+Alt+Elite',
      code: teamCode,
      score: 0,
      memberCount: 2,
      createdAt: new Date(),
    });
    tx.create(refs.member(teamRef.id, demoUser.id), {
      isLeader: true,
      name: demoUser.name,
      email: demoUser.email,
      createdAt: new Date(),
    });
    tx.create(refs.member(teamRef.id, partner.id), {
      isLeader: false,
      name: partner.name,
      email: partner.email,
      createdAt: new Date(),
    });
    tx.create(refs.membership(demoUser.id, event.id), {
      teamId: teamRef.id,
      isLeader: true,
      createdAt: new Date(),
    });
    tx.create(refs.membership(partner.id, event.id), {
      teamId: teamRef.id,
      isLeader: false,
      createdAt: new Date(),
    });
  });

  const rows = await cases.list(event.id);
  const warmup = rows.find((c) => c.order === 1);
  const case1 = rows.find((c) => c.order === 2);
  const case2 = rows.find((c) => c.order === 3);
  const solved = [
    { row: warmup, answer: 'bakerstreet' },
    { row: case1, answer: 'react/react' },
    { row: case2, answer: 'MIT' },
  ];
  await firestore.runTransaction(async (tx) => {
    for (const { row, answer } of solved) {
      tx.create(refs.submissionDoc(), {
        eventId: event.id,
        teamId: teamRef.id,
        caseId: row.id,
        answer,
        correct: true,
        createdAt: new Date(),
      });
    }
    tx.update(refs.team(teamRef.id), { score: solved.reduce((sum, s) => sum + s.row.points, 0) });
  });
  console.log(`Seeded demo team "Ctrl+Alt+Elite" (${demoEmail}) with ${solved.length} solved cases.`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@glugot.dev';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const admin = await upsertUser(email, 'BakerStreet Organizer', password, 'ADMIN');
  console.log(`Admin ready: ${admin.email} (password configured via SEED_ADMIN_PASSWORD env)`);
}

async function main() {
  const event = await seedEvent();
  await seedDemoTeam(event);
  await seedAdmin();
  console.log('Seed complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});