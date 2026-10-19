-- 007_quest_proof_links.sql: Multi-link proof requirements on quests + submissions

ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS link_description text NOT NULL DEFAULT '';

ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS link_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.quests
DROP CONSTRAINT IF EXISTS quests_link_count_check;

ALTER TABLE public.quests
ADD CONSTRAINT quests_link_count_check
CHECK (link_count >= 1 AND link_count <= 8);

ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS proof_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill array from legacy single proof_url
UPDATE public.submissions
SET proof_urls = jsonb_build_array(proof_url)
WHERE proof_url IS NOT NULL
  AND btrim(proof_url) <> ''
  AND (proof_urls IS NULL OR proof_urls = '[]'::jsonb);
