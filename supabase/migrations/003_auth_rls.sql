-- Lock down Better Auth tables in public schema (Data API / anon access).
-- App traffic uses DATABASE_URL (bypasses RLS). No policies for anon/authenticated.

ALTER TABLE IF EXISTS public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.verification ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."user" FROM anon, authenticated;
REVOKE ALL ON TABLE public.session FROM anon, authenticated;
REVOKE ALL ON TABLE public.account FROM anon, authenticated;
REVOKE ALL ON TABLE public.verification FROM anon, authenticated;

-- FK helper index for quest-scoped submission lookups
CREATE INDEX IF NOT EXISTS submissions_quest_id_idx
  ON public.submissions (quest_id);

CREATE INDEX IF NOT EXISTS submissions_status_created_idx
  ON public.submissions (status, "createdAt");
