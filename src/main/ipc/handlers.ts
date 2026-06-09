import { ipcMain, dialog, shell, app } from 'electron'
import { mkdirSync, writeFileSync }   from 'fs'
import { join }                        from 'path'
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
} from '../services/backupService'
import { exportSessionExcel }         from '../services/exportService'
import { initDatabase, closeDatabase, isDatabaseOpen } from '../database/connection'
import * as auth                      from '../services/authService'
import * as pluginSvc                 from '../services/pluginService'
import * as accessLogRepo             from '../database/repositories/accessLogRepository'
import * as rgpdSvc                   from '../services/rgpdService'
import * as gcalSvc                   from '../services/googleCalendarService'

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
    // Sync Google Calendar en arrière-plan (erreurs silencieuses)
    gcalSvc.createGCalEvent(appt).then(eventId => {
      if (eventId) appointmentRepo.updateAppointment(appt.id, { google_event_id: eventId })
    }).catch(e => console.error('[GCal] create sync:', e))
    return appt
  })

  ipcMain.handle('appointments:update', async (_e, id, d) => {
    const appt = appointmentRepo.updateAppointment(id, d)
    if (appt.google_event_id) {
      gcalSvc.updateGCalEvent(appt.google_event_id, appt).catch(e => console.error('[GCal] update sync:', e))
    }
    return appt
  })

  ipcMain.handle('appointments:delete', async (_e, id) => {
    const existing = appointmentRepo.getAppointmentById(id)
    appointmentRepo.deleteAppointment(id)
    if (existing?.google_event_id) {
      gcalSvc.deleteGCalEvent(existing.google_event_id).catch(e => console.error('[GCal] delete sync:', e))
    }
  })

  // ─── PATIENTS ──────────────────────────────────────────────────────────────
  ipcMain.handle('patients:getAll',  ()           => patientRepo.getAllPatients())
  ipcMain.handle('patients:getById', (_e, id)     => patientRepo.getPatientById(id))
  ipcMain.handle('patients:create',  (_e, data)   => patientRepo.createPatient(data))
  ipcMain.handle('patients:update',  (_e, id, d)  => patientRepo.updatePatient(id, d))
  ipcMain.handle('patients:delete',  (_e, id)     => patientRepo.deletePatient(id))

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
        motif: session.motif, evolutionTags: session.evolution_tags, evolution: session.evolution,
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
        prochainRdv: session.next_session_date,
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

  // ─── BACKUP GÉNÉRAL ────────────────────────────────────────────────────────
  ipcMain.handle('exports:backupJson',   ()             => exportBackupEncrypted())
  ipcMain.handle('exports:importJson',   (_e, filePath) => importBackupJson(filePath))
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
  ipcMain.handle('invoice:generate', (_e, data) => generateInvoice(data))

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
      return { ok: true }
    } catch (e: any) {
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
  ipcMain.handle('app:getVersion',      ()            => app.getVersion())
  ipcMain.handle('app:launchInstaller', async (_e, exePath: string) => {
    const { spawn } = require('child_process')
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
    setTimeout(() => app.quit(), 500)
  })
  ipcMain.handle('app:dataPath',   ()            => app.getPath('userData'))

  // ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────
  ipcMain.handle('gcal:status',        ()              => gcalSvc.getStatus())
  ipcMain.handle('gcal:connect',       async (_e, cid, csec) => gcalSvc.connect(cid, csec))
  ipcMain.handle('gcal:disconnect',    ()              => gcalSvc.disconnect())
  ipcMain.handle('gcal:listCalendars', async ()        => gcalSvc.listCalendars())
  ipcMain.handle('gcal:setCalendar',   (_e, id, name) => gcalSvc.setCalendar(id, name))
}
