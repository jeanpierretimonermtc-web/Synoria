/**
 * Adaptateur du module Pense-bête interrogatoire MTC (mtc_aide_interrogatoire).
 *
 * Ce module est display-only : il n'a pas de données saisies par le praticien.
 * Il apparaît dans les formulaires comme aide-mémoire mais ne génère rien à l'export
 * (sauf si le paramètre showInExport est activé, auquel cas un notice est inséré).
 */

import type { ModuleAdapter } from '../../../shared/pluginModuleRegistry'
import type { ExportBlock } from '../../../shared/exportDocumentTypes'

export type AideInterrogatoireData = null

const MODULE_ID = 'synoria.module.mtc.aide_interrogatoire'
const VERSION = '1.0.0'

function normalize(_raw: unknown): AideInterrogatoireData {
  return null
}

function isEmpty(_value: AideInterrogatoireData): boolean {
  return true
}

function formatForSummary(_value: AideInterrogatoireData): string {
  return ''
}

function exportToDocument(
  _value: AideInterrogatoireData,
  settings?: Record<string, unknown>,
): ExportBlock[] {
  if (!settings?.showInExport) return []
  return [{ type: 'notice', severity: 'info', text: '[Module Pense-bête interrogatoire MTC — affichage seul]' } as ExportBlock]
}

function migrateData(_data: unknown, _from: string, _to: string): AideInterrogatoireData {
  return null
}

export const mtcAideInterrogatoireAdapter: ModuleAdapter<AideInterrogatoireData> = {
  moduleId: MODULE_ID,
  version: VERSION,
  normalizeValue: normalize,
  isEmpty,
  formatForSummary,
  exportToDocument,
  migrateData,
}
