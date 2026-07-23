import { app, BrowserWindow, shell, Menu, ipcMain, session, Notification } from 'electron'
import { join }                             from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { initDatabase, closeDatabase, getDb } from './database/connection'
import { registerAllHandlers }              from './ipc/handlers'
import { getSettings }                      from './services/settingsService'
import { exportBackupEncrypted }            from './services/backupService'
import * as auth                            from './services/authService'
import { seedDevDataIfEmpty }               from './database/seedDevData'
import { checkJ1Reminders, checkUpcomingAppointments } from './services/notificationService'
import { initSupabaseAuth, getAccessToken, getCurrentUser } from './services/supabaseAuthService'
import { verifyLicenseOnline, getCurrentLicenseState, setCachedLicenseState } from './services/licenseService'
import { isOwner } from './services/ownerService'
import { startUpdateCheckScheduler } from './services/updateService'

if (!app.isPackaged) {
  // MODE DÉVELOPPEMENT : dossier dédié pour ne jamais toucher les données du cabinet
  // Sur macOS, use `app.getPath('appData')` si APPDATA n'est pas défini.
  const appData = process.env.APPDATA || app.getPath('appData') || ''
  if (appData) app.setPath('userData', join(appData, 'Synoria Dev'))
} else {
  // MODE PRODUCTION : s'assurer que le userData pointe vers le bon dossier
  // et migrer automatiquement si les données sont dans un ancien chemin
  migrateUserDataIfNeeded()
}

/**
 * Migration automatique : si le dossier userData actuel est vide mais qu'un
 * autre chemin connu contient des données Synoria, on le réutilise.
 * Fonctionne sur Windows ET Mac.
 */
function migrateUserDataIfNeeded(): void {
  const { existsSync, cpSync } = require('fs')

  // app.getPath('appData') fonctionne sur tous les OS :
  //   Windows → C:\Users\...\AppData\Roaming
  //   Mac     → ~/Library/Application Support
  //   Linux   → ~/.config
  const appData    = app.getPath('appData')
  const currentPath = app.getPath('userData')
  const authInCurrent = join(currentPath, 'auth.json')

  // Si auth.json existe déjà → pas de migration nécessaire
  if (existsSync(authInCurrent)) return

  // Chemins alternatifs connus — inclut 'Synoria Dev' (anciens builds Mac défectueux)
  const candidates = [
    join(appData, app.getName()),
    join(appData, 'Synoria'),
    join(appData, 'Synoria Dev'),        // anciens builds Mac avec mauvais productName
    join(appData, 'Dossier Patient MTC'), // très ancienne version
    join(appData, 'synoria'),
  ].filter(p => p !== currentPath)

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'auth.json'))) {
      console.log(`[Migration] Données trouvées dans ${candidate}`)
      console.log(`[Migration] → Migration vers ${currentPath}`)
      // Copie vers un dossier temporaire d'abord pour éviter la corruption
      // si la copie échoue en cours de route (disque plein, droits insuffisants).
      const { rmSync, renameSync } = require('fs')
      const tmpPath = currentPath + '_migration_tmp'
      try {
        if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true, force: true })
        cpSync(candidate, tmpPath, { recursive: true, force: true })
        // Copie complète → remplacer currentPath de manière quasi-atomique
        if (existsSync(currentPath)) rmSync(currentPath, { recursive: true, force: true })
        renameSync(tmpPath, currentPath)
        console.log('[Migration] ✓ Terminée — redémarrage recommandé')
      } catch (e) {
        console.error('[Migration] Erreur :', e)
        try { if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true, force: true }) } catch {}
      }
      break
    }
  }
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
let nativeMenuVisible = false

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

// ── Vérification périodique de licence (toutes les 24h) ───────────
function startLicenseVerificationScheduler(): void {
  // Charger l'état depuis le jeton local au démarrage
  const localState = getCurrentLicenseState()
  setCachedLicenseState(localState)

  // Vérifier en ligne au démarrage (best-effort — ne bloque pas l'app)
  const tryOnlineVerify = async () => {
    const token = getAccessToken()
    if (!token) return
    try {
      const state = await verifyLicenseOnline(token)
      setCachedLicenseState(state)
    } catch (e) {
      console.warn('[License] Vérification en ligne échouée (mode hors-ligne) :', e)
    }
  }

  // Délai de 5s au démarrage pour laisser le réseau s'initialiser
  setTimeout(tryOnlineVerify, 5000)

  // Puis toutes les 24h
  setInterval(tryOnlineVerify, 24 * 60 * 60 * 1000)
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

// ── Notifications (voir services/notificationService.ts) ────────────

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
    autoHideMenuBar: false,
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
  win.setMenuBarVisibility(false)

  // Persiste la taille/position à chaque fermeture
  win.on('close', () => { if (win) saveWindowState(win) })

  setupContextMenu(win)

  // Raccourcis fenêtre : menu admin, zoom et impression
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.control && input.alt && input.shift && input.key.toLowerCase() === 'm') {
      e.preventDefault()
      nativeMenuVisible = !nativeMenuVisible
      win?.setMenuBarVisibility(nativeMenuVisible)
      return
    }
    if ((!input.control && !input.meta)) return
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

  // Permission microphone pour la dictée vocale (Web Speech API)
  // Web Speech API demande 'media' (pas 'microphone') — les deux sont couverts ici.
  const allowedPerms = new Set(['media', 'microphone'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowedPerms.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return allowedPerms.has(permission)
  })

  // Initialiser l'auth Supabase (restaure la session précédente si elle existe)
  try {
    await initSupabaseAuth()
  } catch (e) {
    console.warn('[Supabase] Erreur init auth :', e)
  }

  // Bypass propriétaire : si le compte connecté est owner, activer la licence immédiatement.
  // Ceci s'exécute avant registerAllHandlers() et createWindow() — aucun risque de race condition.
  try {
    const user = getCurrentUser()
    if (isOwner(user?.email)) {
      setCachedLicenseState({
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
      })
      console.log('[Startup] Bypass propriétaire activé pour', user?.email)
    }
  } catch (e) {
    console.warn('[Startup] Erreur bypass propriétaire :', e)
  }

  try {
    if (!auth.hasPassword()) {
      initDatabase()
      // En mode dev, peupler la base avec des données de test si elle est vide.
      // Ignoré si dev.skip-seed existe (créé par `npm run dev:fresh` pour simuler un nouvel utilisateur).
      if (!app.isPackaged) {
        const skipSeedPath = join(app.getPath('userData'), 'dev.skip-seed')
        if (existsSync(skipSeedPath)) {
          unlinkSync(skipSeedPath)
          console.log('[DEV] dev.skip-seed trouvé — seeder désactivé pour ce démarrage.')
        } else {
          try { seedDevDataIfEmpty() } catch (e) { console.error('[DEV] Erreur seed:', e) }
        }
      }
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
    nativeMenuVisible = visible
    win?.setMenuBarVisibility(visible)
  })

  startDailyBackupScheduler()
  startAutoSaveEncrypted()
  startLicenseVerificationScheduler()
  startUpdateCheckScheduler()
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
