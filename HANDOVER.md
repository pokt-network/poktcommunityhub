# POKT Community Hub — Handover

Ambassador portal: Discord login, quests, proof uploads, admin review, XP/leaderboard, Discord role sync.

**Stack:** Next.js 16 · Supabase Auth (Discord OAuth) · Postgres (`DATABASE_URL`) · Supabase Storage · Vercel  
**Branch:** `preview/discord-sync` → merge to `master` for prod  
**Preview:** https://poktcommunityhub-git-preview-discord-sync-abdulxbasits-projects.vercel.app

---

## Configure (do this first)

Three places. Miss any one and login or role sync breaks.

### 1. Discord Developer Portal

Create/open the app: https://discord.com/developers/applications

#### A. OAuth login (Supabase Auth)

1. **OAuth2 → General** → copy **Client ID** and **Client Secret**.
2. **OAuth2 → Redirects** → add exactly:
   ```
   https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
   ```
   Example: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret into Supabase (section 2).

#### B. Bot (role sync)

1. **Bot** → Reset Token → copy → `DISCORD_BOT_TOKEN`.
2. Enable **Server Members Intent** → Save.
3. **OAuth2 → URL Generator**:
   - Scope: `bot`
   - Permission: **Manage Roles**
4. Open the generated URL → invite bot to the guild.
5. Copy guild ID (Server Settings → Widget, or right-click server with Dev Mode on) → `DISCORD_GUILD_ID`.
6. **Server Settings → Roles**: drag the **bot’s role above** every role it assigns (`Node Scout`, etc.). Bot cannot manage roles at or above itself.

---

### 2. Supabase

Project: Authentication + Postgres + Storage.

#### Auth — Discord provider

1. **Authentication → Providers → Discord** → Enable.
2. Paste Discord **Client ID** + **Client Secret** from portal §1A.
3. Save.

#### Auth — URL config

**Authentication → URL Configuration:**

| Field | Value |
|---|---|
| Site URL | Production domain (e.g. `https://poktcommunityhub.vercel.app` or custom) |

**Redirect URLs** — add all that apply:

```
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
http://localhost:3000/**
https://YOUR_PROD_DOMAIN/auth/callback
https://YOUR_PROD_DOMAIN/**
https://*.vercel.app/auth/callback
https://*.vercel.app/**
```

Local login without localhost entries redirects to Site URL (prod). Custom domain: add that host’s `/auth/callback` and `/**` too.

#### Keys & DB

**Project Settings → API:**

| Env var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (server only — never browser) |

**Project Settings → Database** → connection string → `DATABASE_URL`  
Prefer session pooler (`:5432`) or direct. Keep `DATABASE_POOL_MAX` low on free tier.

#### Storage

`proofs` bucket must exist (run `pnpm db:migrate-storage` or create via SQL in `supabase/`). Service role uploads proofs.

#### Discord role column

```bash
pnpm db:migrate-discord-roles
```

Or SQL Editor → run `supabase/migrations/010_discord_roles.sql`.

---

### 3. Vercel

1. Import repo / connect Git.
2. **Settings → Environment Variables** — set for Production + Preview (+ Dev if used):

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API |
| `DATABASE_URL` | Supabase Database |
| `DISCORD_BOT_TOKEN` | Discord Bot token |
| `DISCORD_GUILD_ID` | Discord server snowflake |

3. Redeploy after any env change.
4. Production domain: add that URL to Supabase Redirect URLs (§2).

`.env.example` is the local template. Admins are set in **Admin → Users** (DB), not env.

---

## Ship to production

```bash
git checkout master
git pull origin master
git merge preview/discord-sync
git push origin master
```

Or merge the PR on GitHub. Vercel deploys `master`.

Confirm migrations ran against prod DB before relying on Discord role IDs.

---

## What the Discord bot does

No VPS. REST API from Next.js server actions.

| Trigger | Behavior |
|---|---|
| Approve / reverse review | Sync XP-earned roles on Discord |
| Admin role toggle | Push add/remove immediately |
| **+ Auto-Create Roles** | Create missing Discord roles, store snowflakes |
| **Sync Member Roles** | Bulk or per-user force sync |

Matching: `server_roles.discord_role_id` first, else case-insensitive name match.

---

## Key files

| Path | Role |
|---|---|
| `src/lib/discord.ts` | Discord REST client |
| `src/lib/discord-sync.ts` | Sync + provision |
| `src/app/actions/roles.ts` | Admin role actions |
| `src/app/actions/reviews.ts` | Approve/reject + sync |
| `src/app/auth/callback/route.ts` | OAuth callback |
| `src/components/discord-login-button.tsx` | Login → `/auth/callback` |
| `supabase/migrations/010_discord_roles.sql` | `discord_role_id` column |
| `.env.example` | Env checklist |

---

## Breakages

| Symptom | Fix |
|---|---|
| Login bounces to prod from localhost | Add localhost redirect URLs in Supabase |
| `redirect_uri` mismatch | Discord OAuth redirect must be `https://<ref>.supabase.co/auth/v1/callback` only |
| “Discord Bot is not configured” | Set `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID` on Vercel → Redeploy |
| Sync 403 | Bot role below target roles — move bot role up |
| “not a member of the Discord server” | User OAuth’d but never joined the guild |
| Proof upload fails | `proofs` bucket missing or bad `SUPABASE_SERVICE_ROLE_KEY` |

---

## Smoke test

- [ ] Discord login (local + prod)
- [ ] Admin can open `/admin`
- [ ] Create quest → submit URL/screenshot → approve → XP up
- [ ] Reject → resubmit works
- [ ] Leaderboard updates
- [ ] `/admin/roles` → Auto-Create Roles → Sync Member Roles → roles appear in Discord
