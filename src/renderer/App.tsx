import React, { useState, useEffect, useCallback, useRef, Component } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { SaveIcon, FolderIcon, LockIcon as LockIco, DashboardIcon, UsersIcon, PlusCircle, ClipboardIcon, CalendarIcon, BarChartIcon, TrendDownIcon, FileTextIcon, ShieldIcon, SettingsIcon, UserIcon } from './components/common/Icon'
import DashboardPage from './pages/DashboardPage'
import PatientsPage from './pages/PatientsPage'
import NewSessionPage from './pages/NewSessionPage'
import SeancesPage from './pages/SeancesPage'
import SummaryPage from './pages/SummaryPage'   // gardé pour les redirects
import CalendarPage from './pages/CalendarPage'
import { Toast } from './components/common/Toast'
import { useToast } from './hooks/useToast'
import SplashScreen from './components/common/SplashScreen'
import LockScreen from './pages/LockScreen'
import SettingsPage      from './pages/SettingsPage'
import RgpdPage          from './pages/RgpdPage'
import ComptaPage        from './pages/ComptaPage'
import DepensesPage      from './pages/DepensesPage'
import FacturesListPage  from './pages/FacturesListPage'
import ProfilePage       from './pages/ProfilePage'
import { useInactivityLock } from './hooks/useInactivityLock'
import GlobalSearch from './components/common/GlobalSearch'
import AdminPanel from './components/admin/AdminPanel'

export const ToastContext = React.createContext<(msg: string, type?: 'success' | 'error') => void>(() => {})

type AuthState = 'splash' | 'checking' | 'setup' | 'locked' | 'unlocked'

