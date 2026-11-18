-- Insertion de la version 1.6.7 dans app_releases
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
  '1.6.7',
  'Synoria 1.6.7',
  'Synoria 1.6.7 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-11-18T12:00:00Z',
  '• Formulaire MTC : encadrés de traitement affichés selon la technique cochée, conseils diététiques, mise en forme (gras/italique) activée sur toutes les sections
• Calendrier : rendez-vous et blocs perso affichés côte à côte au lieu de se superposer, infobulle au survol avec les coordonnées du patient
• Factures : désignation modifiable sans information clinique pré-remplie, page de modification repensée
• Import de patients depuis Excel/CSV amélioré (accents, dates, doublons)',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
