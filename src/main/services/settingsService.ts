/**
 * Paramètres de l'application — stockés dans userData/settings.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface AppSettings {
  // Chemins de sauvegarde
  backupPatientPath: string
  backupGeneralPath: string
  // Automatisation
  autoBackupOnClose: boolean
  autoBackupDaily:   boolean
  backupRetentionDays: number
  // Dernières sauvegardes (ISO string | null)
  lastGeneralBackup: string | null
  lastAutoBackup:    string | null
  // Facturation
  invoicePath:          string
  invoiceTvaRate:       number
  lastInvoiceNumber:    number
  lastInvoiceYear:      string
  // RGPD
  rgpdPractitionerName:  string
  rgpdPractitionerEmail: string
  rgpdNotice:            string
  dataRetentionYears:    number
  // Profil praticien (affiché sur les factures)
  practitionerFirstName:    string
  practitionerLastName:     string
  practitionerActivity:     string
  practitionerAddress:      string
  practitionerSiret:        string
  practitionerEmail:        string
  practitionerApe:          string
  practitionerPaymentTerms: string
  practitionerLogoPath:     string
}

const DEFAULT_NOTICE = `Dans le cadre de votre suivi thérapeutique, le cabinet collecte et traite des données personnelles vous concernant (identité, coordonnées, données de santé) sur le fondement de l'article 9(2)(h) du RGPD.

Ces données sont destinées exclusivement au praticien et ne sont transmises à aucun tiers.

Durée de conservation : jusqu'à 10 ans après votre dernière consultation.

Vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Pour exercer vos droits, contactez votre praticien.

En cas de réclamation, vous pouvez saisir la CNIL (www.cnil.fr).`

// Chemins par défaut basés sur le dossier Documents de l'utilisateur (multiplateforme)
// Évalués lazily après app.whenReady() pour que app.getPath() soit disponible
let _defaults: AppSettings | null = null
function getDefaults(): AppSettings {
  if (_defaults) return _defaults
  const docs = app.getPath('documents')
  const base = join(docs, 'Synoria')
  _defaults = {
    backupPatientPath:   join(base, 'Sauvegardes', 'Patients'),
    backupGeneralPath:   join(base, 'Sauvegardes', 'General'),
    autoBackupOnClose:   true,
    autoBackupDaily:     true,
    backupRetentionDays: 30,
    lastGeneralBackup:   null,
    lastAutoBackup:      null,
    invoicePath:         join(base, 'Factures'),
    invoiceTvaRate:      20,
    lastInvoiceNumber:   0,
    lastInvoiceYear:     '',
    rgpdPractitionerName:  '',
    rgpdPractitionerEmail: '',
    rgpdNotice:            DEFAULT_NOTICE,
    dataRetentionYears:    10,
    practitionerFirstName:    '',
    practitionerLastName:     '',
    practitionerActivity:     '',
    practitionerAddress:      '',
    practitionerSiret:        '',
    practitionerEmail:        '',
    practitionerApe:          '',
    practitionerPaymentTerms: '',
    practitionerLogoPath:     '',
  }
  return _defaults
}

let cache: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  const p = settingsPath()
  if (existsSync(p)) {
    try {
      cache = { ...getDefaults(), ...JSON.parse(readFileSync(p, 'utf-8')) }
      return cache
    } catch { /* ignore — use defaults */ }
  }
  cache = { ...getDefaults() }
  return cache
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  cache = { ...getSettings(), ...partial }
  writeFileSync(settingsPath(), JSON.stringify(cache, null, 2), 'utf-8')
  return cache
}

/** Invalidation du cache (utile après un import/restauration) */
export function invalidateCache(): void {
  cache = null
}
