/**
 * Format de définition d'un plugin de formulaire.
 *
 * Un plugin décrit l'anamnèse d'une spécialité thérapeutique.
 * Il est stocké dans userData/active.plugin.json.
 * Le moteur PluginFormRenderer lit ce fichier et génère le formulaire.
 *
 * Types de champs supportés :
 *   text         → saisie texte court
 *   textarea     → texte multilignes (plain text)
 *   richtext     → texte enrichi (gras, italique, couleurs…)
 *   number       → valeur numérique
 *   date         → sélecteur de date
 *   select       → liste déroulante
 *   radio        → boutons radio (choix unique, options cliquables)
 *   checkbox     → case à cocher booléenne
 *   checkboxgroup → cases à cocher multiples
 *   tags         → étiquettes libres (saisir + Entrée)
 *   rating       → échelle numérique cliquable (ex : 0-10)
 *   bodychart    → schéma corporel antérieur/postérieur avec zones cliquables
 *   separator    → séparateur visuel (pas de donnée)
 *   slider       → curseur visuel (douleur, stress, fatigue, sommeil)
 *   before_after → deux curseurs : valeur avant et valeur après séance
 *   repeatable   → liste de lignes nom + note, extensible à la volée
 */

export type PluginFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkboxgroup'
  | 'tags'
  | 'rating'
  | 'bodychart'
  | 'separator'
  | 'slider'
  | 'before_after'
  | 'repeatable'
  // ── Modules MTC ──────────────────────────────────────────────────────────────
  | 'mtc_systemes'            // Questionnaire des systèmes (Questions à poser)
  | 'mtc_five_elements'       // Roue des 5 éléments — référence + annotation
  | 'mtc_tongue_pulse'        // Langue et Pouls — diagnostic MTC
  | 'mtc_aide_interrogatoire' // Pense-bête questions MTC (display-only, pas de données)
  // ── Modules Ostéo ────────────────────────────────────────────────────────────
  | 'osteo_ortho_tests'  // Tests orthopédiques — liste dynamique saisie praticien
  | 'osteo_posture'      // Bilan postural — 4 vues avec observations cochables

export type PluginConditionOperator =
  | 'eq'
  | 'neq'
  | 'includes'
  | 'excludes'
  | 'truthy'
  | 'falsy'

export interface PluginCondition {
  fieldId: string
  operator?: PluginConditionOperator
  value?: string | number | boolean | Array<string | number | boolean>
}

export interface PluginField {
  id: string
  type: PluginFieldType
  label: string
  placeholder?: string
  required?: boolean
  hint?: string             // Info-bulle ou texte d'aide sous le champ
  minHeight?: number        // textarea / richtext
  options?: string[]        // select / radio / checkboxgroup
  min?: number              // number / rating
  max?: number              // number / rating
  step?: number             // number / slider / before_after (pas)
  width?: 'full' | 'half' | 'third'  // mise en page dans la grille
  visibleWhen?: PluginCondition[]   // affiche ce champ seulement si la condition est satisfaite
  settings?: Record<string, unknown> // paramètres spécifiques au type (extensibilité future)
  /** Contrôle l'apparence dans le résumé de séance */
  summary?: {
    include?: boolean   // false = ne pas afficher dans le résumé (défaut : true)
    priority?: number   // ordre d'affichage (plus petit = plus haut)
    label?: string      // label alternatif dans le résumé
  }
  /** Contrôle l'inclusion dans les exports et la recherche */
  export?: {
    patientReport?: boolean  // false = exclure du rapport patient (défaut : true)
    excel?: boolean          // false = exclure de l'export Excel (défaut : true)
    searchable?: boolean     // false = exclure de la recherche globale (défaut : true)
  }
  // ── Métadonnées canoniques (Phase 1 — toutes optionnelles, rétrocompatibles) ──
  /** Clé fonctionnelle stable, indépendante de l'id technique. Ex : "douleur.intensite".
   *  Si absente, un dataKey est généré à la normalisation (custom.<formId>.<fieldId>). */
  dataKey?: string
  /** Version du champ — utile pour tracer les évolutions de sémantique. */
  version?: string
  /** Cycle de vie du champ. 'deprecated' = conservé pour l'historique, masqué à la saisie. */
  status?: 'active' | 'deprecated'
  /** Regroupement logique dans le résumé (ex : "Douleur", "Suivi"). */
  summaryGroup?: string
  /** Libellé alternatif dans le résumé (équivalent moderne de summary.label). */
  summaryLabel?: string
  /** Ordre d'affichage dans le résumé (plus petit = plus haut). */
  summaryPriority?: number
  /** Si true, le champ est totalement omis du résumé/export quand il est vide. */
  omitWhenEmpty?: boolean
}

/**
 * Contrôle la position de rendu d'une section dans le formulaire NewSessionPage.
 * Par défaut (absent ou 'notes'), la section s'affiche dans le bloc "Notes de séance".
 *   'pre-motif'        → carte standalone avant le bloc Motif
 *   'motif'            → remplace le bloc core "Motif de consultation"
 *   'notes'            → intérieur du bloc "Notes de séance" (défaut)
 *   'traitement'       → carte standalone remplaçant le bloc core "Traitement effectué"
 *   'traitement-inner' → ajouté à l'intérieur du bloc core "Traitement effectué"
 *   'plan'             → ajouté à l'intérieur du bloc core "Plan de suivi"
 */
export type PluginSectionPlacement =
  | 'pre-motif'
  | 'motif'
  | 'notes'
  | 'traitement'
  | 'traitement-inner'
  | 'plan'

export interface PluginSection {
  id: string
  title: string
  icon?: string             // emoji ou caractère affiché avant le titre
  accentColor?: string      // couleur de la barre gauche du card
  fields: PluginField[]
  visibleWhen?: PluginCondition[]   // affiche cette section seulement si la condition est satisfaite
  placement?: PluginSectionPlacement  // position dans le formulaire (défaut : 'notes')
}

export type PluginCategory =
  | 'general'
  | 'mtc'
  | 'osteo'
  | 'kinesio'
  | 'naturo'
  | 'manual_therapy'
  | 'custom'

export type PluginStatus = 'draft' | 'active' | 'archived'

export interface PluginDefinition {
  id: string                // identifiant unique (ex : "kinesio", "osteo")
  name: string              // nom affiché dans l'interface
  specialty: string         // intitulé de la spécialité
  version: string           // numéro de version du plugin
  author?: string
  description?: string
  icon?: string             // emoji affiché dans les en-têtes
  accentColor?: string      // couleur principale du plugin
  useBuiltinForm?: boolean  // si true : utilise le formulaire MTC intégré complet
  sections: PluginSection[]
  // ── Métadonnées de schéma (optionnelles, rétrocompatibles) ──────────────────
  schemaVersion?: number        // absent ou 1 = format initial ; incrémenté si le format évolue
  category?: PluginCategory     // famille thérapeutique
  tags?: string[]               // mots-clés libres pour la recherche
  synoriaMinVersion?: string    // version minimale de Synoria requise (ex : "1.4.0")
  status?: PluginStatus         // cycle de vie du formulaire
  createdAt?: string            // ISO 8601 — date de première création
  updatedAt?: string            // ISO 8601 — date de dernière modification
  isNative?: boolean            // true = formulaire officiel Synoria, protégé contre l'écrasement
  hideGlobalMotif?: boolean     // true = masque la section "Motif" globale (déjà couverte par le plugin)
  showGlobalReactions?: boolean // true = affiche le bloc "Résultats & Réactions" même quand le plugin a un bloc traitement standalone
}
