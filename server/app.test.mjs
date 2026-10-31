import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.mjs';

const credentials = { name: 'Andrea Test', email: 'andrea@example.test', password: 'correct horse battery' };
const ratings = { beauty: 5, privacy: 4, accessibility: 3 };
const place = { name: 'Un nuovo posto', locality: 'Brescia, BS', description: 'Una sosta tra gli alberi.', latitude: 45.6, longitude: 10.4, photos: ['mountain'], ratings };

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'chillspots-api-'));
  const dataFile = join(directory, 'data.json');
  const servers = [];
  t.after(async () => {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    await rm(directory, { recursive: true, force: true });
  });
  async function start(extra = {}) {
    const app = await createApp({ dataFile, staticDir: null, authRateLimit: { maximum: 100 }, onError: error => { throw error; }, ...options, ...extra });
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    return {
      server,
      async request(path, { method = 'GET', body, token, cookie, headers = {} } = {}) {
        return fetch(`${origin}${path}`, {
          method,
          headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      },
    };
  }
  const client = await start();
  return { ...client, start, directory, dataFile, async register(body = credentials) {
    const response = await client.request('/api/auth/register', { method: 'POST', body });
    assert.equal(response.status, 201);
    return { ...await response.json(), cookie: response.headers.get('set-cookie').split(';')[0], cookieHeader: response.headers.get('set-cookie') };
  } };
}

test('public routes return reference demo data, search results, and JSON not-found responses', async t => {
  const f = await fixture(t);
  assert.deepEqual(await (await f.request('/api/health')).json(), { status: 'ok', mode: 'demo' });
  const { spots } = await (await f.request('/api/spots')).json();
  assert.equal(spots.length, 3);
  assert.deepEqual(spots[0].ratings, { beauty: 3.5, privacy: 4.3, accessibility: 2.7, overall: 3.9 });
  const found = await (await f.request('/api/spots?q=MONTE')).json();
  assert.deepEqual(found.spots.map(spot => spot.id), ['monte-croce']);
  assert.equal((await (await f.request('/api/spots?q=not-a-place')).json()).spots.length, 0);
  const reviews = await (await f.request('/api/spots/monte-croce/reviews')).json();
  assert.deepEqual(reviews.reviews.map(review => review.author.name), ['Scobe', 'Mark']);
  for (const path of ['/api/spots/missing', '/api/spots/missing/reviews', '/api/unknown']) {
    const response = await f.request(path);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  }
  assert.equal((await f.request('/api/spots?q=one&q=two')).status, 400);
});

test('register/login create hashed accounts and persisted sessions; cookie and bearer authentication work', async t => {
  const f = await fixture(t);
  const account = await f.register({ ...credentials, email: ' Andrea@EXAMPLE.test ' });
  assert.equal(account.profile.email, 'andrea@example.test');
  assert.equal(account.profile.xp, 0);
  assert.equal(account.profile.level, 1);
  assert.match(account.cookieHeader, /HttpOnly/);
  assert.match(account.cookieHeader, /SameSite=Lax/);
  assert.doesNotMatch(account.cookieHeader, /Secure/);
  assert.deepEqual((await (await f.request('/api/auth/me', { token: account.token })).json()).profile, account.profile);
  assert.deepEqual((await (await f.request('/api/profile', { cookie: account.cookie })).json()).profile, account.profile);
  const persisted = await readFile(f.dataFile, 'utf8');
  assert.ok(!persisted.includes(credentials.password));
  assert.ok(!persisted.includes(account.token));
  const data = JSON.parse(persisted);
  assert.equal(data.users[0].passwordHash.salt.length, 32);
  assert.equal(data.users[0].passwordHash.hash.length, 128);
  assert.equal(data.sessions[0].tokenHash.length, 64);
  const restarted = await f.start();
  assert.equal((await restarted.request('/api/auth/me', { token: account.token })).status, 200);
  const login = await restarted.request('/api/auth/login', { method: 'POST', body: { email: 'ANDREA@example.test', password: credentials.password } });
  assert.equal(login.status, 200);
  assert.notEqual((await login.json()).token, account.token);
  assert.equal((await f.request('/api/auth/register', { method: 'POST', body: credentials })).status, 409);
});

test('authentication rejects invalid credentials, expires sessions, and revokes logout tokens', async t => {
  const f = await fixture(t, { secureCookies: true });
  const account = await f.register();
  assert.match(account.cookieHeader, /Secure/);
  for (const path of ['/api/profile', '/api/auth/me']) assert.equal((await f.request(path)).status, 401);
  assert.equal((await f.request('/api/spots', { method: 'POST', body: place })).status, 401);
  assert.equal((await f.request('/api/spots/monte-croce/reviews', { method: 'POST', body: { text: 'Hello', ratings } })).status, 401);
  const errors = [];
  for (const email of [credentials.email, 'missing@example.test']) {
    const response = await f.request('/api/auth/login', { method: 'POST', body: { email, password: 'wrong password' } });
    assert.equal(response.status, 401);
    errors.push(await response.json());
  }
  assert.deepEqual(errors[0], errors[1]);
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', token: account.token })).status, 204);
  assert.equal((await f.request('/api/auth/me', { token: account.token })).status, 401);
  const login = await (await f.request('/api/auth/login', { method: 'POST', body: credentials })).json();
  const data = JSON.parse(await readFile(f.dataFile, 'utf8'));
  data.sessions[0].expiresAt = '2000-01-01T00:00:00.000Z';
  await writeFile(f.dataFile, JSON.stringify(data));
  const restarted = await f.start();
  assert.equal((await restarted.request('/api/auth/me', { token: login.token })).status, 401);
});

test('creating places persists data and awards XP once per creation, deriving levels from XP', async t => {
  const f = await fixture(t);
  const { token, profile } = await f.register();
  const response = await f.request('/api/spots', { method: 'POST', token, body: place });
  assert.equal(response.status, 201);
  const first = await response.json();
  assert.equal(first.spot.ownerId, profile.id);
  assert.equal(first.spot.ratings.overall, 4);
  assert.equal(first.spot.reviewCount, 0);
  assert.equal(first.profile.xp, 50);
  assert.equal(first.profile.level, 1);
  const second = await (await f.request('/api/spots', { method: 'POST', token, body: { ...place, name: 'Secondo posto' } })).json();
  assert.equal(second.profile.xp, 100);
  assert.equal(second.profile.level, 2);
  const restarted = await f.start();
  assert.deepEqual((await (await restarted.request(`/api/spots/${first.spot.id}`)).json()).spot, first.spot);
  assert.equal((await (await restarted.request('/api/auth/me', { token })).json()).profile.xp, 100);
});

test('review submission updates aggregates, uses authenticated identity, and prevents concurrent duplicate XP', async t => {
  const f = await fixture(t);
  const account = await f.register();
  const body = { text: 'Davvero un bel posto.', ratings: { beauty: 5, privacy: 5, accessibility: 5 }, author: { name: 'Forged name' } };
  const responses = await Promise.all([1, 2].map(() => f.request('/api/spots/monte-croce/reviews', { method: 'POST', token: account.token, body })));
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  const saved = await responses.find(response => response.status === 201).json();
  assert.equal(saved.review.author.name, credentials.name);
  assert.equal(saved.review.authorId, account.profile.id);
  assert.equal(saved.spot.reviewCount, 3);
  assert.deepEqual(saved.spot.ratings, { beauty: 4, privacy: 4.5, accessibility: 3.5, overall: 4.3 });
  assert.equal(saved.profile.xp, 10);
  assert.equal((await (await f.request('/api/auth/me', { token: account.token })).json()).profile.xp, 10);
  const restarted = await f.start();
  const reviews = await (await restarted.request('/api/spots/monte-croce/reviews')).json();
  assert.equal(reviews.reviews[0].id, saved.review.id);
  assert.equal((await restarted.request('/api/spots/monte-croce/reviews', { method: 'POST', token: account.token, body })).status, 409);
});

test('invalid submissions and missing targets never mutate records or grant XP', async t => {
  const f = await fixture(t);
  const { token } = await f.register();
  const invalidBodies = [
    { ...place, latitude: 91 }, { ...place, longitude: '10.4' }, { ...place, name: 'x' },
    { ...place, ratings: { ...ratings, beauty: 6 } }, { ...place, photos: [] },
    { ...place, photos: ['https://example.test/image.jpg'] },
    { ...place, photos: ['data:image/png;base64,aGVsbG8='] },
    { ...place, photos: ['mountain', 'mountain', 'mountain', 'mountain'] },
  ];
  for (const body of invalidBodies) {
    const response = await f.request('/api/spots', { method: 'POST', token, body });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  }
  assert.equal((await f.request('/api/spots/missing/reviews', { method: 'POST', token, body: { text: 'test', ratings } })).status, 404);
  assert.equal((await f.request('/api/spots/monte-croce/reviews', { method: 'POST', token, body: { text: '  ', ratings } })).status, 400);
  assert.equal((await (await f.request('/api/spots')).json()).spots.length, 3);
  assert.equal((await (await f.request('/api/auth/me', { token })).json()).profile.xp, 0);
});

test('accepts a bounded image data URI and rejects oversized request payloads', async t => {
  const f = await fixture(t);
  const { token } = await f.register();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=';
  const response = await f.request('/api/spots', { method: 'POST', token, body: { ...place, photos: [png] } });
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).spot.photos, [png]);
  const huge = await f.request('/api/spots', { method: 'POST', token, body: { ...place, description: 'a'.repeat(5 * 1024 * 1024) } });
  assert.equal(huge.status, 413);
});

