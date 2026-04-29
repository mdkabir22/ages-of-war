# Ages of War

RTS-style browser game built with React, TypeScript, and Vite.

## Features

- Real-time strategy gameplay loop
- Age progression and upgrades
- Fog of war and minimap
- AI enemies and campaign progression
- Optional experimental Three.js renderer (`VITE_GAME_3D=true`)
- Capacitor support for Android builds

## Quick Start

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - start local development server
- `npm run build` - type check and create production build
- `npm run test` - run tests once
- `npm run test:watch` - run tests in watch mode
- `npm run lint` - run ESLint
- `npm run cap:sync` - build web app and sync Android project
- `npm run cap:open` - open Android project in Android Studio

## Environment Variables

Create `.env.local` (or `.env.development`) and set the following as needed:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_GAME_3D` (`true` or `false`)

See `.env.example` for the full template.

## Current Architecture Note

Core engine modules are now centralized under `src/core`:

- `src/core` is the canonical source for shared state, map, mission, and pathfinding
- `src/game/engine` remains the gameplay loop module used by game runtime APIs
- `src/engine` is kept as a compatibility shim layer that re-exports from `src/core`

Refactor plan: continue phased cleanup until legacy shim imports can be removed safely.
