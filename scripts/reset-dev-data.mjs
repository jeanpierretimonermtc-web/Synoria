/**
 * Supprime les données de session du dossier "Synoria Dev" (userData en mode dev).
 * Utilisé par `npm run dev:fresh` pour démarrer comme un tout nouvel utilisateur.
 *
 * Fichiers supprimés :
 *   auth.json            — verrou mot de passe applicatif
 *   database/            — base SQLite (chiffrée + travail)
 *   license.token.enc    — jeton de licence offline
 *   supabase.session.enc — session Supabase (compte utilisateur)
 *   google_calendar.json — compte OAuth Google Calendar connecté
 *
 * Fichiers conservés :
 *   settings.json        — chemins de sauvegarde, préférences
 *   active.plugin.json   — plugin actif
 *   window-state.json    — taille/position de la fenêtre
 *
 * Crée dev.skip-seed pour que index.ts ne peuple pas la base avec des données de test.
 */

import { rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:os'

// Même logique que src/main/index.ts : APPDATA en dev sur Windows, ~/Library/... sur Mac
const appData = process.env.APPDATA
  || (platform() === 'darwin' ? join(process.env.HOME || '', 'Library', 'Application Support') : '')

if (!appData) {
  console.error('[reset-dev] Impossible de localiser APPDATA. Aucune suppression.')
  process.exit(0)
}

const userData = join(appData, 'Synoria Dev')

if (!existsSync(userData)) {
  console.log(`[reset-dev] Dossier introuvable : ${userData}`)
  console.log('[reset-dev] Déjà propre — démarrage en tant que nouvel utilisateur.')
  process.exit(0)
}

const targets = [
  'auth.json',
  'database',
  'license.token.enc',
  'supabase.session.enc',
  'google_calendar.json',
]

console.log(`[reset-dev] Nettoyage de ${userData}`)

// S'assurer que le dossier existe (peut avoir été entièrement supprimé)
mkdirSync(userData, { recursive: true })

let deleted = 0
for (const name of targets) {
  const fullPath = join(userData, name)
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true })
    console.log(`[reset-dev]   ✓ ${name}`)
    deleted++
  }
}

// Sentinelle : demande à index.ts de ne pas peupler la base avec les données de test
writeFileSync(join(userData, 'dev.skip-seed'), '', 'utf8')
console.log(`[reset-dev]   ✓ dev.skip-seed (désactive le seeder de données de test)`)

if (deleted === 0) {
  console.log('[reset-dev] Déjà propre — aucune donnée à supprimer.')
} else {
  console.log(`[reset-dev] ${deleted} élément(s) supprimé(s). Démarrage en tant que nouvel utilisateur.`)
}
