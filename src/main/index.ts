import { app, BrowserWindow, shell } from 'electron'
import { join }                        from 'path'
import { existsSync, renameSync }      from 'fs'
import { initDatabase, closeDatabase, getDb } from './database/connection'
import { registerAllHandlers }         from './ipc/handlers'
import { getSettings }                 from './services/settingsService'
import { exportBackupEncrypted }       from './services/backupService'
import * as auth                       from './services/authService'

// ── Mode portable / clé USB ────────────────────────────────────────
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
if (portableDir) {
  app.setPath('userData', join(portableDir, 'data'))
} else if (!app.isPackaged) {
  // Dev : définit le chemin manuellement + migration depuis l'ancien nom
  const appData    = process.env.APPDATA || ''
  const newPath    = join(appData, 'Synoria')
  const legacyPath = join(appData, 'Dossier Patient MTC')
  if (appData && !existsSync(newPath) && existsSync(legacyPath)) {
    try { renameSync(legacyPath, newPath) } catch {}
  }
  if (appData) app.setPath('userData', newPath)
}
// En production (isPackaged=true) : Electron utilise productName="Synoria"
// comme chemin userData par défaut → pas besoin de setPath

// ── Instance unique ────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) app.quit()

const iconPath = process.platform === 'darwin'
  ? join(__dirname, '../../build/icons/icon.png')
  : join(__dirname, '../../build/icons/icon.ico')
let win: BrowserWindow | null = null

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
      // Checkpoint WAL avant de lire le fichier
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
    },
    show: false,
  })

  win.once('ready-to-show', () => win?.show())

  // Fallback Mac : si ready-to-show ne se déclenche pas (erreur chargement)
  setTimeout(() => { if (win && !win.isVisible()) win.show() }, 3000)

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[Window] Échec chargement:', code, desc)
    if (win && !win.isVisible()) win.show()
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 1. Sauvegarde automatique des données
  try {
    const settings = getSettings()
    if (settings.autoBackupOnClose) {
      exportBackupEncrypted()
      console.log('[AutoBackup] Sauvegarde à la fermeture effectuée')
    }
  } catch (e) {
    console.error('[AutoBackup] Erreur fermeture:', e)
  }

  // 2. Chiffrement de la base SQLite avant de quitter
  if (auth.hasPassword() && auth.isKeyLoaded()) {
    try {
      closeDatabase()      // checkpoint WAL + fermeture
      auth.encryptDb()     // chiffrer mtc.sqlite → mtc.sqlite.enc
      auth.deleteWorkingDb() // supprimer le fichier de travail déchiffré
      console.log('[Auth] Base de données chiffrée ✓')
    } catch (e) {
      console.error('[Auth] Erreur chiffrement fermeture:', e)
    }
  }

  if (process.platform !== 'darwin') app.quit()
})
