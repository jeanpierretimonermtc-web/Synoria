-- Ajoute la contrainte UNIQUE manquante sur subscriptions.organization_id.
-- Sans elle, le upsert ON CONFLICT (organization_id) échoue avec
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification",
-- empêchant stripe-webhook de créer/mettre à jour les lignes de subscription.

alter table public.subscriptions
  add constraint subscriptions_organization_id_key unique (organization_id);
