import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { PluginDefinition } from '../../shared/pluginTypes'
import { validatePluginDefinition } from '../../shared/pluginValidator'

// ── Bibliothèque de plugins utilisateur ──────────────────────────────────────

interface PluginLibraryEntry {
  plugin:     PluginDefinition
  savedAt:    string    // ISO date
  isNative?:  boolean   // true = fichier maître natif, jamais écrasable
}

function libraryPath(): string {
  return join(app.getPath('userData'), 'plugin-library.json')
}

export function getPluginLibrary(): PluginLibraryEntry[] {
  const p = libraryPath()
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf8')) as PluginLibraryEntry[] }
  catch { return [] }
}

/** Sauvegarde un plugin personnalisé. Si un natif du même ID existe, crée/écrase une entrée _custom. */
export function savePluginToLibrary(plugin: PluginDefinition): void {
  const lib = getPluginLibrary()
  const nativeIdx = lib.findIndex(e => e.plugin.id === plugin.id && e.isNative)
  if (nativeIdx >= 0) {
    // Un natif existe avec ce même ID — on sauvegarde en _custom pour ne pas l'écraser
    const customId = plugin.id + '_custom'
    const customIdx = lib.findIndex(e => e.plugin.id === customId)
    const entry: PluginLibraryEntry = { plugin: { ...plugin, id: customId }, savedAt: new Date().toISOString() }
    if (customIdx >= 0) lib[customIdx] = entry
    else lib.push(entry)
  } else {
    const idx = lib.findIndex(e => e.plugin.id === plugin.id)
    const entry: PluginLibraryEntry = { plugin, savedAt: new Date().toISOString() }
    if (idx >= 0) lib[idx] = entry
    else lib.push(entry)
  }
  writeFileSync(libraryPath(), JSON.stringify(lib, null, 2), 'utf8')
}

/** Enregistre un plugin comme fichier maître natif. Ignoré si un natif avec cet ID existe déjà. */
export function saveNativePluginToLibrary(plugin: PluginDefinition): void {
  const lib = getPluginLibrary()
  const alreadyNative = lib.some(e => e.plugin.id === plugin.id && e.isNative)
  if (alreadyNative) return
  lib.push({ plugin, savedAt: new Date().toISOString(), isNative: true })
  writeFileSync(libraryPath(), JSON.stringify(lib, null, 2), 'utf8')
}

export function deletePluginFromLibrary(pluginId: string): void {
  const lib = getPluginLibrary().filter(e => e.plugin.id !== pluginId)
  writeFileSync(libraryPath(), JSON.stringify(lib, null, 2), 'utf8')
}

export function setPluginLibrary(entries: PluginLibraryEntry[]): void {
  writeFileSync(libraryPath(), JSON.stringify(entries, null, 2), 'utf8')
}

/** Exporte la bibliothèque complète vers un fichier JSON. */
export function exportPluginLibrary(destPath: string): void {
  const lib = getPluginLibrary()
  writeFileSync(destPath, JSON.stringify(lib, null, 2), 'utf8')
}

/**
 * Importe une bibliothèque depuis un fichier JSON et fusionne avec l'existante.
 * Règle : si un ID existe déjà, la version importée écrase l'entrée (sauf si l'entrée
 * existante est native ET l'entrée importée ne l'est pas).
 */
export function importPluginLibraryFromFile(srcPath: string): { added: number; updated: number } {
  let raw: string
  try { raw = readFileSync(srcPath, 'utf8') } catch { throw new Error(`Impossible de lire : ${srcPath}`) }

  let incoming: PluginLibraryEntry[]
  try { incoming = JSON.parse(raw) } catch { throw new Error('Fichier JSON invalide.') }
  if (!Array.isArray(incoming)) throw new Error('Format invalide : tableau attendu.')

  const lib = getPluginLibrary()
  let added = 0, updated = 0

  for (const entry of incoming) {
    if (!entry?.plugin?.id || !entry.plugin.name) continue
    // Valider la définition du plugin avant de l'ajouter
    if (!validatePluginDefinition(entry.plugin as unknown).valid) continue
    const existingIdx = lib.findIndex(e => e.plugin.id === entry.plugin.id)
    if (existingIdx >= 0) {
      // Ne jamais écraser un natif existant par un non-natif importé
      if (lib[existingIdx].isNative && !entry.isNative) continue
      lib[existingIdx] = { ...entry, savedAt: new Date().toISOString() }
      updated++
    } else {
      lib.push({ ...entry, savedAt: new Date().toISOString() })
      added++
    }
  }

  writeFileSync(libraryPath(), JSON.stringify(lib, null, 2), 'utf8')
  return { added, updated }
}