export default function App() {
  const { toast, showToast } = useToast()
  const [authState, setAuthState] = useState<AuthState>('splash')
  const navigate = useNavigate()

  // Lecture synchrone depuis localStorage → pas de flash au premier rendu
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('synoria-theme') as 'light' | 'dark') || 'light'
  )

  // ── Chargement et application du thème ──
  useEffect(() => {
    // Sync depuis les settings (source de vérité persistante côté Electron)
    window.mtcApi.getSettings().then(s => {
      const t = s.theme === 'dark' ? 'dark' : 'light'
      setTheme(t)
      localStorage.setItem('synoria-theme', t)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('synoria-theme', next)
    window.mtcApi.saveSettings({ theme: next }).catch(() => {})
  }

  const [searchOpen, setSearchOpen]   = useState(false)
  const [adminOpen, setAdminOpen]     = useState(false)

  // ── Ctrl+Shift+Alt+A → panneau admin ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        setAdminOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Ctrl+K → recherche globale ──
  useEffect(() => {
    if (authState !== 'unlocked') return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authState])

  // ── Raccourcis clavier de navigation ──
  useEffect(() => {
    if (authState !== 'unlocked') return
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const target = e.target as HTMLElement
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      const routes: Record<string, string> = {
        '1': '/', '2': '/patients', '3': '/nouvelle',
        '4': '/calendrier', '5': '/comptabilite', '6': '/parametres', '7': '/rgpd',
      }
      if (routes[e.key]) { e.preventDefault(); navigate(routes[e.key]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authState, navigate])

  // Verrou automatique après 20 min d'inactivité
  const handleInactivityLock = useCallback(async () => {
    await window.mtcApi.authLock()
    setAuthState('locked')
  }, [])
  useInactivityLock(handleInactivityLock, authState === 'unlocked')

  // Vérifie le statut auth après le splash
  const checkAuth = async () => {
    setAuthState('checking')
    try {
      const { hasPassword, isUnlocked } = await window.mtcApi.authStatus()
      if (!hasPassword) setAuthState('setup')
      else if (isUnlocked) setAuthState('unlocked')
      else setAuthState('locked')
    } catch {
      setAuthState('unlocked')  // fallback si l'IPC échoue (dev sans auth)
    }
  }

  if (authState === 'splash') {
    return <SplashScreen onDone={checkAuth} theme={theme} />
  }

  if (authState === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F5F2ED' }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    )
  }

  if (authState === 'setup' || authState === 'locked') {
    return <LockScreen mode={authState} onUnlock={() => setAuthState('unlocked')} theme={theme} />
  }

  const handleLock = async () => {
    await window.mtcApi.authLock()
    setAuthState('locked')
  }

  return (
    <ToastContext.Provider value={showToast}>
      <FormattingPopup />
      <MenuBarHotspot />
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} theme={theme} />}
      <div className="app-shell">

        {/* ── HEADER compact ── */}
        <header className="app-header">
          <div className="logo">
            <img src="./Synoria.png" alt="Logo" className="logo-img" />
            <img src="./Text Synoria fond blanc.png" alt="SYNORIA" className="logo-title-img" />
            <span title="Données chiffrées AES-256" className="logo-secure">🔒 chiffré</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
            <BackupButton showToast={showToast} />
          </div>
        </header>

        {/* ── CORPS = sidebar + contenu ── */}
        <div className="app-body">

          {/* ── SIDEBAR ── */}
          <aside className="app-sidebar">
            <nav className="sidebar-nav">

              {/* Groupe principal */}
              <NavLink to="/" end className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#5B8CF7' }}><DashboardIcon size={14} /></span>
                Tableau de bord
              </NavLink>
              <NavLink to="/patients" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#30D158' }}><UsersIcon size={14} /></span>
                Patients
              </NavLink>
              <NavLink to="/nouvelle" className={({ isActive }) => `sidebar-item new-session${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#4A6741' }}><PlusCircle size={14} /></span>
                Nouvelle séance
              </NavLink>

              {/* Planning */}
              <div className="sidebar-section-label">Planning</div>
              <NavLink to="/seances" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#BF5AF2' }}><ClipboardIcon size={14} /></span>
                Séances
              </NavLink>
              <NavLink to="/calendrier" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#FF453A' }}><CalendarIcon size={14} /></span>
                Calendrier
              </NavLink>

              {/* Finances */}
              <div className="sidebar-section-label">Finances</div>
              <NavLink to="/comptabilite" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#32ADE6' }}><BarChartIcon size={14} /></span>
                Comptabilité
              </NavLink>
              <NavLink to="/depenses" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#FF9F0A' }}><TrendDownIcon size={14} /></span>
                Dépenses
              </NavLink>
              <NavLink to="/factures-liste" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#0A84FF' }}><FileTextIcon size={14} /></span>
                Factures
              </NavLink>

              {/* Administration */}
              <div className="sidebar-section-label">Administration</div>
              <NavLink to="/rgpd" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#6E6CD8' }}><ShieldIcon size={14} /></span>
                RGPD
              </NavLink>
              <NavLink to="/parametres" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#8E8E93' }}><SettingsIcon size={14} /></span>
                Paramètres
              </NavLink>

            </nav>

            {/* Boutons bas de sidebar */}
            <div className="sidebar-bottom">
              <NavLink to="/profil" className={({ isActive }) => `sidebar-profile-btn${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#2A7A6A' }}>
                  <UserIcon size={14} />
                </span>
                Mon profil
              </NavLink>
              <button className="sidebar-lock-btn" onClick={handleLock}>
                <span className="sidebar-icon" style={{ background: '#8A2A4A' }}>
                  <LockIco size={14} />
                </span>
                Verrouiller
              </button>
            </div>
          </aside>

          {/* ── CONTENU ── */}
          <div className="app-content">
            <FormattingToolbar />
            <main className="app-main">
              <PageErrorBoundary>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/nouvelle" element={<NewSessionPage />} />
                <Route path="/nouvelle/:patientId" element={<NewSessionPage />} />
                <Route path="/modifier/:sessionId" element={<NewSessionPage />} />
                <Route path="/seances"             element={<SeancesPage />} />
                <Route path="/seances/:sessionId"  element={<SeancesPage />} />
                <Route path="/historique"          element={<SeancesPage />} />
                <Route path="/resume"              element={<SeancesPage />} />
                <Route path="/resume/:sessionId"   element={<SeancesPage />} />
                <Route path="/calendrier"          element={<CalendarPage />} />
                <Route path="/comptabilite"        element={<ComptaPage />} />
                <Route path="/depenses"            element={<DepensesPage />} />
                <Route path="/factures-liste"      element={<FacturesListPage />} />
                <Route path="/parametres"          element={<SettingsPage />} />
                <Route path="/rgpd"                element={<RgpdPage />} />
                <Route path="/profil"              element={<ProfilePage />} />
              </Routes>
              </PageErrorBoundary>
            </main>
          </div>

        </div>{/* fin app-body */}

        {toast && <Toast message={toast.message} type={toast.type} />}
        <ConfirmDialog />
      </div>
    </ToastContext.Provider>
  )
}

/* SvgIcon inline conservé pour les cas ponctuels dans ce fichier */
function SvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}

/* ─── BARRE DE FORMATAGE GLOBALE ──────────────────────────────────────── */

const FMT_COLORS = [
  { label: 'Rouge',  value: '#A83232' },
  { label: 'Bleu',   value: '#2A5A8A' },
  { label: 'Vert',   value: '#2A6A32' },
  { label: 'Orange', value: '#C17B2A' },
  { label: 'Violet', value: '#5A4A7A' },
]

// ── Popup de mise en forme flottant (déclenché par clic droit → Mise en forme) ─
const POPUP_COLORS = [
  { label: 'Rouge',  value: '#A83232' },
  { label: 'Bleu',   value: '#2A5A8A' },
  { label: 'Vert',   value: '#2A6A32' },
  { label: 'Orange', value: '#C17B2A' },
  { label: 'Violet', value: '#5A4A7A' },
  { label: 'Noir',   value: '#1a1a1a' },
]

// ── Error boundary — affiche une erreur lisible au lieu d'une page blanche ───
class PageErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '3rem 2rem', color: 'var(--text)' }}>
          <h2 style={{ color: 'var(--red)', marginBottom: 12 }}>⚠️ Erreur dans cette page</h2>
          <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)' }}>
            {this.state.error.message}{'\n\n'}{this.state.error.stack}
          </pre>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => this.setState({ error: null })}>
            ↺ Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function FormattingPopup() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.mtcApi.onFormatPopup(p => setPos(p))
  }, [])

  useEffect(() => {
    if (!pos) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown',   onKey)
    }
  }, [pos])

  if (!pos) return null

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg)
  }

  // Empêche le popup de sortir de l'écran
  const left = Math.min(pos.x, window.innerWidth  - 268)
  const top  = Math.min(pos.y + 6, window.innerHeight - 52)

  return (
    <div
      ref={ref}
      style={{
        position:     'fixed',
        left,
        top,
        zIndex:       99999,
        background:   'var(--surface, #fff)',
        border:       '1px solid var(--border, #ddd)',
        borderRadius: 8,
        boxShadow:    '0 4px 20px rgba(0,0,0,0.18)',
        display:      'flex',
        alignItems:   'center',
        gap:          2,
        padding:      '5px 10px',
        userSelect:   'none',
      }}
    >
      <button className="fmt-btn fmt-bold"
        onMouseDown={e => { e.preventDefault(); exec('bold') }}
        title="Gras (Ctrl+B)">G</button>
      <button className="fmt-btn fmt-italic"
        onMouseDown={e => { e.preventDefault(); exec('italic') }}
        title="Italique (Ctrl+I)">I</button>
      <button className="fmt-btn fmt-underline"
        onMouseDown={e => { e.preventDefault(); exec('underline') }}
        title="Souligné (Ctrl+U)">S</button>

      <div style={{ width: 1, height: 20, background: 'var(--border, #ddd)', margin: '0 6px', flexShrink: 0 }} />

      {POPUP_COLORS.map(c => (
        <button
          key={c.value}
          className="fmt-color-btn"
          style={{ background: c.value }}
          onMouseDown={e => { e.preventDefault(); exec('foreColor', c.value) }}
          title={c.label}
        />
      ))}
    </div>
  )
}

