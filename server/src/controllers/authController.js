import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { config, cookieOptions, parseDuration, IDENTITIES } from '../config.js';
import { users, memberships, teams } from '../db/repo.js';
import { adminAuth } from '../db/firebase.js';

const MAX_AGE_MS = parseDuration(config.jwtExpiresIn, 12 * 3600000);

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, cookieOptions(MAX_AGE_MS));
}

// Verifies a Firebase ID token and returns the payload. This is the only gate
// between the Firebase Auth SDK on the client and our session cookie.
async function verifyIdToken(idToken) {
  try {
    return await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    console.error('[auth] ID token verification failed:', err?.code, err?.message);
    throw new AppError(401, 'Invalid or expired firebase token. Please sign in again.');
  }
}

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  identity: z.enum(IDENTITIES).optional(),
  idToken: z.string().min(1),
});

export const loginSchema = z.object({
  idToken: z.string().min(1),
});

export const register = [
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, idToken } = req.body;
    const claims = await verifyIdToken(idToken);
    const email = claims.email;
    if (!email) throw new AppError(400, 'This account has no email address.');

    const existing = await users.get(claims.uid);
    if (existing) throw new AppError(409, 'An account with this email already exists.');

    const user = await users.create(
      { name: name.trim(), email, role: 'PARTICIPANT', identity: req.body.identity ?? null },
      claims.uid,
    );
    setAuthCookie(res, signToken(user));
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, identity: user.identity ?? null },
    });
  }),
];

export const login = [
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    const claims = await verifyIdToken(idToken);

    const user = await users.get(claims.uid);
    if (!user) throw new AppError(401, 'No account is registered for this email.');

    const safe = { id: user.id, name: user.name, email: user.email, role: user.role, identity: user.identity ?? null };
    setAuthCookie(res, signToken(user));
    res.json({ user: safe });
  }),
];

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  let membership = null;
  if (req.user.role === 'PARTICIPANT') {
    const m = await memberships.lookup(req.user.id);
    if (m) {
      const team = await teams.get(m.teamId);
      membership = {
        teamId: team?.id ?? m.teamId,
        teamName: team?.name ?? null,
        teamCode: team?.code ?? null,
        eventId: team?.eventId ?? m.eventId ?? m.id,
      };
    }
  }
  res.json({ user: req.user, membership });
});