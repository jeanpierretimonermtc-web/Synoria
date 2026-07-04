-- ============================================================================
-- Synoria — Colonnes supplémentaires pour la désactivation d'appareils
--
-- Ajoute les champs de traçabilité manquants dans devices et
-- device_deactivation_events pour supporter device-deactivate v2.
-- ============================================================================

-- Colonne qui mémorise qui a désactivé l'appareil (user Supabase Auth)
alter table public.devices
  add column if not exists deactivated_by uuid references auth.users(id) on delete set null;

-- Raison de la désactivation (libre choix utilisateur)
alter table public.devices
  add column if not exists deactivation_reason text
    check (deactivation_reason in (
      'changement_ordinateur',
      'ancien_appareil',
      'erreur_activation',
      'autre'
    ));

-- Même info dans le journal des événements (source de vérité pour le rate-limit)
alter table public.device_deactivation_events
  add column if not exists reason text
    check (reason in (
      'changement_ordinateur',
      'ancien_appareil',
      'erreur_activation',
      'autre'
    ));

alter table public.device_deactivation_events
  add column if not exists deactivated_by uuid references auth.users(id) on delete set null;
