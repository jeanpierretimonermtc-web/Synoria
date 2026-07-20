/**
 * Validation centralisée des définitions de plugins/formulaires.
 *
 * Utilisable dans le process principal (Node.js) ET dans le renderer (browser).
 * Aucune dépendance Node.js — imports uniquement depuis src/shared/.
 */

import type { PluginDefinition } from './pluginTypes'
import { VALID_PLUGIN_TYPES } from './pluginRegistry'

export interface PluginValidationResult {
  valid:   boolean
  errors:  string[]
  plugin?: PluginDefinition
}

// ── Constantes ────────────────────────────────────────────────────────────────

/** Seuls les caractères ASCII alphanumériques, tiret et underscore sont autorisés dans les ids. */
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/

const OPTIONS_TYPES  = new Set(['select', 'radio', 'checkboxgroup'])
const NUMERIC_TYPES  = new Set(['number', 'rating'])
const VALID_OPERATORS = new Set(['eq', 'neq', 'includes', 'excludes', 'truthy', 'falsy'])

// ── Helpers internes ─────────────────────────────────────────────────────────

function validateConditionsFormat(
  conditions: unknown,
  context:    string,
  errors:     string[]
): void {
  if (!Array.isArray(conditions)) {
    errors.push(`${context} : "visibleWhen" doit être un tableau de conditions.`)
    return
  }
  for (const cond of conditions as unknown[]) {
    if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
      errors.push(`${context} : chaque condition dans "visibleWhen" doit être un objet.`)
      continue
    }
    const c = cond as Record<string, unknown>
    if (!c.fieldId || typeof c.fieldId !== 'string') {
      errors.push(`${context} : chaque condition "visibleWhen" requiert un champ "fieldId" (texte).`)
    }
    if (c.operator !== undefined) {
      if (typeof c.operator !== 'string' || !VALID_OPERATORS.has(c.operator)) {
        errors.push(
          `${context} : opérateur "visibleWhen" inconnu "${c.operator}". ` +
          `Valeurs autorisées : ${[...VALID_OPERATORS].join(', ')}.`
        )
      } else if (
        ['eq', 'neq', 'includes', 'excludes'].includes(c.operator) &&
        c.value === undefined
      ) {
        errors.push(
          `${context} : l'opérateur "${c.operator}" dans "visibleWhen" requiert une valeur "value".`
        )
      }
    }
  }
}

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Valide une définition de plugin issue d'une source non fiable (import fichier, IPC, builder).
 *
 * - Prend `unknown` pour signaler que la donnée n'est pas encore vérifiée.
 * - Ne modifie jamais l'objet source.
 * - Les messages d'erreur sont rédigés pour un utilisateur non technicien.
 *
 * @returns `{ valid, errors, plugin? }` — `plugin` n'est présent que si `valid === true`.
 */
