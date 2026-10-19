-- Quest scheduling: optional launch / end window.
-- A quest is "live" when status = 'active' AND now() is inside [starts_at, ends_at).
-- NULL starts_at = live immediately; NULL ends_at = never auto-closes.
-- Auto-closing is computed at query time (no cron needed).

ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quests_schedule_window_chk'
  ) THEN
    ALTER TABLE public.quests
      ADD CONSTRAINT quests_schedule_window_chk
      CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quests_schedule_idx
  ON public.quests (status, starts_at, ends_at);
