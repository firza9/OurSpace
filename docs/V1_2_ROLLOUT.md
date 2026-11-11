# OurSpace 1.2 rollout and verification

## Phase 1 — no new database tables

Ship the frontend with both new flags false (the default). The dashboard uses existing household data: today’s calendar events, tonight’s dinner, pending todos, grocery status and monthly spending. Linked receipts are counted once. All original feature screens remain accessible through the sidebar / mobile feature menu and Home shortcuts. There is no Latest Updates section.

The mobile bar is Home, Chat, Quick Add, Updates and Profile. The viewport and padding respect iPhone safe areas; desktop keeps the sidebar. Quick Add opens a chooser and takes you to the relevant form. The centre groups incoming chat, due reminders/tasks, today's due calendar events, and this month's unpaid commitments; All / Unread / Reminders, individual/bulk read state, one-hour snooze, and item links are available. Browser Back/Forward and existing push `?tab=` links work.

Profile offers Light/Dark only. Preferences, notification read state and snooze are stored under an authenticated user + household browser-storage key. They are not shared with another account. App state is remounted when the authenticated account changes. There are no new table queries while the respective flags are false. Inventory shows an unavailable/setup state instead of inventing or saving household data locally. Existing `ourspace-v1` browser data is retained; it is not migrated or erased.

Improvements include grocery quantities and purchase filters; recipe ingredient deduplication and meal planning; chat search and actual shared To-do creation; pending/done and due ordering for tasks; monthly expenses with unlinked receipt totals; savings progress and remaining amounts; commitment paid counts and remaining scheduled amounts; local-calendar date handling; and four-digit card-label validation. Existing Receipts, Shared CC, Wishlist, Love Jar, reminders, calendar CRUD and household realtime integrations are retained.

## Inspect the live database before Phase 2

No Supabase migrations or SQL have been executed by this change. The repository had no schema definitions or migration history. Its frontend references the following **expected** existing tables, not proof they exist:

- `household_members(user_id, household_id)` and `create_my_household(household_name)` RPC.
- `chat_messages`, `grocery_items`, `recipes`, `receipts`, `expenses`, `reminders`, `calendar_events`.
- `meal_plans`, `wishlist_items`, `love_notes`, `savings_goals`, `savings_contributions`, `commitments`, `commitment_payments`, `credit_cards`, `credit_transactions`, `todos`.
- Push dispatcher: `push_subscriptions` and `push_deliveries` with delivery deduplication on `(subscription_id,event_key)`; private `receipt-images` Storage bucket.

Review `docs/V1_2_DATABASE_REVIEW.sql` manually in your project's SQL editor. It only reads schema/policies/constraints/publication metadata. Check household membership types, existing household RLS, the new names being unused, and authenticated access to one's membership. Do not blindly recreate missing legacy tables. None of the new SQL changes existing table data, existing RLS, membership functions, Storage, subscriptions, or cron jobs.

The new SQL expects UUID `household_id` and `user_id` membership columns, and Supabase Auth users. It aborts if those assumptions fail or the proposed tables already exist. Because no household parent table is defined in the repository, no household FK is guessed. Each inventory operation checks household membership; notification states additionally require the current user's ID. User preferences are accessible only to their owner. Authenticated users do not receive access to another household or another user's read state. Membership policies must permit the member lookup; a recursive or incompatible existing policy must be fixed based on the actual schema first.

## Phase 2a — cross-device preferences and notification states

**Run `supabase/manual-migrations/001_notification_preferences.sql` manually only when ready to enable cloud preferences.** It creates `user_preferences` and `notification_states`, their RLS, grants and realtime publication entries. It does not backfill or mutate existing data. It is transactional and deliberately stops if a target table already exists; do not rerun blindly.

Before enabling the flag, verify with two household users plus an unrelated user:

1. Each can read/update only their own preferences and notification states.
2. A user cannot write states with someone else's user ID or a household they do not belong to.
3. Household members cannot see their partner's read/snooze state.
4. Realtime updates arrive only for authorized users.

Then set `VITE_NOTIFICATION_SYNC_ENABLED=true` in the frontend build environment and rebuild. Local read history is not uploaded automatically; server state becomes authoritative. Queries fail visibly rather than silently claiming successful sync.