test('allows only configured browser origins, with credentials and preflight headers', async t => {
  const f = await fixture(t, { allowedOrigins: ['http://localhost:8081'] });
  const allowed = await f.request('/api/health', { headers: { Origin: 'http://localhost:8081' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  assert.equal((await f.request('/api/spots', { method: 'POST', body: place, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const preflight = await f.request('/api/spots', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
});

test('throttles repeated authentication attempts', async t => {
  const f = await fixture(t, { authRateLimit: { maximum: 2, windowMs: 60000 } });
  for (let attempt = 0; attempt < 2; attempt++) assert.equal((await f.request('/api/auth/login', { method: 'POST', body: credentials })).status, 401);
  const response = await f.request('/api/auth/login', { method: 'POST', body: credentials });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, 'RATE_LIMITED');
});

test('serves Expo SPA routes without swallowing missing APIs or assets', async t => {
  const f = await fixture(t);
  const staticDir = join(f.directory, 'dist');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>Chillspots</title>');
  await writeFile(join(staticDir, 'app.js'), 'window.loaded = true;');
  const web = await f.start({ staticDir });
  assert.match(await (await web.request('/')).text(), /Chillspots/);
  assert.match(await (await web.request('/spots/monte-croce', { headers: { Accept: 'text/html' } })).text(), /Chillspots/);
  assert.equal((await web.request('/app.js')).status, 200);
  assert.equal((await web.request('/missing.js')).status, 404);
  const missing = await web.request('/api/unknown', { headers: { Accept: 'text/html' } });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /application\/json/);
});

test('saved spots are private, idempotent, and survive restart', async t => {
  const f = await fixture(t);
  const a = await f.register();
  const b = await f.register({ ...credentials, email: 'other@example.test' });
  assert.equal((await f.request('/api/saved/monte-croce', { method: 'PUT' })).status, 401);
  for (let i = 0; i < 2; i++) {
    const response = await f.request('/api/saved/monte-croce', { method: 'PUT', token: a.token });
    assert.deepEqual((await response.json()).savedSpotIds, ['monte-croce']);
  }
  assert.equal((await f.request('/api/saved/missing', { method: 'PUT', token: a.token })).status, 404);
  assert.deepEqual((await (await f.request('/api/account', { token: b.token })).json()).savedSpotIds, []);
  const restarted = await f.start();
  assert.deepEqual((await (await restarted.request('/api/account', { token: a.token })).json()).savedSpotIds, ['monte-croce']);
  const response = await f.request('/api/saved/monte-croce', { method: 'DELETE', token: a.token });
  assert.deepEqual((await response.json()).savedSpotIds, []);
});

test('profile and settings edits persist without granting XP and update review attribution', async t => {
  const f = await fixture(t);
  const { token } = await f.register();
  await f.request('/api/spots/monte-croce/reviews', { method: 'POST', token, body: { text: 'Una recensione.', ratings } });
  const response = await f.request('/api/profile', { method: 'PATCH', token, body: { name: 'Nuovo nome', avatar: 'scobe', xp: 99999 } });
  const { profile } = await response.json();
  assert.equal(profile.name, 'Nuovo nome');
  assert.equal(profile.xp, 10);
  const reviews = await (await f.request('/api/spots/monte-croce/reviews')).json();
  assert.equal(reviews.reviews[0].author.name, 'Nuovo nome');
  assert.equal(reviews.reviews[0].author.avatar, 'scobe');
  const preferences = { distanceUnit: 'mi', defaultView: 'list', reduceMotion: true };
  assert.equal((await f.request('/api/preferences', { method: 'PATCH', token, body: preferences })).status, 200);
  assert.equal((await f.request('/api/preferences', { method: 'PATCH', token, body: { ...preferences, reduceMotion: 'true' } })).status, 400);
  const restarted = await f.start();
  assert.deepEqual((await (await restarted.request('/api/profile', { token })).json()).profile.preferences, preferences);
  assert.equal((await f.request('/api/profile', { method: 'PATCH', token, body: { name: '' } })).status, 400);
});

test('only spot owners can edit details and edits preserve ratings and XP', async t => {
  const f = await fixture(t);
  const a = await f.register(); const b = await f.register({ ...credentials, email: 'other@example.test' });
  const { spot } = await (await f.request('/api/spots', { method: 'POST', token: a.token, body: place })).json();
  const body = { ...place, name: 'Nome corretto', latitude: 45.7, ratings: { beauty: 1, privacy: 1, accessibility: 1 } };
  assert.equal((await f.request(`/api/spots/${spot.id}`, { method: 'PATCH', token: b.token, body })).status, 403);
  const result = await (await f.request(`/api/spots/${spot.id}`, { method: 'PATCH', token: a.token, body })).json();
  assert.equal(result.spot.name, 'Nome corretto'); assert.equal(result.spot.latitude, 45.7);
  assert.deepEqual(result.spot.ratings, spot.ratings); assert.equal(result.profile.xp, 50);
  const account = await (await f.request('/api/account', { token: a.token })).json();
  assert.equal(account.contributions.spots.length, 1);
  assert.equal(account.contributions.spots[0].name, 'Nome corretto');
});

test('review edits and removal keep aggregates and XP consistent and enforce authorship', async t => {
  const f = await fixture(t); const a = await f.register(); const b = await f.register({ ...credentials, email: 'other@example.test' });
  const original = (await (await f.request('/api/spots/monte-croce')).json()).spot;
  const { review } = await (await f.request('/api/spots/monte-croce/reviews', { method: 'POST', token: a.token, body: { text: 'Prima versione', ratings } })).json();
  const path = `/api/spots/monte-croce/reviews/${review.id}`;
  const body = { text: 'Versione corretta', ratings: { beauty: 1, privacy: 1, accessibility: 1 } };
  assert.equal((await f.request(path, { method: 'PATCH', token: b.token, body })).status, 403);
  assert.equal((await f.request(path, { method: 'DELETE', token: b.token })).status, 403);
  const edited = await (await f.request(path, { method: 'PATCH', token: a.token, body })).json();
  assert.equal(edited.review.text, body.text); assert.equal(edited.profile.xp, 10); assert.equal(edited.spot.ratings.beauty, 2.7);
  const removed = await (await f.request(path, { method: 'DELETE', token: a.token })).json();
  assert.deepEqual(removed.spot.ratings, original.ratings); assert.equal(removed.spot.reviewCount, 2); assert.equal(removed.profile.xp, 0);
  assert.equal((await f.request(path, { method: 'DELETE', token: a.token })).status, 404);
  const repost = await (await f.request('/api/spots/monte-croce/reviews', { method: 'POST', token: a.token, body: { text: 'Nuova recensione', ratings } })).json();
  assert.equal(repost.profile.xp, 10);
});

test('password changes require the old password and revoke every previous session', async t => {
  const f = await fixture(t); const a = await f.register();
  const second = await (await f.request('/api/auth/login', { method: 'POST', body: credentials })).json();
  assert.equal((await f.request('/api/auth/password', { method: 'POST', token: a.token, body: { currentPassword: 'wrong', newPassword: 'a new correct password' } })).status, 401);
  const response = await f.request('/api/auth/password', { method: 'POST', token: a.token, body: { currentPassword: credentials.password, newPassword: 'a new correct password' } });
  assert.equal(response.status, 200);
  const fresh = await response.json();
  for (const token of [a.token, second.token]) assert.equal((await f.request('/api/auth/me', { token })).status, 401);
  assert.equal((await f.request('/api/auth/me', { token: fresh.token })).status, 200);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: credentials })).status, 401);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { ...credentials, password: 'a new correct password' } })).status, 200);
});
