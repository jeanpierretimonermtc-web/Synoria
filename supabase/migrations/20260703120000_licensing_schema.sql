-- ============================================================================
-- Synoria - Systeme de licence (Stripe Billing + Supabase)
-- Schema complet : comptes, organisations, abonnements, licences, appareils,
-- desactivations d'appareils, verifications de licence, notifications de
-- mise a jour.
--
-- PORTEE STRICTE : aucune table de ce schema ne doit jamais contenir de
-- donnees patient, de seance, de rendez-vous patient, de facture patient
-- ou de sauvegarde Synoria. Tout cela reste exclusivement en local, dans
-- la base SQLite chiffree de l'application (voir authService.ts /
-- migrations.ts cote Electron). Ce schema Supabase ne connait que la
-- relation commerciale (compte / organisation / abonnement / licence).
--
-- Ecritures sensibles (subscriptions, licenses, devices, logs) : reservees
-- aux Edge Functions executees avec la cle service_role, qui contourne la
-- RLS. Les utilisateurs authentifies (cle anon + JWT) ne peuvent que LIRE
-- les donnees de leur propre organisation ; aucune policy INSERT/UPDATE/
-- DELETE n'est ouverte a authenticated/anon sur ces tables. En Postgres,
-- RLS activee + absence de policy pour une commande donnee = acces refuse
-- pour tous les roles sauf service_role (qui contourne RLS entierement).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. organizations
-- ----------------------------------------------------------------------------
-- Architecture "cabinet" simple pour la V1 : une organisation = un cabinet.
-- Chaque organisation possede au plus une licence (contrainte unique sur
-- licenses.organization_id, plus bas). Pret pour "Synoria Cabinet"
-- (plusieurs membres par organisation) sans migration supplementaire.
-- ============================================================================
create table if not exists public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default 'Mon cabinet',
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.organizations is 'Cabinet / entite commerciale Synoria. Jamais de donnees patient ici.';

-- ============================================================================
-- 2. profiles
-- ----------------------------------------------------------------------------
-- Une ligne par utilisateur Supabase Auth (1 utilisateur = 1 organisation
-- en V1). Cree automatiquement a l'inscription (trigger handle_new_user).
-- ============================================================================
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  organization_id  uuid references public.organizations(id) on delete set null,
  display_name     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.profiles is 'Profil minimal lie a auth.users. Aucune donnee patient.';

