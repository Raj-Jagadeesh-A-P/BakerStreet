import fs from 'node:fs';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { config } from '../config.js';

let credential;
const saPath = config.firebaseServiceAccount;
if (saPath && fs.existsSync(saPath)) {
  credential = cert(JSON.parse(fs.readFileSync(saPath, 'utf8')));
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = applicationDefault();
}

export const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIREBASE_EMULATOR);

if (!credential && !emulator) {
  console.warn(
    '[firebase] No service account configured (FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS) and no emulator host set.',
  );
}

// The Firebase Auth emulator only serves its own project id, so when a demo
// emulator is active the Admin SDK must talk to it under that id (not the
// production project id).
const projectId = emulator
  ? process.env.FIREBASE_EMULATOR_PROJECT_ID || 'demo-glugot'
  : config.firebaseProjectId;

export const adminApp =
  getApps()[0] ||
  initializeApp({
    ...(credential ? { credential } : {}),
    projectId,
  });

export const firestore = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);