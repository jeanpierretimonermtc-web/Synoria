import React, { useState, useEffect, useCallback, useContext } from 'react'
import { ToastContext } from '../App'
import type {
  FullAccountState, LicenseState, DeviceInfo,
  RestrictionState, ReleaseCheckResult, DeactivationReason,
} from '../../shared/types'

const PLAN_ANNUAL  = 'synoria_annual'
const PLAN_6M      = 'synoria_6_months'
const SUPPORT_EMAIL = 'contact@logiciel-synoria.fr'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso as string).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso as string).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPlan(priceId: string | null | undefined, planCode: string | null | undefined): string {
  const code = planCode ?? priceId ?? ''
  if (code.includes('annual'))                            return 'Synoria Annuel'
  if (code.includes('6_months') || code.includes('6m'))  return 'Synoria 6 mois'
  return code || '—'
}

function openExternal(url: string) {
  window.mtcApi.openExternal(url).catch(() => {})
}

// ── Badge statut ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; dot: string; bg: string; fg: string }> = {
  active:         { label: 'Actif',         dot: '#22A850', bg: 'rgba(34,168,80,.13)',   fg: '#1A6635' },
  trialing:       { label: 'Essai gratuit', dot: '#3B7EF5', bg: 'rgba(59,126,245,.13)',  fg: '#1A3E8C' },
  past_due_grace: { label: 'Paiement dû',   dot: '#D48A00', bg: 'rgba(212,138,0,.13)',   fg: '#7A5000' },
  cancelled:      { label: 'Annulé',        dot: '#D48A00', bg: 'rgba(212,138,0,.13)',   fg: '#7A5000' },
  restricted:     { label: 'Restreint',     dot: '#C03030', bg: 'rgba(192,48,48,.12)',    fg: '#8C0000' },
  unknown:        { label: 'Non vérifié',   dot: '#999',    bg: 'rgba(153,153,153,.13)', fg: '#555' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.unknown
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: s.bg, color: s.fg, fontWeight: 700, fontSize: 12,
      borderRadius: 20, padding: '4px 13px',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── Bannière contextuelle ─────────────────────────────────────────────────────

function StatusBanner({ status, mode, sub }: {
  status: string
  mode: string
  sub?: { cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null
}) {
  if (status === 'active' && sub?.cancelAtPeriodEnd) return (
    <Banner color="amber">
      <strong>Résiliation programmée.</strong> Votre abonnement sera annulé le{' '}
      <strong>{fmtDate(sub.currentPeriodEnd)}</strong>. Vous continuez à bénéficier de l'accès complet
      jusqu'à cette date. Aucun paiement ne sera prélevé après cette date.
      Pour conserver l'accès, réactivez votre abonnement via «&nbsp;Gérer mon abonnement Stripe&nbsp;».
    </Banner>
  )
  if (status === 'active') return (
    <Banner color="green">
      Votre licence Synoria est active. Vos données patients restent stockées localement sur cet ordinateur.
    </Banner>
  )
  if (status === 'trialing' && sub?.cancelAtPeriodEnd) return (
    <Banner color="amber">
      <strong>Résiliation programmée.</strong> Vous avez annulé pendant l'essai gratuit. L'accès complet
      est maintenu jusqu'au <strong>{fmtDate(sub.currentPeriodEnd)}</strong>, sans aucun prélèvement.
      Pour souscrire, réactivez votre abonnement via «&nbsp;Gérer mon abonnement Stripe&nbsp;».
    </Banner>
  )
  if (status === 'trialing') return (
    <Banner color="blue">
      Votre essai gratuit Synoria est actif. Aucun paiement n'est prélevé pendant les 14 premiers jours.
      Sans annulation avant la fin de l'essai, l'abonnement choisi démarre automatiquement.
    </Banner>
  )
  if (status === 'cancelled') return (
    <Banner color="amber">
      <strong>Abonnement annulé.</strong>{' '}
      {sub?.currentPeriodEnd
        ? <>Vous conservez l'accès complet à Synoria jusqu'au <strong>{fmtDate(sub.currentPeriodEnd)}</strong>.
          Après cette date, l'application passera en mode restreint — vos données resteront consultables
          et exportables, mais la création de nouveaux dossiers sera suspendue.</>
        : <>L'accès à Synoria est maintenu jusqu'à la fin de la période payée.
          Après cette date, l'application passera en mode restreint.</>
      }
      {' '}Pour réactiver, cliquez sur «&nbsp;Gérer mon abonnement Stripe&nbsp;».
    </Banner>
  )
  if (status === 'past_due_grace') return (
    <Banner color="amber">
      Paiement en attente — Synoria continue de fonctionner normalement pendant la période de grâce.
      Mettez à jour votre moyen de paiement pour éviter une interruption.
    </Banner>
  )
  if (status === 'restricted' || mode === 'restricted') return (
    <Banner color="red">
      Synoria est en mode restreint. Vos données existantes restent consultables, exportables et
      sauvegardables. La création ou modification de nouvelles données est suspendue jusqu'à
      vérification de la licence.
    </Banner>
  )
  return null
}

function Banner({ color, children }: { color: 'green' | 'blue' | 'amber' | 'red'; children: React.ReactNode }) {
  const MAP = {
    green: { bg: 'rgba(34,168,80,.08)',  border: 'rgba(34,168,80,.28)',  text: '#1A5C2D' },
    blue:  { bg: 'rgba(59,126,245,.08)', border: 'rgba(59,126,245,.28)', text: '#1A3A7A' },
    amber: { bg: 'rgba(212,138,0,.08)',  border: 'rgba(212,138,0,.30)',  text: '#7A5000' },
    red:   { bg: 'rgba(192,48,48,.08)',  border: 'rgba(192,48,48,.28)',  text: '#8C0000' },
  }
  const c = MAP[color]
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 10, padding: '11px 16px', fontSize: 13, lineHeight: 1.55,
      marginBottom: 20,
    }}>
      {children}
    </div>
  )
}

