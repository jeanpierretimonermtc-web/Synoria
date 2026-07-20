/**
 * Tests des exporteurs JSON (Phase 2) : sauvegarde complète + interopérable.
 * Harness autonome. Exécutable via `npx tsx`.
 */

import { normalizeSession } from '../../main/services/sessionDataNormalizer'
import { buildFullBackupJson, buildInteropJson } from '../../main/services/exports/sessionJsonExporter'
import type { ExportContext } from '../../shared/exportTypes'

let passed = 0, failed = 0
const failures: string[] = []
function assert(cond: boolean, msg: string): void { if (cond) passed++; else { failed++; failures.push(msg) } }

function ctx(): ExportContext {
  return {
    patient: { id: 'p1', firstName: 'Élise', lastName: 'Müller', birthDate: '1990-01-01' },
    session: { id: 's1', date: '2026-05-01', practitioner: 'Dr X' },
    appVersion: '1.5.7', generatedAt: '2026-05-01T10:00:00Z',
    includeUnknownData: false, language: 'fr',
  }
}

const pluginSchema = {
  id: 'kinesio', name: 'Kinésiologie', specialty: 'Kinésiologie', version: '2.1.0',
  sections: [{ id: 'sec1', title: 'Bilan', fields: [
    { id: 'stress', type: 'rating', label: 'Stress', max: 10 },
    { id: 'objectif', type: 'richtext', label: 'Objectif' },
  ] }],
}
const fd = {
  pluginId: 'kinesio', pluginIsBuiltin: false, pluginSchema,
  pluginData: { stress: 7, objectif: '<b>Ancrage</b>', horsSchema: 'donnée libre' },
}
const raw = {
  id: 's1', patient_id: 'p1', date: '2026-05-01', practitioner: 'Dr X',
  motif: '<p>Gestion du stress</p>', full_data_json: JSON.stringify(fd),
  created_at: '2026-05-01T10:00:00Z', updated_at: '2026-05-01T10:20:00Z',
}

function testFullBackup(): void {
  const canonical = normalizeSession(raw)
  const json = buildFullBackupJson(raw, canonical, { id: 'p1', last_name: 'Müller' }, '1.5.7')
  let parsed: Record<string, unknown> = {}
  let threw = false
  try { parsed = JSON.parse(json) } catch { threw = true }
  assert(!threw, 'full: JSON parseable')
  assert(parsed.exportType === 'synoria-session-backup', 'full: exportType correct')
  assert(parsed.exportVersion === '2.0.0', 'full: exportVersion 2.0.0')
  assert(!!parsed.rawSession, 'full: rawSession présent (fidélité)')
  assert(!!parsed.canonicalSession, 'full: canonicalSession présent')
  assert(!!parsed.formSnapshot, 'full: formSnapshot présent')
  // Fidélité : la donnée hors schéma survit dans rawSession
  assert(json.includes('donnée libre'), 'full: donnée hors schéma conservée (aucune perte)')
  const comp = parsed.compatibility as { legacyPluginSchemaIncluded?: boolean }
  assert(comp?.legacyPluginSchemaIncluded === true, 'full: schéma legacy signalé inclus')
}

function testInterop(): void {
  const canonical = normalizeSession(raw)
  const json = buildInteropJson(canonical, ctx())
  let parsed: Record<string, unknown> = {}
  let threw = false
  try { parsed = JSON.parse(json) } catch { threw = true }
  assert(!threw, 'interop: JSON parseable')
  assert(parsed.format === 'synoria-interoperable-session', 'interop: format stable')
  assert(parsed.version === '1.0.0', 'interop: version stable')
  const sections = parsed.sections as Array<{ title: string; fields: Array<{ dataKey: string; type: string; value: unknown }> }>
  assert(Array.isArray(sections) && sections.some(s => s.title === 'Bilan'), 'interop: section Bilan reconstruite depuis le schéma')
  const stressField = sections.flatMap(s => s.fields).find(f => f.type === 'rating')
  assert(!!stressField && stressField.value === 7, 'interop: valeur rating conservée')
  // Donnée hors schéma → uninterpretedData (jamais perdue)
  const uninterp = parsed.uninterpretedData as Array<{ fieldId: string; value: unknown }>
  assert(Array.isArray(uninterp) && uninterp.some(u => u.value === 'donnée libre'), 'interop: donnée inconnue isolée mais conservée')
  // summary lisible
  const summary = parsed.summary as Record<string, string>
  assert(!!summary && Object.keys(summary).length > 0, 'interop: résumé lisible peuplé')
  // Accents préservés
  assert(json.includes('Müller') || (parsed.patient as { lastName: string }).lastName === 'Müller', 'interop: accents patient préservés')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testFullBackup(); testInterop()
  return { passed, failed, failures: [...failures] }
}

const isMain = typeof process !== 'undefined' && Array.isArray(process.argv) &&
  process.argv[1] && /sessionJsonExporter\.test/.test(process.argv[1])
if (isMain) {
  const r = runTests()
  console.log(`\nsessionJsonExporter: ${r.passed} passed, ${r.failed} failed`)
  r.failures.forEach(f => console.error('  x ' + f))
  if (r.failed > 0 && typeof process !== 'undefined') process.exitCode = 1
}
