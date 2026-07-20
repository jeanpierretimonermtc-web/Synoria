/**
 * Construction du document d'export intermédiaire (Phase 2).
 *
 *   CanonicalSessionData → ExportDocument
 *
 * Ce builder est LA source unique d'interprétation des données de séance pour
 * les rendus lisibles (HTML/PDF, et demain d'autres). Il :
 *   - ordonne les sections selon une colonne vertébrale clinique stable ;
 *   - s'appuie sur les adaptateurs de champ (pluginFieldAdapters) pour le rendu
 *     texte, en centralisant la logique jusqu'ici dupliquée ;
 *   - respecte summaryGroup / summaryLabel / summaryPriority quand le schéma du
 *     formulaire est disponible ;
 *   - n'omet que les valeurs RÉELLEMENT vides (jamais `false`, jamais `0`) ;
 *   - ne perd jamais une donnée : les champs/modules inconnus sont conservés en
 *     blocs bruts dans une section dédiée quand `includeUnknownData` est vrai.
 *
 * Fonction pure et synchrone. Aucune dépendance Node.js.
 */

import type { CanonicalSessionData, CanonicalFieldValue, CanonicalModuleData } from '../../../shared/sessionDataTypes'
import type {
  ExportDocument, ExportSection, ExportBlock,
} from '../../../shared/exportDocumentTypes'
import type { ExportContext } from '../../../shared/exportTypes'
import type { PluginDefinition, PluginField, PluginFieldType } from '../../../shared/pluginTypes'
import { resolveFieldAdapter, htmlToPlainText } from '../../../shared/pluginFieldAdapters'
import { isPluginModule } from '../../../shared/pluginRegistry'
import { getModuleAdapter } from '../../../shared/pluginModuleRegistry'

// ── Colonne vertébrale des sections ─────────────────────────────────────────

type GroupId =
  | 'motif' | 'evolution' | 'alertes' | 'evaluation'
  | 'analyse' | 'intervention' | 'resultat' | 'conseils' | 'suivi' | 'complementaires'

const GROUP_ORDER: GroupId[] = [
  'motif', 'evolution', 'alertes', 'evaluation',
  'analyse', 'intervention', 'resultat', 'conseils', 'suivi', 'complementaires',
]

const GROUP_TITLES: Record<GroupId, string> = {
  motif:           'Motif de consultation',
  evolution:       'Évolution',
  alertes:         'Alertes',
  evaluation:      'Évaluation clinique',
  analyse:         'Analyse & Diagnostic',
  intervention:    'Intervention & Traitement',
  resultat:        'Résultat & Réactions',
  conseils:        'Conseils',
  suivi:           'Plan de suivi',
  complementaires: 'Données complémentaires',
}

/** Rattache une clé Core (dataKey) à une section de la colonne vertébrale. */
const CORE_GROUP: Record<string, GroupId> = {
  'core.motif':            'motif',
  'core.evolution_tags':   'evolution',
  'core.evolution':        'evolution',
  'core.anamnese':                 'evaluation',
  'core.problematiques':           'evaluation',
  'core.observation':              'evaluation',
  'core.langue':                   'evaluation',
  'core.langueNote':               'evaluation',
  'core.pouls':                    'evaluation',
  'core.poulsNote':                'evaluation',
  'core.constitution':             'evaluation',
  'core.type_corps':               'evaluation',
  'core.teint':                    'evaluation',
  'core.simpleContextVie':         'evaluation',
  'core.simpleTraitementsEnCours': 'evaluation',
  'core.simpleObjectifs':          'evaluation',
  'core.simpleNotesEntretien':     'evaluation',
  'core.diagnostic_mtc': 'analyse',
  'core.cinq_elements':  'analyse',
  'core.causes':         'analyse',
  'core.analyse':        'analyse',
  'core.principes':      'analyse',
  'core.points':           'intervention',
  'core.pts_oreille':      'intervention',
  'core.techniques':       'intervention',
  'core.plantes':          'intervention',
  'core.traitement_notes': 'intervention',
  'core.barrageNiv1':      'intervention',
  'core.barrageNiv2':      'intervention',
  'core.barrageNiv3':      'intervention',
  'core.barrageNiv4':      'intervention',
  'core.reactions':  'resultat',
  'core.conseils':   'conseils',
  'core.plan':               'suivi',
  'core.surveiller':         'suivi',
  'core.next_session_date':  'suivi',
  'core.nextSession':        'suivi',
  'core.nextSessionHeure':   'suivi',
  'core.nextSessionFin':     'suivi',
  'core.nextSessionNote':    'suivi',
}

