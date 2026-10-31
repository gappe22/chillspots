# ChillSpots

Expo / React Native app with a web build and an Express 5 API. The app follows the mobile map-first layout from the [ChillSpots Figma file](https://www.figma.com/design/UbDbtRgFlfp22GZA0VFjz0/ChillSpots) while retaining the supplied neo-brutalist visual style: heavy typography, square borders, geometric details, and offset shadows. The shared palette uses warm white `#F6F7ED` backgrounds, navy `#001F3F` text and borders, and lime `#DBE64C`, green `#00804C`, mantis `#74C365`, and blue `#1E488F` accents.

## Run the complete web app

```sh
npm ci
npm run build
npm run server
```

Open http://127.0.0.1:3001. Express serves both the web app and API. Create an account in the app to add spots and reviews. The initial places and comments are illustrative demo records. New accounts and contributions persist in the ignored `server/data/` directory.

The previous Sites link is a static-only preview and does not host this Express backend. Use a Node hosting service with HTTPS and a persistent volume to deploy this version. Set `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT`, `CHILLSPOTS_DATA_FILE`, and `CORS_ORIGINS` to your HTTPS origin. Run one server process per data file. Multi-instance hosting needs a database instead of the local JSON store. See [API and authentication notes](server/README.md).

## Features

- Full-screen map with floating search/profile controls and an add-spot button. A persistent bottom navbar opens Search, Saved, Profile, and Settings. Menus cover the lower three quarters of the viewport (including the navbar), keeping the upper quarter of the map interactive. The nearby list, place details, account forms, and photo gallery use the same panel layout. Cards track finger/mouse dragging from the grab handle or header, spring open to three quarters, and collapse to a small handle above the navbar. Collapsing preserves drafts; navbar and close actions animate transitions. Reduced-motion preferences skip the settling animations.
- Search opens a focused overlay with compact result rows, category filters, map-area filtering, and rating/distance/date sorting. Saved places and settings are accessible from the navbar.
- Explicit foreground location permission, map-area filtering, directions, shared spot links, and photo galleries. Location is kept in client memory only.
- Real sign-in, editable profiles and avatars, contribution history, XP and levels.
- New spots with up to three automatically resized/compressed photos; owners can update location, photos, and descriptions.
- Reviews with category ratings, author-only editing and deletion, and recalculated place scores.
- Settings for distance units, preferred view, reduced motion, profile/password editing, and logout. Preferences persist locally for guests and on the account when signed in.

## Develop / native apps

Run `npm run server` and `npm start` in separate terminals. Expo's default web development origin uses the API on port 3001. For a physical device, set `EXPO_PUBLIC_API_URL` to the computer's LAN origin and start the server with `HOST=0.0.0.0`; both devices must be on the same network. Web production defaults to same-origin `/api`. `.env.example` lists the relevant settings.

Native maps use react-native-maps; web uses the locally bundled Leaflet library and OpenStreetMap tiles. Map tiles require internet. Native session tokens use Expo SecureStore; web sessions use HttpOnly cookies. Accounts use email/password, with no email verification or password reset yet.

New spots earn 50 XP, reviews earn 10 XP, and every 100 XP adds a level. Edits do not award XP. Deleting a review reverses its 10 XP; posting again restores only that contribution’s reward. One review per user per spot prevents repeated review rewards. Adjust the named constants in `server/auth.mjs` to change rewards.

## Checks

```sh
npm run typecheck
npm run test:api
npm run test:discovery
npm run build
```

`test:discovery` uses Node’s experimental TypeScript stripping (Node 22.6+).

Figma assets are downloaded under `assets/figma/`. Temporary Figma URLs are never used at runtime. Existing map experiments are preserved under `components/legacy-map/` and are no longer Expo routes.
