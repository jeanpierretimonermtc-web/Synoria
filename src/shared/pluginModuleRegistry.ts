/**
 * Registre versionnée des modules Synoria (Phase 4).
 *
 * Un « module » est un champ de type complexe (`mtc_systemes`, `osteo_posture`, etc.)
 * dont les données ont une structure propre, distincte des champs simples.
 *
 * Différence avec pluginRegistry.ts (qui n'a que des métadonnées d'affichage) :
 * ce registre expose des ADAPTATEURS fonctionnels — normalisation, résumé, export,
 * migration de données — versionnés indépendamment du schéma du plugin.
 *
 * Architecture :
 *   - `SynoriaModuleDefinition`  → métadonnées stables d'un type de module
 *   - `ModuleAdapter<T>`         → comportements fonctionnels versionnés
 *   - `registerModuleAdapter`    → enregistrement (appelé depuis moduleAdapters/index.ts)
 *   - `getModuleAdapter`         → accès O(1) par fieldType
 *   - `MODULE_DEFINITIONS`       → liste exhaustive des modules natifs
 */

import type { PluginFieldType } from './pluginTypes'
import type { ExportBlock } from './exportDocumentTypes'

// ── Définition d'un module ──────────────────────────────────────────────────

export interface SynoriaModuleDefinition {
  /** Identifiant canonique, ex: 'synoria.module.mtc.systemes'. */
  id: string
  /** Type de champ Synoria associé, ex: 'mtc_systemes'. */
  fieldType: PluginFieldType
  name: string
  description: string
  version: string
  specialty: string
  isNative: boolean
  isPremium: boolean
  icon: string
  accentColor: string
  /** 'builtin' = rendu par le code Synoria ; futur : 'external' pour plugins tiers. */
  rendererType: 'builtin'
  /** Schéma de paramètres optionnels configurables par l'utilisateur. */
  settingsSchema?: Record<string, {
    type: 'boolean' | 'string' | 'number'
    label: string
    default?: unknown
  }>
}

// ── Adaptateur de module ────────────────────────────────────────────────────

export interface ModuleAdapter<T = unknown> {
  /** Même identifiant que `SynoriaModuleDefinition.id`. */
  moduleId: string
  /** Version de cet adaptateur (SemVer). Stockée dans le snapshot. */
  version: string
  /** Normalise une valeur brute (issue du blob JSON) vers la structure typée. */
  normalizeValue(raw: unknown): T
  /** Retourne true si la valeur est considérée vide/non saisie. */
  isEmpty(value: T): boolean
  /** Formate pour le résumé de séance (texte, peut contenir du HTML simple). */
  formatForSummary(value: T, settings?: Record<string, unknown>): string
  /** Convertit en blocs d'export pour ExportDocument. */
  exportToDocument(value: T, settings?: Record<string, unknown>): ExportBlock[]
  /**
   * Migre des données d'une ancienne version de l'adaptateur vers la version actuelle.
   * Si fromVersion === toVersion, retourner value tel quel.
   */
  migrateData(data: unknown, fromVersion: string, toVersion: string): T
}

// ── Registre interne ─────────────────────────────────────────────────────────

/** Index fieldType → adaptateur. */
const _adapters = new Map<PluginFieldType, ModuleAdapter>()

export function registerModuleAdapter(adapter: ModuleAdapter): void {
  const def = MODULE_DEFINITIONS.find(d => d.id === adapter.moduleId)
  if (!def) {
    console.warn(`[pluginModuleRegistry] Adaptateur "${adapter.moduleId}" sans définition connue — ignoré.`)
    return
  }
  _adapters.set(def.fieldType, adapter)
}

export function getModuleAdapter(fieldType: PluginFieldType): ModuleAdapter | null {
  return _adapters.get(fieldType) ?? null
}

export function getAllRegisteredFieldTypes(): PluginFieldType[] {
  return Array.from(_adapters.keys())
}

