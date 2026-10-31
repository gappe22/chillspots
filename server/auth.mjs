import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from './validation.mjs';

const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = 'chillspots_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const XP_NEW_SPOT = 50;
export const XP_NEW_REVIEW = 10;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { salt, hash: hash.toString('hex') };
}

export async function verifyPassword(password, stored) {
  // Use the same expensive operation for an unknown email to avoid a fast user lookup oracle.
  const expected = stored ?? { salt: '8f07b9c9de039da7ed21ab551a2f1c4c', hash: '00'.repeat(64) };
  const hash = await scrypt(password, expected.salt, 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(hash, Buffer.from(expected.hash, 'hex')) && !!stored;
}

export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const defaultPreferences = { distanceUnit: 'km', defaultView: 'map', reduceMotion: false };
export const publicProfile = user => ({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, xp: user.xp, level: 1 + Math.floor(user.xp / 100), preferences: { ...defaultPreferences, ...user.preferences } });

export function addSession(data, userId) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  data.sessions = data.sessions.filter(session => Date.parse(session.expiresAt) > now);
  data.sessions.push({ tokenHash: hashToken(token), userId, expiresAt: new Date(now + SESSION_SECONDS * 1000).toISOString() });
  return token;
}

export function requestToken(req) {
  const authorization = req.get('authorization');
  if (authorization) return /^Bearer ([a-f0-9]{64})$/i.exec(authorization)?.[1];
  return req.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
}

export function requireUser(req, data) {
  const token = requestToken(req);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) throw new ApiError(401, 'UNAUTHORIZED', 'Accedi per continuare.');
  const tokenHash = hashToken(token);
  const session = data.sessions.find(item => item.tokenHash === tokenHash && Date.parse(item.expiresAt) > Date.now());
  const user = session && data.users.find(item => item.id === session.userId);
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'La sessione è scaduta. Accedi di nuovo.');
  return user;
}

export function sessionCookie(res, token, secure, clear = false) {
  res.cookie(COOKIE_NAME, clear ? '' : token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: clear ? 0 : SESSION_SECONDS * 1000 });
}

/** Process-local throttling, with bounded entries, for login and account creation. */
export function createAuthLimiter({ maximum = 12, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return req => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10000) throw new ApiError(429, 'RATE_LIMITED', 'Troppi tentativi. Riprova tra qualche minuto.');
      entry = { count: 0, expires: now + windowMs };
      attempts.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > maximum) throw new ApiError(429, 'RATE_LIMITED', 'Troppi tentativi. Riprova tra qualche minuto.');
  };
}
