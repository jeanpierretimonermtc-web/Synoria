-- Insertion de la version 1.6.2 dans app_releases

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
  '1.6.2',
  'Synoria 1.6.2',
  'Synoria 1.6.2 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-07-23T10:17:00Z',
  '• Correction SEO et URL canoniques sur la landing page
• Amélioration gestion des erreurs d''authentification (mot de passe oublié)',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
