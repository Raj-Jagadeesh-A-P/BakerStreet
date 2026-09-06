import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { users } from '../db/repo.js';
import { AppError, asyncHandler } from './errors.js';

function extractToken(req) {
  const fromCookie = req.cookies && req.cookies[config.cookieName];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw new AppError(401, 'Not authenticated.');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError(401, 'Session expired. Please log in again.');
  }
  const user = await users.get(payload.sub);
  if (!user) throw new AppError(401, 'Account no longer exists.');
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    identity: user.identity ?? null,
  };
  next();
});

export const requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') throw new AppError(403, 'Admin access required.');
  next();
};