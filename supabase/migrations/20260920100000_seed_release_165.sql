-- Insertion de la version 1.6.5 dans app_releases
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
  '1.6.5',
  'Synoria 1.6.5',
  'Synoria 1.6.5 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-09-20T10:00:00Z',
  '• Formulaire Kinésiologie : nouvelle organisation (CEN/CEP, techniques, réactions post-séance, charges émotionnelles)
• Dossier PDF patient (MTC) : questionnaire par systèmes et tests énergétiques désormais inclus
• Séance précédente (MTC) : observation, questionnaire par systèmes et tests énergétiques désormais rappelés en totalité',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
