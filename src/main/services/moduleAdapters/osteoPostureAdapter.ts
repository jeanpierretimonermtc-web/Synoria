/**
 * Adaptateur du module Bilan Postural (osteo_posture).
 *
 * Structure des données :
 *   {
 *     front?: { observations?: string[]; note?: string }
 *     back?:  { observations?: string[]; note?: string }
 *     left?:  { observations?: string[]; note?: string }
 *     right?: { observations?: string[]; note?: string }
 *   }
 */

import type { ModuleAdapter } from '../../../shared/pluginModuleRegistry'
import type { ExportBlock } from '../../../shared/exportDocumentTypes'

export interface PostureView {
  observations?: string[]
  note?: string
}

export interface PostureData {
  front?: PostureView
  back?: PostureView
  left?: PostureView
  right?: PostureView
}

const MODULE_ID = 'synoria.module.osteo.posture'
const VERSION = '1.0.0'

const VIEW_LABELS: Record<string, string> = {
  front: 'Vue antérieure',
  back:  'Vue postérieure',
  left:  'Vue gauche',
  right: 'Vue droite',
}

function normalizeView(raw: unknown): PostureView {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  return {
    observations: Array.isArray(r.observations)
      ? r.observations.filter((x): x is string => typeof x === 'string') : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
  }
}

function normalize(raw: unknown): PostureData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  return {
    front: r.front ? normalizeView(r.front) : undefined,
    back:  r.back  ? normalizeView(r.back)  : undefined,
    left:  r.left  ? normalizeView(r.left)  : undefined,
    right: r.right ? normalizeView(r.right) : undefined,
  }
}

function isViewEmpty(view?: PostureView): boolean {
  if (!view) return true
  return (!view.observations || view.observations.length === 0) && !view.note?.trim()
}

function isEmpty(value: PostureData): boolean {
  return isViewEmpty(value.front) && isViewEmpty(value.back)
      && isViewEmpty(value.left) && isViewEmpty(value.right)
}

function formatView(label: string, view?: PostureView): string {
  if (isViewEmpty(view)) return ''
  const parts: string[] = []
  if (view?.observations && view.observations.length > 0) parts.push(view.observations.join(', '))
  if (view?.note?.trim()) parts.push(view.note.trim())
  return `${label} : ${parts.join(' — ')}`
}

function formatForSummary(value: PostureData): string {
  return ['front', 'back', 'left', 'right']
    .map(k => formatView(VIEW_LABELS[k], value[k as keyof PostureData]))
    .filter(Boolean)
    .join('\n')
}

function exportToDocument(value: PostureData): ExportBlock[] {
  if (isEmpty(value)) return []
  const blocks: ExportBlock[] = []
  for (const [k, label] of Object.entries(VIEW_LABELS)) {
    const view = value[k as keyof PostureData]
    const line = formatView(label, view)
    if (line) blocks.push({ type: 'keyvalue', label, value: line.replace(`${label} : `, '') } as ExportBlock)
  }
  return blocks
}

function migrateData(data: unknown, _from: string, _to: string): PostureData {
  return normalize(data)
}

export const osteoPostureAdapter: ModuleAdapter<PostureData> = {
  moduleId: MODULE_ID,
  version: VERSION,
  normalizeValue: normalize,
  isEmpty,
  formatForSummary,
  exportToDocument,
  migrateData,
}
