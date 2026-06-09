import { v4 as uuidv4 } from 'uuid'
import { getDb }         from '../connection'
import type { AccessLog } from '../../../shared/types'

export function logAccess(patientId: string | undefined, action: string, detail?: string): void {
  getDb().prepare(`
    INSERT INTO access_log (id, patient_id, action, detail, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), patientId ?? null, action, detail ?? null, new Date().toISOString())
}

export function getAccessLog(patientId?: string, limit = 200): AccessLog[] {
  if (patientId) {
    return getDb()
      .prepare('SELECT * FROM access_log WHERE patient_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(patientId, limit) as AccessLog[]
  }
  return getDb()
    .prepare('SELECT * FROM access_log ORDER BY timestamp DESC LIMIT ?')
    .all(limit) as AccessLog[]
}

export function countLogsForPatient(patientId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as n FROM access_log WHERE patient_id = ?')
    .get(patientId) as { n: number }
  return row.n
}
