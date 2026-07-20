/**
 * Tests du registre de modules versionnés (Phase 4).
 *
 * Importe l'index des adaptateurs pour les enregistrer, puis vérifie :
 *   - que tous les modules natifs sont enregistrés
 *   - que chaque adaptateur normalise, résume et exporte correctement
 *   - que la migration en version identique est transparente
 *   - que les données corrompues ne lèvent pas d'exception
 */

import '../../main/services/moduleAdapters/index'
import {
  getModuleAdapter,
  getModuleDefinition,
  MODULE_DEFINITIONS,
  isModuleFieldType,
  getModulesBySpecialty,
} from '../../shared/pluginModuleRegistry'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string): void {
  if (cond) passed++
  else { failed++; failures.push(msg) }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  assert(actual === expected, `${msg} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`)
}

// ── 1. Tous les modules ont une définition ────────────────────────────────────
function testDefinitions(): void {
  eq(MODULE_DEFINITIONS.length, 6, 'defs: 6 modules définis')
  for (const def of MODULE_DEFINITIONS) {
    assert(!!def.id, `defs: id présent (${def.fieldType})`)
    assert(!!def.name, `defs: name présent (${def.fieldType})`)
    assert(isModuleFieldType(def.fieldType), `defs: fieldType reconnu (${def.fieldType})`)
    const d = getModuleDefinition(def.fieldType)
    assert(!!d && d.id === def.id, `defs: getModuleDefinition cohérent (${def.fieldType})`)
  }
  const mtc  = getModulesBySpecialty('MTC')
  const osteo = getModulesBySpecialty('Ostéo')
  eq(mtc.length, 4, 'defs: 4 modules MTC')
  eq(osteo.length, 2, 'defs: 2 modules Ostéo')
}

// ── 2. Tous les adaptateurs sont enregistrés ─────────────────────────────────
function testAdapters(): void {
  const types = ['mtc_systemes', 'mtc_five_elements', 'mtc_tongue_pulse',
                 'mtc_aide_interrogatoire', 'osteo_ortho_tests', 'osteo_posture'] as const
  for (const t of types) {
    const adapter = getModuleAdapter(t)
    assert(!!adapter, `registered: adaptateur ${t} présent`)
    assert(!!adapter?.moduleId, `registered: moduleId présent pour ${t}`)
    assert(!!adapter?.version, `registered: version présente pour ${t}`)
  }
}

// ── 3. mtc_systemes — normalisation & résumé ────────────────────────────────
function testMtcSystemes(): void {
  const adapter = getModuleAdapter('mtc_systemes')!
  const raw = {
    coeur: { checked: ['Palpitations', 'Insomnie'], note: 'Stase Sang Cœur', energie: 6 },
    rein:  { checked: [], note: '', energie: 3 },
    foie:  { checked: ['Stress'], note: '' },
  }
  const value = adapter.normalizeValue(raw)
  assert(!adapter.isEmpty(value), 'systemes: non vide')
  const summary = adapter.formatForSummary(value)
  assert(summary.includes('Palpitations'), 'systemes: summary contient Palpitations')
  assert(summary.includes('Énergie : 6'), 'systemes: summary contient énergie')
  const blocks = adapter.exportToDocument(value)
  assert(blocks.length > 0, 'systemes: au moins un bloc export')
  assert(blocks[0].type === 'keyvalue', 'systemes: bloc keyvalue')
  // Données corrompues
  const empty = adapter.normalizeValue(null)
  assert(adapter.isEmpty(empty), 'systemes: null → vide')
  const empty2 = adapter.normalizeValue('not-an-object')
  assert(adapter.isEmpty(empty2), 'systemes: string → vide')
}

// ── 4. mtc_five_elements ─────────────────────────────────────────────────────
function testMtcFiveElements(): void {
  const adapter = getModuleAdapter('mtc_five_elements')!
  const raw = { selected: ['Eau', 'Feu'], notes: 'Déséquilibre Eau-Feu' }
  const value = adapter.normalizeValue(raw)
  assert(!adapter.isEmpty(value), 'five_el: non vide')
  assert(adapter.formatForSummary(value).includes('Eau'), 'five_el: Eau dans le résumé')
  const blocks = adapter.exportToDocument(value)
  assert(blocks.length > 0 && blocks[0].type === 'keyvalue', 'five_el: bloc export keyvalue')
  assert(adapter.isEmpty(adapter.normalizeValue({})), 'five_el: vide si aucun élément')
}

