-- Insertion de la version 1.6.6 dans app_releases
-- Cette entrée déclenche la notification de mise à jour côté client.

INSERT INTO public.app_releases (
  version,
  title,
  message,
  channel,
  platform,
  is_active,
  is_required,
  published_at,
  release_notes,
  download_url,
  min_supported_version
)
VALUES (
  '1.6.6',
  'Synoria 1.6.6',
  'Synoria 1.6.6 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-11-02T19:00:00Z',
  '• Comptabilité : renommer ou re-tarifer un type de consultation / une charge fixe ne modifie plus les mois déjà enregistrés — seuls les nouveaux mois utilisent les nouvelles valeurs
• Abonnement : PayPal disponible en plus de la carte bancaire',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
