-- Comptes propriétaire Synoria — accès illimité permanent.
-- Ces comptes bypassent également la Edge Function license-check (OWNER_EMAILS).
-- max_devices = 99 pour éviter tout blocage multi-appareil.

UPDATE public.licenses l
SET
  status      = 'active',
  max_devices = 99
WHERE organization_id IN (
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE u.email IN (
    'jeanpierre.timoner.mtc@gmail.com',
    'jean-pierre.timoner@wanadoo.fr'
  )
);
