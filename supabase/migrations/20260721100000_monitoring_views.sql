-- ============================================================================
-- Monitoring licence Synoria
-- Vues d'anomalies pour le tableau de bord Supabase + Edge Function anomaly-alert
-- ============================================================================

-- Vue 1 : vérifications suspectes des dernières 24h
-- device_limit_reached = tentative d'activer plus d'appareils qu'autorisé
-- invalid_signature    = falsification du jeton offline (tentative de piratage)
-- revoked              = utilisation d'une licence révoquée
create or replace view public.v_anomaly_checks as
select
  lc.verified_at,
  lc.result,
  lc.device_id_hash,
  lc.app_version,
  l.status      as license_status,
  o.name        as org_name,
  au.email      as user_email
from public.license_checks lc
join public.licenses      l  on l.id              = lc.license_id
join public.organizations o  on o.id              = l.organization_id
join public.profiles      p  on p.organization_id = o.id
join auth.users           au on au.id             = p.user_id
where lc.result in ('device_limit_reached', 'invalid_signature', 'revoked')
  and lc.verified_at > now() - interval '24 hours'
order by lc.verified_at desc;

comment on view public.v_anomaly_checks is
  'Vérifications de licence suspectes sur 24h — lecture service_role uniquement.';

-- Vue 2 : licences avec ≥ 3 nouveaux appareils en 24h (partage de compte potentiel)
create or replace view public.v_suspicious_devices as
select
  l.id          as license_id,
  l.status      as license_status,
  o.name        as org_name,
  au.email      as user_email,
  count(*)      as new_devices_24h
from public.devices       d
join public.licenses      l  on l.id              = d.license_id
join public.organizations o  on o.id              = l.organization_id
join public.profiles      p  on p.organization_id = o.id
join auth.users           au on au.id             = p.user_id
where d.first_seen_at > now() - interval '24 hours'
group by l.id, l.status, o.name, au.email
having count(*) >= 3;

comment on view public.v_suspicious_devices is
  'Licences avec ≥ 3 nouveaux appareils en 24h — partage de compte suspect.';

-- Vue 3 : tableau de bord global (utile dans le SQL Editor Supabase)
create or replace view public.v_license_dashboard as
select
  o.name                as org_name,
  au.email              as user_email,
  l.status              as license_status,
  l.max_devices,
  (select count(*) from public.devices d
   where d.license_id = l.id and d.is_active = true)   as active_devices,
  (select max(lc.verified_at) from public.license_checks lc
   where lc.license_id = l.id)                         as last_check_at,
  (select count(*) from public.license_checks lc
   where lc.license_id = l.id
     and lc.result in ('device_limit_reached', 'invalid_signature', 'revoked')
     and lc.verified_at > now() - interval '7 days')   as anomalies_7d,
  l.created_at
from public.licenses      l
join public.organizations o  on o.id              = l.organization_id
join public.profiles      p  on p.organization_id = o.id
join auth.users           au on au.id             = p.user_id
order by anomalies_7d desc, l.created_at desc;

comment on view public.v_license_dashboard is
  'Tableau de bord licences : vue d''ensemble avec anomalies 7 jours.';
