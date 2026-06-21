import { existsSync, statSync, renameSync, appendFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const MAX_SIZE = 500 * 1024

function logPath(): string {
  return join(app.getPath('userData'), 'synoria.log')
}

export function logInfo(context: string, message: string): void {
  try {
    const path = logPath()
    if (existsSync(path) && statSync(path).size > MAX_SIZE) {
      try { renameSync(path, path + '.old') } catch {}
    }
    const ts = new Date().toISOString()
    appendFileSync(path, `[${ts}] [${context}] ${message}\n`, 'utf-8')
  } catch {}
}

export function logError(context: string, error: unknown): void {
  try {
    const path = logPath()
    if (existsSync(path) && statSync(path).size > MAX_SIZE) {
      try { renameSync(path, path + '.old') } catch {}
    }
    const ts = new Date().toISOString()
    const msg = error instanceof Error ? error.message : String(error)
    appendFileSync(path, `[${ts}] [${context}] ${msg}\n`, 'utf-8')
  } catch {}
}

export function getRecentLogs(n = 20): string[] {
  try {
    const path = logPath()
    if (!existsSync(path)) return []
    const content = readFileSync(path, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    return lines.slice(-n)
  } catch {
    return []
  }
}
