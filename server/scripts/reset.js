// Removes an event and every record that belongs to it (cases, sub-files,
// answers/hints/evidence, teams + members, memberships, submissions,
// hintUsages, scoreEvents, closings). User accounts are kept. Run against the
// real project with: NODE_ENV=production node server/scripts/reset.js
import { events, refs, deleteRecursive } from '../src/db/repo.js';

const EVENT_CODE = process.env.SEED_EVENT_CODE || 'OSD2026';

async function main() {
  const event = await events.getByCode(EVENT_CODE);
  if (!event) {
    console.log(`No event with code ${EVENT_CODE} found; nothing to reset.`);
    return;
  }
  console.log(`Resetting event ${event.name} (${event.id})...`);

  const caseRows = await refs.cases().where('eventId', '==', event.id).get();
  const teamRows = await refs.teams().where('eventId', '==', event.id).get();

  // Collect members before deleting their teams, so memberships can be removed.
  const memberIds = new Set();
  for (const team of teamRows.docs) {
    const members = await refs.members(team.id).get();
    for (const m of members.docs) memberIds.add(m.id);
  }

  for (const doc of caseRows.docs) await deleteRecursive(refs.case(doc.id));
  for (const doc of teamRows.docs) await deleteRecursive(refs.team(doc.id));
  for (const uid of memberIds) {
    await refs.membership(uid, event.id).delete().catch(() => {});
  }

  const wipeByEvent = async (col) => {
    const snap = await col.where('eventId', '==', event.id).get();
    for (const doc of snap.docs) await doc.ref.delete();
  };
  await wipeByEvent(refs.submissions());
  await wipeByEvent(refs.hintUsages());
  await wipeByEvent(refs.scoreEvents());
  await wipeByEvent(refs.closings());
  await refs.event(event.id).delete();

  console.log(`Removed ${caseRows.size} cases, ${teamRows.size} teams, ${memberIds.size} memberships and all records for ${EVENT_CODE}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  });