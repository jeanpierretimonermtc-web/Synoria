/**
 * Export Excel canonique d'une (ou plusieurs) séance(s) — Phase 2.
 *
 * Toute l'interprétation passe par la structure canonique et les adaptateurs de
 * champ : aucune logique de lecture des blobs legacy n'est dupliquée ici.
 *
 * Classeur à 7 feuilles :
 *   1. Patient             — identité, coordonnées, consentement, alertes
 *   2. Séances             — une ligne par séance
 *   3. Champs              — une ligne par valeur de champ (core + plugin)
 *   4. Données_répétables  — une ligne par élément de champ repeatable
 *   5. Zones_corporelles   — une ligne par zone de bodychart
 *   6. Modules             — données de modules aplaties (chemin → valeur)
 *   7. Métadonnées         — version, date d'export, avertissements
 *
 * Règles : jamais de "[object Object]" ; les valeurs complexes sont sérialisées
 * en JSON dans une colonne "valeur_brute" ; les accents sont préservés (xlsx
 * écrit en UTF-8). Aucune troncature silencieuse.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx-js-style') as typeof import('xlsx-js-style')

import type { CanonicalSessionData, CanonicalFieldValue } from '../../../shared/sessionDataTypes'
import type { ExportContext } from '../../../shared/exportTypes'
import type { PluginDefinition } from '../../../shared/pluginTypes'
import { resolveFieldAdapter } from '../../../shared/pluginFieldAdapters'

export interface ExcelSessionEntry {
  canonical: CanonicalSessionData
  context: ExportContext
  rawSession?: unknown
}

// ── Helpers de cellule ──────────────────────────────────────────────────────

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '4A6741' }, patternType: 'solid' },
  alignment: { vertical: 'center', wrapText: true },
}

function txt(v: string | number | boolean | null | undefined): { v: string | number; t: 's' | 'n' } {
  if (typeof v === 'number' && Number.isFinite(v)) return { v, t: 'n' }
  if (v === null || v === undefined) return { v: '', t: 's' }
  if (typeof v === 'boolean') return { v: v ? 'Oui' : 'Non', t: 's' }
  return { v: String(v), t: 's' }
}

function headerRow(cols: string[]): unknown[] {
  return cols.map(c => ({ v: c, t: 's', s: HEADER_STYLE }))
}

function sheetFromRows(cols: string[], rows: (string | number | boolean | null | undefined)[][]): unknown {
  const aoa: unknown[][] = [headerRow(cols)]
  for (const r of rows) aoa.push(r.map(txt))
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = cols.map((_, i) => ({ wch: i === 0 ? 20 : 34 }))
  return ws
}

// ── Interprétation ──────────────────────────────────────────────────────────

function readable(fv: CanonicalFieldValue): string {
  const adapter = resolveFieldAdapter(fv.type)
  const pf = { id: fv.fieldId, type: fv.type as never, label: fv.labelSnapshot } as never
  const s = adapter.formatForSummary(adapter.normalizeValue(fv.value, pf), pf)
  return s.isEmpty ? '' : s.text
}

function rawJson(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return ''
  try { return JSON.stringify(value) } catch { return String(value) }
}

function flatten(obj: unknown, prefix: string, out: Array<[string, string]>): void {
  if (obj === null || obj === undefined || obj === '') return
  if (Array.isArray(obj)) {
    const allPrim = obj.every(x => x === null || typeof x !== 'object')
    if (allPrim) {
      if (obj.length) out.push([prefix, obj.map(x => String(x)).join(', ')])
    } else {
      obj.forEach((x, i) => flatten(x, `${prefix}[${i}]`, out))
    }
    return
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k
      flatten(v, path, out)
    }
    return
  }
  out.push([prefix, String(obj)])
}

// ── Index schéma → section par champ ────────────────────────────────────────

function sectionOf(schema: PluginDefinition | null, fieldId: string): string {
  if (!schema || !Array.isArray(schema.sections)) return 'plugin'
  for (const sec of schema.sections) {
    if (Array.isArray(sec.fields) && sec.fields.some(f => f && f.id === fieldId)) return sec.id
  }
  return 'plugin'
}

// ── Construction du classeur ────────────────────────────────────────────────

export function buildSessionsExcelBuffer(entries: ExcelSessionEntry[], patient: unknown): Buffer {
  const wb = XLSX.utils.book_new()
  const p = (patient ?? {}) as Record<string, unknown>
  const warnings: Array<[string, string]> = []

  // ── 1. Patient ──
  const consent = p.consent_given ? `Oui${p.consent_date ? ` (${p.consent_date})` : ''}` : 'Non'
  const patientRows: (string | number | null | undefined)[][] = [
    ['Nom', String(p.last_name ?? '')],
    ['Prénom', String(p.first_name ?? '')],
    ['Date de naissance', String(p.birth_date ?? '')],
    ['Téléphone', String(p.phone ?? '')],
    ['Email', String(p.email ?? '')],
    ['Adresse', String(p.address ?? '')],
    ['Profession', String(p.profession ?? '')],
    ['Médecin traitant', String(p.regular_doctor ?? '')],
    ['Médicaments', String(p.medications ?? '')],
    ['Antécédents', String(p.antecedents ?? '')],
    ['Alertes', String(p.alerts ?? '')],
    ['Consentement RGPD', consent],
  ]
  XLSX.utils.book_append_sheet(wb, sheetFromRows(['Champ', 'Valeur'], patientRows), 'Patient')

  // ── 2. Séances ──
  const seanceRows: (string | number | null | undefined)[][] = []
  // ── 3. Champs ──
  const champRows: (string | number | null | undefined)[][] = []
  // ── 4. Données répétables ──
  const repRows: (string | number | null | undefined)[][] = []
  // ── 5. Zones corporelles ──
  const zoneRows: (string | number | null | undefined)[][] = []
  // ── 6. Modules ──
  const moduleRows: (string | number | null | undefined)[][] = []

  for (const { canonical, context } of entries) {
    const sid = canonical.sessionId
    const schema = (canonical.formSnapshot?.pluginDefinition as PluginDefinition | undefined) ?? null

    seanceRows.push([
      sid,
      context.session.date,
      context.session.practitioner ?? (canonical.core['core.practitioner']?.value as string ?? ''),
      readable(canonical.core['core.motif'] ?? { fieldId: 'motif', dataKey: 'core.motif', type: 'richtext', labelSnapshot: 'Motif', value: '' }),
      canonical.formProfile.id,
      canonical.formProfile.pluginId ?? '',
      canonical.formProfile.pluginVersion ?? canonical.formProfile.version,
    ])

    // Champs core + plugin
    const allFields: Array<{ sectionId: string; fv: CanonicalFieldValue }> = []
    for (const fv of Object.values(canonical.core ?? {})) allFields.push({ sectionId: 'core', fv })
    for (const fv of Object.values(canonical.fields ?? {})) allFields.push({ sectionId: sectionOf(schema, fv.fieldId), fv })

    for (const { sectionId, fv } of allFields) {
      champRows.push([sid, sectionId, fv.fieldId, fv.dataKey, fv.labelSnapshot, fv.type, readable(fv), rawJson(fv.value)])

      // repeatable
      if (fv.type === 'repeatable' && Array.isArray(fv.value)) {
        (fv.value as Array<{ nom?: string; note?: string }>).forEach((r, i) => {
          if (r && typeof r === 'object' && (r.nom || r.note)) {
            repRows.push([sid, fv.dataKey, i + 1, String(r.nom ?? ''), String(r.note ?? '')])
          }
        })
      }
      // bodychart
      if (fv.type === 'bodychart' && fv.value && typeof fv.value === 'object' && !Array.isArray(fv.value)) {
        const bc = fv.value as Record<string, unknown>
        const VIEW_LABELS: Record<string, string> = { front: 'Antérieur', back: 'Postérieur', left: 'Profil gauche', right: 'Profil droit' }
        for (const view of ['front', 'back', 'left', 'right']) {
          const zones = bc[view]
          if (Array.isArray(zones)) for (const z of zones) zoneRows.push([sid, fv.dataKey, VIEW_LABELS[view], String(z)])
        }
      }
    }

    // Modules
    for (const mod of Object.values(canonical.modules ?? {})) {
      const flat: Array<[string, string]> = []
      flatten(mod.data, '', flat)
      for (const [path, val] of flat) moduleRows.push([sid, mod.moduleId, path, val])
    }

    // Avertissements de normalisation
    for (const w of canonical.normalization?.warnings ?? []) {
      warnings.push([sid, `${w.severity.toUpperCase()} [${w.code}] ${w.message}`])
    }
  }

  XLSX.utils.book_append_sheet(wb, sheetFromRows(
    ['sessionId', 'date', 'praticien', 'motif', 'profil', 'plugin', 'version'], seanceRows), 'Séances')
  XLSX.utils.book_append_sheet(wb, sheetFromRows(
    ['sessionId', 'sectionId', 'fieldId', 'dataKey', 'label', 'type', 'valeur_lisible', 'valeur_brute'], champRows), 'Champs')
  XLSX.utils.book_append_sheet(wb, sheetFromRows(
    ['sessionId', 'dataKey', 'index', 'nom', 'note'], repRows), 'Données_répétables')
  XLSX.utils.book_append_sheet(wb, sheetFromRows(
    ['sessionId', 'dataKey', 'vue', 'zoneId'], zoneRows), 'Zones_corporelles')
  XLSX.utils.book_append_sheet(wb, sheetFromRows(
    ['sessionId', 'moduleId', 'chemin', 'valeur_lisible'], moduleRows), 'Modules')

  // ── 7. Métadonnées ──
  const meta: (string | number | null | undefined)[][] = [
    ['Application', `Synoria v${entries[0]?.context.appVersion ?? ''}`],
    ['Date export', new Date().toISOString()],
    ['Nombre de séances', entries.length],
    ['Schéma canonique', entries[0]?.canonical.schemaVersion ?? ''],
    ...warnings.map(([sid, msg]) => [`Avertissement (${sid})`, msg] as (string | number)[]),
  ]
  XLSX.utils.book_append_sheet(wb, sheetFromRows(['Clé', 'Valeur'], meta), 'Métadonnées')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export function buildSessionExcelBuffer(
  canonical: CanonicalSessionData,
  context: ExportContext,
  patient: unknown,
  rawSession?: unknown,
): Buffer {
  return buildSessionsExcelBuffer([{ canonical, context, rawSession }], patient)
}
