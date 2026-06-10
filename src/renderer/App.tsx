import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { SaveIcon, FolderIcon, LockIcon as LockIco, DashboardIcon, UsersIcon, PlusCircle, ClipboardIcon, CalendarIcon, BarChartIcon, TrendDownIcon, FileTextIcon, ShieldIcon, SettingsIcon } from './components/common/Icon'
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
import { useInactivityLock } from './hooks/useInactivityLock'

export const ToastContext = React.createContext<(msg: string, type?: 'success' | 'error') => void>(() => {})

type AuthState = 'splash' | 'checking' | 'setup' | 'locked' | 'unlocked'

export default function App() {
  const { toast, showToast } = useToast()
  const [authState, setAuthState] = useState<AuthState>('splash')

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
    return <SplashScreen onDone={checkAuth} />
  }

  if (authState === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F5F2ED' }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    )
  }

  if (authState === 'setup' || authState === 'locked') {
    return <LockScreen mode={authState} onUnlock={() => setAuthState('unlocked')} />
  }

  const handleLock = async () => {
    await window.mtcApi.authLock()
    setAuthState('locked')
  }

  return (
    <ToastContext.Provider value={showToast}>
      <div className="app-shell">

        {/* ── HEADER compact ── */}
        <header className="app-header">
          <div className="logo">
            <img src="./Synoria.png" alt="Logo" className="logo-img" />
            <img src="./Text Synoria fond blanc.png" alt="SYNORIA" className="logo-title-img" />
            <span title="Données chiffrées AES-256" className="logo-secure">🔒 chiffré</span>
          </div>
          <div className="header-actions">
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

            {/* Bouton verrouiller en bas */}
            <div className="sidebar-bottom">
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
              </Routes>
            </main>
          </div>

        </div>{/* fin app-body */}

        {toast && <Toast message={toast.message} type={toast.type} />}
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
  const handleBackup = async () => {
    try {
      await window.mtcApi.exportBackupJson()
      showToast('Sauvegarde créée ✓', 'success')
    } catch (e: any) {
      showToast(`Erreur sauvegarde : ${e?.message || e}`, 'error')
    }
  }
  const handleImport = async () => {
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
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn-header-save" onClick={handleBackup}>
        <span className="btn-header-icon" style={{ background: '#4A6741' }}>
          <SaveIcon size={12} />
        </span>
        Sauvegarder
      </button>
      <button className="btn-header-import" onClick={handleImport}>
        <span className="btn-header-icon" style={{ background: '#C17B2A' }}>
          <FolderIcon size={12} />
        </span>
        Importer
      </button>
    </div>
  )
}
