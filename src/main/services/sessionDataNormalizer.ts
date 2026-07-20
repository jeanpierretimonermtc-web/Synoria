/**
 * Normalisateur de séances (Phase 1 — fondations non-destructives).
 *
 * Transforme une séance SQLite brute (colonnes + full_data_json + pluginSchema)
 * en une structure canonique `CanonicalSessionData`.
 *
 * Principes :
 *   - Accepte les ANCIENNES séances (sans profil, sans schéma, sans dataKey).
 *   - Accepte les nouvelles séances (avec snapshot complet).
 *   - Ne supprime JAMAIS silencieusement une donnée : tout ce qui n'est pas
 *     reconnu est capturé dans `fields`/`modules` avec un warning structuré.
 *   - Ne lance JAMAIS d'exception, même sur des données corrompues.
 *
 * Ce service est ADDITIF : il ne modifie ni la base, ni le format de stockage.
 * Il est calculé à la volée et n'a aucun effet de bord.
 *
 * Aucune écriture SQLite, aucun `.then()` : fonctions pures et synchrones.
 */

import {
  CANONICAL_SCHEMA_VERSION,
  CORE_VERSION,
  CORE_PROFILE_ID,
  type CanonicalSessionData,
  type CanonicalFieldValue,
  type CanonicalModuleData,
  type NormalizationWarning,
  type FormSnapshot,
} from '../../shared/sessionDataTypes'
import type { PluginDefinition, PluginField, PluginFieldType } from '../../shared/pluginTypes'
import { isPluginModule } from '../../shared/pluginRegistry'

const NORMALIZER_ID = 'sessionDataNormalizer@1.0.0'

// ── Description des champs Core ─────────────────────────────────────────────

interface CoreFieldDef {
  key: string                 // clé dans la ligne SQL ou dans full_data_json
  dataKey: string
  type: PluginFieldType | 'unknown'
  label: string
}

/** Colonnes SQL directes → Core. */
const COLUMN_CORE_FIELDS: CoreFieldDef[] = [
  { key: 'practitioner',     dataKey: 'core.practitioner',    type: 'text',     label: 'Praticien' },
  { key: 'motif',            dataKey: 'core.motif',           type: 'richtext', label: 'Motif de consultation' },
  { key: 'evolution_tags',   dataKey: 'core.evolution_tags',  type: 'tags',     label: 'Évolution (tags)' },
  { key: 'evolution',        dataKey: 'core.evolution',       type: 'richtext', label: 'Évolution' },
  { key: 'problematiques',   dataKey: 'core.problematiques',  type: 'richtext', label: 'Problématiques / Terrain' },
  { key: 'observation',      dataKey: 'core.observation',     type: 'richtext', label: 'Observations cliniques' },
  // MTC intégré (colonnes historiques)
  { key: 'langue',           dataKey: 'core.langue',          type: 'text',     label: 'Langue' },
  { key: 'pouls',            dataKey: 'core.pouls',           type: 'text',     label: 'Pouls' },
  { key: 'constitution',     dataKey: 'core.constitution',    type: 'text',     label: 'Constitution' },
  { key: 'type_corps',       dataKey: 'core.type_corps',      type: 'text',     label: 'Type de corps' },
  { key: 'teint',            dataKey: 'core.teint',           type: 'text',     label: 'Teint' },
  { key: 'diagnostic_mtc',   dataKey: 'core.diagnostic_mtc',  type: 'textarea', label: 'Diagnostic MTC' },
  { key: 'cinq_elements',    dataKey: 'core.cinq_elements',   type: 'text',     label: '5 Éléments' },
  { key: 'causes',           dataKey: 'core.causes',          type: 'textarea', label: 'Causes' },
  { key: 'analyse',          dataKey: 'core.analyse',         type: 'richtext', label: 'Analyse / Mécanisme' },
  { key: 'principes',        dataKey: 'core.principes',       type: 'textarea', label: 'Principes de traitement' },
  { key: 'points',           dataKey: 'core.points',          type: 'text',     label: "Points d'acupuncture" },
  { key: 'pts_oreille',      dataKey: 'core.pts_oreille',     type: 'text',     label: "Points d'oreille" },
  { key: 'techniques',       dataKey: 'core.techniques',      type: 'tags',     label: 'Techniques' },
  { key: 'plantes',          dataKey: 'core.plantes',         type: 'textarea', label: 'Plantes / Formule' },
  { key: 'reactions',        dataKey: 'core.reactions',       type: 'richtext', label: 'Réactions' },
  { key: 'traitement_notes', dataKey: 'core.traitement_notes',type: 'richtext', label: 'Notes de traitement' },
  { key: 'conseils',         dataKey: 'core.conseils',        type: 'richtext', label: 'Conseils' },
  { key: 'plan',             dataKey: 'core.plan',            type: 'richtext', label: 'Plan de suivi' },
  { key: 'surveiller',       dataKey: 'core.surveiller',      type: 'textarea', label: 'À surveiller' },
  { key: 'next_session_date',dataKey: 'core.next_session_date',type: 'date',    label: 'Prochain RDV' },
]

