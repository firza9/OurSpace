# OurSpace v0.2 — Nude Beige & Black

## Run locally
Open the `ourspace-starter` folder (the one containing `package.json`) in VS Code.

```powershell
npm.cmd install
npm.cmd run dev
```

## Deploy to Netlify
Build command: `npm run build`; publish directory: `dist`. A `netlify.toml` is included.

## Features
Dashboard, recipes (paste and TikTok links), grocery list, receipt breakdown entry, expenses, savings, recurring loan payment checklists, shared credit card ledger, to-do, and **OurChat demo** with reply, pin, and convert message to grocery/to-do.

## Important
All data is currently stored in localStorage on **one browser/device**. OurChat is a UI demo: switching sender simulates the two participants; it does **not** send messages to your spouse's phone. For real two-device sync and secure access, Supabase Auth + database policies + Realtime must be configured. Avoid entering actual banking secrets or sensitive personal information into this demo.
