-- Insertion de la version 1.6.9 dans app_releases
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
  '1.6.9',
  'Synoria 1.6.9',
  'Synoria 1.6.9 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-11-26T16:12:00Z',
  '• Page Patients : correction de la copie des emails dans le presse-papiers, qui pouvait échouer silencieusement',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
