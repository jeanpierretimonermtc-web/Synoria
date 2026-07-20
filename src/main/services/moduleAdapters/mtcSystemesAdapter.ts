/**
 * Adaptateur du module Questionnaire des systèmes MTC (mtc_systemes).
 *
 * Structure des données (SystemesQuestionnaire) :
 *   Record<string, { checked: string[]; note: string; energie?: number }>
 * où la clé est un identifiant de système ('coeur', 'rate', 'foie', etc.)
 */

import type { ModuleAdapter } from '../../../shared/pluginModuleRegistry'
import type { ExportBlock } from '../../../shared/exportDocumentTypes'

export interface SystèmeEntry {
  checked?: string[]
  note?: string
  energie?: number
}

export type SystemesQuestionnaire = Record<string, SystèmeEntry>

const MODULE_ID = 'synoria.module.mtc.systemes'
const VERSION = '1.0.0'

/** Labels lisibles des clés système. */
const SYSTEME_LABELS: Record<string, string> = {
  coeur:     'Cœur / Grêle',
  rein:      'Rein / Vessie',
  rate:      'Rate / Estomac',
  foie:      'Foie / Vésicule biliaire',
  poumon:    'Poumon / Gros intestin',
  maitre_coeur: 'Maître du Cœur / Triple réchauffeur',
}

function normalize(raw: unknown): SystemesQuestionnaire {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: SystemesQuestionnaire = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'object' && v !== null) {
      const entry = v as Record<string, unknown>
      out[k] = {
        checked: Array.isArray(entry.checked) ? entry.checked.filter((x): x is string => typeof x === 'string') : [],
        note: typeof entry.note === 'string' ? entry.note : '',
        energie: typeof entry.energie === 'number' ? entry.energie : undefined,
      }
    }
  }
  return out
}

function isEmpty(value: SystemesQuestionnaire): boolean {
  return Object.values(value).every(e =>
    (!e.checked || e.checked.length === 0) && (!e.note || !e.note.trim()) && e.energie === undefined
  )
}

function formatForSummary(value: SystemesQuestionnaire): string {
  const lines: string[] = []
  for (const [key, entry] of Object.entries(value)) {
    const label = SYSTEME_LABELS[key] || key
    const parts: string[] = []
    if (Array.isArray(entry.checked) && entry.checked.length > 0) parts.push(entry.checked.join(', '))
    if (entry.note?.trim()) parts.push(entry.note.trim())
    if (entry.energie !== undefined) parts.push(`Énergie : ${entry.energie}`)
    if (parts.length > 0) lines.push(`${label} : ${parts.join(' — ')}`)
  }
  return lines.join('\n')
}

function exportToDocument(value: SystemesQuestionnaire): ExportBlock[] {
  const blocks: ExportBlock[] = []
  for (const [key, entry] of Object.entries(value)) {
    const label = SYSTEME_LABELS[key] || key
    const parts: string[] = []
    if (Array.isArray(entry.checked) && entry.checked.length > 0) parts.push(entry.checked.join(', '))
    if (entry.note?.trim()) parts.push(entry.note.trim())
    if (entry.energie !== undefined) parts.push(`Énergie ${entry.energie}/10`)
    if (parts.length > 0) blocks.push({ type: 'keyvalue', label, value: parts.join(' — ') } as ExportBlock)
  }
  return blocks
}

function migrateData(data: unknown, _from: string, _to: string): SystemesQuestionnaire {
  return normalize(data)
}

export const mtcSystemesAdapter: ModuleAdapter<SystemesQuestionnaire> = {
  moduleId: MODULE_ID,
  version: VERSION,
  normalizeValue: normalize,
  isEmpty,
  formatForSummary,
  exportToDocument,
  migrateData,
}
