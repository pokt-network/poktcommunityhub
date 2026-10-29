-- Up Migration

-- The worker (phase 6, brief section 14). A job is done (done_at, with a note
-- when it was skipped), failed for good after its tenth attempt (failed_at,
-- shown in the console with a Retry button), or still due.
ALTER TABLE discord_jobs ADD COLUMN failed_at timestamptz;
ALTER TABLE discord_jobs ADD COLUMN note text;
ALTER TABLE discord_jobs ADD CONSTRAINT discord_jobs_one_end
  CHECK (done_at IS NULL OR failed_at IS NULL);
DROP INDEX discord_jobs_due;
CREATE INDEX discord_jobs_due ON discord_jobs (next_attempt_at)
  WHERE done_at IS NULL AND failed_at IS NULL;
CREATE INDEX discord_jobs_failed ON discord_jobs (failed_at) WHERE failed_at IS NOT NULL;

-- When a quest's "new quest" announcement was queued (section 14.5). Reopening
-- clears it. Quests that exist already were never announced and are not now.
ALTER TABLE quests ADD COLUMN announced_at timestamptz;
UPDATE quests SET announced_at = now();

-- Down Migration

ALTER TABLE quests DROP COLUMN announced_at;
DROP INDEX discord_jobs_failed;
DROP INDEX discord_jobs_due;
ALTER TABLE discord_jobs DROP CONSTRAINT discord_jobs_one_end;
ALTER TABLE discord_jobs DROP COLUMN note;
ALTER TABLE discord_jobs DROP COLUMN failed_at;
CREATE INDEX discord_jobs_due ON discord_jobs (next_attempt_at) WHERE done_at IS NULL;
