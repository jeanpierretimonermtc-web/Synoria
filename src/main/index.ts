import { app, BrowserWindow, shell, Menu, ipcMain, session, Notification } from 'electron'
import { join }                             from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { initDatabase, closeDatabase, getDb } from './database/connection'
import { registerAllHandlers }              from './ipc/handlers'
import { getSettings }                      from './services/settingsService'
import { exportBackupEncrypted }            from './services/backupService'
import * as auth                            from './services/authService'

// ── Mode portable / clé USB ────────────────────────────────────────
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
if (portableDir) {
  app.setPath('userData', join(portableDir, 'data'))
} else if (!app.isPackaged) {
  const appData = process.env.APPDATA || ''
  if (appData) app.setPath('userData', join(appData, 'Synoria'))
}

// ── Supprime les erreurs de cache GPU Chromium (Windows permissions) ──
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// ── Instance unique ────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) app.quit()

const iconPath = process.platform === 'darwin'
  ? join(__dirname, '../../build/icons/icon.png')
  : join(__dirname, '../../build/icons/icon.ico')
let win: BrowserWindow | null = null

// ── Menu macOS (obligatoire pour activer la saisie clavier) ───────
function buildMacMenu(): void {
  if (process.platform !== 'darwin') return
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        { role: 'about', label: `À propos de ${app.getName()}` },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: `Masquer ${app.getName()}` },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        { type: 'separator' },
        { role: 'quit', label: `Quitter ${app.getName()}` },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo',              label: 'Annuler' },
        { role: 'redo',              label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut',               label: 'Couper' },
        { role: 'copy',              label: 'Copier' },
        { role: 'paste',             label: 'Coller' },
        { role: 'pasteAndMatchStyle',label: 'Coller sans formatage' },
        { role: 'delete',            label: 'Supprimer' },
        { role: 'selectAll',         label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Fenêtre',
      submenu: [
        { role: 'minimize', label: 'Réduire' },
        { role: 'zoom',     label: 'Agrandir' },
        { type: 'separator' },
        { role: 'front',    label: 'Tout ramener au premier plan' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Sauvegarde automatique ─────────────────────────────────────────
function runAutoBackup(force = false): void {
  try {
    const settings = getSettings()
    if (!settings.autoBackupDaily && !force) return
    const today = new Date().toISOString().slice(0, 10)
    const last  = settings.lastAutoBackup
    if (!force && last && last.startsWith(today)) return
    exportBackupEncrypted()
    console.log('[AutoBackup] Sauvegarde automatique effectuée')
  } catch (e) {
    console.error('[AutoBackup] Erreur:', e)
  }
}

function startDailyBackupScheduler(): void {
  runAutoBackup()
  setInterval(() => runAutoBackup(), 60 * 60 * 1000)
}

// ── Auto-sauvegarde chiffrée (toutes les 3 min pendant la session) ─
function startAutoSaveEncrypted(): void {
  setInterval(() => {
    if (!auth.hasPassword() || !auth.isKeyLoaded()) return
    try {
      try { getDb().pragma('wal_checkpoint(TRUNCATE)') } catch {}
      auth.encryptDb()
    } catch { /* DB peut ne pas être prête */ }
  }, 3 * 60 * 1000)
}

// ── Notifications bureau — RDV dans 15 min ────────────────────────
const notifiedIds = new Set<string>()

function checkUpcomingAppointments(): void {
  if (!auth.isKeyLoaded()) return
  try {
    const { getAppointmentsByDate } = require('./database/repositories/appointmentRepository')
    const { getPatientById }        = require('./database/repositories/patientRepository')
    const now     = new Date()
    const today   = now.toISOString().slice(0, 10)
    const appts   = getAppointmentsByDate(today) as any[]
    for (const appt of appts) {
      if (appt.is_done || appt.is_cancelled || notifiedIds.has(appt.id)) continue
      const [h, m]    = (appt.heure_debut as string).split(':').map(Number)
      const apptTime  = new Date(now); apptTime.setHours(h, m, 0, 0)
      const diffMin   = (apptTime.getTime() - now.getTime()) / 60000
      if (diffMin > 0 && diffMin <= 15) {
        notifiedIds.add(appt.id)
        let name = appt.guest_first_name
          ? `${appt.guest_first_name} ${appt.guest_last_name ?? ''}`.trim()
          : 'Patient'
        if (appt.patient_id) {
          try {
            const p = getPatientById(appt.patient_id) as any
            if (p) name = `${p.first_name} ${p.last_name}`
          } catch {}
        }
        new Notification({
          title: `Synoria — RDV dans ${Math.round(diffMin)} min`,
          body:  `${name} à ${appt.heure_debut}${appt.note ? ' · ' + appt.note : ''}`,
          icon:  iconPath,
        }).show()
      }
    }
  } catch { /* DB pas encore ouverte */ }
}

// ── État de la fenêtre (taille + position persistés) ───────────────
interface WindowState {
  x?: number; y?: number; width: number; height: number; maximized: boolean
}

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    const p = getWindowStatePath()
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')) as WindowState
  } catch {}
  return { width: 1440, height: 900, maximized: false }
}

function saveWindowState(w: BrowserWindow): void {
  try {
    const maximized = w.isMaximized()
    const bounds    = maximized ? { width: 1440, height: 900 } : w.getBounds()
    writeFileSync(getWindowStatePath(), JSON.stringify({ ...bounds, maximized }), 'utf8')
  } catch {}
}

// ── Menu contextuel clic droit + correcteur orthographique ─────────
function setupContextMenu(window: BrowserWindow): void {
  const exec = (cmd: string, arg?: string) =>
    window.webContents
      .executeJavaScript(`document.execCommand(${JSON.stringify(cmd)}, false, ${arg ? JSON.stringify(arg) : 'null'})`)
      .catch(() => {})

  window.webContents.on('context-menu', (_e, params) => {
    const { isEditable, selectionText, editFlags, misspelledWord, dictionarySuggestions } = params
    const hasSelection = selectionText.trim().length > 0
    const items: Electron.MenuItemConstructorOptions[] = []

    // ── Suggestions du correcteur orthographique ──
    if (misspelledWord) {
      if (dictionarySuggestions.length > 0) {
        dictionarySuggestions.slice(0, 6).forEach(s => items.push({
          label: s,
          click: () => window.webContents.replaceMisspelling(s),
        }))
      } else {
        items.push({ label: 'Aucune suggestion', enabled: false })
      }
      items.push({ type: 'separator' })
      items.push({
        label: `Ajouter "${misspelledWord}" au dictionnaire`,
        click: () => window.webContents.session.addWordToSpellCheckerDictionary(misspelledWord),
      })
      items.push({ type: 'separator' })
    }

    // ── Actions d'édition ──
    if (isEditable) {
      if (editFlags.canUndo || editFlags.canRedo) {
        items.push({ label: 'Annuler',  role: 'undo', enabled: editFlags.canUndo })
        items.push({ label: 'Rétablir', role: 'redo', enabled: editFlags.canRedo })
        items.push({ type: 'separator' })
      }
      items.push({ label: 'Couper',                role: 'cut',               enabled: editFlags.canCut })
      items.push({ label: 'Copier',                role: 'copy',              enabled: editFlags.canCopy })
      items.push({ label: 'Coller',                role: 'paste',             enabled: editFlags.canPaste })
      items.push({ label: 'Coller sans formatage', role: 'pasteAndMatchStyle', enabled: editFlags.canPaste })
      items.push({ type: 'separator' })
      items.push({ label: 'Tout sélectionner',     role: 'selectAll' })

      // ── Mise en forme → popup flottant dans le renderer ──
      items.push({ type: 'separator' })
      items.push({
        label: 'Mise en forme',
        click: () => window.webContents.send('format:popup', { x: params.x, y: params.y }),
      })
    } else if (hasSelection) {
      items.push({ label: 'Copier', role: 'copy' })
    }

    if (items.length > 0) {
      Menu.buildFromTemplate(items).popup({ window })
    }
  })
}

// ── Zone de survol pour afficher la barre de menu native ──────────
// (géré côté renderer via MenuBarHotspot dans App.tsx)

// ── Fenêtre principale ─────────────────────────────────────────────
function createWindow() {
  const state = loadWindowState()

  win = new BrowserWindow({
    width:     state.width,
    height:    state.height,
    x:         state.x,
    y:         state.y,
    minWidth:  1024,
    minHeight: 700,
    autoHideMenuBar: true,
    title: 'Synoria',
    backgroundColor: '#F5F2ED',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: true,
    },
    show: false,
  })

  if (state.maximized) win.maximize()

  // Persiste la taille/position à chaque fermeture
  win.on('close', () => { if (win) saveWindowState(win) })

  setupContextMenu(win)

  // Zoom Ctrl+/- / Ctrl+0 et impression Ctrl+P
  win.webContents.on('before-input-event', (_e, input) => {
    if ((!input.control && !input.meta) || input.type !== 'keyDown') return
    const wc = win?.webContents
    if (!wc) return
    const z = wc.getZoomFactor()
    if      (input.key === '=' || input.key === '+') wc.setZoomFactor(Math.min(+(z + 0.1).toFixed(1), 2.0))
    else if (input.key === '-')                       wc.setZoomFactor(Math.max(+(z - 0.1).toFixed(1), 0.5))
    else if (input.key === '0')                       wc.setZoomFactor(1.0)
    else if (input.key === 'p' || input.key === 'P') wc.print({ silent: false, printBackground: false, color: false })
  })

  // Sur Mac, focus() est indispensable après show() pour activer la saisie clavier
  win.once('ready-to-show', () => {
    win?.show()
    win?.focus()
  })

  // Fallback : affiche la fenêtre si ready-to-show ne se déclenche pas
  setTimeout(() => {
    if (win && !win.isVisible()) {
      win.show()
      win.focus()
    }
  }, 3000)

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[Window] Échec chargement:', code, desc)
    if (win && !win.isVisible()) {
      win.show()
      win.focus()
    }
  })

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    if (process.env.NODE_ENV === 'development') win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../../dist/index.html'))
  }
}

