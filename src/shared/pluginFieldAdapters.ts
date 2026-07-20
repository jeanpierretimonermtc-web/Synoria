/**
 * Adaptateurs de types de champs (Phase 1 — fondations non-destructives).
 *
 * Un adaptateur encapsule TOUT ce qui dépend du type d'un champ :
 *   - validation de la configuration (dans le builder)
 *   - validation d'une valeur saisie
 *   - normalisation d'une valeur
 *   - rendu résumé (texte / HTML)
 *   - export JSON / Excel / document
 *
 * Objectif : centraliser une logique aujourd'hui dupliquée entre
 * exportService.ts, patientReportService.ts et PluginFieldSummary.tsx.
 *
 * En Phase 1 ces adaptateurs sont ADDITIFS : ils ne remplacent encore aucun
 * consommateur existant. Ils fournissent une API stable que la Phase 2 pourra
 * brancher progressivement, sans rien casser.
 *
 * Aucune dépendance Node.js — utilisable dans le main ET le renderer.
 */

import type { PluginField, PluginFieldType } from './pluginTypes'

// ── Types de retour ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface SummaryValue {
  label: string
  text: string        // rendu texte brut
  html?: string       // rendu HTML optionnel
  isEmpty: boolean
}

export interface ExcelExportValue {
  value: string | number | boolean | null
  note?: string       // note de cellule optionnelle
  isMultiline?: boolean
}

export interface ExportBlock {
  type: 'text' | 'keyvalue' | 'list' | 'table' | 'raw'
  label?: string
  content: unknown
}

export interface FieldTypeAdapter<T = unknown> {
  type: PluginFieldType

  validateConfig(field: PluginField): ValidationResult
  validateValue(value: unknown, field: PluginField): ValidationResult
  normalizeValue(value: unknown, field: PluginField): T | null
  formatForSummary(value: T | null, field: PluginField): SummaryValue
  exportToJson(value: T | null, field: PluginField): unknown
  exportToExcel(value: T | null, field: PluginField): ExcelExportValue
  exportToDocument(value: T | null, field: PluginField): ExportBlock[]
}

// ── Helpers partagés ───────────────────────────────────────────────────────

const OK: ValidationResult = { valid: true, errors: [], warnings: [] }
function ok(): ValidationResult { return { valid: true, errors: [], warnings: [] } }

/** Libellé affiché dans le résumé (respecte summaryLabel puis summary.label). */
function summaryLabelOf(field: PluginField): string {
  return field.summaryLabel ?? field.summary?.label ?? field.label
}

