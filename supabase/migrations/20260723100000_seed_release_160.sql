-- Insertion de la version 1.6.0 dans app_releases
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
  '1.6.0',
  'Synoria 1.6.0',
  'Synoria 1.6.0 est disponible.',
  'stable',
  'windows',
  true,
  false,
  now(),
  '• Dictée vocale : bouton 🎤 sur tous les champs de notes — parlez, le texte s''insère automatiquement
• Formulaire de séance : carte "Info patient" affichant alertes, antécédents et médicaments en lecture seule
• Formulaire de séance : bouton "Modifier la fiche →" pour ouvrir directement la fiche patient
• Liste patients : badges 💊 Médicaments et 📋 Antécédents visibles sans ouvrir la fiche (tooltip au survol)',
  'https://logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
