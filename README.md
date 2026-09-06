# BakerStreet

Explore the commits, issues, and hidden clues. Every piece of evidence leads you closer to the truth.

## Stack

- **Client** — React 18, Vite, Tailwind CSS
- **Server** — Node, Express, Zod
- **Backend** — Firebase (Firestore, Auth)

## Quick start

Two backends are supported. Pick one and stop — they cannot be mixed (see [Backends](#backends)).

### Local emulators (default, no Firebase account needed)

```bash
npm install
npm run emulators
npm run db:seed:local
npm run dev
```

Open http://localhost:5173

### Real Firebase project (single command, whole site served on :4000)

Requires `client/.env` filled with the real web app config and a seeded project:

```bash
npm install
npm run prod
```

Open http://localhost:4000

For React hot-reload against the real backend instead, use `npm run dev:real`
(API on :4000, Vite on http://localhost:5173).

## Backends

- **Emulator-first** (`npm run dev`): the server, seed, and client all talk to
  the local Firebase emulators. Set `VITE_FIREBASE_API_KEY` empty in
  `client/.env` (or omit it) so the client auto-connects to the Auth emulator.
- **Real project** (`npm run prod` / `npm run dev:real`): server loads
  `.env.production` (real Firestore + Auth + service account), and the client
  uses the real web app config in `client/.env`. Never mix the two — a token
  from one project fails verification on the other with
  "Invalid or expired firebase token."

## Tests

```bash
npm test
```

## License

GPL-3.0
