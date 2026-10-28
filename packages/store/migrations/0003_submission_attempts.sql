-- Up Migration

-- Submission rate limits (brief sections 4.7 and 12). One row per attempt to
-- submit proof, counted per user and per rule before any work is done. In the
-- database rather than in memory, so a restart does not reset a limit and a
-- second instance shares it. Rows older than an hour are swept as new attempts
-- arrive; nothing reads further back than a minute.
CREATE TABLE submission_attempts (
  user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  with_file boolean     NOT NULL,
  at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX submission_attempts_user ON submission_attempts (user_id, with_file, at);

-- Down Migration

DROP TABLE submission_attempts;
