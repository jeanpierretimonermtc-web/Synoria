/**
 * Tests de non-régression du normalisateur de séances (Phase 1).
 *
 * Le projet n'embarque pas (encore) de test runner. Ce fichier est autonome :
 * un mini-harness d'assertions + un `runTests()` exécutable directement.
 * Il peut être câblé à vitest/jest plus tard sans modifier la logique.
 *
 * Objectif : garantir qu'AUCUNE donnée n'est perdue lors de la normalisation,
 * et que les anciennes séances restent lisibles.
 */

import { normalizeSession, generateDataKey } from '../main/services/sessionDataNormalizer'
import { CANONICAL_SCHEMA_VERSION, CORE_PROFILE_ID } from '../shared/sessionDataTypes'

// ── Mini-harness ────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string): void {
  if (cond) { passed++ }
  else { failed++; failures.push(msg) }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  assert(actual === expected, `${msg} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`)
}

// ── 1. Séance vide (tous les champs null) ───────────────────────────────────

function testEmptySession(): void {
  const raw = {
    id: 's-empty', patient_id: 'p1', date: '2026-01-01',
    practitioner: null, motif: null, evolution: null, evolution_tags: null,
    problematiques: null, observation: null, full_data_json: null,
    energy_tests_json: null, systemes_json: null, next_session_date: null,
    created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z',
  }
  const c = normalizeSession(raw)
  eq(c.schemaVersion, CANONICAL_SCHEMA_VERSION, 'empty: schemaVersion')
  eq(c.sessionId, 's-empty', 'empty: sessionId')
  eq(c.patientId, 'p1', 'empty: patientId')
  eq(Object.keys(c.core).length, 0, 'empty: aucun champ core')
  eq(Object.keys(c.fields).length, 0, 'empty: aucun champ plugin')
  eq(Object.keys(c.modules).length, 0, 'empty: aucun module')
  eq(c.formProfile.id, CORE_PROFILE_ID, 'empty: profil core par défaut')
  eq(c.normalization.hadUnknownFields, false, 'empty: pas de champ inconnu')
}

// ── 2. Ancienne séance legacy (mode MTC intégré, sans dataKey/schema) ───────

function testLegacyMtcSession(): void {
  const fd = {
    sessionNum: 3, anamnese: 'Fatigue chronique', langueNote: 'Pâle',
    barrageNiv1: 'N1 texte', poulsPos: { droitAvant: 'faible' },
    systemes: { rate: { checked: ['Ballonnements'], note: 'RAS', energie: 4 } },
    pluginId: 'mtc_jp', pluginIsBuiltin: true,
  }
  const raw = {
    id: 's-mtc', patient_id: 'p2', date: '2025-06-01',
    motif: '<p>Douleurs lombaires</p>', evolution_tags: 'amélioration',
    diagnostic_mtc: 'Vide de Rein', points: '36E, 6RT',
    systemes_json: JSON.stringify(fd.systemes),
    energy_tests_json: JSON.stringify({ empereur: 'Rate', testsNotes: 'ok' }),
    full_data_json: JSON.stringify(fd),
    created_at: '2025-06-01T09:00:00Z', updated_at: '2025-06-01T09:30:00Z',
  }
  const c = normalizeSession(raw)

  assert(!!c.core['core.motif'], 'legacy: motif mappé en core')
  eq(c.core['core.motif'].value as string, '<p>Douleurs lombaires</p>', 'legacy: motif brut conservé (HTML intact)')
  assert(!!c.core['core.diagnostic_mtc'], 'legacy: diagnostic mappé')
  assert(!!c.core['core.anamnese'], 'legacy: anamnèse (fd) mappée en core')
  assert(!!c.core['core.barrageNiv1'], 'legacy: barrage niveau 1 conservé')
  assert(!!c.modules['mtc_systemes'], 'legacy: module systèmes présent')
  assert(!!c.modules['energy_tests'], 'legacy: module tests énergétiques présent')
  assert(!!c.modules['mtc_pouls_positions'], 'legacy: positions de pouls conservées')
  eq(c.formProfile.pluginId, 'mtc_jp', 'legacy: pluginId')
  // Le module systèmes conserve la structure exacte.
  const sys = c.modules['mtc_systemes'].data as Record<string, { energie?: number }>
  eq(sys.rate.energie, 4, 'legacy: donnée profonde du module intacte')
}

