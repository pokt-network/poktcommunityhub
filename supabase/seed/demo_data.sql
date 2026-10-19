-- Expanded demo seed: fake ambassadors, quests, and mixed submissions.
-- Safe to re-run (fixed ids + ON CONFLICT).

-- ---------------------------------------------------------------------------
-- Fake ambassadors (leaderboard + review queue demos)
-- ---------------------------------------------------------------------------
INSERT INTO public."user" (
  id, name, email, "emailVerified", image, role, "totalXp", "discordId",
  "createdAt", "updatedAt"
)
VALUES
  ('seed_user_aria', 'Aria Chen', 'seed_aria@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Aria', 'ambassador', 0, '900000000000000001', now() - interval '20 days', now()),
  ('seed_user_marco', 'Marco Diaz', 'seed_marco@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Marco', 'ambassador', 0, '900000000000000002', now() - interval '18 days', now()),
  ('seed_user_lena', 'Lena Okonkwo', 'seed_lena@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Lena', 'ambassador', 0, '900000000000000003', now() - interval '15 days', now()),
  ('seed_user_noah', 'Noah Patel', 'seed_noah@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Noah', 'ambassador', 0, '900000000000000004', now() - interval '12 days', now()),
  ('seed_user_yuki', 'Yuki Tanaka', 'seed_yuki@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Yuki', 'ambassador', 0, '900000000000000005', now() - interval '10 days', now()),
  ('seed_user_samir', 'Samir Haddad', 'seed_samir@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Samir', 'ambassador', 0, '900000000000000006', now() - interval '8 days', now()),
  ('seed_user_zoe', 'Zoe Martins', 'seed_zoe@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Zoe', 'ambassador', 0, '900000000000000007', now() - interval '6 days', now()),
  ('seed_user_ken', 'Ken Okada', 'seed_ken@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Ken', 'ambassador', 0, '900000000000000008', now() - interval '5 days', now()),
  ('seed_user_priya', 'Priya Nair', 'seed_priya@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Priya', 'ambassador', 0, '900000000000000009', now() - interval '3 days', now()),
  ('seed_user_eli', 'Eli Brooks', 'seed_eli@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Eli', 'ambassador', 0, '900000000000000010', now() - interval '2 days', now()),
  ('seed_user_hana', 'Hana Weiss', 'seed_hana@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Hana', 'ambassador', 0, '900000000000000011', now() - interval '1 day', now()),
  ('seed_user_omar', 'Omar Farouk', 'seed_omar@users.discord.local', true,
   'https://api.dicebear.com/9.x/avataaars/png?seed=Omar', 'ambassador', 0, '900000000000000012', now() - interval '12 hours', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  image = EXCLUDED.image,
  role = 'ambassador',
  "discordId" = EXCLUDED."discordId",
  "updatedAt" = now();

INSERT INTO public.account (
  id, "accountId", "providerId", "userId", "createdAt", "updatedAt"
)
VALUES
  ('seed_acc_aria', '900000000000000001', 'discord', 'seed_user_aria', now(), now()),
  ('seed_acc_marco', '900000000000000002', 'discord', 'seed_user_marco', now(), now()),
  ('seed_acc_lena', '900000000000000003', 'discord', 'seed_user_lena', now(), now()),
  ('seed_acc_noah', '900000000000000004', 'discord', 'seed_user_noah', now(), now()),
  ('seed_acc_yuki', '900000000000000005', 'discord', 'seed_user_yuki', now(), now()),
  ('seed_acc_samir', '900000000000000006', 'discord', 'seed_user_samir', now(), now()),
  ('seed_acc_zoe', '900000000000000007', 'discord', 'seed_user_zoe', now(), now()),
  ('seed_acc_ken', '900000000000000008', 'discord', 'seed_user_ken', now(), now()),
  ('seed_acc_priya', '900000000000000009', 'discord', 'seed_user_priya', now(), now()),
  ('seed_acc_eli', '900000000000000010', 'discord', 'seed_user_eli', now(), now()),
  ('seed_acc_hana', '900000000000000011', 'discord', 'seed_user_hana', now(), now()),
  ('seed_acc_omar', '900000000000000012', 'discord', 'seed_user_omar', now(), now())
ON CONFLICT (id) DO UPDATE SET
  "accountId" = EXCLUDED."accountId",
  "providerId" = 'discord',
  "userId" = EXCLUDED."userId",
  "updatedAt" = now();

-- ---------------------------------------------------------------------------
-- Quests
-- ---------------------------------------------------------------------------
INSERT INTO public.quests (id, title, description, xp_reward, icon, status)
VALUES
  ('seed_quest_tutorial', 'Create a Tutorial',
   'Write a short tutorial that helps a newcomer understand Pocket Network.', 150, NULL, 'active'),
  ('seed_quest_blog', 'Share a POKT Blog Post',
   'Publish or share a blog post about Pocket Network with your community.', 100, NULL, 'active'),
  ('seed_quest_thread', 'Post a Social Thread',
   'Post a thread on X/Twitter explaining one Pocket Network concept.', 75, NULL, 'active'),
  ('seed_quest_ama', 'Host a Mini AMA',
   'Run a short AMA or Q&A in Discord and share the recap link.', 250, NULL, 'active'),
  ('seed_quest_meme', 'Ship a Community Meme',
   'Create an original meme about Pocket Network and post it publicly.', 50, NULL, 'active'),
  ('seed_quest_video', 'Record a Explainer Clip',
   'Record a 60–90s video explainer about relays or Shannon.', 200, NULL, 'active'),
  ('seed_quest_translate', 'Translate Docs Snippet',
   'Translate a short Pocket docs section into another language.', 120, NULL, 'active'),
  ('seed_quest_meetup', 'Local Meetup Recap',
   'Host or attend a meetup and share a public recap.', 300, NULL, 'active'),
  ('seed_quest_bug', 'Report a Docs Bug',
   'Find and report a docs issue with a clear reproduction note.', 80, NULL, 'active'),
  ('seed_quest_closed', 'Legacy Onboarding Quiz',
   'Closed seasonal quiz from last cohort.', 40, NULL, 'closed')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  xp_reward = EXCLUDED.xp_reward,
  status = EXCLUDED.status,
  "updatedAt" = now();

-- ---------------------------------------------------------------------------
-- Submissions (varied statuses). XP is credited by trigger on approve.
-- Reset seed-user XP first so re-seeds stay predictable, then re-apply approvals.
-- ---------------------------------------------------------------------------
UPDATE public."user"
SET "totalXp" = 0, "updatedAt" = now()
WHERE id LIKE 'seed_user_%';

DELETE FROM public.submissions
WHERE id LIKE 'seed_sub_%';

-- Approved sets (builds leaderboard XP)
INSERT INTO public.submissions (id, user_id, quest_id, proof_url, status, reviewed_at)
VALUES
  -- Aria: strong leader
  ('seed_sub_aria_meme', 'seed_user_aria', 'seed_quest_meme', 'https://example.com/aria/meme', 'approved', now() - interval '9 days'),
  ('seed_sub_aria_blog', 'seed_user_aria', 'seed_quest_blog', 'https://example.com/aria/blog', 'approved', now() - interval '8 days'),
  ('seed_sub_aria_thread', 'seed_user_aria', 'seed_quest_thread', 'https://example.com/aria/thread', 'approved', now() - interval '7 days'),
  ('seed_sub_aria_tutorial', 'seed_user_aria', 'seed_quest_tutorial', 'https://example.com/aria/tutorial', 'approved', now() - interval '6 days'),
  ('seed_sub_aria_video', 'seed_user_aria', 'seed_quest_video', 'https://example.com/aria/video', 'approved', now() - interval '5 days'),
  -- Marco
  ('seed_sub_marco_meme', 'seed_user_marco', 'seed_quest_meme', 'https://example.com/marco/meme', 'approved', now() - interval '8 days'),
  ('seed_sub_marco_blog', 'seed_user_marco', 'seed_quest_blog', 'https://example.com/marco/blog', 'approved', now() - interval '7 days'),
  ('seed_sub_marco_thread', 'seed_user_marco', 'seed_quest_thread', 'https://example.com/marco/thread', 'approved', now() - interval '6 days'),
  ('seed_sub_marco_translate', 'seed_user_marco', 'seed_quest_translate', 'https://example.com/marco/translate', 'approved', now() - interval '4 days'),
  -- Lena
  ('seed_sub_lena_meme', 'seed_user_lena', 'seed_quest_meme', 'https://example.com/lena/meme', 'approved', now() - interval '7 days'),
  ('seed_sub_lena_blog', 'seed_user_lena', 'seed_quest_blog', 'https://example.com/lena/blog', 'approved', now() - interval '5 days'),
  ('seed_sub_lena_ama', 'seed_user_lena', 'seed_quest_ama', 'https://example.com/lena/ama', 'approved', now() - interval '3 days'),
  -- Noah
  ('seed_sub_noah_meme', 'seed_user_noah', 'seed_quest_meme', 'https://example.com/noah/meme', 'approved', now() - interval '6 days'),
  ('seed_sub_noah_thread', 'seed_user_noah', 'seed_quest_thread', 'https://example.com/noah/thread', 'approved', now() - interval '4 days'),
  ('seed_sub_noah_bug', 'seed_user_noah', 'seed_quest_bug', 'https://example.com/noah/bug', 'approved', now() - interval '2 days'),
  -- Yuki
  ('seed_sub_yuki_blog', 'seed_user_yuki', 'seed_quest_blog', 'https://example.com/yuki/blog', 'approved', now() - interval '5 days'),
  ('seed_sub_yuki_video', 'seed_user_yuki', 'seed_quest_video', 'https://example.com/yuki/video', 'approved', now() - interval '2 days'),
  -- Samir
  ('seed_sub_samir_meme', 'seed_user_samir', 'seed_quest_meme', 'https://example.com/samir/meme', 'approved', now() - interval '4 days'),
  ('seed_sub_samir_meetup', 'seed_user_samir', 'seed_quest_meetup', 'https://example.com/samir/meetup', 'approved', now() - interval '1 day'),
  -- Zoe / Ken / Priya / Eli / Hana / Omar lighter XP
  ('seed_sub_zoe_meme', 'seed_user_zoe', 'seed_quest_meme', 'https://example.com/zoe/meme', 'approved', now() - interval '3 days'),
  ('seed_sub_zoe_thread', 'seed_user_zoe', 'seed_quest_thread', 'https://example.com/zoe/thread', 'approved', now() - interval '2 days'),
  ('seed_sub_ken_blog', 'seed_user_ken', 'seed_quest_blog', 'https://example.com/ken/blog', 'approved', now() - interval '2 days'),
  ('seed_sub_priya_meme', 'seed_user_priya', 'seed_quest_meme', 'https://example.com/priya/meme', 'approved', now() - interval '1 day'),
  ('seed_sub_eli_bug', 'seed_user_eli', 'seed_quest_bug', 'https://example.com/eli/bug', 'approved', now() - interval '20 hours'),
  ('seed_sub_hana_meme', 'seed_user_hana', 'seed_quest_meme', 'https://example.com/hana/meme', 'approved', now() - interval '10 hours'),
  ('seed_sub_omar_thread', 'seed_user_omar', 'seed_quest_thread', 'https://example.com/omar/thread', 'approved', now() - interval '6 hours');

-- Pending queue (admin review demos)
INSERT INTO public.submissions (id, user_id, quest_id, proof_url, status)
VALUES
  ('seed_sub_pending_marco_ama', 'seed_user_marco', 'seed_quest_ama', 'https://example.com/marco/ama-pending', 'pending'),
  ('seed_sub_pending_lena_video', 'seed_user_lena', 'seed_quest_video', 'https://example.com/lena/video-pending', 'pending'),
  ('seed_sub_pending_noah_tutorial', 'seed_user_noah', 'seed_quest_tutorial', 'https://example.com/noah/tutorial-pending', 'pending'),
  ('seed_sub_pending_yuki_meetup', 'seed_user_yuki', 'seed_quest_meetup', 'https://example.com/yuki/meetup-pending', 'pending'),
  ('seed_sub_pending_zoe_translate', 'seed_user_zoe', 'seed_quest_translate', 'https://example.com/zoe/translate-pending', 'pending'),
  ('seed_sub_pending_ken_ama', 'seed_user_ken', 'seed_quest_ama', 'https://example.com/ken/ama-pending', 'pending'),
  ('seed_sub_pending_priya_blog', 'seed_user_priya', 'seed_quest_blog', 'https://example.com/priya/blog-pending', 'pending'),
  ('seed_sub_pending_eli_tutorial', 'seed_user_eli', 'seed_quest_tutorial', 'https://example.com/eli/tutorial-pending', 'pending'),
  ('seed_sub_pending_hana_blog', 'seed_user_hana', 'seed_quest_blog', 'https://example.com/hana/blog-pending', 'pending'),
  ('seed_sub_pending_omar_meme', 'seed_user_omar', 'seed_quest_meme', 'https://example.com/omar/meme-pending', 'pending');

-- A few rejected samples
INSERT INTO public.submissions (id, user_id, quest_id, proof_url, status, review_note, reviewed_at)
VALUES
  ('seed_sub_rej_ken_thread', 'seed_user_ken', 'seed_quest_thread', 'https://example.com/ken/thread-bad', 'rejected',
   'Link is private — needs a public post URL.', now() - interval '2 days'),
  ('seed_sub_rej_priya_video', 'seed_user_priya', 'seed_quest_video', 'https://example.com/priya/video-bad', 'rejected',
   'Clip is under 30s and missing Pocket context.', now() - interval '1 day'),
  ('seed_sub_rej_eli_meme', 'seed_user_eli', 'seed_quest_meme', 'https://example.com/eli/meme-bad', 'rejected',
   'Looks AI-generic — please add original caption.', now() - interval '8 hours');

-- Also keep a pending submission for every real (non-seed) user on the blog quest
INSERT INTO public.submissions (id, user_id, quest_id, proof_url, status)
SELECT
  'seed_sub_live_pending_' || u.id,
  u.id,
  'seed_quest_blog',
  'https://example.com/proof/blog-' || left(u.id, 8),
  'pending'
FROM public."user" u
WHERE u.id NOT LIKE 'seed_user_%'
ON CONFLICT (user_id, quest_id) DO UPDATE SET
  proof_url = EXCLUDED.proof_url,
  status = 'pending',
  review_note = NULL,
  reviewed_by = NULL,
  reviewed_at = NULL,
  "updatedAt" = now();
