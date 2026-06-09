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

  // ─── PATIENTS ────────────────────────────────────────────────────────────────
  getPatients:      ()        => ipcRenderer.invoke('patients:getAll'),
  getPatientById:   (id)      => ipcRenderer.invoke('patients:getById', id),
  createPatient:    (data)    => ipcRenderer.invoke('patients:create', data),
  updatePatient:    (id, data)=> ipcRenderer.invoke('patients:update', id, data),
  deletePatient:    (id)      => ipcRenderer.invoke('patients:delete', id),

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
  importBackupJson:     (filePath)   => ipcRenderer.invoke('exports:importJson', filePath),
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
  generateInvoice: (data) => ipcRenderer.invoke('invoice:generate', data),

  // ─── COMPTABILITÉ ─────────────────────────────────────────────────────────────
  getComptaYearData:     (year)                       => ipcRenderer.invoke('compta:yearData', year),
  setMonthlyRevenue:     (y, m, tid, nb)              => ipcRenderer.invoke('compta:setMonthlyRevenue', y, m, tid, nb),
  setUrsafRate:          (y, m, rate)                 => ipcRenderer.invoke('compta:setUrsafRate', y, m, rate),
  setMonthlyVarExpense:  (y, m, cat, lbl, amt)        => ipcRenderer.invoke('compta:setMonthlyVarExpense', y, m, cat, lbl, amt),
  getConsultationTypes:  ()                           => ipcRenderer.invoke('compta:getConsultTypes'),
  saveConsultationTypes: (types)                      => ipcRenderer.invoke('compta:saveConsultTypes', types),
  getExpenseConfig:      ()                           => ipcRenderer.invoke('compta:getExpenseConfig'),
  saveExpenseConfig:     (configs)                    => ipcRenderer.invoke('compta:saveExpenseConfig', configs),
  getInvoicesLog:        (year)                       => ipcRenderer.invoke('compta:getInvoicesLog', year),
  exportComptaExcel:     (year)                       => ipcRenderer.invoke('compta:exportExcel', year),

  // ─── PARAMÈTRES ──────────────────────────────────────────────────────────────
  getSettings:  ()        => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings)=> ipcRenderer.invoke('settings:save', settings),

  // ─── FILE DIALOGS ─────────────────────────────────────────────────────────────
  showSaveDialog: (opts)  => ipcRenderer.invoke('dialog:save', opts),
  showOpenDialog: (opts)  => ipcRenderer.invoke('dialog:open', opts),
  openPath:       (path)  => ipcRenderer.invoke('shell:openPath', path),
  getAppVersion:  ()      => ipcRenderer.invoke('app:getVersion'),
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
  getDataPath:    ()      => ipcRenderer.invoke('app:dataPath'),
  // Google Calendar
  gcalStatus:        ()              => ipcRenderer.invoke('gcal:status'),
  gcalConnect:       (cid, csec)     => ipcRenderer.invoke('gcal:connect', cid, csec),
  gcalDisconnect:    ()              => ipcRenderer.invoke('gcal:disconnect'),
  gcalListCalendars: ()              => ipcRenderer.invoke('gcal:listCalendars'),
  gcalSetCalendar:   (id, name)      => ipcRenderer.invoke('gcal:setCalendar', id, name),
}

contextBridge.exposeInMainWorld('mtcApi', api)
