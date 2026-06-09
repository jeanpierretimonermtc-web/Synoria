/**
 * Service de sauvegarde — backup général chiffré + backup par patient
 *
 * Backup général  → {backupGeneralPath}/backup-global-YYYY-MM-DD-HHhMM.json.enc
 * Backup patient  → {backupPatientPath}/LASTNAME_Firstname/LASTNAME_Firstname_YYYY-MM-DD.json.enc
 */

import { join } from 'path'
import {
  writeFileSync, readFileSync, mkdirSync,
  readdirSync, statSync, unlinkSync, existsSync,
} from 'fs'
import * as patientRepo from '../database/repositories/patientRepository'
import * as sessionRepo from '../database/repositories/sessionRepository'
import { upsertPatient }  from '../database/repositories/patientRepository'
import { upsertSession }  from '../database/repositories/sessionRepository'
import { getDb }          from '../database/connection'
import { encryptToFile, decryptFromFile } from './encryptionService'
import { getSettings, saveSettings }      from './settingsService'
import type { Patient } from '../../shared/types'

// ── Helpers internes ───────────────────────────────────────────────

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

/** DUPONT_Jean → slug stable pour nommage des fichiers/dossiers */
function patientSlug(p: Patient): string {
  const last  = p.last_name.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const first = (p.first_name.charAt(0).toUpperCase() + p.first_name.slice(1))
                  .replace(/[^a-zA-Z0-9]/g, '_')
  return `${last}_${first}`
}

/** Horodatage fichier : 2026-05-28-10h30 */
function fileTimestamp(): string {
  const n = new Date()
  return `${n.toISOString().slice(0, 10)}-${String(n.getHours()).padStart(2,'0')}h${String(n.getMinutes()).padStart(2,'0')}`
}

