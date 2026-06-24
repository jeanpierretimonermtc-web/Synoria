import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { PluginDefinition, PluginFieldType } from '../../shared/pluginTypes'

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

  for (const section of def.sections) {
    if (!section.id)    throw new Error(`Section sans "id" détectée.`)
    if (!section.title) throw new Error(`Section "${section.id}" sans "title".`)
    if (!Array.isArray(section.fields)) {
      throw new Error(`Section "${section.id}" : "fields" doit être un tableau.`)
    }
    for (const field of section.fields) {
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