/** Clés scalaires de full_data_json → Core (formulaire MTC intégré + mode simple). */
const FD_CORE_FIELDS: CoreFieldDef[] = [
  { key: 'anamnese',                 dataKey: 'core.anamnese',                 type: 'richtext', label: 'Anamnèse / Interrogatoire' },
  { key: 'langueNote',               dataKey: 'core.langueNote',               type: 'textarea', label: 'Langue — notes' },
  { key: 'poulsNote',                dataKey: 'core.poulsNote',                type: 'textarea', label: 'Pouls — notes' },
  { key: 'barrageNiv1',              dataKey: 'core.barrageNiv1',              type: 'textarea', label: 'Barrage — Niveau 1' },
  { key: 'barrageNiv2',              dataKey: 'core.barrageNiv2',              type: 'textarea', label: 'Barrage — Niveau 2' },
  { key: 'barrageNiv3',              dataKey: 'core.barrageNiv3',              type: 'textarea', label: 'Barrage — Niveau 3' },
  { key: 'barrageNiv4',              dataKey: 'core.barrageNiv4',              type: 'textarea', label: 'Barrage — Niveau 4' },
  { key: 'simpleContextVie',         dataKey: 'core.simpleContextVie',         type: 'richtext', label: 'Contexte & habitudes de vie' },
  { key: 'simpleTraitementsEnCours', dataKey: 'core.simpleTraitementsEnCours', type: 'richtext', label: 'Traitements en cours' },
  { key: 'simpleObjectifs',          dataKey: 'core.simpleObjectifs',          type: 'richtext', label: 'Objectifs du patient' },
  { key: 'simpleNotesEntretien',     dataKey: 'core.simpleNotesEntretien',     type: 'richtext', label: "Notes d'entretien" },
  { key: 'nextSession',              dataKey: 'core.nextSession',              type: 'date',     label: 'Prochaine séance (date)' },
  { key: 'nextSessionHeure',         dataKey: 'core.nextSessionHeure',         type: 'text',     label: 'Prochaine séance (heure)' },
  { key: 'nextSessionFin',           dataKey: 'core.nextSessionFin',           type: 'text',     label: 'Prochaine séance (fin)' },
  { key: 'nextSessionNote',          dataKey: 'core.nextSessionNote',          type: 'textarea', label: 'Prochaine séance (note)' },
]

/** Clés de full_data_json purement techniques : ignorées (ni core, ni fields). */
const FD_META_KEYS = new Set<string>([
  'sessionNum', 'patientId', 'date', 'practitioner',
  'pluginData', 'pluginId', 'pluginSchema', 'pluginIsBuiltin',
  'systemes', 'energy', 'poulsPos',
  'nextSessionApptId', 'comptaTypeId', 'comptaMois', '_savedAt',
  // Phase 3 : métadonnées de profil stockées dans full_data_json
  'profileId', 'profileVersion', 'consultationType', 'composedFormHash',
])

// Colonnes SQL dupliquées dans full_data_json : déjà couvertes par les colonnes.
const COLUMN_KEY_ALIASES = new Set<string>([
  'motif', 'evolution', 'evolutionTags', 'problematiques', 'observation',
  'langue', 'pouls', 'constitution', 'typeCorps', 'teint',
  'diagnostic', 'cinqElements', 'causes', 'analyse', 'principes',
  'points', 'ptsOreille', 'techniques', 'plantes', 'reactions',
  'traitementNotes', 'conseils', 'plan', 'surveiller',
])

// ── Helpers ─────────────────────────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

