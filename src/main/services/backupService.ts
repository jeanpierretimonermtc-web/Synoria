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
import * as patientRepo     from '../database/repositories/patientRepository'
import * as sessionRepo     from '../database/repositories/sessionRepository'
import * as appointmentRepo from '../database/repositories/appointmentRepository'
import * as comptaRepo      from '../database/repositories/comptaRepository'
import { getAllBlocks }      from '../database/repositories/calendarBlockRepository'
import { upsertPatient }    from '../database/repositories/patientRepository'
import { upsertSession }    from '../database/repositories/sessionRepository'
import { getDb }            from '../database/connection'
import {
  encryptToFile, decryptFromFile,
  encryptToFileV3, decryptFromFileV3, isV3Format, getV3Salt,
} from './encryptionService'
import { getSessionKey, getAuthSalt, deriveKeyFromPassword } from './authService'
import { getSettings, saveSettings }      from './settingsService'
import {
  getActivePlugin, setActivePlugin,
  getPluginLibrary, setPluginLibrary,
} from './pluginService'
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

  const db = getDb()
  // Récupère les données compta sur toutes les années disponibles
  const allYears = (db.prepare("SELECT DISTINCT year FROM monthly_revenue").all() as {year:number}[]).map(r => r.year)
  const allUrsaf = (db.prepare("SELECT DISTINCT year FROM ursaf_rates").all() as {year:number}[]).map(r => r.year)
  const allVar   = (db.prepare("SELECT DISTINCT year FROM monthly_var_expenses").all() as {year:number}[]).map(r => r.year)
  const yearsCompta = [...new Set([...allYears, ...allUrsaf, ...allVar])]

  const payload = {
    version: 3,
    encrypted: true,
    exportedAt: new Date().toISOString(),
    // Données cliniques
    patients:         patientRepo.getAllPatients(),
    sessions:         sessionRepo.getAllSessions(),
    // Calendrier
    appointments:     appointmentRepo.getAllAppointments(),
    calendarBlocks:   getAllBlocks(),
    // Comptabilité (toutes les années)
    consultationTypes: comptaRepo.getConsultationTypes(),
    monthlyRevenue:   yearsCompta.flatMap(y => comptaRepo.getMonthlyRevenue(y)),
    ursafRates:       yearsCompta.flatMap(y => comptaRepo.getUrsafRates(y)),
    expenseConfig:    comptaRepo.getExpenseConfig(),
    monthlyVarExpenses: yearsCompta.flatMap(y => (db.prepare("SELECT * FROM monthly_var_expenses WHERE year=?").all(y) as any[])),
    invoicesLog:      (db.prepare("SELECT * FROM invoices_log ORDER BY invoice_date").all() as any[]),
    // Modèles
    sessionTemplates: (db.prepare("SELECT * FROM session_templates").all() as any[]),
    // Plugin actif et bibliothèque personnalisée
    activePlugin:  getActivePlugin(),
    pluginLibrary: getPluginLibrary(),
  }

  const filePath   = join(dir, `backup-global-${fileTimestamp()}.json.enc`)
  const sessionKey = getSessionKey()
  const authSalt   = getAuthSalt()
  if (sessionKey && authSalt) {
    // Format v3 : chiffré avec le mot de passe utilisateur → portable entre machines
    encryptToFileV3(JSON.stringify(payload, null, 2), filePath, sessionKey, authSalt)
  } else {
    // Fallback v2 : clé machine (session non disponible)
    encryptToFile(JSON.stringify(payload, null, 2), filePath)
  }

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
  const fileName   = `${slug}_${date}.json.enc`
  const filePath   = join(patientDir, fileName)
  const sessionKey = getSessionKey()
  const authSalt   = getAuthSalt()
  if (sessionKey && authSalt) {
    encryptToFileV3(JSON.stringify(payload, null, 2), filePath, sessionKey, authSalt)
  } else {
    encryptToFile(JSON.stringify(payload, null, 2), filePath)
  }

  return patientDir
}

// ── IMPORT (JSON brut ou chiffré) ─────────────────────────────────

export interface ImportResult {
  patientsUpserted: number
  sessionsUpserted: number
  sessionsSkipped:  number
  errors: string[]
}

