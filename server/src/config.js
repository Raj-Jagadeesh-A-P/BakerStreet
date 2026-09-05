import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev and tests load .env (emulator-first). Production loads .env.production,
// which must NOT contain any FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
// entries — that is what keeps a production process off the local emulators.
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
loadEnv({ path: path.resolve(__dirname, '..', '..', envFile) });

const bool = (v, d = false) => (v === undefined ? d : String(v).toLowerCase() === 'true');

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  cookieName: 'glugot_token',
  // Cookies get the Secure flag in production unless COOKIE_SECURE=false, which
  // is handy when smoke-testing production builds over plain http://localhost.
  cookieSecure: process.env.COOKIE_SECURE !== undefined ? process.env.COOKIE_SECURE === 'true' : undefined,
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'glugot-found',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || null,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
};

export const MESSAGES = {
  notStarted: 'Event has not started.',
  ended: 'Event has ended.',
  paused: 'Event is paused.',
  locked: 'This case is locked.',
  alreadySolved: 'This case is already solved.',
  maxAttempts: 'You have reached the maximum attempts.',
  incorrect: 'Incorrect. Re-examine the evidence and try again.',
  notJoined: "You haven't joined an event yet.",
  teamFull: 'This team is full.',
  alreadyInTeam: 'You are already in a team for this event.',
  hintUsed: 'This hint has already been used.',
  finalExists: 'Final investigation already submitted.',
  finalLocked: 'The final case is not unlocked yet.',
  notFound: 'Not found.',
  generic: 'Something went wrong. Please retry.',
};

export const DEFAULT_FINAL_SCORING = {
  contributor: 100,
  commit: 100,
  issue: 75,
  pr: 75,
  rootCause: 100,
  fix: 100,
  evidence: 50,
  total: 600,
};

export function finalScoring(event) {
  const f = event?.finalScoring;
  if (f && typeof f === 'object') return { ...DEFAULT_FINAL_SCORING, ...f };
  return { ...DEFAULT_FINAL_SCORING };
}

const MS = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
export function parseDuration(str, fallbackMs) {
  if (!str) return fallbackMs;
  const m = /^(\d+)\s*(ms|s|m|h|d|w)$/.exec(String(str).trim());
  if (!m) return fallbackMs;
  return Number(m[1]) * MS[m[2]];
}

export function isProd() {
  return config.nodeEnv === 'production';
}

export function cookieOptions(maxAgeMs) {
  const secure =
    config.cookieSecure !== undefined ? config.cookieSecure : config.nodeEnv === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  };
}