-- Migration : correction politique RLS de app_releases
--
-- La migration 20260703140000 a recréé la politique avec "TO authenticated" uniquement,
-- ce qui bloque la vérification de mise à jour effectuée avant le login Supabase
-- (l'app vérifie les releases au démarrage, avant que l'utilisateur soit connecté).
-- On étend la politique aux utilisateurs anonymes — les données de release ne sont pas sensibles.

DROP POLICY IF EXISTS "app_releases_read_active" ON public.app_releases;

CREATE POLICY "app_releases_read_active"
  ON public.app_releases
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
