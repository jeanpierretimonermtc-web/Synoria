import React, { useState, useEffect, useRef, useContext } from 'react'
import { ToastContext } from '../App'
import { UploadIcon, UserIcon } from '../components/common/Icon'

// ── Textarea auto-extensible (s'adapte à la longueur du contenu) ─────────────

function AutoTextarea({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      style={{ resize: 'none', overflow: 'hidden', minHeight: 36 }}
    />
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const showToast = useContext(ToastContext)
  const [loaded,  setLoaded]  = useState(false)
  const [saving,  setSaving]  = useState(false)

  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [activity,     setActivity]     = useState('')
  const [address,      setAddress]      = useState('')
  const [siret,        setSiret]        = useState('')
  const [email,        setEmail]        = useState('')
  const [ape,          setApe]          = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [logoPath,     setLogoPath]     = useState('')
  const [logoDataUrl,  setLogoDataUrl]  = useState<string | null>(null)

  // Charge les paramètres au montage
  useEffect(() => {
    window.mtcApi.getSettings().then(s => {
      setFirstName(s.practitionerFirstName    || '')
      setLastName(s.practitionerLastName      || '')
      setActivity(s.practitionerActivity      || '')
      setAddress(s.practitionerAddress        || '')
      setSiret(s.practitionerSiret            || '')
      setEmail(s.practitionerEmail            || '')
      setApe(s.practitionerApe                || '')
      setPaymentTerms(s.practitionerPaymentTerms || '')
      setLogoPath(s.practitionerLogoPath      || '')
      setLoaded(true)
    })
  }, [])

  // Recharge l'aperçu logo via IPC (évite les problèmes de spaces dans le chemin)
  useEffect(() => {
    if (!logoPath) { setLogoDataUrl(null); return }
    window.mtcApi.readFileDataUrl(logoPath).then(setLogoDataUrl)
  }, [logoPath])

  const handleLogoSelect = async () => {
    const path = await window.mtcApi.showOpenDialog({
      filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }],
    })
    if (path) setLogoPath(path)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.mtcApi.saveSettings({
        practitionerFirstName:    firstName,
        practitionerLastName:     lastName,
        practitionerActivity:     activity,
        practitionerAddress:      address,
        practitionerSiret:        siret,
        practitionerEmail:        email,
        practitionerApe:          ape,
        practitionerPaymentTerms: paymentTerms,
        practitionerLogoPath:     logoPath,
      })
      showToast('Profil enregistré ✓', 'success')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
    }
    setSaving(false)
  }

  const initials   = [firstName, lastName].map(s => s.trim()[0] || '').filter(Boolean).join('').toUpperCase()
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || null

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '28px 24px' }}>

      {/* ── Bannière identité ── */}
      <div style={{
        background: 'linear-gradient(135deg, #2A7A6A 0%, #4A6741 100%)',
        borderRadius: 18,
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(42,122,106,.25)',
      }}>
        <div style={{
          position: 'absolute', top: -50, right: -50,
          width: 220, height: 220, borderRadius: '50%',
          background: 'rgba(255,255,255,.07)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, right: 100,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(255,255,255,.04)', pointerEvents: 'none',
        }} />

        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,.18)',
          border: '2px solid rgba(255,255,255,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 26, fontWeight: 800, color: '#fff',
          letterSpacing: '-1px',
        }}>
          {initials
            ? initials
            : <span style={{ color: 'rgba(255,255,255,.7)', display: 'flex' }}><UserIcon size={28} /></span>
          }
        </div>

        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-serif)', marginBottom: 4 }}>
            {displayName ?? <span style={{ opacity: .55, fontStyle: 'italic', fontWeight: 400, fontSize: 16 }}>Nom non renseigné</span>}
          </div>
          {activity
            ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>{activity}</div>
            : <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontStyle: 'italic' }}>Activité non renseignée</div>
          }
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginTop: 10,
            background: 'rgba(255,255,255,.13)',
            border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 20,
            padding: '3px 11px',
            fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: 600,
          }}>
            🧾 Affiché sur vos factures clients
          </div>
        </div>
      </div>

      {/* ── Identité professionnelle ── */}
      <ProfileSection icon="👤" title="Identité professionnelle">
        <div className="grid2">
          <div className="field">
            <label>Prénom</label>
            <AutoTextarea value={firstName} onChange={setFirstName} placeholder="Prénom" />
          </div>
          <div className="field">
            <label>Nom</label>
            <AutoTextarea value={lastName} onChange={setLastName} placeholder="Nom" />
          </div>
        </div>
        <div className="field">
          <label>Activité / Spécialité</label>
          <AutoTextarea
            value={activity}
            onChange={setActivity}
            placeholder="Ex. : Ostéopathie, Kinésiologie, Acupuncture..."
          />
        </div>
        <div className="field">
          <label>Adresse du cabinet</label>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder={'Rue, numéro\nCode postal Ville'}
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
      </ProfileSection>

      {/* ── Informations légales ── */}
      <ProfileSection icon="📋" title="Informations légales">
        <div className="grid2">
          <div className="field">
            <label>N° SIRET</label>
            <AutoTextarea value={siret} onChange={setSiret} placeholder="XXX XXX XXX XXXXX" />
          </div>
          <div className="field">
            <label>Code APE</label>
            <AutoTextarea value={ape} onChange={setApe} placeholder="XXXXZ" />
          </div>
        </div>
        <div className="field">
          <label>Email professionnel</label>
          <AutoTextarea value={email} onChange={setEmail} placeholder="cabinet@exemple.fr" />
        </div>
      </ProfileSection>

      {/* ── Facturation ── */}
      <ProfileSection icon="🧾" title="Facturation">
        <div className="field">
          <label>Modalités de règlement</label>
          <AutoTextarea
            value={paymentTerms}
            onChange={setPaymentTerms}
            placeholder="Ex. : Espèces, Chèque, Virement bancaire..."
          />
        </div>

        {/* Zone logo */}
        <div className="field">
          <label>Logo</label>
          <div style={{
            border: `2px dashed ${logoPath ? 'var(--teal)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: logoPath ? 'var(--teal-light)' : 'var(--bg)',
            transition: 'border-color .2s, background .2s',
          }}>
            {/* Aperçu logo */}
            <div style={{
              width: 64, height: 64, flexShrink: 0,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {logoDataUrl
                ? <img src={logoDataUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 22, opacity: .4 }}>🖼️</span>
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {logoPath ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', marginBottom: 2 }}>
                    Logo sélectionné
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)', marginBottom: 10,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {logoPath}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={handleLogoSelect}>
                      <UploadIcon size={12} /> Changer
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => { setLogoPath(''); setLogoDataUrl(null) }}
                      style={{ color: 'var(--red)' }}
                    >
                      Retirer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 3 }}>
                    Aucun logo sélectionné
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 10 }}>
                    JPG ou PNG · fond blanc ou transparent · format carré idéal
                  </div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={handleLogoSelect}>
                    <UploadIcon size={12} /> Choisir un logo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </ProfileSection>

      {/* ── Bouton sauvegarder ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, paddingBottom: 16 }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '12px 32px', fontSize: 14 }}
        >
          {saving ? '⏳ Enregistrement…' : '✓ Enregistrer le profil'}
        </button>
      </div>

    </div>
  )
}

/* ── Composant section ── */
function ProfileSection({ icon, title, children }: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      border: '1px solid var(--border-soft)',
      overflow: 'hidden',
      marginBottom: 20,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '13px 20px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--bg)',
      }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 20px 6px' }}>
        {children}
      </div>
    </div>
  )
}
