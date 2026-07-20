/**
 * Tests du builder de document d'export (Phase 2).
 *
 * Harness autonome (aucun test runner requis). Exécutable via `npx tsx`.
 * Vérifie : ordre des sections, rendu des types spéciaux (bodychart, repeatable),
 * conservation des données inconnues, et absence de perte.
 */

import { normalizeSession } from '../../main/services/sessionDataNormalizer'
import { buildSessionExportDocument } from '../../main/services/exports/exportDocumentBuilder'
import type { ExportContext } from '../../shared/exportTypes'
import type { ExportBlock, ExportSection } from '../../shared/exportDocumentTypes'

let passed = 0, failed = 0
const failures: string[] = []
function assert(cond: boolean, msg: string): void { if (cond) passed++; else { failed++; failures.push(msg) } }

function ctx(over: Partial<ExportContext> = {}): ExportContext {
  return {
    patient: { id: 'p1', firstName: 'Jean', lastName: 'Dupont', alerts: over.patient?.alerts as string | undefined },
    session: { id: 's1', date: '2026-05-01', practitioner: 'Dr X' },
    appVersion: '1.5.7', generatedAt: '2026-05-01T10:00:00Z',
    includeUnknownData: false, language: 'fr',
    ...over,
  }
}

function section(doc: { sections: ExportSection[] }, id: string): ExportSection | undefined {
  return doc.sections.find(s => s.id === id)
}
function allBlocks(doc: { sections: ExportSection[] }): ExportBlock[] {
  return doc.sections.flatMap(s => s.blocks)
}

// 1. Séance simple (mode générique)
function testSimple(): void {
  const fd = { simpleContextVie: '<p>Sédentaire</p>', simpleObjectifs: 'Réduire le stress' }
  const raw = {
    id: 's1', patient_id: 'p1', date: '2026-05-01', practitioner: 'Dr X',
    motif: '<p>Douleurs lombaires</p>', evolution_tags: 'amélioration',
    plan: 'Revoir dans 3 semaines', full_data_json: JSON.stringify(fd),
    created_at: '2026-05-01T10:00:00Z',
  }
  const doc = buildSessionExportDocument(normalizeSession(raw), ctx())
  assert(!!section(doc, 'motif'), 'simple: section motif présente')
  assert(!!section(doc, 'evolution'), 'simple: section évolution présente')
  assert(!!section(doc, 'evaluation'), 'simple: section évaluation présente')
  assert(!!section(doc, 'suivi'), 'simple: section suivi présente')
  // Ordre : motif avant évaluation avant suivi
  const ids = doc.sections.map(s => s.id)
  assert(ids.indexOf('motif') < ids.indexOf('evaluation'), 'simple: motif avant évaluation')
  assert(ids.indexOf('evaluation') < ids.indexOf('suivi'), 'simple: évaluation avant suivi')
}

// 2. Séance MTC intégrée (modules)
function testMtc(): void {
  const fd = {
    anamnese: 'Fatigue', barrageNiv1: 'N1',
    systemes: { rate: { checked: ['Ballonnements'], energie: 4 } },
    pluginId: 'mtc_jp', pluginIsBuiltin: true,
  }
  const raw = {
    id: 's1', patient_id: 'p1', date: '2026-05-01',
    motif: 'Bilan', diagnostic_mtc: 'Vide de Rate', points: '36E',
    systemes_json: JSON.stringify(fd.systemes),
    full_data_json: JSON.stringify(fd),
    created_at: '2026-05-01T10:00:00Z',
  }
  const doc = buildSessionExportDocument(normalizeSession(raw), ctx())
  assert(!!section(doc, 'analyse'), 'mtc: section analyse présente (diagnostic)')
  assert(!!section(doc, 'intervention'), 'mtc: section intervention présente (points/barrage)')
  const evalText = JSON.stringify(section(doc, 'evaluation')?.blocks ?? [])
  assert(evalText.includes('Ballonnements'), 'mtc: module systèmes rendu dans évaluation')
}

