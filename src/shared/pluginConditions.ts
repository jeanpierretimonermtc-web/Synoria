/**
 * Évaluation des conditions `visibleWhen` (sections et champs de plugin).
 *
 * Source unique de vérité, utilisée à la fois par :
 *   - PluginFormRenderer.tsx (masque le contenu réellement rendu)
 *   - NewSessionPage.tsx (sommaire — doit refléter les mêmes sections visibles)
 *
 * Logique extraite de PluginFormRenderer.tsx (Proto-Kinesio-1.1) sans aucun
 * changement de comportement : mêmes fonctions, même corps.
 */

import type { PluginCondition } from './pluginTypes'

export function evaluateCondition(condition: PluginCondition, data: Record<string, any>): boolean {
  const currentValue = data[condition.fieldId]
  const operator = condition.operator || 'truthy'

  switch (operator) {
    case 'eq':
      return currentValue === condition.value
    case 'neq':
      return currentValue !== condition.value
    case 'includes':
      if (Array.isArray(currentValue)) return currentValue.includes(condition.value)
      if (typeof currentValue === 'string' && typeof condition.value === 'string') return currentValue.includes(condition.value)
      return false
    case 'excludes':
      if (Array.isArray(currentValue)) return !currentValue.includes(condition.value)
      if (typeof currentValue === 'string' && typeof condition.value === 'string') return !currentValue.includes(condition.value)
      return false
    case 'falsy':
      return !currentValue
    case 'truthy':
    default:
      return !!currentValue
  }
}

export function isVisible(conditions: PluginCondition[] | undefined, data: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(condition => evaluateCondition(condition, data))
}
