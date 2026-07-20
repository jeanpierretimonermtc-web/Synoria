/**
 * Tests d'intégration Phase 5.
 *
 * Vérifie que le pipeline complet fonctionne :
 *   normalizeSession → buildSessionExportDocument
 *
 * Tests clés :
 *   1. Séance MTC avec systemes_json → blocs keyvalue via mtcSystemesAdapter
 *   2. Séance avec energy_tests (pas d'adaptateur P4) → fallback générique, aucune perte
 *   3. Séance sans modules → pas de blocs parasites
 *   4. Module osteo_ortho_tests → table avec `columns` (pas `headers`)
 *   5. Module mtc_five_elements → blocs keyvalue
 *   6. Données corrompues (systemes_json invalide) → pas d'exception
 *   7. includeUnknownData=true → blocs raw présents pour les modules sans adaptateur
 */

// Enregistre les adaptateurs avant tout
import '../../main/services/moduleAdapters/index'

import { normalizeSession } from '../../main/services/sessionDataNormalizer'
import { buildSessionExportDocument } from '../../main/services/exports/exportDocumentBuilder'
import type { ExportContext } from '../../shared/exportDocumentTypes'
import type { ExportBlock } from '../../shared/exportDocumentTypes'

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string): void {
  if (cond) passed++
  else { failed++; failures.push(msg) }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  assert(actual === expected, `${msg} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`)
}

function makeCtx(overrides?: Partial<ExportContext>): ExportContext {
  return {
    patient: { id: 'p1', firstName: 'Marie', lastName: 'Dupont' },
    session: { id: 's1', date: '2024-03-15', practitioner: 'JP Timoner' },
    appVersion: '1.3.0',
    generatedAt: '2024-03-15T10:00:00Z',
    includeUnknownData: false,
    language: 'fr',
    ...overrides,
  }
}

function makeSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's1',
    patient_id: 'p1',
    date: '2024-03-15',
    practitioner: 'JP Timoner',
    motif: 'Fatigue chronique',
    evolution: '',
    evolution_tags: '',
    problematiques: '',
    observation: '',
    langue: '', pouls: '', constitution: '', type_corps: '', teint: '',
    diagnostic_mtc: '', cinq_elements: '', causes: '', analyse: '', principes: '',
    points: '', pts_oreille: '', techniques: '', plantes: '', reactions: '',
    traitement_notes: '', conseils: '', plan: '', surveiller: '',
    next_session_date: '',
    systemes_json: null,
    energy_tests_json: null,
    full_data_json: null,
    created_at: '2024-03-15T08:00:00Z',
    updated_at: '2024-03-15T09:00:00Z',
    ...overrides,
  }
}

type KvBlock = { type: 'keyvalue'; label: string; value: string }
type TableBlock = { type: 'table'; columns: string[]; rows: string[][] }

function evalBlocks(doc: ReturnType<typeof buildSessionExportDocument>): ExportBlock[] {
  return doc.sections.find(s => s.id === 'evaluation')?.blocks ?? []
}

// ── Test 1 : systemes_json → blocs keyvalue Phase 4 ─────────────────────────
function testMtcSystemesAdapter(): void {
  const raw = makeSession({
    systemes_json: JSON.stringify({
      coeur: { checked: ['Palpitations', 'Insomnie'], note: 'Stase Sang Cœur', energie: 6 },
      rein:  { checked: [], note: '', energie: 3 },
      foie:  { checked: ['Stress'], note: '' },
    }),
    full_data_json: JSON.stringify({ pluginId: 'mtc_jp', pluginIsBuiltin: true }),
  })
  const canonical = normalizeSession(raw)
  assert('mtc_systemes' in canonical.modules, 'p5/1: mtc_systemes dans modules')

  const doc = buildSessionExportDocument(canonical, makeCtx())
  const blocks = evalBlocks(doc)
  const kvBlocks = blocks.filter(b => b.type === 'keyvalue') as KvBlock[]
  assert(kvBlocks.length >= 2, 'p5/1: au moins 2 blocs keyvalue pour systemes')
  const coeurBlock = kvBlocks.find(b => b.label.includes('Cœur'))
  assert(!!coeurBlock, 'p5/1: bloc Cœur/Grêle présent')
  assert(coeurBlock!.value.includes('Palpitations'), 'p5/1: Palpitations dans la valeur')
  assert(coeurBlock!.value.includes('Énergie 6/10'), 'p5/1: énergie dans la valeur')
  // Vérifier qu'on n'a PAS de bloc 'raw' non désiré pour ce module
  const rawForSystemes = blocks.filter(b => b.type === 'raw' && (b as any).label?.includes('systèmes'))
  eq(rawForSystemes.length, 0, 'p5/1: pas de bloc raw résiduel pour mtc_systemes')
}