-- ============================================================================
-- 3. organization_members
-- ----------------------------------------------------------------------------
-- Appartenance utilisateur <-> organisation. En V1 : toujours 1 ligne
-- (role owner) par organisation. Prevu pour Synoria Cabinet (role 'member').
-- ============================================================================
create table if not exists public.organization_members (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null default 'owner' check (role in ('owner', 'member')),
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
comment on table public.organization_members is 'Table de jointure organisation <-> utilisateur (roles).';

-- ============================================================================
-- 4. subscriptions
-- ----------------------------------------------------------------------------
-- Miroir 1:1 de l'objet Subscription Stripe. Alimentee UNIQUEMENT par
-- l'Edge Function stripe-webhook (service_role) a partir des evenements
-- Stripe. Les statuts reprennent exactement l'enum Stripe + l'etat derive
-- interne "past_due_grace" (delai de grace de 7 jours apres un echec de
-- paiement, avant bascule de la licence en restricted).
-- ============================================================================
create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id      text not null,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  plan_name               text check (plan_name in ('synoria_annuel', 'synoria_6mois', 'synoria_cabinet')),
  status                  text not null check (status in (
                             'trialing', 'active', 'past_due', 'past_due_grace',
                             'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
                           )),
  trial_end               timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
comment on table public.subscriptions is 'Miroir Stripe (facturation). Ecrit uniquement par stripe-webhook.';
comment on column public.subscriptions.status is 'Enum Stripe + past_due_grace (etat derive interne, 7 jours de grace apres echec de paiement).';

create index if not exists idx_subscriptions_org              on public.subscriptions(organization_id);
create index if not exists idx_subscriptions_stripe_customer   on public.subscriptions(stripe_customer_id);

-- ============================================================================
-- 5. licenses
-- ----------------------------------------------------------------------------
-- Etat d'acces "derive", decouple de Stripe (permet plus tard des licences
-- hors Stripe : offre manuelle, support, etc.). C'est CETTE table que
-- l'Edge Function verify-license consulte pour decider quoi signer dans le
-- jeton offline, et que l'application Electron lit pour savoir si elle doit
-- passer en mode restreint.
--
-- grace_until : date limite calculee par verify-license pour les etats
-- offline_grace (jeton local encore valide, app hors ligne depuis <7 jours)
-- et past_due_grace (echec de paiement, 7 jours de grace). Au-dela de
-- grace_until sans regularisation, la licence bascule en restricted/expired.
--
-- Statut par defaut d'une licence fraichement creee (avant tout paiement) :
-- 'restricted'. Le libelle 'none' n'existe pas dans l'enum demande ;
-- 'restricted' est l'etat le plus sur par defaut (aucune ecriture patient
-- premium tant qu'aucun essai/abonnement n'a demarre), coherent avec le
-- comportement "mode restreint" deja specifie.
-- ============================================================================
create table if not exists public.licenses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null unique references public.organizations(id) on delete cascade,
  subscription_id   uuid references public.subscriptions(id) on delete set null,
  status            text not null default 'restricted' check (status in (
                       'trialing', 'active', 'offline_grace', 'past_due_grace',
                       'restricted', 'expired', 'cancelled', 'revoked'
                     )),
  max_devices       integer not null default 2,
  grace_until       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.licenses is 'Etat d''acces derive, consulte par verify-license et par Electron. Jamais de donnees patient.';
comment on column public.licenses.max_devices is 'Nombre d''appareils actifs autorises simultanement (2 par defaut).';
comment on column public.licenses.grace_until is 'Date limite de grace (offline_grace ou past_due_grace), calculee par verify-license.';

create index if not exists idx_licenses_subscription on public.licenses(subscription_id);

-- ============================================================================
-- 6. devices
-- ----------------------------------------------------------------------------
-- Un appareil = un device_id_hash (jamais un identifiant materiel brut,
-- voir deviceIdService cote Electron). Ecriture reservee aux Edge Functions
-- (verify-license pour l'enregistrement, deactivate-device pour la
-- desactivation) : aucune policy UPDATE cliente, une desactivation ne peut
-- donc se faire QUE via l'Edge Function deactivate-device, jamais par un
-- UPDATE SQL direct depuis l'application.
-- ============================================================================
create table if not exists public.devices (
  id              uuid primary key default gen_random_uuid(),
  license_id      uuid not null references public.licenses(id) on delete cascade,
  device_id_hash  text not null,
  label           text,
  platform        text,
  app_version     text,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  is_active       boolean not null default true,
  deactivated_at  timestamptz,
  updated_at      timestamptz not null default now(),
  unique (license_id, device_id_hash)
);
comment on table public.devices is 'Appareils actifs/inactifs par licence (max_devices actifs). Ecriture via Edge Functions uniquement.';

create index if not exists idx_devices_license        on public.devices(license_id);
create index if not exists idx_devices_id_hash         on public.devices(device_id_hash);

-- ============================================================================
-- 7. device_deactivation_events
-- ----------------------------------------------------------------------------
-- Journal d'evenements (append-only) servant a appliquer la limite de
-- 3 desactivations par periode de 30 jours glissants. Comptage fait a la
-- fois par l'Edge Function deactivate-device (pour renvoyer une erreur
-- propre a l'utilisateur) ET par un trigger DB (garde-fou, voir plus bas).
-- ============================================================================
create table if not exists public.device_deactivation_events (
  id              uuid primary key default gen_random_uuid(),
  license_id      uuid not null references public.licenses(id) on delete cascade,
  device_id_hash  text not null,
  deactivated_at  timestamptz not null default now()
);
comment on table public.device_deactivation_events is 'Journal des desactivations d''appareils (limite : 3 / 30 jours glissants par licence).';