/** Clés Core ignorées dans le corps (déjà présentes dans les métadonnées). */
const CORE_SKIP = new Set<string>(['core.practitioner'])

// ── Détection de vacuité (jamais false, jamais 0) ───────────────────────────

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'boolean') return false
  if (typeof v === 'number') return Number.isNaN(v)
  if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length === 0
  return false
}

// ── Index du schéma de formulaire (métadonnées de résumé) ───────────────────

interface FieldMeta {
  def?: PluginField
  sectionTitle?: string
  sectionOrder: number
}

function indexSchema(def: PluginDefinition | null): Map<string, FieldMeta> {
  const map = new Map<string, FieldMeta>()
  if (!def || !Array.isArray(def.sections)) return map
  def.sections.forEach((section, sIdx) => {
    if (!section || !Array.isArray(section.fields)) return
    for (const f of section.fields) {
      if (f && typeof f === 'object' && typeof f.id === 'string') {
        map.set(f.id, { def: f, sectionTitle: section.title, sectionOrder: sIdx })
      }
    }
  })
  return map
}

// ── Rendu d'un champ canonique en blocs de document ─────────────────────────

function pseudoField(fv: CanonicalFieldValue, def?: PluginField): PluginField {
  return {
    id: fv.fieldId,
    type: (fv.type === 'unknown' ? 'text' : fv.type) as PluginFieldType,
    label: (def?.summaryLabel ?? def?.summary?.label ?? fv.labelSnapshot ?? fv.fieldId),
    max: def?.max,
    min: def?.min,
    options: def?.options,
    summaryLabel: def?.summaryLabel,
    summary: def?.summary,
  }
}

function fieldToBlocks(
  fv: CanonicalFieldValue,
  def: PluginField | undefined,
  includeUnknownData: boolean,
): ExportBlock[] {
  const label = def?.summaryLabel ?? def?.summary?.label ?? fv.labelSnapshot ?? fv.fieldId
  const value = fv.value

  if (isEmptyValue(value)) return []

  const type = fv.type

  // bodychart → bloc dédié
  if (type === 'bodychart' && value && typeof value === 'object' && !Array.isArray(value)) {
    const bc = value as { front?: string[]; back?: string[]; left?: string[]; right?: string[]; notes?: string }
    const zones: string[] = [
      ...(bc.front ?? []).map(z => `Antérieur : ${z}`),
      ...(bc.back  ?? []).map(z => `Postérieur : ${z}`),
      ...(bc.left  ?? []).map(z => `Profil gauche : ${z}`),
      ...(bc.right ?? []).map(z => `Profil droit : ${z}`),
    ]
    const notes = typeof bc.notes === 'string' ? bc.notes.trim() : ''
    if (!zones.length && !notes) return []
    return [{ type: 'bodychart', label, zones, notes: notes || undefined }]
  }

  // repeatable → tableau
  if (type === 'repeatable' && Array.isArray(value)) {
    const rows = (value as Array<{ nom?: string; note?: string }>)
      .filter(r => r && typeof r === 'object' && r.nom?.trim())
      .map(r => [r.nom!.trim(), (r.note ?? '').trim()])
    if (!rows.length) return []
    return [{ type: 'table', label, columns: ['Élément', 'Note'], rows }]
  }

  // tags / checkboxgroup → liste (valeur tableau OU chaîne séparée par virgules)
  if (type === 'tags' || type === 'checkboxgroup') {
    let items: string[] = []
    if (Array.isArray(value)) items = (value as unknown[]).filter(v => typeof v === 'string' && v.trim()).map(String)
    else if (typeof value === 'string') items = value.split(',').map(s => s.trim()).filter(Boolean)
    if (!items.length) return []
    return [{ type: 'list', label, items }]
  }

  // checkbox → Oui / Non (false conservé)
  if (type === 'checkbox') {
    return [{ type: 'keyvalue', label, value: value === true ? 'Oui' : 'Non' }]
  }

  // richtext / textarea → texte long (HTML conservé si présent)
  if (type === 'richtext' || type === 'textarea') {
    const raw = String(value)
    const plain = htmlToPlainText(raw)
    if (!plain) return []
    const hasHtml = /<[a-z][\s\S]*>/i.test(raw)
    return [{ type: 'text', label, content: hasHtml ? raw : plain, isHtml: hasHtml }]
  }

  // Autres types → adaptateur (texte compact) ou bloc brut
  const adapter = resolveFieldAdapter(type)
  const pf = pseudoField(fv, def)
  const summary = adapter.formatForSummary(adapter.normalizeValue(value, pf), pf)
  if (!summary.isEmpty && summary.text.trim()) {
    if (summary.text.includes('\n')) {
      return [{ type: 'text', label, content: summary.text }]
    }
    return [{ type: 'keyvalue', label, value: summary.text }]
  }
  // Rien de lisible mais donnée présente : conserver en brut si demandé.
  if (includeUnknownData) return [{ type: 'raw', label, jsonValue: value }]
  return []
}

