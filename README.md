# OurSpace 1.2

A React + Vite household app with Supabase Auth, household-scoped data, private receipts and web push.

```sh
npm ci
cp .env.example .env.local
# Set the existing project's public browser configuration in .env.local.
npm run dev
npm test
npm run build
```

Netlify build command: `npm run build`; output: `dist`. Never put service-role keys, CRON_SECRET or VAPID private keys in frontend variables or git.

See [v1.2 rollout](docs/V1_2_ROLLOUT.md) for the inspected database assumptions, feature phases, exact manual migration prerequisites, flags, browser tests, and limitations. **The new SQL files are manual only.** Keep both new feature flags false until their corresponding SQL and RLS checks are complete. Phase 1 needs no new tables.
