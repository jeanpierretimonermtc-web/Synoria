import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { runMigrations } from './migrations'

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
