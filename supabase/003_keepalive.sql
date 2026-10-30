-- OPTIONAL migration: public single-row heartbeat for Gaming Life only.
-- No personal data, no write permission for anonymous clients.
-- Review in Supabase SQL Editor; DO NOT execute as part of merging this PR.
CREATE TABLE IF NOT EXISTS public.gaming_life_keepalive (
  id integer PRIMARY KEY CHECK (id = 1)
);
INSERT INTO public.gaming_life_keepalive (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.gaming_life_keepalive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gaming_life_keepalive FROM anon, authenticated;
GRANT SELECT ON TABLE public.gaming_life_keepalive TO anon, authenticated;
DROP POLICY IF EXISTS "gaming_life_keepalive_read" ON public.gaming_life_keepalive;
CREATE POLICY "gaming_life_keepalive_read" ON public.gaming_life_keepalive
  FOR SELECT TO anon, authenticated USING (id = 1);
