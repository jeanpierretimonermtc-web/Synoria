/**
 * Orchestrateur du pipeline d'export canonique (Phase 2).
 *
 *   Séance SQLite → normalizeSession → CanonicalSessionData
 *                 → ExportDocument / JSON / Excel → fichier disque
 *
 * Point d'entrée unique pour les handlers IPC des exports canoniques. Centralise
 * le chargement (repos), la construction du contexte et l'écriture disque, afin
 * que les handlers restent minimaux.
 *
 * N'accède jamais à SQLite depuis le renderer ; s'exécute côté main uniquement.
 */

import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { getSessionById, getAllSessions } from '../../database/repositories/sessionRepository'
import { getPatientById } from '../../database/repositories/patientRepository'
import { getSettings } from '../settingsService'
import { normalizeSession } from '../sessionDataNormalizer'
import { buildSessionExportDocument } from './exportDocumentBuilder'
import { exportDocumentToHtml } from './exportDocumentToHtml'
import { buildFullBackupJson, buildInteropJson } from './sessionJsonExporter'
import { buildSessionExcelBuffer, buildSessionsExcelBuffer, type ExcelSessionEntry } from './sessionExcelExporter'
import { validateBeforeExport } from './exportValidator'
import type { CanonicalSessionData } from '../../../shared/sessionDataTypes'
import type { ExportContext } from '../../../shared/exportTypes'
import type { Session, Patient } from '../../../shared/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function patientSlug(patient: Patient | null): string {
  if (!patient) return 'session'
  const last = patient.last_name.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const first = (patient.first_name.charAt(0).toUpperCase() + patient.first_name.slice(1))
    .replace(/[^a-zA-Z0-9]/g, '_')
  return `${last}_${first}`
}

/** Dossier de sortie : sous-dossier patient configuré, sinon userData/exports. */
function resolveOutputDir(patient: Patient | null, override?: string): string {
  if (override) { mkdirSync(override, { recursive: true }); return override }
  let dir: string
  if (patient) {
    const settings = getSettings()
    dir = join(settings.backupPatientPath || join(app.getPath('userData'), 'exports'), patientSlug(patient))
  } else {
    dir = join(app.getPath('userData'), 'exports')
  }
  mkdirSync(dir, { recursive: true })
  return dir
}

export function buildExportContext(
  session: Session,
  patient: Patient | null,
  includeUnknownData: boolean,
): ExportContext {
  return {
    patient: {
      id: patient?.id ?? session.patient_id,
      firstName: patient?.first_name ?? '',
      lastName: patient?.last_name ?? '',
      birthDate: patient?.birth_date,
      alerts: patient?.alerts,
      phone: patient?.phone,
      email: patient?.email,
      profession: patient?.profession,
    },
    session: { id: session.id, date: session.date, practitioner: session.practitioner },
    appVersion: app.getVersion(),
    generatedAt: new Date().toISOString(),
    includeUnknownData,
    language: 'fr',
  }
}

export interface LoadedSession {
  session: Session
  patient: Patient | null
  canonical: CanonicalSessionData
}

export function loadCanonicalSession(sessionId: string): LoadedSession {
  const session = getSessionById(sessionId)
  if (!session) throw new Error('Session introuvable')
  const patient = session.patient_id ? getPatientById(session.patient_id) : null
  const canonical = normalizeSession(session)
  return { session, patient, canonical }
}

// ── Exports fichiers ────────────────────────────────────────────────────────

/** JSON interopérable (lisible, stable) — destiné à l'échange. */
export function exportSessionInteropJson(sessionId: string, outputDir?: string): string {
  const { session, patient, canonical } = loadCanonicalSession(sessionId)
  const ctx = buildExportContext(session, patient, /* includeUnknownData */ false)
  const json = buildInteropJson(canonical, ctx)
  const dir = resolveOutputDir(patient, outputDir)
  const filePath = join(dir, `${patientSlug(patient)}_${session.date || 'sans-date'}_interop.json`)
  writeFileSync(filePath, json, 'utf-8')
  return filePath
}

/** JSON de sauvegarde complète — fidélité maximale, aucune perte. */
export function exportSessionFullBackupJson(sessionId: string, outputDir?: string): string {
  const { session, patient, canonical } = loadCanonicalSession(sessionId)
  const json = buildFullBackupJson(session, canonical, patient, app.getVersion())
  const dir = resolveOutputDir(patient, outputDir)
  const filePath = join(dir, `${patientSlug(patient)}_${session.date || 'sans-date'}_backup.json`)
  writeFileSync(filePath, json, 'utf-8')
  return filePath
}

/** Rapport HTML imprimable (via ExportDocument). */
export function exportSessionHtml(sessionId: string, outputDir?: string): string {
  const { session, patient, canonical } = loadCanonicalSession(sessionId)
  const ctx = buildExportContext(session, patient, /* includeUnknownData */ false)
  const doc = buildSessionExportDocument(canonical, ctx)
  const validation = validateBeforeExport(canonical)
  doc.issues = validation.issues
  const html = exportDocumentToHtml(doc)
  const dir = resolveOutputDir(patient, outputDir)
  const filePath = join(dir, `Seance_${patientSlug(patient)}_${session.date || 'sans-date'}.html`)
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}

/** Export Excel canonique (7 feuilles). */
export function exportSessionExcelCanonical(sessionId: string, outputDir?: string): string {
  const { session, patient, canonical } = loadCanonicalSession(sessionId)
  const ctx = buildExportContext(session, patient, /* includeUnknownData */ true)
  const buf = buildSessionExcelBuffer(canonical, ctx, patient, session)
  const dir = resolveOutputDir(patient, outputDir)
  const filePath = join(dir, `${patientSlug(patient)}_${session.date || 'sans-date'}_canonique.xlsx`)
  writeFileSync(filePath, buf)
  return filePath
}

/** Export Excel canonique de TOUTES les séances d'un patient. */
export function exportPatientExcelCanonical(patientId: string, outputDir?: string): string {
  const patient = getPatientById(patientId)
  if (!patient) throw new Error('Patient introuvable')
  const sessions = getAllSessions(patientId)
  const entries: ExcelSessionEntry[] = sessions.map(session => {
    const canonical = normalizeSession(session)
    return { canonical, context: buildExportContext(session, patient, true), rawSession: session }
  })
  const buf = buildSessionsExcelBuffer(entries, patient)
  const dir = resolveOutputDir(patient, outputDir)
  const filePath = join(dir, `${patientSlug(patient)}_dossier_canonique.xlsx`)
  writeFileSync(filePath, buf)
  return filePath
}
