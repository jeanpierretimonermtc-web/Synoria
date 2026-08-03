-- Insertion de la version 1.6.3 dans app_releases
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
  '1.6.3',
  'Synoria 1.6.3',
  'Synoria 1.6.3 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-07-29T15:29:30Z',
  '• Comptabilisation RDV du mois : seuls les RDV actifs sont comptés
• Calendrier : les blocs perso/indispo ne masquent plus les rendez-vous Synoria
• Dashboard : bouton "Créer fiche patient" depuis les lignes invités dans "Prochains RDV"',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
