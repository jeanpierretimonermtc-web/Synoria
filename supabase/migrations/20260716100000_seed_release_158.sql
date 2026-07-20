-- Insertion de la version 1.5.8 dans app_releases
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
  '1.5.8',
  'Synoria 1.5.8',
  'Synoria 1.5.8 est disponible.',
  'stable',
  'windows',
  true,
  false,
  now(),
  '• Formulaire douleur avec numérotation correcte des sections et sommaire synchronisé
• Correction de l''erreur d''inscription (message vide lors des inscriptions désactivées)
• Renommage de l''application : Synoria (était "Synoria Dev")
• Ajout de la confirmation email obligatoire avec renvoi depuis l''écran de connexion
• Ajout des CGU et politique de confidentialité à l''inscription
• Migrations Supabase appliquées (vue member_overview, contrainte unique)',
  'https://logiciel-synoria.fr/telecharger',
  null
)
ON CONFLICT DO NOTHING;
