import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  // ─── APPOINTMENTS (RDV) ──────────────────────────────────────────────────────
  getAppointments:          ()           => ipcRenderer.invoke('appointments:getAll'),
  getAppointmentsByDate:    (date)       => ipcRenderer.invoke('appointments:byDate', date),
  getAppointmentsByMonth:   (year, month)=> ipcRenderer.invoke('appointments:byMonth', year, month),
  getAppointmentsByPatient: (pid)        => ipcRenderer.invoke('appointments:byPatient', pid),
  createAppointment:        (data)       => ipcRenderer.invoke('appointments:create', data),
  updateAppointment:        (id, data)   => ipcRenderer.invoke('appointments:update', id, data),
  deleteAppointment:        (id)         => ipcRenderer.invoke('appointments:delete', id),
  sendAppointmentReminder:  (id)         => ipcRenderer.invoke('appointments:sendReminder', id),

  // ─── PATIENTS ────────────────────────────────────────────────────────────────
  getPatients:            ()        => ipcRenderer.invoke('patients:getAll'),
  getPatientById:         (id)      => ipcRenderer.invoke('patients:getById', id),
  createPatient:          (data)    => ipcRenderer.invoke('patients:create', data),
  updatePatient:          (id, data)=> ipcRenderer.invoke('patients:update', id, data),
  deletePatient:          (id)      => ipcRenderer.invoke('patients:delete', id),
  getPatientsToFollowUp:  (days)    => ipcRenderer.invoke('patients:followUp', days),

  // ─── SESSIONS ────────────────────────────────────────────────────────────────
  getSessions:          (patientId) => ipcRenderer.invoke('sessions:getAll', patientId),
  getSessionById:       (id)        => ipcRenderer.invoke('sessions:getById', id),
  createSession:        (data)      => ipcRenderer.invoke('sessions:create', data),
  updateSession:        (id, data)  => ipcRenderer.invoke('sessions:update', id, data),
  deleteSession:        (id)        => ipcRenderer.invoke('sessions:delete', id),
  duplicateSession:     (id)        => ipcRenderer.invoke('sessions:duplicate', id),
  getSessionsByMonth:   (year, month)=> ipcRenderer.invoke('sessions:byMonth', year, month),
  getDashboardStats:    ()          => ipcRenderer.invoke('sessions:dashboardStats'),
  getUpcomingSessions:  ()          => ipcRenderer.invoke('sessions:upcoming'),

  // ─── EXPORTS & BACKUP ────────────────────────────────────────────────────────
  exportBackupJson:     ()           => ipcRenderer.invoke('exports:backupJson'),
  importBackupJson:           (filePath)            => ipcRenderer.invoke('exports:importJson', filePath),
  importBackupJsonWithPassword: (filePath, password) => ipcRenderer.invoke('exports:importJsonWithPassword', filePath, password),
  exportEncryptionKey:        ()                    => ipcRenderer.invoke('exports:exportEncryptionKey'),
  exportSessionJson:    (sessionId)  => ipcRenderer.invoke('exports:sessionJson', sessionId),
  exportSessionExcel:   (sessionId)  => ipcRenderer.invoke('exports:sessionExcel', sessionId),
  exportSessionPdf:     (sessionId)  => ipcRenderer.invoke('exports:sessionPdf', sessionId),
  exportPatientExcel:   (patientId, sessionId) => ipcRenderer.invoke('exports:patientExcel', patientId, sessionId),

  // ─── BACKUP (nouveaux) ───────────────────────────────────────────────────────
  getBackupInfo:        ()           => ipcRenderer.invoke('backup:info'),
  exportGeneralBackup:  ()           => ipcRenderer.invoke('backup:exportGeneral'),
  exportPatientBackup:  (patientId)  => ipcRenderer.invoke('backup:exportPatient', patientId),
  openBackupFolder:     (type)       => ipcRenderer.invoke('backup:openFolder', type),

  // ─── FACTURATION ─────────────────────────────────────────────────────────────
  generateInvoice:     (data)       => ipcRenderer.invoke('invoice:generate', data),
  updateInvoiceLog:    (id, data)   => ipcRenderer.invoke('invoice:update', id, data),
  deleteInvoiceLog:    (id)         => ipcRenderer.invoke('invoice:delete', id),
  sendInvoiceByEmail:  (id)         => ipcRenderer.invoke('invoice:sendByEmail', id),

  // ─── COMPTABILITÉ ─────────────────────────────────────────────────────────────
  getComptaYearData:     (year)                       => ipcRenderer.invoke('compta:yearData', year),
  setMonthlyRevenue:     (y, m, tid, nb)              => ipcRenderer.invoke('compta:setMonthlyRevenue', y, m, tid, nb),
  incrementMonthlyRevenue: (y, m, tid)               => ipcRenderer.invoke('compta:incrementRevenue', y, m, tid),
  setUrsafRate:          (y, m, rate)                 => ipcRenderer.invoke('compta:setUrsafRate', y, m, rate),
  setMonthlyVarExpense:  (y, m, cat, lbl, amt)        => ipcRenderer.invoke('compta:setMonthlyVarExpense', y, m, cat, lbl, amt),
  getConsultationTypes:  ()                           => ipcRenderer.invoke('compta:getConsultTypes'),
  saveConsultationTypes: (types)                      => ipcRenderer.invoke('compta:saveConsultTypes', types),
  getExpenseConfig:      ()                           => ipcRenderer.invoke('compta:getExpenseConfig'),
  saveExpenseConfig:     (configs)                    => ipcRenderer.invoke('compta:saveExpenseConfig', configs),
  getInvoicesLog:        (year)                       => ipcRenderer.invoke('compta:getInvoicesLog', year),
  exportComptaExcel:     (year)                       => ipcRenderer.invoke('compta:exportExcel', year),

  // ─── PARAMÈTRES ──────────────────────────────────────────────────────────────
  getSettings:     ()      => ipcRenderer.invoke('settings:get'),
  saveSettings:    (s)     => ipcRenderer.invoke('settings:save', s),
  readFileDataUrl: (path)  => ipcRenderer.invoke('fs:readDataUrl', path),

  // ─── FILE DIALOGS ─────────────────────────────────────────────────────────────
  showSaveDialog: (opts)  => ipcRenderer.invoke('dialog:save', opts),
  showOpenDialog: (opts)  => ipcRenderer.invoke('dialog:open', opts),
  openPath:       (path)  => ipcRenderer.invoke('shell:openPath', path),
  getAppVersion:  ()      => ipcRenderer.invoke('app:getVersion'),
  relaunchApp:    ()      => ipcRenderer.invoke('app:relaunch'),
  launchInstaller:(path)  => ipcRenderer.invoke('app:launchInstaller', path),
  // Auth
  authStatus:          ()             => ipcRenderer.invoke('auth:status'),
  authSetup:           (pwd)          => ipcRenderer.invoke('auth:setup', pwd),
  authLogin:           (pwd)          => ipcRenderer.invoke('auth:login', pwd),
  authLock:            ()             => ipcRenderer.invoke('auth:lock'),
  authChangePassword:  (old, nw)      => ipcRenderer.invoke('auth:changePassword', old, nw),
  // RGPD
  logAccess:                (pid, action, detail) => ipcRenderer.invoke('rgpd:logAccess', pid, action, detail),
  getAccessLog:             (pid, limit)          => ipcRenderer.invoke('rgpd:getAccessLog', pid, limit),
  getRgpdAlerts:            ()                    => ipcRenderer.invoke('rgpd:getAlerts'),
  exportTraitementRegister: ()                    => ipcRenderer.invoke('rgpd:exportRegister'),
  // Plugin
  pluginGet:    ()       => ipcRenderer.invoke('plugin:get'),
  pluginSet:    (def)    => ipcRenderer.invoke('plugin:set', def),
  pluginRemove: ()       => ipcRenderer.invoke('plugin:remove'),
  pluginImport: (path)   => ipcRenderer.invoke('plugin:import', path),
  getDataPath:       ()          => ipcRenderer.invoke('app:dataPath'),
  setMenuBarVisible: (v: boolean)=> ipcRenderer.invoke('win:setMenuBarVisible', v),
  onFormatPopup: (cb: (pos: { x: number; y: number }) => void) => {
    ipcRenderer.on('format:popup', (_e, pos) => cb(pos))
  },
  searchGlobal:   (q)           => ipcRenderer.invoke('search:global', q),
  verifyBackup:   (path)        => ipcRenderer.invoke('backup:verify', path),
  // Google Calendar
  gcalStatus:        ()              => ipcRenderer.invoke('gcal:status'),
  gcalConnect:       (cid, csec)     => ipcRenderer.invoke('gcal:connect', cid, csec),
  gcalDisconnect:    ()              => ipcRenderer.invoke('gcal:disconnect'),
  gcalListCalendars: ()              => ipcRenderer.invoke('gcal:listCalendars'),
  gcalSetCalendar:   (id, name)      => ipcRenderer.invoke('gcal:setCalendar', id, name),
  gcalSetImportCalendars: (calendars) => ipcRenderer.invoke('gcal:setImportCalendars', calendars),
  gcalCleanupOldImportedAppointments: () => ipcRenderer.invoke('gcal:cleanupOldImportedAppointments'),
  gcalSync:                    (start, end) => ipcRenderer.invoke('gcal:sync', start, end),
  appointmentsBackfillFromSessions: ()         => ipcRenderer.invoke('appointments:backfillFromSessions'),
  // Diagnostic
  generateDiagnosticReport: () => ipcRenderer.invoke('diagnostic:generate'),
  generateSupportDoc:       () => ipcRenderer.invoke('diagnostic:supportDoc'),
  generateRecoveryDoc:      () => ipcRenderer.invoke('diagnostic:recoveryDoc'),
  // Blocs calendrier
  getCalendarBlocks:        ()          => ipcRenderer.invoke('blocks:getAll'),
  getCalendarBlocksByMonth: (y, m)      => ipcRenderer.invoke('blocks:byMonth', y, m),
  createCalendarBlock:      (data)      => ipcRenderer.invoke('blocks:create', data),
  updateCalendarBlock:      (id, data)  => ipcRenderer.invoke('blocks:update', id, data),
  deleteCalendarBlock:      (id)        => ipcRenderer.invoke('blocks:delete', id),
  // Admin
  adminVerify:        (password: string) => ipcRenderer.invoke('admin:verify', password),
  adminGetLogs:       (n?: number)       => ipcRenderer.invoke('admin:getLogs', n),
  adminClearLogs:     ()                 => ipcRenderer.invoke('admin:clearLogs'),
  adminGetSystemInfo: ()                 => ipcRenderer.invoke('admin:systemInfo'),
  adminDbIntegrity:   ()                 => ipcRenderer.invoke('admin:dbIntegrity'),
  adminWalCheckpoint: ()                 => ipcRenderer.invoke('admin:walCheckpoint'),
  adminDbStats:       ()                 => ipcRenderer.invoke('admin:dbStats'),
  adminGetSettings:   ()                 => ipcRenderer.invoke('admin:getSettings'),
  adminForceBackup:   ()                 => ipcRenderer.invoke('admin:forceBackup'),
}

contextBridge.exposeInMainWorld('mtcApi', api)