export function validatePluginDefinition(raw: unknown): PluginValidationResult {
  const errors: string[] = []

  // ── Type de base ──────────────────────────────────────────────────────────
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Le formulaire doit être un objet JSON valide.'] }
  }

  const p = raw as Record<string, unknown>

  // ── Champs obligatoires du formulaire ─────────────────────────────────────

  if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
    errors.push('Identifiant manquant : le formulaire doit avoir un champ "id" non vide.')
  } else if (!SAFE_ID_RE.test(p.id)) {
    errors.push(
      `L'identifiant du formulaire "${p.id}" contient des caractères non autorisés ` +
      '(accents, espaces ou symboles). Utilisez uniquement des lettres non accentuées, ' +
      'chiffres, tirets (-) et underscores (_).'
    )
  }

  if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
    errors.push('Nom manquant : le formulaire doit avoir un champ "name" non vide.')
  }

  if (!p.specialty || typeof p.specialty !== 'string' || !p.specialty.trim()) {
    errors.push('Spécialité manquante : le formulaire doit avoir un champ "specialty" non vide.')
  }

  if (!p.version || typeof p.version !== 'string' || !p.version.trim()) {
    errors.push('Version manquante : le formulaire doit avoir un champ "version" (ex : "1.0.0").')
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  if (!Array.isArray(p.sections)) {
    errors.push('Le formulaire doit contenir un tableau "sections".')
    // Impossible d'aller plus loin
    return { valid: false, errors }
  }

  const isBuiltin = p.useBuiltinForm === true
  const sections  = p.sections as unknown[]

  if (!isBuiltin && sections.length === 0) {
    errors.push('Le formulaire doit contenir au moins une section.')
  }

  // Inventaire des ids de sections et de champs (pour unicité et références)
  const sectionIds = new Set<string>()
  const allFieldIds = new Set<string>()

  // ── Passe 1 : structure, ids, types, options, format des conditions ────────

  for (let secIdx = 0; secIdx < sections.length; secIdx++) {
    const sec = sections[secIdx]

    if (!sec || typeof sec !== 'object' || Array.isArray(sec)) {
      errors.push(`Section ${secIdx + 1} : format invalide (objet attendu).`)
      continue
    }

    const s = sec as Record<string, unknown>
    const secTitle =
      typeof s.title === 'string' && s.title.trim()
        ? `"${s.title}"`
        : `numéro ${secIdx + 1}`

    // id de section
    if (!s.id || typeof s.id !== 'string' || !s.id.trim()) {
      errors.push(`Section ${secTitle} : l'identifiant "id" est manquant.`)
    } else {
      if (!SAFE_ID_RE.test(s.id as string)) {
        errors.push(
          `Section ${secTitle} : l'identifiant "${s.id}" contient des caractères non autorisés. ` +
          'Utilisez uniquement des lettres, chiffres, tirets et underscores.'
        )
      }
      if (sectionIds.has(s.id as string)) {
        errors.push(`Identifiant de section dupliqué : "${s.id}" est utilisé plusieurs fois.`)
      } else {
        sectionIds.add(s.id as string)
      }
    }

    // title de section
    if (!s.title || typeof s.title !== 'string' || !s.title.trim()) {
      errors.push(`Section ${secTitle} : le titre "title" est manquant ou vide.`)
    }

    // visibleWhen de la section (format seulement — les références sont vérifiées en passe 2)
    if (s.visibleWhen !== undefined) {
      validateConditionsFormat(s.visibleWhen, `Section ${secTitle}`, errors)
    }

    // fields
    if (!Array.isArray(s.fields)) {
      errors.push(`Section ${secTitle} : "fields" doit être un tableau.`)
      continue
    }

    const fields = s.fields as unknown[]
    const realFields = fields.filter(
      f => f && typeof f === 'object' && !Array.isArray(f) &&
           (f as Record<string, unknown>).type !== 'separator'
    )

    if (!isBuiltin && realFields.length === 0) {
      errors.push(
        `Section ${secTitle} : elle doit contenir au moins un champ (les séparateurs ne comptent pas).`
      )
    }

    for (let fldIdx = 0; fldIdx < fields.length; fldIdx++) {
      const fld = fields[fldIdx]

      if (!fld || typeof fld !== 'object' || Array.isArray(fld)) {
        errors.push(`Section ${secTitle}, champ ${fldIdx + 1} : format invalide (objet attendu).`)
        continue
      }

      const f = fld as Record<string, unknown>

      // Les séparateurs n'ont pas d'id ni de label — on passe
      if (f.type === 'separator') continue

      const fldLabel =
        typeof f.id === 'string' && f.id.trim()
          ? `"${f.id}"`
          : `numéro ${fldIdx + 1}`

      // ── id du champ ──
      if (!f.id || typeof f.id !== 'string' || !f.id.trim()) {
        errors.push(`Section ${secTitle}, champ ${fldLabel} : l'identifiant "id" est manquant.`)
      } else {
        if (!SAFE_ID_RE.test(f.id as string)) {
          errors.push(
            `Section ${secTitle} : l'identifiant de champ "${f.id}" contient des caractères ` +
            'non autorisés (accents, espaces, symboles). ' +
            'Utilisez uniquement des lettres, chiffres, tirets et underscores.'
          )
        }
        if (allFieldIds.has(f.id as string)) {
          errors.push(
            `Identifiant de champ dupliqué : "${f.id}" apparaît dans plusieurs sections. ` +
            'Chaque champ doit avoir un identifiant unique dans tout le formulaire.'
          )
        } else {
          allFieldIds.add(f.id as string)
        }
      }

      // ── type du champ ──
      if (!f.type || typeof f.type !== 'string') {
        errors.push(`Section ${secTitle}, champ ${fldLabel} : le type "type" est manquant.`)
      } else if (!(VALID_PLUGIN_TYPES as readonly string[]).includes(f.type)) {
        errors.push(
          `Section ${secTitle}, champ ${fldLabel} : type de champ inconnu "${f.type}". ` +
          `Types disponibles : ${(VALID_PLUGIN_TYPES as readonly string[]).join(', ')}.`
        )
      }

      // ── label du champ ──
      if (!f.label || typeof f.label !== 'string' || !f.label.trim()) {
        errors.push(
          `Section ${secTitle}, champ ${fldLabel} : l'intitulé "label" est manquant ou vide.`
        )
      }

      // ── options pour select / radio / checkboxgroup ──
      if (OPTIONS_TYPES.has(f.type as string)) {
        const opts = Array.isArray(f.options)
          ? (f.options as unknown[]).filter(
              o => typeof o === 'string' && (o as string).trim()
            )
          : []
        if (opts.length < 2) {
          errors.push(
            `Section ${secTitle}, champ ${fldLabel} (${f.type}) : ` +
            'au moins 2 options non vides sont requises.'
          )
        }
      }

      // ── min < max pour number et rating ──
      if (NUMERIC_TYPES.has(f.type as string)) {
        const min = typeof f.min === 'number' ? f.min : undefined
        const max = typeof f.max === 'number' ? f.max : undefined
        if (min !== undefined && max !== undefined && min >= max) {
          errors.push(
            `Section ${secTitle}, champ ${fldLabel} : ` +
            `la valeur minimale (${min}) doit être strictement inférieure ` +
            `à la valeur maximale (${max}).`
          )
        }
      }

      // ── visibleWhen du champ (format) ──
      if (f.visibleWhen !== undefined) {
        validateConditionsFormat(
          f.visibleWhen,
          `Champ ${fldLabel} (section ${secTitle})`,
          errors
        )
      }
    }
  }

  // ── Passe 2 : cohérence des références visibleWhen → fieldId existants ────
  // (uniquement si des ids ont été collectés — évite les faux positifs en cas d'erreurs amont)

  if (allFieldIds.size > 0) {
    for (const sec of sections) {
      if (!sec || typeof sec !== 'object' || Array.isArray(sec)) continue
      const s = sec as Record<string, unknown>
      const secTitle =
        typeof s.title === 'string' && s.title.trim() ? `"${s.title}"` : '(sans titre)'

      // Conditions de visibilité de la section
      if (Array.isArray(s.visibleWhen)) {
        for (const cond of s.visibleWhen as Record<string, unknown>[]) {
          if (
            typeof cond?.fieldId === 'string' &&
            cond.fieldId &&
            !allFieldIds.has(cond.fieldId)
          ) {
            errors.push(
              `Section ${secTitle} : la condition "visibleWhen" fait référence ` +
              `au champ "${cond.fieldId}" qui n'existe pas dans ce formulaire.`
            )
          }
        }
      }

      if (!Array.isArray(s.fields)) continue

      for (const fld of s.fields as Record<string, unknown>[]) {
        if (!fld || fld.type === 'separator' || !Array.isArray(fld.visibleWhen)) continue
        const fldLabel = typeof fld.id === 'string' && fld.id ? `"${fld.id}"` : '(sans id)'

        for (const cond of fld.visibleWhen as Record<string, unknown>[]) {
          if (typeof cond?.fieldId !== 'string' || !cond.fieldId) continue

          if (cond.fieldId === fld.id) {
            errors.push(
              `Champ ${fldLabel} (section ${secTitle}) : ` +
              'la condition "visibleWhen" ne peut pas référencer le champ lui-même.'
            )
          } else if (!allFieldIds.has(cond.fieldId)) {
            errors.push(
              `Champ ${fldLabel} (section ${secTitle}) : ` +
              `la condition "visibleWhen" fait référence au champ "${cond.fieldId}" ` +
              "qui n'existe pas dans ce formulaire."
            )
          }
        }
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors }

  return { valid: true, errors: [], plugin: p as unknown as PluginDefinition }
}
