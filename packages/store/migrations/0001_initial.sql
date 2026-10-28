-- Up Migration

-- The hub's schema (build brief, section 5). The Auth.js session tables are not
-- here: they arrive with sign-in in phase 3, shaped by the adapter actually used.

-- A Discord snowflake: 17 to 20 digits.
CREATE DOMAIN discord_snowflake AS text CHECK (VALUE ~ '^[0-9]{17,20}$');

CREATE TABLE users (
  id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id    discord_snowflake NOT NULL UNIQUE,
  name          text              NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  avatar_url    text,
  role          text              NOT NULL DEFAULT 'ambassador'
                                  CHECK (role IN ('ambassador', 'admin')),
  created_at    timestamptz       NOT NULL DEFAULT now(),
  updated_at    timestamptz       NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE quest_categories (
  id       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text    NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE server_roles (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text              NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 100),
  description     text              NOT NULL DEFAULT '',
  color           text              CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon            text,
  -- NULL: granted only as a quest reward or by hand, never by XP.
  xp_required     integer           CHECK (xp_required >= 0),
  position        integer           NOT NULL DEFAULT 0,
  -- NULL until the Discord role exists (flow 13 creates missing ones).
  discord_role_id discord_snowflake UNIQUE
);

CREATE TABLE quests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description_md text        NOT NULL DEFAULT '',
  xp_reward      integer     NOT NULL CHECK (xp_reward > 0),
  icon           text,
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  category_id    uuid        REFERENCES quest_categories (id) ON DELETE SET NULL,
  link_count     smallint    NOT NULL DEFAULT 1 CHECK (link_count BETWEEN 1 AND 8),
  link_hint      text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  reward_role_id uuid        REFERENCES server_roles (id) ON DELETE SET NULL,
  created_by     uuid        REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quests_window_order CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE submissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- RESTRICT: a quest with submissions holds awarded XP and its audit trail, so
  -- it is closed rather than deleted.
  quest_id    uuid        NOT NULL REFERENCES quests (id) ON DELETE RESTRICT,
  proof_urls  text[]      NOT NULL CHECK (cardinality(proof_urls) BETWEEN 1 AND 8),
  -- A path on the proofs volume. Nulled by the 60-day retention job (section 9, item 6).
  proof_file  text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid        REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, quest_id),

  -- A reviewed submission records when; a pending one carries no review.
  CONSTRAINT submissions_review_consistent CHECK (
    (status = 'pending' AND reviewed_at IS NULL) OR (status <> 'pending' AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX submissions_pending ON submissions (created_at) WHERE status = 'pending';
CREATE INDEX submissions_quest ON submissions (quest_id);
-- The retention job's scan: reviewed proof files, oldest first.
CREATE INDEX submissions_proof_retention ON submissions (reviewed_at)
  WHERE proof_file IS NOT NULL AND status <> 'pending';

-- XP is a ledger, not a counter (section 4.1). Every total is a sum of this table.
CREATE TABLE xp_events (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  submission_id uuid        NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  delta         integer     NOT NULL CHECK (delta <> 0),
  reason        text        NOT NULL CHECK (reason IN ('approved', 'undone')),
  -- The award an 'undone' row cancels. Monthly totals count the undo in the
  -- award's month, so undoing last month's approval corrects last month.
  reverses      bigint      UNIQUE REFERENCES xp_events (id),
  -- No foreign key: deleting an admin must not rewrite the ledger they wrote.
  actor_id      uuid,
  at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT xp_events_reason_shape CHECK (
    (reason = 'approved' AND delta > 0 AND reverses IS NULL)
    OR (reason = 'undone' AND delta < 0 AND reverses IS NOT NULL)
  )
);

CREATE INDEX xp_events_user ON xp_events (user_id);
CREATE INDEX xp_events_submission ON xp_events (submission_id);
CREATE INDEX xp_events_at ON xp_events (at);

-- Append-only. A row leaves only when its user does (account deletion, flow 12):
-- the cascade from users runs after the user row is gone, which is what the
-- check below looks for. Anything else is refused, including TRUNCATE.
CREATE FUNCTION xp_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
      RAISE EXCEPTION 'xp_events is append-only: write a reversing event instead';
    END IF;
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'xp_events is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER xp_events_no_update BEFORE UPDATE ON xp_events
  FOR EACH ROW EXECUTE FUNCTION xp_events_append_only();
CREATE TRIGGER xp_events_no_delete BEFORE DELETE ON xp_events
  FOR EACH ROW EXECUTE FUNCTION xp_events_append_only();
CREATE TRIGGER xp_events_no_truncate BEFORE TRUNCATE ON xp_events
  FOR EACH STATEMENT EXECUTE FUNCTION xp_events_append_only();

-- Per-event month attribution: an undo counts in the month of the award it cancels.
CREATE VIEW xp_events_attributed AS
  SELECT e.user_id, e.delta, coalesce(r.at, e.at) AS attributed_at
  FROM xp_events e
  LEFT JOIN xp_events r ON r.id = e.reverses;

CREATE TABLE user_roles (
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id     uuid        NOT NULL REFERENCES server_roles (id) ON DELETE CASCADE,
  source      text        NOT NULL CHECK (source IN ('xp', 'quest', 'manual')),
  assigned_by uuid        REFERENCES users (id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, role_id)
);

-- The Discord outbox (section 4.3). Written in the same transaction as the change
-- it reports; drained by the worker (phase 6).
CREATE TABLE discord_jobs (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind            text        NOT NULL CHECK (kind IN ('sync_member_roles', 'announce')),
  payload         jsonb       NOT NULL,
  attempts        integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  done_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discord_jobs_due ON discord_jobs (next_attempt_at) WHERE done_at IS NULL;

-- Key/value settings. The webhook URL inside is AES-256-GCM ciphertext (section 9, item 7).
CREATE TABLE app_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_by uuid        REFERENCES users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE app_settings;
DROP TABLE discord_jobs;
DROP TABLE user_roles;
DROP VIEW xp_events_attributed;
DROP TABLE xp_events;
DROP FUNCTION xp_events_append_only();
DROP TABLE submissions;
DROP TABLE quests;
DROP TABLE server_roles;
DROP TABLE quest_categories;
DROP TABLE users;
DROP DOMAIN discord_snowflake;
