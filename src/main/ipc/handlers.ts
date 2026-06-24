import { ipcMain, dialog, shell, app } from 'electron'
import { spawn }                         from 'child_process'
import { mkdirSync, writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { join, extname }               from 'path'
import * as patientRepo               from '../database/repositories/patientRepository'

import * as sessionRepo               from '../database/repositories/sessionRepository'
import * as appointmentRepo           from '../database/repositories/appointmentRepository'
import { encryptToFile }              from '../services/encryptionService'
import { getSettings, saveSettings }  from '../services/settingsService'
import { generateInvoice }            from '../services/invoiceService'
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
import { initDatabase, closeDatabase, isDatabaseOpen } from '../database/connection'
import * as auth                      from '../services/authService'
import * as pluginSvc                 from '../services/pluginService'
import * as accessLogRepo             from '../database/repositories/accessLogRepository'
import * as rgpdSvc                   from '../services/rgpdService'
import * as gcalSvc                   from '../services/googleCalendarService'
import { logError }                             from '../services/logService'
import { getAllBlocks, getBlocksByMonth, createBlock, updateBlock, deleteBlock } from '../database/repositories/calendarBlockRepository'
import { generateDiagnosticReport, generateSupportDoc, generateRecoveryDoc } from '../services/diagnosticService'
import { adminVerify, adminGetLogs, adminClearLogs, adminGetSystemInfo, adminDbIntegrity, adminWalCheckpoint, adminDbStats, adminGetSettings, adminForceBackup } from '../services/adminService'

// ── Slug patient (même logique que backupService) ─────────────────
function patientSlug(lastName: string, firstName: string): string {
  const last  = lastName.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const first = (firstName.charAt(0).toUpperCase() + firstName.slice(1))
                  .replace(/[^a-zA-Z0-9]/g, '_')
  return `${last}_${first}`
}

export function registerAllHandlers(): void {

  // ─── APPOINTMENTS (RDV) ────────────────────────────────────────────────────
  ipcMain.handle('appointments:getAll',    ()           => appointmentRepo.getAllAppointments())
  ipcMain.handle('appointments:byDate',    (_e, date)   => appointmentRepo.getAppointmentsByDate(date))
  ipcMain.handle('appointments:byMonth',   (_e, y, m)   => appointmentRepo.getAppointmentsByMonth(y, m))
  ipcMain.handle('appointments:byPatient', (_e, pid)    => appointmentRepo.getAppointmentsByPatient(pid))

  ipcMain.handle('appointments:create', async (_e, data) => {
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
    const appt = appointmentRepo.updateAppointment(id, d)
    if (gcalSvc.isExternalGCalEventId(appt.google_event_id)) return appt
    if (appt.google_event_id) {
      try {
        const ok = await gcalSvc.updateGCalEvent(appt.google_event_id, appt)
        if (!ok) {
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
    const existing = appointmentRepo.getAppointmentById(id)
    appointmentRepo.deleteAppointment(id)
    if (existing?.google_event_id && !gcalSvc.isExternalGCalEventId(existing.google_event_id)) {
      gcalSvc.deleteGCalEvent(existing.google_event_id).catch(e => console.error('[GCal] delete sync:', e))
    }
  })

  // ─── PATIENTS ──────────────────────────────────────────────────────────────
  ipcMain.handle('patients:getAll',    ()           => patientRepo.getAllPatients())
  ipcMain.handle('patients:getById',   (_e, id)     => patientRepo.getPatientById(id))
  ipcMain.handle('patients:create',    (_e, data)   => patientRepo.createPatient(data))
  ipcMain.handle('patients:update',    (_e, id, d)  => patientRepo.updatePatient(id, d))
  ipcMain.handle('patients:delete',    (_e, id)     => patientRepo.deletePatient(id))
  ipcMain.handle('patients:followUp',  (_e, days)   => patientRepo.getPatientsToFollowUp(days))

  // ─── SESSIONS ──────────────────────────────────────────────────────────────
  ipcMain.handle('sessions:getAll',        (_e, pid)    => sessionRepo.getAllSessions(pid))
  ipcMain.handle('sessions:getById',       (_e, id)     => sessionRepo.getSessionById(id))
  ipcMain.handle('sessions:create',        (_e, data)   => sessionRepo.createSession(data))
  ipcMain.handle('sessions:update',        (_e, id, d)  => sessionRepo.updateSession(id, d))
  ipcMain.handle('sessions:delete',        (_e, id)     => sessionRepo.deleteSession(id))
  ipcMain.handle('sessions:duplicate',     (_e, id)     => sessionRepo.duplicateSession(id))
  ipcMain.handle('sessions:byMonth',       (_e, y, m)   => sessionRepo.getSessionsByMonth(y, m))
  ipcMain.handle('sessions:dashboardStats',()           => sessionRepo.getDashboardStats())
  ipcMain.handle('sessions:upcoming',      ()           => sessionRepo.getUpcomingSessions())

  // ─── EXPORTS SESSION (sauvegarde dans le dossier patient configuré) ────────

  /** Export JSON chiffré d'une séance → dossier backup patient */
  ipcMain.handle('exports:sessionJson', (_e, sessionId) => {
    const session = sessionRepo.getSessionById(sessionId)
    if (!session) throw new Error('Session introuvable')
    const patient = session.patient_id ? patientRepo.getPatientById(session.patient_id) : null

    let fd: Record<string, unknown> = {}
    if (session.full_data_json) { try { fd = JSON.parse(session.full_data_json) } catch {} }
    let systemes: unknown = null
    if (session.systemes_json) { try { systemes = JSON.parse(session.systemes_json) } catch {} }
    let energyTests: unknown = null
    if (session.energy_tests_json) { try { energyTests = JSON.parse(session.energy_tests_json) } catch {} }

    const exportData = {
      exportedAt: new Date().toISOString(),
      patient: patient ? {
        id: patient.id,
        nom: `${patient.first_name} ${patient.last_name}`,
        dateNaissance: patient.birth_date,
        telephone: patient.phone,
        email: patient.email,
        medecinTraitant: patient.regular_doctor,
        medicaments: patient.medications,
        antecedents: patient.antecedents,
        alertes: patient.alerts,
        notesGenerales: patient.notes_general,
      } : null,
      seance: {
        id: session.id, date: session.date,
        numeroSeance: (fd.sessionNum as number) || null,
        praticien: session.practitioner,
        motif: session.motif,
        priseDeNotes: (fd.anamnese as string) || null,
        problematiques: session.problematiques || null,
        evolutionTags: session.evolution_tags, evolution: session.evolution,
        // Mode simple enrichi
        simpleContextVie:         (fd.simpleContextVie         as string) || null,
        simpleTraitementsEnCours: (fd.simpleTraitementsEnCours as string) || null,
        simpleObjectifs:          (fd.simpleObjectifs          as string) || null,
        simpleNotesEntretien:     (fd.simpleNotesEntretien     as string) || null,
        observationsCliniques:    session.observation || null,
        langue: { qualites: session.langue, notes: (fd.langueNote as string) || null },
        pouls: { qualitesGlobales: session.pouls, positions: fd.poulsPos || null, notes: (fd.poulsNote as string) || null },
        constitution: session.constitution, typeCorps: session.type_corps,
        teint: session.teint, notesObservation: session.observation,
        questionnaireSystemes: systemes, testsEnergetiques: energyTests,
        diagnosticMTC: session.diagnostic_mtc, cinqElements: session.cinq_elements,
        causes: session.causes, analyse: session.analyse, principes: session.principes,
        pointsAcupuncture: session.points, pointsOreille: session.pts_oreille,
        techniques: session.techniques, plantes: session.plantes,
        reactions: session.reactions, notesTraitement: session.traitement_notes,
        barrageHomeopathique: {
          niveau1: (fd.barrageNiv1 as string) || null, niveau2: (fd.barrageNiv2 as string) || null,
          niveau3: (fd.barrageNiv3 as string) || null, niveau4: (fd.barrageNiv4 as string) || null,
        },
        conseils: session.conseils, planSuivi: session.plan, surveiller: session.surveiller,
        prochainRdv: {
          date:  session.next_session_date || null,
          heure: (fd.nextSessionHeure as string) || null,
          fin:   (fd.nextSessionFin   as string) || null,
          note:  (fd.nextSessionNote  as string) || null,
        },
      },
    }

    // Sauvegarde chiffrée → dossier patient configuré
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
    const filePath = join(outputDir, `${slug}_${date}.json.enc`)
    encryptToFile(JSON.stringify(exportData, null, 2), filePath)
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

  ipcMain.handle('exports:patientReport', async (_e, patientId: string) => {
    const { exportPatientReport } = await import('../services/patientReportService')
    return exportPatientReport(patientId)
  })

  // ─── BACKUP GÉNÉRAL ────────────────────────────────────────────────────────
  ipcMain.handle('exports:backupJson',   ()             => exportBackupEncrypted())
  // Import backup — signale au renderer quel type d'aide est nécessaire
  ipcMain.handle('exports:importJson', async (_e, filePath) => {
    try {
      return importBackupJson(filePath)
    } catch (e: any) {
      if (e.message?.startsWith('V3_NEEDS_PASSWORD:')) return { __needsPassword: true, filePath }
      if (e.message?.startsWith('WRONG_KEY:'))         return { __needsKey: true,      filePath }
      throw e
    }
  })

  ipcMain.handle('exports:importJsonWithPassword', (_e, filePath: string, password: string) => {
    return importBackupJson(filePath, { password })
  })

  // Import avec fichier clé sélectionné par le renderer
  ipcMain.handle('exports:importJsonWithKey', async (_e, filePath: string) => {
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
  ipcMain.handle('invoice:generate', (_e, data)       => generateInvoice(data))
  ipcMain.handle('invoice:update',   (_e, id, data)   => comptaRepo.updateInvoiceLog(id, data))
  ipcMain.handle('invoice:delete',   (_e, id)         => comptaRepo.deleteInvoiceLog(id))
  ipcMain.handle('invoice:markPaid', (_e, id: string, paid: boolean) => {
    const now = new Date().toISOString().slice(0, 10)
    comptaRepo.updateInvoiceLog(id, { is_paid: paid ? 1 : 0, paid_date: paid ? now : undefined } as any)
  })
  ipcMain.handle('invoice:overdue', (_e, thresholdDays: number) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - thresholdDays)
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`
    return comptaRepo.getAllInvoicesLog().filter(
      inv => !inv.is_paid && inv.invoice_date <= cutoffStr
    )
  })

  ipcMain.handle('invoice:sendByEmail', async (_e, invoiceId: string) => {
    const inv = comptaRepo.getInvoiceLogById(invoiceId)
    if (!inv)        throw new Error('Facture introuvable')
    if (!inv.email)  throw new Error('Aucun email renseigné pour cette facture')

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

    const allPats  = patientRepo.getAllPatients()
    const civPat   = allPats.find(p => !!p.email && p.email === inv.email)
    const civility = civPat?.civility || ''

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
    const bodyText = bodyLines.join('\r\n')

    const hasPdf  = !!(inv.file_path && existsSync(inv.file_path))
    const pdfPath = hasPdf ? inv.file_path! : ''

    // ── Tentative 1 : Outlook COM via -EncodedCommand (pas de fichier temp, UTF-16 LE natif) ─
    if (hasPdf) {
      try {
        const subB64   = Buffer.from(subject,    'utf8').toString('base64')
        const bodyB64  = Buffer.from(bodyText,   'utf8').toString('base64')
        const pdfB64   = Buffer.from(pdfPath,    'utf8').toString('base64')
        const emailB64 = Buffer.from(inv.email,  'utf8').toString('base64')
        const fromB64  = Buffer.from(practEmail, 'utf8').toString('base64')

        // PowerShell script construit en tableau puis encodé UTF-16 LE Base64
        // -EncodedCommand : pas de fichier temp, contourne les restrictions ExecutionPolicy
        const ps1Script = [
          `\$email   = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${emailB64}'))`,
          `\$subject = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${subB64}'))`,
          `\$body    = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${bodyB64}'))`,
          `\$pdf     = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${pdfB64}'))`,
          `\$from    = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${fromB64}'))`,
          '\$ol = New-Object -ComObject Outlook.Application',
          '\$m  = \$ol.CreateItem(0)',
          '\$m.To      = \$email',
          '\$m.Subject = \$subject',
          '\$m.Body    = \$body',
          // Attachement avec throw pour que le script échoue si le fichier est inaccessible
          'try { \$null = \$m.Attachments.Add(\$pdf) } catch { throw "Attach: \$_" }',
          // SendUsingAccount : sélectionne le bon compte Outlook par email (pas SentOnBehalfOfName)
          'if (\$from) {',
          '  \$accs = \$ol.Session.Accounts',
          '  for (\$i = 1; \$i -le \$accs.Count; \$i++) {',
          '    if (\$accs.Item(\$i).SmtpAddress -ieq \$from) { \$m.SendUsingAccount = \$accs.Item(\$i); break }',
          '  }',
          '}',
          '\$m.Display()',
        ].join('\r\n')

        // Encode en UTF-16 LE Base64 pour -EncodedCommand
        const encodedCmd = Buffer.from(ps1Script, 'utf16le').toString('base64')

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 20000)
          let   stderr = ''
          const proc  = spawn('powershell', [
            '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCmd,
          ], { windowsHide: true })
          proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
          proc.once('close', (code) => {
            clearTimeout(timer)
            code === 0 ? resolve() : reject(new Error(`PS:${code} ${stderr.slice(0, 400)}`))
          })
          proc.once('error', (err) => { clearTimeout(timer); reject(err) })
        })

        return { pdfAttached: true }
      } catch (e) {
        console.warn('[sendByEmail] Outlook COM:', (e as any)?.message)
      }
    }


        // ── Tentative 2 : Thunderbird CLI (attachment= natif) ────────────────────
    if (hasPdf) {
      const tbPaths = [
        'C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe',
        'C:\\Program Files (x86)\\Mozilla Thunderbird\\thunderbird.exe',
        join(process.env['LOCALAPPDATA'] || '', 'Mozilla Thunderbird', 'thunderbird.exe'),
      ]
      const tbExe = tbPaths.find(p => { try { return existsSync(p) } catch { return false } })
      if (tbExe) {
        try {
          const fileUri = 'file:///' + pdfPath.replace(/\\/g, '/')
          const esc     = (s: string) => s.replace(/'/g, "\\'")
          const parts   = [
            `to='${esc(inv.email)}'`,
            `subject='${esc(subject)}'`,
            `body='${esc(bodyText)}'`,
            `attachment='${fileUri}'`,
            ...(practEmail ? [`from='${esc(practEmail)}'`] : []),
          ]
          spawn(tbExe, ['-compose', parts.join(',')], {
            detached: true, stdio: 'ignore', windowsHide: false,
          }).unref()
          return { pdfAttached: true }
        } catch (e) {
          console.warn('[sendByEmail] Thunderbird CLI:', (e as any)?.message)
        }
      }
    }

    // ── Tentative 3 : mailto: URI (attach= fonctionne avec Outlook MAPI) ─────
    let mailto = `mailto:${encodeURIComponent(inv.email)}`
               + `?subject=${encodeURIComponent(subject)}`
               + `&body=${encodeURIComponent(bodyText)}`
               + (practEmail ? `&from=${encodeURIComponent(practEmail)}` : '')

    if (hasPdf) {
      mailto += `&attach=${inv.file_path}`
    }

    await shell.openExternal(mailto)

    if (hasPdf) {
      shell.showItemInFolder(pdfPath)
    }

    return { pdfAttached: false }
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
  ipcMain.handle('compta:setMonthlyRevenue',    (_e, y, m, tid, nb)       => comptaRepo.setMonthlyRevenue(y, m, tid, nb))
  ipcMain.handle('compta:incrementRevenue',     (_e, y, m, tid)           => comptaRepo.incrementMonthlyRevenue(y, m, tid))
  ipcMain.handle('compta:setUrsafRate',         (_e, y, m, rate)          => comptaRepo.setUrsafRate(y, m, rate))
  ipcMain.handle('compta:setMonthlyVarExpense', (_e, y, m, cat, lbl, amt) => comptaRepo.setMonthlyVarExpense(y, m, cat, lbl, amt))
  ipcMain.handle('compta:getConsultTypes',      ()                        => comptaRepo.getConsultationTypes())
  ipcMain.handle('compta:saveConsultTypes',     (_e, types)               => comptaRepo.saveConsultationTypes(types))
  ipcMain.handle('compta:getExpenseConfig',     ()                        => comptaRepo.getExpenseConfig())
  ipcMain.handle('compta:saveExpenseConfig',    (_e, configs)             => comptaRepo.saveExpenseConfig(configs))
  ipcMain.handle('compta:getInvoicesLog',       (_e, year)                => comptaRepo.getInvoicesLog(year))
  ipcMain.handle('compta:exportExcel',          (_e, year)                => exportComptaExcel(year))

  // ─── PARAMÈTRES ────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get',  ()             => getSettings())
  ipcMain.handle('settings:save', (_e, partial)  => saveSettings(partial))

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
    return true
  })

  ipcMain.handle('auth:lock', () => {
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
  ipcMain.handle('plugin:get',    ()            => pluginSvc.getActivePlugin())
  ipcMain.handle('plugin:set',    (_e, def)     => pluginSvc.setActivePlugin(def))
  ipcMain.handle('plugin:remove', ()            => pluginSvc.removePlugin())
  ipcMain.handle('plugin:import', (_e, path)    => pluginSvc.importPluginFromFile(path))
  // ─────────────────────────────────────────────────────────────────────────

  ipcMain.handle('shell:openPath',      (_e, path)    => shell.openPath(path))

  // Lit un fichier local et retourne un data URL base64 (pour les aperçus dans le renderer)
  ipcMain.handle('fs:readDataUrl', (_e, filePath: string): string | null => {
    if (!filePath || !existsSync(filePath)) return null
    try {
      const ext  = extname(filePath).toLowerCase().slice(1)
      const mime = ext === 'png' ? 'image/png'
                 : ext === 'gif' ? 'image/gif'
                 : ext === 'webp' ? 'image/webp'
                 : ext === 'bmp' ? 'image/bmp'
                 : 'image/jpeg'
      const b64 = readFileSync(filePath).toString('base64')
      return `data:${mime};base64,${b64}`
    } catch { return null }
  })
  ipcMain.handle('app:getVersion',      ()            => app.getVersion())
  ipcMain.handle('app:relaunch',        ()            => { app.relaunch(); app.quit() })
  ipcMain.handle('app:launchInstaller', async (_e, exePath: string) => {
    if (process.platform === 'darwin') {
      // Sur Mac : ouvrir le DMG avec Finder, ne pas quitter l'app
      await shell.openPath(exePath)
      return
    }
    const { spawn } = require('child_process')
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
    setTimeout(() => app.quit(), 500)
  })
  ipcMain.handle('app:dataPath',   ()            => app.getPath('userData'))

  // ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────
  ipcMain.handle('gcal:status',        ()              => gcalSvc.getStatus())
  ipcMain.handle('gcal:connect',       async (_e, cid, csec) => gcalSvc.connect(cid, csec))
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
      appointmentRepo.createAppointment({
        patient_id:  sess.patient_id,
        date:        sess.next_session_date,
        heure_debut: heureD,
        heure_fin:   heureF,
        note:        note,
        is_done:     0,
      })
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
      // On ignore les événements toute la journée (pas d'heure précise)
      const startDT = ev.start?.dateTime
      const endDT   = ev.end?.dateTime
      if (!startDT) continue

      const evDate   = startDT.slice(0, 10)
      const evHeureD = startDT.slice(11, 16)
      const evHeureF = endDT ? endDT.slice(11, 16) : undefined
      const fromExternalCalendar = !!ev.storageId && ev.storageId !== ev.id
      const evNote   = fromExternalCalendar && ev.calendarSummary
        ? `${ev.summary || 'Evenement Google'} (${ev.calendarSummary})`
        : ev.summary || ''

      const googleEventId = ev.storageId || ev.id

      // Anti-doublon : si l'événement a un préfixe gcalExternal (calendrier importé),
      // vérifier aussi si un RDV Synoria existe déjà avec l'ID brut (sans préfixe).
      // Cela évite de dupliquer les RDV créés par Synoria et poussés vers GCal.
      let existing = appointmentRepo.getAppointmentByGoogleEventId(googleEventId)
      if (!existing && gcalSvc.isExternalGCalEventId(googleEventId)) {
        const rawEventId = googleEventId.split(':').slice(2).join(':')
        existing = appointmentRepo.getAppointmentByGoogleEventId(rawEventId) ?? undefined
      }

      if (existing) {
        // Mettre à jour si l'événement GCal a changé
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
        // Créer un nouveau RDV Synoria depuis l'événement GCal
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
        const updatedInGoogle = await gcalSvc.updateGCalEvent(appt.google_event_id, appt)
        if (updatedInGoogle) {
          updated++
          continue
        }
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
  ipcMain.handle('blocks:create',     (_e, data)      => createBlock(data))
  ipcMain.handle('blocks:update',     (_e, id, data)  => updateBlock(id, data))
  ipcMain.handle('blocks:delete',     (_e, id)        => deleteBlock(id))

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

}