For **push** quiet hours/read/snooze suppression: after migration 001, deploy the updated `supabase/functions/push-dispatch` and set its server-side `OURSPACE_V12_NOTIFICATIONS_ENABLED=true`. Retain existing cron, JWT verification configuration, CRON_SECRET, VAPID secrets and service-role credentials. No server secret belongs in a `VITE_` variable. The server flag defaults off to preserve the existing dispatcher without the new tables. With it enabled, preference lookup failures fail closed for that recipient and increment `failed`.

Quiet hours use the saved IANA timezone and cover midnight/DST; equal start/end means all day. A read or snoozed item suppresses its corresponding push. **Snooze reappears in the in-app centre after an hour; it does not schedule a replacement push. Quiet-hour pushes are suppressed, not queued for later.** The existing ten-minute dispatcher window/delivery deduplication is preserved. The centre contains current loaded records, not a durable activity/audit log; completed/deleted reminders and tasks leave it. Existing chat sender exclusion is preserved.

## Phase 2b — kitchen inventory

**Run `supabase/manual-migrations/002_pantry_inventory.sql` manually before enabling inventory.** It is independent of 001 and creates only `pantry_items`, its index, household RLS, grants and realtime entry. Then verify household members can create/edit/delete their home's inventory, while unrelated users and anonymous clients cannot read/write it or move items to a household they don't belong to.

Set `VITE_PANTRY_ENABLED=true` and rebuild only after these checks. Pantry/Fridge/Freezer supports quantity, unit, expiry date, low-stock threshold, search and CRUD. Inventory can add items to Grocery, and available inventory participates in recipe ingredient deduplication. Matching is deliberately exact after case/whitespace normalization; free-text quantities are never guessed or subtracted. Check stock quantities yourself. No automatic inventory consumption or purchase transfer occurs.

## Verification

- `npm ci` then `npm test` runs utility checks (monthly spending, overnight/daytime/DST quiet hours, expiry/stock, safe ingredient matching and local dates).
- `npm run build` verifies the production Vite bundle.
- `npm run test:browser` runs the mocked integration smoke test. Start a separate local server first with the following **fake test configuration**, never production credentials:

```sh
VITE_SUPABASE_URL=https://ourspace-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test-publishable-key VITE_PANTRY_ENABLED=true npm run dev -- --port 5173
# In a second terminal, after installing Chromium using `npx playwright install chromium`:
npm run test:browser
# Or use an existing Chromium installation:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

The browser test intercepts fake Supabase HTTP requests and does not contact a production database. It checks mobile/desktop dashboard, no Latest Updates, monthly receipt deduplication, read/filter/snooze, appearance persistence, Quick Add, pantry creation/editing, chat-to-task conversion, recipe/grocery matching and runtime page errors. Screenshots go to ignored `test-results/`.

Additional verified variants (start a server with the matching flags, use its port):

- Cloud notification path: both Vite flags true; `TEST_NOTIFICATION_SYNC=true TEST_BASE_URL=http://localhost:5174 CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` verifies cloud read-state and appearance writes as well as the full smoke flow.
- Default gates: both Vite flags false; `TEST_PANTRY_DISABLED=true TEST_BASE_URL=http://localhost:5175 CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` verifies the inventory setup screen and zero pantry requests.

On 2026-11-11: production build, all six utility cases, full browser flows with browser-local and cloud state, and default inventory gating passed. No runtime page errors were reported in those mocked browser flows.

Still requires staging/live verification: actual Supabase Auth/session changes; RLS and realtime authorization; SQL compatibility; private Storage and receipts; web-push subscription persistence and iPhone delivery; deployed Edge Function behavior; physical-device safe areas. Mocked checks cannot establish those. Existing loads fetch full household lists; pagination for very large datasets is not introduced in this release. The app continues selecting the first household membership, matching existing behavior.

## Safe release / rollback

Review this feature branch before merging. Keep `main` unchanged until staging and manual RLS checks pass. Phase 1 can run without either SQL file. Each new feature can be disabled by returning its Vite flag to false and rebuilding; disable the dispatcher server flag separately to restore original push behavior. Keep additive tables/data rather than dropping them. No migrations run automatically during `npm run build`.
