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
  step?: number             // number (pas)
  width?: 'full' | 'half' | 'third'  // mise en page dans la grille
  visibleWhen?: PluginCondition[]   // affiche ce champ seulement si la condition est satisfaite
}

export interface PluginSection {
  id: string
  title: string
  icon?: string             // emoji ou caractère affiché avant le titre
  accentColor?: string      // couleur de la barre gauche du card
  fields: PluginField[]
  visibleWhen?: PluginCondition[]   // affiche cette section seulement si la condition est satisfaite
}

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
}