const MODULE_TITLES: Record<string, string> = {
  mtc_systemes:        'Questionnaire par systèmes',
  energy_tests:        'Tests énergétiques',
  mtc_pouls_positions: 'Pouls — positions',
  mtc_tongue_pulse:    'Langue & Pouls',
  mtc_five_elements:   '5 Éléments',
  osteo_ortho_tests:   'Tests orthopédiques',
  osteo_posture:       'Bilan postural',
}
function moduleTitle(id: string): string { return MODULE_TITLES[id] ?? id }

/** Rendu d'un module complexe : utilise l'adaptateur Phase 4 si disponible, sinon fallback générique. */
function moduleToBlocks(mod: CanonicalModuleData, includeUnknownData: boolean): ExportBlock[] {
  if (isEmptyValue(mod.data)) return []
  const title = moduleTitle(mod.moduleId)

  // Phase 4 : adaptateur typé (normalisation + export structuré)
  const moduleAdapter = getModuleAdapter(mod.moduleId as PluginFieldType)
  if (moduleAdapter) {
    const normalized = moduleAdapter.normalizeValue(mod.data)
    if (moduleAdapter.isEmpty(normalized)) return []
    const blocks = moduleAdapter.exportToDocument(normalized)
    if (blocks.length) return blocks
    if (includeUnknownData) return [{ type: 'raw', label: title, jsonValue: mod.data }]
    return []
  }

  // Fallback : adaptateur générique (energy_tests, modules inconnus)
  const adapter = resolveFieldAdapter(mod.moduleId)
  const pseudo: PluginField = { id: mod.moduleId, type: mod.moduleId as PluginFieldType, label: title }
  const summary = adapter.formatForSummary(mod.data, pseudo)
  const blocks: ExportBlock[] = []
  if (!summary.isEmpty && summary.text.trim()) {
    blocks.push({ type: 'text', label: title, content: summary.text })
  }
  if (includeUnknownData) {
    blocks.push({ type: 'raw', label: `${title} (données complètes)`, jsonValue: mod.data })
  } else if (!blocks.length) {
    blocks.push({ type: 'raw', label: title, jsonValue: mod.data })
  }
  return blocks
}

// ── Construction principale ─────────────────────────────────────────────────

