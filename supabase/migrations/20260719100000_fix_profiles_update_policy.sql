-- ============================================================================
-- Securité : restriction de la politique UPDATE sur profiles
-- ----------------------------------------------------------------------------
-- Problème : la policy "update own profile" permettait à un utilisateur
-- authentifié de modifier n'importe quelle colonne de sa ligne, y compris
-- organization_id, ce qui lui aurait permis de s'approprier la licence d'une
-- autre organisation.
--
-- Correction (deux couches) :
--   1. WITH CHECK : interdit de changer organization_id dans la requête UPDATE.
--   2. Trigger BEFORE UPDATE : bloque toute tentative de modifier user_id ou
--      organization_id, même via service_role ou une future policy laxiste.
-- ============================================================================

-- 1. Politique UPDATE restrictive —————————————————————————————————————————————
--    USING  : l'utilisateur ne peut agir que sur sa propre ligne.
--    WITH CHECK : après modification, organization_id doit rester identique
--                 à ce qu'il était (sous-requête sur l'ancienne valeur).
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and organization_id is not distinct from (
      select p.organization_id
      from   public.profiles p
      where  p.user_id = auth.uid()
    )
  );

-- 2. Trigger de protection des champs immuables ———————————————————————————————
create or replace function public.prevent_profile_immutable_fields()
returns trigger
security definer
language plpgsql
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id est immuable sur profiles';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id est immuable sur profiles — modification interdite';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_immutable on public.profiles;
create trigger trg_prevent_profile_immutable
  before update on public.profiles
  for each row
  execute function public.prevent_profile_immutable_fields();
