# POKT Ambassador Quest & Leaderboard Portal

Custom ambassador portal for the Pocket Network community: Discord login, quest board, proof submissions (URL + screenshots), admin review, automatic XP, and a live leaderboard.

## Stack

- **Next.js** (App Router) + Tailwind CSS
- **Supabase Auth** — Discord OAuth2 (cookie sessions via `@supabase/ssr`)
- **Supabase** — PostgreSQL + Storage (screenshots)
- **Vercel** — hosting

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- Discord Application (Client ID & Secret)
- Supabase project (Auth + Postgres + Storage)
- List of admin Discord user IDs

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for Storage uploads |
| `DATABASE_URL` | Postgres connection string (domain queries) |

Admin roles are assigned in **Admin → Users** (stored in `public."user".role`), not via env.

### Discord + Supabase Auth

1. Supabase Dashboard → **Authentication → Providers → Discord** → enable and paste Discord Client ID / Secret.
2. Discord Developer Portal → OAuth2 → Redirects, add:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → URL configuration**:
   - Site URL: your **production** domain (used as fallback)
   - Redirect URLs — include local **and** prod, or local Discord login will bounce to the live site:
     - `http://localhost:3000/auth/callback`
     - `http://127.0.0.1:3000/auth/callback`
     - `http://localhost:3000/**`
     - `https://YOUR_DOMAIN/auth/callback`
     - `https://YOUR_DOMAIN/**`

App login hits `/auth/callback` after Discord; sessions are Supabase cookies (not Better Auth).

### Database migrations

```bash
pnpm db:migrate-domain
pnpm db:migrate-storage
```

(`public."user"` profile rows are upserted on Discord login. Legacy Better Auth rows with the same Discord id are merged.)

### Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## App routes

| Path | Access | Purpose |
|------|--------|---------|
| `/` | Public | Landing |
| `/dashboard` | Auth | Profile + XP |
| `/quests` | Auth | Active quest board |
| `/quests/[id]` | Auth | Submit proof |
| `/leaderboard` | Auth | XP rankings |
| `/admin` | Admin | Review queue |
| `/admin/quests` | Admin | Create / edit / close quests |

XP is credited by a Postgres trigger when a submission status becomes `approved`.

## Deploy on Vercel

1. Push the repo and import the project on Vercel.
2. Set env vars (same as `.env.example`).
3. Confirm Discord + Supabase redirect URLs include production.
4. Confirm migrations and the `proofs` Storage bucket exist.

### Smoke test checklist

- [ ] Discord login works; admin IDs get `admin` role
- [ ] Create a quest in `/admin/quests`
- [ ] Submit URL and/or screenshot from `/quests/[id]`
- [ ] Approve in `/admin` → user `totalXp` increases
- [ ] Reject → ambassador can resubmit
- [ ] Leaderboard ranks by XP
- [ ] Closed quests disappear from `/quests`
