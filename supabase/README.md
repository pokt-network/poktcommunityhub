# Supabase migrations

**Auth:** Discord login is **Supabase Auth** (Dashboard → Authentication → Providers → Discord).  
App profiles live in `public."user"` and are upserted on login (`src/lib/profile.ts`).

Lock down legacy/public tables (RLS + revoke Data API grants) and add submission indexes:

```bash
pnpm db:migrate-auth-rls
```

Domain tables (quests, submissions, XP trigger):

```bash
pnpm db:migrate-domain
```

**DATABASE_URL:** used for domain SQL via `node-pg`. Prefer session-mode pooler (`5432`) or direct. Keep pool `max` low on free tier. Auth sessions no longer go through this pool.

Or paste [`migrations/001_domain.sql`](migrations/001_domain.sql) into the Supabase SQL Editor and run it.

Storage bucket for proof screenshots:

```bash
pnpm db:migrate-storage
```

Or paste [`migrations/002_storage.sql`](migrations/002_storage.sql) into the Supabase SQL Editor, or create a public bucket named `proofs` in Dashboard → Storage (5MB limit, png/jpeg/webp).

Set `SUPABASE_SERVICE_ROLE_KEY` in `.env` so the Next.js server can upload proofs. Never expose the service role key to the browser.
