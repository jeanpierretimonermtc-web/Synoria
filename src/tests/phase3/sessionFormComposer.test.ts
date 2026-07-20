/**
 * Tests du compositeur de formulaire (Phase 3).
 *
 * Mini-harness autonome (même pattern que Phase 1/2). Aucune dépendance
 * Electron/SQLite : composeSessionForm est une fonction pure.
 */

import { composeSessionForm } from '../../shared/sessionFormComposer'
import { getCoreDefinition } from '../../shared/coreDefinition'
import { getNativeProfiles } from '../../main/services/nativeProfiles'
import { normalizeSession } from '../../main/services/sessionDataNormalizer'
import type { SessionFormProfile } from '../../shared/sessionProfileTypes'
import type { PluginDefinition } from '../../shared/pluginTypes'

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

function profileById(id: string): SessionFormProfile {
  const p = getNativeProfiles().find(x => x.id === id)
  if (!p) throw new Error(`profil natif ${id} absent`)
  return p
}

const kinesioPlugin: PluginDefinition = {
  id: 'kinesio_charlotte', name: 'Kinésiologie', specialty: 'Kinésiologie', version: '1.1.0',
  hideGlobalMotif: true,
  sections: [
    { id: 'contexte', title: 'Contexte', fields: [{ id: 'objet', type: 'richtext', label: 'Objet du RDV' }] },
    { id: 'equilibrage', title: 'Équilibrage', fields: [{ id: 'muscles', type: 'tags', label: 'Muscles' }] },
  ],
}

const genericPlugin: PluginDefinition = {
  id: 'osteopathie', name: 'Ostéo', specialty: 'Ostéopathie', version: '1.0.0',
  sections: [{ id: 'bilan', title: 'Bilan', fields: [{ id: 'zones', type: 'bodychart', label: 'Zones' }] }],
}

// ── 1. Composition Core seul — première consultation ────────────────────────
function testCoreInitial(): void {
  const core = getCoreDefinition()
  const profile = profileById('synoria.profile.generic.initial')
  const composed = composeSessionForm({ core, profile, plugin: null })

  eq(composed.consultationType, 'initial', 'initial: type')
  eq(composed.coreVersion, '1.0.0', 'initial: coreVersion')
  const ids = composed.sections.map(s => s.id)
  assert(ids.includes('core.section.context'), 'initial: section contexte présente')
  assert(!ids.includes('core.section.evolution'), 'initial: PAS de section évolution (première consult.)')
  assert(ids.includes('core.section.outcome'), 'initial: section résultat présente')
  assert(ids.includes('core.section.followup'), 'initial: section suivi présente')
  assert(ids.indexOf('core.section.context') < ids.indexOf('core.section.outcome'), 'initial: contexte avant résultat')
  assert(ids.indexOf('core.section.outcome') < ids.indexOf('core.section.followup'), 'initial: résultat avant suivi')
  assert(composed.sections.every(s => s.source === 'core'), 'initial: toutes sections core')
}

// ── 2. Suivi — section évolution présente ───────────────────────────────────
function testCoreFollowUp(): void {
  const core = getCoreDefinition()
  const profile = profileById('synoria.profile.generic.followup')
  const composed = composeSessionForm({ core, profile, plugin: null })
  const ids = composed.sections.map(s => s.id)
  eq(composed.consultationType, 'follow_up', 'suivi: type')
  assert(ids.includes('core.section.evolution'), 'suivi: section évolution présente')
  assert(ids.indexOf('core.section.evolution') < ids.indexOf('core.section.outcome'), 'suivi: évolution avant résultat')
}

// ── 3. Composition Core + plugin (ordre) ────────────────────────────────────
function testCorePlusPlugin(): void {
  const core = getCoreDefinition()
  const profile: SessionFormProfile = { ...profileById('synoria.profile.generic.initial'), pluginId: 'osteopathie' }
  const composed = composeSessionForm({ core, profile, plugin: genericPlugin })
  const ids = composed.sections.map(s => s.id)
  assert(ids.includes('plugin.bilan'), 'core+plugin: section plugin présente')
  assert(ids.indexOf('core.section.context') < ids.indexOf('plugin.bilan'), 'core+plugin: contexte avant plugin')
  assert(ids.indexOf('plugin.bilan') < ids.indexOf('core.section.outcome'), 'core+plugin: plugin avant résultat')
  const pluginSec = composed.sections.find(s => s.id === 'plugin.bilan')
  eq(pluginSec?.source, 'plugin', 'core+plugin: source plugin')
  eq(composed.pluginId, 'osteopathie', 'core+plugin: pluginId propagé')
}

