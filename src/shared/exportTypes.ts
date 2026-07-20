/**
 * Types transverses du pipeline d'export canonique (Phase 2).
 *
 * Ces types décrivent le CONTEXTE et les RÉSULTATS d'un export, indépendamment
 * du format cible (JSON, Excel, HTML/PDF, résumé). Ils sont partagés entre le
 * main (services d'export) et, si besoin, le renderer.
 *
 * Aucune dépendance Node.js.
 */

/** Problème rencontré pendant la préparation ou la production d'un export. */
export interface ExportIssue {
  severity: 'warning' | 'error'
  code: string
  message: string
  /** Chemin logique dans le document/structure (ex : "sections[2].fields[0]"). */
  path?: string
  fieldId?: string
  dataKey?: string
  moduleId?: string
}

/** Résultat générique d'une opération d'export. */
export interface ExportResult<T = unknown> {
  success: boolean
  output?: T
  issues: ExportIssue[]
}

/**
 * Contexte d'un export de séance : identité patient/séance + métadonnées d'app.
 *
 * `includeUnknownData` distingue deux intentions :
 *   - true  → sauvegarde technique : on conserve TOUT, y compris les champs
 *             non reconnus (aucune perte, fidélité maximale).
 *   - false → rapport lisible destiné à un humain : on peut masquer les données
 *             brutes non interprétables pour ne pas polluer la lecture.
 */
export interface ExportContext {
  patient: {
    id: string
    firstName: string
    lastName: string
    birthDate?: string
    [key: string]: unknown
  }
  session: {
    id: string
    date: string
    practitioner?: string
    [key: string]: unknown
  }
  appVersion: string
  generatedAt: string
  includeUnknownData: boolean
  language?: 'fr'
}
