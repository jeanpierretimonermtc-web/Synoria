/**
 * Service de gestion des profils de séance (Phase 3).
 *
 * Les profils sont stockés dans `userData/profiles.json` — un fichier JSON
 * versionné, écrit de façon ATOMIQUE (fichier temporaire + rename). Ce service
 * ne touche JAMAIS à SQLite : better-sqlite3 est synchrone et réservé aux
 * repositories. Ici, uniquement du fichier JSON, en synchrone.
 *
 * Règles :
 *   - Les profils natifs (`isNative: true`) ne sont jamais modifiés ni supprimés.
 *   - Un seul profil peut être `isDefault: true` à la fois.
 *   - La journalisation ne contient que des métadonnées (aucune donnée patient).
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import {
  PROFILE_LIBRARY_VERSION,
  PROFILE_MIGRATION_VERSION,
  CORE_VERSION,
  type ProfileLibrary,
  type SessionFormProfile,
  type CoreProfileConfiguration,
} from '../../shared/sessionProfileTypes'
import type { PluginDefinition } from '../../shared/pluginTypes'
import { getNativeProfiles } from './nativeProfiles'

// ── Emplacement fichier ───────────────────────────────────────────────────────

/** Répertoire userData surchargeable pour les tests (évite d'appeler app.getPath). */
let _userDataOverride: string | null = null

/** Test-only : force le répertoire de stockage des profils. */
export function __setUserDataDir(dir: string | null): void {
  _userDataOverride = dir
}

function userDataDir(): string {
  return _userDataOverride ?? app.getPath('userData')
}

function libraryPath(): string {
  return join(userDataDir(), 'profiles.json')
}

function tmpPath(): string {
  return join(userDataDir(), 'profiles.json.tmp')
}

function nowIso(): string {
  return new Date().toISOString()
}

function fullCoreConfig(): CoreProfileConfiguration {
  return { disabledSections: [], customTitles: {}, sectionOrder: [] }
}

// ── Lecture / écriture ────────────────────────────────────────────────────────

/**
 * Charge la bibliothèque de profils. Crée une bibliothèque initiale (natifs)
 * si le fichier est absent. Fusionne toujours les profils natifs manquants
 * (pour supporter l'ajout de nouveaux natifs dans une future version).
 */
export function loadProfileLibrary(): ProfileLibrary {
  const p = libraryPath()
  let lib: ProfileLibrary | null = null

  if (existsSync(p)) {
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf8')) as ProfileLibrary
      if (parsed && Array.isArray(parsed.profiles)) lib = parsed
    } catch {
      lib = null // fichier corrompu → on repart des natifs
    }
  }

  if (!lib) {
    lib = seedLibrary()
    saveProfileLibrary(lib)
    return lib
  }

  // Fusion des natifs manquants (idempotent).
  const known = new Set(lib.profiles.map(pr => pr.id))
  let changed = false
  for (const nat of getNativeProfiles()) {
    if (!known.has(nat.id)) {
      // Si un défaut existe déjà, ne pas réintroduire un second défaut.
      if (nat.isDefault && lib.profiles.some(pr => pr.isDefault)) nat.isDefault = false
      lib.profiles.push(nat)
      changed = true
    }
  }
  if (changed) {
    lib.updatedAt = nowIso()
    saveProfileLibrary(lib)
  }
  return lib
}

function seedLibrary(): ProfileLibrary {
  return {
    version: PROFILE_LIBRARY_VERSION,
    updatedAt: nowIso(),
    profiles: getNativeProfiles(),
    migrationVersion: 0,
  }
}

