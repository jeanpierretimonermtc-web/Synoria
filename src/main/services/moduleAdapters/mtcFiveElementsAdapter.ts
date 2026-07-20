/**
 * Adaptateur du module 5 Éléments MTC (mtc_five_elements).
 *
 * Structure des données :
 *   { selected: string[]; notes: string }
 * où selected est une liste d'éléments annotés (ex: ['Eau', 'Feu'])
 */

import type { ModuleAdapter } from '../../../shared/pluginModuleRegistry'
import type { ExportBlock } from '../../../shared/exportDocumentTypes'

export interface FiveElementsData {
  selected: string[]
  notes: string
}

const MODULE_ID = 'synoria.module.mtc.five_elements'
const VERSION = '1.0.0'

function normalize(raw: unknown): FiveElementsData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { selected: [], notes: '' }
  }
  const r = raw as Record<string, unknown>
  return {
    selected: Array.isArray(r.selected) ? r.selected.filter((x): x is string => typeof x === 'string') : [],
    notes: typeof r.notes === 'string' ? r.notes : '',
  }
}

function isEmpty(value: FiveElementsData): boolean {
  return value.selected.length === 0 && !value.notes.trim()
}

function formatForSummary(value: FiveElementsData): string {
  const parts: string[] = []
  if (value.selected.length > 0) parts.push(`Éléments : ${value.selected.join(', ')}`)
  if (value.notes.trim()) parts.push(value.notes.trim())
  return parts.join('\n')
}

function exportToDocument(value: FiveElementsData): ExportBlock[] {
  if (isEmpty(value)) return []
  const blocks: ExportBlock[] = []
  if (value.selected.length > 0) blocks.push({ type: 'keyvalue', label: 'Éléments concernés', value: value.selected.join(', ') } as ExportBlock)
  if (value.notes.trim()) blocks.push({ type: 'keyvalue', label: 'Notes', value: value.notes.trim() } as ExportBlock)
  return blocks
}

function migrateData(data: unknown, _from: string, _to: string): FiveElementsData {
  return normalize(data)
}

export const mtcFiveElementsAdapter: ModuleAdapter<FiveElementsData> = {
  moduleId: MODULE_ID,
  version: VERSION,
  normalizeValue: normalize,
  isEmpty,
  formatForSummary,
  exportToDocument,
  migrateData,
}
