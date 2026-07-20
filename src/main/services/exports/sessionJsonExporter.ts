/**
 * Export JSON d'une séance (Phase 2) — deux formats distincts et non mélangés.
 *
 *   buildFullBackupJson  → sauvegarde technique : fidélité MAXIMALE, aucune perte.
 *                          Contient la ligne brute, la structure canonique et le
 *                          snapshot de formulaire. Destinée à la restauration.
 *
 *   buildInteropJson     → format interopérable : structure lisible et STABLE,
 *                          pensée pour l'échange avec des tiers. Ne contient que
 *                          des données interprétées + les données non reconnues
 *                          isolées dans `uninterpretedData` (toujours conservées).
 *
 * Fonctions pures et synchrones. Aucune dépendance Node.js.
 */

import type { CanonicalSessionData } from '../../../shared/sessionDataTypes'
import type { ExportContext } from '../../../shared/exportTypes'
import type { PluginDefinition } from '../../../shared/pluginTypes'
import { resolveFieldAdapter } from '../../../shared/pluginFieldAdapters'

const FULL_EXPORT_VERSION   = '2.0.0'
const INTEROP_EXPORT_VERSION = '1.0.0'

// ── Sauvegarde complète (fidélité maximale) ─────────────────────────────────

export function buildFullBackupJson(
  rawSession: unknown,
  canonical: CanonicalSessionData,
  patient: unknown,
  appVersion: string,
): string {
  const payload = {
    exportType: 'synoria-session-backup',
    exportVersion: FULL_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    applicationVersion: appVersion,
    patient: patient ?? null,
    rawSession: rawSession ?? null,
    canonicalSession: canonical,
    formSnapshot: canonical.formSnapshot,
    compatibility: {
      legacyPluginSchemaIncluded: !!canonical.formSnapshot?.pluginDefinition,
    },
  }
  return JSON.stringify(payload, null, 2)
}

// ── Format interopérable (lisible et stable) ────────────────────────────────

interface InteropField {
  dataKey: string
  label: string
  type: string
  value: unknown
  text?: string
}

function readableText(type: string, value: unknown, label: string): string | undefined {
  const adapter = resolveFieldAdapter(type)
  const pf = { id: label, type: type as never, label } as never
  const summary = adapter.formatForSummary(adapter.normalizeValue(value, pf), pf)
  return summary.isEmpty ? undefined : summary.text
}

export function buildInteropJson(
  canonical: CanonicalSessionData,
  context: ExportContext,
): string {
  const schema = (canonical.formSnapshot?.pluginDefinition as PluginDefinition | undefined) ?? null

  // core : dictionnaire dataKey → {label,type,value}
  const core: Record<string, InteropField> = {}
  for (const fv of Object.values(canonical.core ?? {})) {
    core[fv.dataKey] = {
      dataKey: fv.dataKey, label: fv.labelSnapshot, type: fv.type, value: fv.value,
      text: readableText(fv.type, fv.value, fv.labelSnapshot),
    }
  }

  // sections : reconstruites depuis le schéma du formulaire quand disponible
  const sections: Array<{ id: string; title: string; fields: InteropField[] }> = []
  const consumed = new Set<string>()
  if (schema && Array.isArray(schema.sections)) {
    for (const sec of schema.sections) {
      if (!sec || !Array.isArray(sec.fields)) continue
      const fields: InteropField[] = []
      for (const f of sec.fields) {
        if (!f || typeof f.id !== 'string') continue
        const fv = canonical.fields?.[f.id]
        if (!fv) continue
        consumed.add(f.id)
        fields.push({
          dataKey: fv.dataKey,
          label: f.summaryLabel ?? f.summary?.label ?? f.label ?? fv.labelSnapshot,
          type: fv.type,
          value: fv.value,
          text: readableText(fv.type, fv.value, fv.labelSnapshot),
        })
      }
      if (fields.length) sections.push({ id: sec.id, title: sec.title, fields })
    }
  }

  // Champs plugin restants (hors schéma ou sans section) qui sont interprétables
  const orphanFields: InteropField[] = []
  const uninterpretedData: Array<{ fieldId: string; dataKey: string; value: unknown }> = []
  for (const fv of Object.values(canonical.fields ?? {})) {
    if (consumed.has(fv.fieldId)) continue
    if (fv.type === 'unknown') {
      uninterpretedData.push({ fieldId: fv.fieldId, dataKey: fv.dataKey, value: fv.value })
    } else {
      orphanFields.push({
        dataKey: fv.dataKey, label: fv.labelSnapshot, type: fv.type, value: fv.value,
        text: readableText(fv.type, fv.value, fv.labelSnapshot),
      })
    }
  }
  if (orphanFields.length) {
    sections.push({ id: 'autres', title: 'Autres champs', fields: orphanFields })
  }

  // modules
  const modules = Object.values(canonical.modules ?? {}).map(m => ({
    moduleId: m.moduleId, schemaVersion: m.schemaVersion, version: m.version, data: m.data,
  }))

  // summary : dictionnaire plat dataKey → texte lisible
  const summary: Record<string, string> = {}
  for (const fv of [...Object.values(canonical.core ?? {}), ...Object.values(canonical.fields ?? {})]) {
    const t = readableText(fv.type, fv.value, fv.labelSnapshot)
    if (t) summary[fv.dataKey] = t
  }

  const payload = {
    format: 'synoria-interoperable-session',
    version: INTEROP_EXPORT_VERSION,
    generatedAt: context.generatedAt,
    applicationVersion: context.appVersion,
    patient: {
      id: context.patient.id,
      firstName: context.patient.firstName,
      lastName: context.patient.lastName,
      birthDate: context.patient.birthDate,
    },
    session: {
      id: canonical.sessionId,
      date: context.session.date,
      type: canonical.formProfile.id,
      practitioner: context.session.practitioner,
    },
    core,
    sections,
    modules,
    summary,
    uninterpretedData,
  }
  return JSON.stringify(payload, null, 2)
}