function pluginPath(): string {
  return join(app.getPath('userData'), 'active.plugin.json')
}

export function getActivePlugin(): PluginDefinition | null {
  const p = pluginPath()
  if (!existsSync(p)) return null
  try {
    const plugin = JSON.parse(readFileSync(p, 'utf8')) as PluginDefinition
    // Migration automatique : ancienne version du plugin MTC JP sans useBuiltinForm
    if (plugin.id === 'mtc_jp' && !plugin.useBuiltinForm) {
      plugin.useBuiltinForm = true
      plugin.sections      = []
      writeFileSync(p, JSON.stringify(plugin, null, 2), 'utf8')
    }
    return plugin
  } catch {
    return null
  }
}

export function setActivePlugin(plugin: PluginDefinition): void {
  const result = validatePluginDefinition(plugin as unknown)
  if (!result.valid) throw new Error('Formulaire invalide : ' + result.errors.join(' | '))
  writeFileSync(pluginPath(), JSON.stringify(plugin, null, 2), 'utf8')
}

export function removePlugin(): void {
  const p = pluginPath()
  if (existsSync(p)) unlinkSync(p)
}

/** Lit, valide et retourne la définition d'un plugin depuis un fichier. */
export function importPluginFromFile(filePath: string): PluginDefinition {
  let raw: string
  try { raw = readFileSync(filePath, 'utf8') }
  catch { throw new Error(`Impossible de lire le fichier : ${filePath}`) }

  let parsed: unknown
  try { parsed = JSON.parse(raw) }
  catch { throw new Error("Le fichier n'est pas un JSON valide.") }

  const result = validatePluginDefinition(parsed)
  if (!result.valid) throw new Error(result.errors.join(' | '))

  return result.plugin!
}

/**
 * Retourne tous les formulaires disponibles : plugins natifs (dist/plugins) + bibliothèque
 * utilisateur. La bibliothèque prend la priorité sur les natifs en cas d'ID identique.
 */
// IDs des formulaires officiels distribués par Synoria
const OFFICIAL_PLUGIN_IDS = new Set([
  'basique', 'douleur_evolution', 'kinesio_charlotte', 'mtc_jp', 'osteopathie', 'naturopathie',
])

/** Purge les entrées non-officielles de la bibliothèque locale (appelé au démarrage). */
export function purgePluginLibrary(): void {
  try {
    const p = libraryPath()
    if (!existsSync(p)) return
    const lib = getPluginLibrary()
    const cleaned = lib.filter(e => OFFICIAL_PLUGIN_IDS.has(e.plugin.id))
    if (cleaned.length !== lib.length) {
      writeFileSync(p, JSON.stringify(cleaned, null, 2), 'utf8')
    }
  } catch { /* non-bloquant */ }
}

export function listAvailablePlugins(): PluginDefinition[] {
  const publicDir = app.isPackaged
    ? join(app.getAppPath(), 'dist', 'plugins')
    : join(process.cwd(), 'public', 'plugins')

  const bundled: PluginDefinition[] = []
  try {
    const files = readdirSync(publicDir).filter(f => f.endsWith('.plugin.json'))
    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(join(publicDir, file), 'utf8'))
        if (content.id && content.name) bundled.push(content as PluginDefinition)
      } catch { /* skip invalid file */ }
    }
  } catch { /* directory absent */ }

  const map = new Map<string, PluginDefinition>()
  // Seuls les plugins officiels approuvés sont autorisés depuis la library
  for (const { plugin } of getPluginLibrary()) {
    if (OFFICIAL_PLUGIN_IDS.has(plugin.id)) map.set(plugin.id, plugin)
  }
  // Les bundled écrasent la library (source de vérité pour les noms et contenus)
  for (const p of bundled) map.set(p.id, p)

  // Le plugin actif importé par l'utilisateur (payant) est toujours inclus
  const active = getActivePlugin()
  if (active && !map.has(active.id)) map.set(active.id, active)

  return Array.from(map.values())
}
