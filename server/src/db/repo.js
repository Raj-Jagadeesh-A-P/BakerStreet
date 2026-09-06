import { firestore } from './firebase.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const now = () => new Date();

function dropUndefined(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function revive(data) {
  if (!data) return null;
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = value instanceof Timestamp ? value.toDate() : value;
  }
  return out;
}

const mapDoc = (snap) => (snap.exists ? { id: snap.id, ...revive(snap.data()) } : null);
const mapCol = (snap) => snap.docs.map(mapDoc);

export const refs = {
  user: (uid) => firestore.doc(`users/${uid}`),
  users: () => firestore.collection('users'),
  membership: (uid, eventId) => firestore.doc(`users/${uid}/memberships/${eventId}`),
  memberships: (uid) => firestore.collection(`users/${uid}/memberships`),

  event: (id) => firestore.doc(`events/${id}`),
  events: () => firestore.collection('events'),

  case: (id) => firestore.doc(`cases/${id}`),
  cases: () => firestore.collection('cases'),

  // Case sub-files live in a subcollection under each Case.
  subfiles: (caseId) => firestore.collection(`cases/${caseId}/subfiles`),
  subfile: (caseId, fileId) => firestore.doc(`cases/${caseId}/subfiles/${fileId}`),
  answers: (caseId, fileId) => firestore.collection(`cases/${caseId}/subfiles/${fileId}/answers`),
  hints: (caseId, fileId) => firestore.collection(`cases/${caseId}/subfiles/${fileId}/hints`),
  hint: (caseId, fileId, hintId) => firestore.doc(`cases/${caseId}/subfiles/${fileId}/hints/${hintId}`),
  evidence: (caseId, fileId) => firestore.collection(`cases/${caseId}/subfiles/${fileId}/evidence`),

  team: (id) => firestore.doc(`teams/${id}`),
  teams: () => firestore.collection('teams'),
  members: (teamId) => firestore.collection(`teams/${teamId}/members`),
  member: (teamId, uid) => firestore.doc(`teams/${teamId}/members/${uid}`),

  submissionDoc: () => firestore.collection('submissions').doc(),
  submissions: () => firestore.collection('submissions'),
  hintUsageDoc: () => firestore.collection('hintUsages').doc(),
  hintUsages: () => firestore.collection('hintUsages'),
  scoreEventDoc: () => firestore.collection('scoreEvents').doc(),
  scoreEvents: () => firestore.collection('scoreEvents'),

  closingDoc: () => firestore.collection('closings').doc(),
  closings: () => firestore.collection('closings'),
  closing: (id) => firestore.doc(`closings/${id}`),
};

export const runTransaction = (cb) => firestore.runTransaction(cb);
export const deleteRecursive = (ref) => firestore.recursiveDelete(ref);
export { firestore };

