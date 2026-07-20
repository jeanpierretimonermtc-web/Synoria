/**
 * Adaptateur du module Tests Orthopédiques (osteo_ortho_tests).
 *
 * Structure des données :
 *   Array<{ nom: string; resultat?: 'positif' | 'negatif' | ''; note?: string }>
 */

import type { ModuleAdapter } from '../../../shared/pluginModuleRegistry'
import type { ExportBlock } from '../../../shared/exportDocumentTypes'

export interface OrthoTest {
  nom: string
  resultat?: 'positif' | 'negatif' | ''
  note?: string
}

export type OrthoTestsData = OrthoTest[]

const MODULE_ID = 'synoria.module.osteo.ortho_tests'
const VERSION = '1.0.0'

function normalize(raw: unknown): OrthoTestsData {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => {
      const i = item as Record<string, unknown>
      return {
        nom: typeof i.nom === 'string' ? i.nom : '',
        resultat: typeof i.resultat === 'string' && ['positif', 'negatif', ''].includes(i.resultat)
          ? i.resultat as 'positif' | 'negatif' | '' : '',
        note: typeof i.note === 'string' ? i.note : undefined,
      }
    })
    .filter(t => t.nom.trim().length > 0)
}

function isEmpty(value: OrthoTestsData): boolean {
  return value.length === 0
}

function formatForSummary(value: OrthoTestsData): string {
  return value.map(t => {
    const res = t.resultat === 'positif' ? '✓+' : t.resultat === 'negatif' ? '✗-' : '—'
    const note = t.note?.trim() ? ` (${t.note.trim()})` : ''
    return `${t.nom} : ${res}${note}`
  }).join('\n')
}

function exportToDocument(value: OrthoTestsData): ExportBlock[] {
  if (isEmpty(value)) return []
  const rows: string[][] = value.map(t => {
    const res = t.resultat === 'positif' ? 'Positif' : t.resultat === 'negatif' ? 'Négatif' : '—'
    return [t.nom, res, t.note?.trim() || '']
  })
  return [{ type: 'table', columns: ['Test', 'Résultat', 'Note'], rows } as ExportBlock]
}

function migrateData(data: unknown, _from: string, _to: string): OrthoTestsData {
  return normalize(data)
}

export const osteoOrthoTestsAdapter: ModuleAdapter<OrthoTestsData> = {
  moduleId: MODULE_ID,
  version: VERSION,
  normalizeValue: normalize,
  isEmpty,
  formatForSummary,
  exportToDocument,
  migrateData,
}