// ── Cycle de vie Electron ──────────────────────────────────────────
app.whenReady().then(async () => {
  buildMacMenu()

  // Correcteur orthographique en français
  session.defaultSession.setSpellCheckerLanguages(['fr-FR', 'fr'])

  try {
    if (!auth.hasPassword()) {
      initDatabase()
    }
  } catch (e) {
    console.error('[Startup] Erreur initDatabase:', e)
  }

  try {
    registerAllHandlers()
  } catch (e) {
    console.error('[Startup] Erreur registerAllHandlers:', e)
  }

  createWindow()

  ipcMain.handle('win:setMenuBarVisible', (_e, visible: boolean) => {
    win?.setMenuBarVisibility(visible)
  })

  startDailyBackupScheduler()
  startAutoSaveEncrypted()
  setInterval(checkUpcomingAppointments, 60 * 1000)  // vérifie toutes les minutes

  // Mac : clic sur l'icône Dock — affiche la fenêtre si elle est cachée
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (win) {
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })
})

app.on('window-all-closed', () => {
  try {
    const settings = getSettings()
    if (settings.autoBackupOnClose) {
      exportBackupEncrypted()
      console.log('[AutoBackup] Sauvegarde à la fermeture effectuée')
    }
  } catch (e) {
    console.error('[AutoBackup] Erreur fermeture:', e)
  }

  if (auth.hasPassword() && auth.isKeyLoaded()) {
    try {
      closeDatabase()
      auth.encryptDb()
      auth.deleteWorkingDb()
      console.log('[Auth] Base de données chiffrée ✓')
    } catch (e) {
      console.error('[Auth] Erreur chiffrement fermeture:', e)
    }
  }

  if (process.platform !== 'darwin') app.quit()
})