// ── 5. mtc_tongue_pulse ──────────────────────────────────────────────────────
function testMtcTonguePulse(): void {
  const adapter = getModuleAdapter('mtc_tongue_pulse')!
  const raw = {
    langue: { couleur: 'Rouge', enduit: 'Jaune épais', note: 'Bords dentés' },
    pouls: { positions: { 'Gauche — Cœur': ['Tendu', 'Rapide'] }, note: 'Accéléré' },
  }
  const value = adapter.normalizeValue(raw)
  assert(!adapter.isEmpty(value), 'tongue: non vide')
  const summary = adapter.formatForSummary(value)
  assert(summary.includes('Rouge'), 'tongue: couleur dans le résumé')
  assert(summary.includes('Tendu'), 'tongue: qualité pouls dans le résumé')
}

// ── 6. mtc_aide_interrogatoire (display-only) ────────────────────────────────
function testMtcAideInterrogatoire(): void {
  const adapter = getModuleAdapter('mtc_aide_interrogatoire')!
  const value = adapter.normalizeValue({ anything: true })
  assert(adapter.isEmpty(value), 'aide: toujours vide')
  eq(adapter.formatForSummary(value), '', 'aide: résumé vide')
  eq(adapter.exportToDocument(value).length, 0, 'aide: pas de bloc par défaut')
  const blocks = adapter.exportToDocument(value, { showInExport: true })
  assert(blocks.length > 0, 'aide: bloc notice si showInExport=true')
}

// ── 7. osteo_ortho_tests ─────────────────────────────────────────────────────
function testOsteoOrthoTests(): void {
  const adapter = getModuleAdapter('osteo_ortho_tests')!
  const raw = [
    { nom: 'Lasègue', resultat: 'positif', note: 'à 45°' },
    { nom: 'Patrick', resultat: 'negatif' },
    { nom: '', resultat: 'positif' }, // ligne vide — doit être ignorée
  ]
  const value = adapter.normalizeValue(raw)
  eq(value.length, 2, 'ortho: ligne vide ignorée')
  assert(!adapter.isEmpty(value), 'ortho: non vide')
  const summary = adapter.formatForSummary(value)
  assert(summary.includes('Lasègue'), 'ortho: Lasègue dans le résumé')
  assert(summary.includes('✓+'), 'ortho: symbole positif')
  const blocks = adapter.exportToDocument(value)
  assert(blocks.length > 0 && blocks[0].type === 'table', 'ortho: bloc table')
  assert(adapter.isEmpty(adapter.normalizeValue([])), 'ortho: tableau vide → isEmpty')
}

// ── 8. osteo_posture ────────────────────────────────────────────────────────
function testOsteoPosture(): void {
  const adapter = getModuleAdapter('osteo_posture')!
  const raw = {
    front: { observations: ['Épaule droite haute', 'Genou droit en valgus'], note: 'Scoliose légère' },
    back: { observations: [], note: '' },
  }
  const value = adapter.normalizeValue(raw)
  assert(!adapter.isEmpty(value), 'posture: non vide')
  const summary = adapter.formatForSummary(value)
  assert(summary.includes('Épaule droite haute'), 'posture: observation dans le résumé')
  assert(!summary.includes('Vue postérieure'), 'posture: vue vide absente du résumé')
  const blocks = adapter.exportToDocument(value)
  assert(blocks.length > 0 && blocks[0].type === 'keyvalue', 'posture: bloc keyvalue')
}

// ── 9. Migration transparente (fromVersion === toVersion) ────────────────────
function testMigrationIdentity(): void {
  const adapter = getModuleAdapter('osteo_ortho_tests')!
  const raw = [{ nom: 'Spurling', resultat: 'positif' }]
  const value = adapter.normalizeValue(raw)
  const migrated = adapter.migrateData(raw, '1.0.0', '1.0.0')
  eq(migrated.length, value.length, 'migration: même longueur')
  eq(migrated[0].nom, value[0].nom, 'migration: nom conservé')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testDefinitions()
  testAdapters()
  testMtcSystemes()
  testMtcFiveElements()
  testMtcTonguePulse()
  testMtcAideInterrogatoire()
  testOsteoOrthoTests()
  testOsteoPosture()
  testMigrationIdentity()
  return { passed, failed, failures: [...failures] }
}

declare const require: unknown
declare const module: unknown
const isMain = typeof require !== 'undefined' && typeof module !== 'undefined' &&
  (require as { main?: unknown }).main === module
if (isMain) {
  const r = runTests()
  console.log(`\nmoduleRegistry: ${r.passed} passed, ${r.failed} failed`)
  if (r.failed > 0) {
    r.failures.forEach(f => console.error('  ✗ ' + f))
    if (typeof process !== 'undefined') process.exitCode = 1
  }
}
