# POKT Community Hub: Build Brief (rebuild)

Status: **Phase 1.** Decisions answered 2026-10-26 (section 9); backup destination still open.

This brief is the authority for the rebuild. The existing app (tag it `mvp-reference` before anything moves) is treated as an aspirational MVP: it settles *what* the hub does, not *how*. No code is carried over by default; individual pieces may be lifted only when they are read, tested and match these conventions.

Conventions are taken from the Agentic Portal (`agent-portal`) so that the same people can run both.

---

## 1. What the hub does (workflows, from the MVP)

### Ambassadors (signed in with Discord)
1. **Sign in** with Discord. A profile is created from the Discord id, display name and avatar.
2. **Quest board**: see live quests, filtered by category, status (not started / pending / approved / rejected) and date. A quest is live when it is active and `now` is inside its optional start/end window.
3. **Quest detail**: read the description and requirements, then **submit proof**. Proof is 1 to 8 links (the count and a hint are set per quest) and an optional screenshot (PNG/JPEG/WebP, 5 MB or less).
4. **Resubmit** after a rejection. There is one submission per user per quest.
5. **My history**: every submission with its status, reviewer note and XP.
6. **Leaderboard**: all-time and monthly, with your own rank.
7. **Profiles**: public profile pages with XP, rank roles and completed quests.

### Admins
8. **Review queue**: inspect proof, approve or reject with a note, and **undo** a review.
   - Approving awards the quest's XP.
   - Approving also grants the quest's reward role, if it has one, and any XP-threshold rank roles the user now qualifies for.
9. **Quests**: create, edit, close, reopen and delete quests. Each has a title, Markdown description, XP, icon, category, proof-link count and hint, start/end schedule, and an optional reward role.
10. **Categories**: create, rename, reorder and delete.
11. **Ranks / server roles**: define roles with a name, description, colour, icon, XP threshold and order, each mapped to a Discord role id. Admins can also assign or remove a role on one user by hand.
12. **Users**: list users, view one user's history, promote or demote admins, and delete a user.
13. **Discord**:
    - Auto-create missing Discord roles.
    - Sync one member's roles, or all members' roles.
    - Show the bot's connection status.
    - Announcements webhook: a URL, a bot name and avatar, and toggles for new quest, quest completed and role unlocked; plus a test button.

### Dropped from the MVP
- The hard-coded superadmin email. The first admin is bootstrapped once (section 4).
- Legacy Better Auth tables and the account-merge logic.
- Supabase (Auth, Storage, PostgREST lockdown migrations).
- Deleting proof images on approval. Proof is kept as the audit trail for awarded XP (retention is in section 9).

---

## 2. Stack

| Layer | Choice | Matches agent-portal |
|---|---|---|
| Runtime | Node 24, pnpm 9 via corepack, ESM, `engine-strict` | yes |
| Language | TypeScript, `tsconfig.base.json` strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`, `tsc -b` project references | yes |
| Web | Next.js 16 App Router, React 19, `output: 'standalone'`. The version is pinned to the latest patched 16.x on scaffold day, with no release-age exemptions. | yes |
| Styling | Plain CSS variables + CSS Modules, with brand tokens copied from the portal's `globals.css`: Rubik + JetBrains Mono, `--brand-blue #025af2`, gold, mint, coral, dark default + `[data-theme='light']`. No Tailwind and no component kit. | yes |
| Auth | Auth.js (NextAuth v5), Discord provider, fails closed on missing secrets | same library, Discord instead of Google |
| Data | PostgreSQL 17, raw SQL through `pg`, no ORM | yes |
| Migrations | node-pg-migrate, `NNNN_name.sql` with Up/Down markers, a separate `migrator` image; the app never migrates itself | yes |
| Validation | Zod at every boundary: form input, env/config, Discord API responses | yes |
| Logging | pino | yes |
| Tests | Vitest: `*.test.ts` unit, `*.integration.test.ts` against real Postgres, plus an `adversarial` suite | yes |
| Lint/format | ESLint 9 flat + typescript-eslint, Prettier (single quotes, width 100) | yes |
| Secrets | 1Password (`op run --env-file .env.op` locally; mode-600 env files on the host) | yes |

Valkey is **not** included. There is one app instance and the hub has no shared cache to justify it. Rate limits use Postgres (section 5).

---

## 3. Layout

