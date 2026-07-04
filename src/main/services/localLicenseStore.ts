/**
 * Persistance locale auxiliaire pour la gestion de licence.
 *
 * Ce module stocke dans userData/ trois fichiers indépendants du jeton JWT :
 *   - license.lastcheck.json  → horodatage + statut du dernier contrôle en ligne réussi
 *   - license.clock.json      → empreinte d'horloge pour détecter les reculs manuels
 *
 * Le jeton JWT lui-même est géré par licenseService.ts (saveToken / loadToken / clearToken).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join }                        from 'node:path'
import { app }                         from 'electron'

// ── Chemin userData (portable ou standard) ─────────────────────────────────

function getUserDataPath(): string {
  return process.env.PORTABLE_EXECUTABLE_DIR
    ? join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
    : app.getPath('userData')
}

// ── Dernier contrôle en ligne réussi ──────────────────────────────────────
//
// Utilisé pour la fenêtre de grâce hors-ligne : si le contrôle en ligne
// n'a pas pu se faire, l'app reste fonctionnelle 72h à partir du dernier
// contrôle réussi avant de passer en mode restreint.

export interface LastCheckRecord {
  checkedAt: string   // ISO 8601
  status:    string   // LicenseStatus au moment du contrôle
}

const LAST_CHECK_FILE = 'license.lastcheck.json'

export function saveLastSuccessfulCheck(status: string): void {
  try {
    const record: LastCheckRecord = { checkedAt: new Date().toISOString(), status }
    writeFileSync(join(getUserDataPath(), LAST_CHECK_FILE), JSON.stringify(record), 'utf8')
  } catch { /* best-effort */ }
}

export function loadLastSuccessfulCheck(): LastCheckRecord | null {
  try {
    return JSON.parse(readFileSync(join(getUserDataPath(), LAST_CHECK_FILE), 'utf8')) as LastCheckRecord
  } catch { return null }
}

/**
 * Retourne true si le dernier contrôle date de plus de `maxHours` heures.
 * Utilisé pour décider si la licence doit être re-vérifiée en ligne.
 */
export function isCheckOverdue(maxHours = 24): boolean {
  const last = loadLastSuccessfulCheck()
  if (!last) return true
  const lastMs  = new Date(last.checkedAt).getTime()
  const maxMs   = maxHours * 60 * 60 * 1000
  return Date.now() - lastMs > maxMs
}

// ── Détection de recul d'horloge ──────────────────────────────────────────
//
// À chaque démarrage on écrit l'heure courante dans un fichier.
// Au démarrage suivant, si l'heure courante est ANTÉRIEURE à l'heure
// sauvegardée (avec tolérance de 5 min), c'est un recul intentionnel.
// Cela permet d'empêcher la prolongation manuelle d'un jeton expiré.

export interface ClockCheckRecord {
  savedAt:   string   // ISO 8601
  wallClock: number   // Date.now() en ms
}

const CLOCK_CHECK_FILE  = 'license.clock.json'
const ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000  // 5 min

export function saveClockCheckData(): void {
  try {
    const record: ClockCheckRecord = {
      savedAt:   new Date().toISOString(),
      wallClock: Date.now(),
    }
    writeFileSync(join(getUserDataPath(), CLOCK_CHECK_FILE), JSON.stringify(record), 'utf8')
  } catch { /* best-effort */ }
}

/**
 * Retourne true si l'horloge système semble avoir reculé volontairement
 * depuis la dernière sauvegarde.
 */
export function detectClockRollback(): boolean {
  try {
    const raw    = readFileSync(join(getUserDataPath(), CLOCK_CHECK_FILE), 'utf8')
    const record = JSON.parse(raw) as ClockCheckRecord
    return Date.now() < record.wallClock - ROLLBACK_TOLERANCE_MS
  } catch {
    return false  // Premier démarrage — pas de référence → OK
  }
}
