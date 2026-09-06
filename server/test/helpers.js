// Test bootstrap for the BakerStreet detective API.
//
// Points the Firebase Admin SDK at the local emulators, then exposes the
// Firestore handle used by the suite. Run tests via `npm test` at the repo
// root (firebase emulators:exec boots fresh emulators for the run).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, '..', '..');

// The server workspace runs tests outside the repo root, so surface the root
// .env explicitly.
loadEnv({ path: path.resolve(rootDir, '.env') });

// Relax rate limits and point uploads at a throwaway directory for the tests.
process.env.API_RATE_LIMIT = '1000';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR = path.resolve(__dirname, '.uploads-test');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Use the local emulators; the app modules construct their Firebase clients
// from a shared src/db/firebase.js module, so the hosts must be set before it
// is imported below.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

export const { firestore, adminAuth } = await import('../src/db/firebase.js');

const AUTH_EMULATOR = (process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099').replace(/^https?:\/\//, '');

async function authRpc(path, payload) {
  const res = await fetch(`http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:${path}?key=test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) throw new Error(data.error?.message || `Auth ${path} failed`);
  return data;
}

// Mints a Firebase ID token for an existing emulator user (id "localId").
export async function testSignInToken(email, password) {
  const data = await authRpc('signInWithPassword', { email, password, returnSecureToken: true });
  return data.idToken;
}

// Creates an emulator user and returns its uid and a fresh ID token.
export async function testSignUpToken(email, password) {
  const data = await authRpc('signUp', { email, password, returnSecureToken: true });
  return { uid: data.localId, idToken: data.idToken };
}

const TOP_LEVEL_COLLECTIONS = ['users', 'events', 'cases', 'teams', 'submissions', 'hintUsages', 'scoreEvents', 'closings'];

// Removes every document (including subcollections) from the emulator database.
export async function resetDb() {
  await Promise.all(
    TOP_LEVEL_COLLECTIONS.map((name) => firestore.recursiveDelete(firestore.collection(name))),
  );
}