/** Convertit du HTML riche en texte brut lisible. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function emptySummary(field: PluginField): SummaryValue {
  return { label: summaryLabelOf(field), text: '', isEmpty: true }
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

const OPTIONS_TYPES = new Set<PluginFieldType>(['select', 'radio', 'checkboxgroup'])
const NUMERIC_TYPES = new Set<PluginFieldType>(['number', 'rating'])

// ── Fabrique d'adaptateur avec valeurs par défaut ──────────────────────────

function makeAdapter<T = unknown>(
  type: PluginFieldType,
  overrides: Partial<Omit<FieldTypeAdapter<T>, 'type'>> = {}
): FieldTypeAdapter<T> {
  const base: FieldTypeAdapter<T> = {
    type,
    validateConfig(field) {
      const errors: string[] = []
      const warnings: string[] = []
      if (OPTIONS_TYPES.has(field.type)) {
        const opts = (field.options ?? []).filter(o => typeof o === 'string' && o.trim())
        if (opts.length < 2) errors.push(`Le champ "${field.label}" (${field.type}) requiert au moins 2 options.`)
      }
      if (NUMERIC_TYPES.has(field.type)) {
        if (typeof field.min === 'number' && typeof field.max === 'number' && field.min >= field.max) {
          errors.push(`Le champ "${field.label}" : min (${field.min}) doit être < max (${field.max}).`)
        }
      }
      return { valid: errors.length === 0, errors, warnings }
    },
    validateValue() { return ok() },
    normalizeValue(value) { return (isBlank(value) ? null : (value as T)) },
    formatForSummary(value, field) {
      if (isBlank(value)) return emptySummary(field)
      const text = String(value)
      return { label: summaryLabelOf(field), text, isEmpty: text.trim() === '' }
    },
    exportToJson(value) { return value ?? null },
    exportToExcel(value) {
      if (isBlank(value)) return { value: null }
      return { value: String(value) }
    },
    exportToDocument(value, field) {
      if (isBlank(value)) return []
      return [{ type: 'text', label: summaryLabelOf(field), content: String(value) }]
    },
  }
  return { ...base, ...overrides, type }
}

// ── Adaptateurs texte ──────────────────────────────────────────────────────

const richTextLike = (type: PluginFieldType) => makeAdapter<string>(type, {
  normalizeValue(value) {
    if (isBlank(value)) return null
    return String(value)
  },
  formatForSummary(value, field) {
    const raw = value ? String(value) : ''
    const text = htmlToPlainText(raw)
    if (!text) return emptySummary(field)
    const hasHtml = /<[a-z][\s\S]*>/i.test(raw)
    return { label: summaryLabelOf(field), text, html: hasHtml ? raw : undefined, isEmpty: false }
  },
  exportToExcel(value, field) {
    const text = htmlToPlainText(value ? String(value) : '')
    void field
    if (!text) return { value: null }
    return { value: text, isMultiline: text.includes('\n') }
  },
  exportToDocument(value, field) {
    const text = htmlToPlainText(value ? String(value) : '')
    if (!text) return []
    return [{ type: 'text', label: summaryLabelOf(field), content: text }]
  },
})

const textAdapter     = makeAdapter<string>('text')
const textareaAdapter = richTextLike('textarea')
const richtextAdapter = richTextLike('richtext')

const numberAdapter = makeAdapter<number | string>('number', {
  normalizeValue(value) {
    if (isBlank(value)) return null
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : String(value)
  },
  exportToExcel(value) {
    if (isBlank(value)) return { value: null }
    const n = typeof value === 'number' ? value : Number(value)
    return { value: Number.isFinite(n) ? n : String(value) }
  },
})

const dateAdapter   = makeAdapter<string>('date')
const selectAdapter = makeAdapter<string>('select')
const radioAdapter  = makeAdapter<string>('radio')

// ── Booléens & listes ──────────────────────────────────────────────────────

const checkboxAdapter = makeAdapter<boolean>('checkbox', {
  normalizeValue(value) { return value === true },
  formatForSummary(value, field) {
    const on = value === true
    return { label: summaryLabelOf(field), text: on ? `✓ ${field.label}` : '', isEmpty: !on }
  },
  exportToJson(value) { return value === true },
  exportToExcel(value, field) {
    return value === true ? { value: `✓ ${field.label}` } : { value: null }
  },
  exportToDocument(value, field) {
    return value === true ? [{ type: 'text', label: summaryLabelOf(field), content: 'Oui' }] : []
  },
})

const listLike = (type: PluginFieldType) => makeAdapter<string[]>(type, {
  normalizeValue(value) {
    if (!Array.isArray(value)) return null
    const arr = value.filter(v => typeof v === 'string' && v.trim()) as string[]
    return arr.length ? arr : null
  },
  formatForSummary(value, field) {
    const arr = Array.isArray(value) ? value : []
    if (!arr.length) return emptySummary(field)
    return { label: summaryLabelOf(field), text: arr.join(', '), isEmpty: false }
  },
  exportToJson(value) { return Array.isArray(value) ? value : [] },
  exportToExcel(value) {
    const arr = Array.isArray(value) ? value : []
    return arr.length ? { value: arr.join(', ') } : { value: null }
  },
  exportToDocument(value, field) {
    const arr = Array.isArray(value) ? value : []
    if (!arr.length) return []
    return [{ type: 'list', label: summaryLabelOf(field), content: arr }]
  },
})

const checkboxgroupAdapter = listLike('checkboxgroup')
const tagsAdapter          = listLike('tags')

// ── Échelles numériques ────────────────────────────────────────────────────

const scaleLike = (type: PluginFieldType) => makeAdapter<number>(type, {
  normalizeValue(value) {
    if (isBlank(value)) return null
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : null
  },
  formatForSummary(value, field) {
    if (value === null || value === undefined) return emptySummary(field)
    const max = field.max ?? 10
    return { label: summaryLabelOf(field), text: `${value} / ${max}`, isEmpty: false }
  },
  exportToExcel(value, field) {
    if (value === null || value === undefined) return { value: null }
    return { value: `${value} / ${field.max ?? 10}` }
  },
  exportToDocument(value, field) {
    if (value === null || value === undefined) return []
    return [{ type: 'text', label: summaryLabelOf(field), content: `${value} / ${field.max ?? 10}` }]
  },
})

const ratingAdapter = scaleLike('rating')
const sliderAdapter = scaleLike('slider')

// ── before_after ───────────────────────────────────────────────────────────

interface BeforeAfter { before?: number; after?: number }

const beforeAfterAdapter: FieldTypeAdapter<BeforeAfter> = makeAdapter<BeforeAfter>('before_after', {
  normalizeValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const ba = value as BeforeAfter
    const hasBefore = typeof ba.before === 'number'
    const hasAfter = typeof ba.after === 'number'
    if (!hasBefore && !hasAfter) return null
    return ba
  },
  formatForSummary(value, field) {
    if (!value) return emptySummary(field)
    const max = field.max ?? 10
    const parts: string[] = []
    if (typeof value.before === 'number') parts.push(`Avant : ${value.before}/${max}`)
    if (typeof value.after === 'number') parts.push(`Après : ${value.after}/${max}`)
    if (typeof value.before === 'number' && typeof value.after === 'number') {
      const diff = value.after - value.before
      parts.push(`Δ ${diff >= 0 ? '+' : ''}${diff}`)
    }
    if (!parts.length) return emptySummary(field)
    return { label: summaryLabelOf(field), text: parts.join(' · '), isEmpty: false }
  },
  exportToExcel(value, field) {
    const s = beforeAfterAdapter.formatForSummary(value, field)
    return s.isEmpty ? { value: null } : { value: s.text }
  },
  exportToDocument(value, field) {
    const s = beforeAfterAdapter.formatForSummary(value, field)
    return s.isEmpty ? [] : [{ type: 'text', label: summaryLabelOf(field), content: s.text }]
  },
})

// ── repeatable ─────────────────────────────────────────────────────────────

interface RepeatableRow { nom?: string; note?: string }

const repeatableAdapter: FieldTypeAdapter<RepeatableRow[]> = makeAdapter<RepeatableRow[]>('repeatable', {
  normalizeValue(value) {
    if (!Array.isArray(value)) return null
    const rows = (value as RepeatableRow[]).filter(r => r && typeof r === 'object' && r.nom?.trim())
    return rows.length ? rows : null
  },
  formatForSummary(value, field) {
    const rows = Array.isArray(value) ? value.filter(r => r?.nom?.trim()) : []
    if (!rows.length) return emptySummary(field)
    const text = rows.map(r => r.note?.trim() ? `${r.nom} (${r.note})` : r.nom!).join('\n')
    return { label: summaryLabelOf(field), text, isEmpty: false }
  },
  exportToJson(value) { return Array.isArray(value) ? value : [] },
  exportToExcel(value, field) {
    const s = repeatableAdapter.formatForSummary(value, field)
    return s.isEmpty ? { value: null } : { value: s.text, isMultiline: true }
  },
  exportToDocument(value, field) {
    const rows = Array.isArray(value) ? value.filter(r => r?.nom?.trim()) : []
    if (!rows.length) return []
    return [{ type: 'list', label: summaryLabelOf(field),
      content: rows.map(r => r.note?.trim() ? `${r.nom} — ${r.note}` : r.nom!) }]
  },
})

// ── bodychart ──────────────────────────────────────────────────────────────

interface BodyChart {
  front?: string[]; back?: string[]; left?: string[]; right?: string[]
  notes?: string; details?: Record<string, unknown>
}

const bodychartAdapter: FieldTypeAdapter<BodyChart> = makeAdapter<BodyChart>('bodychart', {
  normalizeValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as BodyChart
  },
  formatForSummary(value, field) {
    if (!value) return emptySummary(field)
    const parts = [
      value.front?.length ? `Antérieur : ${value.front.join(', ')}` : '',
      value.back?.length ? `Postérieur : ${value.back.join(', ')}` : '',
      value.left?.length ? `Profil G : ${value.left.join(', ')}` : '',
      value.right?.length ? `Profil D : ${value.right.join(', ')}` : '',
      value.notes?.trim() ? `Notes : ${value.notes.trim()}` : '',
    ].filter(Boolean)
    if (!parts.length) return emptySummary(field)
    return { label: summaryLabelOf(field), text: parts.join(' | '), isEmpty: false }
  },
  exportToExcel(value, field) {
    const s = bodychartAdapter.formatForSummary(value, field)
    return s.isEmpty ? { value: null } : { value: s.text, isMultiline: true }
  },
  exportToDocument(value, field) {
    const s = bodychartAdapter.formatForSummary(value, field)
    return s.isEmpty ? [] : [{ type: 'text', label: summaryLabelOf(field), content: s.text }]
  },
})

// ── separator (aucune donnée) ──────────────────────────────────────────────

const separatorAdapter = makeAdapter('separator', {
  normalizeValue() { return null },
  validateValue() { return ok() },
  formatForSummary(_value, field) { return emptySummary(field) },
  exportToJson() { return null },
  exportToExcel() { return { value: null } },
  exportToDocument() { return [] },
})

// ── Modules (adaptateurs "stub" : export brut garanti) ─────────────────────
//
// Ces types encapsulent des sous-structures riches (voir PluginFieldSummary.tsx
// et exportService.ts pour le rendu détaillé). En Phase 1 on garantit un export
// non destructif : la valeur brute est toujours conservée (exportToJson), et un
// résumé textuel compact est produit. Le rendu fin reste géré par les
// composants existants — ces adaptateurs ne les remplacent pas encore.

const MODULE_TYPES: PluginFieldType[] = [
  'mtc_systemes', 'mtc_five_elements', 'mtc_tongue_pulse', 'mtc_aide_interrogatoire',
  'osteo_ortho_tests', 'osteo_posture',
]

function compactModuleText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          const name = o.name ?? o.nom ?? ''
          const result = o.result ?? ''
          return [name, result].filter(Boolean).join(' : ')
        }
        return String(item)
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof value === 'object') {
    const parts: string[] = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined || v === '') continue
      if (Array.isArray(v)) {
        if (v.length) parts.push(`${k}: ${v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ')}`)
      } else if (typeof v === 'object') {
        const inner = compactModuleText(v)
        if (inner) parts.push(`${k}: ${inner.replace(/\n/g, ' · ')}`)
      } else {
        parts.push(`${k}: ${String(v)}`)
      }
    }
    return parts.join('\n')
  }
  return String(value)
}

function makeModuleAdapter(type: PluginFieldType): FieldTypeAdapter {
  return makeAdapter(type, {
    normalizeValue(value) {
      if (type === 'mtc_aide_interrogatoire') return null
      return isBlank(value) ? null : value
    },
    validateValue() { return ok() },
    formatForSummary(value, field) {
      if (type === 'mtc_aide_interrogatoire') return emptySummary(field)
      const text = compactModuleText(value)
      return { label: summaryLabelOf(field), text, isEmpty: text.trim() === '' }
    },
    exportToJson(value) {
      // Non destructif : la structure brute complète est conservée telle quelle.
      return type === 'mtc_aide_interrogatoire' ? null : (value ?? null)
    },
    exportToExcel(value, field) {
      if (type === 'mtc_aide_interrogatoire') return { value: null }
      const text = compactModuleText(value)
      void field
      return text ? { value: text, isMultiline: text.includes('\n') } : { value: null }
    },
    exportToDocument(value, field) {
      if (type === 'mtc_aide_interrogatoire') return []
      if (isBlank(value)) return []
      // 'raw' : le consommateur peut choisir un rendu spécialisé ; la donnée est intacte.
      return [{ type: 'raw', label: summaryLabelOf(field), content: value }]
    },
  })
}

// ── Registre global ────────────────────────────────────────────────────────

export const fieldAdapterRegistry: Map<string, FieldTypeAdapter> = new Map()

export function registerFieldAdapter(adapter: FieldTypeAdapter): void {
  fieldAdapterRegistry.set(adapter.type, adapter)
}

export function getFieldAdapter(type: string): FieldTypeAdapter | undefined {
  return fieldAdapterRegistry.get(type)
}

// ── Enregistrement des adaptateurs de base ─────────────────────────────────

const BASE_ADAPTERS: FieldTypeAdapter[] = [
  textAdapter,
  textareaAdapter,
  richtextAdapter,
  numberAdapter,
  dateAdapter,
  selectAdapter,
  radioAdapter,
  checkboxAdapter,
  checkboxgroupAdapter,
  tagsAdapter,
  ratingAdapter,
  sliderAdapter,
  beforeAfterAdapter,
  repeatableAdapter,
  bodychartAdapter,
  separatorAdapter,
]

for (const a of BASE_ADAPTERS) registerFieldAdapter(a)
for (const t of MODULE_TYPES) registerFieldAdapter(makeModuleAdapter(t))

/** Adaptateur de repli pour un type inconnu : conserve la valeur brute (jamais de perte). */
export function fallbackAdapter(type: string): FieldTypeAdapter {
  return {
    type: type as PluginFieldType,
    validateConfig() { return { valid: true, errors: [], warnings: [`Type de champ inconnu : "${type}".`] } },
    validateValue() { return ok() },
    normalizeValue(value) { return isBlank(value) ? null : value },
    formatForSummary(value, field) {
      const text = typeof value === 'string' ? value : (isBlank(value) ? '' : JSON.stringify(value))
      return { label: summaryLabelOf(field), text, isEmpty: text.trim() === '' }
    },
    exportToJson(value) { return value ?? null },
    exportToExcel(value) {
      if (isBlank(value)) return { value: null }
      return { value: typeof value === 'string' ? value : JSON.stringify(value) }
    },
    exportToDocument(value, field) {
      if (isBlank(value)) return []
      return [{ type: 'raw', label: summaryLabelOf(field), content: value }]
    },
  }
}

/** Retourne l'adaptateur du type, ou l'adaptateur de repli (jamais undefined). */
export function resolveFieldAdapter(type: string): FieldTypeAdapter {
  return fieldAdapterRegistry.get(type) ?? fallbackAdapter(type)
}

// Réexport pratique
export { OK }
