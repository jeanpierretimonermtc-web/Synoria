-- Vue d'ensemble pour le dashboard Supabase :
-- joint auth.users (email) avec organizations, licenses et subscriptions.
-- Accessible depuis Table Editor → Views → member_overview.

create or replace view public.member_overview as
select
  u.email,
  u.id                          as user_id,
  u.created_at                  as account_created_at,
  o.id                          as org_id,
  o.name                        as org_name,
  l.status                      as license_status,
  l.grace_until,
  s.status                      as sub_status,
  s.plan_name,
  s.stripe_subscription_id,
  s.stripe_customer_id,
  s.trial_end,
  s.current_period_end,
  s.cancel_at_period_end
from auth.users u
left join public.organizations    o on o.owner_user_id = u.id
left join public.licenses         l on l.organization_id = o.id
left join public.subscriptions    s on s.organization_id = o.id
order by u.created_at desc;

comment on view public.member_overview is
  'Vue d''administration : email + état licence + abonnement par utilisateur. Lecture seule.';
