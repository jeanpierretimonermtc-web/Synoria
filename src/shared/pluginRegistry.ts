/**
 * Registre central des types de champs et modules du système de plugins.
 *
 * Ajouter un nouveau type = ajouter une entrée ici.
 * Les consommateurs (builder, validateur, export) dérivent leur propre
 * liste filtrée depuis ce registre, plutôt que de la maintenir localement.
 */

import type { PluginFieldType } from './pluginTypes'

export interface PluginTypeEntry {
  type:        PluginFieldType
  label:       string
  icon:        string
  color:       string
  desc:        string
  isModule:    boolean
  isSeparator: boolean
  hasOptions:  boolean  // select, radio, checkboxgroup
  hasRange:    boolean  // number, rating
  specialty?:  string   // modules uniquement : 'MTC' | 'Ostéo'
}

export const PLUGIN_TYPE_REGISTRY: readonly PluginTypeEntry[] = [

  // ── Champs texte ─────────────────────────────────────────────────────────
  { type: 'text',          label: 'Texte court',              icon: '📝', color: '#3B82F6',
    desc: 'Une ligne — ex : Nom, Médicament, Localisation',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'textarea',      label: 'Zone de texte',            icon: '📄', color: '#3B82F6',
    desc: 'Plusieurs lignes — ex : Anamnèse, Observations',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'richtext',      label: 'Texte enrichi',            icon: '✍️', color: '#3B82F6',
    desc: 'Avec mise en forme (gras, italique, couleurs)',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  // ── Champs numériques / dates ─────────────────────────────────────────────
  { type: 'number',        label: 'Nombre',                   icon: '🔢', color: '#D97706',
    desc: 'Valeur numérique — ex : Poids, Tension artérielle',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: true },

  { type: 'date',          label: 'Date',                     icon: '📅', color: '#D97706',
    desc: 'Sélecteur de date — ex : Début des douleurs',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  // ── Champs à choix ────────────────────────────────────────────────────────
  { type: 'select',        label: 'Liste déroulante',         icon: '▼',  color: '#7C3AED',
    desc: 'Menu avec un seul choix — ex : Côté, Intensité',
    isModule: false, isSeparator: false, hasOptions: true,  hasRange: false },

  { type: 'radio',         label: 'Choix unique (boutons)',   icon: '⚪', color: '#7C3AED',
    desc: 'Options cliquables, un seul choix — ex : Oui / Non',
    isModule: false, isSeparator: false, hasOptions: true,  hasRange: false },

  { type: 'checkbox',      label: 'Case à cocher (oui/non)',  icon: '☑️', color: '#7C3AED',
    desc: 'Booléen — ex : Fumeur, Allergie, Contre-indication',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'checkboxgroup', label: 'Cases à cocher multiples', icon: '☑',  color: '#7C3AED',
    desc: 'Plusieurs réponses — ex : Symptômes présents, Zones',
    isModule: false, isSeparator: false, hasOptions: true,  hasRange: false },

  // ── Champs spéciaux ───────────────────────────────────────────────────────
  { type: 'tags',          label: 'Étiquettes libres',        icon: '🏷️', color: '#0D9488',
    desc: 'Saisie + Entrée — ex : Mots-clés, Points traités',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'rating',        label: 'Échelle numérique',        icon: '⭐', color: '#0D9488',
    desc: 'Clic sur une valeur dans une plage — ex : Douleur 0 à 10',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: true },

  { type: 'bodychart',     label: 'Schéma corporel',          icon: '🫀', color: '#6F7F8F',
    desc: 'Schéma du corps humain — annoter des zones anatomiques',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'separator',     label: 'Séparateur visuel',        icon: '—',  color: '#9CA3AF',
    desc: 'Ligne de séparation sans donnée — pour aérer le formulaire',
    isModule: false, isSeparator: true,  hasOptions: false, hasRange: false },

  // ── Champs interactifs avancés ────────────────────────────────────────────
  { type: 'slider',        label: 'Curseur',                  icon: '🎚️', color: '#0D9488',
    desc: 'Échelle visuelle — douleur, stress, fatigue, sommeil',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: true },

  { type: 'before_after',  label: 'Avant / Après',            icon: '↔️', color: '#3B82F6',
    desc: 'Comparaison avant et après séance — deux curseurs',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: true },

  { type: 'repeatable',    label: 'Liste répétable',          icon: '📋', color: '#7C3AED',
    desc: 'Liste structurée — tests, points, exercices, objectifs',
    isModule: false, isSeparator: false, hasOptions: false, hasRange: false },

  // ── Modules MTC ───────────────────────────────────────────────────────────
  { type: 'mtc_systemes',      label: 'Questionnaire Systèmes', icon: '📋', color: '#6a47c4',
    specialty: 'MTC',
    desc: 'Interrogatoire complet des systèmes (cardiaque, pulmonaire, mental, digestif…)',
    isModule: true, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'mtc_five_elements', label: '5 Éléments',             icon: '☯️', color: '#6a47c4',
    specialty: 'MTC',
    desc: 'Tableau de référence des 5 Éléments avec annotation des éléments concernés',
    isModule: true, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'mtc_tongue_pulse',  label: 'Langue & Pouls',         icon: '🌡️', color: '#6a47c4',
    specialty: 'MTC',
    desc: 'Diagnostic Langue (couleur, enduit, forme) et Pouls (6 positions, 29 qualités)',
    isModule: true, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'mtc_aide_interrogatoire', label: 'Pense-bête interrogatoire', icon: '📌', color: '#C17B2A',
    specialty: 'MTC',
    desc: 'Panneau aide-mémoire des questions MTC (display seul, sans données) — à placer à droite d\'un champ texte en ½ largeur',
    isModule: true, isSeparator: false, hasOptions: false, hasRange: false },

  // ── Modules Ostéo ─────────────────────────────────────────────────────────
  { type: 'osteo_ortho_tests', label: 'Tests Orthopédiques',    icon: '🦴', color: '#0D9488',
    specialty: 'Ostéo',
    desc: 'Liste de tests saisis par le praticien avec résultat Positif / Négatif',
    isModule: true, isSeparator: false, hasOptions: false, hasRange: false },

  { type: 'osteo_posture',     label: 'Bilan Postural',         icon: '🧍', color: '#0D9488',
    specialty: 'Ostéo',
    desc: 'Bilan postural 4 vues (ANT/POST/GAU/DRO) avec observations cochables',
    isModule: true, isSeparator: false, hasOptions: false, hasRange: false },
]

// ── Index par type pour accès O(1) ───────────────────────────────────────────

const _index = new Map<PluginFieldType, PluginTypeEntry>(
  PLUGIN_TYPE_REGISTRY.map(e => [e.type, e])
)

// ── Helpers dérivés ───────────────────────────────────────────────────────────

/** Entrée complète pour un type donné, ou undefined si inconnu. */
export function getTypeEntry(type: PluginFieldType): PluginTypeEntry | undefined {
  return _index.get(type)
}

/** Liste de tous les types valides — source de vérité pour la validation à l'import. */
export const VALID_PLUGIN_TYPES: readonly PluginFieldType[] =
  PLUGIN_TYPE_REGISTRY.map(e => e.type)

export function pluginTypeHasOptions(type: PluginFieldType): boolean {
  return _index.get(type)?.hasOptions ?? false
}

export function pluginTypeHasRange(type: PluginFieldType): boolean {
  return _index.get(type)?.hasRange ?? false
}

export function isPluginModule(type: PluginFieldType): boolean {
  return _index.get(type)?.isModule ?? false
}

export function pluginTypeColor(type: PluginFieldType): string {
  return _index.get(type)?.color ?? '#9CA3AF'
}
