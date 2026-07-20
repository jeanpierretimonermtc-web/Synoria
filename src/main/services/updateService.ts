import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkRelease } from './supabaseAuthService'
import type { ReleaseCheckResult } from '../../shared/types'

const NOTIF_FILE = 'update.notif.json'

interface DismissRecord {
  version:     string
  dismissedAt: string
}

function getUserDataPath(): string {
  return app.getPath('userData')
}

function notifPath(): string { return join(getUserDataPath(), NOTIF_FILE) }

function loadDismissed(): DismissRecord | null {
  try { return JSON.parse(readFileSync(notifPath(), 'utf8')) as DismissRecord }
  catch { return null }
}

function saveDismissed(version: string): void {
  try { writeFileSync(notifPath(), JSON.stringify({ version, dismissedAt: new Date().toISOString() }), 'utf8') }
  catch { /* best-effort */ }
}

export function dismissUpdateNotification(version: string): void {
  saveDismissed(version)
}

export function getLastUpdateNotification(): DismissRecord | null {
  return loadDismissed()
}

export async function checkForUpdates(): Promise<ReleaseCheckResult | null> {
  const currentVersion = app.getVersion()
  let result: ReleaseCheckResult | null = null

  try { result = await checkRelease(currentVersion) } catch { return null }

  if (!result?.update_available) return result

  // Ne pas re-notifier si l'utilisateur a déjà ignoré cette version
  const dismissed = loadDismissed()
  if (dismissed?.version === result.latest_version) return result

  // Envoyer la notification au renderer (fenêtre principale)
  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents?.send('update:available', result)

  return result
}

export function startUpdateCheckScheduler(): void {
  // Premier contrôle 15 s après le démarrage pour laisser le réseau s'initialiser
  setTimeout(() => { checkForUpdates().catch(() => {}) }, 15_000)

  // Vérification toutes les 12h
  setInterval(() => { checkForUpdates().catch(() => {}) }, 12 * 60 * 60 * 1000)
}