/** Calcul récursif de la taille d'un dossier */
function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0
  let total = 0
  try {
    for (const item of readdirSync(dir)) {
      const p = join(dir, item)
      const s = statSync(p)
      total += s.isDirectory() ? dirSize(p) : s.size
    }
  } catch { /* ignore */ }
  return total
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)    return `${bytes} o`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1048576).toFixed(1)} Mo`
}

/**
 * Supprime les fichiers directs (non-dossiers) dans `dir`
 * plus vieux que `retentionDays` jours.
 */
function rotateFiles(dir: string, retentionDays: number): void {
  if (!existsSync(dir)) return
  const cutoff = Date.now() - retentionDays * 86_400_000
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      try {
        const s = statSync(p)
        if (s.isFile() && s.mtimeMs < cutoff) unlinkSync(p)
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

// ── BACKUP GÉNÉRAL CHIFFRÉ ─────────────────────────────────────────

/**
 * Exporte la base complète en JSON chiffré AES-256-GCM
 * vers {backupGeneralPath}/backup-global-YYYY-MM-DD-HHhMM.json.enc
 * Retourne le chemin du fichier créé.
 */
export function exportBackupEncrypted(): string {
  const settings = getSettings()
  const dir = settings.backupGeneralPath
  ensureDir(dir)
  rotateFiles(dir, settings.backupRetentionDays)

  const payload = {
    version: 2,
    encrypted: true,
    exportedAt: new Date().toISOString(),
    patients: patientRepo.getAllPatients(),
    sessions: sessionRepo.getAllSessions(),
  }

  const filePath = join(dir, `backup-global-${fileTimestamp()}.json.enc`)
  encryptToFile(JSON.stringify(payload, null, 2), filePath)

  const now = new Date().toISOString()
  saveSettings({ lastGeneralBackup: now, lastAutoBackup: now })
  return filePath
}

/** Alias pour rétrocompatibilité avec le handler existant */
export const exportBackupJson = exportBackupEncrypted

// ── BACKUP PATIENT INDIVIDUEL ──────────────────────────────────────

/**
 * Sauvegarde chiffrée de toutes les séances d'un patient.
 * Crée le sous-dossier {backupPatientPath}/LASTNAME_Firstname/ si absent.
 * Retourne le chemin du dossier patient.
 */
export function exportPatientBackup(patientId: string): string {
  const settings = getSettings()
  const patient  = patientRepo.getPatientById(patientId)
  if (!patient) throw new Error('Patient introuvable')

  const slug       = patientSlug(patient)
  const patientDir = join(settings.backupPatientPath, slug)
  ensureDir(patientDir)
  rotateFiles(patientDir, settings.backupRetentionDays)

  const sessions = sessionRepo.getAllSessions(patientId)
  const payload  = {
    version: 2,
    encrypted: true,
    exportedAt: new Date().toISOString(),
    patient,
    sessions,
  }

  const date     = new Date().toISOString().slice(0, 10)
  const fileName = `${slug}_${date}.json.enc`
  encryptToFile(JSON.stringify(payload, null, 2), join(patientDir, fileName))

  return patientDir
}

// ── IMPORT (JSON brut ou chiffré) ─────────────────────────────────

export interface ImportResult {
  patientsUpserted: number
  sessionsUpserted: number
  errors: string[]
}

export function importBackupJson(filePath: string): ImportResult {
  // Déchiffrement si nécessaire
  const raw = filePath.endsWith('.enc')
    ? decryptFromFile(filePath)
    : readFileSync(filePath, 'utf-8')

  const data = JSON.parse(raw)

  // Compatibilité v1 (array à la racine) + v2 (clé patients/sessions)
  const patients = Array.isArray(data.patients)
    ? data.patients
    : data.patient ? [data.patient] : []
  const sessions = Array.isArray(data.sessions) ? data.sessions : []

  if (!Array.isArray(patients) || !Array.isArray(sessions)) {
    throw new Error('Format de sauvegarde invalide')
  }

  const errors: string[] = []
  let patientsUpserted = 0
  let sessionsUpserted = 0

  const importAll = getDb().transaction(() => {
    for (const p of patients) {
      if (!p.id || !p.first_name || !p.last_name) {
        errors.push(`Patient ignoré (données incomplètes) : ${JSON.stringify(p).slice(0, 80)}`)
        continue
      }
      p.created_at = p.created_at || new Date().toISOString()
      p.updated_at = p.updated_at || new Date().toISOString()
      upsertPatient(p)
      patientsUpserted++
    }
    for (const s of sessions) {
      if (!s.id || !s.patient_id || !s.date) {
        errors.push(`Séance ignorée (données incomplètes) : ${JSON.stringify(s).slice(0, 80)}`)
        continue
      }
      s.created_at = s.created_at || new Date().toISOString()
      s.updated_at = s.updated_at || new Date().toISOString()
      upsertSession(s)
      sessionsUpserted++
    }
  })

  importAll()
  return { patientsUpserted, sessionsUpserted, errors }
}

// ── INFORMATIONS BACKUP ────────────────────────────────────────────

export interface BackupFolderInfo {
  path: string
  accessible: boolean
  lastBackup: string | null
  fileCount: number
  sizeFormatted: string
}

export interface BackupInfo {
  general: BackupFolderInfo
  patient: BackupFolderInfo & { patientFolderCount: number }
}

export function getBackupInfo(): BackupInfo {
  const settings = getSettings()

  function infoForDir(dir: string): { accessible: boolean; fileCount: number; sizeFormatted: string } {
    if (!existsSync(dir)) return { accessible: false, fileCount: 0, sizeFormatted: '0 o' }
    try {
      const items = readdirSync(dir)
      return { accessible: true, fileCount: items.length, sizeFormatted: fmtSize(dirSize(dir)) }
    } catch {
      return { accessible: false, fileCount: 0, sizeFormatted: '0 o' }
    }
  }

  const genInfo = infoForDir(settings.backupGeneralPath)
  const patInfo = infoForDir(settings.backupPatientPath)

  // Compter les sous-dossiers patients
  let patientFolderCount = 0
  if (patInfo.accessible) {
    try {
      patientFolderCount = readdirSync(settings.backupPatientPath)
        .filter(f => statSync(join(settings.backupPatientPath, f)).isDirectory()).length
    } catch { /* ignore */ }
  }

  return {
    general: { path: settings.backupGeneralPath, lastBackup: settings.lastGeneralBackup, ...genInfo },
    patient: { path: settings.backupPatientPath, lastBackup: null, patientFolderCount, ...patInfo },
  }
}
