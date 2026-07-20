import { getSettings } from './settingsService'

// Injecté depuis .env.local → OWNER_EMAILS au build (via vite.config.ts define).
// Jamais hardcodé dans le source pour éviter l'exposition dans le bundle ASAR.
const raw = (process.env.OWNER_EMAILS ?? '').trim()
const OWNER_EMAILS: string[] = raw
  ? raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  : []

export function isOwner(email: string | undefined | null): boolean {
  if (!email) return false
  return OWNER_EMAILS.includes(email.trim().toLowerCase())
}

/** Vérifie si le praticien configuré dans les paramètres est le propriétaire. */
export function checkOwnerFromSettings(): boolean {
  try {
    const settings = getSettings()
    return isOwner(settings.rgpdPractitionerEmail)
  } catch {
    return false
  }
}
