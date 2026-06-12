import React, { useState, useRef, useEffect } from 'react'

interface Props {
  mode: 'setup' | 'locked'
  onUnlock: () => void
  theme?: 'light' | 'dark'
}

export default function LockScreen({ mode, onUnlock, theme = 'light' }: Props) {
  const isSetup = mode === 'setup'
  const dark = theme === 'dark'

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [attempts,  setAttempts]  = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!password) return

    if (isSetup) {
      if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return }
      if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); setConfirm(''); return }
    }

    setLoading(true)
    try {
      if (isSetup) {
        const result = await window.mtcApi.authSetup(password)
        if (result.ok) { onUnlock() }
        else { setError(result.error || 'Erreur lors de la configuration.') }
      } else {
        const ok = await window.mtcApi.authLogin(password)
        if (ok) {
          onUnlock()
        } else {
          const next = attempts + 1
          setAttempts(next)
          setError(next >= 3
            ? 'Mot de passe incorrect. Si vous avez oublié votre mot de passe, contactez le support.'
            : 'Mot de passe incorrect.')
          setPassword('')
          setTimeout(() => inputRef.current?.focus(), 50)
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur inattendue.')
    }
    setLoading(false)
  }

  // Couleurs selon le thème
  const outerBg    = dark ? '#0f0f13' : '#F0EDE8'
  const panelBg    = dark ? '#18181c' : '#ffffff'
  const cardBg     = dark ? '#1e1e24' : '#ffffff'
  const cardBorder = dark ? '#38383f' : 'rgba(74,103,65,.12)'
  const cardShadow = dark
    ? '0 8px 40px rgba(0,0,0,.5), 0 2px 10px rgba(0,0,0,.3)'
    : '0 8px 40px rgba(74,103,65,.1), 0 2px 10px rgba(0,0,0,.05)'
  const inputBg    = dark ? '#2a2a32' : '#ffffff'
  const inputBorder = dark ? '#38383f' : '#DDD8CF'
  const inputColor = dark ? '#e8e4db' : '#1C1A17'
  const textColor  = dark ? '#e8e4db' : '#1C1A17'
  const mutedColor = dark ? '#96918a' : '#7A7468'
  const hintColor  = dark ? '#62605a' : '#aaa59e'
  const infoBg     = dark ? '#122420' : 'rgba(42,122,106,.08)'
  const dividerBg  = dark ? '#38383f' : 'rgba(74,103,65,.12)'

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: 'var(--font-sans)',
      background: outerBg,
      transition: 'background .3s',
    }}>

      {/* ── PANNEAU GAUCHE — Branding ── */}
      <div style={{
        width: '42%', minWidth: 360,
        background: panelBg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
        gap: 0,
        borderRight: `1px solid ${cardBorder}`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'background .3s',
      }}>
        {/* Bande verte en haut */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #4A6741, #2A7A6A)',
        }} />

        {/* Cercle décoratif en arrière-plan */}
        <div style={{
          position: 'absolute', bottom: -120, right: -120,
          width: 380, height: 380, borderRadius: '50%',
          background: dark
            ? 'radial-gradient(circle, rgba(106,170,99,.08) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(74,103,65,.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: dark
            ? 'radial-gradient(circle, rgba(58,154,136,.07) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(42,122,106,.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <img
          src={dark ? './Synoria fond noir.png' : './Synoria.png'}
          alt="Logo Synoria"
          style={{ width: 150, height: 150, objectFit: 'contain', marginBottom: 28 }}
        />

        {/* Texte SYNORIA */}
        <img
          src={dark ? './Text Synoria fond noir.png' : './Text Synoria fond blanc.png'}
          alt="SYNORIA"
          style={{ height: 144, objectFit: 'contain', marginBottom: 20 }}
        />

        {/* Tagline */}
        <div style={{
          textAlign: 'center',
          color: mutedColor,
          fontSize: 13,
          lineHeight: 1.8,
          maxWidth: 260,
          marginBottom: 36,
        }}>
          Logiciel de gestion de dossiers patients<br />
          pour praticiens de santé
        </div>

        {/* Badge sécurité */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 18px',
          background: infoBg,
          borderRadius: 24,
          border: `1px solid rgba(42,122,106,${dark ? '.35' : '.2'})`,
          fontSize: 12, fontWeight: 600,
          color: dark ? '#3a9a88' : 'var(--teal)',
        }}>
          🔒 Données chiffrées AES-256
        </div>

        {/* Version */}
        <div style={{
          position: 'absolute', bottom: 20,
          fontSize: 11, color: hintColor,
        }}>
          v1.4.2
        </div>
      </div>

      {/* ── PANNEAU DROIT — Formulaire ── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{
          background: cardBg,
          borderRadius: 20,
          padding: '48px 52px',
          width: '100%', maxWidth: 440,
          boxShadow: cardShadow,
          border: `1px solid ${cardBorder}`,
          transition: 'background .3s',
        }}>

          {/* Titre formulaire */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 22, fontWeight: 700, color: textColor,
              fontFamily: 'var(--font-serif)', marginBottom: 8,
            }}>
              {isSetup ? 'Créer un mot de passe' : 'Accès sécurisé'}
            </div>
            <div style={{ fontSize: 13, color: mutedColor, lineHeight: 1.6 }}>
              {isSetup
                ? 'Choisissez un mot de passe fort pour chiffrer vos données patients'
                : 'Entrez votre mot de passe pour accéder à vos dossiers'}
            </div>
          </div>

          {/* Bandeau info setup */}
          {isSetup && (
            <div style={{
              background: dark ? '#122420' : 'var(--teal-light)',
              border: `1px solid rgba(42,122,106,${dark ? '.35' : '.25'})`,
              borderRadius: 10, padding: '12px 16px',
              marginBottom: 24, fontSize: 12,
              color: dark ? '#3a9a88' : 'var(--teal)', lineHeight: 1.7,
            }}>
              🔒 Ce mot de passe chiffre votre base en <strong>AES-256</strong>.<br />
              Sans lui, vos données seront illisibles. <strong>Notez-le en lieu sûr.</strong>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13, color: textColor }}>
                {isSetup ? 'Nouveau mot de passe' : 'Mot de passe'}
              </label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder={isSetup ? 'Minimum 6 caractères' : '••••••••'}
                style={{
                  width: '100%', padding: '11px 14px', fontSize: 16,
                  letterSpacing: '0.12em', borderRadius: 10, boxSizing: 'border-box',
                  border: `1.5px solid ${inputBorder}`,
                  background: inputBg, color: inputColor,
                  outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color .15s, background .3s',
                }}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
              />
            </div>

            {isSetup && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13, color: textColor }}>
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 16,
                    letterSpacing: '0.12em', borderRadius: 10, boxSizing: 'border-box',
                    border: `1.5px solid ${inputBorder}`,
                    background: inputBg, color: inputColor,
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color .15s, background .3s',
                  }}
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div style={{
                background: dark ? '#2a1515' : '#FEF0F0',
                border: `1px solid rgba(168,50,50,${dark ? '.4' : '.25'})`,
                borderRadius: 8, padding: '10px 12px',
                marginBottom: 16, fontSize: 13,
                color: dark ? '#c44444' : 'var(--red)',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !password || (isSetup && !confirm)}
              style={{
                width: '100%', padding: '14px',
                fontSize: 15, justifyContent: 'center',
                borderRadius: 10, marginTop: 4,
              }}
            >
              {loading
                ? (isSetup ? '⏳ Chiffrement en cours…' : '⏳ Vérification…')
                : (isSetup ? '🔐 Créer le mot de passe' : '🔓 Déverrouiller')}
            </button>
          </form>

          <div style={{
            marginTop: 24, fontSize: 11,
            color: hintColor, textAlign: 'center', lineHeight: 1.6,
          }}>
            {isSetup
              ? '⚠️ Attention : sans votre mot de passe, vos données seront irrécupérables.'
              : 'En cas de mot de passe oublié, contactez le support Synoria.'}
          </div>
        </div>
      </div>
    </div>
  )
}