// ── Test 2 : energy_tests (sans adaptateur P4) → fallback générique ──────────
function testEnergyTestsFallback(): void {
  const raw = makeSession({
    energy_tests_json: JSON.stringify({
      'Foie-Vésicule': { value: 7, note: 'Déficient' },
      'Rein-Vessie':   { value: 5, note: '' },
    }),
    full_data_json: JSON.stringify({ pluginId: 'mtc_jp', pluginIsBuiltin: true }),
  })
  const canonical = normalizeSession(raw)
  assert('energy_tests' in canonical.modules, 'p5/2: energy_tests dans modules')

  const doc = buildSessionExportDocument(canonical, makeCtx())
  const blocks = evalBlocks(doc)
  // Le fallback générique produit un bloc text ou raw — l'important est qu'aucune exception
  // ne soit levée et que les données ne soient pas perdues
  const allBlocks = doc.sections.flatMap(s => s.blocks)
  const hasEnergyData = allBlocks.some(b =>
    (b.type === 'text' && (b as any).content?.includes('Foie')) ||
    (b.type === 'raw' && JSON.stringify((b as any).jsonValue)?.includes('Foie'))
  )
  assert(hasEnergyData, 'p5/2: données energy_tests présentes dans le document (fallback)')
}

// ── Test 3 : séance sans modules → aucun bloc parasite ───────────────────────
function testNoModules(): void {
  const raw = makeSession({ motif: 'Bilan de santé' })
  const canonical = normalizeSession(raw)
  eq(Object.keys(canonical.modules).length, 0, 'p5/3: aucun module')
  const doc = buildSessionExportDocument(canonical, makeCtx())
  const motifSection = doc.sections.find(s => s.id === 'motif')
  assert(!!motifSection, 'p5/3: section motif présente')
  const evalSection = doc.sections.find(s => s.id === 'evaluation')
  // Section evaluation peut exister mais sans blocs de modules
  const moduleBlocks = evalSection?.blocks.filter(b => b.type !== 'text' && b.type !== 'keyvalue') ?? []
  eq(moduleBlocks.length, 0, 'p5/3: pas de blocs non-textuels dans evaluation')
}

// ── Test 4 : osteo_ortho_tests → ExportTableBlock avec `columns` ─────────────
function testOsteoOrthoTable(): void {
  const raw = makeSession({
    full_data_json: JSON.stringify({
      pluginId: 'osteopathie',
      pluginIsBuiltin: false,
      pluginData: {
        tests_ortho: [
          { nom: 'Lasègue', resultat: 'positif', note: 'à 45°' },
          { nom: 'Patrick', resultat: 'negatif' },
        ],
      },
      pluginSchema: {
        id: 'osteopathie', name: 'Ostéopathie', version: '1.0.0', specialty: 'Ostéo',
        sections: [{
          id: 's1', title: 'Tests', fields: [
            { id: 'tests_ortho', type: 'osteo_ortho_tests', label: 'Tests ortho' },
          ],
        }],
      },
    }),
  })
  const canonical = normalizeSession(raw)
  assert('tests_ortho' in canonical.modules, 'p5/4: tests_ortho dans modules')

  const doc = buildSessionExportDocument(canonical, makeCtx())
  const allBlocks = doc.sections.flatMap(s => s.blocks)
  const tableBlock = allBlocks.find(b => b.type === 'table') as TableBlock | undefined
  assert(!!tableBlock, 'p5/4: bloc table présent')
  assert(Array.isArray(tableBlock!.columns), 'p5/4: columns est un tableau')
  eq(tableBlock!.columns[0], 'Test', 'p5/4: première colonne = Test')
  assert(tableBlock!.rows.some(r => r[0] === 'Lasègue'), 'p5/4: Lasègue dans les lignes')
}

