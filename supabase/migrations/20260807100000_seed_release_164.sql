-- Insertion de la version 1.6.4 dans app_releases
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
  '1.6.4',
  'Synoria 1.6.4',
  'Synoria 1.6.4 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-08-07T10:00:00Z',
  '• Brouillon séance (P0) : modifications en mode édition sauvegardées automatiquement, conservées 24h, avertissement si navigation sans sauvegarder
• Notification de mise à jour : vérification dès l''ouverture de l''app (plus d''attente de 12h)',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
