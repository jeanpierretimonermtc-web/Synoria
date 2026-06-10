import { app, BrowserWindow, shell, Menu } from 'electron'
import { join }                             from 'path'
import { existsSync, renameSync }           from 'fs'
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
  const appData    = process.env.APPDATA || ''
  const newPath    = join(appData, 'Synoria')
  const legacyPath = join(appData, 'Dossier Patient MTC')
  if (appData && !existsSync(newPath) && existsSync(legacyPath)) {
    try { renameSync(legacyPath, newPath) } catch {}
  }
  if (appData) app.setPath('userData', newPath)
}

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

// ── Fenêtre principale ─────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Synoria',
    backgroundColor: '#F5F2ED',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
    },
    show: false,
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
  startDailyBackupScheduler()
  startAutoSaveEncrypted()

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
