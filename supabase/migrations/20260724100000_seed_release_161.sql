-- Insertion de la version 1.6.1 dans app_releases
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
  '1.6.1',
  'Synoria 1.6.1',
  'Synoria 1.6.1 est disponible.',
  'stable',
  'windows',
  true,
  false,
  now(),
  '• Correction de la synchronisation Google Calendar (OAuth)
• Amélioration de la stabilité générale',
  'https://logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
