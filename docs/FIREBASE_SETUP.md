# Firebase Setup Guide

This guide explains how to configure Firebase for local development beyond just filling `.env.example`.

## Prerequisites

- A Google account with Firebase access
- Node.js + npm installed
- Project cloned and dependencies installed

## 1) Create Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a project**.
3. Set a project name (for example `ages-of-war-dev`).
4. You can disable Google Analytics initially and enable later.

## 2) Register a Web App

1. In Project settings, add a **Web App**.
2. App nickname: `ages-of-war-web` (or your own naming standard).
3. Copy the generated config values.

## 3) Enable required products

Enable the services this app depends on:

- **Authentication** (Email/Password and any planned providers)
- **Firestore Database** (start in test mode for local setup, then lock down rules)
- **Cloud Messaging** (if push notifications are used in your environment)

## 4) Configure local env file

Create `.env.development` (or `.env.local`) in repo root:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_GAME_3D=false
VITE_SENTRY_DSN=
VITE_APP_VERSION=1.0.0
VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT=
```

Notes:

- Do not commit secrets or environment-specific values.
- Keep `.env.example` as the non-secret template.
- Restart dev server after env changes.

## 5) Verify integration

1. Start app:

```bash
npm run dev
```

2. Check browser console for Firebase initialization errors.
3. Trigger a flow that uses Firebase (auth, analytics, or data read/write).
4. Confirm events/data appear in Firebase Console.

## 6) Common troubleshooting

- **Missing env value**: ensure variable name matches exactly and starts with `VITE_`.
- **Permission denied**: Firestore/Auth rules likely too strict for your test flow.
- **Wrong project**: verify `VITE_FIREBASE_PROJECT_ID`.
- **No changes after editing env**: restart `npm run dev`.

## 7) Production readiness checklist

- Restrictive Firestore rules (no broad test access)
- Auth providers configured intentionally
- Approved domains configured in Auth settings
- Monitoring enabled (Sentry/analytics as needed)