```
apps/
  web/        Next.js: public pages, ambassador hub, /admin console
  worker/     Discord outbox processor (role sync, webhook announcements)
packages/
  core/       Pure domain rules: quest liveness, XP, rank eligibility, review state machine. No I/O.
  store/      SQL, the pg pool, migrations, typed repositories
  discord/    Discord REST client (bot + webhook), Zod-validated responses, rate-limit aware
  shared/     config loading (Zod), logger, errors
tools/        deploy.mjs, verify-boundaries.mjs, verify-migration-markers.mjs
docs/         runbooks, reviews
```

The package boundary rules are enforced by `verify:boundaries` as in the portal:
- `core` imports nothing internal.
- `store` and `discord` never import `web` or `worker`.
- `packages/*/src/index.ts` is the only import surface.

The `pnpm check` gate runs build, lint, format:check, verify:boundaries, verify:migrations and test.

---

## 4. Design decisions that fix MVP defects

1. **XP is a ledger, not a counter.**
   - An append-only `xp_events` table records rows like `(user, submission, delta, reason, actor, at)`. Approve writes `+xp`; undo writes `-xp`.
   - Totals and monthly totals are sums, computed in a view or a materialised summary refreshed in the same transaction.
   - This gives one source of truth and a full audit trail. The MVP had a trigger, a recalculation and `GREATEST()` merges that could disagree.
2. **Review is a state machine in `core`.**
   - The allowed moves are `pending → approved | rejected` and `approved | rejected → pending` (undo).
   - Each move is a single transaction that uses a conditional `UPDATE … WHERE status = $expected`, so a double click or two admins at once cannot award XP twice. This is covered by adversarial tests.
3. **Discord side effects go through an outbox.**
   - The review transaction inserts `discord_jobs` rows. The worker drains them with retry and backoff, then records the outcome.
   - A Discord outage or a 403 never loses a role grant, and an admin can see failed jobs. The MVP used fire-and-forget promises.
4. **Authorisation lives in one place.**
   - Every server action calls `requireUser()` or `requireAdmin()` from one module.
   - The adversarial suite calls every admin action as a non-admin and as a signed-out user.
5. **Bootstrapping the first admin.** `ADMIN_BOOTSTRAP_DISCORD_IDS` grants admin only to a user who has no row yet and only while there are zero admins. After that, roles live in the database. No emails are hard-coded.
6. **Proof files are private.**
   - They are stored on a Docker volume and served only through an authenticated route (to the owner and to admins).
   - The content type is checked by magic bytes, not by the client's claim. Files are re-encoded or stripped of metadata on upload, if that is cheap to do (to confirm during the build).
7. **Rate limits are durable.** A Postgres table (or a `submissions` timestamp check) replaces the MVP's in-memory map. One instance today, but nothing will break if there are two.
8. **Request handling is uniform.** Health endpoints are `/health/live` and `/health/ready` (the database is reachable). Errors are logged with a request id and a generic message is shown to users.

---

## 5. Data model (first migration)

- `users`: id, discord_id (unique), name, avatar_url, role (`ambassador` | `admin`), created_at, updated_at, last_login_at
- `quest_categories`: id, name (unique), position
- `server_roles`: id, name (unique), description, color, icon, xp_required (nullable; null means quest-reward only), position, discord_role_id
- `quests`: id, title, description_md, xp_reward, icon, status (`active` | `closed`), category_id, link_count (1–8), link_hint, starts_at, ends_at, reward_role_id, created_by, timestamps
- `submissions`: id, user_id, quest_id, proof_urls (text[]), proof_file (nullable), status, review_note, reviewed_by, reviewed_at, timestamps, unique (user_id, quest_id)
- `xp_events`: append-only ledger (see section 4.1)
- `user_roles`: user_id, role_id, source (`xp` | `quest` | `manual`), assigned_by, assigned_at
- `discord_jobs`: outbox with kind, payload, attempts, next_attempt_at, last_error, done_at
- `app_settings`: key/jsonb, for webhook config; the webhook URL is stored AES-256-GCM encrypted.
- Auth.js adapter tables (`accounts`, `sessions`, `verification_token`) for database sessions.

---

## 6. Deployment: Cherry AS

The host (checked 2026-10-26) is Ubuntu 24.04, 6 vCPU, 5.9 GB RAM with 4.4 GB available, and 81 GB of free disk. A shared `pocket-caddy` container owns ports 80 and 443 and loads `/opt/pocket/caddy/sites/*.caddy`. Other services live under `/opt/pocket/services/<name>`.

