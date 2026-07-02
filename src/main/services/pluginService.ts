import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { PluginDefinition, PluginFieldType, PluginConditionOperator, PluginCondition } from '../../shared/pluginTypes'

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

const VALID_TYPES: PluginFieldType[] = [
  'text','textarea','richtext','number','date',
  'select','radio','checkbox','checkboxgroup','tags','rating','bodychart','separator',
]

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
  writeFileSync(pluginPath(), JSON.stringify(plugin, null, 2), 'utf8')
}

export function removePlugin(): void {
  const p = pluginPath()
  if (existsSync(p)) unlinkSync(p)
}

/** Lit, valide et retourne la définition d'un plugin depuis un fichier. */
export function importPluginFromFile(filePath: string): PluginDefinition {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch {
    throw new Error(`Impossible de lire le fichier : ${filePath}`)
  }

  let def: PluginDefinition
  try {
    def = JSON.parse(raw)
  } catch {
    throw new Error('Le fichier n\'est pas un JSON valide.')
  }

  // Validation des champs requis
  if (!def.id)        throw new Error('Champ requis manquant : "id"')
  if (!def.name)      throw new Error('Champ requis manquant : "name"')
  if (!def.version)   throw new Error('Champ requis manquant : "version"')
  if (!def.specialty) throw new Error('Champ requis manquant : "specialty"')
  if (!Array.isArray(def.sections) || (def.sections.length === 0 && !def.useBuiltinForm)) {
    throw new Error('Le plugin doit contenir au moins une section ("sections").')
  }

  const VALID_OPERATORS: PluginConditionOperator[] = ['eq','neq','includes','excludes','truthy','falsy']

  const validateConditions = (conditions: unknown, context: string) => {
    if (!Array.isArray(conditions)) throw new Error(`${context} : "visibleWhen" doit être un tableau.`)
    for (const condition of conditions) {
      if (!condition || typeof condition !== 'object') {
        throw new Error(`${context} : chaque condition doit être un objet.`)
      }
      const cond = condition as PluginCondition
      if (!cond.fieldId || typeof cond.fieldId !== 'string') {
        throw new Error(`${context} : chaque condition requiert un champ "fieldId" de type string.`)
      }
      if (cond.operator && !VALID_OPERATORS.includes(cond.operator)) {
        throw new Error(`${context} : opérateur inconnu "${cond.operator}". Utilisez ${VALID_OPERATORS.join(', ')}.`)
      }
      if (cond.operator && ['eq','neq','includes','excludes'].includes(cond.operator)) {
        if (cond.value === undefined) {
          throw new Error(`${context} : l'opérateur "${cond.operator}" nécessite une valeur "value".`)
        }
      }
    }
  }

  for (const section of def.sections) {
    if (!section.id)    throw new Error(`Section sans "id" détectée.`)
    if (!section.title) throw new Error(`Section "${section.id}" sans "title".`)
    if (section.visibleWhen !== undefined) {
      validateConditions(section.visibleWhen, `Section "${section.id}"`)      }
    if (!Array.isArray(section.fields)) {
      throw new Error(`Section "${section.id}" : "fields" doit être un tableau.`)
    }
    for (const field of section.fields) {
      if (field.visibleWhen !== undefined) {
        validateConditions(field.visibleWhen, `Champ "${field.id}" dans la section "${section.title}"`)
      }
      if (field.type === 'separator') continue  // pas d'id requis pour les séparateurs
      if (!field.id)    throw new Error(`Champ sans "id" dans la section "${section.title}".`)
      if (!field.type)  throw new Error(`Champ "${field.id}" sans "type".`)
      if (!field.label) throw new Error(`Champ "${field.id}" sans "label".`)
      if (!VALID_TYPES.includes(field.type)) {
        throw new Error(`Type inconnu "${field.type}" pour le champ "${field.id}". Types valides : ${VALID_TYPES.join(', ')}`)
      }
      if (['select','radio','checkboxgroup'].includes(field.type) && (!field.options || field.options.length === 0)) {
        throw new Error(`Champ "${field.id}" (${field.type}) : "options" est requis et doit être non vide.`)
      }
    }
  }

  return def
}
