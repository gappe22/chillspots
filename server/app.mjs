import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { ApiError, validateCredentials, validatePreferences, validateProfile, validateQuery, validateReview, validateSpot } from './validation.mjs';
import { addSession, createAuthLimiter, hashPassword, hashToken, publicProfile, requestToken, requireUser, sessionCookie, verifyPassword, XP_NEW_REVIEW, XP_NEW_SPOT } from './auth.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const round = value => Math.round(value * 10) / 10;
const mean = ratings => (ratings.beauty + ratings.privacy + ratings.accessibility) / 3;
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Spot non trovato.');
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
const developmentOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:8083', 'http://127.0.0.1:8083', 'http://localhost:19006', 'http://127.0.0.1:19006'];

export async function createApp({
  dataFile = process.env.CHILLSPOTS_DATA_FILE || join(root, 'server/data/chillspots.json'),
  staticDir = join(root, 'dist'),
  allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean) ?? developmentOrigins,
  secureCookies = process.env.NODE_ENV === 'production',
  authRateLimit,
  xpNewSpot = XP_NEW_SPOT,
  xpNewReview = XP_NEW_REVIEW,
  onError = error => console.error('Chillspots API error:', error.message),
} = {}) {
  if (![xpNewSpot, xpNewReview].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('XP rewards must be non-negative integers.');
  const store = await createStore(resolve(dataFile));
  const app = express();
  const origins = new Set(allowedOrigins);
  const limitAuth = createAuthLimiter(authRateLimit);
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}` && !origins.has(origin)) {
      return next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origine della richiesta non consentita.'));
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.vary('Origin');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api', express.json({ limit: '5mb', strict: true }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: 'demo' }));
  app.post('/api/auth/register', async (req, res) => {
    limitAuth(req);
    const input = validateCredentials(req.body, true);
    const passwordHash = await hashPassword(input.password);
    const result = await store.mutate(data => {
      if (data.users.some(user => user.email === input.email)) throw new ApiError(409, 'ACCOUNT_EXISTS', 'Impossibile creare un account con questa email.');
      const user = { id: randomUUID(), name: input.name, email: input.email, avatar: null, xp: 0, savedSpotIds: [], passwordHash, createdAt: new Date().toISOString() };
      data.users.push(user);
      return { profile: publicProfile(user), token: addSession(data, user.id) };
    });
    sessionCookie(res, result.token, secureCookies);
    res.status(201).json(result);
  });
  app.post('/api/auth/login', async (req, res) => {
    limitAuth(req);
    const input = validateCredentials(req.body);
    const existing = store.read().users.find(user => user.email === input.email);
    if (!await verifyPassword(input.password, existing?.passwordHash)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email o password non corrette.');
    const result = await store.mutate(data => {
      const user = data.users.find(item => item.id === existing.id);
      return { profile: publicProfile(user), token: addSession(data, user.id) };
    });
    sessionCookie(res, result.token, secureCookies);
    res.json(result);
  });
  app.get(['/api/auth/me', '/api/profile'], (req, res) => res.json({ profile: publicProfile(requireUser(req, store.read())) }));
  app.get('/api/account', (req, res) => {
    const data = store.read();
    const user = requireUser(req, data);
    res.json({ profile: publicProfile(user), savedSpotIds: user.savedSpotIds ?? [], contributions: {
      spots: data.spots.filter(spot => spot.ownerId === user.id),
      reviews: data.spots.flatMap(spot => (data.reviews[spot.id] ?? []).filter(review => review.authorId === user.id).map(review => ({ ...review, spotId: spot.id, spotName: spot.name }))),
    } });
  });
  app.patch('/api/profile', async (req, res) => {
    requireUser(req, store.read());
    const input = validateProfile(req.body);
    const result = await store.mutate(data => {
      const user = requireUser(req, data);
      Object.assign(user, input);
      for (const reviews of Object.values(data.reviews)) for (const review of reviews) if (review.authorId === user.id) review.author = { name: user.name, avatar: user.avatar };
      return { profile: publicProfile(user) };
    });
    res.json(result);
  });
  app.patch('/api/preferences', async (req, res) => {
    requireUser(req, store.read());
    const preferences = validatePreferences(req.body);
    res.json(await store.mutate(data => { const user = requireUser(req, data); user.preferences = preferences; return { profile: publicProfile(user) }; }));
  });
  app.post('/api/auth/password', async (req, res) => {
    limitAuth(req);
    const user = requireUser(req, store.read());
    const current = validateCredentials({ email: user.email, password: req.body?.currentPassword });
    const next = validateCredentials({ name: user.name, email: user.email, password: req.body?.newPassword }, true);
    if (!await verifyPassword(current.password, user.passwordHash)) throw new ApiError(401, 'INVALID_PASSWORD', 'La password attuale non è corretta.');
    const passwordHash = await hashPassword(next.password);
    const result = await store.mutate(data => {
      const account = requireUser(req, data);
      if (account.passwordHash.hash !== user.passwordHash.hash) throw new ApiError(409, 'PASSWORD_CHANGED', 'La password è già cambiata. Accedi di nuovo.');
      account.passwordHash = passwordHash;
      data.sessions = data.sessions.filter(session => session.userId !== account.id);
      return { profile: publicProfile(account), token: addSession(data, account.id) };
    });
    sessionCookie(res, result.token, secureCookies);
    res.json(result);
  });
  app.put('/api/saved/:id', async (req, res) => {
    requireUser(req, store.read());
    res.json(await store.mutate(data => {
      const user = requireUser(req, data);
      if (!data.spots.some(spot => spot.id === req.params.id)) throw notFound();
      user.savedSpotIds = [...new Set([...(user.savedSpotIds ?? []), req.params.id])];
      return { savedSpotIds: user.savedSpotIds };
    }));
  });
  app.delete('/api/saved/:id', async (req, res) => {
    res.json(await store.mutate(data => { const user = requireUser(req, data); user.savedSpotIds = (user.savedSpotIds ?? []).filter(id => id !== req.params.id); return { savedSpotIds: user.savedSpotIds }; }));
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = requestToken(req);
    if (token) await store.mutate(data => { data.sessions = data.sessions.filter(session => session.tokenHash !== hashToken(token)); });
    sessionCookie(res, '', secureCookies, true);
    res.sendStatus(204);
  });
  app.get('/api/spots', (req, res) => {
    const query = normalize(validateQuery(req.query.q));
    const spots = store.read().spots.filter(spot => normalize(`${spot.name} ${spot.locality} ${spot.description}`).includes(query));
    res.json({ spots });
  });
  app.get('/api/spots/:id', (req, res) => {
    const spot = store.read().spots.find(item => item.id === req.params.id);
    if (!spot) throw notFound();
    res.json({ spot });
  });
  app.get('/api/spots/:id/reviews', (req, res) => {
    const data = store.read();
    if (!data.spots.some(spot => spot.id === req.params.id)) throw notFound();
    res.json({ reviews: data.reviews[req.params.id] ?? [] });
  });
  app.post('/api/spots', async (req, res) => {
    requireUser(req, store.read());
    const input = validateSpot(req.body);
    const result = await store.mutate(data => {
      const user = requireUser(req, data);
      const item = { ...input, id: randomUUID(), ownerId: user.id, createdAt: new Date().toISOString(), ratings: { ...input.ratings, overall: round(mean(input.ratings)) }, reviewCount: 0 };
      data.spots.push(item);
      data.reviews[item.id] = [];
      data.ratingTotals[item.id] = { count: 1, ...input.ratings, overall: mean(input.ratings) };
      user.xp += xpNewSpot;
      return { spot: item, profile: publicProfile(user) };
    });
    res.status(201).location(`/api/spots/${result.spot.id}`).json(result);
  });
  app.post('/api/spots/:id/reviews', async (req, res) => {
    requireUser(req, store.read());
    const input = validateReview(req.body);
    const result = await store.mutate(data => {
      const user = requireUser(req, data);
      const spot = data.spots.find(item => item.id === req.params.id);
      if (!spot) throw notFound();
      if (data.reviews[spot.id].some(review => review.authorId === user.id)) throw new ApiError(409, 'ALREADY_REVIEWED', 'Hai già recensito questo spot.');
      const review = { ...input, id: randomUUID(), authorId: user.id, author: { name: user.name, avatar: user.avatar }, createdAt: new Date().toISOString() };
      data.reviews[spot.id].unshift(review);
      spot.reviewCount += 1;
      const totals = data.ratingTotals[spot.id];
      totals.count += 1;
      for (const key of ['beauty', 'privacy', 'accessibility']) totals[key] += input.ratings[key];
      totals.overall += mean(input.ratings);
      spot.ratings = Object.fromEntries(['beauty', 'privacy', 'accessibility', 'overall'].map(key => [key, round(totals[key] / totals.count)]));
      user.xp += xpNewReview;
      return { review, spot, profile: publicProfile(user) };
    });
    res.status(201).json(result);
  });
  app.patch('/api/spots/:id', async (req, res) => {
    requireUser(req, store.read());
    const { ratings: _ratings, ...input } = validateSpot({ ...req.body, ratings: { beauty: 3, privacy: 3, accessibility: 3 } });
    res.json(await store.mutate(data => {
      const user = requireUser(req, data);
      const spot = data.spots.find(item => item.id === req.params.id);
      if (!spot) throw notFound();
      if (spot.ownerId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Puoi modificare solo i tuoi spot.');
      Object.assign(spot, input, { updatedAt: new Date().toISOString() });
      return { spot, profile: publicProfile(user) };
    }));
  });
  function changeReview(req, deleting, input) {
    return store.mutate(data => {
      const user = requireUser(req, data);
      const spot = data.spots.find(item => item.id === req.params.id);
      const reviews = data.reviews[req.params.id] ?? [];
      const review = reviews.find(item => item.id === req.params.reviewId);
      if (!spot || !review) throw notFound();
      if (review.authorId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Puoi modificare solo le tue recensioni.');
      const totals = data.ratingTotals[spot.id];
      for (const key of ['beauty', 'privacy', 'accessibility']) totals[key] += (deleting ? 0 : input.ratings[key]) - review.ratings[key];
      totals.overall += (deleting ? 0 : mean(input.ratings)) - mean(review.ratings);
      if (deleting) {
        totals.count -= 1;
        spot.reviewCount -= 1;
        data.reviews[spot.id] = reviews.filter(item => item.id !== review.id);
        user.xp = Math.max(0, user.xp - xpNewReview);
      } else Object.assign(review, input, { updatedAt: new Date().toISOString() });
      spot.ratings = Object.fromEntries(['beauty', 'privacy', 'accessibility', 'overall'].map(key => [key, round(totals[key] / totals.count)]));
      return { spot, review: deleting ? null : review, profile: publicProfile(user) };
    });
  }
  app.patch('/api/spots/:id/reviews/:reviewId', async (req, res) => {
    requireUser(req, store.read());
    res.json(await changeReview(req, false, validateReview(req.body)));
  });
  app.delete('/api/spots/:id/reviews/:reviewId', async (req, res) => res.json(await changeReview(req, true)));
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Endpoint API non trovato.')));

  if (staticDir && existsSync(join(staticDir, 'index.html'))) {
    const directory = resolve(staticDir);
    app.use(express.static(directory));
    // Express 5 requires a named wildcard. Braces also match the root path.
    app.get('/{*path}', (req, res, next) => {
      if (!req.accepts('html') || /\.[a-z0-9]+$/i.test(req.path)) return next();
      res.sendFile(join(directory, 'index.html'));
    });
  }
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pagina non trovata.' } }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON non valido.' } });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Le immagini superano il limite consentito.' } });
    if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) } });
    onError(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Impossibile completare la richiesta. Riprova.' } });
  });
  return app;
}
