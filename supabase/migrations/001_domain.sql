-- Domain schema for POKT Ambassador Portal (quests, submissions, XP)
-- Apply in Supabase SQL Editor or: node scripts/apply-domain.mjs

-- Quests
CREATE TABLE IF NOT EXISTS public.quests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  xp_reward integer NOT NULL CHECK (xp_reward >= 0),
  icon text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Submissions (one row per user + quest; status updates on resubmit)
CREATE TABLE IF NOT EXISTS public.submissions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  quest_id text NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  proof_url text,
  proof_path text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by text REFERENCES public."user"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS submissions_status_idx ON public.submissions (status);
CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS quests_status_idx ON public.quests (status);

-- Credit XP once when a submission transitions to approved
CREATE OR REPLACE FUNCTION public.credit_xp_on_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reward integer;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT q.xp_reward INTO reward
    FROM public.quests q
    WHERE q.id = NEW.quest_id;

    IF reward IS NOT NULL THEN
      UPDATE public."user"
      SET "totalXp" = COALESCE("totalXp", 0) + reward,
          "updatedAt" = now()
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_credit_xp ON public.submissions;
CREATE TRIGGER submissions_credit_xp
  AFTER INSERT OR UPDATE OF status ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_xp_on_approval();

-- Restrictive RLS (server uses DATABASE_URL / service role for writes)
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- No public policies yet — Data API stays locked down for Day 1.
-- Day 2+ can add authenticated policies as needed.