export function importBackupJson(
  filePath: string,
  opts?: { customKeyPath?: string; password?: string }
): ImportResult {
  let raw: string
  if (!filePath.endsWith('.enc')) {
    raw = readFileSync(filePath, 'utf-8')
  } else if (isV3Format(filePath)) {
    // Format v3 : déchiffrement par mot de passe
    if (!opts?.password) throw new Error('V3_NEEDS_PASSWORD:Ce fichier est protégé par votre mot de passe Synoria.')
    const saltHex    = getV3Salt(filePath)
    const derivedKey = deriveKeyFromPassword(opts.password, saltHex)
    raw = decryptFromFileV3(filePath, derivedKey)
  } else {
    // Format v2 : clé machine uniquement (pas de déchiffrement par mot de passe possible)
    if (opts?.password && !opts?.customKeyPath) {
      throw new Error('OLD_FORMAT:Cette sauvegarde a été créée avec Synoria V1.4.3 ou antérieur. Elle ne peut pas être restaurée avec un mot de passe — utilisez le fichier "encryption.key" de la machine d\'origine.')
    }
    raw = decryptFromFile(filePath, opts?.customKeyPath)
  }

  const data = JSON.parse(raw)

  // Rétrocompatibilité : v1 (array racine) · v2 (patients+sessions) · v3 (tout)
  const patients = Array.isArray(data.patients)
    ? data.patients
    : data.patient ? [data.patient] : []
  const sessions = Array.isArray(data.sessions) ? data.sessions : []

  if (!Array.isArray(patients) || !Array.isArray(sessions)) {
    throw new Error('Format de sauvegarde invalide')
  }

  const db     = getDb()
  const now    = new Date().toISOString()
  const errors: string[] = []
  let patientsUpserted = 0
  let sessionsUpserted = 0
  let sessionsSkipped  = 0

  // Helper : INSERT OR REPLACE générique sur n'importe quelle table
  const upsertRow = (table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row)
    if (!keys.length) return
    const placeholders = keys.map(k => `@${k}`).join(', ')
    db.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(row)
  }

  const importAll = db.transaction(() => {
    // ── Patients ──────────────────────────────────────────────────
    for (const p of patients) {
      if (!p.id || !p.first_name || !p.last_name) {
        errors.push(`Patient ignoré : ${JSON.stringify(p).slice(0, 80)}`); continue
      }
      p.created_at = p.created_at || now
      p.updated_at = p.updated_at || now
      upsertPatient(p); patientsUpserted++
    }

    // ── Séances ───────────────────────────────────────────────────
    for (const s of sessions) {
      if (!s.id || !s.patient_id || !s.date) {
        errors.push(`Séance ignorée : ${JSON.stringify(s).slice(0, 80)}`); continue
      }
      // Détection de doublon : on n'écrase pas une séance déjà présente
      const alreadyExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(s.id)
      if (alreadyExists) { sessionsSkipped++; continue }
      s.created_at = s.created_at || now
      s.updated_at = s.updated_at || now
      upsertSession(s); sessionsUpserted++
    }

    // ── RDV Calendrier ────────────────────────────────────────────
    for (const a of (data.appointments ?? [])) {
      if (!a.id || !a.date || !a.heure_debut) continue
      a.created_at = a.created_at || now; a.updated_at = a.updated_at || now
      upsertRow('appointments', {
        id: a.id, patient_id: a.patient_id ?? null, date: a.date,
        heure_debut: a.heure_debut, heure_fin: a.heure_fin ?? null,
        note: a.note ?? null, is_done: a.is_done ?? 0, is_cancelled: a.is_cancelled ?? 0,
        guest_last_name: a.guest_last_name ?? null, guest_first_name: a.guest_first_name ?? null,
        guest_phone: a.guest_phone ?? null, google_event_id: a.google_event_id ?? null,
        created_at: a.created_at, updated_at: a.updated_at,
      })
    }

    // ── Blocs calendrier perso ────────────────────────────────────
    for (const b of (data.calendarBlocks ?? [])) {
      if (!b.id || !b.date) continue
      b.created_at = b.created_at || now; b.updated_at = b.updated_at || now
      upsertRow('calendar_blocks', {
        id: b.id, date: b.date, is_day: b.is_day ?? 0,
        heure_debut: b.heure_debut ?? null, heure_fin: b.heure_fin ?? null,
        motif: b.motif ?? null, created_at: b.created_at, updated_at: b.updated_at,
      })
    }

    // ── Types de consultation ─────────────────────────────────────
    for (const t of (data.consultationTypes ?? [])) {
      if (!t.id || !t.name) continue
      upsertRow('consultation_types', {
        id: t.id, name: t.name, price: t.price ?? 0,
        is_active: t.is_active ?? 1, sort_order: t.sort_order ?? 0,
      })
    }

    // ── Chiffre d'affaires mensuel ────────────────────────────────
    for (const r of (data.monthlyRevenue ?? [])) {
      if (!r.year || !r.month || !r.type_id) continue
      upsertRow('monthly_revenue', {
        year: r.year, month: r.month, type_id: r.type_id, nb_seances: r.nb_seances ?? 0,
      })
    }

    // ── Taux URSAF ────────────────────────────────────────────────
    for (const u of (data.ursafRates ?? [])) {
      if (!u.year || !u.month) continue
      upsertRow('ursaf_rates', { year: u.year, month: u.month, rate: u.rate ?? 0.256 })
    }

    // ── Configuration des charges ─────────────────────────────────
    for (const e of (data.expenseConfig ?? [])) {
      if (!e.id) continue
      upsertRow('expense_config', {
        id: e.id, category: e.category ?? '', label: e.label ?? '',
        monthly_amount: e.monthly_amount ?? 0, is_shared: e.is_shared ?? 0,
        sort_order: e.sort_order ?? 0, months: e.months ?? null,
      })
    }

    // ── Dépenses variables ────────────────────────────────────────
    for (const v of (data.monthlyVarExpenses ?? [])) {
      if (!v.year || !v.month || !v.category) continue
      upsertRow('monthly_var_expenses', {
        year: v.year, month: v.month, category: v.category,
        label: v.label ?? '', amount: v.amount ?? 0,
      })
    }

    // ── Journal des factures ──────────────────────────────────────
    for (const inv of (data.invoicesLog ?? [])) {
      if (!inv.id || !inv.invoice_number) continue
      upsertRow('invoices_log', {
        id: inv.id, invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date || now.slice(0, 10),
        patient_first_name: inv.patient_first_name ?? '',
        patient_last_name: inv.patient_last_name ?? '',
        patient_address: inv.patient_address ?? null,
        email: inv.email ?? null, phone: inv.phone ?? null,
        session_date: inv.session_date ?? null,
        description: inv.description ?? null,
        montant: inv.montant ?? 0, file_path: inv.file_path ?? null,
        created_at: inv.created_at || now,
      })
    }

    // ── Modèles de séance ─────────────────────────────────────────
    for (const t of (data.sessionTemplates ?? [])) {
      if (!t.id || !t.name) continue
      t.created_at = t.created_at || now; t.updated_at = t.updated_at || now
      upsertRow('session_templates', {
        id: t.id, name: t.name, description: t.description ?? '',
        data_json: t.data_json ?? '{}', created_at: t.created_at, updated_at: t.updated_at,
      })
    }
  })

  importAll()

  // ── Plugin actif ───────────────────────────────────────────────────
  // Restauré seulement si la sauvegarde en contient un (null = pas de plugin = on ne touche pas)
  if (data.activePlugin && typeof data.activePlugin === 'object' && data.activePlugin.id) {
    try { setActivePlugin(data.activePlugin) } catch { /* ignore */ }
  }

  // ── Bibliothèque de plugins ────────────────────────────────────────
  // Fusion : on ajoute les plugins du backup qui ne sont pas déjà présents (par id)
  if (Array.isArray(data.pluginLibrary) && data.pluginLibrary.length) {
    try {
      const current = getPluginLibrary()
      const existingIds = new Set(current.map(e => e.plugin.id))
      const incoming = data.pluginLibrary.filter(
        (e: any) => e?.plugin?.id && !existingIds.has(e.plugin.id)
      )
      if (incoming.length) setPluginLibrary([...current, ...incoming])
    } catch { /* ignore */ }
  }

  return { patientsUpserted, sessionsUpserted, sessionsSkipped, errors }
}

// ── VÉRIFICATION D'INTÉGRITÉ ──────────────────────────────────────

export interface BackupVerifyResult {
  patients:   number
  sessions:   number
  exportedAt: string
}

export function verifyBackup(filePath: string, opts?: { customKeyPath?: string; password?: string }): BackupVerifyResult {
  let raw: string
  if (!filePath.endsWith('.enc')) {
    raw = readFileSync(filePath, 'utf-8')
  } else if (isV3Format(filePath)) {
    if (!opts?.password) throw new Error('V3_NEEDS_PASSWORD:Ce fichier est protégé par votre mot de passe Synoria.')
    const derivedKey = deriveKeyFromPassword(opts.password, getV3Salt(filePath))
    raw = decryptFromFileV3(filePath, derivedKey)
  } else {
    raw = decryptFromFile(filePath, opts?.customKeyPath)
  }
  const data = JSON.parse(raw)
  const patients = Array.isArray(data.patients) ? data.patients.length
    : data.patient ? 1 : 0
  const sessions = Array.isArray(data.sessions) ? data.sessions.length : 0
  return { patients, sessions, exportedAt: data.exportedAt ?? '' }
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
