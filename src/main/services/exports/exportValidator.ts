/**
 * Validation pré-export d'une séance canonique (Phase 2).
 *
 * Ne modifie jamais la donnée. Produit des `issues` structurées :
 *   - warning : type de champ inconnu, module inconnu, libellé manquant,
 *               schéma d'une version antérieure, champ déprécié…
 *   - error   : séance totalement illisible / structure canonique vide.
 *
 * Aucune écriture, aucune exception : fonction pure et synchrone.
 */

import type { CanonicalSessionData } from '../../../shared/sessionDataTypes'
import { CANONICAL_SCHEMA_VERSION } from '../../../shared/sessionDataTypes'
import type { ExportResult, ExportIssue } from '../../../shared/exportTypes'
import { getFieldAdapter } from '../../../shared/pluginFieldAdapters'
import { getTypeEntry } from '../../../shared/pluginRegistry'
import type { PluginFieldType } from '../../../shared/pluginTypes'

export function validateBeforeExport(canonical: CanonicalSessionData): ExportResult<void> {
  const issues: ExportIssue[] = []

  if (!canonical || typeof canonical !== 'object') {
    return { success: false, issues: [{ severity: 'error', code: 'CANONICAL_MISSING',
      message: 'Structure canonique absente — export impossible.' }] }
  }

  // Remonter les avertissements produits par la normalisation.
  for (const w of canonical.normalization?.warnings ?? []) {
    issues.push({ severity: w.severity, code: w.code, message: w.message,
      fieldId: w.fieldId, dataKey: w.dataKey, moduleId: w.moduleId })
  }

  const coreCount   = Object.keys(canonical.core ?? {}).length
  const fieldCount  = Object.keys(canonical.fields ?? {}).length
  const moduleCount = Object.keys(canonical.modules ?? {}).length

  // Séance totalement vide de contenu clinique : illisible en tant que rapport.
  if (coreCount === 0 && fieldCount === 0 && moduleCount === 0) {
    issues.push({ severity: 'error', code: 'EMPTY_SESSION',
      message: 'Aucune donnée exploitable dans la séance (core, champs et modules vides).' })
  }

  // Schéma d'une version antérieure au schéma canonique courant.
  if (canonical.schemaVersion && canonical.schemaVersion !== CANONICAL_SCHEMA_VERSION) {
    issues.push({ severity: 'warning', code: 'OLD_SCHEMA_VERSION',
      message: `Séance normalisée en version ${canonical.schemaVersion} (courante : ${CANONICAL_SCHEMA_VERSION}).` })
  }

  // Champs : type inconnu / libellé manquant / déprécié.
  for (const f of Object.values(canonical.fields ?? {})) {
    if (f.type === 'unknown' || !getFieldAdapter(f.type)) {
      issues.push({ severity: 'warning', code: 'UNKNOWN_FIELD_TYPE', fieldId: f.fieldId, dataKey: f.dataKey,
        message: `Champ "${f.fieldId}" de type inconnu "${f.type}" — exporté en brut.` })
    }
    if (!f.labelSnapshot || !f.labelSnapshot.trim()) {
      issues.push({ severity: 'warning', code: 'MISSING_LABEL', fieldId: f.fieldId, dataKey: f.dataKey,
        message: `Champ "${f.fieldId}" sans libellé — l'identifiant technique sera utilisé.` })
    }
    if (f.deprecated) {
      issues.push({ severity: 'warning', code: 'DEPRECATED_FIELD', fieldId: f.fieldId, dataKey: f.dataKey,
        message: `Champ "${f.fieldId}" déprécié — conservé pour l'historique.` })
    }
  }

  // Modules : type/registre inconnu.
  const KNOWN_CORE_MODULES = new Set(['mtc_systemes', 'energy_tests', 'mtc_pouls_positions'])
  for (const m of Object.values(canonical.modules ?? {})) {
    const known = KNOWN_CORE_MODULES.has(m.moduleId) ||
      !!getTypeEntry(m.moduleId as PluginFieldType)
    if (!known) {
      issues.push({ severity: 'warning', code: 'UNKNOWN_MODULE', moduleId: m.moduleId,
        message: `Module "${m.moduleId}" non reconnu — données conservées en brut.` })
    }
  }

  const hasError = issues.some(i => i.severity === 'error')
  return { success: !hasError, issues }
}
