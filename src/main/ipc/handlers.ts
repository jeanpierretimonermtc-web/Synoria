import { ipcMain, dialog, shell, app } from 'electron'
import { spawn }                         from 'child_process'
import { mkdirSync, writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { join, extname, normalize, isAbsolute, basename } from 'path'
import { tmpdir }                        from 'os'
import * as patientRepo               from '../database/repositories/patientRepository'
import * as supabaseAuth              from '../services/supabaseAuthService'
import * as licenseSvc               from '../services/licenseService'
import * as restrictionGuard         from '../services/restrictedModeGuard'
import * as updateSvc                from '../services/updateService'
import * as localStore               from '../services/localLicenseStore'

import * as sessionRepo               from '../database/repositories/sessionRepository'
import * as appointmentRepo           from '../database/repositories/appointmentRepository'
import { getSettings, saveSettings }  from '../services/settingsService'
import { generateInvoice, regenerateInvoicePdf } from '../services/invoiceService'
import * as comptaRepo               from '../database/repositories/comptaRepository'
import { exportComptaExcel }         from '../services/comptaExportService'
import {
  exportBackupEncrypted,
  exportPatientBackup,
  importBackupJson,
  getBackupInfo,
  verifyBackup,
} from '../services/backupService'
import { exportSessionExcel }         from '../services/exportService'
import {
  exportSessionInteropJson,
  exportSessionFullBackupJson,
  exportSessionHtml,
  exportSessionExcelCanonical,
} from '../services/exports/sessionExportPipeline'
import { initDatabase, closeDatabase, isDatabaseOpen } from '../database/connection'
import * as auth                      from '../services/authService'
import * as pluginSvc                 from '../services/pluginService'
import * as profileSvc               from '../services/profileService'
import '../services/moduleAdapters'
import * as accessLogRepo             from '../database/repositories/accessLogRepository'
import * as rgpdSvc                   from '../services/rgpdService'
import * as gcalSvc                   from '../services/googleCalendarService'
import { logError }                             from '../services/logService'
import { getAllBlocks, getBlocksByMonth, createBlock, updateBlock, deleteBlock } from '../database/repositories/calendarBlockRepository'
import { generateDiagnosticReport, generateSupportDoc, generateRecoveryDoc } from '../services/diagnosticService'
import { exportPatientReport }  from '../services/patientReportService'
import { checkOwnerFromSettings, isOwner } from '../services/ownerService'
import { exportConsentForm }    from '../services/consentFormService'
import { exportUrssafReport }   from '../services/urssafReportService'
import { adminVerify, adminGetLogs, adminClearLogs, adminGetSystemInfo, adminDbIntegrity, adminWalCheckpoint, adminDbStats, adminGetSettings, adminForceBackup } from '../services/adminService'

// ── Slug patient (même logique que backupService) ─────────────────
function patientSlug(lastName: string, firstName: string): string {
  const last  = lastName.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const first = (firstName.charAt(0).toUpperCase() + firstName.slice(1))
                  .replace(/[^a-zA-Z0-9]/g, '_')
  return `${last}_${first}`
}

export function registerAllHandlers(): void {
  pluginSvc.purgePluginLibrary()

  // ─── APPOINTMENTS (RDV) ────────────────────────────────────────────────────
  ipcMain.handle('appointments:getAll',    ()           => appointmentRepo.getAllAppointments())
  ipcMain.handle('appointments:byDate',    (_e, date)   => appointmentRepo.getAppointmentsByDate(date))
  ipcMain.handle('appointments:byMonth',   (_e, y, m)   => appointmentRepo.getAppointmentsByMonth(y, m))
  ipcMain.handle('appointments:byPatient', (_e, pid)    => appointmentRepo.getAppointmentsByPatient(pid))

  ipcMain.handle('appointments:create', async (_e, data) => {
    licenseSvc.assertNotRestricted()
    const appt = appointmentRepo.createAppointment(data)
    if (gcalSvc.isExternalGCalEventId(appt.google_event_id)) return appt
    // Sync Google Calendar en arrière-plan (erreurs silencieuses)
    try {
      const eventId = await gcalSvc.createGCalEvent(appt)
      if (eventId) return appointmentRepo.updateAppointment(appt.id, { google_event_id: eventId })
    } catch (e) {
      console.error('[GCal] create sync:', e)
    }
    return appt
  })

  ipcMain.handle('appointments:update', async (_e, id, d) => {
    licenseSvc.assertNotRestricted()
    const appt = appointmentRepo.updateAppointment(id, d)
    if (gcalSvc.isExternalGCalEventId(appt.google_event_id)) return appt
    if (appt.google_event_id) {
      try {
        const result = await gcalSvc.updateGCalEvent(appt.google_event_id, appt)
        // 'deleted' = event effacé de GCal → recréer
        // 'error'   = problème réseau → NE PAS recréer (évite les doublons)
        if (result === 'deleted') {
          const eventId = await gcalSvc.createGCalEvent(appt)
          if (eventId) return appointmentRepo.updateAppointment(appt.id, { google_event_id: eventId })
        }
      } catch (e) {
        console.error('[GCal] update sync:', e)
      }
    } else {
      try {
        const eventId = await gcalSvc.createGCalEvent(appt)
        if (eventId) return appointmentRepo.updateAppointment(appt.id, { google_event_id: eventId })
      } catch (e) {
        console.error('[GCal] update sync:', e)
      }
    }
    return appt
  })

  ipcMain.handle('appointments:delete', async (_e, id) => {
    licenseSvc.assertNotRestricted()
    const existing = appointmentRepo.getAppointmentById(id)
    appointmentRepo.deleteAppointment(id)
    // Marquer les séances liées implicitement (sans nextSessionApptId) pour que
    // le backfill ne recrée pas ce RDV lors du prochain chargement du calendrier
    if (existing?.patient_id && existing?.date) {
      try { sessionRepo.linkAppointmentToSessionsByDate(existing.patient_id, existing.date, id) } catch { }
    }
    if (existing?.google_event_id && !gcalSvc.isExternalGCalEventId(existing.google_event_id)) {
      gcalSvc.deleteGCalEvent(existing.google_event_id).catch(e => console.error('[GCal] delete sync:', e))
    }
  })

  // ─── PATIENTS ──────────────────────────────────────────────────────────────
  ipcMain.handle('patients:getAll',    ()           => patientRepo.getAllPatients())
  ipcMain.handle('patients:getById',   (_e, id)     => patientRepo.getPatientById(id))
  ipcMain.handle('patients:create',    (_e, data)   => { licenseSvc.assertNotRestricted(); return patientRepo.createPatient(data) })
  ipcMain.handle('patients:update',    (_e, id, d)  => { licenseSvc.assertNotRestricted(); return patientRepo.updatePatient(id, d) })
  ipcMain.handle('patients:delete',    (_e, id)     => { licenseSvc.assertNotRestricted(); return patientRepo.deletePatient(id) })
  ipcMain.handle('patients:followUp',  (_e, days)   => patientRepo.getPatientsToFollowUp(days))

  // ─── SESSIONS ──────────────────────────────────────────────────────────────
  ipcMain.handle('sessions:getAll',        (_e, pid)    => sessionRepo.getAllSessions(pid))
  ipcMain.handle('sessions:getById',       (_e, id)     => sessionRepo.getSessionById(id))
  ipcMain.handle('sessions:create',        (_e, data)   => { licenseSvc.assertNotRestricted(); return sessionRepo.createSession(data) })
  ipcMain.handle('sessions:update',        (_e, id, d)  => { licenseSvc.assertNotRestricted(); return sessionRepo.updateSession(id, d) })
  ipcMain.handle('sessions:delete',        (_e, id)     => { licenseSvc.assertNotRestricted(); return sessionRepo.deleteSession(id) })
  ipcMain.handle('sessions:duplicate',     (_e, id)     => { licenseSvc.assertNotRestricted(); return sessionRepo.duplicateSession(id) })
  ipcMain.handle('sessions:byMonth',       (_e, y, m)   => sessionRepo.getSessionsByMonth(y, m))
  ipcMain.handle('sessions:dashboardStats',()           => sessionRepo.getDashboardStats())
  ipcMain.handle('sessions:upcoming',      ()           => sessionRepo.getUpcomingSessions())

  // ─── EXPORTS SESSION (sauvegarde dans le dossier patient configuré) ────────

  /** Export JSON lisible d'une séance → dossier backup patient (format importable) */
  ipcMain.handle('exports:sessionJson', (_e, sessionId) => {
    const session = sessionRepo.getSessionById(sessionId)
    if (!session) throw new Error('Session introuvable')
    const patient = session.patient_id ? patientRepo.getPatientById(session.patient_id) : null

    // Format importable : mêmes noms de champs que la BDD, encapsulé dans { patient, sessions }
    const payload = {
      version:    2,
      exportedAt: new Date().toISOString(),
      patient:    patient || undefined,
      sessions:   [session],
    }

    let outputDir: string
    if (patient) {
      const settings = getSettings()
      const slug     = patientSlug(patient.last_name, patient.first_name)
      outputDir      = join(settings.backupPatientPath, slug)
      mkdirSync(outputDir, { recursive: true })
    } else {
      outputDir = join(app.getPath('userData'), 'exports')
      mkdirSync(outputDir, { recursive: true })
    }

    const date     = session.date || new Date().toISOString().slice(0, 10)
    const slug     = patient ? patientSlug(patient.last_name, patient.first_name) : 'session'
    const filePath = join(outputDir, `${slug}_${date}.json`)
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return filePath
  })

  /** Export Excel d'une séance → dossier patient configuré */
  ipcMain.handle('exports:sessionExcel', (_e, sessionId) => {
    const session = sessionRepo.getSessionById(sessionId)
    if (!session) throw new Error('Session introuvable')
    const patient = session.patient_id ? patientRepo.getPatientById(session.patient_id) : null

    let outputDir: string | undefined
    if (patient) {
      const settings = getSettings()
      const slug     = patientSlug(patient.last_name, patient.first_name)
      outputDir      = join(settings.backupPatientPath, slug)
    }

    return exportSessionExcel(sessionId, outputDir)
  })

  /** Export Excel d'une séance vers dossier patient (alias depuis settings/patient page) */
  ipcMain.handle('exports:patientExcel', (_e, patientId: string, sessionId: string) => {
    const patient  = patientRepo.getPatientById(patientId)
    if (!patient) throw new Error('Patient introuvable')
    const settings = getSettings()
    const slug     = patientSlug(patient.last_name, patient.first_name)
    const dir      = join(settings.backupPatientPath, slug)
    return exportSessionExcel(sessionId, dir)
  })

  ipcMain.handle('exports:sessionPdf', (_e, _sessionId) => {
    return 'PDF export: utilisez Imprimer (Ctrl+P) depuis le résumé de séance'
  })

  ipcMain.handle('exports:patientReport',  (_e, patientId: string) => exportPatientReport(patientId))
  ipcMain.handle('exports:consentForm',    (_e, patientId?: string) => exportConsentForm(patientId))
  ipcMain.handle('exports:urssafReport',   (_e, year: number)      => exportUrssafReport(year))

  // ─── EXPORTS CANONIQUES (Phase 2 : pipeline normalisé, sans perte) ─────────
  ipcMain.handle('exports:sessionInteropJson', (_e, sessionId: string) => exportSessionInteropJson(sessionId))
  ipcMain.handle('exports:sessionBackupJson',  (_e, sessionId: string) => exportSessionFullBackupJson(sessionId))
  ipcMain.handle('exports:sessionReportHtml',  (_e, sessionId: string) => exportSessionHtml(sessionId))
  ipcMain.handle('exports:sessionExcelV2',     (_e, sessionId: string) => exportSessionExcelCanonical(sessionId))

  // ─── BACKUP GÉNÉRAL ────────────────────────────────────────────────────────
  ipcMain.handle('exports:backupJson',   ()             => exportBackupEncrypted())
  // Import backup — signale au renderer quel type d'aide est nécessaire
  ipcMain.handle('exports:importJson', async (_e, filePath) => {
    licenseSvc.assertNotRestricted()
    try {
      return importBackupJson(filePath)
    } catch (e: any) {
      if (e.message?.startsWith('V3_NEEDS_PASSWORD:')) return { __needsPassword: true, filePath }
      if (e.message?.startsWith('WRONG_KEY:'))         return { __needsKey: true,      filePath }
      throw e
    }
  })

  ipcMain.handle('exports:importJsonWithPassword', (_e, filePath: string, password: string) => {
    licenseSvc.assertNotRestricted()
    return importBackupJson(filePath, { password })
  })

  // Import avec fichier clé sélectionné par le renderer
  ipcMain.handle('exports:importJsonWithKey', async (_e, filePath: string) => {
    licenseSvc.assertNotRestricted()
    const result = await dialog.showOpenDialog({
      title:       'Sélectionner votre fichier encryption.key',
      defaultPath: app.getPath('userData'),
      filters: [
        { name: 'Clé Synoria', extensions: ['key'] },
        { name: 'Tous',        extensions: ['*']   },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths.length) throw new Error('Sélection annulée')
    return importBackupJson(filePath, { customKeyPath: result.filePaths[0] })
  })

  ipcMain.handle('exports:exportEncryptionKey', async () => {
    const userData = app.getPath('userData')
    const keyFile  = join(userData, 'encryption.key')
    const result   = await dialog.showSaveDialog({
      title:       'Sauvegarder la clé de chiffrement',
      defaultPath: join(app.getPath('documents'), 'Synoria_encryption.key'),
      filters: [{ name: 'Clé de chiffrement', extensions: ['key'] }],
    })
    if (result.canceled || !result.filePath) return null
    const { copyFileSync } = await import('fs')
    copyFileSync(keyFile, result.filePath)
    return result.filePath
  })
  ipcMain.handle('backup:exportGeneral', ()             => exportBackupEncrypted())
  ipcMain.handle('backup:exportPatient', (_e, patientId)=> exportPatientBackup(patientId))
  ipcMain.handle('backup:info',          ()             => getBackupInfo())
  ipcMain.handle('backup:openFolder', async (_e, type: 'general' | 'patient') => {
    const settings = getSettings()
    const dir = type === 'patient' ? settings.backupPatientPath : settings.backupGeneralPath
    mkdirSync(dir, { recursive: true })
    await shell.openPath(dir)
  })

  // ─── FACTURATION ───────────────────────────────────────────────────────────
  ipcMain.handle('invoice:generate', (_e, data)                   => { licenseSvc.assertNotRestricted(); return generateInvoice(data) })
  ipcMain.handle('invoice:regeneratePdf', async (_e, id: string, invoiceNum: string, data) => {
    licenseSvc.assertNotRestricted()
    const filePath = await regenerateInvoicePdf(data, invoiceNum)
    comptaRepo.updateInvoiceLog(id, { file_path: filePath } as any)
    return { filePath, invoiceNumber: invoiceNum, montant: data.montant }
  })
  ipcMain.handle('invoice:update',   (_e, id, data)               => { licenseSvc.assertNotRestricted(); return comptaRepo.updateInvoiceLog(id, data) })
  ipcMain.handle('invoice:delete',   (_e, id)                     => { licenseSvc.assertNotRestricted(); return comptaRepo.deleteInvoiceLog(id) })
  ipcMain.handle('invoice:markPaid', (_e, id: string, paid: boolean) => {
    licenseSvc.assertNotRestricted()
    comptaRepo.markInvoicePaid(id, paid)
  })
  ipcMain.handle('invoice:overdue', (_e, thresholdDays: number) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - thresholdDays)
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`
    return comptaRepo.getAllInvoicesLog().filter(
      inv => !inv.is_paid && inv.invoice_date <= cutoffStr
    )
  })

  ipcMain.handle('invoice:getEmailData', async (_e, invoiceId: string) => {
    const inv = comptaRepo.getInvoiceLogById(invoiceId)
    if (!inv) throw new Error('Facture introuvable')

    const allPats = patientRepo.getAllPatients()

    // Résoudre l'email : depuis la facture, ou par recherche prénom/nom dans les patients
    let recipientEmail = inv.email || ''
    let civility = ''

    if (!recipientEmail) {
      const fnLower = (inv.patient_first_name || '').toLowerCase()
      const lnLower = (inv.patient_last_name  || '').toLowerCase()
      const matched = allPats.find(p =>
        p.email &&
        (p.first_name || '').toLowerCase() === fnLower &&
        (p.last_name  || '').toLowerCase() === lnLower
      )
      if (matched?.email) {
        recipientEmail = matched.email
        civility       = matched.civility || ''
      }
    } else {
      const civPat = allPats.find(p => !!p.email && p.email === inv.email)
      civility = civPat?.civility || ''
    }

    if (!recipientEmail) {
      return { to: null, subject: null, body: null, pdfPath: null, fileName: null }
    }

    const settings   = getSettings()
    const firstName  = settings.practitionerFirstName || ''
    const lastName   = settings.practitionerLastName  || ''
    const practName  = [firstName, lastName].filter(Boolean).join(' ')
                       || settings.rgpdPractitionerName || ''
    const practEmail = settings.practitionerEmail || settings.rgpdPractitionerEmail || ''

    const fmtMontant = inv.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
    const fmtD = (iso: string) => {
      const d = new Date(iso)
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
    }

    const subject = `Votre facture ${inv.invoice_number}${practName ? ` — Cabinet ${practName}` : ''}`

    const bodyLines = [
      `${civility === 'M' ? 'Monsieur' : civility === 'Mme' ? 'Madame' : 'Madame, Monsieur'} ${inv.patient_first_name} ${inv.patient_last_name},`,
      '',
      `Veuillez trouver ci-joint votre facture n° ${inv.invoice_number} d'un montant de ${fmtMontant}.`,
      '',
      `Date de la séance : ${fmtD(inv.session_date || inv.invoice_date)}`,
      ...(inv.description ? [`Prestation : ${inv.description}`] : []),
      '',
      'Cordialement,',
      ...(practName  ? [practName]  : []),
      ...(practEmail ? [practEmail] : []),
    ]
    const body = bodyLines.join('\n')

    const hasPdf   = !!(inv.file_path && existsSync(inv.file_path))
    const pdfPath  = hasPdf ? inv.file_path! : null
    const fileName = pdfPath ? basename(pdfPath) : null

    return { to: recipientEmail, subject, body, pdfPath, fileName }
  })

  ipcMain.handle('invoice:openEmailClient', async (_e, to: string, subject: string, body: string, pdfPath?: string | null) => {
    const hasPdf = !!(pdfPath && existsSync(pdfPath))

    // Tente COM automation Outlook via PowerShell (seule méthode fiable pour joindre un PDF)
    if (hasPdf) {
      try {
        const tmpBodyFile = join(tmpdir(), 'synoria_mail_body.txt')
        const tmpPs1      = join(tmpdir(), 'synoria_mail.ps1')
        writeFileSync(tmpBodyFile, body, 'utf8')

        const escapeSQ = (s: string) => s.replace(/'/g, "''")
        const script = [
          `$ol   = New-Object -ComObject Outlook.Application`,
          `$mail = $ol.CreateItem(0)`,
          `$mail.To      = '${escapeSQ(to)}'`,
          `$mail.Subject = '${escapeSQ(subject)}'`,
          `$mail.Body    = [System.IO.File]::ReadAllText('${escapeSQ(tmpBodyFile)}')`,
          `$mail.Attachments.Add('${escapeSQ(pdfPath!)}')`,
          `$mail.Display()`,
        ].join('\r\n')

        writeFileSync(tmpPs1, script, 'utf8')

        await new Promise<void>((resolve, reject) => {
          const ps = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NonInteractive', '-File', tmpPs1], { windowsHide: true })
          ps.on('close', (code) => {
            try { unlinkSync(tmpPs1) } catch {}
            try { unlinkSync(tmpBodyFile) } catch {}
            code === 0 ? resolve() : reject(new Error(`PowerShell exit ${code}`))
          })
          ps.on('error', reject)
          setTimeout(() => { try { ps.kill() } catch {} reject(new Error('timeout')) }, 15000)
        })
        return // Succès COM Outlook
      } catch {
        // Outlook non disponible — repli vers mailto:
      }
    }

    // Repli : mailto: standard (sans pièce jointe)
    const mailto = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`
    await shell.openExternal(mailto)
    if (hasPdf) shell.showItemInFolder(pdfPath!)
  })

    // ─── RAPPEL RDV PAR EMAIL ──────────────────────────────────────────────────
  ipcMain.handle('appointments:sendReminder', async (_e, appointmentId: string) => {
    const appt = appointmentRepo.getAppointmentById(appointmentId)
    if (!appt) throw new Error('Rendez-vous introuvable')
    if (!appt.patient_id) throw new Error("Ce rendez-vous n'a pas de patient associé")

    const patient = patientRepo.getPatientById(appt.patient_id)
    if (!patient)       throw new Error('Patient introuvable')
    if (!patient.email) throw new Error('Aucun email renseigné pour ce patient')

    const settings   = getSettings()
    const firstName  = settings.practitionerFirstName || ''
    const lastName   = settings.practitionerLastName  || ''
    const practName  = [firstName, lastName].filter(Boolean).join(' ')
                       || settings.rgpdPractitionerName || ''
    const practEmail = settings.practitionerEmail || settings.rgpdPractitionerEmail || ''

    const fmtDate = (iso: string) => {
      const d = new Date(iso + 'T12:00:00')
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }

    const dateLabel  = fmtDate(appt.date)
    const heureLabel = appt.heure_fin
      ? `${appt.heure_debut} – ${appt.heure_fin}`
      : appt.heure_debut

    const subject = `Rappel de votre rendez-vous du ${dateLabel} à ${appt.heure_debut}${practName ? ` — Cabinet ${practName}` : ''}`

    const bodyLines = [
      `${patient.civility === 'M' ? 'Monsieur' : patient.civility === 'Mme' ? 'Madame' : 'Madame, Monsieur'} ${patient.first_name} ${patient.last_name},`,
      '',
      `Nous vous rappelons votre rendez-vous prévu le ${dateLabel} de ${heureLabel}.`,
      ...(appt.note ? [`Motif : ${appt.note}`] : []),
      '',
      "En cas d'empêchement, n'hésitez pas à nous contacter.",
      '',
      'Cordialement,',
      ...(practName ? [practName] : []),
    ]

    const mailto = `mailto:${encodeURIComponent(patient.email)}`
                 + `?subject=${encodeURIComponent(subject)}`
                 + `&body=${encodeURIComponent(bodyLines.join('\r\n'))}`
                 + (practEmail ? `&from=${encodeURIComponent(practEmail)}` : '')

    await shell.openExternal(mailto)
  })

  // ─── COMPTABILITÉ ──────────────────────────────────────────────────────────
  ipcMain.handle('compta:yearData', (_e, year) => {
    const [consultationTypes, monthlyRevenue, ursafRates, expenseConfig, monthlyVarExpenses, years] = [
      comptaRepo.getConsultationTypes(),
      comptaRepo.getMonthlyRevenue(year),
      comptaRepo.getUrsafRates(year),
      comptaRepo.getExpenseConfig(),
      comptaRepo.getMonthlyVarExpenses(year),
      comptaRepo.getComptaYears(),
    ]
    return { consultationTypes, monthlyRevenue, ursafRates, expenseConfig, monthlyVarExpenses, years }
  })
  ipcMain.handle('compta:setMonthlyRevenue',    (_e, y, m, tid, nb)       => { licenseSvc.assertNotRestricted(); return comptaRepo.setMonthlyRevenue(y, m, tid, nb) })
  ipcMain.handle('compta:incrementRevenue',     (_e, y, m, tid)           => { licenseSvc.assertNotRestricted(); return comptaRepo.incrementMonthlyRevenue(y, m, tid) })
  ipcMain.handle('compta:setUrsafRate',         (_e, y, m, rate)          => { licenseSvc.assertNotRestricted(); return comptaRepo.setUrsafRate(y, m, rate) })
  ipcMain.handle('compta:setMonthlyVarExpense', (_e, y, m, cat, lbl, amt) => { licenseSvc.assertNotRestricted(); return comptaRepo.setMonthlyVarExpense(y, m, cat, lbl, amt) })
  ipcMain.handle('compta:getConsultTypes',      ()                        => comptaRepo.getConsultationTypes())
  ipcMain.handle('compta:saveConsultTypes',     (_e, types)               => { licenseSvc.assertNotRestricted(); return comptaRepo.saveConsultationTypes(types) })
  ipcMain.handle('compta:getExpenseConfig',     ()                        => comptaRepo.getExpenseConfig())
  ipcMain.handle('compta:saveExpenseConfig',    (_e, configs)             => { licenseSvc.assertNotRestricted(); return comptaRepo.saveExpenseConfig(configs) })
  ipcMain.handle('compta:getInvoicesLog',       (_e, year)                => comptaRepo.getInvoicesLog(year))
  ipcMain.handle('compta:exportExcel',          (_e, year)                => exportComptaExcel(year))

  // ─── PARAMÈTRES ────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get',  ()             => getSettings())
  ipcMain.handle('settings:save', (_e, partial)  => saveSettings(partial))
  ipcMain.handle('owner:check',   ()             => {
    if (checkOwnerFromSettings()) return true
    const user = supabaseAuth.getCurrentUser()
    return isOwner(user?.email)
  })

  // ─── DIALOGS ───────────────────────────────────────────────────────────────
  ipcMain.handle('dialog:save', async (_e, opts) => {
    const result = await dialog.showSaveDialog(opts)
    return result.canceled ? null : result.filePath
  })
  ipcMain.handle('dialog:open', async (_e, opts) => {
    const result = await dialog.showOpenDialog(opts)
    return result.canceled ? null : result.filePaths[0]
  })
  // ── Authentification & chiffrement BDD ──────────────────────────────────
  ipcMain.handle('auth:status', () => ({
    hasPassword: auth.hasPassword(),
    isUnlocked:  isDatabaseOpen(),
  }))

  ipcMain.handle('auth:setup', async (_e, password: string) => {
    try {
      // DB est ouverte (première utilisation, pas de mot de passe)
      try { require('../database/connection').getDb().pragma('wal_checkpoint(TRUNCATE)') } catch {}
      closeDatabase()
      auth.setupPassword(password)
      auth.encryptDb()      // chiffre le fichier existant
      auth.decryptDb()      // déchiffre pour la session courante
      initDatabase()
      if (!app.isPackaged) {
        try { const { seedDevDataIfEmpty } = require('../database/seedDevData'); seedDevDataIfEmpty() } catch {}
      }
      return { ok: true }
    } catch (e: any) {
      logError('auth:setup', e)
      // Rollback : supprimer auth.json si la config a échoué après sa création
      // pour que l'utilisateur puisse recommencer depuis l'écran de setup
      try {
        const { existsSync, unlinkSync } = require('fs')
        if (existsSync(auth.authFilePath())) unlinkSync(auth.authFilePath())
      } catch {}
      auth.clearKey()
      return { ok: false, error: e?.message || String(e) }
    }
  })

  ipcMain.handle('auth:login', async (_e, password: string) => {
    const ok = auth.verifyPassword(password)
    if (!ok) return false
    if (!isDatabaseOpen()) {
      auth.decryptDb()
      initDatabase()
    }
    // En mode dev : compléter les données de test si des patients manquent
    if (!app.isPackaged) {
      try {
        const { seedDevDataIfEmpty } = require('../database/seedDevData')
        seedDevDataIfEmpty()
      } catch (e) { console.error('[DEV] Seed after login:', e) }
    }
    // Notification desktop J-1 après un court délai (laisse la fenêtre s'afficher)
    setTimeout(() => {
      try { require('../services/notificationService').checkJ1Reminders() } catch {}
    }, 4000)
    return true
  })

  ipcMain.handle('auth:lock', () => {
    if (auth.isKeyLoaded()) {
      try {
        closeDatabase()
        auth.encryptDb()
        auth.deleteWorkingDb()
      } catch (e) {
        console.error('[Auth] Erreur chiffrement au verrouillage:', e)
      }
    }
    auth.clearKey()
  })

  ipcMain.handle('auth:changePassword', async (_e, oldPwd: string, newPwd: string) => {
    if (!auth.verifyPassword(oldPwd))
      return { ok: false, error: 'Mot de passe actuel incorrect' }
    if (newPwd.length < 6)
      return { ok: false, error: 'Le nouveau mot de passe doit faire au moins 6 caractères' }
    try {
      // Checkpoint + re-chiffrement avec le nouveau mot de passe
      try { require('../database/connection').getDb().pragma('wal_checkpoint(TRUNCATE)') } catch {}
      auth.setupPassword(newPwd)   // écrase auth.json + met à jour _key
      auth.encryptDb()             // re-chiffre avec le nouveau mot de passe
      return { ok: true }
    } catch (e: any) {
      logError('auth:changePassword', e)
      return { ok: false, error: e?.message || String(e) }
    }
  })
  // ─────────────────────────────────────────────────────────────────────────

  // ── RGPD ─────────────────────────────────────────────────────────────────
  ipcMain.handle('rgpd:logAccess',    (_e, pid, action, detail) => accessLogRepo.logAccess(pid, action, detail))
  ipcMain.handle('rgpd:getAccessLog', (_e, pid, limit)          => accessLogRepo.getAccessLog(pid, limit))
  ipcMain.handle('rgpd:getAlerts',    ()                         => rgpdSvc.getRgpdAlerts())
  ipcMain.handle('rgpd:exportRegister', ()                       => rgpdSvc.exportTraitementRegister())
  // ─────────────────────────────────────────────────────────────────────────

  // ── Plugin spécialité ──────────────────────────────────────────────────
  ipcMain.handle('plugin:get',           ()           => pluginSvc.getActivePlugin())
  ipcMain.handle('plugin:set',           (_e, def)    => pluginSvc.setActivePlugin(def))
  ipcMain.handle('plugin:remove',        ()           => pluginSvc.removePlugin())
  ipcMain.handle('plugin:import',        (_e, path)   => pluginSvc.importPluginFromFile(path))
  ipcMain.handle('plugin:libraryGet',        ()           => pluginSvc.getPluginLibrary())
  ipcMain.handle('plugin:librarySave',       (_e, plugin) => pluginSvc.savePluginToLibrary(plugin))
  ipcMain.handle('plugin:librarySaveNative', (_e, plugin) => pluginSvc.saveNativePluginToLibrary(plugin))
  ipcMain.handle('plugin:libraryDelete',     (_e, id)     => pluginSvc.deletePluginFromLibrary(id))
  ipcMain.handle('plugin:libraryExport',     (_e, dest)   => pluginSvc.exportPluginLibrary(dest))
  ipcMain.handle('plugin:libraryImport',     (_e, src)    => pluginSvc.importPluginLibraryFromFile(src))
  ipcMain.handle('plugin:listAvailable',     ()           => pluginSvc.listAvailablePlugins())

  // ── Profils de séance (Phase 3) ──────────────────────────────────────────
  ipcMain.handle('profiles:getAll',     ()             => profileSvc.getProfiles())
  ipcMain.handle('profiles:getDefault', ()             => profileSvc.getDefaultProfile())
  ipcMain.handle('profiles:create',     (_e, data)     => profileSvc.createProfile(data))
  ipcMain.handle('profiles:update',     (_e, id, data) => profileSvc.updateProfile(id, data))
  ipcMain.handle('profiles:duplicate',  (_e, id, name) => profileSvc.duplicateProfile(id, name))
  ipcMain.handle('profiles:archive',    (_e, id)       => profileSvc.archiveProfile(id))
  ipcMain.handle('profiles:setDefault', (_e, id)       => profileSvc.setDefaultProfile(id))
  ipcMain.handle('profiles:migrate',    ()             => profileSvc.migrateActivePluginToProfile(pluginSvc))
  // ─────────────────────────────────────────────────────────────────────────

  ipcMain.handle('shell:openPath',      (_e, path)    => shell.openPath(path))
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (typeof url !== 'string') return
    if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('mailto:')) return
    return shell.openExternal(url)
  })

  // Lit un fichier local et retourne un data URL base64 (pour les aperçus dans le renderer)
  // Validation par magic bytes : rejette tout fichier qui ne commence pas par un en-tête image valide,
  // même si son extension ressemble à une image (.json renommé en .png ne passera pas).
  ipcMain.handle('fs:readDataUrl', (_e, filePath: string): string | null => {
    if (!filePath || !existsSync(filePath)) return null
    try {
      const ALLOWED_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])
      if (!ALLOWED_EXTS.has(extname(filePath).toLowerCase().slice(1))) return null
      const buf = readFileSync(filePath)
      const isPng  = buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4E && buf[3]===0x47
      const isJpeg = buf[0]===0xFF && buf[1]===0xD8
      const isGif  = buf[0]===0x47 && buf[1]===0x49 && buf[2]===0x46 && buf[3]===0x38
      const isBmp  = buf[0]===0x42 && buf[1]===0x4D
      const isWebp = buf[0]===0x52 && buf[1]===0x49 && buf[2]===0x46 && buf[3]===0x46
                  && buf[8]===0x57 && buf[9]===0x45 && buf[10]===0x42 && buf[11]===0x50
      if (!isPng && !isJpeg && !isGif && !isBmp && !isWebp) return null
      const mime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : isGif ? 'image/gif'
                 : isWebp ? 'image/webp' : 'image/bmp'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { return null }
  })
  ipcMain.handle('app:getVersion',      ()            => app.getVersion())
  ipcMain.handle('app:relaunch',        ()            => { app.relaunch(); app.quit() })
  ipcMain.handle('app:launchInstaller', async (_e, exePath: string) => {
    if (typeof exePath !== 'string' || !isAbsolute(exePath)) return
    const norm = normalize(exePath)
    const normLower = norm.toLowerCase()
    const tmpDir  = normalize(tmpdir()).toLowerCase()
    const udataDir = normalize(app.getPath('userData')).toLowerCase()
    if (!normLower.endsWith('.exe') && !normLower.endsWith('.dmg')) return
    if (!normLower.startsWith(tmpDir) && !normLower.startsWith(udataDir)) return
    if (process.platform === 'darwin') {
      await shell.openPath(norm)
      return
    }
    spawn(norm, [], { detached: true, stdio: 'ignore' }).unref()
    setTimeout(() => app.quit(), 500)
  })
  ipcMain.handle('app:dataPath',   ()            => app.getPath('userData'))
  ipcMain.handle('docs:open',        () => shell.openExternal('https://logiciel-synoria.fr/guide-utilisation'))
  ipcMain.handle('docs:openInstall', () => shell.openExternal('https://logiciel-synoria.fr/guide-installation'))
  ipcMain.handle('docs:openRgpd',    () => shell.openExternal('https://logiciel-synoria.fr/guide-rgpd'))

  // ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────
  ipcMain.handle('gcal:status',        ()              => gcalSvc.getStatus())
  ipcMain.handle('gcal:connect',       async () => gcalSvc.connect())
  ipcMain.handle('gcal:disconnect', () => {
    // Supprimer tous les RDV importés depuis les calendriers Google
    const allAppts = appointmentRepo.getAllAppointments()
    for (const appt of allAppts) {
      if (gcalSvc.isExternalGCalEventId(appt.google_event_id)) {
        appointmentRepo.deleteAppointment(appt.id)
      }
    }
    gcalSvc.disconnect()
  })
  ipcMain.handle('gcal:listCalendars', async ()        => gcalSvc.listCalendars())
  ipcMain.handle('gcal:setCalendar',   (_e, id, name) => gcalSvc.setCalendar(id, name))
  ipcMain.handle('gcal:setImportCalendars', (_e, calendars) => {
    gcalSvc.setImportCalendars(calendars)
    // Supprimer immédiatement les RDV des calendriers qui viennent d'être désélectionnés
    const allAppts = appointmentRepo.getAllAppointments()
    let cleaned = 0
    for (const appt of allAppts) {
      if (
        gcalSvc.isExternalGCalEventId(appt.google_event_id) &&
        !gcalSvc.isSelectedImportGCalEventId(appt.google_event_id)
      ) {
        appointmentRepo.deleteAppointment(appt.id)
        cleaned++
      }
    }
    return { cleaned }
  })
  ipcMain.handle('gcal:cleanupOldImportedAppointments', () => {
    const appointments = appointmentRepo.getAllAppointments()
    let deleted = 0
    for (const appt of appointments) {
      if (
        gcalSvc.isExternalGCalEventId(appt.google_event_id) &&
        !gcalSvc.isSelectedImportGCalEventId(appt.google_event_id)
      ) {
        appointmentRepo.deleteAppointment(appt.id)
        deleted++
      }
    }
    return { deleted }
  })

  // Nettoyage complet des doublons (Synoria + GCal)
  ipcMain.handle('gcal:cleanupDuplicates', async () => {
    let deletedSynoria = 0

    const all = appointmentRepo.getAllAppointments()
    const native   = all.filter(a => !gcalSvc.isExternalGCalEventId(a.google_event_id))
    const external = all.filter(a =>  gcalSvc.isExternalGCalEventId(a.google_event_id))

    // 1. Supprimer les RDV importés de GCal qui doublonnent un RDV Synoria natif
    //    (même date + même heure de début → le natif est la source de vérité)
    for (const ext of external) {
      const isDuplicate = native.some(n =>
        n.date === ext.date && n.heure_debut === ext.heure_debut
      )
      if (isDuplicate) {
        appointmentRepo.deleteAppointment(ext.id)
        deletedSynoria++
      }
    }

    // 2. Supprimer les RDV importés depuis des calendriers plus sélectionnés
    for (const appt of appointmentRepo.getAllAppointments()) {
      if (
        gcalSvc.isExternalGCalEventId(appt.google_event_id) &&
        !gcalSvc.isSelectedImportGCalEventId(appt.google_event_id)
      ) {
        appointmentRepo.deleteAppointment(appt.id)
        deletedSynoria++
      }
    }

    // 3. Supprimer les doublons côté Google Calendar (même syneriaApptId → plusieurs events)
    const nativeAfter = appointmentRepo.getAllAppointments()
      .filter(a => !gcalSvc.isExternalGCalEventId(a.google_event_id))
    const deletedGCal = await gcalSvc.cleanupGCalDuplicates(nativeAfter).catch(() => 0)

    return { deletedSynoria, deletedGCal }
  })

  // ── Rappels RDV (J-1) ────────────────────────────────────────────
  ipcMain.handle('reminders:getPending', () => {
    const now   = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`
    const appts = appointmentRepo.getAllAppointments().filter(
      a => a.date === tomorrowStr && !a.is_done && !a.is_cancelled && !a.reminder_sent
    )
    const patients = patientRepo.getAllPatients()
    return appts
      .filter(a => {
        if (!a.patient_id) return false
        const pat = patients.find(p => p.id === a.patient_id)
        return !!pat?.email
      })
      .map(a => {
        const pat = patients.find(p => p.id === a.patient_id)!
        return {
          appointment_id: a.id,
          patient_id:     pat.id,
          patient_email:  pat.email || '',
          patient_name:   `${pat.first_name} ${pat.last_name}`,
          appt_date:      a.date,
          appt_heure:     a.heure_debut,
          appt_note:      a.note,
          reminder_sent:  a.reminder_sent ?? 0,
        }
      })
  })
  ipcMain.handle('reminders:markSent', (_e, appointmentId: string) => {
    appointmentRepo.updateAppointment(appointmentId, { reminder_sent: 1 } as any)
  })

  // ── Rattrapage : créer les RDV manquants depuis next_session_date ──
  ipcMain.handle('appointments:backfillFromSessions', () => {
    const today    = new Date().toISOString().slice(0, 10)
    const sessions = sessionRepo.getAllSessions()
    let created    = 0
    for (const sess of sessions) {
      if (!sess.next_session_date || sess.next_session_date < today) continue

      // Lire les données du prochain RDV depuis full_data_json
      let heureD = '09:00', heureF: string | undefined, note: string | undefined
      let linkedApptId: string | undefined
      try {
        const d = sess.full_data_json ? JSON.parse(sess.full_data_json) : {}
        if (d.nextSessionHeure)   heureD       = d.nextSessionHeure
        if (d.nextSessionFin)     heureF       = d.nextSessionFin
        if (d.nextSessionNote)    note         = d.nextSessionNote
        if (d.nextSessionApptId)  linkedApptId = d.nextSessionApptId
      } catch { /* ignore */ }

      // Si la séance avait un RDV lié (même supprimé), ne pas recréer automatiquement.
      // L'utilisateur a peut-être supprimé ce RDV intentionnellement.
      if (linkedApptId) {
        const linkedExists = appointmentRepo.getAppointmentById(linkedApptId)
        if (!linkedExists) continue  // RDV supprimé volontairement → on ne recrée pas
        continue  // RDV existe encore → rien à faire
      }

      // Aucun RDV n'a jamais été lié → vérifier si un RDV existe déjà pour ce patient/date
      const existing = appointmentRepo.getAppointmentsByDate(sess.next_session_date)
        .find(a => a.patient_id === sess.patient_id && !a.is_done)
      if (existing) continue

      // Créer le RDV manquant (séances V1.4.3 sans nextSessionApptId)
      const newAppt = appointmentRepo.createAppointment({
        patient_id:  sess.patient_id,
        date:        sess.next_session_date,
        heure_debut: heureD,
        heure_fin:   heureF,
        note:        note,
        is_done:     0,
      })
      // Enregistrer l'ID du RDV dans la séance pour que les suppressions futures soient respectées
      try {
        const fd = sess.full_data_json ? JSON.parse(sess.full_data_json) : {}
        fd.nextSessionApptId = newAppt.id
        sessionRepo.updateSession(sess.id, { full_data_json: JSON.stringify(fd) })
      } catch { /* non bloquant */ }
      created++
    }
    return { created }
  })

  // ── Sync bidirectionnel GCal ↔ Synoria ───────────────────────────
  ipcMain.handle('gcal:sync', async (_e, startDate: string, endDate: string) => {
    // ── 1. Nettoyer les RDV des calendriers qui ne sont plus sélectionnés ──
    // (exécuté avant d'importer pour éviter les conflits)
    let cleaned = 0
    {
      const allAppts = appointmentRepo.getAllAppointments()
      for (const appt of allAppts) {
        if (
          gcalSvc.isExternalGCalEventId(appt.google_event_id) &&
          !gcalSvc.isSelectedImportGCalEventId(appt.google_event_id)
        ) {
          appointmentRepo.deleteAppointment(appt.id)
          cleaned++
        }
      }
    }

    // ── 2. Importer / mettre à jour depuis les calendriers sélectionnés ──
    const timeMin = `${startDate}T00:00:00+00:00`
    const timeMax = `${endDate}T23:59:59+00:00`
    const events  = await gcalSvc.listSelectedImportEvents(timeMin, timeMax)

    let imported = 0
    let updated  = 0
    let exported = 0
    let sessionsExported = 0
    let sessionsUpdated = 0

    for (const ev of events) {
      // Ignorer les événements toute la journée (pas d'heure précise)
      const startDT = ev.start?.dateTime
      const endDT   = ev.end?.dateTime
      if (!startDT) continue
      // Ignorer les événements créés par Synoria (évite le cycle d'import)
      if (gcalSvc.isSynoriaOwnedEvent(ev)) continue

      const evDate   = startDT.slice(0, 10)
      const evHeureD = startDT.slice(11, 16)
      const evHeureF = endDT ? endDT.slice(11, 16) : undefined
      const fromExternalCalendar = !!ev.storageId && ev.storageId !== ev.id
      const evNote   = fromExternalCalendar && ev.calendarSummary
        ? `${ev.summary || 'Evenement Google'} (${ev.calendarSummary})`
        : ev.summary || ''

      const googleEventId = ev.storageId || ev.id

      // ── Recherche robuste anti-doublon ─────────────────────────────
      // 1. Recherche exacte par google_event_id
      let existing = appointmentRepo.getAppointmentByGoogleEventId(googleEventId)

      // 2. Si l'événement provient d'un calendrier importé (préfixe gcalExternal),
      //    vérifier aussi si un RDV Synoria existe avec l'ID brut (sans préfixe).
      //    Format garanti : 'gcalExternal:encodedCalId:rawEventId'
      //    encodeURIComponent ne contient pas de ':', donc le split est sûr.
      if (!existing && gcalSvc.isExternalGCalEventId(googleEventId)) {
        const afterPrefix = googleEventId.slice('gcalExternal:'.length)
        const colonIdx    = afterPrefix.indexOf(':')
        if (colonIdx !== -1) {
          const rawEventId = afterPrefix.slice(colonIdx + 1)
          existing = appointmentRepo.getAppointmentByGoogleEventId(rawEventId) ?? undefined
        }
      }

      // 3. Filet de sécurité : éviter les doublons même si google_event_id diverge.
      //    Vérifie s'il existe déjà un RDV externe à la même date+heure
      //    (importé depuis GCal sous un autre ID ou format).
      if (!existing && gcalSvc.isExternalGCalEventId(googleEventId)) {
        const sameSlot = appointmentRepo.getAppointmentsByDate(evDate)
          .find(a =>
            gcalSvc.isExternalGCalEventId(a.google_event_id) &&
            a.heure_debut === evHeureD &&
            (a.heure_fin ?? '') === (evHeureF ?? '')
          )
        if (sameSlot) existing = sameSlot
      }

      if (existing) {
        const changed =
          existing.date        !== evDate   ||
          existing.heure_debut !== evHeureD ||
          (existing.heure_fin ?? '') !== (evHeureF ?? '') ||
          (existing.note ?? '')       !== evNote
        if (changed) {
          appointmentRepo.updateAppointment(existing.id, {
            date:        evDate,
            heure_debut: evHeureD,
            heure_fin:   evHeureF,
            note:        evNote || existing.note,
          })
          updated++
        }
      } else {
        appointmentRepo.createAppointment({
          date:            evDate,
          heure_debut:     evHeureD,
          heure_fin:       evHeureF,
          note:            evNote || undefined,
          is_done:         0,
          is_cancelled:    0,
          google_event_id: googleEventId,
        })
        imported++
      }
    }

    const localAppointments = appointmentRepo.getAllAppointments()
      .filter(a => !a.is_cancelled)

    for (const appt of localAppointments) {
      if (gcalSvc.isExternalGCalEventId(appt.google_event_id)) continue

      if (appt.google_event_id) {
        const result = await gcalSvc.updateGCalEvent(appt.google_event_id, appt)
        if (result === 'updated') { updated++; continue }
        if (result === 'error')   { continue } // erreur réseau → skip, ne pas recréer
        // result === 'deleted' → event absent de GCal, on le recrée ci-dessous
      }

      const eventId = await gcalSvc.createGCalEvent(appt)
      if (eventId) {
        appointmentRepo.updateAppointment(appt.id, { google_event_id: eventId })
        exported++
      }
    }

    const localSessions = sessionRepo.getAllSessions()
      .filter(s => !!s.date)

    for (const session of localSessions) {
      const result = await gcalSvc.syncSessionToGCal(session)
      if (result === 'created') sessionsExported++
      else if (result === 'updated') sessionsUpdated++
    }

    return {
      imported,
      updated,
      cleaned,
      exported,
      sessionsExported,
      sessionsUpdated,
      total: events.length + exported + sessionsExported + sessionsUpdated,
    }
  })

  // ── Recherche globale (patients + séances) ───────────────────────
  ipcMain.handle('search:global', (_e, query: string) => {
    const q = query.toLowerCase()
    const patients = patientRepo.getAllPatients()
      .filter(p =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        (p.email  || '').toLowerCase().includes(q) ||
        (p.phone  || '').includes(q)
      ).slice(0, 6).map(p => ({
        type: 'patient' as const,
        id: p.id,
        title: `${p.last_name} ${p.first_name}`,
        subtitle: [p.birth_date ? 'Né(e) le ' + p.birth_date : '', p.phone].filter(Boolean).join(' · '),
      }))

    const patMap = new Map(patientRepo.getAllPatients().map(p => [p.id, p]))
    const sessions = (sessionRepo.getAllSessions() as any[])
      .filter(s =>
        (s.motif             || '').toLowerCase().includes(q) ||
        (s.evolution         || '').toLowerCase().includes(q) ||
        (s.traitement_notes  || '').toLowerCase().includes(q) ||
        (s.diagnostic_mtc    || '').toLowerCase().includes(q) ||
        (s.full_data_json    || '').toLowerCase().includes(q)
      ).slice(0, 6).map(s => {
        const pat = patMap.get(s.patient_id) as any
        return {
          type: 'session' as const,
          id: s.id,
          patientId: s.patient_id,
          title: pat ? `${pat.last_name} ${pat.first_name} — ${s.date}` : s.date,
          subtitle: (s.motif || s.diagnostic_mtc || s.traitement_notes || '').slice(0, 90),
          date: s.date,
        }
      })
    return [...patients, ...sessions]
  })

  // ── Vérification d'intégrité d'une sauvegarde ────────────────────
  ipcMain.handle('backup:verify', async (_e, filePath: string) => {
    try {
      return verifyBackup(filePath)
    } catch (e: any) {
      if (e.message?.startsWith('WRONG_KEY:')) {
        const result = await dialog.showOpenDialog({
          title:   'Sélectionner la clé de chiffrement',
          filters: [{ name: 'Clé', extensions: ['key', '*'] }],
          properties: ['openFile'],
        })
        if (result.canceled || !result.filePaths.length) throw new Error(e.message.replace('WRONG_KEY:', ''))
        return verifyBackup(filePath, result.filePaths[0])
      }
      throw e
    }
  })

  // ── Blocs calendrier ─────────────────────────────────────────────
  ipcMain.handle('blocks:getAll',     ()              => getAllBlocks())
  ipcMain.handle('blocks:byMonth',    (_e, y, m)      => getBlocksByMonth(y, m))
  ipcMain.handle('blocks:create',     (_e, data)      => { licenseSvc.assertNotRestricted(); return createBlock(data) })
  ipcMain.handle('blocks:update',     (_e, id, data)  => { licenseSvc.assertNotRestricted(); return updateBlock(id, data) })
  ipcMain.handle('blocks:delete',     (_e, id)        => { licenseSvc.assertNotRestricted(); return deleteBlock(id) })

  // ── Rapport de diagnostic ─────────────────────────────────────────
  ipcMain.handle('diagnostic:generate',    () => generateDiagnosticReport())
  ipcMain.handle('diagnostic:supportDoc',  () => generateSupportDoc())
  ipcMain.handle('diagnostic:recoveryDoc', () => generateRecoveryDoc())

  // ── Admin ─────────────────────────────────────────────────────────
  ipcMain.handle('admin:verify',        (_e, pwd)  => adminVerify(pwd))
  ipcMain.handle('admin:getLogs',       (_e, n)    => adminGetLogs(n))
  ipcMain.handle('admin:clearLogs',     ()         => adminClearLogs())
  ipcMain.handle('admin:systemInfo',    ()         => adminGetSystemInfo())
  ipcMain.handle('admin:dbIntegrity',   ()         => adminDbIntegrity())
  ipcMain.handle('admin:walCheckpoint', ()         => adminWalCheckpoint())
  ipcMain.handle('admin:dbStats',       ()         => adminDbStats())
  ipcMain.handle('admin:getSettings',   ()         => adminGetSettings())
  ipcMain.handle('admin:forceBackup',   ()         => adminForceBackup())

  // ── Compte Supabase ───────────────────────────────────────────────
  ipcMain.handle('account:signUp',              (_e, email, pwd)  => supabaseAuth.signUp(email, pwd))
  ipcMain.handle('account:signIn',              (_e, email, pwd)  => supabaseAuth.signIn(email, pwd))
  ipcMain.handle('account:signOut',             ()                => supabaseAuth.signOut())
  ipcMain.handle('account:resetPassword',       (_e, email)       => supabaseAuth.resetPassword(email))
  ipcMain.handle('account:resendConfirmation',  (_e, email)       => supabaseAuth.resendConfirmationEmail(email))
  ipcMain.handle('account:getState',       ()                => supabaseAuth.getFullAccountState())
  ipcMain.handle('account:createCheckout', (_e, priceId)     => supabaseAuth.createCheckoutUrl(priceId))
  ipcMain.handle('account:billingPortal',  ()                => supabaseAuth.createBillingPortalUrl())

  // ── Licence locale ────────────────────────────────────────────────

  // État propriétaire permanent : accès illimité pour les comptes listés dans ownerService.
  const OWNER_LICENSE_STATE: import('../services/licenseService').LicenseState = {
    status:         'active',
    mode:           'full',
    organizationId: 'owner',
    licenseId:      'owner',
    deviceId:       null,
    planCode:       'synoria_owner',
    features:       ['read', 'write', 'export', 'backup', 'calendar', 'billing'],
    maxDevices:     99,
    graceUntil:     null,
    tokenExpiry:    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isOffline:      false,
  }

  function getOwnerStateIfApplicable() {
    const user = supabaseAuth.getCurrentUser()
    if (isOwner(user?.email)) {
      licenseSvc.setCachedLicenseState(OWNER_LICENSE_STATE)
      return OWNER_LICENSE_STATE
    }
    return null
  }

  ipcMain.handle('license:getState', () => {
    return getOwnerStateIfApplicable() ?? licenseSvc.getCachedLicenseState()
  })

  ipcMain.handle('license:verifyOnline', async () => {
    const ownerState = getOwnerStateIfApplicable()
    if (ownerState) return ownerState
    const token = supabaseAuth.getAccessToken()
    if (!token) throw new Error('Non connecté — impossible de vérifier la licence en ligne')
    return licenseSvc.verifyLicenseOnline(token)
  })

  ipcMain.handle('license:getDeviceId',    () => licenseSvc.getDeviceIdHash())
  ipcMain.handle('license:getDevices',     () => supabaseAuth.getDevices())
  ipcMain.handle('license:deactivateDevice', (_e, deviceId, reason) => supabaseAuth.deactivateDevice(deviceId, reason))
  ipcMain.handle('license:getRestrictionState',   () => restrictionGuard.getRestrictionState())
  ipcMain.handle('license:getLastCheck',          () => localStore.loadLastSuccessfulCheck())
  ipcMain.handle('license:detectClockRollback',   () => localStore.detectClockRollback())

  // license:refresh = alias de license:verifyOnline (même logique, nom du spec)
  ipcMain.handle('license:refresh', async () => {
    const ownerState = getOwnerStateIfApplicable()
    if (ownerState) return ownerState
    const token = supabaseAuth.getAccessToken()
    if (!token) throw new Error('Non connecté — impossible de rafraîchir la licence en ligne')
    const state = await licenseSvc.verifyLicenseOnline(token)
    licenseSvc.setCachedLicenseState(state)
    return state
  })

  // Désactiver l'appareil courant (UUID issu du jeton JWT, champ duid)
  ipcMain.handle('license:deactivateCurrentDevice', async () => {
    const state = licenseSvc.getCachedLicenseState()
    if (!state.deviceId) throw new Error('Aucun appareil identifié dans le jeton actif')
    const result = await supabaseAuth.deactivateDevice(state.deviceId, 'ancien_appareil')
    // Effacer le jeton local — l'appareil n'est plus actif
    licenseSvc.clearToken()
    licenseSvc.setCachedLicenseState(licenseSvc.getCurrentLicenseState())
    return result
  })

  // ── Mise à jour ───────────────────────────────────────────────────────
  ipcMain.handle('release:check', (_e, currentVersion: string) =>
    supabaseAuth.checkRelease(currentVersion),
  )
  ipcMain.handle('app:checkForUpdates',           () => updateSvc.checkForUpdates())
  ipcMain.handle('update:dismissNotification',    (_e, version: string) => updateSvc.dismissUpdateNotification(version))
  ipcMain.handle('update:getLastNotification',    () => updateSvc.getLastUpdateNotification())

}
