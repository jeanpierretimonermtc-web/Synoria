-- Insertion de la version 1.6.8 dans app_releases
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
  '1.6.8',
  'Synoria 1.6.8',
  'Synoria 1.6.8 est disponible.',
  'stable',
  'windows',
  true,
  false,
  '2026-11-26T15:18:00Z',
  '• Calendrier Google : le calendrier principal peut maintenant aussi être importé, même s''il sert déjà à l''export des RDV (vos RDV Synoria ne sont jamais dupliqués)
• La notification de mise à jour fonctionne désormais même sans compte connecté
• Page Patients : bouton pour copier en un clic les emails de la liste affichée
• Formulaires personnalisés : cases à cocher et affichage du pouls améliorés',
  'https://www.logiciel-synoria.fr/telechargement',
  null
)
ON CONFLICT DO NOTHING;
