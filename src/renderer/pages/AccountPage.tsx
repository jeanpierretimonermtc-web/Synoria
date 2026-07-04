import React, { useState, useEffect, useCallback } from 'react'
import { useContext } from 'react'
import { ToastContext } from '../App'
import type { FullAccountState, LicenseState, DeviceInfo } from '../../shared/types'

// Noms de plan — les IDs Stripe réels sont dans les secrets Supabase
// (STRIPE_PRICE_SYNORIA_ANNUAL et STRIPE_PRICE_SYNORIA_6_MONTHS)
const PLAN_ANNUAL   = 'synoria_annual'
const PLAN_6MONTHS  = 'synoria_6_months'

type Tab = 'compte' | 'abonnement' | 'appareils'
type AuthView = 'login' | 'signup' | 'reset'

export default function AccountPage() {
  const showToast = useContext(ToastContext)
  const [tab, setTab]             = useState<Tab>('compte')
  const [authView, setAuthView]   = useState<AuthView>('login')
  const [accountState, setAccountState] = useState<FullAccountState | null>(null)
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null)
  const [devices, setDevices]     = useState<DeviceInfo[]>([])
  const [loading, setLoading]     = useState(true)
  const [verifying, setVerifying] = useState(false)

  // Formulaire auth
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [acc, lic] = await Promise.all([
        window.mtcApi.accountGetState(),
        window.mtcApi.licenseGetState(),
      ])
      setAccountState(acc)
      setLicenseState(lic)
      if (acc.isLoggedIn) {
        window.mtcApi.licenseGetDevices().then(setDevices).catch(() => {})
      }
    } catch (e: any) {
      showToast(`Erreur chargement compte : ${e?.message ?? e}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { refresh() }, [refresh])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const { ok, error } = await window.mtcApi.accountSignIn(email, password)
      if (!ok) { showToast(error ?? 'Connexion échouée', 'error'); return }
      showToast('Connecté !', 'success')
      await refresh()
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const { ok, error } = await window.mtcApi.accountSignUp(email, password)
      if (!ok) { showToast(error ?? 'Inscription échouée', 'error'); return }
      showToast('Compte créé ! Vérifiez votre email pour confirmer.', 'success')
      setAuthView('login')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const { ok, error } = await window.mtcApi.accountResetPassword(email)
      if (!ok) { showToast(error ?? 'Erreur', 'error'); return }
      showToast('Email de réinitialisation envoyé.', 'success')
      setAuthView('login')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    await window.mtcApi.accountSignOut()
    setAccountState(null)
    setDevices([])
    showToast('Déconnecté', 'success')
    await refresh()
  }

  const handleVerifyOnline = async () => {
    setVerifying(true)
    try {
      const state = await window.mtcApi.licenseVerifyOnline()
      setLicenseState(state)
      showToast('Licence vérifiée', 'success')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleSubscribe = async (plan: string) => {
    try {
      const url = await window.mtcApi.accountCreateCheckout(plan)
      // Ouvrir dans le navigateur externe
      ;(window as any).__electron_shell_openExternal?.(url)
        ?? window.open(url, '_blank')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    }
  }

  const handleBillingPortal = async () => {
    try {
      const url = await window.mtcApi.accountBillingPortal()
      ;(window as any).__electron_shell_openExternal?.(url)
        ?? window.open(url, '_blank')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    }
  }

  const handleDeactivateDevice = async (deviceId: string, reason: string = 'autre') => {
    if (!confirm('Désactiver cet appareil ? Synoria ne pourra plus s\'y utiliser.')) return
    try {
      const result = await window.mtcApi.licenseDeactivateDevice(deviceId, reason as import('../../shared/types').DeactivationReason)
      showToast('Appareil désactivé', 'success')
      setDevices(result.activeDevices)
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? e}`, 'error')
    }
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    )
  }

  // ── Non connecté : formulaire d'auth ──
  if (!accountState?.isLoggedIn) {
    return (
      <div className="page-content">
        <div className="page-header"><h1 className="page-title">Mon compte</h1></div>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className="card" style={{ padding: 32 }}>
            {authView === 'login' && (
              <>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--accent)' }}>
                  Connexion à votre compte Synoria
                </div>
                <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input className="field" type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} required />
                  <input className="field" type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
                  <button className="btn btn-primary" type="submit" disabled={authLoading}>
                    {authLoading ? 'Connexion...' : 'Se connecter'}
                  </button>
                </form>
                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAuthView('reset')}>Mot de passe oublié ?</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAuthView('signup')}>Créer un compte</button>
                </div>
              </>
            )}
            {authView === 'signup' && (
              <>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--accent)' }}>
                  Créer un compte Synoria
                </div>
                <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input className="field" type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} required />
                  <input className="field" type="password" placeholder="Mot de passe (6 caractères min.)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  <button className="btn btn-primary" type="submit" disabled={authLoading}>
                    {authLoading ? 'Création...' : 'Créer mon compte'}
                  </button>
                </form>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAuthView('login')}>Déjà un compte ? Se connecter</button>
                </div>
              </>
            )}
            {authView === 'reset' && (
              <>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--accent)' }}>
                  Réinitialiser le mot de passe
                </div>
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input className="field" type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} required />
                  <button className="btn btn-primary" type="submit" disabled={authLoading}>
                    {authLoading ? 'Envoi...' : 'Envoyer le lien'}
                  </button>
                </form>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAuthView('login')}>Retour à la connexion</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Connecté ──
  const { account, subscription, licenseStatus } = accountState

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Mon compte</h1>
        <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>Se déconnecter</button>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['compte', 'abonnement', 'appareils'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize',
            }}
          >
            {t === 'compte' ? 'Compte' : t === 'abonnement' ? 'Abonnement' : 'Appareils'}
          </button>
        ))}
      </div>

      {/* ── Onglet Compte ── */}
      {tab === 'compte' && (
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Informations du compte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <span style={{ fontWeight: 600 }}>{account?.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Statut licence</span>
                <LicenseStatusBadge status={licenseStatus} />
              </div>
              {licenseState?.graceUntil && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Grâce jusqu'au</span>
                  <span style={{ color: '#FF9F0A', fontWeight: 600 }}>
                    {new Date(licenseState.graceUntil).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              {licenseState?.tokenExpiry && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Jeton valide jusqu'au</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(licenseState.tokenExpiry).toLocaleString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleVerifyOnline} disabled={verifying}>
            {verifying ? 'Vérification...' : 'Vérifier la licence en ligne'}
          </button>
        </div>
      )}

      {/* ── Onglet Abonnement ── */}
      {tab === 'abonnement' && (
        <div style={{ maxWidth: 600 }}>
          {subscription ? (
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Votre abonnement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Statut</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{subscription.status}</span>
                </div>
                {subscription.trialEnd && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fin d'essai</span>
                    <span>{new Date(subscription.trialEnd).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {subscription.currentPeriodEnd && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Prochain renouvellement</span>
                    <span>{new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <div style={{ padding: '8px 12px', background: 'rgba(255,99,0,.1)', borderRadius: 8, color: '#FF6300', fontSize: 13 }}>
                    Résiliation programmée à la fin de la période
                  </div>
                )}
              </div>
              <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={handleBillingPortal}>
                Gérer mon abonnement →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
                Aucun abonnement actif. Commencez votre essai gratuit de 14 jours.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <PriceCard
                  title="Synoria Annuel"
                  price="123 €/an"
                  saving="Économisez 27 %"
                  onSubscribe={() => handleSubscribe(PLAN_ANNUAL)}
                />
                <PriceCard
                  title="Synoria 6 mois"
                  price="63 €/6 mois"
                  onSubscribe={() => handleSubscribe(PLAN_6MONTHS)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Appareils ── */}
      {tab === 'appareils' && (
        <div style={{ maxWidth: 580 }}>
          <div className="card" style={{ padding: 24 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>Appareils actifs</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, marginTop: 0 }}>
              Maximum {licenseState?.maxDevices ?? 2} appareils simultanés. Limite de 3 désactivations / 30 jours.
            </p>
            {devices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun appareil enregistré.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {devices.map(d => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: 'var(--bg)', borderRadius: 10,
                      border: d.id === licenseState?.deviceId ? '2px solid var(--accent)' : '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {d.label}
                        {d.id === licenseState?.deviceId && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>
                            cet appareil
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {d.platform} · Vu le {new Date(d.last_seen_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    {d.id !== licenseState?.deviceId && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                        onClick={() => handleDeactivateDevice(d.id, 'ancien_appareil')}
                      >
                        Désactiver
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    active:         { label: 'Actif',       bg: 'rgba(48,209,88,.15)',  color: '#1A8C3D' },
    trialing:       { label: 'Essai',       bg: 'rgba(90,142,247,.15)', color: '#2A5EC4' },
    past_due_grace: { label: 'Grâce',       bg: 'rgba(255,159,10,.15)', color: '#A86800' },
    restricted:     { label: 'Restreint',   bg: 'rgba(255,59,48,.15)',  color: '#C00' },
    unknown:        { label: 'Inconnu',     bg: 'rgba(142,142,147,.15)',color: '#666' },
  }
  const c = config[status] ?? config.unknown
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
      {c.label}
    </span>
  )
}

function PriceCard({ title, price, saving, onSubscribe }: { title: string; price: string; saving?: string; onSubscribe: () => void }) {
  return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {saving && <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>{saving}</div>}
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginBottom: 16 }}>{price}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Essai 14 jours gratuit • Carte requise</div>
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={onSubscribe}>
        Commencer l'essai
      </button>
    </div>
  )
}