// ── Zone de survol pour afficher la barre de menu native ──────────────────────
function MenuBarHotspot() {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    window.mtcApi.setMenuBarVisible(true).catch(() => {})
  }

  const hide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      window.mtcApi.setMenuBarVisible(false).catch(() => {})
    }, 2000)
  }

  return (
    <div
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 4,
        zIndex: 9999,
        cursor: 'default',
      }}
    />
  )
}

function FormattingToolbar() {
  const [active, setActive] = useState(false)
  const mod = navigator.userAgent.includes('Macintosh') ? '⌘' : 'Ctrl+'

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      setActive(!!(e.target as HTMLElement)?.isContentEditable)
    }
    const onFocusOut = (e: FocusEvent) => {
      // Ne désactiver que si le focus ne va pas vers un autre contenteditable
      const next = e.relatedTarget as HTMLElement | null
      if (!next?.isContentEditable) setActive(false)
    }
    document.addEventListener('focusin',  onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin',  onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
  }

  return (
    <div className={`global-fmt-toolbar${active ? ' fmt-toolbar-active' : ' fmt-toolbar-inactive'}`}>
      <span className="fmt-toolbar-label">Mise en forme :</span>

      <button
        className="fmt-btn fmt-bold"
        onMouseDown={e => { e.preventDefault(); exec('bold') }}
        title={`Gras (${mod}B)`}
        tabIndex={-1}
      >G</button>

      <button
        className="fmt-btn fmt-italic"
        onMouseDown={e => { e.preventDefault(); exec('italic') }}
        title={`Italique (${mod}I)`}
        tabIndex={-1}
      >I</button>

      <button
        className="fmt-btn fmt-underline"
        onMouseDown={e => { e.preventDefault(); exec('underline') }}
        title={`Souligné (${mod}U)`}
        tabIndex={-1}
      >S</button>

      <div className="fmt-sep" />

      {FMT_COLORS.map(c => (
        <button
          key={c.value}
          className="fmt-color-btn"
          style={{ background: c.value }}
          onMouseDown={e => { e.preventDefault(); exec('foreColor', c.value) }}
          title={`Couleur ${c.label}`}
          tabIndex={-1}
        />
      ))}

      <div className="fmt-sep" />

      <button
        className="fmt-btn"
        onMouseDown={e => { e.preventDefault(); exec('removeFormat') }}
        title="Supprimer la mise en forme"
        style={{ fontSize: 11, letterSpacing: 0 }}
        tabIndex={-1}
      >✕ fmt</button>

      {!active && (
        <span className="fmt-toolbar-hint">— Cliquez dans une zone de notes pour activer</span>
      )}
    </div>
  )
}