// ── 4. Doublon motif (hideGlobalMotif) ──────────────────────────────────────
function testHideGlobalMotif(): void {
  const core = getCoreDefinition()
  const profile: SessionFormProfile = { ...profileById('synoria.profile.kinesio.standard') }
  const composed = composeSessionForm({ core, profile, plugin: kinesioPlugin })
  const context = composed.sections.find(s => s.id === 'core.section.context')
  assert(!!context, 'hideMotif: section contexte toujours présente')
  const hasReason = context!.fields.some(f => f.dataKey === 'core.consultation_reason')
  assert(!hasReason, 'hideMotif: champ motif (core.consultation_reason) retiré')
  assert(context!.fields.length > 0, 'hideMotif: contexte non vide après retrait du motif')
  assert(composed.omitted.some(o => o.kind === 'field' && o.id === 'core.consultation_reason'), 'hideMotif: omission tracée')
}

// ── 5. Legacy MTC intégré (useBuiltinForm) ──────────────────────────────────
function testBuiltinForm(): void {
  const core = getCoreDefinition()
  const profile = profileById('synoria.profile.mtc.initial')
  const mtcPlugin: PluginDefinition = { id: 'mtc_jp', name: 'MTC', specialty: 'MTC', version: '1.2.0', useBuiltinForm: true, sections: [] }
  const composed = composeSessionForm({ core, profile, plugin: mtcPlugin })
  eq(composed.sections.length, 0, 'builtin: aucune section Core composée')
  eq(composed.pluginId, 'mtc_jp', 'builtin: pluginId conservé')
  assert(composed.omitted.length >= core.sections.length, 'builtin: sections Core marquées omises')
}

// ── 6. Section désactivée dans le profil ────────────────────────────────────
function testDisabledSection(): void {
  const core = getCoreDefinition()
  const base = profileById('synoria.profile.generic.followup')
  const profile: SessionFormProfile = {
    ...base,
    coreConfiguration: { disabledSections: ['core.section.safety'], customTitles: { 'core.section.followup': 'Recommandations' }, sectionOrder: [] },
  }
  const composed = composeSessionForm({ core, profile, plugin: null })
  const ids = composed.sections.map(s => s.id)
  assert(!ids.includes('core.section.safety'), 'disabled: section sécurité retirée')
  const followup = composed.sections.find(s => s.id === 'core.section.followup')
  eq(followup?.title, 'Recommandations', 'disabled: titre personnalisé appliqué')
}

// ── 7. Section requise non désactivable ─────────────────────────────────────
function testRequiredNotDisableable(): void {
  const core = getCoreDefinition()
  const base = profileById('synoria.profile.generic.initial')
  const profile: SessionFormProfile = {
    ...base,
    coreConfiguration: { disabledSections: ['core.section.context'], customTitles: {}, sectionOrder: [] },
  }
  const composed = composeSessionForm({ core, profile, plugin: null })
  const ids = composed.sections.map(s => s.id)
  assert(ids.includes('core.section.context'), 'required: contexte reste présent malgré désactivation demandée')
}

// ── 8. Snapshot normalisé avec profileId (Phase 3) ──────────────────────────
function testSnapshotProfileId(): void {
  const fd = { profileId: 'synoria.profile.generic.followup', profileVersion: '1.0.0', consultationType: 'follow_up' }
  const raw = { id: 's1', patient_id: 'p1', date: '2026-06-01', motif: 'M', full_data_json: JSON.stringify(fd), created_at: 'x' }
  const c = normalizeSession(raw)
  eq(c.formSnapshot.profileId, 'synoria.profile.generic.followup', 'snapshot: profileId lu depuis full_data_json')
  eq(c.formSnapshot.consultationType, 'follow_up', 'snapshot: consultationType lu')
  assert(!c.fields['profileId'] && !c.fields['consultationType'], 'snapshot: métadonnées profil non traitées comme champs')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testCoreInitial()
  testCoreFollowUp()
  testCorePlusPlugin()
  testHideGlobalMotif()
  testBuiltinForm()
  testDisabledSection()
  testRequiredNotDisableable()
  testSnapshotProfileId()
  return { passed, failed, failures: [...failures] }
}
