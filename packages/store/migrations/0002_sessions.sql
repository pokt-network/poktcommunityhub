-- Up Migration

-- Auth.js database sessions (brief sections 9.5 and 11). Our own adapter, so no
-- `accounts` table: Discord is the only provider and users.discord_id is the
-- link. Discord's OAuth tokens are never stored.
--
-- The cookie's token is stored as its SHA-256, never as itself: a copy of this
-- table (a backup, a log of a query) cannot be replayed as a cookie.
CREATE TABLE sessions (
  token_hash text        PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires    timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires);

-- Down Migration

DROP TABLE sessions;