// ── Ligne de détail ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid var(--border-soft)',
      gap: 12,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{children}</span>
    </div>
  )
}

// ── Carte d'offre ─────────────────────────────────────────────────────────────

function OfferCard({ title, price, period, note, saving, loading, onClick }: {
  title: string; price: string; period: string; note?: string; saving?: string
  loading: boolean; onClick: () => void
}) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
        {title}
      </div>
      {saving && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#1A3E8C',
          background: 'rgba(59,126,245,.12)', borderRadius: 4, padding: '2px 8px',
          display: 'inline-block', width: 'fit-content',
        }}>
          {saving}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{price}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/{period}</span>
      </div>
      {note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{note}</div>}
      <button className="btn btn-primary" style={{ marginTop: 6 }} onClick={onClick} disabled={loading}>
        {loading ? 'Ouverture...' : 'Commencer l\'essai gratuit'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        14 jours gratuits · Carte bancaire requise
      </div>
    </div>
  )
}

// ── Formulaire d'authentification ─────────────────────────────────────────────

type AuthView = 'login' | 'signup' | 'reset'

function AuthForm({
  onSuccess,
}: {
  onSuccess: () => void
}) {
  const showToast = useContext(ToastContext)
  const [view,    setView]    = useState<AuthView>('login')
  const [email,   setEmail]   = useState('')
  const [pwd,     setPwd]     = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (view === 'login') {
        const { ok, error } = await window.mtcApi.accountSignIn(email, pwd)
        if (!ok) { showToast(error ?? 'Connexion échouée', 'error'); return }
        showToast('Connecté', 'success')
        onSuccess()
      } else if (view === 'signup') {
        const { ok, error } = await window.mtcApi.accountSignUp(email, pwd)
        if (!ok) {
          if (error === 'EMAIL_EXISTS' || error?.startsWith('EMAIL_EXISTS')) {
            showToast('Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe.', 'error')
          } else if (error === 'SIGNUP_DISABLED' || error?.startsWith('SIGNUP_DISABLED')) {
            showToast(`Inscriptions bloquées côté Supabase ${error.includes('[') ? error.slice(error.indexOf('[')) : ''}. Vérifiez Authentication → Settings → "Allow new users to sign up" ET cliquez "Save changes".`, 'error')
          } else {
            showToast(error ?? 'Inscription échouée', 'error')
          }
          return
        }
        showToast('Compte créé — vérifiez votre email pour confirmer.', 'success')
        setView('login')
      } else {
        const { ok, error } = await window.mtcApi.accountResetPassword(email)
        if (!ok) { showToast(error ?? 'Erreur', 'error'); return }
        showToast('Lien de réinitialisation envoyé.', 'success')
        setView('login')
      }
    } finally {
      setLoading(false)
    }
  }

  const TITLES: Record<AuthView, string> = {
    login:  'Connexion à votre compte Synoria',
    signup: 'Créer un compte Synoria',
    reset:  'Mot de passe oublié',
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto 0' }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: 'var(--accent)', marginBottom: 18 }}>
          {TITLES[view]}
        </div>
        {view === 'login' && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Connectez-vous pour gérer votre abonnement, vérifier votre licence et voir vos appareils actifs.
          </p>
        )}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="field" type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          {view !== 'reset' && (
            <input className="field" type="password" placeholder={view === 'signup' ? 'Mot de passe (6 car. min.)' : 'Mot de passe'} value={pwd} onChange={e => setPwd(e.target.value)} required minLength={view === 'signup' ? 6 : undefined} />
          )}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? '…' : view === 'login' ? 'Se connecter' : view === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          {view === 'login' && <>
            <button className="btn btn-secondary btn-sm" onClick={() => setView('reset')}>Mot de passe oublié ?</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setView('signup')}>Créer un compte</button>
          </>}
          {view !== 'login' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setView('login')}>Retour à la connexion</button>
          )}
        </div>
      </div>
      <div style={{
        marginTop: 14, padding: '10px 16px', textAlign: 'center',
        background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-soft)',
        fontSize: 12, color: 'var(--text-muted)',
      }}>
        🔒 Vos données patients restent stockées localement sur cet ordinateur.
        Aucune donnée patient n'est envoyée à nos serveurs.
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

