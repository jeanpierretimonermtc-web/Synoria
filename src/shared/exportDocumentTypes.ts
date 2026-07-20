/**
 * Représentation documentaire intermédiaire d'une séance (Phase 2).
 *
 * Un `ExportDocument` est une structure abstraite, indépendante du format de
 * sortie : HTML, PDF, ou tout futur rendu la consomment sans jamais réinterpréter
 * les données brutes de la séance. C'est la couche pivot du pipeline :
 *
 *   CanonicalSessionData → ExportDocument → (HTML | PDF | …)
 *
 * Aucune dépendance Node.js — utilisable dans le main ET le renderer.
 */

import type { ExportIssue } from './exportTypes'

// Ré-export pratique : les builders consomment souvent les deux depuis ce module.
export type { ExportIssue, ExportContext, ExportResult } from './exportTypes'

export interface ExportDocumentMetadata {
  patientName: string
  sessionDate: string
  practitioner?: string
  generatedAt: string
  appVersion: string
  pluginName?: string
  coreVersion: string
}

// ── Blocs de contenu (union discriminée par `type`) ─────────────────────────

/** Paragraphe / texte long, éventuellement précédé d'un libellé. */
export interface ExportTextBlock {
  type: 'text'
  label?: string
  content: string
  /** true si `content` est du HTML déjà assaini (sinon texte brut à échapper). */
  isHtml?: boolean
}

/** Couple libellé → valeur (une ligne de fiche). */
export interface ExportKeyValueBlock {
  type: 'keyvalue'
  label: string
  value: string
  isEmpty?: boolean
}

/** Liste à puces. */
export interface ExportListBlock {
  type: 'list'
  label?: string
  items: string[]
}

/** Tableau (repeatable, positions de pouls, tests…). */
export interface ExportTableBlock {
  type: 'table'
  label?: string
  columns: string[]
  rows: string[][]
}

/** Schéma corporel : zones annotées par vue. */
export interface ExportBodyChartBlock {
  type: 'bodychart'
  label: string
  zones: string[]
  notes?: string
}

/** Encart d'information/avertissement. */
export interface ExportNoticeBlock {
  type: 'notice'
  severity: 'info' | 'warning'
  text: string
}

/** Saut de page (impression PDF). */
export interface ExportPageBreakBlock {
  type: 'pagebreak'
}

/** Donnée brute non interprétée — jamais perdue, rendue en JSON lisible. */
export interface ExportRawDataBlock {
  type: 'raw'
  label: string
  jsonValue: unknown
}

export type ExportBlock =
  | ExportTextBlock
  | ExportKeyValueBlock
  | ExportListBlock
  | ExportTableBlock
  | ExportBodyChartBlock
  | ExportNoticeBlock
  | ExportPageBreakBlock
  | ExportRawDataBlock

export interface ExportSection {
  id: string
  title: string
  level?: number
  blocks: ExportBlock[]
  omitWhenEmpty?: boolean
}

export interface ExportDocument {
  id: string
  title: string
  subtitle?: string
  metadata: ExportDocumentMetadata
  sections: ExportSection[]
  issues: ExportIssue[]
}
