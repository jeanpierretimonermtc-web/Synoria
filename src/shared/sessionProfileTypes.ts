/**
 * Types du Core Synoria et des profils de séance (Phase 3).
 *
 * Un « profil de séance » décrit COMMENT composer le formulaire d'une séance :
 *   - une base commune stable (le Core Synoria : motif, évolution, sécurité, résultat, suivi)
 *   - éventuellement un plugin de spécialité (MTC, ostéo, kinésio…)
 *   - une configuration (sections activées/désactivées, titres personnalisés, ordre)
 *   - un type de consultation (première consultation vs suivi)
 *
 * IMPORTANT : ces types sont ADDITIFS. Ils ne remplacent ni le format plugin
 * (`PluginDefinition`), ni le stockage SQLite existant. Un profil est une
 * *recette de composition*, pas un nouveau format de stockage de séance.
 */

import type { PluginSection, PluginField } from './pluginTypes'

// ── Core Synoria ────────────────────────────────────────────────────────────

/** Version logique du Core Synoria (structure des sections/champs communs). */
export const CORE_VERSION = '1.0.0'

/** Identifiant canonique du Core. */
export const CORE_DEFINITION_ID = 'synoria.core.session' as const

export interface SynoriaCoreSection {
  id: string
  title: string
  required: boolean         // ne peut jamais être désactivé (toujours dans le formulaire)
  canDisable: boolean       // peut être désactivé dans un profil
  icon?: string
  accentColor?: string
  /** Étape logique de placement dans le formulaire composé. */
  placement: 'context' | 'evolution' | 'safety' | 'outcome' | 'followup'
  /** Si true, section réservée aux consultations de type 'follow_up'. */
  followUpOnly?: boolean
  fields: PluginField[]     // champs avec dataKey stables
}

export interface SynoriaCoreDefinition {
  id: typeof CORE_DEFINITION_ID
  version: string
  sections: SynoriaCoreSection[]
}

// dataKey stables du Core (source de vérité : coreDefinition.ts) :
//   core.consultation_reason, core.consultation_type, core.patient_expectation
//   core.previous_session_evolution, core.new_symptoms, core.safety_checked
//   core.general_observations, core.outcome_before, core.outcome_after
//   core.advice, core.follow_up, core.next_appointment

// ── Configuration Core dans un profil ──────────────────────────────────────

export interface CoreSectionConfig {
  sectionId: string
  enabled: boolean
  customTitle?: string
  order?: number
  fieldOverrides?: Record<string, { enabled?: boolean; required?: boolean }>
}

export interface CoreProfileConfiguration {
  disabledSections: string[]
  customTitles: Record<string, string>
  sectionOrder: string[]
}

// ── Référence de module dans un profil ─────────────────────────────────────

export interface ProfileModuleReference {
  moduleId: string
  moduleVersion?: string
  enabled: boolean
  settings?: Record<string, unknown>
  order?: number
}

// ── Profil de séance ────────────────────────────────────────────────────────

export type ConsultationType = 'initial' | 'follow_up' | 'custom'

export interface SessionFormProfile {
  id: string
  name: string
  description?: string
  specialty: string
  consultationType: ConsultationType
  version: string
  coreVersion: string
  coreConfiguration: CoreProfileConfiguration
  pluginId?: string
  pluginVersion?: string
  /** true = le plugin référencé utilise le formulaire MTC intégré (legacy). */
  useBuiltinForm?: boolean
  enabledModules: ProfileModuleReference[]
  customSections?: PluginSection[]
  summaryTemplateId?: string
  isNative: boolean
  isDefault: boolean
  isArchived?: boolean
  legacySource?: 'active_plugin' | 'builtin_form'
  createdAt: string
  updatedAt: string
}

// ── Bibliothèque de profils ─────────────────────────────────────────────────

export interface ProfileLibrary {
  version: string                // version du format du fichier
  updatedAt: string
  profiles: SessionFormProfile[]
  migrationVersion?: number      // pour détecter si la migration legacy a eu lieu
}

/** Version courante du format de fichier profiles.json. */
export const PROFILE_LIBRARY_VERSION = '1.0.0'

/** Numéro de migration legacy : incrémenté quand la migration active-plugin a tourné. */
export const PROFILE_MIGRATION_VERSION = 1

// ── Formulaire composé (résultat de composeSessionForm) ────────────────────

export interface ComposedSessionFormDefinition {
  profileId: string
  profileVersion: string
  consultationType: ConsultationType
  coreVersion: string
  sections: ComposedFormSection[]
  pluginId?: string
  pluginVersion?: string
  composedAt: string
  /** Sections/champs omis volontairement (doublons, désactivation) — diagnostic. */
  omitted: ComposedOmission[]
}

export interface ComposedOmission {
  kind: 'section' | 'field'
  id: string
  reason: string
}

export interface ComposedFormSection {
  id: string
  title: string
  source: 'core' | 'plugin' | 'custom'
  required: boolean
  fields: PluginField[]
  accentColor?: string
  icon?: string
}
