/**
 * Tests de logique pure Phase 6 — PluginBuilder.
 *
 * Tests sans DOM ni React : uniquement des fonctions pures importées
 * depuis src/shared (validator, block registry, types).
 *
 * Exécuter : npx tsx src/tests/phase6/runAll.ts
 */

import { validatePluginDefinition } from '../../shared/pluginValidator'
import {
  PLUGIN_BLOCK_REGISTRY,
  BLOCK_CATEGORY_META,
  BLOCK_CATEGORY_ORDER,
  getBlocksByCategory,
} from '../../shared/pluginBlockRegistry'
import type { PluginDefinition, PluginField } from '../../shared/pluginTypes'

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string): void {
  if (cond) passed++
  else { failed++; failures.push(msg) }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  assert(actual === expected, `${msg} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`)
}

// ── Helpers de construction ───────────────────────────────────────────────────

function makeField(overrides: Partial<PluginField> = {}): PluginField {
  return {
    id: 'field_1',
    type: 'text',
    label: 'Mon champ',
    ...overrides,
  }
}

function makePlugin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test_plugin',
    name: 'Plugin Test',
    specialty: 'Thérapie',
    version: '1.0.0',
    sections: [
      {
        id: 'section_1',
        title: 'Section 1',
        fields: [makeField()],
      },
    ],
    ...overrides,
  }
}

// ── Groupe 1 : validatePluginDefinition ──────────────────────────────────────

function testNullInput(): void {
  const r = validatePluginDefinition(null)
  assert(!r.valid, 'p6/1: null → non valide')
  assert(r.errors.length > 0, 'p6/1: null → au moins une erreur')
}

function testValidPlugin(): void {
  const r = validatePluginDefinition(makePlugin())
  assert(r.valid, 'p6/2: plugin valide complet → valid:true')
  assert(r.errors.length === 0, 'p6/2: plugin valide → aucune erreur')
  assert(!!r.plugin, 'p6/2: plugin valide → plugin reconstruit dans le résultat')
}

function testMissingName(): void {
  const r = validatePluginDefinition(makePlugin({ name: '' }))
  assert(!r.valid, 'p6/3: sans name → non valide')
  assert(r.errors.some(e => e.includes('Nom manquant')), 'p6/3: erreur contient "Nom manquant"')
}

function testMissingSpecialty(): void {
  const r = validatePluginDefinition(makePlugin({ specialty: '' }))
  assert(!r.valid, 'p6/4: sans specialty → non valide')
  assert(r.errors.some(e => e.includes('Spécialité manquante')), 'p6/4: erreur contient "Spécialité manquante"')
}

function testMissingVersion(): void {
  const r = validatePluginDefinition(makePlugin({ version: '' }))
  assert(!r.valid, 'p6/5: sans version → non valide')
  assert(r.errors.some(e => e.includes('Version manquante')), 'p6/5: erreur contient "Version manquante"')
}

function testEmptySections(): void {
  const r = validatePluginDefinition(makePlugin({ sections: [] }))
  assert(!r.valid, 'p6/6: sections vides → non valide')
  assert(r.errors.some(e => e.includes('au moins une section')), 'p6/6: erreur "au moins une section"')
}

function testSectionWithoutTitle(): void {
  const r = validatePluginDefinition(makePlugin({
    sections: [{ id: 'sec_1', title: '', fields: [makeField()] }],
  }))
  assert(!r.valid, 'p6/7: section sans titre → non valide')
  assert(r.errors.some(e => e.includes('titre')), 'p6/7: erreur mentionne "titre"')
}

// ── Groupe 2 : PLUGIN_BLOCK_REGISTRY / getBlocksByCategory ───────────────────

function testRegistryNotEmpty(): void {
  assert(PLUGIN_BLOCK_REGISTRY.length > 0, 'p6/8: registry non vide')
}

function testAllBlocksHaveRequiredProps(): void {
  for (const block of PLUGIN_BLOCK_REGISTRY) {
    assert(typeof block.id === 'string' && block.id.length > 0, `p6/9: bloc ${block.id ?? '?'} a un id`)
    assert(typeof block.label === 'string' && block.label.length > 0, `p6/9: bloc ${block.id} a un label`)
    assert(typeof block.category === 'string', `p6/9: bloc ${block.id} a une category`)
    assert(Array.isArray(block.fields), `p6/9: bloc ${block.id} a des fields`)
  }
}

function testGetBlocksByCategory(): void {
  const firstCat = BLOCK_CATEGORY_ORDER[0]
  const blocks = getBlocksByCategory(firstCat)
  assert(blocks.length > 0, `p6/10: getBlocksByCategory("${firstCat}") → non vide`)
  assert(blocks.every(b => b.category === firstCat), 'p6/10: tous les blocs retournés ont la bonne catégorie')
}