interface LastCheck { checkedAt: string; status: string }

export default function AbonnementPage() {
  const showToast = useContext(ToastContext)

  // données
  const [account,    setAccount]    = useState<FullAccountState | null>(null)
  const [license,    setLicense]    = useState<LicenseState | null>(null)
  const [restriction,setRestriction]= useState<RestrictionState | null>(null)
  const [devices,    setDevices]    = useState<DeviceInfo[]>([])
  const [lastCheck,  setLastCheck]  = useState<LastCheck | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<ReleaseCheckResult | null>(null)
  const [deactivLeft,setDeactivLeft]= useState<number | null>(null)

  // états UI
  const [loading,         setLoading]         = useState(true)
  const [verifying,       setVerifying]        = useState(false)
  const [checkingUpdate,  setCheckingUpdate]   = useState(false)
  const [deactivatingId,  setDeactivatingId]   = useState<string | null>(null)
  const [deactivatingSelf,setDeactivatingSelf] = useState(false)
  const [subscribing,     setSubscribing]      = useState<string | null>(null)
  const [openingPortal,   setOpeningPortal]    = useState(false)

  // ── Chargement ──

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [acc, lic, rst, lc, ver] = await Promise.all([
        window.mtcApi.accountGetState(),
        window.mtcApi.licenseGetState(),
        window.mtcApi.licenseGetRestrictionState(),
        window.mtcApi.licenseGetLastCheck(),
        window.mtcApi.getAppVersion(),
      ])
      setAccount(acc)
      setLicense(lic)
      setRestriction(rst)
      setLastCheck(lc)
      setAppVersion(ver)

      if (acc.isLoggedIn) {
        window.mtcApi.licenseGetDevices().then(setDevices).catch(() => {})
        // check silencieux pour afficher la version disponible
        window.mtcApi.releaseCheck(ver).then(r => { if (r) setUpdateInfo(r) }).catch(() => {})
      }
    } catch (e: any) {
      showToast(`Erreur de chargement : ${e?.message ?? e}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Actions ──

  const handleSignOut = async () => {
    await window.mtcApi.accountSignOut()
    setAccount(null); setDevices([]); setUpdateInfo(null); setLicense(null)
    showToast('Déconnecté', 'success')
    await loadAll()
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const state = await window.mtcApi.licenseRefresh()
      setLicense(state)
      const [rst, lc] = await Promise.all([
        window.mtcApi.licenseGetRestrictionState(),
        window.mtcApi.licenseGetLastCheck(),
      ])
      setRestriction(rst); setLastCheck(lc)
      // Propager le nouvel état de restriction à toute l'app (nav, boutons, etc.)
      window.dispatchEvent(new CustomEvent('synoria-license-refreshed'))
      showToast('Licence vérifiée', 'success')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleSubscribe = async (plan: string) => {
    setSubscribing(plan)
    try {
      const url = await window.mtcApi.accountCreateCheckout(plan)
      openExternal(url)
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setSubscribing(null)
    }
  }

  const handlePortal = async () => {
    setOpeningPortal(true)
    try {
      const url = await window.mtcApi.accountBillingPortal()
      openExternal(url)
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setOpeningPortal(false)
    }
  }

  const handleDeactivate = async (deviceId: string, reason: DeactivationReason) => {
    if (!window.confirm('Désactiver cet appareil ? Synoria ne pourra plus s\'y ouvrir.')) return
    setDeactivatingId(deviceId)
    try {
      const r = await window.mtcApi.licenseDeactivateDevice(deviceId, reason)
      setDevices(r.activeDevices)
      setDeactivLeft(r.deactivationsRemaining30d)
      showToast('Appareil désactivé', 'success')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setDeactivatingId(null)
    }
  }

  const handleDeactivateSelf = async () => {
    if (!window.confirm('Désactiver CET appareil ? Synoria passera en mode restreint jusqu\'à réactivation.')) return
    setDeactivatingSelf(true)
    try {
      await window.mtcApi.licenseDeactivateCurrentDevice()
      showToast('Appareil désactivé — mode restreint actif', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setDeactivatingSelf(false)
    }
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const r = await window.mtcApi.checkForUpdates()
      if (r?.update_available) {
        setUpdateInfo(r)
        showToast(`Mise à jour disponible : v${r.latest_version}`, 'success')
      } else {
        showToast('Synoria est à jour', 'success')
      }
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setCheckingUpdate(false)
    }
  }

  // ── Chargement ──

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    )
  }

  // ── Non connecté ──

  if (!account?.isLoggedIn) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 860 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Mon abonnement
        </div>
        <AuthForm onSuccess={loadAll} />
      </div>
    )
  }

  // ── Connecté ──

  const licStatus = license?.status ?? 'unknown'
  const licMode   = license?.mode   ?? 'restricted'
  const sub       = account.subscription
  const maxDevices = license?.maxDevices ?? 2
  const devicesFull = devices.length >= maxDevices

  const nextCheckDate = lastCheck
    ? new Date(new Date(lastCheck.checkedAt).getTime() + 24 * 60 * 60 * 1000)
    : null
  const checkOverdue = nextCheckDate ? nextCheckDate < new Date() : true

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Mon abonnement
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{account.account?.email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={licStatus} />
          <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>Se déconnecter</button>
        </div>
      </div>

      {/* ── Bannière statut ── */}
      <StatusBanner status={licStatus} mode={licMode} sub={sub} />

      {/* ── Rappel local ── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border-soft)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 24,
      }}>
        🔒 Données patients stockées localement — aucune donnée patient transmise à nos serveurs.
      </div>

      {/* ── Grille principale ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>

        {/* ── Colonne gauche ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Carte Licence */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Licence</div>
            <Row label="Statut">
              <StatusBadge status={licStatus} />
            </Row>
            <Row label="Mode">
              {licMode === 'full'
                ? <span style={{ color: '#1A6635' }}>Complet</span>
                : <span style={{ color: '#8C0000' }}>Restreint</span>}
            </Row>
            <Row label="Offre">
              {fmtPlan(sub?.priceId, license?.planCode)}
            </Row>
            {sub?.trialEnd && (
              <Row label="Fin de l'essai gratuit">
                <span style={{ color: '#7A5000' }}>{fmtDate(sub.trialEnd)}</span>
              </Row>
            )}
            {sub?.currentPeriodEnd && (
              <Row label={sub.cancelAtPeriodEnd ? 'Fin abonnement (résiliation)' : 'Prochain renouvellement'}>
                <span style={{ color: sub.cancelAtPeriodEnd ? '#8C0000' : 'var(--text)' }}>
                  {fmtDate(sub.currentPeriodEnd)}
                </span>
              </Row>
            )}
            {license?.graceUntil && (
              <Row label="Grâce jusqu'au">
                <span style={{ color: '#7A5000' }}>{fmtDate(license.graceUntil as string)}</span>
              </Row>
            )}
            <Row label="Dernière vérification">
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>
                {lastCheck ? fmtDateTime(lastCheck.checkedAt) : 'Jamais'}
              </span>
            </Row>
            <Row label="Prochaine vérification">
              {nextCheckDate
                ? <span style={{ color: checkOverdue ? '#8C0000' : 'var(--text)', fontSize: 12 }}>
                    {checkOverdue && 'En retard — '}
                    {fmtDateTime(nextCheckDate.toISOString())}
                  </span>
                : '—'}
            </Row>
          </div>

          {/* Carte Actions */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleVerify} disabled={verifying}>
                {verifying ? 'Vérification en cours...' : 'Vérifier maintenant'}
              </button>
              {sub && (
                <button className="btn btn-secondary" onClick={handlePortal} disabled={openingPortal}>
                  {openingPortal ? 'Ouverture...' : 'Gérer mon abonnement Stripe →'}
                </button>
              )}
              {license?.deviceId && (
                <button
                  className="btn btn-secondary"
                  style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={handleDeactivateSelf}
                  disabled={deactivatingSelf}
                >
                  {deactivatingSelf ? 'Désactivation...' : 'Désactiver cet appareil'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Colonne droite ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Carte Appareils */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Appareils actifs</div>
              <span style={{
                fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                color: devicesFull ? '#8C0000' : 'var(--text-muted)',
              }}>
                {devices.length} / {maxDevices}
              </span>
            </div>

            {/* Alerte limite appareils */}
            {devicesFull && (
              <div style={{
                background: 'rgba(192,48,48,.08)', border: '1px solid rgba(192,48,48,.25)',
                borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#8C0000', marginBottom: 12,
              }}>
                Cette licence autorise {maxDevices} appareils actifs. Vous pouvez désactiver un
                ancien appareil pour activer celui-ci.
              </div>
            )}

            {/* Alerte limite désactivations */}
            {deactivLeft !== null && deactivLeft <= 0 && (
              <div style={{
                background: 'rgba(192,48,48,.08)', border: '1px solid rgba(192,48,48,.25)',
                borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#8C0000', marginBottom: 12,
              }}>
                Vous avez atteint la limite de 3 désactivations d'appareils sur 30 jours.
                Contactez le support Synoria à l'adresse{' '}
                <strong>{SUPPORT_EMAIL}</strong>.
              </div>
            )}
            {deactivLeft !== null && deactivLeft > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Désactivations restantes (30 j) : <strong>{deactivLeft}</strong>
              </div>
            )}

            {devices.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Aucun appareil enregistré.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {devices.map(d => {
                  const isCurrent = d.id === license?.deviceId
                  return (
                    <div
                      key={d.id}
                      style={{
                        padding: '10px 14px', borderRadius: 10,
                        background: isCurrent ? 'rgba(74,103,65,.07)' : 'var(--surface)',
                        border: isCurrent
                          ? '1.5px solid var(--accent)'
                          : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                              {d.label}
                            </span>
                            {isCurrent && (
                              <span style={{
                                fontSize: 10, background: 'var(--accent)', color: '#fff',
                                borderRadius: 4, padding: '1px 6px', fontWeight: 700, flexShrink: 0,
                              }}>
                                cet appareil
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            {d.platform}{d.app_version ? ` · v${d.app_version}` : ''} · vu le {fmtDate(d.last_seen_at)}
                          </div>
                        </div>
                        {!isCurrent && (
                          <button
                            className="btn btn-sm"
                            style={{ color: 'var(--red)', borderColor: 'var(--red)', flexShrink: 0 }}
                            onClick={() => handleDeactivate(d.id, 'ancien_appareil')}
                            disabled={deactivatingId === d.id || (deactivLeft !== null && deactivLeft <= 0)}
                          >
                            {deactivatingId === d.id ? '…' : 'Désactiver'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Carte Mise à jour */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Mise à jour</div>
            <Row label="Version installée">
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>v{appVersion}</span>
            </Row>
            <Row label="Dernière version disponible">
              {updateInfo
                ? <span style={{
                    color: updateInfo.update_available ? '#1A3E8C' : '#1A6635',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    v{updateInfo.latest_version}{updateInfo.update_available ? ' ⬆' : ' ✓'}
                  </span>
                : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
              }
            </Row>

            {updateInfo?.update_available && (
              <div style={{
                marginTop: 12, background: 'rgba(59,126,245,.07)',
                border: '1px solid rgba(59,126,245,.25)', borderRadius: 8,
                padding: '10px 14px', fontSize: 13,
              }}>
                {updateInfo.is_required && (
                  <div style={{ fontWeight: 700, color: '#8C0000', marginBottom: 4 }}>
                    ⚠ Mise à jour requise
                  </div>
                )}
                {updateInfo.title && (
                  <div style={{ fontWeight: 600, marginBottom: updateInfo.release_notes ? 4 : 0 }}>
                    {updateInfo.title}
                  </div>
                )}
                {updateInfo.release_notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                    {updateInfo.release_notes}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleCheckUpdate} disabled={checkingUpdate}>
                {checkingUpdate ? 'Vérification...' : 'Vérifier les mises à jour'}
              </button>
              {updateInfo?.download_url && (
                <button
                  className="btn btn-sm"
                  style={{ background: '#1A3E8C', color: '#fff', border: 'none' }}
                  onClick={() => openExternal(updateInfo!.download_url!)}
                >
                  Télécharger v{updateInfo.latest_version}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Offres (si pas d'abonnement) ── */}
      {!sub && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            Choisissez votre offre
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            14 jours d'essai gratuit inclus. Aucun paiement pendant l'essai.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 260px))', gap: 16 }}>
            <OfferCard
              title="Synoria Annuel"
              price="123 €"
              period="an"
              saving="Économisez 27 %"
              note="soit 10,25 €/mois"
              loading={subscribing === PLAN_ANNUAL}
              onClick={() => handleSubscribe(PLAN_ANNUAL)}
            />
            <OfferCard
              title="Synoria 6 mois"
              price="63 €"
              period="6 mois"
              note="soit 10,50 €/mois"
              loading={subscribing === PLAN_6M}
              onClick={() => handleSubscribe(PLAN_6M)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