// ── Test 5 : mtc_five_elements → blocs keyvalue ──────────────────────────────
function testFiveElementsBlocks(): void {
  const raw = makeSession({
    full_data_json: JSON.stringify({
      pluginId: 'osteopathie', // n'importe quel plugin
      pluginIsBuiltin: false,
      pluginData: {
        five_el: { selected: ['Eau', 'Métal'], notes: 'Fragilité rénale' },
      },
      pluginSchema: {
        id: 'osteopathie', name: 'Test', version: '1.0.0', specialty: 'MTC',
        sections: [{
          id: 's1', title: '5E', fields: [
            { id: 'five_el', type: 'mtc_five_elements', label: '5 Éléments' },
          ],
        }],
      },
    }),
  })
  const canonical = normalizeSession(raw)
  assert('five_el' in canonical.modules, 'p5/5: five_el dans modules')

  const doc = buildSessionExportDocument(canonical, makeCtx())
  const allBlocks = doc.sections.flatMap(s => s.blocks)
  const kvBlocks = allBlocks.filter(b => b.type === 'keyvalue') as KvBlock[]
  const elemBlock = kvBlocks.find(b => b.label === 'Éléments concernés')
  assert(!!elemBlock, 'p5/5: bloc Éléments concernés présent')
  assert(elemBlock!.value.includes('Eau'), 'p5/5: Eau dans la valeur')
}

// ── Test 6 : données corrompues → aucune exception ───────────────────────────
function testCorruptedData(): void {
  const raw = makeSession({
    systemes_json: 'INVALID_JSON{{{',
    energy_tests_json: '[]',
    full_data_json: JSON.stringify({ pluginId: 'mtc_jp', pluginIsBuiltin: true }),
  })
  let threw = false
  try {
    const canonical = normalizeSession(raw)
    buildSessionExportDocument(canonical, makeCtx())
  } catch {
    threw = true
  }
  assert(!threw, 'p5/6: pas d\'exception sur données corrompues')
}

// ── Test 7 : includeUnknownData=true → blocs raw pour fallback ───────────────
function testIncludeUnknownData(): void {
  const raw = makeSession({
    energy_tests_json: JSON.stringify({ 'Foie': { value: 8 } }),
    full_data_json: JSON.stringify({ pluginId: 'mtc_jp', pluginIsBuiltin: true }),
  })
  const canonical = normalizeSession(raw)
  const doc = buildSessionExportDocument(canonical, makeCtx({ includeUnknownData: true }))
  const allBlocks = doc.sections.flatMap(s => s.blocks)
  // Le bloc raw "données complètes" devrait être présent (energy_tests n'a pas d'adaptateur P4)
  const rawBlock = allBlocks.find(b => b.type === 'raw' && (b as any).label?.includes('complètes'))
  assert(!!rawBlock, 'p5/7: bloc raw "données complètes" pour energy_tests')
}

// ── Runner ────────────────────────────────────────────────────────────────────

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testMtcSystemesAdapter()
  testEnergyTestsFallback()
  testNoModules()
  testOsteoOrthoTable()
  testFiveElementsBlocks()
  testCorruptedData()
  testIncludeUnknownData()
  return { passed, failed, failures: [...failures] }
}

declare const require: unknown
declare const module: unknown
const isMain = typeof require !== 'undefined' && typeof module !== 'undefined' &&
  (require as { main?: unknown }).main === module
if (isMain) {
  const r = runTests()
  console.log(`\nexportPipeline: ${r.passed} passed, ${r.failed} failed`)
  if (r.failed > 0) {
    r.failures.forEach(f => console.error('  ✗ ' + f))
    if (typeof process !== 'undefined') process.exitCode = 1
  }
}
