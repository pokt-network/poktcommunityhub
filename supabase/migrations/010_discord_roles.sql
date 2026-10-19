-- 010_discord_roles.sql: Discord role mapping and sync support
-- Allows mapping Community Hub server_roles directly to Discord role snowflake IDs.

ALTER TABLE public.server_roles
  ADD COLUMN IF NOT EXISTS discord_role_id text;

CREATE INDEX IF NOT EXISTS server_roles_discord_role_id_idx
  ON public.server_roles (discord_role_id)
  WHERE discord_role_id IS NOT NULL;