function safeParse(json: unknown): Record<string, unknown> | null {
  if (json === null || json === undefined) return null
  if (typeof json === 'object') return json as Record<string, unknown>
  if (typeof json !== 'string' || !json.trim()) return null
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

/**
 * Génère un dataKey stable pour un champ qui n'en possède pas.
 * Format : custom.<formId>.<fieldId>
 */
export function generateDataKey(formId: string | undefined, fieldId: string): string {
  const form = formId && formId.trim() ? formId.trim() : 'unknown'
  const field = fieldId && String(fieldId).trim() ? String(fieldId).trim() : 'unknown'
  return `custom.${form}.${field}`
}

/** Index fieldId → PluginField à partir d'un pluginSchema (défensif). */
function indexSchemaFields(schema: PluginDefinition | null): Map<string, PluginField> {
  const map = new Map<string, PluginField>()
  if (!schema || !Array.isArray(schema.sections)) return map
  for (const section of schema.sections) {
    if (!section || !Array.isArray(section.fields)) continue
    for (const f of section.fields) {
      if (f && typeof f === 'object' && typeof f.id === 'string') map.set(f.id, f)
    }
  }
  return map
}

// ── Normalisation principale ────────────────────────────────────────────────

export function normalizeSession(rawSession: unknown): CanonicalSessionData {
  const warnings: NormalizationWarning[] = []
  const core: Record<string, CanonicalFieldValue> = {}
  const fields: Record<string, CanonicalFieldValue> = {}
  const modules: Record<string, CanonicalModuleData> = {}
  let hadUnknownFields = false
  let hadUnknownModules = false
  let sourceFormat: 'legacy_v1' | 'canonical_v1' | 'unknown' = 'legacy_v1'

  const row = (rawSession && typeof rawSession === 'object' && !Array.isArray(rawSession))
    ? rawSession as Record<string, unknown>
    : null

  if (!row) {
    warnings.push({ severity: 'error', code: 'INVALID_SESSION',
      message: 'Séance illisible (objet attendu) — structure canonique vide générée.' })
    sourceFormat = 'unknown'
  }

  const sessionId = (row?.id as string) || ''
  const patientId = (row?.patient_id as string) || ''
  const createdAt = (row?.created_at as string) || new Date().toISOString()
  const updatedAt = (row?.updated_at as string) || undefined

  // ── full_data_json ──
  const fd = row ? safeParse(row.full_data_json) : null
  if (row && row.full_data_json && !fd) {
    warnings.push({ severity: 'warning', code: 'FULL_DATA_UNPARSEABLE',
      message: 'full_data_json illisible — seules les colonnes SQL ont été normalisées.' })
  }

  // ── Colonnes SQL → core ──
  if (row) {
    for (const def of COLUMN_CORE_FIELDS) {
      const v = row[def.key]
      if (isBlank(v)) continue
      core[def.dataKey] = {
        fieldId: def.key, dataKey: def.dataKey, type: def.type,
        labelSnapshot: def.label, value: v,
      }
    }
  }

  // ── full_data_json scalaires connus → core ──
  if (fd) {
    for (const def of FD_CORE_FIELDS) {
      const v = fd[def.key]
      if (isBlank(v)) continue
      // Ne pas écraser une valeur de colonne déjà présente sous le même dataKey.
      if (core[def.dataKey]) continue
      core[def.dataKey] = {
        fieldId: def.key, dataKey: def.dataKey, type: def.type,
        labelSnapshot: def.label, value: v,
      }
    }
  }

  // ── Modules Core (systèmes MTC, tests énergétiques, positions de pouls) ──
  const systemes = safeParse(row?.systemes_json) ?? (fd ? safeParse(fd.systemes) : null)
  if (systemes && Object.keys(systemes).length) {
    modules['mtc_systemes'] = { moduleId: 'mtc_systemes', schemaVersion: '1.0.0', data: systemes }
  }
  const energy = safeParse(row?.energy_tests_json) ?? (fd ? safeParse(fd.energy) : null)
  if (energy && Object.keys(energy).length) {
    modules['energy_tests'] = { moduleId: 'energy_tests', schemaVersion: '1.0.0', data: energy }
  }
  if (fd) {
    const poulsPos = safeParse(fd.poulsPos)
    if (poulsPos && Object.values(poulsPos).some(v => !isBlank(v))) {
      modules['mtc_pouls_positions'] = { moduleId: 'mtc_pouls_positions', schemaVersion: '1.0.0', data: poulsPos }
    }
  }

  // ── Données plugin ──
  const pluginId = (fd?.pluginId as string) || ''
  const pluginIsBuiltin = !!(fd?.pluginIsBuiltin) || pluginId === 'mtc_jp'
  const pluginSchema = (fd?.pluginSchema && typeof fd.pluginSchema === 'object')
    ? fd.pluginSchema as PluginDefinition
    : null
  const pluginData = safeParse(fd?.pluginData) ?? {}

  if (pluginId && !pluginIsBuiltin && !pluginSchema && Object.keys(pluginData).length) {
    warnings.push({ severity: 'warning', code: 'SCHEMA_MISSING',
      message: `Schéma du formulaire "${pluginId}" absent — données conservées en brut, sans libellés.` })
  }

  const schemaIndex = indexSchemaFields(pluginSchema)

  if (!pluginIsBuiltin && Object.keys(pluginData).length) {
    for (const [fieldId, value] of Object.entries(pluginData)) {
      if (isBlank(value)) continue
      const def = schemaIndex.get(fieldId)
      const type: PluginFieldType | 'unknown' = def?.type ?? 'unknown'
      const label = def?.summaryLabel ?? def?.summary?.label ?? def?.label ?? fieldId
      const dataKey = def?.dataKey ?? generateDataKey(pluginId || CORE_PROFILE_ID, fieldId)

      // Module → bucket modules
      if (type !== 'unknown' && isPluginModule(type as PluginFieldType)) {
        modules[fieldId] = {
          moduleId: type, version: def?.version, schemaVersion: '1.0.0', data: value,
        }
        continue
      }

      if (!def) {
        hadUnknownFields = true
        warnings.push({ severity: 'warning', code: 'UNKNOWN_FIELD', fieldId, dataKey,
          message: `Champ "${fieldId}" absent du schéma — conservé en brut (type inconnu).` })
      }

      fields[fieldId] = {
        fieldId, dataKey, type, labelSnapshot: label, value,
        deprecated: def?.status === 'deprecated' || undefined,
      }
    }
  }

  // ── Clés résiduelles de full_data_json non mappées → fields (jamais perdues) ──
  if (fd) {
    const knownFdCore = new Set(FD_CORE_FIELDS.map(f => f.key))
    for (const [key, value] of Object.entries(fd)) {
      if (isBlank(value)) continue
      if (FD_META_KEYS.has(key)) continue
      if (COLUMN_KEY_ALIASES.has(key)) continue
      if (knownFdCore.has(key)) continue
      // Non reconnu : capture brute + warning.
      const dataKey = generateDataKey('full_data', key)
      if (fields[key] || core[dataKey]) continue
      hadUnknownFields = true
      warnings.push({ severity: 'warning', code: 'UNMAPPED_FD_KEY', fieldId: key, dataKey,
        message: `Donnée "${key}" de full_data_json non reconnue — conservée en brut.` })
      fields[key] = { fieldId: key, dataKey, type: 'unknown', labelSnapshot: key, value }
    }
  }

  // ── Détection de modules inconnus (défensif) ──
  for (const m of Object.values(modules)) {
    if (m.moduleId === 'unknown') hadUnknownModules = true
  }

  // ── Métadonnées Phase 3 : profileId/consultationType stockés dans full_data_json ──
  const fdProfileId = typeof fd?.profileId === 'string' ? fd.profileId as string : undefined
  const fdProfileVersion = typeof fd?.profileVersion === 'string' ? fd.profileVersion as string : undefined
  const fdConsultationType = typeof fd?.consultationType === 'string' ? fd.consultationType as string : undefined

  // ── Snapshot de formulaire ──
  const formSnapshot: FormSnapshot = {
    snapshotVersion: '1.0.0',
    coreVersion: CORE_VERSION,
    profileId: fdProfileId || pluginId || CORE_PROFILE_ID,
    profileVersion: fdProfileVersion,
    consultationType: fdConsultationType,
    pluginId: pluginId || undefined,
    pluginVersion: pluginSchema?.version,
    pluginDefinition: pluginSchema ?? undefined,
    exportSchemaVersion: CANONICAL_SCHEMA_VERSION,
    createdAt,
    modules: Object.values(modules).map(m => ({
      moduleId: m.moduleId, version: m.version, schemaVersion: m.schemaVersion,
    })),
  }

  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    sessionId,
    patientId,
    createdAt,
    updatedAt,
    formProfile: {
      id: pluginId || CORE_PROFILE_ID,
      version: pluginSchema?.version ?? '0.0.0',
      coreVersion: CORE_VERSION,
      pluginId: pluginId || undefined,
      pluginVersion: pluginSchema?.version,
    },
    core,
    fields,
    modules,
    formSnapshot,
    normalization: {
      normalizedAt: new Date().toISOString(),
      normalizer: NORMALIZER_ID,
      warnings,
      hadUnknownFields,
      hadUnknownModules,
      sourceFormat,
    },
  }
}