export function buildSessionExportDocument(
  canonical: CanonicalSessionData,
  context: ExportContext,
): ExportDocument {
  const schemaDef = (canonical.formSnapshot?.pluginDefinition as PluginDefinition | undefined) ?? null
  const schemaIndex = indexSchema(schemaDef)
  const includeUnknown = context.includeUnknownData

  const groups = new Map<GroupId, ExportBlock[]>()
  for (const g of GROUP_ORDER) groups.set(g, [])
  const push = (g: GroupId, blocks: ExportBlock[]) => {
    if (blocks.length) groups.get(g)!.push(...blocks)
  }

  // Alertes patient (contexte)
  const alerts = context.patient?.['alerts']
  if (typeof alerts === 'string' && alerts.trim()) {
    push('alertes', [{ type: 'notice', severity: 'warning', text: alerts.trim() }])
  }

  // Champs Core → colonne vertébrale
  for (const fv of Object.values(canonical.core ?? {})) {
    if (CORE_SKIP.has(fv.dataKey)) continue
    const group = CORE_GROUP[fv.dataKey] ?? 'evaluation'
    push(group, fieldToBlocks(fv, undefined, includeUnknown))
  }

  // Modules → Évaluation
  for (const mod of Object.values(canonical.modules ?? {})) {
    push('evaluation', moduleToBlocks(mod, includeUnknown))
  }

  // Champs plugin → sections propres (regroupées)
  interface PluginGroup { key: string; title: string; order: number; blocks: ExportBlock[] }
  const pluginGroups = new Map<string, PluginGroup>()
  const unknownFieldBlocks: ExportBlock[] = []

  for (const fv of Object.values(canonical.fields ?? {})) {
    const meta = schemaIndex.get(fv.fieldId)
    const def = meta?.def

    if (fv.type === 'unknown' || !def) {
      if (includeUnknown && !isEmptyValue(fv.value)) {
        unknownFieldBlocks.push({ type: 'raw', label: fv.labelSnapshot || fv.fieldId, jsonValue: fv.value })
      }
      continue
    }

    const blocks = fieldToBlocks(fv, def, includeUnknown)
    if (!blocks.length) continue

    const groupKey = def.summaryGroup ?? meta?.sectionTitle ?? 'Formulaire'
    const priority = def.summaryPriority ?? def.summary?.priority ?? 999
    const orderVal = (meta?.sectionOrder ?? 0) * 1000 + priority
    let pg = pluginGroups.get(groupKey)
    if (!pg) {
      pg = { key: groupKey, title: groupKey, order: orderVal, blocks: [] }
      pluginGroups.set(groupKey, pg)
    }
    pg.order = Math.min(pg.order, orderVal)
    pg.blocks.push(...blocks)
  }

  if (unknownFieldBlocks.length) push('complementaires', unknownFieldBlocks)

  // Assemblage des sections dans l'ordre de la colonne vertébrale
  const sections: ExportSection[] = []
  for (const g of GROUP_ORDER) {
    const blocks = groups.get(g)!
    if (blocks.length) {
      sections.push({ id: g, title: GROUP_TITLES[g], level: 1, blocks, omitWhenEmpty: true })
    }
    // Sections plugin juste après l'évaluation clinique.
    if (g === 'evaluation') {
      const ordered = [...pluginGroups.values()].sort((a, b) => a.order - b.order)
      for (const pg of ordered) {
        if (pg.blocks.length) {
          sections.push({ id: `plugin:${pg.key}`, title: pg.title, level: 1, blocks: pg.blocks, omitWhenEmpty: true })
        }
      }
    }
  }

  const patientName = `${context.patient.firstName} ${context.patient.lastName}`.trim() || '—'
  const pluginName = schemaDef?.name ?? (canonical.formProfile.pluginId ?? undefined)

  return {
    id: `session:${canonical.sessionId}`,
    title: `Séance — ${patientName}`,
    subtitle: context.session.date,
    metadata: {
      patientName,
      sessionDate: context.session.date,
      practitioner: context.session.practitioner
        ?? (canonical.core['core.practitioner']?.value as string | undefined),
      generatedAt: context.generatedAt,
      appVersion: context.appVersion,
      pluginName,
      coreVersion: canonical.formProfile.coreVersion,
    },
    sections,
    issues: [],
  }
}