function testCategoryOrderCoversAllMeta(): void {
  assert(BLOCK_CATEGORY_ORDER.length > 0, 'p6/11: BLOCK_CATEGORY_ORDER pas vide')
  for (const cat of BLOCK_CATEGORY_ORDER) {
    assert(cat in BLOCK_CATEGORY_META, `p6/11: catégorie "${cat}" présente dans BLOCK_CATEGORY_META`)
  }
}

// ── Groupe 3 : round-trip et champs avancés ──────────────────────────────────

function testBasicPluginIsValid(): void {
  const plugin = makePlugin({
    sections: [
      {
        id: 'sec_anamnese',
        title: 'Anamnèse',
        fields: [
          makeField({ id: 'localisation', label: 'Localisation', type: 'textarea' }),
          makeField({ id: 'intensite', label: 'Intensité', type: 'rating', min: 0, max: 10 }),
        ],
      },
    ],
  })
  const r = validatePluginDefinition(plugin)
  assert(r.valid, 'p6/12: plugin avec une section et deux champs → valid:true')
  eq(r.plugin?.sections.length, 1, 'p6/12: 1 section dans le résultat')
  eq(r.plugin?.sections[0].fields.length, 2, 'p6/12: 2 champs dans la section')
}

function testDeprecatedStatusPreserved(): void {
  const field: PluginField = makeField({ id: 'ancien_champ', label: 'Ancien', status: 'deprecated' })
  const plugin: PluginDefinition = {
    id: 'test_deprecated',
    name: 'Test',
    specialty: 'Test',
    version: '1.0.0',
    sections: [{ id: 'sec', title: 'Section', fields: [field] }],
  }
  const json = JSON.parse(JSON.stringify(plugin)) as PluginDefinition
  eq(json.sections[0].fields[0].status, 'deprecated', 'p6/13: status "deprecated" préservé dans JSON round-trip')
}

function testSummaryGroupPreserved(): void {
  const field: PluginField = makeField({ id: 'champ_groupe', label: 'Douleur locale', summaryGroup: 'Douleur' })
  const plugin: PluginDefinition = {
    id: 'test_sg',
    name: 'Test',
    specialty: 'Test',
    version: '1.0.0',
    sections: [{ id: 'sec', title: 'Section', fields: [field] }],
  }
  const json = JSON.parse(JSON.stringify(plugin)) as PluginDefinition
  eq(json.sections[0].fields[0].summaryGroup, 'Douleur', 'p6/14: summaryGroup préservé dans JSON round-trip')
}

function testDataKeyPreserved(): void {
  const field: PluginField = makeField({ id: 'dk_test', label: 'Mon champ', dataKey: 'mon_champ' })
  const plugin: PluginDefinition = {
    id: 'test_dk',
    name: 'Test',
    specialty: 'Test',
    version: '1.0.0',
    sections: [{ id: 'sec', title: 'Section', fields: [field] }],
  }
  const json = JSON.parse(JSON.stringify(plugin)) as PluginDefinition
  eq(json.sections[0].fields[0].dataKey, 'mon_champ', 'p6/15: dataKey préservé dans JSON round-trip')
}

// ── Runner ────────────────────────────────────────────────────────────────────

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0

  // Groupe 1 — validatePluginDefinition
  testNullInput()
  testValidPlugin()
  testMissingName()
  testMissingSpecialty()
  testMissingVersion()
  testEmptySections()
  testSectionWithoutTitle()

  // Groupe 2 — PLUGIN_BLOCK_REGISTRY
  testRegistryNotEmpty()
  testAllBlocksHaveRequiredProps()
  testGetBlocksByCategory()
  testCategoryOrderCoversAllMeta()

  // Groupe 3 — round-trip et champs avancés
  testBasicPluginIsValid()
  testDeprecatedStatusPreserved()
  testSummaryGroupPreserved()
  testDataKeyPreserved()

  return { passed, failed, failures: [...failures] }
}

declare const require: unknown
declare const module: unknown
const isMain = typeof require !== 'undefined' && typeof module !== 'undefined' &&
  (require as { main?: unknown }).main === module
if (isMain) {
  const r = runTests()
  console.log(`\nbuilderLogic: ${r.passed} passed, ${r.failed} failed`)
  if (r.failed > 0) {
    r.failures.forEach(f => console.error('  ✗ ' + f))
    if (typeof process !== 'undefined') process.exitCode = 1
  }
}
