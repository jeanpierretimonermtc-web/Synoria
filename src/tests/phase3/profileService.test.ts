/**
 * Tests du service de profils (Phase 3).
 *
 * Le service écrit dans userData/profiles.json. En test, on surcharge le
 * répertoire via `__setUserDataDir` vers un dossier temporaire — aucune
 * dépendance à Electron n'est requise (app.getPath n'est jamais appelé).
 */

import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  __setUserDataDir,
  loadProfileLibrary,
  getProfiles,
  getProfileById,
  getDefaultProfile,
  createProfile,
  updateProfile,
  duplicateProfile,
  archiveProfile,
  setDefaultProfile,
  migrateActivePluginToProfile,
  resolveProfileForSession,
} from '../../main/services/profileService'
import { CORE_VERSION, type SessionFormProfile } from '../../shared/sessionProfileTypes'
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

const tempDirs: string[] = []
function freshDir(): void {
  const dir = mkdtempSync(join(tmpdir(), 'synoria-profiles-'))
  tempDirs.push(dir)
  __setUserDataDir(dir)
}

function draftProfile(name: string): Omit<SessionFormProfile, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    specialty: 'Test',
    consultationType: 'custom',
    version: '1.0.0',
    coreVersion: CORE_VERSION,
    coreConfiguration: { disabledSections: [], customTitles: {}, sectionOrder: [] },
    enabledModules: [],
    isNative: false,
    isDefault: false,
  }
}

// ── 1. Seed initial : profils natifs présents ───────────────────────────────
function testSeed(): void {
  freshDir()
  const lib = loadProfileLibrary()
  assert(lib.profiles.length >= 5, 'seed: au moins 5 profils natifs')
  assert(!!getProfileById('synoria.profile.mtc.initial'), 'seed: profil MTC initial présent')
  const def = getDefaultProfile()
  assert(!!def, 'seed: un profil par défaut existe')
  eq(def?.id, 'synoria.profile.generic.initial', 'seed: défaut = générique initiale')
}

// ── 2. Type première consultation vs suivi ──────────────────────────────────
function testConsultationTypes(): void {
  freshDir()
  loadProfileLibrary()
  eq(getProfileById('synoria.profile.generic.initial')?.consultationType, 'initial', 'types: générique initiale')
  eq(getProfileById('synoria.profile.generic.followup')?.consultationType, 'follow_up', 'types: générique suivi')
}

// ── 3. CRUD create ──────────────────────────────────────────────────────────
function testCreate(): void {
  freshDir()
  const created = createProfile(draftProfile('Mon profil'))
  assert(created.id.startsWith('profile_'), 'create: id généré')
  assert(!created.isNative, 'create: non natif')
  assert(!!getProfileById(created.id), 'create: persisté')
  const reloaded = getProfiles().find(p => p.id === created.id)
  assert(!!reloaded, 'create: relu depuis profiles.json')
}

// ── 4. Profil natif protégé ─────────────────────────────────────────────────
function testNativeProtected(): void {
  freshDir()
  loadProfileLibrary()
  let threwUpdate = false
  try { updateProfile('synoria.profile.mtc.initial', { name: 'Hack' }) } catch { threwUpdate = true }
  assert(threwUpdate, 'natif: updateProfile refusé')
  let threwArchive = false
  try { archiveProfile('synoria.profile.mtc.initial') } catch { threwArchive = true }
  assert(threwArchive, 'natif: archiveProfile refusé')
}

// ── 5. Duplication ──────────────────────────────────────────────────────────
function testDuplicate(): void {
  freshDir()
  loadProfileLibrary()
  const copy = duplicateProfile('synoria.profile.mtc.initial', 'MTC personnalisé')
  assert(!copy.isNative, 'dup: la copie n\'est pas native')
  assert(!copy.isDefault, 'dup: la copie n\'est pas défaut')
  eq(copy.name, 'MTC personnalisé', 'dup: nom appliqué')
  eq(copy.pluginId, 'mtc_jp', 'dup: pluginId conservé')
  assert(copy.id !== 'synoria.profile.mtc.initial', 'dup: nouvel id')
}

