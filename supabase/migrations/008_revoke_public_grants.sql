-- 008_revoke_public_grants.sql: Revoke table privileges on quests and submissions
-- All app traffic runs server-side via DATABASE_URL; PostgREST/anon access is completely revoked.

REVOKE ALL ON TABLE public.quests FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.submissions FROM anon, authenticated, PUBLIC;
