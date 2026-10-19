-- 005_quest_roles.sql: Allow quests to optionally grant a server achievement role on approval

ALTER TABLE public.quests
ADD COLUMN IF NOT EXISTS reward_role_id text REFERENCES public.server_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quests_reward_role_id_idx ON public.quests(reward_role_id);

-- Update approval trigger to also award the quest's role reward if configured
CREATE OR REPLACE FUNCTION public.credit_xp_on_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reward integer;
  role_reward text;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT q.xp_reward, q.reward_role_id INTO reward, role_reward
    FROM public.quests q
    WHERE q.id = NEW.quest_id;

    IF reward IS NOT NULL THEN
      UPDATE public."user"
      SET "totalXp" = COALESCE("totalXp", 0) + reward,
          "updatedAt" = now()
      WHERE id = NEW.user_id;
    END IF;

    -- Automatically award quest server role upon review approval
    IF role_reward IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, assigned_by)
      VALUES (NEW.user_id, role_reward, NEW.reviewed_by)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
