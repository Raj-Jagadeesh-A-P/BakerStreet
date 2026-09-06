import { firestore, adminAuth } from '../src/db/firebase.js';
import { refs, users, events, cases, subfiles, teams } from '../src/db/repo.js';
import { randomCode } from '../src/utils/random.js';
import { caseDefinitions } from '../seed/cases/index.js';

const EVENT_CODE = 'OSD2026';

async function ensureFirebaseUser(email, password) {
  try {
    const record = await adminAuth.getUserByEmail(email);
    if (password) await adminAuth.updateUser(record.uid, { password });
    return record;
  } catch {
    return adminAuth.createUser({ email, password });
  }
}

async function upsertUser(email, name, password, role, identity = null) {
  const fb = await ensureFirebaseUser(email, password);
  const existing = await users.get(fb.uid);
  if (existing) {
    return users.update(fb.uid, { name, email, role, identity });
  }
  return users.create({ name, email, role, identity }, fb.uid);
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
  });

  for (const def of caseDefinitions) {
    const cas = await cases.create(event.id, {
      title: def.title,
      plot: def.plot,
      order: def.order,
      published: true,
      status: 'LOCKED',
      startsAt: null,
      closedAt: null,
      closureCount: 0,
      closing: {
        answers: def.closing.answers,
        caseInsensitive: def.closing.caseInsensitive,
        normalize: def.closing.normalize,
        regex: def.closing.regex,
      },
      podium: def.podium ?? {},
    });
    for (const f of def.files) {
      await subfiles.create(
        cas.id,
        {
          title: f.title,
          type: f.type,
          story: f.story,
          question: f.question,
          githubUrl: f.githubUrl,
          published: true,
          caseInsensitive: f.caseInsensitive ?? true,
          normalize: f.normalize ?? true,
          regex: null,
          points: f.points,
          wrongPenalty: f.wrongPenalty ?? 5,
          maxAttempts: null,
          options: null,
          order: f.order,
        },
        { answers: f.answers, hints: f.hints, evidence: f.evidence },
      );
    }
  }

  console.log(`Seeded event ${event.name} (${EVENT_CODE}) with ${caseDefinitions.length} cases.`);
  return event;
}

async function seedDemoTeam(event) {
  const demoEmail = process.env.SEED_DEMO_EMAIL || 'demo@glugot.dev';
  const demoUser = await upsertUser(
    demoEmail,
    'Demo Detective',
    process.env.SEED_DEMO_PASSWORD || 'demo-password-123',
    'PARTICIPANT',
    'PRIVATE_CLIENT',
  );
  const partnerEmail = process.env.SEED_DEMO_PARTNER_EMAIL || 'partner@glugot.dev';
  const partner = await upsertUser(
    partnerEmail,
    'Partner Detective',
    process.env.SEED_DEMO_PARTNER_PASSWORD || 'partner-password-123',
    'PARTICIPANT',
    'SCOTLAND_YARD',
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

  // Demo progress: fully solves the first case (both sub-files) so the closing
  // challenge can be reached as soon as an admin opens the case.
  const caseRows = await cases.list(event.id);
  const genesis = caseRows.find((c) => c.order === 1);
  const files = await subfiles.list(genesis.id);
  const solved = [
    { file: files.find((f) => f.order === 1), answer: 'bakerstreet' },
    { file: files.find((f) => f.order === 2), answer: 'react/react' },
  ].filter((x) => x.file);
  await firestore.runTransaction(async (tx) => {
    for (const { file, answer } of solved) {
      tx.create(refs.submissionDoc(), {
        eventId: event.id,
        teamId: teamRef.id,
        caseId: genesis.id,
        fileId: file.id,
        answer,
        correct: true,
        createdAt: new Date(),
      });
    }
    const score = solved.reduce((sum, s) => sum + s.file.points, 0);
    tx.update(refs.team(teamRef.id), { score });
  });
  console.log(`Seeded demo team "Ctrl+Alt+Elite" (${demoEmail}) with ${solved.length} sub-files solved in Case 01.`);
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