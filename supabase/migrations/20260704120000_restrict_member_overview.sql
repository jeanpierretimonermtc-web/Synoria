-- member_overview est une vue d'administration.
-- Les vues ne supportent pas RLS en PostgreSQL : on contrôle l'accès via GRANT/REVOKE.
-- Seul service_role (dashboard Supabase + Edge Functions admin) peut la lire.

REVOKE ALL ON public.member_overview FROM anon;
REVOKE ALL ON public.member_overview FROM authenticated;

GRANT SELECT ON public.member_overview TO service_role;