// 3. Plugin tiers avec bodychart + repeatable
function testPlugin(): void {
  const pluginSchema = {
    id: 'osteo', name: 'Ostéopathie', specialty: 'Ostéo', version: '1.0.0',
    sections: [{
      id: 'bilan', title: 'Bilan', fields: [
        { id: 'zones', type: 'bodychart', label: 'Zones' },
        { id: 'tests', type: 'repeatable', label: 'Tests' },
        { id: 'douleur', type: 'rating', label: 'Douleur', max: 10 },
      ],
    }],
  }
  const fd = {
    pluginId: 'osteo', pluginIsBuiltin: false, pluginSchema,
    pluginData: {
      zones: { front: ['Épaule'], back: ['Lombaire'], notes: 'Raideur' },
      tests: [{ nom: 'Lasègue', note: 'positif' }, { nom: 'SLR' }],
      douleur: 0,
    },
  }
  const raw = { id: 's1', patient_id: 'p1', date: '2026-05-01', motif: 'Dos', full_data_json: JSON.stringify(fd), created_at: '2026-05-01T10:00:00Z' }
  const doc = buildSessionExportDocument(normalizeSession(raw), ctx())
  const blocks = allBlocks(doc)
  assert(blocks.some(b => b.type === 'bodychart'), 'plugin: bloc bodychart généré')
  assert(blocks.some(b => b.type === 'table'), 'plugin: bloc table (repeatable) généré')
  const bc = blocks.find(b => b.type === 'bodychart') as { zones: string[]; notes?: string } | undefined
  assert(!!bc && bc.zones.some(z => z.includes('Épaule')), 'plugin: zone antérieure conservée')
  // rating à 0 ne doit PAS être omis
  assert(blocks.some(b => b.type === 'keyvalue' && (b as { value: string }).value.startsWith('0')), 'plugin: rating 0 conservé (jamais omis)')
  // Section plugin nommée d'après la section du schéma
  assert(doc.sections.some(s => s.title === 'Bilan'), 'plugin: section "Bilan" présente')
}

// 4. Données inconnues (hors schéma) conservées si includeUnknownData
function testUnknown(): void {
  const fd = {
    pluginId: 'custom', pluginIsBuiltin: false,
    pluginData: { champLibre: 'valeur importante' },   // pas de schéma → unknown
  }
  const raw = { id: 's1', patient_id: 'p1', date: '2026-05-01', motif: 'M', full_data_json: JSON.stringify(fd), created_at: '2026-05-01T10:00:00Z' }
  const c = normalizeSession(raw)

  const docHidden = buildSessionExportDocument(c, ctx({ includeUnknownData: false }))
  assert(!section(docHidden, 'complementaires'), 'unknown: masqué en mode rapport (includeUnknownData=false)')

  const docShown = buildSessionExportDocument(c, ctx({ includeUnknownData: true }))
  const comp = section(docShown, 'complementaires')
  assert(!!comp, 'unknown: section complémentaires présente en mode sauvegarde')
  assert(!!comp && JSON.stringify(comp.blocks).includes('valeur importante'), 'unknown: donnée hors schéma conservée')
}

// 5. Alertes patient
function testAlerts(): void {
  const raw = { id: 's1', patient_id: 'p1', date: '2026-05-01', motif: 'M', created_at: '2026-05-01T10:00:00Z' }
  const c = ctx()
  ;(c.patient as Record<string, unknown>).alerts = 'Allergie pénicilline'
  const doc = buildSessionExportDocument(normalizeSession(raw), c)
  const al = section(doc, 'alertes')
  assert(!!al && al.blocks.some(b => b.type === 'notice'), 'alertes: notice générée depuis le contexte patient')
}

export function runTests(): { passed: number; failed: number; failures: string[] } {
  passed = 0; failed = 0; failures.length = 0
  testSimple(); testMtc(); testPlugin(); testUnknown(); testAlerts()
  return { passed, failed, failures: [...failures] }
}

const isMain = typeof process !== 'undefined' && Array.isArray(process.argv) &&
  process.argv[1] && /exportDocumentBuilder\.test/.test(process.argv[1])
if (isMain) {
  const r = runTests()
  console.log(`\nexportDocumentBuilder: ${r.passed} passed, ${r.failed} failed`)
  r.failures.forEach(f => console.error('  x ' + f))
  if (r.failed > 0 && typeof process !== 'undefined') process.exitCode = 1
}
