-- Fix : le trigger handle_new_user échoue HTTP 500 lors de l'inscription.
--
-- Cause : RLS activé sur organizations/profiles/organization_members/licenses
-- sans aucune policy INSERT. La fonction security definer tourne avec le rôle
-- "postgres" qui est sujet à RLS dans Supabase cloud (ALTER ROLE BYPASSRLS
-- est réservé aux vrais superusers — inaccessible via CLI).
--
-- Solution : policies INSERT TO postgres WITH CHECK (true) sur chaque table.
-- Seul postgres peut insérer (authenticated/anon n'ont pas de policy INSERT
-- → accès refusé pour eux → sécurité maintenue).
-- Les Edge Functions utilisent service_role qui contourne RLS entièrement.

CREATE POLICY "postgres_insert_organizations" ON public.organizations
  FOR INSERT TO postgres WITH CHECK (true);

CREATE POLICY "postgres_insert_profiles" ON public.profiles
  FOR INSERT TO postgres WITH CHECK (true);

CREATE POLICY "postgres_insert_organization_members" ON public.organization_members
  FOR INSERT TO postgres WITH CHECK (true);

CREATE POLICY "postgres_insert_licenses" ON public.licenses
  FOR INSERT TO postgres WITH CHECK (true);

-- Trigger résilient avec logging pour diagnostic futur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, owner_user_id)
  VALUES ('Mon cabinet', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id)
  VALUES (NEW.id, new_org_id);

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  INSERT INTO public.licenses (organization_id, status)
  VALUES (new_org_id, 'restricted');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user ERREUR pour user % : [%] %', NEW.id, SQLSTATE, SQLERRM;
  RAISE;
END;
$$;
