import React, { useState, useEffect, useCallback, useRef, Component } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
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
import SetupWizard from './components/common/SetupWizard'
import SettingsPage      from './pages/SettingsPage'
import RgpdPage          from './pages/RgpdPage'
import ComptaPage        from './pages/ComptaPage'
import DepensesPage      from './pages/DepensesPage'
import FacturesListPage  from './pages/FacturesListPage'
import ProfilePage       from './pages/ProfilePage'
import AccountPage      from './pages/AccountPage'
import AbonnementPage   from './pages/AbonnementPage'
import { useInactivityLock } from './hooks/useInactivityLock'
import GlobalSearch from './components/common/GlobalSearch'
import AdminPanel from './components/admin/AdminPanel'

import type { RestrictionState } from '../shared/types'

export const ToastContext = React.createContext<(msg: string, type?: 'success' | 'error') => void>(() => {})

const DEFAULT_RESTRICTION: RestrictionState = {
  mode: 'restricted', status: 'unknown',
  canReadData: true, canExportData: true, canBackupData: true,
  canCreatePatient: false, canModifyPatient: false,
  canCreateSession: false, canModifySession: false,
  canCreateInvoice: false, canCreateAppointment: false,
  canUsePremiumFeatures: false,
}
export const RestrictionContext = React.createContext<RestrictionState>(DEFAULT_RESTRICTION)

type AuthState = 'splash' | 'checking' | 'account-login' | 'subscription' | 'setup' | 'locked' | 'unlocked'

