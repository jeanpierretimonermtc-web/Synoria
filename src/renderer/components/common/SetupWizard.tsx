import React, { useState } from 'react'

interface Props {
  onComplete: () => void
  theme?: 'light' | 'dark'
}

export default function SetupWizard({ onComplete, theme = 'light' }: Props) {
  const dark = theme === 'dark'
  const [step,       setStep]       = useState(1)
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [specialty,  setSpecialty]  = useState('')
  const [backupPath, setBackupPath] = useState('')
  const [saving,     setSaving]     = useState(false)

  const bg      = dark ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.5)'
  const cardBg  = dark ? '#1e1e26' : '#ffffff'
  const text    = dark ? '#e8e4db' : '#1C1A17'
  const muted   = dark ? '#96918a' : '#6B7280'
  const border  = dark ? '#38383f' : '#E5E7EB'
  const inputBg = dark ? '#2a2a32' : '#ffffff'

  const browsePath = async () => {
    const path = await window.mtcApi.showOpenDialog({
      filters: [], properties: ['openDirectory', 'createDirectory'],
    })
    if (path) setBackupPath(path)
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const partial: Record<string, string> = {}
      if (name)    partial.rgpdPractitionerName = name
      if (email)   partial.rgpdPractitionerEmail = email
      if (backupPath) {
        partial.backupGeneralPath  = backupPath
        partial.backupPatientPath  = backupPath
        partial.autoBackupOnClose  = 'true' as any
      }
      if (Object.keys(partial).length > 0) {
        await window.mtcApi.saveSettings(partial as any)
      }
    } catch {}
    setSaving(false)
    localStorage.setItem('synoria-wizard-done', '1')
    onComplete()
  }

  const STEPS = [
    { num: 1, label: 'Votre profil' },
    { num: 2, label: 'Sauvegarde' },
    { num: 3, label: 'Spécialité' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        background: cardBg, borderRadius: 20,
        padding: '44px 52px', width: '100%', maxWidth: 520,
        boxShadow: '0 32px 80px rgba(0,0,0,.28)',
        border: `1px solid ${border}`,
      }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Configuration initiale
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: text, fontFamily: 'var(--font-serif)', marginBottom: 6 }}>
            Bienvenue dans Synoria 🌿
          </div>
          <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>
            Quelques étapes rapides pour personnaliser votre espace de travail.
          </div>
        </div>

        {/* Indicateur d'étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {STEPS.map(s => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: step === s.num ? 'var(--accent)' : step > s.num ? 'var(--accent-mid)' : border,
                color: step >= s.num ? '#fff' : muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
                transition: 'background .2s',
              }}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span style={{ fontSize: 12, color: step === s.num ? text : muted, fontWeight: step === s.num ? 700 : 400 }}>
                {s.label}
              </span>
              {s.num < STEPS.length && (
                <div style={{ width: 24, height: 1, background: border, marginLeft: 4 }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Étape 1 : Profil ── */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 20 }}>
              Votre profil praticien
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: muted, marginBottom: 5 }}>
                Nom complet *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dr Jean-Pierre Timoner"
                autoFocus
                style={{ width: '100%', padding: '10px 13px', borderRadius: 8, border: `1.5px solid ${border}`, background: inputBg, color: text, fontSize: 14 }}
              />
              <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                Apparaît sur vos factures et le registre RGPD.
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: muted, marginBottom: 5 }}>
                Email professionnel
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contact@cabinet.fr"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 8, border: `1.5px solid ${border}`, background: inputBg, color: text, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: muted, marginBottom: 5 }}>
                Spécialité / Activité
              </label>
              <input
                type="text"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                placeholder="Médecine Traditionnelle Chinoise, Kinésiologie…"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 8, border: `1.5px solid ${border}`, background: inputBg, color: text, fontSize: 14 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={onComplete} style={{ background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                Passer le guide
              </button>
              <button
                className="btn btn-primary"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
                style={{ padding: '10px 28px' }}
              >
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 2 : Sauvegarde ── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>
              Dossier de sauvegarde
            </div>
            <div style={{
              background: dark ? '#1a2a1e' : '#F0FDF4',
              border: `1px solid ${dark ? '#2d5a3d' : '#BBF7D0'}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              fontSize: 12, color: dark ? '#6ee7b7' : '#166534',
              lineHeight: 1.6,
            }}>
              💡 Synoria peut sauvegarder automatiquement vos données à la fermeture.
              Choisissez un dossier sur un disque externe, un NAS ou un dossier synchronisé (Dropbox, OneDrive…).
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: muted, marginBottom: 8 }}>
                Dossier de sauvegarde
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={backupPath}
                  readOnly
                  placeholder="Cliquez sur Choisir…"
                  style={{ flex: 1, padding: '10px 13px', borderRadius: 8, border: `1.5px solid ${border}`, background: inputBg, color: text, fontSize: 13 }}
                />
                <button className="btn btn-secondary" onClick={browsePath} style={{ flexShrink: 0 }}>
                  Choisir…
                </button>
              </div>
              {backupPath && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
                  ✓ La sauvegarde automatique à la fermeture sera activée
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: muted, fontSize: 13, cursor: 'pointer' }}>
                ← Retour
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  Passer cette étape
                </button>
                <button className="btn btn-primary" onClick={() => setStep(3)} style={{ padding: '10px 28px' }}>
                  Suivant →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Spécialité / Plugin ── */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>
              Formulaire d'anamnèse
            </div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 20, lineHeight: 1.6 }}>
              Synoria s'adapte à votre spécialité grâce aux <strong>plugins</strong>.
              Vous pouvez en importer un maintenant ou le configurer plus tard dans <strong>Paramètres → Plugin</strong>.
            </div>

            {/* Grille de plugins disponibles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: '🌿', name: 'MTC — Jean-Pierre Timoner', desc: 'Formulaire MTC complet (langue, pouls, 5 éléments, points…)', file: 'mtc_jp.plugin.json' },
                { icon: '⚡', name: 'Kinésiologie', desc: 'Bilan kinésiologique, tests musculaires, émotions', file: 'kinesio.plugin.json' },
                { icon: '🦴', name: 'Ostéopathie', desc: 'Anamnèse ostéopathique, bilan postural, tests', file: 'osteopathie.plugin.json' },
                { icon: '📋', name: 'Mode simple', desc: 'Formulaire générique sans plugin — toutes spécialités', file: null },
              ].map(p => (
                <div key={p.name} style={{
                  border: `1.5px solid ${border}`, borderRadius: 10,
                  padding: '12px 14px', cursor: 'default',
                  background: dark ? '#25252d' : '#FAFAFA',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: text, marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>{p.desc}</div>
                </div>
              ))}
            </div>

            <div style={{
              background: dark ? '#1a1e2a' : '#EFF6FF',
              border: `1px solid ${dark ? '#2d3d6a' : '#BFDBFE'}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 24,
              fontSize: 12, color: dark ? '#93c5fd' : '#1D4ED8',
            }}>
              ℹ️ Pour activer un plugin : <strong>Paramètres → Plugin → Importer un plugin</strong><br />
              Les fichiers .plugin.json sont disponibles dans le dossier d'installation de Synoria.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: muted, fontSize: 13, cursor: 'pointer' }}>
                ← Retour
              </button>
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={handleFinish}
                style={{ padding: '12px 36px', fontSize: 14 }}
              >
                {saving ? '⏳ Enregistrement…' : '✓ Commencer à utiliser Synoria'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