// ── Définitions des modules natifs ──────────────────────────────────────────

export const MODULE_DEFINITIONS: readonly SynoriaModuleDefinition[] = [
  {
    id: 'synoria.module.mtc.systemes',
    fieldType: 'mtc_systemes',
    name: 'Questionnaire des systèmes',
    description: 'Interrogatoire complet des systèmes (cardiaque, pulmonaire, mental, digestif, rénal…)',
    version: '1.0.0',
    specialty: 'MTC',
    isNative: true,
    isPremium: false,
    icon: '📋',
    accentColor: '#6a47c4',
    rendererType: 'builtin',
  },
  {
    id: 'synoria.module.mtc.five_elements',
    fieldType: 'mtc_five_elements',
    name: '5 Éléments',
    description: 'Tableau des correspondances des 5 Éléments avec annotation des éléments concernés',
    version: '1.0.0',
    specialty: 'MTC',
    isNative: true,
    isPremium: false,
    icon: '☯️',
    accentColor: '#6a47c4',
    rendererType: 'builtin',
  },
  {
    id: 'synoria.module.mtc.tongue_pulse',
    fieldType: 'mtc_tongue_pulse',
    name: 'Langue & Pouls',
    description: 'Diagnostic Langue (couleur, enduit, forme) et Pouls (6 positions, 29 qualités)',
    version: '1.0.0',
    specialty: 'MTC',
    isNative: true,
    isPremium: false,
    icon: '🌡️',
    accentColor: '#6a47c4',
    rendererType: 'builtin',
  },
  {
    id: 'synoria.module.mtc.aide_interrogatoire',
    fieldType: 'mtc_aide_interrogatoire',
    name: 'Pense-bête interrogatoire',
    description: 'Panneau aide-mémoire des questions MTC (affichage seul, sans données)',
    version: '1.0.0',
    specialty: 'MTC',
    isNative: true,
    isPremium: false,
    icon: '📌',
    accentColor: '#C17B2A',
    rendererType: 'builtin',
    settingsSchema: {
      showInExport: { type: 'boolean', label: 'Inclure dans les exports', default: false },
    },
  },
  {
    id: 'synoria.module.osteo.ortho_tests',
    fieldType: 'osteo_ortho_tests',
    name: 'Tests Orthopédiques',
    description: 'Liste de tests saisis par le praticien avec résultat Positif / Négatif',
    version: '1.0.0',
    specialty: 'Ostéo',
    isNative: true,
    isPremium: false,
    icon: '🦴',
    accentColor: '#0D9488',
    rendererType: 'builtin',
  },
  {
    id: 'synoria.module.osteo.posture',
    fieldType: 'osteo_posture',
    name: 'Bilan Postural',
    description: 'Bilan postural 4 vues (ANT/POST/GAU/DRO) avec observations cochables',
    version: '1.0.0',
    specialty: 'Ostéo',
    isNative: true,
    isPremium: false,
    icon: '🧍',
    accentColor: '#0D9488',
    rendererType: 'builtin',
  },
]

/** Index fieldType → définition pour accès O(1). */
const _defIndex = new Map<PluginFieldType, SynoriaModuleDefinition>(
  MODULE_DEFINITIONS.map(d => [d.fieldType, d])
)

export function getModuleDefinition(fieldType: PluginFieldType): SynoriaModuleDefinition | null {
  return _defIndex.get(fieldType) ?? null
}

export function getModuleDefinitionById(id: string): SynoriaModuleDefinition | null {
  return MODULE_DEFINITIONS.find(d => d.id === id) ?? null
}

export function isModuleFieldType(type: PluginFieldType): boolean {
  return _defIndex.has(type)
}

export function getModulesBySpecialty(specialty: string): SynoriaModuleDefinition[] {
  return MODULE_DEFINITIONS.filter(d => d.specialty === specialty) as SynoriaModuleDefinition[]
}
