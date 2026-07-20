/**
 * Tests de l'exporteur Excel canonique (Phase 2).
 * Vérifie : présence des 7 feuilles, absence de "[object Object]", accents.
 * Harness autonome. Exécutable via `npx tsx`.
 */

import { normalizeSession } from '../../main/services/sessionDataNormalizer'
import { buildSessionExcelBuffer } from '../../main/services/exports/sessionExcelExporter'
import type { ExportContext } from '../../shared/exportTypes'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx-js-style') as typeof import('xlsx-js-style')

let passed = 0, failed = 0
const failures: string[] = []
function assert(cond: boolean, msg: string): void { if (cond) passed++; else { failed++; failures.push(msg) } }

function ctx(): ExportContext {
  return {
    patient: { id: 'p1', firstName: 'Élise', lastName: 'Dupré', alerts: 'Allergie' },
    session: { id: 's1', date: '2026-05-01', practitioner: 'Dr X' },
    appVersion: '1.5.7', generatedAt: '2026-05-01T10:00:00Z',
    includeUnknownData: true, language: 'fr',
  }
}

const pluginSchema = {
  id: 'osteo', name: 'Ostéopathie', specialty: 'Ostéo', version: '1.0.0',
  sections: [{ id: 'bilan', title: 'Bilan', fields: [
    { id: 'zones', type: 'bodychart', label: 'Zones' },
    { id: 'tests', type: 'repeatable', label: 'Tests' },
  ] }],
}
const fd = {
  anamnese: 'Anamnèse détaillée',
  systemes: { rate: { checked: ['Ballonnements'], energie: 4 } },
  pluginId: 'osteo', pluginIsBuiltin: false, pluginSchema,
  pluginData: {
    zones: { front: ['Épaule'], back: ['Lombaire'], notes: 'Raideur' },
    tests: [{ nom: 'Lasègue', note: 'positif' }],
  },
}
const raw = {
  id: 's1', patient_id: 'p1', date: '2026-05-01', practitioner: 'Dr X',
  motif: 'Douleur cervicale', diagnostic_mtc: 'Tension',
  systemes_json: JSON.stringify(fd.systemes),
  full_data_json: JSON.stringify(fd),
  created_at: '2026-05-01T10:00:00Z',
}

const patient = {
  id: 'p1', first_name: 'Élise', last_name: 'Dupré', birth_date: '1990-01-01',
  phone: '0600000000', alerts: 'Allergie', consent_given: 1, consent_date: '2026-01-01',
}

function collectCells(wb: import('xlsx-js-style').WorkBook): string[] {
  const out: string[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    for (const addr of Object.keys(ws)) {
      if (addr.startsWith('!')) continue
      const cell = ws[addr] as { v?: unknown }
      if (cell && cell.v !== undefined && cell.v !== null) out.push(String(cell.v))
    }
  }
  return out
}

function testWorkbook(): void {
  const buf = buildSessionExcelBuffer(normalizeSession(raw), ctx(), patient, raw)
  assert(Buffer.isBuffer(buf) && buf.length > 0, 'excel: buffer non vide produit')

  const wb = XLSX.read(buf, { type: 'buffer' })
  const expected = ['Patient', 'Séances', 'Champs', 'Données_répétables', 'Zones_corporelles', 'Modules', 'Métadonnées']
  for (const name of expected) {
    assert(wb.SheetNames.includes(name), `excel: feuille "${name}" présente`)
  }

  const cells = collectCells(wb)
  assert(!cells.some(c => c.includes('[object Object]')), 'excel: aucune cellule "[object Object]"')
  assert(cells.some(c => c.includes('Épaule')), 'excel: zone corporelle avec accent présente')
  assert(cells.some(c => c.includes('Lasègue')), 'excel: donnée répétable avec accent présente')
  assert(cells.some(c => c.includes('Ballonnements')), 'excel: module systèmes aplati présent')
  assert(cells.some(c => c === 'Dupré'), 'excel: nom patient avec accent conservé')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testWorkbook()
  return { passed, failed, failures: [...failures] }
}

const isMain = typeof process !== 'undefined' && Array.isArray(process.argv) &&
  process.argv[1] && /sessionExcelExporter\.test/.test(process.argv[1])
if (isMain) {
  const r = runTests()
  console.log(`\nsessionExcelExporter: ${r.passed} passed, ${r.failed} failed`)
  r.failures.forEach(f => console.error('  x ' + f))
  if (r.failed > 0 && typeof process !== 'undefined') process.exitCode = 1
}