// ── 3. Séance plugin tiers (kinesio) avec schéma ────────────────────────────

function testPluginKinesioSession(): void {
  const pluginSchema = {
    id: 'kinesio', name: 'Kinésiologie', specialty: 'Kinésiologie', version: '2.1.0',
    sections: [{
      id: 'sec1', title: 'Bilan', fields: [
        { id: 'stress', type: 'rating', label: 'Niveau de stress', max: 10 },
        { id: 'objectif', type: 'richtext', label: 'Objectif' },
        { id: 'muscles', type: 'tags', label: 'Muscles testés' },
      ],
    }],
  }
  const fd = {
    pluginId: 'kinesio', pluginIsBuiltin: false, pluginSchema,
    pluginData: { stress: 7, objectif: '<b>Ancrage</b>', muscles: ['Psoas', 'Deltoïde'], extraLibre: 'valeur hors schéma' },
  }
  const raw = {
    id: 's-kin', patient_id: 'p3', date: '2026-03-10',
    motif: 'Gestion stress', full_data_json: JSON.stringify(fd),
    created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-10T10:20:00Z',
  }
  const c = normalizeSession(raw)

  assert(!!c.fields['stress'], 'kinesio: champ stress présent')
  eq(c.fields['stress'].type, 'rating', 'kinesio: type résolu depuis le schéma')
  eq(c.fields['stress'].labelSnapshot, 'Niveau de stress', 'kinesio: label snapshot')
  eq(c.fields['stress'].dataKey, generateDataKey('kinesio', 'stress'), 'kinesio: dataKey généré')
  eq(c.fields['objectif'].value as string, '<b>Ancrage</b>', 'kinesio: richtext brut conservé')
  assert(Array.isArray(c.fields['muscles'].value), 'kinesio: tags conservés en tableau')
  // Champ hors schéma → conservé + warning.
  assert(!!c.fields['extraLibre'], 'kinesio: champ hors schéma NON perdu')
  eq(c.fields['extraLibre'].type, 'unknown', 'kinesio: champ hors schéma typé unknown')
  eq(c.normalization.hadUnknownFields, true, 'kinesio: flag hadUnknownFields levé')
  assert(c.normalization.warnings.some(w => w.code === 'UNKNOWN_FIELD'), 'kinesio: warning UNKNOWN_FIELD émis')
  eq((c.formSnapshot.pluginDefinition as { version?: string })?.version, '2.1.0', 'kinesio: snapshot du schéma conservé')
}

// ── 4. generateDataKey ──────────────────────────────────────────────────────

function testGenerateDataKey(): void {
  eq(generateDataKey('kinesio', 'stress'), 'custom.kinesio.stress', 'dataKey: formId connu')
  eq(generateDataKey(undefined, 'stress'), 'custom.unknown.stress', 'dataKey: formId inconnu')
  eq(generateDataKey('', 'x'), 'custom.unknown.x', 'dataKey: formId vide → unknown')
}

// ── 5. Aucune donnée perdue (comptage exhaustif) ───────────────────────────

function testNoDataLoss(): void {
  const fd = {
    pluginId: 'custom_form', pluginIsBuiltin: false,
    pluginData: { a: 'A', b: 'B', c: 'C' }, // aucun schéma → tout doit survivre
    champLibre1: 'x', champLibre2: 'y',
  }
  const raw = {
    id: 's-loss', patient_id: 'p4', date: '2026-04-01',
    motif: 'M', evolution: 'E', full_data_json: JSON.stringify(fd),
    created_at: '2026-04-01T10:00:00Z', updated_at: '2026-04-01T10:00:00Z',
  }
  const c = normalizeSession(raw)
  // motif + evolution en core
  assert(!!c.core['core.motif'] && !!c.core['core.evolution'], 'no-loss: colonnes en core')
  // a,b,c de pluginData
  assert(!!c.fields['a'] && !!c.fields['b'] && !!c.fields['c'], 'no-loss: pluginData intégral')
  // clés libres résiduelles de full_data_json
  assert(!!c.fields['champLibre1'] && !!c.fields['champLibre2'], 'no-loss: clés résiduelles conservées')
  assert(c.normalization.warnings.some(w => w.code === 'SCHEMA_MISSING'), 'no-loss: warning SCHEMA_MISSING')
}

// ── 6. Robustesse : données corrompues ──────────────────────────────────────

