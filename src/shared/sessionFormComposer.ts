/**
 * Compositeur de formulaire de séance (Phase 3).
 *
 * Assemble le formulaire final d'une séance à partir de :
 *   - le Core Synoria (sections communes stables)
 *   - la configuration du profil (sections désactivées, titres, ordre)
 *   - éventuellement un plugin de spécialité (sections métier)
 *
 * Résultat : un `ComposedSessionFormDefinition` purement descriptif. Le
 * compositeur ne rend rien et ne touche à aucun stockage — fonction pure.
 *
 * Ordre du formulaire composé :
 *   1. Contexte Core                (motif, type, attentes)
 *   2. Évolution Core               (suivi uniquement : évolution, nouveaux symptômes)
 *   3. Sécurité Core                (si activée)
 *   4. Sections métier du plugin    (dans l'ordre du plugin)
 *   5. Résultat Core                (avant/après, observations)
 *   6. Conseils / Suivi Core        (conseils, plan, prochain RDV)
 *
 * Gestion des doublons :
 *   - plugin.hideGlobalMotif === true → on retire le champ core.consultation_reason.
 *   - useBuiltinForm === true         → aucune section Core (le formulaire MTC
 *                                       intégré est rendu séparément — legacy préservé).
 */

import type {
  SessionFormProfile,
  SynoriaCoreDefinition,
  SynoriaCoreSection,
  ComposedSessionFormDefinition,
  ComposedFormSection,
  ComposedOmission,
  ConsultationType,
} from './sessionProfileTypes'
import type { PluginDefinition, PluginField } from './pluginTypes'

export interface ComposeSessionFormInput {
  core: SynoriaCoreDefinition
  profile: SessionFormProfile
  plugin?: PluginDefinition | null
  consultationType?: ConsultationType
}

/** dataKey du champ motif global (susceptible d'être masqué par hideGlobalMotif). */
const CONSULTATION_REASON_KEY = 'core.consultation_reason'

function coreSectionToComposed(
  section: SynoriaCoreSection,
  customTitles: Record<string, string>,
  fields: PluginField[],
): ComposedFormSection {
  return {
    id: section.id,
    title: customTitles[section.id] || section.title,
    source: 'core',
    required: section.required,
    fields,
    accentColor: section.accentColor,
    icon: section.icon,
  }
}

/** Ordonne des sections Core selon sectionOrder (les absentes conservent l'ordre initial). */
function orderCoreSections(
  sections: SynoriaCoreSection[],
  sectionOrder: string[],
): SynoriaCoreSection[] {
  if (!Array.isArray(sectionOrder) || sectionOrder.length === 0) return sections
  const rank = new Map(sectionOrder.map((id, i) => [id, i]))
  return sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ra = rank.has(a.s.id) ? (rank.get(a.s.id) as number) : Number.MAX_SAFE_INTEGER
      const rb = rank.has(b.s.id) ? (rank.get(b.s.id) as number) : Number.MAX_SAFE_INTEGER
      return ra === rb ? a.i - b.i : ra - rb
    })
    .map(x => x.s)
}

export function composeSessionForm(
  input: ComposeSessionFormInput,
): ComposedSessionFormDefinition {
  const { core, profile, plugin } = input
  const consultationType = input.consultationType ?? profile.consultationType
  const config = profile.coreConfiguration ?? { disabledSections: [], customTitles: {}, sectionOrder: [] }
  const disabled = new Set(config.disabledSections ?? [])
  const customTitles = config.customTitles ?? {}

  const omitted: ComposedOmission[] = []
  const isBuiltin = !!(profile.useBuiltinForm || plugin?.useBuiltinForm)
  const hideMotif = !!plugin?.hideGlobalMotif && !isBuiltin

  // ── Cas legacy : formulaire MTC intégré ──────────────────────────────────
  // Aucune section Core n'est composée ; le formulaire intégré est rendu à part.
  if (isBuiltin) {
    for (const section of core.sections) {
      omitted.push({ kind: 'section', id: section.id,
        reason: 'useBuiltinForm : formulaire intégré, sections Core non composées' })
    }
    return {
      profileId: profile.id,
      profileVersion: profile.version,
      consultationType,
      coreVersion: core.version,
      sections: [],
      pluginId: plugin?.id ?? profile.pluginId,
      pluginVersion: plugin?.version ?? profile.pluginVersion,
      composedAt: new Date().toISOString(),
      omitted,
    }
  }

  // ── Sélection des sections Core actives ──────────────────────────────────
  const activeCore: SynoriaCoreSection[] = []
  for (const section of core.sections) {
    if (section.followUpOnly && consultationType !== 'follow_up') {
      omitted.push({ kind: 'section', id: section.id,
        reason: `réservée au suivi (consultationType=${consultationType})` })
      continue
    }
    if (!section.required && disabled.has(section.id)) {
      omitted.push({ kind: 'section', id: section.id, reason: 'désactivée dans le profil' })
      continue
    }
    activeCore.push(section)
  }

  const orderedCore = orderCoreSections(activeCore, config.sectionOrder ?? [])

  // Construit les sections composées Core en filtrant les champs masqués.
  function buildCore(section: SynoriaCoreSection): ComposedFormSection | null {
    let fields = section.fields
    if (hideMotif) {
      const before = fields.length
      fields = fields.filter(f => f.dataKey !== CONSULTATION_REASON_KEY)
      if (fields.length !== before) {
        omitted.push({ kind: 'field', id: CONSULTATION_REASON_KEY,
          reason: 'doublon : plugin.hideGlobalMotif couvre déjà le motif' })
      }
    }
    if (fields.length === 0) {
      omitted.push({ kind: 'section', id: section.id, reason: 'aucun champ restant après filtrage' })
      return null
    }
    return coreSectionToComposed(section, customTitles, fields)
  }

  // ── Placement : sections Core "avant plugin" et "après plugin" ────────────
  const beforePlugin: ComposedFormSection[] = []
  const afterPlugin: ComposedFormSection[] = []
  for (const section of orderedCore) {
    const composed = buildCore(section)
    if (!composed) continue
    if (section.placement === 'outcome' || section.placement === 'followup') {
      afterPlugin.push(composed)
    } else {
      beforePlugin.push(composed)
    }
  }

  // ── Sections métier du plugin ────────────────────────────────────────────
  const pluginSections: ComposedFormSection[] = []
  if (plugin && Array.isArray(plugin.sections)) {
    for (const s of plugin.sections) {
      pluginSections.push({
        id: `plugin.${s.id}`,
        title: s.title,
        source: 'plugin',
        required: false,
        fields: Array.isArray(s.fields) ? s.fields : [],
        accentColor: s.accentColor,
        icon: s.icon,
      })
    }
  }

  // ── Sections personnalisées du profil (après le plugin, avant Résultat) ───
  const customSections: ComposedFormSection[] = []
  if (Array.isArray(profile.customSections)) {
    for (const s of profile.customSections) {
      customSections.push({
        id: `custom.${s.id}`,
        title: s.title,
        source: 'custom',
        required: false,
        fields: Array.isArray(s.fields) ? s.fields : [],
        accentColor: s.accentColor,
        icon: s.icon,
      })
    }
  }

  const sections = [
    ...beforePlugin,
    ...pluginSections,
    ...customSections,
    ...afterPlugin,
  ]

  return {
    profileId: profile.id,
    profileVersion: profile.version,
    consultationType,
    coreVersion: core.version,
    sections,
    pluginId: plugin?.id ?? profile.pluginId,
    pluginVersion: plugin?.version ?? profile.pluginVersion,
    composedAt: new Date().toISOString(),
    omitted,
  }
}
