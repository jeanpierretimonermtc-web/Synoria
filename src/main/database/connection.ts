import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { runMigrations } from './migrations'

const LATEST_DB_VERSION = 14

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'database')
  mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'mtc.sqlite')
  console.log('[DB] Opening SQLite at:', dbPath)

  db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined })
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Sauvegarde automatique avant migration si la base a déjà des données
  try {
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)')
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
    const currentVersion = row?.v ?? 0
    if (currentVersion > 0 && currentVersion < LATEST_DB_VERSION) {
      const today = new Date().toISOString().slice(0, 10)
      const backupPath = join(dbDir, `mtc_backup_avant_migration_v${currentVersion + 1}_${today}.sqlite`)
      if (!existsSync(backupPath)) {
        const safePath = backupPath.replace(/\\/g, '/')
        db.exec(`VACUUM INTO '${safePath}'`)
        console.log('[DB] Sauvegarde pré-migration créée :', backupPath)
      }
    }
  } catch (e) {
    console.warn('[DB] Sauvegarde pré-migration impossible (non-bloquant) :', e)
  }

  runMigrations(db)
  console.log('[DB] Ready')
}

export function closeDatabase(): void {
  if (db) {
    try { db.pragma('wal_checkpoint(TRUNCATE)') } catch {}
    db.close()
    db = null
  }
}

export function isDatabaseOpen(): boolean {
  return db !== null
}