create index if not exists idx_dde_license_time on public.device_deactivation_events(license_id, deactivated_at);
create index if not exists idx_dde_device_hash  on public.device_deactivation_events(device_id_hash);

-- ============================================================================
-- 8. license_checks
-- ----------------------------------------------------------------------------
-- Journal (append-only) de chaque verification de licence (en ligne, tous
-- les 7 jours normalement). Alimente exclusivement par l'Edge Function
-- verify-license. Utile pour le support et l'audit.
-- ============================================================================
create table if not exists public.license_checks (
  id              uuid primary key default gen_random_uuid(),
  license_id      uuid not null references public.licenses(id) on delete cascade,
  device_id_hash  text not null,
  app_version     text,
  result          text not null check (result in (
                     'ok', 'offline_grace', 'past_due_grace', 'restricted',
                     'expired', 'revoked', 'device_limit_reached', 'invalid_signature'
                   )),
  verified_at     timestamptz not null default now()
);
comment on table public.license_checks is 'Journal des verifications de licence (support/audit). Ecrit par verify-license uniquement.';

create index if not exists idx_license_checks_license_time on public.license_checks(license_id, verified_at);
create index if not exists idx_license_checks_device_hash  on public.license_checks(device_id_hash);

-- ============================================================================
-- 9. app_releases
-- ----------------------------------------------------------------------------
-- Notifications de mise a jour (V1 : notification uniquement, pas
-- d'auto-update obligatoire). Lecture publique des lignes actives.
-- ============================================================================
create table if not exists public.app_releases (
  id             uuid primary key default gen_random_uuid(),
  version        text not null,
  title          text not null,
  message        text not null,
  download_url   text,
  is_mandatory   boolean not null default false,
  active         boolean not null default true,
  published_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.app_releases is 'Notifications de nouvelle version. Lecture publique des lignes actives.';

create index if not exists idx_app_releases_active on public.app_releases(active);

-- ============================================================================
-- Trigger : creation automatique profil + organisation + licence a
-- l'inscription d'un nouvel utilisateur Supabase Auth (compte obligatoire).
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name, owner_user_id)
  values ('Mon cabinet', new.id)
  returning id into new_org_id;

  insert into public.profiles (user_id, organization_id)
  values (new.id, new_org_id);

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  -- Licence creee des l'inscription, statut 'restricted' par defaut
  -- (voir commentaire sur la table licenses).
  insert into public.licenses (organization_id, status)
  values (new_org_id, 'restricted');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- Triggers updated_at (generique, reutilise sur toutes les tables mutables)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_organizations on public.organizations;
create trigger set_updated_at_organizations
  before update on public.organizations
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_subscriptions on public.subscriptions;
create trigger set_updated_at_subscriptions
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_licenses on public.licenses;
create trigger set_updated_at_licenses
  before update on public.licenses
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_devices on public.devices;
create trigger set_updated_at_devices
  before update on public.devices
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_app_releases on public.app_releases;
create trigger set_updated_at_app_releases
  before update on public.app_releases
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Garde-fous metier au niveau base de donnees (defense en profondeur --
-- les Edge Functions doivent DEJA verifier ces regles pour renvoyer une
-- erreur propre a l'utilisateur ; ces triggers ne sont qu'un filet de
-- securite qui s'applique meme en cas de bug applicatif, y compris via
-- service_role qui contourne la RLS mais pas les triggers).
-- ============================================================================

-- Regle : max_devices appareils ACTIFS simultanement par licence.
create or replace function public.enforce_device_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_devices  integer;
  v_active_count integer;
begin
  -- Rien a verifier si l'appareil n'est pas (ou ne devient pas) actif,
  -- ou si son etat actif ne change pas lors d'un UPDATE (ex: heartbeat).
  if new.is_active = false then
    return new;
  end if;
  if TG_OP = 'UPDATE' and old.is_active = true and new.is_active = true then
    return new;
  end if;

  select max_devices into v_max_devices
  from public.licenses where id = new.license_id;

  select count(*) into v_active_count
  from public.devices
  where license_id = new.license_id
    and is_active = true
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_active_count >= coalesce(v_max_devices, 2) then
    raise exception 'Limite d''appareils actifs atteinte pour cette licence (max %)', v_max_devices;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_device_limit_trigger on public.devices;
create trigger enforce_device_limit_trigger
  before insert or update on public.devices
  for each row execute procedure public.enforce_device_limit();

-- Regle : 3 desactivations maximum par licence sur 30 jours glissants.
create or replace function public.enforce_deactivation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from public.device_deactivation_events
  where license_id = new.license_id
    and deactivated_at > now() - interval '30 days';

  if v_recent_count >= 3 then
    raise exception 'Limite de 3 desactivations d''appareils par periode de 30 jours glissants atteinte';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_deactivation_rate_limit_trigger on public.device_deactivation_events;
create trigger enforce_deactivation_rate_limit_trigger
  before insert on public.device_deactivation_events
  for each row execute procedure public.enforce_deactivation_rate_limit();

-- ============================================================================
-- Row Level Security
--
-- Principe : le client (Electron, cle anon + JWT utilisateur) ne peut que
-- LIRE ses propres donnees (via la fonction is_org_member()). Aucune
-- ecriture cliente sur subscriptions/licenses/devices/logs -- tout passe
-- par les Edge Functions en service_role.
-- ============================================================================

alter table public.organizations              enable row level security;
alter table public.profiles                    enable row level security;
alter table public.organization_members        enable row level security;
alter table public.subscriptions               enable row level security;
alter table public.licenses                    enable row level security;
alter table public.devices                     enable row level security;
alter table public.device_deactivation_events  enable row level security;
alter table public.license_checks              enable row level security;
alter table public.app_releases                enable row level security;

-- Fonction utilitaire : l'utilisateur courant appartient-il a cette organisation ?
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

-- organizations : lecture seule de ses propres organisations
drop policy if exists "select own organizations" on public.organizations;
create policy "select own organizations" on public.organizations
  for select using (public.is_org_member(id));

-- profiles : lecture et mise a jour de sa propre ligne uniquement
drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (user_id = auth.uid());

-- organization_members : lecture de ses propres appartenances
drop policy if exists "select own memberships" on public.organization_members;
create policy "select own memberships" on public.organization_members
  for select using (user_id = auth.uid());

-- subscriptions : lecture seule, aucune ecriture cliente
drop policy if exists "select own subscriptions" on public.subscriptions;
create policy "select own subscriptions" on public.subscriptions
  for select using (public.is_org_member(organization_id));

-- licenses : lecture seule, aucune ecriture cliente
drop policy if exists "select own licenses" on public.licenses;
create policy "select own licenses" on public.licenses
  for select using (public.is_org_member(organization_id));

-- devices : lecture seule (l'utilisateur voit ses appareils) ;
-- AUCUNE policy insert/update/delete -> une desactivation ne peut se faire
-- que via l'Edge Function deactivate-device (service_role).
drop policy if exists "select own devices" on public.devices;
create policy "select own devices" on public.devices
  for select using (
    exists (
      select 1 from public.licenses l
      where l.id = devices.license_id and public.is_org_member(l.organization_id)
    )
  );

-- device_deactivation_events : lecture seule
drop policy if exists "select own deactivation events" on public.device_deactivation_events;
create policy "select own deactivation events" on public.device_deactivation_events
  for select using (
    exists (
      select 1 from public.licenses l
      where l.id = device_deactivation_events.license_id and public.is_org_member(l.organization_id)
    )
  );

-- license_checks : lecture seule
drop policy if exists "select own license checks" on public.license_checks;
create policy "select own license checks" on public.license_checks
  for select using (
    exists (
      select 1 from public.licenses l
      where l.id = license_checks.license_id and public.is_org_member(l.organization_id)
    )
  );

-- app_releases : lecture publique des notifications actives
drop policy if exists "select active releases" on public.app_releases;
create policy "select active releases" on public.app_releases
  for select using (active = true);
