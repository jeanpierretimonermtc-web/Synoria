/**
 * Définition du Core Synoria v1.0.0 (Phase 3).
 *
 * Le Core Synoria est le socle commun de TOUTE séance, indépendamment de la
 * spécialité. Il regroupe les champs génériques déjà présents dans l'application
 * (motif, évolution, observation, conseils, plan, prochain RDV…) sous des
 * `dataKey` stables et versionnés.
 *
 * Correspondance stockage :
 *   - `field.id`      = clé de stockage EXISTANTE (colonne SQL sessions OU clé de
 *                       full_data_json). Ne rien inventer : ces ids existent déjà
 *                       dans NewSessionPage.tsx / migrations.ts / types.ts.
 *   - `field.dataKey` = clé fonctionnelle stable, indépendante du stockage.
 *
 * Ainsi le Core se superpose au stockage historique sans le modifier : aucune
 * migration SQLite, aucune perte de données. La composition (sessionFormComposer)
 * consomme cette définition pour produire le formulaire final.
 */

import type { PluginField } from './pluginTypes'
import {
  CORE_VERSION,
  CORE_DEFINITION_ID,
  type SynoriaCoreDefinition,
  type SynoriaCoreSection,
} from './sessionProfileTypes'

// ── Sections ────────────────────────────────────────────────────────────────

/**
 * 1. Contexte — toujours présent (motif, type de consultation, attentes).
 *    `id: 'motif'`  → colonne sessions.motif
 *    `id: 'simpleObjectifs'` → full_data_json.simpleObjectifs (attentes du patient)
 */
const sectionContext: SynoriaCoreSection = {
  id: 'core.section.context',
  title: 'Contexte de consultation',
  required: true,
  canDisable: false,
  icon: '🎯',
  accentColor: '#D97706',
  placement: 'context',
  fields: [
    {
      id: 'motif',
      type: 'richtext',
      label: 'Motif de consultation',
      dataKey: 'core.consultation_reason',
      version: CORE_VERSION,
      minHeight: 80,
      placeholder: 'Demande du patient, attentes, priorité du jour…',
    },
    {
      id: 'consultationType',
      type: 'select',
      label: 'Type de consultation',
      dataKey: 'core.consultation_type',
      version: CORE_VERSION,
      options: ['Première consultation', 'Suivi'],
      width: 'half',
    },
    {
      id: 'simpleObjectifs',
      type: 'richtext',
      label: 'Attentes / objectifs du patient',
      dataKey: 'core.patient_expectation',
      version: CORE_VERSION,
      minHeight: 60,
      omitWhenEmpty: true,
    },
  ],
}

/**
 * 2. Évolution — consultations de suivi uniquement.
 *    `id: 'evolution'`      → colonne sessions.evolution
 *    `id: 'problematiques'` → colonne sessions.problematiques (nouveaux symptômes / terrain)
 */
const sectionEvolution: SynoriaCoreSection = {
  id: 'core.section.evolution',
  title: 'Évolution depuis la dernière séance',
  required: false,
  canDisable: true,
  icon: '📈',
  accentColor: '#0D9488',
  placement: 'evolution',
  followUpOnly: true,
  fields: [
    {
      id: 'evolution',
      type: 'richtext',
      label: 'Évolution depuis la dernière séance',
      dataKey: 'core.previous_session_evolution',
      version: CORE_VERSION,
      minHeight: 70,
    },
    {
      id: 'problematiques',
      type: 'richtext',
      label: 'Nouveaux symptômes / éléments',
      dataKey: 'core.new_symptoms',
      version: CORE_VERSION,
      minHeight: 60,
      omitWhenEmpty: true,
    },
  ],
}

/**
 * 3. Sécurité — drapeaux rouges / contre-indications vérifiés.
 *    `id: 'safetyChecked'` → full_data_json.safetyChecked (clé additive)
 */