export const users = {
  async get(uid) {
    return mapDoc(await refs.user(uid).get());
  },
  async getByEmail(email) {
    const snap = await refs.users().where('email', '==', email).limit(2).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async create(data, id) {
    const ref = id ? refs.user(id) : refs.users().doc();
    const full = dropUndefined({ ...data, createdAt: now() });
    await ref.set(full);
    return { id: ref.id, ...revive(full) };
  },
  async update(uid, data) {
    await refs.user(uid).set(data, { merge: true });
    return mapDoc(await refs.user(uid).get());
  },
};

export const events = {
  async get(id) {
    return mapDoc(await refs.event(id).get());
  },
  async getByCode(code) {
    const snap = await refs.events().where('code', '==', code).limit(2).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async list() {
    return mapCol(await refs.events().orderBy('createdAt', 'desc').get());
  },
  async create(data) {
    const ref = refs.events().doc();
    const full = dropUndefined({ ...data, createdAt: now() });
    await ref.set(full);
    return mapDoc(await ref.get());
  },
  async update(id, data) {
    await refs.event(id).set(dropUndefined(data), { merge: true });
    return mapDoc(await refs.event(id).get());
  },
  async teamCount(eventId) {
    return (await refs.teams().where('eventId', '==', eventId).get()).size;
  },
  async participantCount(eventId) {
    const teamRows = await teams.list(eventId);
    return teamRows.reduce((sum, t) => sum + (t.memberCount ?? 0), 0);
  },
};

// Cases are the framing competitions inside an Investigation. Each Case owns a
// set of sub-files (the Q&A puzzles) and a closing challenge (a final answer,
// auto-checked). `status` is admin-driven: LOCKED -> OPEN -> CLOSED.
export const cases = {
  async get(id) {
    return mapDoc(await refs.case(id).get());
  },
  async list(eventId) {
    return mapCol(
      await refs.cases().where('eventId', '==', eventId).orderBy('order', 'asc').get(),
    );
  },
  async update(id, data) {
    await refs.case(id).set(dropUndefined(data), { merge: true });
    return mapDoc(await refs.case(id).get());
  },
  async count(eventId) {
    return (await refs.cases().where('eventId', '==', eventId).get()).size;
  },
  async create(eventId, data) {
    const ref = refs.cases().doc();
    await ref.set({ eventId, ...dropUndefined(data), createdAt: now() });
    return mapDoc(await ref.get());
  },
  async delete(caseId) {
    await deleteRecursive(refs.case(caseId));
  },
  async lastOrder(eventId) {
    const rows = await cases.list(eventId);
    return rows.length ? rows[rows.length - 1].order : 0;
  },
  // The currently open case, if any.
  async open(eventId) {
    const rows = await cases.list(eventId);
    return rows.find((c) => c.status === 'OPEN') || null;
  },
  async subFileCount(caseId) {
    return (await refs.subfiles(caseId).get()).size;
  },
};

// Case sub-files mirror the old single-question "case" rows.
export const subfiles = {
  async list(caseId) {
    return mapCol(await refs.subfiles(caseId).orderBy('order', 'asc').get());
  },
  async get(caseId, fileId) {
    return mapDoc(await refs.subfile(caseId, fileId).get());
  },
  async update(caseId, fileId, data) {
    await refs.subfile(caseId, fileId).set(dropUndefined(data), { merge: true });
    return mapDoc(await refs.subfile(caseId, fileId).get());
  },
  async delete(caseId, fileId) {
    await deleteRecursive(refs.subfile(caseId, fileId));
  },
  async count(caseId) {
    return (await refs.subfiles(caseId).get()).size;
  },
  async lastOrder(caseId) {
    const rows = await subfiles.list(caseId);
    return rows.length ? rows[rows.length - 1].order : 0;
  },
  async listFull(caseId) {
    const rows = await subfiles.list(caseId);
    for (const row of rows) {
      row.answers = await answers.list(caseId, row.id);
      row.hints = await hints.list(caseId, row.id);
      row.evidence = await evidence.list(caseId, row.id);
    }
    return rows;
  },
  async create(caseId, data, { answers: ans = [], hints: h = [], evidence: ev = [] } = {}) {
    const ref = refs.subfiles(caseId).doc();
    const b = firestore.batch();
    b.set(ref, { ...dropUndefined(data), createdAt: now() });
    const answerIds = ans.map(() => refs.answers(caseId, ref.id).doc());
    const hintRefs = h.map(() => refs.hints(caseId, ref.id).doc());
    const evidenceRefs = ev.map(() => refs.evidence(caseId, ref.id).doc());
    answerIds.forEach((r, i) => b.set(r, { value: ans[i].value }));
    hintRefs.forEach((r, i) =>
      b.set(r, { title: h[i].title ?? '', text: h[i].text, cost: h[i].cost ?? 10, order: i + 1 }),
    );
    evidenceRefs.forEach((r, i) => b.set(r, { label: ev[i].label, value: ev[i].value, order: i + 1 }));
    await b.commit();
    return {
      id: ref.id,
      ...data,
      answers: ans.map((a, i) => ({ id: answerIds[i].id, value: a.value })),
      hints: h.map((hh, i) => ({
        id: hintRefs[i].id,
        title: hh.title ?? '',
        text: hh.text,
        cost: hh.cost ?? 10,
        order: i + 1,
      })),
      evidence: ev.map((ee, i) => ({ id: evidenceRefs[i].id, label: ee.label, value: ee.value, order: i + 1 })),
    };
  },
  async replaceChildren(caseId, fileId, { answers: ans, hints: h, evidence: ev }) {
    if (ans) {
      await deleteRecursive(refs.answers(caseId, fileId));
      const b = firestore.batch();
      for (const a of ans) b.set(refs.answers(caseId, fileId).doc(), { value: a.value });
      await b.commit();
    }
    if (h) {
      await deleteRecursive(refs.hints(caseId, fileId));
      const b = firestore.batch();
      h.forEach((hh, i) =>
        b.set(refs.hints(caseId, fileId).doc(), { title: hh.title ?? '', text: hh.text, cost: hh.cost, order: i + 1 }),
      );
      await b.commit();
    }
    if (ev) {
      await deleteRecursive(refs.evidence(caseId, fileId));
      const b = firestore.batch();
      ev.forEach((ee, i) =>
        b.set(refs.evidence(caseId, fileId).doc(), { label: ee.label, value: ee.value, order: i + 1 }),
      );
      await b.commit();
    }
  },
};

export const answers = {
  async list(caseId, fileId) {
    return mapCol(await refs.answers(caseId, fileId).orderBy('__name__').get());
  },
};

export const hints = {
  async list(caseId, fileId) {
    return mapCol(await refs.hints(caseId, fileId).orderBy('order', 'asc').get());
  },
  async get(caseId, fileId, hintId) {
    return mapDoc(await refs.hint(caseId, fileId, hintId).get());
  },
};

export const evidence = {
  async list(caseId, fileId) {
    return mapCol(await refs.evidence(caseId, fileId).orderBy('order', 'asc').get());
  },
};

export const teams = {
  async get(id) {
    return mapDoc(await refs.team(id).get());
  },
  async getByCode(eventId, code) {
    const snap = await refs.teams().where('eventId', '==', eventId).where('code', '==', code).limit(2).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async getByName(eventId, name) {
    const snap = await refs.teams().where('eventId', '==', eventId).where('name', '==', name).limit(2).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async list(eventId) {
    return mapCol(
      await refs.teams().where('eventId', '==', eventId).orderBy('score', 'desc').orderBy('createdAt', 'asc').get(),
    );
  },
  async members(teamId) {
    return mapCol(await refs.members(teamId).orderBy('createdAt', 'asc').get());
  },
  async isMember(teamId, userId) {
    return (await refs.member(teamId, userId).get()).exists;
  },
};

export const memberships = {
  async get(userId, eventId) {
    const snap = await refs.membership(userId, eventId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...revive(snap.data()) };
  },
  async lookup(userId) {
    const snap = await refs.memberships(userId).orderBy('createdAt', 'asc').limit(1).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
};

// Submissions are sub-file answer attempts. Each row stores both the parent
// Case (`caseId`) and the sub-file (`fileId`) it belongs to.
export const subs = {
  async solvedFileIdsAll(teamId) {
    const snap = await refs
      .submissions()
      .where('teamId', '==', teamId)
      .where('correct', '==', true)
      .get();
    return new Set(snap.docs.map((d) => d.data().fileId));
  },
  async solvedFileIds(teamId, caseId) {
    const snap = await refs
      .submissions()
      .where('teamId', '==', teamId)
      .where('caseId', '==', caseId)
      .where('correct', '==', true)
      .get();
    return new Set(snap.docs.map((d) => d.data().fileId));
  },
  async solvedForEventTeam(eventId, teamId) {
    const snap = await refs
      .submissions()
      .where('eventId', '==', eventId)
      .where('teamId', '==', teamId)
      .where('correct', '==', true)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...revive(d.data()) }));
  },
  async attempts(teamId, caseId, fileId) {
    const snap = await refs
      .submissions()
      .where('teamId', '==', teamId)
      .where('caseId', '==', caseId)
      .where('fileId', '==', fileId)
      .get();
    return snap.size;
  },
  async attemptsByCase(teamId, caseId) {
    const snap = await refs
      .submissions()
      .where('teamId', '==', teamId)
      .where('caseId', '==', caseId)
      .get();
    const out = new Map();
    for (const d of snap.docs) {
      const fid = d.data().fileId;
      out.set(fid, (out.get(fid) || 0) + 1);
    }
    return out;
  },
  async solvedCounts(eventId) {
    const snap = await refs
      .submissions()
      .where('eventId', '==', eventId)
      .where('correct', '==', true)
      .get();
    const out = new Map();
    for (const d of snap.docs) {
      const tid = d.data().teamId;
      out.set(tid, (out.get(tid) || 0) + 1);
    }
    return out;
  },
  async listForEvent(eventId) {
    return mapCol(
      await refs.submissions().where('eventId', '==', eventId).orderBy('createdAt', 'desc').get(),
    );
  },
  async correctForTeam(teamId, caseId, fileId) {
    const snap = await refs
      .submissions()
      .where('teamId', '==', teamId)
      .where('caseId', '==', caseId)
      .where('fileId', '==', fileId)
      .get();
    return snap.docs.filter((d) => d.data().correct === true).map(mapDoc)[0] || null;
  },
  async solvedTotal(eventId) {
    return (await refs.submissions().where('eventId', '==', eventId).where('correct', '==', true).get()).size;
  },
  async total(eventId) {
    return (await refs.submissions().where('eventId', '==', eventId).get()).size;
  },
  async hasForTeam(teamId) {
    return (await refs.submissions().where('teamId', '==', teamId).limit(1).get()).size > 0;
  },
  async hasForCase(caseId) {
    return (await refs.submissions().where('caseId', '==', caseId).limit(1).get()).size > 0;
  },
  async hasForFile(caseId, fileId) {
    return (
      await refs
        .submissions()
        .where('caseId', '==', caseId)
        .where('fileId', '==', fileId)
        .limit(1)
        .get()
    ).size > 0;
  },
};

export const hintUsages = {
  async get(teamId, hintId) {
    const snap = await refs.hintUsages().where('teamId', '==', teamId).where('hintId', '==', hintId).limit(2).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async listForTeam(teamId) {
    const snap = await refs.hintUsages().where('teamId', '==', teamId).get();
    return snap.docs.map(mapDoc);
  },
  async byFile(teamId, caseId, fileId) {
    const snap = await refs
      .hintUsages()
      .where('teamId', '==', teamId)
      .where('caseId', '==', caseId)
      .where('fileId', '==', fileId)
      .get();
    return snap.docs.map(mapDoc);
  },
};

// Closing challenges: one per team per Case, with a rank awarded by the first
// three teams that close the Case (transaction on the Case's closureCount).
export const closings = {
  async get(id) {
    return mapDoc(await refs.closing(id).get());
  },
  async getByTeam(caseId, teamId) {
    const snap = await refs
      .closings()
      .where('caseId', '==', caseId)
      .where('teamId', '==', teamId)
      .limit(2)
      .get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async list(eventId) {
    const rows = mapCol(await refs.closings().where('eventId', '==', eventId).get());
    return rows.sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));
  },
  async listCase(caseId) {
    const rows = mapCol(await refs.closings().where('caseId', '==', caseId).get());
    return rows.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  },
  async count(eventId) {
    return (await refs.closings().where('eventId', '==', eventId).get()).size;
  },
};

export const scoreEvents = {
  async list(teamId) {
    return mapCol(
      await refs.scoreEvents().where('teamId', '==', teamId).orderBy('createdAt', 'asc').get(),
    );
  },
};

export { FieldValue, Timestamp };