/** Écriture atomique : écrit dans profiles.json.tmp puis renomme. */
export function saveProfileLibrary(lib: ProfileLibrary): void {
  const data = JSON.stringify(lib, null, 2)
  const tmp = tmpPath()
  try {
    writeFileSync(tmp, data, 'utf8')
    renameSync(tmp, libraryPath())
  } catch {
    // Repli : écriture directe si le rename échoue (ex : verrou antivirus).
    writeFileSync(libraryPath(), data, 'utf8')
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function getProfiles(): SessionFormProfile[] {
  return loadProfileLibrary().profiles
}

export function getProfileById(id: string): SessionFormProfile | null {
  return getProfiles().find(p => p.id === id) ?? null
}

export function getDefaultProfile(): SessionFormProfile | null {
  const profiles = getProfiles().filter(p => !p.isArchived)
  return profiles.find(p => p.isDefault) ?? profiles[0] ?? null
}

export function createProfile(
  data: Omit<SessionFormProfile, 'id' | 'createdAt' | 'updatedAt'>,
): SessionFormProfile {
  const lib = loadProfileLibrary()
  const now = nowIso()
  const profile: SessionFormProfile = {
    ...data,
    id: `profile_${uuidv4()}`,
    isNative: false, // un profil créé n'est jamais natif
    coreVersion: data.coreVersion || CORE_VERSION,
    coreConfiguration: data.coreConfiguration ?? fullCoreConfig(),
    enabledModules: data.enabledModules ?? [],
    createdAt: now,
    updatedAt: now,
  }
  if (profile.isDefault) unsetOtherDefaults(lib, profile.id)
  lib.profiles.push(profile)
  lib.updatedAt = now
  saveProfileLibrary(lib)
  return profile
}

export function updateProfile(id: string, data: Partial<SessionFormProfile>): SessionFormProfile {
  const lib = loadProfileLibrary()
  const idx = lib.profiles.findIndex(p => p.id === id)
  if (idx < 0) throw new Error(`Profil ${id} introuvable`)
  if (lib.profiles[idx].isNative) throw new Error('Un profil natif ne peut pas être modifié')

  const merged: SessionFormProfile = {
    ...lib.profiles[idx],
    ...data,
    id,                       // id immuable
    isNative: false,          // reste non-natif
    createdAt: lib.profiles[idx].createdAt,
    updatedAt: nowIso(),
  }
  if (merged.isDefault) unsetOtherDefaults(lib, id)
  lib.profiles[idx] = merged
  lib.updatedAt = nowIso()
  saveProfileLibrary(lib)
  return merged
}

export function duplicateProfile(id: string, newName: string): SessionFormProfile {
  const src = getProfileById(id)
  if (!src) throw new Error(`Profil ${id} introuvable`)
  const now = nowIso()
  const copy: SessionFormProfile = {
    ...JSON.parse(JSON.stringify(src)) as SessionFormProfile,
    id: `profile_${uuidv4()}`,
    name: newName || `${src.name} (copie)`,
    isNative: false,
    isDefault: false,
    isArchived: false,
    legacySource: undefined,
    createdAt: now,
    updatedAt: now,
  }
  const lib = loadProfileLibrary()
  lib.profiles.push(copy)
  lib.updatedAt = now
  saveProfileLibrary(lib)
  return copy
}

export function archiveProfile(id: string): void {
  const lib = loadProfileLibrary()
  const idx = lib.profiles.findIndex(p => p.id === id)
  if (idx < 0) throw new Error(`Profil ${id} introuvable`)
  if (lib.profiles[idx].isNative) throw new Error('Un profil natif ne peut pas être archivé')
  lib.profiles[idx].isArchived = true
  lib.profiles[idx].updatedAt = nowIso()
  // Si le profil archivé était le défaut, promouvoir le premier profil actif.
  if (lib.profiles[idx].isDefault) {
    lib.profiles[idx].isDefault = false
    const fallback = lib.profiles.find(p => !p.isArchived)
    if (fallback) fallback.isDefault = true
  }
  lib.updatedAt = nowIso()
  saveProfileLibrary(lib)
}

export function setDefaultProfile(id: string): void {
  const lib = loadProfileLibrary()
  const target = lib.profiles.find(p => p.id === id)
  if (!target) throw new Error(`Profil ${id} introuvable`)
  unsetOtherDefaults(lib, id)
  target.isDefault = true
  target.isArchived = false
  target.updatedAt = nowIso()
  lib.updatedAt = nowIso()
  saveProfileLibrary(lib)
}

function unsetOtherDefaults(lib: ProfileLibrary, keepId: string): void {
  for (const p of lib.profiles) {
    if (p.id !== keepId && p.isDefault) p.isDefault = false
  }
}

// ── Migration legacy (active.plugin.json → profil) ─────────────────────────────

interface ActivePluginProvider {
  getActivePlugin?: () => PluginDefinition | null
  getPlugin?: () => unknown
}

function resolveActivePlugin(provider: ActivePluginProvider): PluginDefinition | null {
  try {
    if (typeof provider.getActivePlugin === 'function') return provider.getActivePlugin() ?? null
    if (typeof provider.getPlugin === 'function') return (provider.getPlugin() as PluginDefinition | null) ?? null
  } catch { /* ignore */ }
  return null
}

/**
 * Migre le plugin actif (active.plugin.json) vers un profil de séance, une seule
 * fois. Si aucun plugin n'est actif, la migration est marquée comme faite sans
 * créer de profil. Idempotent : ne re-crée jamais un profil déjà présent.
 */
export function migrateActivePluginToProfile(
  provider: ActivePluginProvider,
): { migrated: boolean; profile?: SessionFormProfile; reason?: string } {
  const lib = loadProfileLibrary()

  if ((lib.migrationVersion ?? 0) >= PROFILE_MIGRATION_VERSION) {
    return { migrated: false, reason: 'Migration déjà effectuée' }
  }

  const plugin = resolveActivePlugin(provider)

  if (!plugin) {
    lib.migrationVersion = PROFILE_MIGRATION_VERSION
    lib.updatedAt = nowIso()
    saveProfileLibrary(lib)
    return { migrated: false, reason: 'Aucun plugin actif à migrer' }
  }

  // Un profil natif couvre-t-il déjà ce plugin ? (mtc_jp, kinesio_charlotte)
  const alreadyCovered = lib.profiles.some(p => p.pluginId === plugin.id)
  if (alreadyCovered) {
    lib.migrationVersion = PROFILE_MIGRATION_VERSION
    lib.updatedAt = nowIso()
    saveProfileLibrary(lib)
    return { migrated: false, reason: `Plugin "${plugin.id}" déjà couvert par un profil` }
  }

  const now = nowIso()
  const profile: SessionFormProfile = {
    id: `synoria.profile.migrated.${plugin.id}`,
    name: plugin.name || `Profil ${plugin.id}`,
    description: plugin.description || 'Profil migré depuis le formulaire actif.',
    specialty: plugin.specialty || 'Personnalisé',
    consultationType: 'custom',
    version: '1.0.0',
    coreVersion: CORE_VERSION,
    coreConfiguration: fullCoreConfig(),
    pluginId: plugin.id,
    pluginVersion: plugin.version,
    useBuiltinForm: !!plugin.useBuiltinForm,
    enabledModules: [],
    isNative: false,
    isDefault: false,
    legacySource: plugin.useBuiltinForm ? 'builtin_form' : 'active_plugin',
    createdAt: now,
    updatedAt: now,
  }

  lib.profiles.push(profile)
  lib.migrationVersion = PROFILE_MIGRATION_VERSION
  lib.updatedAt = now
  saveProfileLibrary(lib)
  return { migrated: true, profile }
}

// ── Résolution du profil d'une séance ──────────────────────────────────────────

/**
 * Détermine le profil à utiliser pour une nouvelle séance. Priorité :
 *   1. profil par défaut correspondant au plugin actif (si présent)
 *   2. profil par défaut
 *   3. profil correspondant au plugin actif
 *   4. null (fallback legacy : NewSessionPage garde son comportement actuel)
 */
export function resolveProfileForSession(
  provider: ActivePluginProvider,
): SessionFormProfile | null {
  const profiles = getProfiles().filter(p => !p.isArchived)
  if (profiles.length === 0) return null

  const plugin = resolveActivePlugin(provider)
  const def = profiles.find(p => p.isDefault) ?? null

  if (plugin) {
    if (def && def.pluginId === plugin.id) return def
    const match = profiles.find(p => p.pluginId === plugin.id)
    if (match) return match
  }

  return def ?? profiles[0] ?? null
}