const sectionSafety: SynoriaCoreSection = {
  id: 'core.section.safety',
  title: 'Sécurité — drapeaux rouges',
  required: false,
  canDisable: true,
  icon: '🛡️',
  accentColor: '#DC2626',
  placement: 'safety',
  fields: [
    {
      id: 'safetyChecked',
      type: 'checkbox',
      label: 'Absence de contre-indication / drapeau rouge vérifiée',
      dataKey: 'core.safety_checked',
      version: CORE_VERSION,
    },
  ],
}

/**
 * 4. Résultat — état avant/après + observations générales.
 *    `id: 'observation'`  → colonne sessions.observation
 *    `id: 'outcomeBefore'`/`'outcomeAfter'` → full_data_json (clés additives)
 */
const sectionOutcome: SynoriaCoreSection = {
  id: 'core.section.outcome',
  title: 'Résultat de la séance',
  required: false,
  canDisable: true,
  icon: '📊',
  accentColor: '#3B82F6',
  placement: 'outcome',
  fields: [
    {
      id: 'outcomeBefore',
      type: 'slider',
      label: 'État avant la séance',
      dataKey: 'core.outcome_before',
      version: CORE_VERSION,
      min: 0,
      max: 10,
      width: 'half',
      omitWhenEmpty: true,
    },
    {
      id: 'outcomeAfter',
      type: 'slider',
      label: 'État après la séance',
      dataKey: 'core.outcome_after',
      version: CORE_VERSION,
      min: 0,
      max: 10,
      width: 'half',
      omitWhenEmpty: true,
    },
    {
      id: 'observation',
      type: 'richtext',
      label: 'Observations générales',
      dataKey: 'core.general_observations',
      version: CORE_VERSION,
      minHeight: 70,
      omitWhenEmpty: true,
    },
  ],
}

/**
 * 5. Conseils & suivi — conseils, plan, prochain rendez-vous.
 *    `id: 'conseils'`    → full_data_json.conseils
 *    `id: 'plan'`        → full_data_json.plan
 *    `id: 'nextSession'` → full_data_json.nextSession (date du prochain RDV)
 */
const sectionFollowUp: SynoriaCoreSection = {
  id: 'core.section.followup',
  title: 'Conseils et suivi',
  required: false,
  canDisable: true,
  icon: '🧭',
  accentColor: '#7C3AED',
  placement: 'followup',
  fields: [
    {
      id: 'conseils',
      type: 'richtext',
      label: 'Conseils au patient',
      dataKey: 'core.advice',
      version: CORE_VERSION,
      minHeight: 60,
    },
    {
      id: 'plan',
      type: 'richtext',
      label: 'Plan de suivi',
      dataKey: 'core.follow_up',
      version: CORE_VERSION,
      minHeight: 60,
    },
    {
      id: 'nextSession',
      type: 'date',
      label: 'Prochain rendez-vous',
      dataKey: 'core.next_appointment',
      version: CORE_VERSION,
      width: 'half',
      omitWhenEmpty: true,
    },
  ],
}

// ── Définition complète ──────────────────────────────────────────────────────

export const SYNORIA_CORE_DEFINITION: SynoriaCoreDefinition = {
  id: CORE_DEFINITION_ID,
  version: CORE_VERSION,
  sections: [
    sectionContext,
    sectionEvolution,
    sectionSafety,
    sectionOutcome,
    sectionFollowUp,
  ],
}

/** Retourne une COPIE défensive du Core (jamais la référence mutable). */
export function getCoreDefinition(): SynoriaCoreDefinition {
  return JSON.parse(JSON.stringify(SYNORIA_CORE_DEFINITION)) as SynoriaCoreDefinition
}

/** Index dataKey → PluginField pour l'ensemble des champs Core. */
export function coreFieldsByDataKey(): Map<string, PluginField> {
  const map = new Map<string, PluginField>()
  for (const section of SYNORIA_CORE_DEFINITION.sections) {
    for (const f of section.fields) {
      if (f.dataKey) map.set(f.dataKey, f)
    }
  }
  return map
}

/** Toutes les sections Core désactivables (canDisable === true). */
export function coreDisableableSectionIds(): string[] {
  return SYNORIA_CORE_DEFINITION.sections.filter(s => s.canDisable).map(s => s.id)
}