- **Stack:** `/opt/pocket/services/community/` contains `docker-compose.yaml` with `web`, `worker` and `postgres:17`, a `migrator` under profile `tools`, and named volumes `pgdata` and `proofs`. The web container joins Caddy's network; nothing publishes host ports.
- **Proxy:** `/opt/pocket/caddy/sites/community.caddy` with `community.pocket.network { reverse_proxy community-web:3000 }`. TLS is automatic through Caddy.
- **Deploy:** `pnpm deploy:host cherry-as` works the portal way: a `git archive` over ssh, a build on the host, then migrate, then `up -d`. Images are tagged by commit with `org.opencontainers.image.revision`, so a rollback is a retag.
- **Backups:** a nightly `pg_dump` plus the proofs volume (destination in section 9, item 8).
- **DNS:** an A record (and AAAA if used) for `community.pocket.network` pointing at `84.32.25.28`. Today the name does not resolve.
- **Discord app:** the OAuth redirect is `https://community.pocket.network/api/auth/callback/discord`, plus `http://localhost:3000/api/auth/callback/discord` for development.

---

## 7. CI and process

- **GitHub Actions** (`pokt-network/poktcommunityhub`):
  - `check` runs the `pnpm check` gate.
  - The integration job runs Postgres as a service and does migrate up → down to empty → up.
  - Image build and a compose smoke test with `up --wait` and the health checks.
  - Secret scan.
- **Branching:** `dev` then `main`, rebase merges only. Commits are kept small enough to revert one by one.
- **Gates:** each phase ends with a gate review by Jinx, recorded in `GATES.md`.

---

## 8. Phases

| Phase | Delivers | Gate |
|---|---|---|
| 0 | This brief, with decisions answered | sign-off |
| 1 | Workspace, tooling, `pnpm check`, CI, Dockerfile, compose, branded shell, health endpoints, **deployed to Cherry AS** at `community.pocket.network` behind Caddy | live URL serves a health check over TLS |
| 2 | `store` schema and migrations, `core` rules (liveness, XP ledger, review state machine, rank eligibility), with unit, integration and adversarial tests | tests green; up/down/up clean |
| 3 | Discord sign-in, profiles, admin bootstrap, `requireUser` / `requireAdmin` | adversarial authz suite green |
| 4 | Ambassador flows 1–7 | smoke checklist |
| 5 | Admin flows 8–12 | smoke checklist |
| 6 | `discord` package, worker and outbox, flow 13 | role sync against a test guild |
| 7 | Backups (off-host), proof retention job verified, launch | restore drill passes; production smoke |

---

## 9. Decisions (answered by Jinx, 2026-10-26)

1. **No MVP data to import.** Phase 7 has no import step; development uses demo seed data only.
2. **Same repo.** The MVP is tagged `mvp-reference` and the rebuild starts on a fresh `dev` branch.
3. **Cherry AS, with the mitigations:** no host ports, non-root containers, no Docker socket, own compose network (only `web` joins Caddy's), memory limits.
4. **Sign-in requires membership of the POKT Discord server.** OAuth scopes `identify guilds.members.read`; membership of `DISCORD_GUILD_ID` is checked at sign-in and a non-member is refused with a "join the server first" page.
5. **Database sessions** (Auth.js Postgres adapter tables), so a demotion or deletion applies on the next request.
6. **Proof screenshots are kept 60 days after review**, then a worker job deletes the file and nulls `proof_file`. Links are kept forever. Pending submissions are never purged.
7. **Webhook URL encrypted in the database:** AES-256-GCM with `SETTINGS_ENCRYPTION_KEY` from 1Password; admins see a masked value only.
8. **Backups: still open, only blocks phase 7.** No Pocket project has an off-host destination yet (the portal keeps 14 days of local `pg_dump` and lists off-host as open). Proposal: the portal's verified local cron script (pipefail, `gzip -t`, rotate only after a good dump) plus a nightly `rsync` of the dump and proofs to the other Cherry host (`cherry`), which costs nothing new. Object storage is the alternative.
9. **No staging.** Phase 1 deploys straight to `community.pocket.network`.
10. **Gates are reviewed by Jinx.**
11. **DNS:** Jinx creates the `community` A record at GoDaddy → `84.32.25.28` (no proxy, so Caddy's HTTP-01 challenge works).
12. **Brand:** the portal's tokens.