function BackupButton({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleBackup = async () => {
    setOpen(false)
    try {
      await window.mtcApi.exportBackupJson()
      showToast('Sauvegarde créée ✓', 'success')
    } catch (e: any) {
      showToast(`Erreur sauvegarde : ${e?.message || e}`, 'error')
    }
  }

  const handleImport = async () => {
    setOpen(false)
    const path = await window.mtcApi.showOpenDialog({
      filters: [{ name: 'Sauvegarde Synoria', extensions: ['enc', 'json'] }],
    })
    if (!path) return
    try {
      const result = await window.mtcApi.importBackupJson(path)
      const msg = `Import terminé ✓ — ${result.patientsUpserted} patient(s), ${result.sessionsUpserted} séance(s)${result.errors.length ? ` (${result.errors.length} ignoré(s))` : ''}`
      showToast(msg, 'success')
      window.location.reload()
    } catch (e: any) {
      showToast(`Erreur import : ${e?.message || e}`, 'error')
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn-header-data" onClick={() => setOpen(o => !o)}>
        <span className="btn-header-icon" style={{ background: '#6E6CD8' }}>
          <SvgIcon>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v4c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 9v4c0 1.66 4 3 9 3s9-1.34 9-3V9" />
            <path d="M3 13v4c0 1.66 4 3 9 3s9-1.34 9-3v-4" />
          </SvgIcon>
        </span>
        Données
        <span style={{ fontSize: 9, opacity: .6, marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <div className="header-dropdown">
          <button className="header-dropdown-item" onClick={handleBackup}>
            <span className="header-dropdown-icon" style={{ background: '#4A6741' }}>
              <SaveIcon size={13} />
            </span>
            <div>
              <div className="header-dropdown-label">Sauvegarder la base de données</div>
              <div className="header-dropdown-sub">Exporte tous les patients et séances dans un fichier chiffré</div>
            </div>
          </button>
          <div className="header-dropdown-sep" />
          <button className="header-dropdown-item" onClick={handleImport}>
            <span className="header-dropdown-icon" style={{ background: '#C17B2A' }}>
              <FolderIcon size={13} />
            </span>
            <div>
              <div className="header-dropdown-label">Restaurer une sauvegarde…</div>
              <div className="header-dropdown-sub">Importe un fichier .enc — remplace les données existantes</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
