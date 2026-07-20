/**
 * Adaptateur du module Langue & Pouls MTC (mtc_tongue_pulse).
 *
 * Structure des données :
 *   {
 *     langue: { couleur?: string; enduit?: string; forme?: string; note?: string }
 *     pouls:  { positions?: Record<string, string[]>; note?: string }
 *   }
 * Les positions de pouls existent aussi dans la colonne SQL sessions.pouls et
 * full_data_json.poulsPos — ce module capture la vue unifiée.
 */

import type { ModuleAdapter } from '../../../shared/pluginModuleRegistry'
import type { ExportBlock } from '../../../shared/exportDocumentTypes'

export interface TongueDiagnosis {
  couleur?: string
  enduit?: string
  forme?: string
  note?: string
}

export interface PulseDiagnosis {
  positions?: Record<string, string[]>
  note?: string
}

export interface TonguePulseData {
  langue: TongueDiagnosis
  pouls: PulseDiagnosis
}

const MODULE_ID = 'synoria.module.mtc.tongue_pulse'
const VERSION = '1.0.0'

function normalize(raw: unknown): TonguePulseData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { langue: {}, pouls: {} }
  }
  const r = raw as Record<string, unknown>
  const lang = (r.langue && typeof r.langue === 'object' && !Array.isArray(r.langue))
    ? r.langue as Record<string, unknown> : {}
  const puls = (r.pouls && typeof r.pouls === 'object' && !Array.isArray(r.pouls))
    ? r.pouls as Record<string, unknown> : {}

  return {
    langue: {
      couleur: typeof lang.couleur === 'string' ? lang.couleur : undefined,
      enduit:  typeof lang.enduit  === 'string' ? lang.enduit  : undefined,
      forme:   typeof lang.forme   === 'string' ? lang.forme   : undefined,
      note:    typeof lang.note    === 'string' ? lang.note    : undefined,
    },
    pouls: {
      positions: puls.positions && typeof puls.positions === 'object' && !Array.isArray(puls.positions)
        ? puls.positions as Record<string, string[]> : undefined,
      note: typeof puls.note === 'string' ? puls.note : undefined,
    },
  }
}

function isEmpty(value: TonguePulseData): boolean {
  const l = value.langue
  const p = value.pouls
  const langueEmpty = !l.couleur && !l.enduit && !l.forme && !l.note?.trim()
  const poulsEmpty = (!p.positions || Object.keys(p.positions).length === 0) && !p.note?.trim()
  return langueEmpty && poulsEmpty
}

function formatForSummary(value: TonguePulseData): string {
  const lines: string[] = []
  const l = value.langue
  const lParts = [l.couleur, l.enduit, l.forme].filter(Boolean)
  if (lParts.length > 0) lines.push(`Langue : ${lParts.join(', ')}`)
  if (l.note?.trim()) lines.push(`Note langue : ${l.note.trim()}`)
  const p = value.pouls
  if (p.positions && Object.keys(p.positions).length > 0) {
    const posStr = Object.entries(p.positions)
      .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ')
    lines.push(`Pouls : ${posStr}`)
  }
  if (p.note?.trim()) lines.push(`Note pouls : ${p.note.trim()}`)
  return lines.join('\n')
}

function exportToDocument(value: TonguePulseData): ExportBlock[] {
  if (isEmpty(value)) return []
  const blocks: ExportBlock[] = []
  const l = value.langue
  if (l.couleur) blocks.push({ type: 'keyvalue', label: 'Langue — couleur', value: l.couleur } as ExportBlock)
  if (l.enduit)  blocks.push({ type: 'keyvalue', label: 'Langue — enduit',  value: l.enduit } as ExportBlock)
  if (l.forme)   blocks.push({ type: 'keyvalue', label: 'Langue — forme',   value: l.forme } as ExportBlock)
  if (l.note?.trim()) blocks.push({ type: 'keyvalue', label: 'Langue — notes', value: l.note.trim() } as ExportBlock)
  const p = value.pouls
  if (p.positions) {
    for (const [pos, qualites] of Object.entries(p.positions)) {
      if (Array.isArray(qualites) && qualites.length > 0) {
        blocks.push({ type: 'keyvalue', label: `Pouls ${pos}`, value: qualites.join(', ') } as ExportBlock)
      }
    }
  }
  if (p.note?.trim()) blocks.push({ type: 'keyvalue', label: 'Pouls — notes', value: p.note.trim() } as ExportBlock)
  return blocks
}

function migrateData(data: unknown, _from: string, _to: string): TonguePulseData {
  return normalize(data)
}

export const mtcTonguePulseAdapter: ModuleAdapter<TonguePulseData> = {
  moduleId: MODULE_ID,
  version: VERSION,
  normalizeValue: normalize,
  isEmpty,
  formatForSummary,
  exportToDocument,
  migrateData,
}
