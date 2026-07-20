/**
 * Bibliothèque de blocs métier prêts à l'emploi pour le PluginBuilder.
 *
 * Un bloc est un groupe préconfiguré de champs (PluginField[]) associé à un
 * titre de section proposé. Les ids de champs sont absents ici : ils sont
 * générés à l'insertion pour garantir l'unicité dans chaque formulaire.
 */

import type { PluginField } from './pluginTypes'

// ── Catégories ────────────────────────────────────────────────────────────────

export type BlockCategory =
  | 'general'
  | 'douleur'
  | 'suivi'
  | 'mtc'
  | 'osteo'
  | 'hygiene'
  | 'emotionnel'

export const BLOCK_CATEGORY_META: Record<BlockCategory, { label: string; icon: string; color: string }> = {
  general:    { label: 'Général',                    icon: '📋', color: '#3B82F6' },
  douleur:    { label: 'Douleur',                    icon: '🩹', color: '#DC2626' },
  suivi:      { label: 'Suivi',                      icon: '📈', color: '#0D9488' },
  mtc:        { label: 'MTC',                        icon: '☯️', color: '#7C3AED' },
  osteo:      { label: 'Ostéo / Thérapies manuelles', icon: '🦴', color: '#D97706' },
  hygiene:    { label: 'Hygiène de vie',              icon: '🌿', color: '#16A34A' },
  emotionnel: { label: 'Émotionnel / Stress',        icon: '🧘', color: '#EC4899' },
}

export const BLOCK_CATEGORY_ORDER: BlockCategory[] = [
  'general', 'douleur', 'suivi', 'hygiene', 'emotionnel', 'mtc', 'osteo',
]

// ── Type bloc ─────────────────────────────────────────────────────────────────

export interface PluginBlock {
  id:          string
  label:       string
  category:    BlockCategory
  description: string
  icon:        string
  specialty?:  string
  /** Titre proposé pour la nouvelle section */
  title:       string
  /** Champs sans id — les ids sont générés à l'insertion */
  fields:      Omit<PluginField, 'id'>[]
}

// ── Registre ──────────────────────────────────────────────────────────────────