// ── 6. setDefault : un seul défaut ──────────────────────────────────────────
function testSetDefault(): void {
  freshDir()
  const created = createProfile(draftProfile('Nouveau défaut'))
  setDefaultProfile(created.id)
  const defaults = getProfiles().filter(p => p.isDefault)
  eq(defaults.length, 1, 'default: un seul profil par défaut')
  eq(defaults[0].id, created.id, 'default: le bon profil est défaut')
}

// ── 7. Archivage ────────────────────────────────────────────────────────────
function testArchive(): void {
  freshDir()
  const a = createProfile(draftProfile('À archiver'))
  setDefaultProfile(a.id)
  archiveProfile(a.id)
  const reloaded = getProfileById(a.id)
  assert(!!reloaded?.isArchived, 'archive: marqué archivé')
  assert(!reloaded?.isDefault, 'archive: défaut retiré')
  assert(!!getDefaultProfile() && getDefaultProfile()!.id !== a.id, 'archive: nouveau défaut promu')
}

// ── 8. Migration : plugin actif tiers → profil ──────────────────────────────
function testMigrationWithPlugin(): void {
  freshDir()
  const plugin: PluginDefinition = { id: 'custom_form', name: 'Formulaire perso', specialty: 'Divers', version: '2.0.0', sections: [] }
  const res = migrateActivePluginToProfile({ getActivePlugin: () => plugin })
  assert(res.migrated, 'migration: migrée')
  assert(!!res.profile && res.profile.pluginId === 'custom_form', 'migration: profil référence le plugin')
  eq(res.profile?.legacySource, 'active_plugin', 'migration: legacySource')
  const res2 = migrateActivePluginToProfile({ getActivePlugin: () => plugin })
  assert(!res2.migrated, 'migration: idempotente (2e appel)')
}

// ── 9. Migration : aucun plugin actif ───────────────────────────────────────
function testMigrationNoPlugin(): void {
  freshDir()
  const res = migrateActivePluginToProfile({ getActivePlugin: () => null })
  assert(!res.migrated, 'migration vide: non migrée')
  assert(!!res.reason, 'migration vide: raison fournie')
  const lib = loadProfileLibrary()
  assert((lib.migrationVersion ?? 0) >= 1, 'migration vide: version de migration marquée')
}

// ── 10. Migration : plugin déjà couvert par un natif ────────────────────────
function testMigrationCoveredPlugin(): void {
  freshDir()
  loadProfileLibrary()
  const mtc: PluginDefinition = { id: 'mtc_jp', name: 'MTC', specialty: 'MTC', version: '1.2.0', useBuiltinForm: true, sections: [] }
  const res = migrateActivePluginToProfile({ getActivePlugin: () => mtc })
  assert(!res.migrated, 'migration couverte: pas de doublon créé')
}

// ── 11. resolveProfileForSession ────────────────────────────────────────────
function testResolve(): void {
  freshDir()
  loadProfileLibrary()
  const r1 = resolveProfileForSession({ getActivePlugin: () => null })
  eq(r1?.id, 'synoria.profile.generic.initial', 'resolve: défaut sans plugin')
  const kin: PluginDefinition = { id: 'kinesio_charlotte', name: 'Kiné', specialty: 'Kiné', version: '1.1.0', sections: [] }
  const r2 = resolveProfileForSession({ getActivePlugin: () => kin })
  eq(r2?.pluginId, 'kinesio_charlotte', 'resolve: profil correspondant au plugin actif')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  try {
    testSeed()
    testConsultationTypes()
    testCreate()
    testNativeProtected()
    testDuplicate()
    testSetDefault()
    testArchive()
    testMigrationWithPlugin()
    testMigrationNoPlugin()
    testMigrationCoveredPlugin()
    testResolve()
  } finally {
    __setUserDataDir(null)
    for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ } }
    tempDirs.length = 0
  }
  return { passed, failed, failures: [...failures] }
}