function testCorrupted(): void {
  let threw = false
  let c: ReturnType<typeof normalizeSession> | null = null
  try {
    c = normalizeSession({ id: 'x', patient_id: 'p', full_data_json: '{ this is not json' })
  } catch { threw = true }
  assert(!threw, 'corrompu: aucune exception levée')
  assert(!!c && c.normalization.warnings.some(w => w.code === 'FULL_DATA_UNPARSEABLE'), 'corrompu: warning émis')

  // Entrée totalement invalide
  const c2 = normalizeSession(null)
  eq(c2.normalization.sourceFormat, 'unknown', 'corrompu: null → sourceFormat unknown')
  assert(c2.normalization.warnings.some(w => w.code === 'INVALID_SESSION'), 'corrompu: warning INVALID_SESSION')
}

// ── Runner ──────────────────────────────────────────────────────────────────

// ── 7. bodychart, repeatable, before_after (plugin ostéo) ───────────────────
function testBodychartRepeatable(): void {
  const pluginSchema = {
    id: 'osteo', name: 'Ostéo', specialty: 'Ostéo', version: '1.0.0',
    sections: [{ id: 's', title: 'Bilan', fields: [
      { id: 'zones', type: 'bodychart', label: 'Zones' },
      { id: 'tests', type: 'repeatable', label: 'Tests' },
      { id: 'evo', type: 'before_after', label: 'Douleur', max: 10 },
    ] }],
  }
  const fd = {
    pluginId: 'osteo', pluginIsBuiltin: false, pluginSchema,
    pluginData: {
      zones: { front: ['Épaule'], back: ['Lombaire L4'], notes: 'Raideur' },
      tests: [{ nom: 'Lasègue', note: 'positif' }],
      evo: { before: 8, after: 3 },
    },
  }
  const raw = { id: 's-bc', patient_id: 'p', date: '2026-05-01', full_data_json: JSON.stringify(fd), created_at: 'x' }
  const c = normalizeSession(raw)
  assert(!!c.fields['zones'], 'bodychart: champ présent')
  const bc = c.fields['zones'].value as { front?: string[] }
  eq(Array.isArray(bc.front) ? bc.front[0] : '', 'Épaule', 'bodychart: zone antérieure intacte (accent conservé)')
  const tests = c.fields['tests'].value as Array<{ nom?: string }>
  eq(Array.isArray(tests) ? tests[0].nom : '', 'Lasègue', 'repeatable: ligne intacte')
  const ba = c.fields['evo'].value as { before?: number; after?: number }
  eq(ba.before, 8, 'before_after: valeur before conservée')
  eq(ba.after, 3, 'before_after: valeur after conservée')
}

// ── 8. accents & texte long ───────────────────────────────────────
function testAccentsLongText(): void {
  const longText = 'Ligne accentuée éàçùî — '.repeat(60)
  const raw = {
    id: 's-acc', patient_id: 'p', date: '2026-05-01',
    motif: 'Céphalées récurrentes à répétition',
    analyse: '<p>' + longText + '</p>',
    created_at: 'x',
  }
  const c = normalizeSession(raw)
  eq(c.core['core.motif'].value as string, 'Céphalées récurrentes à répétition', 'accents: motif conservé caractère pour caractère')
  const analyse = c.core['core.analyse'].value as string
  assert(analyse.length > 1000, 'texte long: contenu non tronqué')
  assert(analyse.includes('éàçùî'), 'texte long: accents préservés')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testEmptySession()
  testLegacyMtcSession()
  testPluginKinesioSession()
  testGenerateDataKey()
  testNoDataLoss()
  testCorrupted()
  testBodychartRepeatable()
  testAccentsLongText()
  return { passed, failed, failures: [...failures] }
}

// Auto-exécution si lancé directement (node/tsx après transpilation).
declare const require: unknown
declare const module: unknown
const isMain = typeof require !== 'undefined' && typeof module !== 'undefined' &&
  (require as { main?: unknown }).main === module
if (isMain) {
  const r = runTests()
  // eslint-disable-next-line no-console
  console.log(`\nsessionDataNormalizer: ${r.passed} passed, ${r.failed} failed`)
  if (r.failed > 0) {
    // eslint-disable-next-line no-console
    r.failures.forEach(f => console.error('  ✗ ' + f))
    if (typeof process !== 'undefined') process.exitCode = 1
  }
}