export default function App() {
  const { toast, showToast } = useToast()
  const [authState,   setAuthState]   = useState<AuthState>('splash')
  const [showWizard,  setShowWizard]  = useState(false)
  const [licenseStatus, setLicenseStatus] = useState<string>('unknown')
  const [restriction,   setRestriction]   = useState<RestrictionState>(DEFAULT_RESTRICTION)
  const [updateResult,  setUpdateResult]  = useState<import('../shared/types').ReleaseCheckResult | null>(null)
  const navigate = useNavigate()

  type ThemeMode = 'light' | 'dark' | 'system'
  const getSystemPref = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    (localStorage.getItem('synoria-theme-mode') as ThemeMode) || 'light'
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const m = (localStorage.getItem('synoria-theme-mode') as ThemeMode) || 'light'
    return m === 'system' ? getSystemPref() : m === 'dark' ? 'dark' : 'light'
  })

  // ── Chargement et application du thème ──
  useEffect(() => {
    window.mtcApi.getSettings().then(s => {
      const mode = (s.themeMode as ThemeMode) || (s.theme === 'dark' ? 'dark' : 'light')
      setThemeMode(mode)
      setTheme(mode === 'system' ? getSystemPref() : mode === 'dark' ? 'dark' : 'light')
      localStorage.setItem('synoria-theme-mode', mode)
    }).catch(() => {})
  }, [])

  // Écouter les changements de préférence système
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  // Écouter les changements de thème depuis SettingsPage
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail as ThemeMode
      setThemeMode(mode)
      setTheme(mode === 'system' ? getSystemPref() : mode === 'dark' ? 'dark' : 'light')
    }
    window.addEventListener('synoria-theme-change', handler)
    return () => window.removeEventListener('synoria-theme-change', handler)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const cycleTheme = () => {
    const cycle: ThemeMode[] = ['light', 'dark', 'system']
    const next = cycle[(cycle.indexOf(themeMode) + 1) % 3]
    setThemeMode(next)
    setTheme(next === 'system' ? getSystemPref() : next === 'dark' ? 'dark' : 'light')
    localStorage.setItem('synoria-theme-mode', next)
    window.mtcApi.saveSettings({ themeMode: next } as any).catch(() => {})
  }
  const toggleTheme = cycleTheme  // alias pour compatibilité

  const [searchOpen,    setSearchOpen]    = useState(false)
  const [adminOpen,     setAdminOpen]     = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [aboutOpen,     setAboutOpen]     = useState(false)
  const [appVersion,    setAppVersion]    = useState('')
  useEffect(() => { window.mtcApi.getAppVersion().then(setAppVersion).catch(() => {}) }, [])

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

  // ── Ctrl+K → recherche globale · ? → raccourcis ──
  useEffect(() => {
    if (authState !== 'unlocked') return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
      // '?' sans modificateur → modal raccourcis (sauf si focus dans un champ texte)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target as HTMLElement
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) {
          setShortcutsOpen(v => !v)
        }
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
      // Navigation
      const routes: Record<string, string> = {
        '1': '/',              // Tableau de bord
        '2': '/patients',     // Patients
        '3': '/nouvelle',     // Nouvelle séance
        '4': '/seances',      // Séances
        '5': '/calendrier',   // Calendrier
        '6': '/comptabilite', // Comptabilité
        '7': '/parametres',   // Paramètres
      }
      if (routes[e.key]) { e.preventDefault(); navigate(routes[e.key]); return }
      // Ctrl+L → Verrouiller
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        window.mtcApi.authLock().then(() => setAuthState('locked')).catch(() => {})
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authState, navigate])

  // Vérifier le statut de licence quand l'app est déverrouillée
  useEffect(() => {
    if (authState !== 'unlocked') return
    window.mtcApi.licenseGetState()
      .then(s => setLicenseStatus(s.status))
      .catch(() => {})
    window.mtcApi.licenseGetRestrictionState()
      .then(setRestriction)
      .catch(() => {})
  }, [authState])

  // Écouter les notifications de mise à jour depuis le main process
  useEffect(() => {
    window.mtcApi.onUpdateAvailable(result => setUpdateResult(result))
  }, [])

  // Rafraîchir le RestrictionContext quand AbonnementPage signale une vérification réussie
  useEffect(() => {
    const handler = () => {
      window.mtcApi.licenseGetRestrictionState().then(setRestriction).catch(() => {})
      window.mtcApi.licenseGetState().then(s => setLicenseStatus(s.status)).catch(() => {})
    }
    window.addEventListener('synoria-license-refreshed', handler)
    return () => window.removeEventListener('synoria-license-refreshed', handler)
  }, [])

  // Verrou automatique après 20 min d'inactivité
  const handleInactivityLock = useCallback(async () => {
    await window.mtcApi.authLock()
    setAuthState('locked')
  }, [])
  useInactivityLock(handleInactivityLock, authState === 'unlocked')

  // ── Flux de démarrage complet ──────────────────────────────────────
  // Ordre obligatoire : compte Supabase → licence active → mot de passe DB
  const checkAuth = async () => {
    setAuthState('checking')
    try {
      // 1. Compte Supabase obligatoire
      const acc = await window.mtcApi.accountGetState()
      if (!acc.isLoggedIn) {
        setAuthState('account-login')
        return
      }

      // 2. Licence : utiliser le jeton local d'abord
      let lic = await window.mtcApi.licenseGetState()
      const hasLocalLicense = lic.status === 'active' || lic.status === 'trialing' || lic.status === 'past_due_grace'
      if (!hasLocalLicense) {
        // Pas de jeton local valide — vérifier en ligne (peut être un compte déjà abonné)
        try { lic = await window.mtcApi.licenseVerifyOnline() } catch {}
      }
      if (lic.status === 'unknown' || lic.status === 'restricted') {
        setAuthState('subscription')
        return
      }

      // 3. Auth base de données locale
      const { hasPassword, isUnlocked } = await window.mtcApi.authStatus()
      if (!hasPassword) setAuthState('setup')
      else if (isUnlocked) setAuthState('unlocked')
      else setAuthState('locked')
    } catch {
      setAuthState('locked')
    }
  }

  if (authState === 'splash') {
    return <SplashScreen onDone={checkAuth} theme={theme} />
  }

  if (authState === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg, #F5F2ED)' }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    )
  }

  // ── Gate 1 : connexion au compte Synoria ───────────────────────────
  if (authState === 'account-login') {
    return <AccountGate onDone={checkAuth} theme={theme} />
  }

  // ── Gate 2 : choix de l'abonnement (14 jours d'essai) ────────────
  if (authState === 'subscription') {
    return <SubscriptionGate onDone={checkAuth} theme={theme} />
  }

  if (authState === 'setup' || authState === 'locked') {
    return (
      <LockScreen
        mode={authState}
        onUnlock={(wasSetup?: boolean) => {
          setAuthState('unlocked')
          // Wizard au 1er démarrage uniquement (setup) et si pas déjà vu
          if (wasSetup && !localStorage.getItem('synoria-wizard-done')) {
            setShowWizard(true)
          }
        }}
        theme={theme}
      />
    )
  }

  const handleLock = async () => {
    await window.mtcApi.authLock()
    setAuthState('locked')
  }

  return (
    <RestrictionContext.Provider value={restriction}>
    <ToastContext.Provider value={showToast}>
      <FormattingPopup />
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} theme={theme} />}
      {showWizard && <SetupWizard theme={theme} onComplete={() => setShowWizard(false)} />}

      {/* ── Modal raccourcis clavier ── */}
      {shortcutsOpen && (
        <div style={{ position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setShortcutsOpen(false)}>
          <div style={{ background:'var(--surface)',borderRadius:16,padding:'32px 40px',maxWidth:480,width:'100%',boxShadow:'0 32px 80px rgba(0,0,0,.28)',border:'1px solid var(--border)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:'var(--font-serif)',fontSize:20,fontWeight:700,color:'var(--accent)',marginBottom:24 }}>Raccourcis clavier</div>
            {[
              ['Ctrl + K', 'Recherche globale'],
              ['Ctrl + 1', 'Tableau de bord'],
              ['Ctrl + 2', 'Patients'],
              ['Ctrl + 3', 'Nouvelle séance'],
              ['Ctrl + 4', 'Séances'],
              ['Ctrl + 5', 'Calendrier'],
              ['Ctrl + 6', 'Comptabilité'],
              ['Ctrl + 7', 'Paramètres'],
              ['Ctrl + L', 'Verrouiller l\'application'],
              ['?', 'Afficher cette aide'],
            ].map(([k, v]) => (
              <div key={k} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border-soft)' }}>
                <span style={{ fontSize:13,color:'var(--text-muted)' }}>{v}</span>
                <kbd style={{ background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 10px',fontSize:12,fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--text)',boxShadow:'0 2px 0 var(--border)' }}>{k}</kbd>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ marginTop:20,width:'100%' }} onClick={() => setShortcutsOpen(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* ── Modal À propos ── */}
      {aboutOpen && (
        <div style={{ position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setAboutOpen(false)}>
          <div style={{ background:'var(--surface)',borderRadius:16,padding:'36px 44px',maxWidth:460,width:'100%',boxShadow:'0 32px 80px rgba(0,0,0,.28)',border:'1px solid var(--border)',textAlign:'center' }} onClick={e=>e.stopPropagation()}>
            <img src="./Synoria.png" alt="Synoria" style={{ width:80,height:80,objectFit:'contain',marginBottom:16 }} />
            <div style={{ fontFamily:'var(--font-serif)',fontSize:24,fontWeight:700,color:'var(--accent)',marginBottom:4 }}>Synoria</div>
            <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:20 }}>v{appVersion} · Logiciel de gestion de dossiers patients</div>
            <div style={{ fontSize:13,color:'var(--text)',lineHeight:1.8,marginBottom:20,textAlign:'left',background:'var(--bg)',borderRadius:10,padding:'14px 18px' }}>
              <div><strong>Auteur :</strong> Jean-Pierre Timoner</div>
              <div><strong>Contact :</strong> jeanpierre.timoner.mtc@gmail.com</div>
              <div><strong>Données :</strong> 100% locales — chiffrement AES-256-GCM</div>
              <div><strong>RGPD :</strong> aucune donnée transmise à des tiers</div>
              <div style={{ marginTop:8,paddingTop:8,borderTop:'1px solid var(--border-soft)',fontSize:12,color:'var(--text-muted)' }}>
                © 2025-2026 Jean-Pierre Timoner. Tous droits réservés.<br/>
                Usage professionnel uniquement — praticiens de santé.
              </div>
            </div>
            <button className="btn btn-secondary" style={{ width:'100%' }} onClick={() => setAboutOpen(false)}>Fermer</button>
          </div>
        </div>
      )}
      <div className="app-shell">

        {/* ── HEADER compact ── */}
        <header className="app-header">
          <div className="logo">
            <img src="./Synoria.png" alt="Logo" className="logo-img" />
            <img
              src={theme === 'dark' ? './Synoria-text-sombre.png' : './Synoria-text-jour.png'}
              alt="SYNORIA"
              className="logo-title-img"
            />
            <span title="Données chiffrées AES-256" className="logo-secure">🔒 chiffré</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn-header-icon" onClick={() => setShortcutsOpen(true)} title="Raccourcis clavier (?)">
              <span style={{ fontSize: 13, fontWeight: 700 }}>?</span>
            </button>
            <button className="btn-header-icon" onClick={() => setAboutOpen(true)} title="À propos de Synoria">
              <span style={{ fontSize: 13, fontWeight: 700 }}>ℹ</span>
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
              <NavLink to="/abonnement" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon" style={{ background: '#FF9F0A' }}>
                  <span style={{ fontSize: 11 }}>🔑</span>
                </span>
                {licenseStatus === 'restricted' || licenseStatus === 'unknown'
                  ? <span>Abonnement <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 10 }}>!</span></span>
                  : 'Mon abonnement'
                }
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
            {(licenseStatus === 'restricted') && (
              <div style={{
                background: 'rgba(255,59,48,.12)', borderBottom: '1px solid rgba(255,59,48,.3)',
                padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
                fontSize: 13, color: '#C00',
              }}>
                <span style={{ fontWeight: 700 }}>Mode restreint</span>
                — Votre licence est expirée. Lecture et export toujours disponibles.
                <button
                  className="btn btn-sm"
                  style={{ marginLeft: 'auto', background: '#C00', color: '#fff', border: 'none', padding: '4px 14px' }}
                  onClick={() => navigate('/abonnement')}
                >
                  Renouveler →
                </button>
              </div>
            )}
            {(licenseStatus === 'past_due_grace') && (
              <div style={{
                background: 'rgba(255,159,10,.1)', borderBottom: '1px solid rgba(255,159,10,.3)',
                padding: '8px 20px', fontSize: 12, color: '#A86800',
              }}>
                Paiement en attente — Synoria continuera à fonctionner normalement pendant la période de grâce.
                <button className="btn btn-sm" style={{ marginLeft: 12, padding: '2px 10px' }} onClick={() => navigate('/compte')}>
                  Gérer →
                </button>
              </div>
            )}
            {updateResult && (
              <div style={{
                background: 'rgba(91,140,247,.1)', borderBottom: '1px solid rgba(91,140,247,.3)',
                padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 12, color: 'var(--text)',
              }}>
                <span style={{ fontWeight: 600 }}>
                  {updateResult.is_required ? '⚠️ Mise à jour requise' : '⬆️ Mise à jour disponible'}
                </span>
                — v{updateResult.latest_version}
                {updateResult.title && <span style={{ color: 'var(--text-muted)' }}>· {updateResult.title}</span>}
                {updateResult.download_url && (
                  <button
                    className="btn btn-sm"
                    style={{ marginLeft: 4, padding: '2px 10px', background: '#5B8CF7', color: '#fff', border: 'none' }}
                    onClick={() => window.open(updateResult!.download_url!, '_blank')}
                  >
                    Télécharger
                  </button>
                )}
                {!updateResult.is_required && (
                  <button
                    className="btn btn-sm"
                    style={{ padding: '2px 10px' }}
                    onClick={() => {
                      window.mtcApi.dismissUpdateNotification(updateResult.latest_version).catch(() => {})
                      setUpdateResult(null)
                    }}
                  >
                    Ignorer
                  </button>
                )}
              </div>
            )}
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
                <Route path="/compte"             element={<AccountPage />} />
                <Route path="/abonnement"        element={<AbonnementPage />} />
              </Routes>
              </PageErrorBoundary>
            </main>
          </div>

        </div>{/* fin app-body */}

        {toast && <Toast message={toast.message} type={toast.type} />}
        <ConfirmDialog />
      </div>
    </ToastContext.Provider>
    </RestrictionContext.Provider>
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

function FormattingToolbar() {
  const location = useLocation()
  const [active, setActive] = useState(false)
  const mod = navigator.userAgent.includes('Macintosh') ? '⌘' : 'Ctrl+'

  // Barre visible uniquement sur les pages de saisie de séance
  const isSessionPage = location.pathname.startsWith('/nouvelle') ||
                        location.pathname.startsWith('/modifier')

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

  if (!isSessionPage) return null

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
      if ('__needsPassword' in result || '__needsKey' in result) {
        showToast('Cette sauvegarde est protégée — utilisez Paramètres → Importer une sauvegarde', 'error')
        return
      }
      const msg = `Import terminé ✓ — ${result.patientsUpserted} patient(s), ${result.sessionsUpserted} séance(s)${result.errors.length ? ` (${result.errors.length} ignoré(s))` : ''}`
      showToast(msg, 'success')
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

// ── Gate 1 : Connexion au compte Synoria ─────────────────────────────────────

function AccountGate({ onDone, theme }: { onDone: () => void; theme: 'light' | 'dark' }) {
  const [view, setView]         = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')
  const [emailExists, setEmailExists] = useState(false)

  const switchToLogin = () => { setView('login'); setError(''); setMessage(''); setEmailExists(false) }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const { ok, error: err } = await window.mtcApi.accountSignIn(email, password)
      if (!ok) { setError(err ?? 'Connexion échouée'); return }
      onDone()
    } finally { setLoading(false) }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setEmailExists(false)
    try {
      const { ok, error: err } = await window.mtcApi.accountSignUp(email, password)
      if (!ok) {
        if (err === 'EMAIL_EXISTS') {
          setEmailExists(true)
          setError('Un compte existe déjà avec cette adresse email.')
        } else {
          setError(err ?? 'Inscription échouée')
        }
        return
      }
      setMessage('Compte créé ! Vérifiez votre email pour confirmer votre adresse, puis revenez vous connecter.')
      setView('login')
      setPassword('')
    } finally { setLoading(false) }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const { ok, error: err } = await window.mtcApi.accountResetPassword(email)
      if (!ok) { setError(err ?? 'Erreur'); return }
      setMessage('Email envoyé. Consultez votre boîte mail.')
      setView('login')
    } finally { setLoading(false) }
  }

  const bg = theme === 'dark' ? '#141814' : '#f4f7f4'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: bg, flexDirection: 'column', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <img src="./Synoria.png" alt="Synoria" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 10 }} />
        <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 22, fontWeight: 700, color: 'var(--accent, #4a7b3c)' }}>Synoria</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted, #888)', marginTop: 4 }}>Logiciel de gestion de dossiers patients</div>
      </div>

      <div className="card" style={{ width: 400, padding: 32 }}>
        {message && (
          <div style={{ background: '#e8f5e9', color: '#2d6e4a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ background: '#fdf1f0', color: '#b83c2c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent, #4a7b3c)', marginBottom: 4 }}>Connexion à votre compte</div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent, #4a7b3c)', cursor: 'pointer', padding: 0, fontSize: 13 }}
                onClick={() => { setView('signup'); setError(''); setMessage(''); setEmailExists(false) }}>
                Créer un compte
              </button>
              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', padding: 0, fontSize: 13 }}
                onClick={() => { setView('reset'); setError(''); setMessage(''); setEmailExists(false) }}>
                Mot de passe oublié
              </button>
            </div>
          </form>
        )}

        {view === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent, #4a7b3c)', marginBottom: 4 }}>Créer votre compte Synoria</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #888)', background: 'var(--bg, #f4f7f4)', borderRadius: 8, padding: '10px 14px' }}>
              14 jours d'essai gratuit · Carte bancaire requise à l'inscription · Aucun prélèvement avant J+14
            </div>
            <div className="field">
              <label>Email professionnel</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
            </div>
            <div className="field">
              <label>Mot de passe (8 caractères minimum)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div style={{ background: '#fff8e1', border: '1px solid #f9a825', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#7a5c00', lineHeight: 1.55 }}>
              ⚠️ <strong>Conservez ce mot de passe précieusement.</strong> Il chiffre également vos sauvegardes locales. En cas de perte, les données de sauvegarde seront inaccessibles. Notez-le dans un endroit sûr.
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Création…' : 'Créer le compte'}
            </button>
            {emailExists && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={switchToLogin}
                style={{ fontWeight: 600 }}
              >
                → Se connecter avec cet email
              </button>
            )}
            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent, #4a7b3c)', cursor: 'pointer', fontSize: 13 }}
              onClick={switchToLogin}>
              ← Déjà un compte ? Se connecter
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent, #4a7b3c)', marginBottom: 4 }}>Réinitialiser le mot de passe</div>
            <div className="field">
              <label>Votre email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </button>
            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent, #4a7b3c)', cursor: 'pointer', fontSize: 13 }}
              onClick={() => { setView('login'); setError(''); setMessage('') }}>
              ← Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Gate 2 : Choix d'abonnement (essai 14 jours) ─────────────────────────────

const PLAN_ANNUAL  = 'synoria_annual'
const PLAN_6MONTHS = 'synoria_6_months'

function SubscriptionGate({ onDone, theme }: { onDone: () => void; theme: 'light' | 'dark' }) {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [verifying, setVerifying]             = useState(false)
  const [error, setError]                     = useState('')

  const handleSubscribe = async (plan: string) => {
    setCheckoutLoading(plan); setError('')
    try {
      const url = await window.mtcApi.accountCreateCheckout(plan)
      // S'ouvre dans le navigateur système (géré par setWindowOpenHandler dans index.ts)
      window.open(url, '_blank')
    } catch (e: any) {
      const msg: string = e?.message ?? ''
      if (msg.includes('ALREADY_SUBSCRIBED') || msg.includes('409')) {
        setError('Vous avez déjà un abonnement actif. Cliquez sur "J\'ai finalisé mon abonnement →" ci-dessous pour accéder à Synoria.')
      } else {
        setError(msg || 'Erreur lors de l\'ouverture du paiement. Réessayez.')
      }
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleVerify = async () => {
    setVerifying(true); setError('')
    try {
      const lic = await window.mtcApi.licenseVerifyOnline()
      if (lic.status === 'active' || lic.status === 'trialing' || lic.status === 'past_due_grace') {
        onDone()
      } else {
        setError('Abonnement non encore actif. Finalisez le paiement dans votre navigateur, attendez quelques secondes, puis réessayez.')
      }
    } catch {
      setError('Impossible de vérifier en ligne. Vérifiez votre connexion et réessayez.')
    } finally {
      setVerifying(false)
    }
  }

  const handleSignOut = async () => {
    await window.mtcApi.accountSignOut().catch(() => {})
    onDone()
  }

  const bg = theme === 'dark' ? '#141814' : '#f4f7f4'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: bg, flexDirection: 'column', gap: 28, padding: '40px 20px' }}>
      {/* En-tête */}
      <div style={{ textAlign: 'center' }}>
        <img src="./Synoria.png" alt="Synoria" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 10 }} />
        <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 22, fontWeight: 700, color: 'var(--accent, #4a7b3c)' }}>Synoria</div>
        <div style={{ fontSize: 15, color: 'var(--text-muted, #888)', marginTop: 6 }}>Choisissez votre formule pour commencer</div>
        <div style={{
          display: 'inline-block', marginTop: 10,
          background: '#e8f5e9', color: '#2d6e4a',
          borderRadius: 20, padding: '5px 16px',
          fontSize: 13, fontWeight: 600,
        }}>
          14 jours d'essai gratuit — carte bancaire requise, aucun prélèvement avant J+14
        </div>
      </div>

      {error && (
        <div style={{ background: '#fdf1f0', color: '#b83c2c', borderRadius: 8, padding: '12px 18px', fontSize: 13, maxWidth: 500, textAlign: 'center', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {/* Cartes tarifaires */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
        {/* 6 mois */}
        <div className="card" style={{ flex: '1 1 220px', minWidth: 200, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted, #888)', marginBottom: 8 }}>
              Synoria 6 mois
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text, #1a221a)' }}>
              63 €<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted, #888)' }}> / 6 mois</span>
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--text-muted, #888)', display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1 }}>
            <li>✓ Toutes les fonctionnalités</li>
            <li>✓ 2 appareils simultanés</li>
            <li>✓ Support par email</li>
          </ul>
          <button className="btn btn-secondary" disabled={!!checkoutLoading} onClick={() => handleSubscribe(PLAN_6MONTHS)}>
            {checkoutLoading === PLAN_6MONTHS ? 'Ouverture…' : 'Commencer l\'essai gratuit'}
          </button>
        </div>

        {/* Annuel — recommandé */}
        <div className="card" style={{ flex: '1 1 220px', minWidth: 200, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, outline: '2px solid var(--accent, #4a7b3c)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent, #4a7b3c)', marginBottom: 8 }}>
              Synoria Annuel ★ Recommandé
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text, #1a221a)' }}>
              123 €<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted, #888)' }}> / an</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent, #4a7b3c)', marginTop: 4 }}>Soit 10,25 € / mois — économisez vs l'offre 6 mois</div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--text-muted, #888)', display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1 }}>
            <li>✓ Toutes les fonctionnalités</li>
            <li>✓ 2 appareils simultanés</li>
            <li>✓ Support prioritaire par email</li>
          </ul>
          <button className="btn btn-primary" disabled={!!checkoutLoading} onClick={() => handleSubscribe(PLAN_ANNUAL)}>
            {checkoutLoading === PLAN_ANNUAL ? 'Ouverture…' : 'Commencer l\'essai gratuit'}
          </button>
        </div>
      </div>

      {/* Actions secondaires */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-secondary" disabled={verifying} onClick={handleVerify} style={{ minWidth: 240 }}>
          {verifying ? 'Vérification de votre abonnement…' : 'J\'ai finalisé mon abonnement →'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', textAlign: 'center', maxWidth: 320 }}>
          Après le paiement Stripe, cliquez ici pour activer l'accès.
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', fontSize: 12, marginTop: 4 }}
          onClick={handleSignOut}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
