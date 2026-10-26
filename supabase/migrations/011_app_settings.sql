-- 011_app_settings.sql: Key/value store for admin-configurable app settings
-- (e.g. Discord announcement webhook + which events to announce).
-- Accessed only server-side via DATABASE_URL; no PostgREST access.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text REFERENCES public."user"(id) ON DELETE SET NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated, PUBLIC;
