# ChillSpots API

This is an Express backend for the ChillSpots app, with real local accounts and
persistent sessions. All initial places, comments, and ratings are demo data. Monte Croce's name, comment
copy, and displayed aggregate ratings follow the Figma reference. Coordinates,
description, dates, and the two additional places are illustrative, not verified
place listings. New account data and submissions persist locally.

Run `node server/index.mjs` from the project. The default URL is
`http://127.0.0.1:3001`. After building Expo's web export, the same server serves
`dist/` and `/api` on one origin. Set `HOST` and `PORT` to change the listener.
Native clients can point `EXPO_PUBLIC_API_URL` at a reachable API origin; the
client decides the exact URL configuration. Set `CORS_ORIGINS` to a comma-separated
list for additional browser development origins. There is no wildcard CORS.
Browser requests use an HttpOnly, SameSite=Lax session cookie; native requests use
`Authorization: Bearer <token>`. Registration and login return the token for native
clients. Web clients should use cookies and never persist that token in browser
storage. Set `NODE_ENV=production` for Secure cookies and serve through HTTPS.

Passwords use randomly salted scrypt hashes. Session tokens contain 256 bits of
randomness; only their SHA-256 hashes are persisted. Sessions expire after seven
days, survive restart, and are revoked by logout. Authentication attempts are
limited to 12 per source IP per 15 minutes in the running process. Do not enable
Express `trust proxy` without configuring the exact trusted reverse proxy.
This implementation has no email verification or password-reset workflow.

State is saved to `server/data/chillspots.json`, or `CHILLSPOTS_DATA_FILE`. Writes
are serialized in one process, use a temporary file, and atomically replace the
previous file before returning success. Restarting preserves records. Use one
server process per file; this is a local prototype store, not a concurrent database.
An invalid existing file causes startup to fail rather than replacing user data.

API routes:

- `GET /api/account` returns `{profile, savedSpotIds, contributions}`; contributions contain the user’s spots and reviews.
- `PATCH /api/profile` accepts `name` and optional `avatar` (a validated photo or `null`). Review author names/avatars update with the profile. Email and XP cannot be changed here.
- `PATCH /api/preferences` accepts `distanceUnit` (`km`/`mi`), `defaultView` (`map`/`list`), and `reduceMotion` (boolean), returning `{profile}`.
- `PUT /api/saved/:id` and `DELETE /api/saved/:id` update saved places idempotently and return `{savedSpotIds}`.
- `PATCH /api/spots/:id` updates the owner’s name, locality, description, coordinates, and photos. It preserves ratings and XP.
- `PATCH /api/spots/:id/reviews/:reviewId` updates the author’s text and ratings without extra XP.
- `DELETE /api/spots/:id/reviews/:reviewId` removes the author’s review and reverses its rating contribution and 10 XP.
- `POST /api/auth/password` accepts `currentPassword` and `newPassword`, verifies the current password, revokes all old sessions, and returns a rotated `{profile, token}` and cookie.

- `GET /api/health` returns `{status, mode}`.
- `POST /api/auth/register` accepts `name`, `email`, `password` and returns
  `{profile, token}` with status 201 and a session cookie. Names allow 2–80
  characters, emails are normalized to lowercase and unique, and passwords
  must contain 10–128 characters.
- `POST /api/auth/login` accepts `email`, `password`, returns `{profile, token}`
  with a fresh session cookie, and uses a generic invalid-credentials error.
- `POST /api/auth/logout` revokes the current session, clears its cookie, and
  returns 204.
- `GET /api/auth/me` and `GET /api/profile` return `{profile}` for the current
  account, or 401. Profiles expose id, name, email, avatar, XP, level, and preferences.
- `GET /api/spots?q=...` returns `{spots}`, searching name, locality, and description.
- `GET /api/spots/:id` returns `{spot}`.
- `GET /api/spots/:id/reviews` returns `{reviews}`, newest first.
- `POST /api/spots` accepts `name`, `locality`, `description`, `latitude`, `longitude`,
  `photos`, and `ratings`; requires authentication and returns `{spot, profile}`
  with status 201.
- `POST /api/spots/:id/reviews` accepts `text` and `ratings`; returns `{review, spot}`
  plus updated `profile` with status 201, including updated aggregate ratings.
  Authentication is required; author identity always comes from the session.
  Each user can review a spot once. A duplicate returns 409 and grants no XP.

Creating a spot awards 50 XP; submitting a review awards 10 XP. Editing does not grant XP. Deleting a review reverses its 10 XP, so deleting and reposting cannot accumulate rewards. Level is
`1 + floor(xp / 100)`. These values are named constants in `auth.mjs` and can be
overridden in the app factory. XP changes and content writes are committed
atomically, so concurrent duplicate review requests cannot grant extra XP.

Ratings have `beauty`, `privacy`, and `accessibility`, each a number from 1 to 5.
New overall ratings are the mean of those categories. Seed values preserve the
reference's independently displayed overall score; later reviews are averaged into
that seed baseline. A newly created place includes its creator's initial rating,
with zero written reviews. Review counts count written reviews only.

Places accept 1–3 photos: bundled keys `mountain`, `signpost`, `hiker`, `profile`,
`scobe`, or `mark`, or JPEG/PNG/WebP base64 data URIs up to 1 MB each. URI encoding,
size, and file signatures are validated. Arbitrary remote URLs are not fetched.
Names allow 2–80 characters, localities 2–120, descriptions up to 2000, and
reviews 1–2000. Coordinates must be finite and within geographic bounds.

Failures return `{error: {code, message, field?}}`. Invalid input is 400, missing
authentication 401, disallowed origins 403, missing resources 404, conflicts 409,
JSON over 5 MB 413, and throttled authentication 429. Unexpected persistence
errors are 500 without exposing server details. Unknown `/api` routes never serve
the frontend. Shared TypeScript contracts are in `shared/types.ts`.

Run the integration suite with `node --test server/app.test.mjs`. It uses isolated
temporary stores and ephemeral loopback ports.
