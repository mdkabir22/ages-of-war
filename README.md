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

For a full Firebase onboarding flow (project creation, web app registration, Auth/Firestore setup, and verification), see `docs/FIREBASE_SETUP.md`.

## Issue Tracking

Use GitHub Issues for all work tracking:

- Bugs: reproducible defects with expected vs actual behavior
- Features: gameplay, UX, or tooling enhancements
- Refactors/tech debt: internal improvements with clear scope
- Labels: `bug`, `feature`, `refactor`, `docs`, `good first issue`, `priority:*`

Recommended issue template fields:

- Context and objective
- Reproduction steps (for bugs)
- Acceptance criteria
- Out-of-scope notes

## Architecture

- `src/core` is the canonical source for shared state, map, mission, and pathfinding logic.
- `src/game/engine` is the gameplay loop runtime API surface used by the game systems.
- Legacy `src/engine` shim layer has been removed; import from `src/core/*` directly.

## Git commits (author name/email)

If commits show placeholder author (`Your Name`, `you@example.com`), set your identity once for this repo:

```bash
git config user.name "Your Real Name"
git config user.email "your-email@example.com"
```

Verify setup:

```bash
git config user.name
git config user.email
```

To set it globally for all local repositories:

```bash
git config --global user.name "Your Real Name"
git config --global user.email "your-email@example.com"
```

This does not rewrite old commits; only new commits use the updated identity.

For contributor workflow details (branch naming, commit style, PR checklist), see `CONTRIBUTING.md`.
