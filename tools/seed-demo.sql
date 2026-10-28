-- Demo data for development (brief section 9, item 1): categories, ranks, quests
-- in every phase, and a few made-up ambassadors with XP so the leaderboard and
-- profiles have something to show.
--
-- Never for production. It refuses to run unless the session opts in, and
-- refuses a database that already has quests:
--
--   { echo "SET community.seed = 'demo';"; cat tools/seed-demo.sql; } \
--     | docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
--
-- The made-up users have the Discord ids 1000000000000000001 to …003, so they
-- are easy to find and delete.

BEGIN;

DO $$
BEGIN
  IF current_setting('community.seed', true) IS DISTINCT FROM 'demo' THEN
    RAISE EXCEPTION 'demo seed refused: run SET community.seed = ''demo'' first (development only)';
  END IF;
  IF EXISTS (SELECT 1 FROM quests) THEN
    RAISE EXCEPTION 'demo seed refused: this database already has quests';
  END IF;
END
$$;

INSERT INTO quest_categories (name, position) VALUES
  ('Social', 0), ('Content', 1), ('Community', 2), ('Technical', 3);

INSERT INTO server_roles (name, description, color, icon, xp_required, position) VALUES
  ('Scout',    'Your first 100 XP.',                 '#48e5c2', '🧭', 100, 0),
  ('Ranger',   '500 XP: a regular contributor.',     '#5a9eff', '🏹', 500, 1),
  ('Vanguard', '1,500 XP: leading from the front.',  '#ffc547', '🛡️', 1500, 2),
  ('Herald',   'Wrote a published Pocket article.',  '#b8b8ff', '📜', NULL, 3);

INSERT INTO quests (title, description_md, xp_reward, icon, category_id, link_count, link_hint,
                    starts_at, ends_at, reward_role_id, status)
SELECT q.title, q.body, q.xp, q.icon, c.id, q.links, q.hint, q.starts, q.ends, r.id, q.status
  FROM (VALUES
    ('Share the Shannon upgrade',
     E'Post about the **Shannon** upgrade on X and tag `@POKTnetwork`.\n\n- Say what changed for builders\n- Link to [the docs](https://docs.pokt.network)',
     50, '📣', 'Social', 1::smallint, 'The link to your post.', NULL::timestamptz,
     now() + interval '20 days', NULL, 'active'),
    ('Write a Pocket explainer',
     E'Publish an article explaining how relays are paid for on Pocket Network.\n\nAt least 600 words, with a diagram if you can.',
     300, '✍️', 'Content', 2::smallint, 'The article, and a post sharing it.', NULL,
     NULL, 'Herald', 'active'),
    ('Welcome three newcomers',
     'Help three people in the Discord with their first questions, and link the threads.',
     120, '🤝', 'Community', 3::smallint, NULL, NULL,
     now() + interval '3 days', NULL, 'active'),
    ('Run a RelayMiner on testnet',
     E'Stand up a RelayMiner against Beta TestNet and serve relays for a day.\n\nShare the supplier address and a screenshot of the metrics.',
     500, '🛠️', 'Technical', 1::smallint, 'Your supplier address on the explorer.', NULL,
     NULL, NULL, 'active'),
    ('Spring AMA recap',
     'Summarise the spring AMA in a thread.',
     80, '🎙️', 'Content', 1::smallint, NULL, now() - interval '90 days',
     now() - interval '60 days', NULL, 'active'),
    ('Holiday meme contest',
     'Opens next month.',
     60, '🎉', 'Social', 1::smallint, NULL, now() + interval '30 days',
     now() + interval '45 days', NULL, 'active')
  ) AS q(title, body, xp, icon, cat, links, hint, starts, ends, role, status)
  LEFT JOIN quest_categories c ON c.name = q.cat
  LEFT JOIN server_roles r ON r.name = q.role;

INSERT INTO users (discord_id, name, role) VALUES
  ('1000000000000000001', 'Ada Relay', 'ambassador'),
  ('1000000000000000002', 'Grace Node', 'ambassador'),
  ('1000000000000000003', 'Linus Gateway', 'ambassador');

-- Approved submissions, each with its ledger award, spread over this month and last.
WITH awards(name, quest, ago) AS (VALUES
  ('Ada Relay',     'Run a RelayMiner on testnet', interval '40 days'),
  ('Ada Relay',     'Write a Pocket explainer',    interval '3 days'),
  ('Ada Relay',     'Spring AMA recap',            interval '70 days'),
  ('Grace Node',    'Share the Shannon upgrade',   interval '2 days'),
  ('Grace Node',    'Run a RelayMiner on testnet', interval '1 day'),
  ('Linus Gateway', 'Share the Shannon upgrade',   interval '5 days')
),
subs AS (
  INSERT INTO submissions (user_id, quest_id, proof_urls, status, reviewed_at, created_at, updated_at)
  SELECT u.id, q.id, ARRAY['https://example.org/proof/' || md5(u.name || q.title)], 'approved',
         now() - a.ago, now() - a.ago - interval '1 day', now() - a.ago
    FROM awards a JOIN users u ON u.name = a.name JOIN quests q ON q.title = a.quest
  RETURNING id, user_id, quest_id, reviewed_at
)
INSERT INTO xp_events (user_id, submission_id, delta, reason, at)
SELECT s.user_id, s.id, q.xp_reward, 'approved', s.reviewed_at
  FROM subs s JOIN quests q ON q.id = s.quest_id;

-- One waiting for review and one rejected, so the history page shows every state.
INSERT INTO submissions (user_id, quest_id, proof_urls, status, review_note, reviewed_at)
SELECT u.id, q.id, ARRAY['https://example.org/proof/pending'], 'pending', NULL, NULL
  FROM users u, quests q WHERE u.name = 'Linus Gateway' AND q.title = 'Welcome three newcomers'
UNION ALL
SELECT u.id, q.id, ARRAY['https://example.org/proof/rejected'], 'rejected',
       'The post was deleted before review. Please repost and resubmit.', now() - interval '1 day'
  FROM users u, quests q WHERE u.name = 'Grace Node' AND q.title = 'Write a Pocket explainer'
  -- link_count is 2 for this quest, but the seed writes the row directly.
;

-- Ranks earned by XP, and the explainer's reward role.
INSERT INTO user_roles (user_id, role_id, source)
SELECT t.user_id, r.id, 'xp'
  FROM (SELECT user_id, sum(delta) AS xp FROM xp_events GROUP BY user_id) t
  JOIN server_roles r ON r.xp_required IS NOT NULL AND r.xp_required <= t.xp;

INSERT INTO user_roles (user_id, role_id, source)
SELECT u.id, r.id, 'quest'
  FROM users u, server_roles r WHERE u.name = 'Ada Relay' AND r.name = 'Herald';

COMMIT;
