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
  answers: (caseId) => firestore.collection(`cases/${caseId}/answers`),
  hints: (caseId) => firestore.collection(`cases/${caseId}/hints`),
  hint: (caseId, hintId) => firestore.doc(`cases/${caseId}/hints/${hintId}`),
  evidence: (caseId) => firestore.collection(`cases/${caseId}/evidence`),

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

  finalDoc: () => firestore.collection('finalSubmissions').doc(),
  finals: () => firestore.collection('finalSubmissions'),
  final: (id) => firestore.doc(`finalSubmissions/${id}`),
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
    const teams = await teams.list(eventId);
    return teams.reduce((sum, t) => sum + (t.memberCount ?? 0), 0);
  },
};

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
    await refs.case(id).set(data, { merge: true });
    return mapDoc(await refs.case(id).get());
  },
  async count(eventId) {
    return (await refs.cases().where('eventId', '==', eventId).get()).size;
  },
  async listFull(eventId) {
    const rows = await cases.list(eventId);
    for (const row of rows) {
      row.answers = await answers.list(row.id);
      row.hints = await hints.list(row.id);
      row.evidence = await evidence.list(row.id);
    }
    return rows;
  },
  async create(eventId, data, { answers: ans = [], hints: h = [], evidence: ev = [] } = {}) {
    const ref = refs.cases().doc();
    const b = firestore.batch();
    b.set(ref, { eventId, ...dropUndefined(data), createdAt: now() });
    const answerIds = ans.map(() => refs.answers(ref.id).doc());
    const hintRefs = h.map(() => refs.hints(ref.id).doc());
    const evidenceRefs = ev.map(() => refs.evidence(ref.id).doc());
    answerIds.forEach((r, i) => b.set(r, { value: ans[i].value }));
    hintRefs.forEach((r, i) =>
      b.set(r, { title: h[i].title ?? '', text: h[i].text, cost: h[i].cost ?? 10, order: i + 1 }),
    );
    evidenceRefs.forEach((r, i) => b.set(r, { label: ev[i].label, value: ev[i].value, order: i + 1 }));
    await b.commit();
    return {
      id: ref.id,
      eventId,
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
  async replaceChildren(caseId, { answers: ans, hints: h, evidence: ev }) {
    if (ans) {
      await deleteRecursive(refs.answers(caseId));
      const b = firestore.batch();
      for (const a of ans) b.set(refs.answers(caseId).doc(), { value: a.value });
      await b.commit();
    }
    if (h) {
      await deleteRecursive(refs.hints(caseId));
      const b = firestore.batch();
      h.forEach((hh, i) => b.set(refs.hints(caseId).doc(), { title: hh.title ?? '', text: hh.text, cost: hh.cost, order: i + 1 }));
      await b.commit();
    }
    if (ev) {
      await deleteRecursive(refs.evidence(caseId));
      const b = firestore.batch();
      ev.forEach((ee, i) => b.set(refs.evidence(caseId).doc(), { label: ee.label, value: ee.value, order: i + 1 }));
      await b.commit();
    }
  },
  async delete(caseId) {
    await deleteRecursive(refs.case(caseId));
  },
  async lastOrder(eventId) {
    const rows = await cases.list(eventId);
    return rows.length ? rows[rows.length - 1].order : 0;
  },
};

export const answers = {
  async list(caseId) {
    return mapCol(await refs.answers(caseId).orderBy('__name__').get());
  },
};

export const hints = {
  async list(caseId) {
    return mapCol(await refs.hints(caseId).orderBy('order', 'asc').get());
  },
  async get(caseId, hintId) {
    return mapDoc(await refs.hint(caseId, hintId).get());
  },
};

export const evidence = {
  async list(caseId) {
    return mapCol(await refs.evidence(caseId).orderBy('order', 'asc').get());
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

export const subs = {
  async solvedCaseIds(teamId) {
    const snap = await refs.submissions().where('teamId', '==', teamId).where('correct', '==', true).get();
    return new Set(snap.docs.map((d) => d.data().caseId));
  },
  async solvedForTeam(teamId) {
    const snap = await refs.submissions().where('teamId', '==', teamId).where('correct', '==', true).get();
    return snap.docs.map((d) => ({ id: d.id, ...revive(d.data()) }));
  },
  async attempts(teamId, caseId) {
    const snap = await refs.submissions().where('teamId', '==', teamId).where('caseId', '==', caseId).get();
    return snap.size;
  },
  async countsByCase(teamId) {
    const snap = await refs.submissions().where('teamId', '==', teamId).get();
    const out = new Map();
    for (const d of snap.docs) {
      const cid = d.data().caseId;
      out.set(cid, (out.get(cid) || 0) + 1);
    }
    return out;
  },
  async solvedCounts(eventId) {
    const snap = await refs.submissions().where('eventId', '==', eventId).where('correct', '==', true).get();
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
  async correctForTeamCase(teamId, caseId) {
    const snap = await refs.submissions().where('teamId', '==', teamId).where('caseId', '==', caseId).get();
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
  async byCase(teamId, caseId) {
    const snap = await refs.hintUsages().where('teamId', '==', teamId).where('caseId', '==', caseId).get();
    return snap.docs.map(mapDoc);
  },
};

export const finals = {
  async get(id) {
    return mapDoc(await refs.final(id).get());
  },
  async getByTeam(teamId) {
    const snap = await refs.finals().where('teamId', '==', teamId).limit(2).get();
    return snap.docs.length ? mapDoc(snap.docs[0]) : null;
  },
  async list(eventId) {
    return mapCol(
      await refs.finals().where('eventId', '==', eventId).orderBy('createdAt', 'asc').get(),
    );
  },
  async count(eventId) {
    return (await refs.finals().where('eventId', '==', eventId).get()).size;
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