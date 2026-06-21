import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, writeFileSync }   from 'fs'
import { join }                                      from 'path'
import { app }                                       from 'electron'
import * as os                                       from 'os'
import { getDb, isDatabaseOpen }                     from '../database/connection'
import { getRecentLogs, logInfo }                    from './logService'
import { exportBackupEncrypted }                     from './backupService'

// ── Credentials admin ─────────────────────────────────────────────────────────
// Le mot de passe est généré aléatoirement au premier lancement et stocké sous
// forme de hash PBKDF2 dans userData/admin.json. Le texte en clair est écrit
// une seule fois dans synoria.log pour permettre la récupération par le support.

const ITERATIONS = 100_000
const KEYLEN     = 32
const DIGEST     = 'sha256'

interface AdminCredentials { salt: string; hash: string }

function adminFilePath(): string {
  return join(app.getPath('userData'), 'admin.json')
}

function getOrCreateAdminCredentials(): AdminCredentials {
  const filePath = adminFilePath()
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as AdminCredentials
    } catch { /* fichier corrompu → régénérer */ }
  }
  const password = randomBytes(16).toString('hex')   // 32 chars, entropie 128 bits
  const salt     = randomBytes(32).toString('hex')
  const hash     = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
  writeFileSync(filePath, JSON.stringify({ salt, hash }), 'utf-8')
  logInfo('ADMIN_SETUP', `Mot de passe admin généré : ${password}`)
  return { salt, hash }
}

export function adminVerify(password: string): boolean {
  try {
    const { salt, hash } = getOrCreateAdminCredentials()
    const derived = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST)
    return timingSafeEqual(derived, Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

// ── Logs ─────────────────────────────────────────────────────────────────────
export function adminGetLogs(n = 200): string[] {
  return getRecentLogs(n)
}

export function adminClearLogs(): void {
  const logPath = join(app.getPath('userData'), 'synoria.log')
  if (existsSync(logPath)) writeFileSync(logPath, '', 'utf-8')
  const oldPath = logPath + '.old'
  if (existsSync(oldPath)) writeFileSync(oldPath, '', 'utf-8')
}

// ── Informations système ──────────────────────────────────────────────────────
export interface AdminSystemInfo {
  version: string
  userData: string
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  dbOpen: boolean
  memoryUsedMB: number
  memoryTotalMB: number
  uptimeSeconds: number
  hostname: string
}

export function adminGetSystemInfo(): AdminSystemInfo {
  return {
    version:         app.getVersion(),
    userData:        app.getPath('userData'),
    platform:        process.platform,
    arch:            process.arch,
    nodeVersion:     process.versions.node,
    electronVersion: process.versions.electron,
    dbOpen:          isDatabaseOpen(),
    memoryUsedMB:    Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    memoryTotalMB:   Math.round(os.totalmem() / 1024 / 1024),
    uptimeSeconds:   Math.round(process.uptime()),
    hostname:        os.hostname(),
  }
}

// ── Base de données ───────────────────────────────────────────────────────────
export function adminDbIntegrity(): string {
  if (!isDatabaseOpen()) return 'Base de données non ouverte.'
  try {
    const db = getDb()
    const rows = db.pragma('integrity_check') as { integrity_check: string }[]
    return rows.map(r => r.integrity_check).join('\n')
  } catch (e: any) {
    return `Erreur : ${e?.message}`
  }
}

export function adminWalCheckpoint(): string {
  if (!isDatabaseOpen()) return 'Base de données non ouverte.'
  try {
    const db = getDb()
    const result = db.pragma('wal_checkpoint(FULL)') as any[]
    const r = result[0]
    return `WAL checkpoint FULL — busy: ${r.busy}, log: ${r.log}, checkpointed: ${r.checkpointed}`
  } catch (e: any) {
    return `Erreur : ${e?.message}`
  }
}

export function adminDbStats(): Record<string, number> {
  if (!isDatabaseOpen()) return {}
  try {
    const db = getDb()
    const tables = ['patients', 'sessions', 'appointments', 'invoices_log', 'access_log']
    const stats: Record<string, number> = {}
    for (const t of tables) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get() as { n: number }
        stats[t] = row.n
      } catch { stats[t] = -1 }
    }
    return stats
  } catch { return {} }
}

// ── Paramètres bruts ──────────────────────────────────────────────────────────
export function adminGetSettings(): string {
  const p = join(app.getPath('userData'), 'settings.json')
  if (!existsSync(p)) return '{}'
  try { return readFileSync(p, 'utf-8') }
  catch { return '{ "error": "lecture impossible" }' }
}

// ── Sauvegarde d'urgence ──────────────────────────────────────────────────────
export function adminForceBackup(): string {
  return exportBackupEncrypted()
}
