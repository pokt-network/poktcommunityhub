-- 004_server_roles.sql: Discord-style Server & Achievement Roles for POKT Community Hub

CREATE TABLE IF NOT EXISTS public.server_roles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  xp_required integer NOT NULL DEFAULT 0 CHECK (xp_required >= 0),
  color text NOT NULL DEFAULT '#3b82f6',
  icon text,
  position integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES public.server_roles(id) ON DELETE CASCADE,
  assigned_by text REFERENCES public."user"(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON public.user_roles (role_id);
CREATE INDEX IF NOT EXISTS server_roles_xp_idx ON public.server_roles (xp_required);

-- RLS lockdown for public / anon access
ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.server_roles FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;

-- Seed default POKT ecosystem achievement roles
INSERT INTO public.server_roles (id, name, description, xp_required, color, position)
VALUES
  ('role_scout', 'Node Scout', 'Welcome rank for all active Pocket Network ambassadors', 0, '#94a3b8', 1),
  ('role_runner', 'Relay Runner', 'Active ambassadors relaying POKT community threads & updates', 300, '#3b82f6', 2),
  ('role_sentinel', 'Gateway Sentinel', 'Dedicated community pillars hosting events and producing tutorials', 750, '#a855f7', 3),
  ('role_pioneer', 'Shannon Pioneer', 'Elite advocates spearheading the Shannon upgrade and core relays', 1500, '#10b981', 4),
  ('role_architect', 'Pocket Architect', 'Pinnacle ambassador tier guiding decentralized RPC infrastructure', 3000, '#f59e0b', 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  xp_required = EXCLUDED.xp_required,
  color = EXCLUDED.color,
  position = EXCLUDED.position,
  "updatedAt" = now();

-- Auto-backfill user roles for all users based on their existing totalXp
INSERT INTO public.user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, NULL
FROM public."user" u
CROSS JOIN public.server_roles r
WHERE u."totalXp" >= r.xp_required
ON CONFLICT (user_id, role_id) DO NOTHING;