export const PLUGIN_BLOCK_REGISTRY: readonly PluginBlock[] = [

  // ══ GÉNÉRAL ══════════════════════════════════════════════════════════════════

  {
    id: 'motif_consultation', label: 'Motif de consultation',
    category: 'general', icon: '🗣️',
    description: 'Plainte principale et motif de venue',
    title: 'Motif de consultation',
    fields: [
      { type: 'richtext', label: 'Motif de consultation',
        placeholder: 'Décrivez la plainte principale…', width: 'full' },
    ],
  },

  {
    id: 'antecedents', label: 'Antécédents',
    category: 'general', icon: '📚',
    description: 'Antécédents médicaux, chirurgicaux et familiaux',
    title: 'Antécédents',
    fields: [
      { type: 'richtext', label: 'Antécédents médicaux',
        placeholder: 'Pathologies connues, hospitalisations…', width: 'half' },
      { type: 'richtext', label: 'Antécédents chirurgicaux',
        placeholder: 'Interventions chirurgicales…', width: 'half' },
      { type: 'richtext', label: 'Antécédents familiaux',
        placeholder: 'Pathologies dans la famille…', width: 'full' },
    ],
  },

  {
    id: 'traitements_en_cours', label: 'Traitements en cours',
    category: 'general', icon: '💊',
    description: 'Médicaments, compléments et autres traitements',
    title: 'Traitements en cours',
    fields: [
      { type: 'richtext', label: 'Médicaments',
        placeholder: 'Nom, posologie, durée…', width: 'full' },
      { type: 'tags', label: 'Autres traitements en cours',
        placeholder: 'Kiné, ostéo, acupuncture…', width: 'full' },
    ],
  },

  {
    id: 'objectifs_patient', label: 'Objectifs patient',
    category: 'general', icon: '🎯',
    description: 'Objectifs du patient et attentes pour la prise en charge',
    title: 'Objectifs',
    fields: [
      { type: 'richtext', label: 'Objectifs du patient',
        placeholder: 'Ce que le patient souhaite améliorer…', width: 'full' },
      { type: 'richtext', label: 'Attentes pour cette séance',
        placeholder: 'Attentes immédiates…', width: 'full' },
    ],
  },

  // ══ DOULEUR ══════════════════════════════════════════════════════════════════

  {
    id: 'evaluation_douleur_simple', label: 'Évaluation douleur simple',
    category: 'douleur', icon: '🩹',
    description: 'Intensité, type, localisation et date de début',
    title: 'Évaluation de la douleur',
    fields: [
      { type: 'rating',   label: 'Intensité (0-10)',  min: 0, max: 10, width: 'half' },
      { type: 'select',   label: 'Type de douleur',   width: 'half',
        options: ['Aiguë', 'Chronique', 'Lancinante', 'Brûlure', 'Élancement', 'Pesanteur', 'Crampe'] },
      { type: 'select',   label: 'Côté atteint',      width: 'half',
        options: ['Gauche', 'Droit', 'Bilatéral', 'Central'] },
      { type: 'date',     label: 'Début des douleurs', width: 'half' },
      { type: 'richtext', label: 'Description',
        placeholder: 'Caractère, irradiations, rythme nycthéméral…', width: 'full' },
    ],
  },

  {
    id: 'localisation_bodychart', label: 'Localisation corporelle',
    category: 'douleur', icon: '🫀',
    description: 'Schéma du corps humain pour annoter les zones douloureuses',
    title: 'Localisation corporelle',
    fields: [
      { type: 'bodychart', label: 'Localisation des douleurs', width: 'full' },
    ],
  },

  {
    id: 'facteurs_aggravants', label: 'Facteurs aggravants / améliorants',
    category: 'douleur', icon: '⚖️',
    description: 'Ce qui aggrave ou améliore les douleurs',
    title: 'Facteurs modulant la douleur',
    fields: [
      { type: 'richtext', label: 'Facteurs aggravants',
        placeholder: 'Effort, froid, station debout, stress…', width: 'half' },
      { type: 'richtext', label: 'Facteurs améliorants',
        placeholder: 'Repos, chaleur, antalgiques, positions…', width: 'half' },
    ],
  },

  {
    id: 'limitation_fonctionnelle', label: 'Limitation fonctionnelle',
    category: 'douleur', icon: '🚶',
    description: 'Impact fonctionnel des douleurs sur les activités quotidiennes',
    title: 'Limitation fonctionnelle',
    fields: [
      { type: 'checkboxgroup', label: 'Activités limitées', width: 'full',
        options: ['Marche', 'Montée des escaliers', 'Conduite', 'Travail', 'Sommeil',
                  'Sport', 'Vie sexuelle', 'Tâches ménagères'] },
      { type: 'richtext', label: 'Impact sur la vie quotidienne',
        placeholder: 'Décrivez comment les douleurs affectent le quotidien…', width: 'full' },
    ],
  },

  // ══ SUIVI ════════════════════════════════════════════════════════════════════

  {
    id: 'evolution_depuis_derniere_seance', label: 'Évolution depuis dernière séance',
    category: 'suivi', icon: '📈',
    description: 'Ressenti du patient depuis la dernière consultation',
    title: 'Évolution',
    fields: [
      { type: 'radio', label: 'Évolution globale', width: 'full',
        options: ['Nette amélioration', 'Légère amélioration', 'Stable', 'Légère aggravation', 'Aggravation'] },
      { type: 'richtext', label: 'Détails',
        placeholder: 'Commentaire du patient sur son évolution…', width: 'full' },
    ],
  },

  {
    id: 'traitement_realise', label: 'Traitement réalisé',
    category: 'suivi', icon: '🩺',
    description: 'Description du traitement effectué en séance',
    title: 'Traitement réalisé',
    fields: [
      { type: 'richtext', label: 'Traitement réalisé',
        placeholder: 'Décrivez le traitement effectué…', width: 'full' },
      { type: 'tags', label: 'Techniques utilisées',
        placeholder: 'Ajoutez une technique et appuyez sur Entrée…', width: 'full' },
    ],
  },

  {
    id: 'conseils_donnes', label: 'Conseils donnés',
    category: 'suivi', icon: '💬',
    description: 'Conseils et recommandations transmis au patient',
    title: 'Conseils',
    fields: [
      { type: 'richtext', label: 'Conseils donnés',
        placeholder: 'Recommandations, postures, hygiène…', width: 'half' },
      { type: 'richtext', label: 'Exercices prescrits',
        placeholder: 'Exercices à faire à domicile…', width: 'half' },
    ],
  },

  {
    id: 'objectif_prochaine_seance', label: 'Objectif prochaine séance',
    category: 'suivi', icon: '🔜',
    description: 'Plan et objectif pour la prochaine consultation',
    title: 'Prochaine séance',
    fields: [
      { type: 'richtext', label: 'Objectif de la prochaine séance',
        placeholder: 'Ce que vous prévoyez de travailler…', width: 'full' },
    ],
  },

  // ══ HYGIÈNE DE VIE ═══════════════════════════════════════════════════════════

  {
    id: 'hygiene_sommeil', label: 'Sommeil',
    category: 'hygiene', icon: '😴',
    description: 'Qualité et quantité du sommeil, troubles associés',
    title: 'Sommeil',
    fields: [
      { type: 'rating', label: 'Qualité du sommeil', min: 0, max: 10, width: 'half' },
      { type: 'number', label: 'Durée moyenne (heures)', min: 0, max: 24, width: 'half' },
      { type: 'checkboxgroup', label: 'Troubles du sommeil', width: 'full',
        options: ["Insomnie d'endormissement", 'Réveils nocturnes', 'Réveil précoce',
                  'Sommeil non réparateur', 'Cauchemars', 'Apnée du sommeil'] },
      { type: 'richtext', label: 'Observations',
        placeholder: 'Précisions sur le sommeil…', width: 'full' },
    ],
  },

  {
    id: 'hygiene_digestion', label: 'Digestion',
    category: 'hygiene', icon: '🌀',
    description: 'Transit, digestion et troubles digestifs associés',
    title: 'Digestion',
    fields: [
      { type: 'radio', label: 'Transit', width: 'half',
        options: ['Normal', 'Constipé', 'Diarrhéique', 'Alternant'] },
      { type: 'checkboxgroup', label: 'Troubles digestifs', width: 'full',
        options: ['Ballonnements', 'Flatulences', 'Douleurs abdominales', 'Nausées',
                  'Reflux gastrique', 'Brûlures', 'Sensibilités alimentaires'] },
      { type: 'richtext', label: 'Observations',
        placeholder: 'Précisions sur la digestion, habitudes alimentaires…', width: 'full' },
    ],
  },

  {
    id: 'hygiene_stress', label: 'Stress / émotionnel',
    category: 'hygiene', icon: '🧘',
    description: 'Niveau de stress, énergie et facteurs émotionnels',
    title: 'Stress et émotions',
    fields: [
      { type: 'rating', label: 'Niveau de stress',  min: 0, max: 10, width: 'half' },
      { type: 'rating', label: "Niveau d'énergie", min: 0, max: 10, width: 'half' },
      { type: 'richtext', label: 'Facteurs de stress',
        placeholder: 'Sources de stress, tensions, anxiétés…', width: 'half' },
      { type: 'richtext', label: 'Ressources et soutiens',
        placeholder: 'Ce qui aide, les soutiens disponibles…', width: 'half' },
    ],
  },

  {
    id: 'hygiene_activite_physique', label: 'Activité physique',
    category: 'hygiene', icon: '🏃',
    description: 'Fréquence, type et contexte de la pratique sportive',
    title: 'Activité physique',
    fields: [
      { type: 'select', label: "Fréquence d'activité", width: 'half',
        options: ['Sédentaire', '1 fois/semaine', '2-3 fois/semaine', '4-5 fois/semaine', 'Quotidienne'] },
      { type: 'tags', label: 'Sports pratiqués',
        placeholder: 'Ajoutez un sport…', width: 'half' },
      { type: 'richtext', label: 'Observations',
        placeholder: 'Contraintes, blessures récentes, motivations…', width: 'full' },
    ],
  },

  // ══ ÉMOTIONNEL / STRESS ═══════════════════════════════════════════════════════

  {
    id: 'emotionnel_ressenti', label: 'Ressenti émotionnel',
    category: 'emotionnel', icon: '💭',
    description: 'État émotionnel global et émotions présentement ressenties',
    title: 'Ressenti émotionnel',
    fields: [
      { type: 'checkboxgroup', label: 'Émotions ressenties', width: 'full',
        options: ['Tristesse', 'Anxiété', 'Colère', 'Peur', 'Joie', 'Fatigue émotionnelle',
                  'Sentiment de vide', 'Culpabilité', 'Solitude', 'Espoir'] },
      { type: 'richtext', label: "État émotionnel général",
        placeholder: 'Comment vous sentez-vous en ce moment ?…', width: 'full' },
    ],
  },

  {
    id: 'emotionnel_anxiete', label: 'Anxiété et pensées',
    category: 'emotionnel', icon: '🌀',
    description: 'Ruminations, inquiétudes et schémas de pensées',
    title: 'Anxiété et pensées',
    fields: [
      { type: 'rating', label: "Niveau d'anxiété", min: 0, max: 10, width: 'half' },
      { type: 'radio', label: 'Fréquence des ruminations', width: 'half',
        options: ['Rarement', 'Parfois', 'Souvent', 'Constamment'] },
      { type: 'richtext', label: 'Thèmes des inquiétudes',
        placeholder: 'Ce qui préoccupe, les pensées récurrentes…', width: 'full' },
    ],
  },

  {
    id: 'emotionnel_gestion_stress', label: 'Gestion du stress',
    category: 'emotionnel', icon: '🛡️',
    description: 'Stratégies de coping et ressources mobilisées',
    title: 'Gestion du stress',
    fields: [
      { type: 'checkboxgroup', label: 'Stratégies utilisées', width: 'full',
        options: ['Méditation / pleine conscience', 'Respiration', 'Sport', 'Nature',
                  'Soutien social', 'Créativité', 'Lecture', 'Musique', 'Thérapie'] },
      { type: 'richtext', label: 'Ce qui aide',
        placeholder: 'Ce qui fonctionne pour vous…', width: 'half' },
      { type: 'richtext', label: 'Ce qui est difficile',
        placeholder: 'Les obstacles, les déclencheurs…', width: 'half' },
    ],
  },

  // ══ MTC ══════════════════════════════════════════════════════════════════════

  {
    id: 'mtc_diagnostic_energetique', label: 'Diagnostic énergétique simple',
    category: 'mtc', icon: '☯️', specialty: 'MTC',
    description: 'Diagnostic TCM et syndromes identifiés',
    title: 'Diagnostic énergétique',
    fields: [
      { type: 'richtext', label: 'Diagnostic énergétique',
        placeholder: 'Vide de Yin, Stase de Sang, Plénitude de Foie…', width: 'full' },
      { type: 'tags', label: 'Syndromes identifiés',
        placeholder: 'Ajoutez un syndrome TCM…', width: 'full' },
    ],
  },

  {
    id: 'mtc_principe_traitement', label: 'Principe de traitement',
    category: 'mtc', icon: '📌', specialty: 'MTC',
    description: 'Stratégie thérapeutique et principe de traitement TCM',
    title: 'Principe de traitement',
    fields: [
      { type: 'richtext', label: 'Principe de traitement',
        placeholder: 'Tonifier le Qi, Disperser la Chaleur, Harmoniser le Foie…', width: 'full' },
    ],
  },

  {
    id: 'mtc_points_utilises', label: 'Points utilisés',
    category: 'mtc', icon: '🔵', specialty: 'MTC',
    description: "Points d'acupuncture traités et observations de séance",
    title: 'Points traités',
    fields: [
      { type: 'tags', label: "Points d'acupuncture",
        placeholder: 'Ex : 36E, 6RT, 3Rte, 4GI…', width: 'full' },
      { type: 'richtext', label: 'Observations',
        placeholder: 'Sensations, réactions, effets observés…', width: 'full' },
    ],
  },

  {
    id: 'mtc_conseils_hygienodietiques', label: 'Conseils hygiéno-diététiques',
    category: 'mtc', icon: '🌿', specialty: 'MTC',
    description: 'Conseils alimentaires et de mode de vie selon la TCM',
    title: 'Conseils hygiéno-diététiques',
    fields: [
      { type: 'richtext', label: 'Conseils alimentaires',
        placeholder: 'Aliments à favoriser ou éviter selon la TCM…', width: 'half' },
      { type: 'richtext', label: 'Conseils de vie',
        placeholder: 'Rythme, sommeil, activité adaptée à la saison…', width: 'half' },
    ],
  },

  // ══ OSTÉO ════════════════════════════════════════════════════════════════════

  {
    id: 'osteo_tests_simples', label: 'Tests cliniques',
    category: 'osteo', icon: '🦴', specialty: 'Ostéo',
    description: 'Tests orthopédiques saisis dynamiquement par le praticien',
    title: 'Tests cliniques',
    fields: [
      { type: 'osteo_ortho_tests', label: 'Tests orthopédiques', width: 'full' },
    ],
  },

  {
    id: 'osteo_bilan_postural', label: 'Bilan postural',
    category: 'osteo', icon: '🧍', specialty: 'Ostéo',
    description: 'Bilan postural en 4 vues anatomiques avec observations cochables',
    title: 'Bilan postural',
    fields: [
      { type: 'osteo_posture', label: 'Bilan postural', width: 'full' },
    ],
  },

  {
    id: 'osteo_techniques_utilisees', label: 'Techniques utilisées',
    category: 'osteo', icon: '🤲', specialty: 'Ostéo',
    description: 'Techniques ostéopathiques réalisées et régions traitées',
    title: 'Techniques',
    fields: [
      { type: 'checkboxgroup', label: 'Techniques utilisées', width: 'full',
        options: ['Mobilisation articulaire', 'Manipulation HVBA', 'Techniques myofasciales',
                  'Techniques crâniennes', 'Techniques viscérales', 'Pompes lymphatiques',
                  'Techniques tissulaires', 'Techniques fonctionnelles'] },
      { type: 'richtext', label: 'Régions traitées et résultats',
        placeholder: 'Zones traitées, adaptations, trouvailles cliniques…', width: 'full' },
    ],
  },

  {
    id: 'osteo_exercices_conseilles', label: 'Exercices conseillés',
    category: 'osteo', icon: '🏋️', specialty: 'Ostéo',
    description: 'Exercices prescrits et conseils posturaux pour le patient',
    title: 'Exercices et conseils',
    fields: [
      { type: 'richtext', label: 'Exercices prescrits',
        placeholder: 'Description, répétitions, fréquence…', width: 'half' },
      { type: 'richtext', label: 'Conseils posturaux',
        placeholder: 'Ergonomie, postures à éviter, adaptations…', width: 'half' },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getBlocksByCategory(category: BlockCategory): PluginBlock[] {
  return PLUGIN_BLOCK_REGISTRY.filter(b => b.category === category) as PluginBlock[]
}
