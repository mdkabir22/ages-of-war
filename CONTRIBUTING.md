# Contributing

Thanks for contributing to Ages of War.

## 1) Local setup

```bash
npm install
npm run dev
```

## 2) Git identity (required)

Set your commit identity before creating commits:

```bash
git config user.name "Your Real Name"
git config user.email "your-email@example.com"
```

Verify:

```bash
git config user.name
git config user.email
```

## 3) Branch naming

Use one branch per task:

- `feature/<short-topic>`
- `fix/<short-topic>`
- `refactor/<short-topic>`
- `docs/<short-topic>`
- `test/<short-topic>`

Examples:

- `feature/campaign-briefing-ui`
- `fix/objective-reward-duplication`

## 4) Commit style

Use concise, purpose-first messages:

- `feat: add battle pass progress widget`
- `fix: prevent duplicate objective reward claims`
- `refactor: centralize lane ratios across systems`

## 5) Quality checks before PR

Run these locally:

```bash
npm run lint
npm run test
npm run build
```

If a command fails in your environment, include that detail in the PR notes.

## 6) Pull request checklist

- Clear title and summary
- Linked issue(s)
- Test plan with actual results
- Screenshots/video for UI changes
- Mention any migration/manual steps

## 7) Issue tracking

Use GitHub Issues for bugs/features/refactors. Prefer the provided issue templates and include:

- scope
- acceptance criteria
- repro steps (for bugs)
