import { getCachedLicenseState } from './licenseService'
import type { LicenseStatus } from '../../shared/types'

export interface RestrictionState {
  mode:                   'full' | 'restricted'
  status:                 LicenseStatus
  // Toujours autorisées — conformité RGPD : les données restent accessibles
  canReadData:            boolean
  canExportData:          boolean
  canBackupData:          boolean
  // Requièrent un abonnement actif
  canCreatePatient:       boolean
  canModifyPatient:       boolean
  canCreateSession:       boolean
  canModifySession:       boolean
  canCreateInvoice:       boolean
  canCreateAppointment:   boolean
  // Requiert active ou trialing (pas past_due_grace)
  canUsePremiumFeatures:  boolean
}

export function getRestrictionState(): RestrictionState {
  const s = getCachedLicenseState()
  const isFull    = s.mode === 'full'
  const isPremium = s.status === 'active' || s.status === 'trialing'

  return {
    mode:   s.mode,
    status: s.status,
    // Lecture/export : toujours oui
    canReadData:          true,
    canExportData:        true,
    canBackupData:        true,
    // Écriture : mode full requis
    canCreatePatient:     isFull,
    canModifyPatient:     isFull,
    canCreateSession:     isFull,
    canModifySession:     isFull,
    canCreateInvoice:     isFull,
    canCreateAppointment: isFull,
    // Fonctionnalités premium : abonnement à jour requis
    canUsePremiumFeatures: isPremium,
  }
}
