-- 006_quest_categories.sql: Admin-managed quest categories

CREATE TABLE IF NOT EXISTS public.quest_categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quest_categories_position_idx
  ON public.quest_categories (position, name);

ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS category_id text REFERENCES public.quest_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quests_category_id_idx ON public.quests (category_id);

ALTER TABLE public.quest_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quest_categories FROM anon, authenticated;

-- Seed the filters ambassadors already see on the board
INSERT INTO public.quest_categories (id, name, position)
VALUES
  ('cat_social', 'Social', 1),
  ('cat_onboarding', 'Onboarding', 2),
  ('cat_community', 'Community', 3),
  ('cat_earn', 'Earn', 4),
  ('cat_other', 'Other', 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  "updatedAt" = now();

-- Soft-tag existing quests into the closest default category
UPDATE public.quests q
SET category_id = CASE
  WHEN lower(q.title || ' ' || q.description) ~ '(discord|twitter|x\.com|social|share|post|blog)'
    THEN 'cat_social'
  WHEN lower(q.title || ' ' || q.description) ~ '(onboard|welcome|intro|verify|email|get started)'
    THEN 'cat_onboarding'
  WHEN lower(q.title || ' ' || q.description) ~ '(meetup|community|ama|event|recap)'
    THEN 'cat_community'
  WHEN lower(q.title || ' ' || q.description) ~ '(earn|reward|xp|tutorial|video|clip)'
    THEN 'cat_earn'
  ELSE 'cat_other'
END
WHERE q.category_id IS NULL;
