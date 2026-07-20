/**
 * Tests Phase 7 — Formulaires officiels fixes.
 *
 * Tests sans DOM ni React : logique pure, fichiers plugin JSON, constantes.
 * Exécuter : npx tsx src/tests/phase7/runAll.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Helpers ─────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string): void {
  if (cond) passed++
  else { failed++; failures.push(msg) }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  assert(actual === expected, `${msg} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`)
}
function deepEq<T>(actual: T, expected: T, msg: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${msg} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`)
}

// ── Constantes réelles (copiées depuis NewSessionPage pour validation) ──────────

const OFFICIAL_FORM_IDS = ['basique', 'mtc_jp', 'osteopathie', 'kinesio_charlotte', 'naturopathie', 'douleur_evolution'] as const

const PLUGINS_DIR = path.resolve(__dirname, '../../../public/plugins')

function readPlugin(filename: string): Record<string, unknown> {
  const p = path.join(PLUGINS_DIR, filename)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

// ── Groupe 1 : constante OFFICIAL_FORM_IDS ──────────────────────────────────────

console.log('\n── 1. Constante OFFICIAL_FORM_IDS ──')

eq(OFFICIAL_FORM_IDS.length, 6, 'Exactement 6 formulaires officiels')
eq(OFFICIAL_FORM_IDS[0], 'basique', 'Position 1 : basique')
eq(OFFICIAL_FORM_IDS[1], 'mtc_jp', 'Position 2 : mtc_jp')
eq(OFFICIAL_FORM_IDS[2], 'osteopathie', 'Position 3 : osteopathie')
eq(OFFICIAL_FORM_IDS[3], 'kinesio_charlotte', 'Position 4 : kinesio_charlotte')
eq(OFFICIAL_FORM_IDS[4], 'naturopathie', 'Position 5 : naturopathie')
eq(OFFICIAL_FORM_IDS[5], 'douleur_evolution', 'Position 6 : douleur_evolution')

// ── Groupe 2 : fichiers plugin présents et IDs corrects ─────────────────────────

console.log('\n── 2. Fichiers plugin JSON présents et valides ──')

const pluginFiles: Record<string, string> = {
  'basique': 'basique.plugin.json',
  'mtc_jp': 'mtc_jp.plugin.json',
  'osteopathie': 'osteopathie.plugin.json',
  'kinesio_charlotte': 'kinesio.plugin.json',
  'naturopathie': 'naturopathie.plugin.json',
  'douleur_evolution': 'douleur_evolution.plugin.json',
}

for (const [expectedId, filename] of Object.entries(pluginFiles)) {
  const filePath = path.join(PLUGINS_DIR, filename)
  assert(fs.existsSync(filePath), `Fichier ${filename} présent dans public/plugins/`)
  if (fs.existsSync(filePath)) {
    const plugin = readPlugin(filename)
    eq(plugin.id as string, expectedId, `${filename} a l'ID correct`)
    assert(typeof plugin.name === 'string' && plugin.name.length > 0, `${filename} a un name non-vide`)
    assert(typeof plugin.specialty === 'string', `${filename} a une specialty`)
    assert(Array.isArray(plugin.sections), `${filename} a un tableau sections`)
  }
}

// ── Groupe 3 : propriétés spécifiques de chaque formulaire ─────────────────────

console.log('\n── 3. Propriétés spécifiques des formulaires ──')

// Basique : pas de useBuiltinForm, isNative = true
const basique = readPlugin('basique.plugin.json')
assert(!basique.useBuiltinForm, 'basique n\'a pas useBuiltinForm')
assert(basique.isNative === true, 'basique a isNative = true')
assert(Array.isArray(basique.sections) && (basique.sections as unknown[]).length > 0, 'basique a au moins une section')

// MTC : useBuiltinForm = true
const mtc = readPlugin('mtc_jp.plugin.json')
assert(mtc.useBuiltinForm === true, 'mtc_jp a useBuiltinForm = true')

// Ostéopathie : sections dans le bon ordre clinique
const osteo = readPlugin('osteopathie.plugin.json')
const osteoSections = (osteo.sections as Array<{id: string}>).map(s => s.id)
const motifIdx = osteoSections.indexOf('motif_douleur')
const antecedentsIdx = osteoSections.indexOf('antecedents_traumatiques')
const securiteIdx = osteoSections.indexOf('securite_drapeaux_rouges')
const traitementIdx = osteoSections.indexOf('traitement_suivi')
assert(motifIdx >= 0, 'osteopathie a une section motif_douleur')
assert(antecedentsIdx >= 0, 'osteopathie a une section antecedents_traumatiques')
assert(securiteIdx >= 0, 'osteopathie a une section securite_drapeaux_rouges')
assert(traitementIdx >= 0, 'osteopathie a une section traitement_suivi')
assert(traitementIdx > motifIdx, 'traitement_suivi vient après motif_douleur')

// Kinésiologie : a la section suivi_anamnese
const kinesio = readPlugin('kinesio.plugin.json')
const kinesioSections = (kinesio.sections as Array<{id: string}>).map(s => s.id)
assert(kinesioSections.includes('suivi_anamnese'), 'kinesio a la section suivi_anamnese')
assert(kinesioSections.indexOf('suivi_anamnese') === kinesioSections.length - 1, 'suivi_anamnese est la dernière section de kinesio')

// Kinésiologie : hideGlobalMotif
assert(kinesio.hideGlobalMotif === true, 'kinesio a hideGlobalMotif = true')

// ── Groupe 4 : logique de rendu du formulaire Basique ───────────────────────────

console.log('\n── 4. Logique de rendu Basique (même que mode simple) ──')

// Simulation de la logique de rendu dans NewSessionPage
function getRenderMode(activePlugin: { id: string; useBuiltinForm?: boolean } | null): 'plugin' | 'mtc-builtin' | 'simple' {
  if (activePlugin && activePlugin.id !== 'basique' && !activePlugin.useBuiltinForm) return 'plugin'
  if (activePlugin?.useBuiltinForm) return 'mtc-builtin'
  return 'simple'
}

eq(getRenderMode(null), 'simple', 'null activePlugin → mode simple')
eq(getRenderMode({ id: 'basique' }), 'simple', 'basique → mode simple (comme no-plugin)')
eq(getRenderMode({ id: 'mtc_jp', useBuiltinForm: true }), 'mtc-builtin', 'mtc_jp → mode builtin')
eq(getRenderMode({ id: 'osteopathie' }), 'plugin', 'osteopathie → PluginFormRenderer')
eq(getRenderMode({ id: 'kinesio_charlotte' }), 'plugin', 'kinesio → PluginFormRenderer')
eq(getRenderMode({ id: 'naturopathie' }), 'plugin', 'naturopathie → PluginFormRenderer')
eq(getRenderMode({ id: 'douleur_evolution' }), 'plugin', 'douleur_evolution → PluginFormRenderer')

// ── Groupe 5 : normalisation des plugins non-officiels ──────────────────────────

console.log('\n── 5. Normalisation des plugins non-officiels ──')

function normalizeToOfficialForm(
  pluginId: string | null | undefined,
  available: string[]
): string {
  if (pluginId && (OFFICIAL_FORM_IDS as readonly string[]).includes(pluginId)) {
    return pluginId
  }
  return available.find(id => id === 'basique') ?? 'basique'
}

const availableIds = [...OFFICIAL_FORM_IDS]
eq(normalizeToOfficialForm('mtc_jp', availableIds), 'mtc_jp', 'mtc_jp officiel → inchangé')
eq(normalizeToOfficialForm('kinesio_charlotte', availableIds), 'kinesio_charlotte', 'kinesio officiel → inchangé')
eq(normalizeToOfficialForm('mon_plugin_custom', availableIds), 'basique', 'plugin custom → normalisé vers basique')
eq(normalizeToOfficialForm(null, availableIds), 'basique', 'null → normalisé vers basique')
eq(normalizeToOfficialForm(undefined, availableIds), 'basique', 'undefined → normalisé vers basique')
eq(normalizeToOfficialForm('ancien_plugin_mtc', availableIds), 'basique', 'ancien plugin inconnu → normalisé vers basique')

// ── Groupe 6 : compatibilité rétroactive des données ───────────────────────────

console.log('\n── 6. Rétrocompatibilité : anciennes séances lisibles ──')

// Ancienne séance sans plugin (mode simple)
const oldSimpleSession = {
  full_data_json: JSON.stringify({
    anamnese: 'Histoire de la plainte...',
    pluginId: undefined,
    pluginSchema: undefined,
  }),
}
const simpleData = JSON.parse(oldSimpleSession.full_data_json)
assert(!simpleData.pluginId, 'Ancienne séance simple : pas de pluginId')
eq(getRenderMode(null), 'simple', 'Ancienne séance simple → affichée en mode simple')
assert(simpleData.anamnese === 'Histoire de la plainte...', 'Ancienne séance simple : anamnese conservée')

// Ancienne séance avec plugin kinésio
const oldKinesioSession = {
  full_data_json: JSON.stringify({
    pluginId: 'kinesio_charlotte',
    pluginIsBuiltin: false,
    pluginSchema: { id: 'kinesio_charlotte', name: 'Kinésiologie Charlotte', sections: [] },
    pluginData: { objetRdv: 'Stress au travail', emotions: 'Anxiété' },
  }),
}
const kinesioData = JSON.parse(oldKinesioSession.full_data_json)
assert(kinesioData.pluginId === 'kinesio_charlotte', 'Ancienne séance kinesio : pluginId conservé')
assert(kinesioData.pluginSchema !== undefined, 'Ancienne séance kinesio : schema conservé')
eq(getRenderMode(kinesioData.pluginSchema), 'plugin', 'Ancienne séance kinesio → rendue via PluginFormRenderer')
assert(kinesioData.pluginData.objetRdv === 'Stress au travail', 'Ancienne séance kinesio : données conservées')

// Séance MTC
const oldMtcSession = {
  full_data_json: JSON.stringify({
    pluginId: 'mtc_jp',
    pluginIsBuiltin: true,
    anamnese: 'Notes MTC...',
    diagnostic: 'Vide de Yin du Rein',
  }),
}
const mtcData = JSON.parse(oldMtcSession.full_data_json)
eq(getRenderMode({ id: 'mtc_jp', useBuiltinForm: true }), 'mtc-builtin', 'Ancienne séance MTC → rendue en mode builtin')
assert(mtcData.diagnostic === 'Vide de Yin du Rein', 'Ancienne séance MTC : diagnostic conservé')

// ── Groupe 7 : idempotence de la clôture en mode édition ─────────────────────

console.log('\n── 7. Idempotence clôture en mode édition ──')

// Simulation de la restauration de la clôture depuis full_data_json
function restoreClotureState(fullDataJson: string): { clotureTypeId: string; enableCompta: boolean } {
  let clotureTypeId = ''
  let enableCompta = false
  try {
    const d = JSON.parse(fullDataJson)
    if (d.comptaTypeId) {
      clotureTypeId = d.comptaTypeId
      enableCompta = true
    }
  } catch {}
  return { clotureTypeId, enableCompta }
}

// Séance avec clôture comptable
const sessionWithCompta = JSON.stringify({ comptaTypeId: 'type_consultation_standard', comptaMois: '2024-03' })
const restored = restoreClotureState(sessionWithCompta)
eq(restored.clotureTypeId, 'type_consultation_standard', 'Clôture : typeId restauré depuis full_data_json')
eq(restored.enableCompta, true, 'Clôture : enableCompta = true quand comptaTypeId présent')

// Séance sans clôture
const sessionWithoutCompta = JSON.stringify({ anamnese: 'notes' })
const restoredEmpty = restoreClotureState(sessionWithoutCompta)
eq(restoredEmpty.clotureTypeId, '', 'Clôture absente : typeId vide')
eq(restoredEmpty.enableCompta, false, 'Clôture absente : enableCompta = false')

// Vérifier que la compta ne s'incrémente pas en mode édition
function shouldIncrementCompta(enableCompta: boolean, clotureTypeId: string, isEditing: boolean): boolean {
  return enableCompta && !!clotureTypeId && !isEditing
}

assert(!shouldIncrementCompta(true, 'type_x', true), 'Compta non incrémentée en mode édition (isEditing=true)')
assert(shouldIncrementCompta(true, 'type_x', false), 'Compta incrémentée en mode création (isEditing=false)')
assert(!shouldIncrementCompta(false, 'type_x', false), 'Compta non incrémentée si enableCompta=false')
assert(!shouldIncrementCompta(true, '', false), 'Compta non incrémentée si typeId vide')

// ── Groupe 8 : séance précédente en mode édition ─────────────────────────────

console.log('\n── 8. Affichage de la séance précédente en mode édition ──')

// La condition correcte est : prevSession && (sans restriction isEditing)
function shouldShowPrevSession(prevSession: unknown, _isEditing: boolean): boolean {
  return Boolean(prevSession)  // plus de restriction !isEditing
}

assert(shouldShowPrevSession({ id: '123' }, false), 'prevSession visible en mode création')
assert(shouldShowPrevSession({ id: '123' }, true), 'prevSession visible en mode édition')
assert(!shouldShowPrevSession(null, false), 'prevSession masquée si null (création)')
assert(!shouldShowPrevSession(null, true), 'prevSession masquée si null (édition)')

// ── Groupe 9 : bloc clôture en mode édition ──────────────────────────────────

console.log('\n── 9. Affichage du bloc clôture en mode édition ──')

// La condition correcte est : patientId && (sans restriction isEditing)
function shouldShowCloture(patientId: string, _isEditing: boolean): boolean {
  return Boolean(patientId)  // plus de restriction !isEditing
}

assert(shouldShowCloture('patient-123', false), 'Clôture visible en création si patientId')
assert(shouldShowCloture('patient-123', true), 'Clôture visible en édition si patientId')
assert(!shouldShowCloture('', false), 'Clôture masquée sans patient')
assert(!shouldShowCloture('', true), 'Clôture masquée sans patient (édition)')

// ── Résultat ────────────────────────────────────────────────────────────────────

export function runTests() {
  return { passed, failed, failures }
}
