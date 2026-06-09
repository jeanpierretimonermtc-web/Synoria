import React, { useEffect, useState, useContext } from 'react'
import type { AppSettings, BackupInfo, GoogleCalendarInfo, GCalCalendar } from '../../shared/types'
import type { PluginDefinition } from '../../shared/pluginTypes'
import { ToastContext } from '../App'

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? 'var(--accent)' : 'var(--red)', marginRight: 6,
    }} />
  )
}

// ── Onglets de la sidebar ─────────────────────────────────────────

type Tab = 'sauvegardes' | 'facturation' | 'rgpd' | 'securite' | 'plugin' | 'gcal'

const TABS: { id: Tab; icon: string; label: string; desc: string }[] = [
  { id: 'sauvegardes', icon: '💾', label: 'Sauvegardes',  desc: 'Chemins, automatisation'     },
  { id: 'facturation', icon: '🧾', label: 'Facturation',  desc: 'Factures, numérotation'       },
  { id: 'rgpd',        icon: '🔒', label: 'RGPD',         desc: 'Notice, consentements'        },
  { id: 'securite',    icon: '🔐', label: 'Sécurité',     desc: 'Mot de passe, mise à jour'    },
  { id: 'plugin',      icon: '🔌', label: 'Plugin',       desc: 'Formulaire de spécialité'     },
  { id: 'gcal',        icon: '📅', label: 'Google Cal.',  desc: 'Sync calendrier téléphone'    },
]

// ── PAGE ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const showToast = useContext(ToastContext)

  // État général
  const [settings, setSettings]   = useState<AppSettings | null>(null)
  const [info, setInfo]           = useState<BackupInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('sauvegardes')

  // Sécurité / MAJ
  const [appVersion, setAppVersion] = useState('')
  const [updatePath, setUpdatePath] = useState('')
  const [updating, setUpdating]     = useState(false)
  const [oldPwd,     setOldPwd]     = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError,   setPwdError]   = useState('')
  const [pwdOk,      setPwdOk]      = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)

  // Plugin
  const [activePlugin,  setActivePlugin]  = useState<PluginDefinition | null>(null)
  const [pluginLoading, setPluginLoading] = useState(false)
  const [pluginError,   setPluginError]   = useState('')

  // Google Calendar
  const [gcalInfo,      setGcalInfo]      = useState<GoogleCalendarInfo | null>(null)
  const [gcalClientId,  setGcalClientId]  = useState('')
  const [gcalClientSec, setGcalClientSec] = useState('')
  const [gcalCalendars, setGcalCalendars] = useState<GCalCalendar[]>([])
  const [gcalLoading,   setGcalLoading]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, i] = await Promise.all([window.mtcApi.getSettings(), window.mtcApi.getBackupInfo()])
      setSettings(s); setInfo(i)
    } catch { showToast('Erreur chargement paramètres', 'error') }
    setLoading(false)
  }

  const loadGcalStatus = async () => {
    try { setGcalInfo(await window.mtcApi.gcalStatus()) } catch {}
  }

  const handleGcalConnect = async () => {
    if (!gcalClientId.trim() || !gcalClientSec.trim()) {
      showToast('Renseignez Client ID et Client Secret', 'error'); return
    }
    setGcalLoading(true)
    try {
      await window.mtcApi.gcalConnect(gcalClientId.trim(), gcalClientSec.trim())
      await loadGcalStatus()
      setGcalClientId(''); setGcalClientSec('')
      showToast('Connecté à Google Calendar ✓', 'success')
      // Charge la liste des calendriers
      const cals = await window.mtcApi.gcalListCalendars()
      setGcalCalendars(cals)
    } catch (e: any) {
      showToast(`Connexion échouée : ${e?.message || e}`, 'error')
    }
    setGcalLoading(false)
  }

  const handleGcalDisconnect = async () => {
    if (!confirm('Déconnecter Google Calendar ? Les futurs RDV ne seront plus synchronisés.')) return
    await window.mtcApi.gcalDisconnect()
    setGcalInfo(null); setGcalCalendars([])
    showToast('Déconnecté de Google Calendar', 'success')
  }

  const handleGcalLoadCalendars = async () => {
    setGcalLoading(true)
    try {
      const cals = await window.mtcApi.gcalListCalendars()
      setGcalCalendars(cals)
    } catch (e: any) {
      showToast(`Erreur chargement calendriers : ${e?.message || e}`, 'error')
    }
    setGcalLoading(false)
  }

  const handleGcalSetCalendar = async (id: string, name: string) => {
    await window.mtcApi.gcalSetCalendar(id, name)
    await loadGcalStatus()
    showToast(`Calendrier "${name}" sélectionné ✓`, 'success')
  }

  useEffect(() => {
    load()
    window.mtcApi.getAppVersion().then(setAppVersion).catch(() => {})
    window.mtcApi.pluginGet().then(p => setActivePlugin(p || null)).catch(() => {})
    loadGcalStatus()
  }, [])

  // ── Helpers save ────────────────────────────────────────────────
  const save = async (partial: Partial<AppSettings>) => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await window.mtcApi.saveSettings(partial)
      setSettings(updated)
      showToast('Enregistré ✓', 'success')
    } catch { showToast('Erreur sauvegarde', 'error') }
    setSaving(false)
  }

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    save({ [key]: value })
  }

  const browsePath = async (key: 'backupPatientPath' | 'backupGeneralPath') => {
    const path = await window.mtcApi.showOpenDialog({ filters: [] })
    if (path) set(key, path)
  }

  // ── Handlers ────────────────────────────────────────────────────
  const handleGeneralBackup = async () => {
    setBackingUp(true)
    try {
      const path = await window.mtcApi.exportGeneralBackup()
      showToast('Sauvegarde générale créée ✓', 'success')
      const [newInfo, updated] = await Promise.all([window.mtcApi.getBackupInfo(), window.mtcApi.getSettings()])
      setInfo(newInfo); setSettings(updated)
      await window.mtcApi.openPath(path)
    } catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error') }
    setBackingUp(false)
  }

  const handleImport = async () => {
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Sauvegarde MTC', extensions: ['enc', 'json'] }] })
    if (!path) return
    try {
      const result = await window.mtcApi.importBackupJson(path)
      showToast(`Import terminé ✓ — ${result.patientsUpserted} patient(s), ${result.sessionsUpserted} séance(s)${result.errors.length ? ` (${result.errors.length} ignoré(s))` : ''}`, 'success')
      window.location.reload()
    } catch (e: any) { showToast(`Erreur import : ${e?.message || e}`, 'error') }
  }

  const handleChangePassword = async () => {
    setPwdError(''); setPwdOk(false)
    if (!oldPwd || !newPwd)      { setPwdError('Tous les champs sont obligatoires.'); return }
    if (newPwd.length < 6)       { setPwdError('Le nouveau mot de passe doit faire au moins 6 caractères.'); return }
    if (newPwd !== confirmPwd)   { setPwdError('Les mots de passe ne correspondent pas.'); return }
    setPwdLoading(true)
    const result = await window.mtcApi.authChangePassword(oldPwd, newPwd)
    if (result.ok) { setPwdOk(true); setOldPwd(''); setNewPwd(''); setConfirmPwd('') }
    else { setPwdError(result.error || 'Erreur.') }
    setPwdLoading(false)
  }

  const handleSelectUpdate = async () => {
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Installateur MTC', extensions: ['exe'] }] })
    if (path) setUpdatePath(path)
  }

  const handleLaunchUpdate = async () => {
    if (!updatePath) return
    if (!confirm('L\'application va se fermer pour lancer l\'installation.\n\nVos données ne seront pas supprimées.\n\nContinuer ?')) return
    setUpdating(true)
    try { await window.mtcApi.launchInstaller(updatePath) }
    catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error'); setUpdating(false) }
  }

  const handleImportPlugin = async () => {
    setPluginError('')
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Plugin MTC', extensions: ['json'] }] })
    if (!path) return
    setPluginLoading(true)
    try {
      const plugin = await window.mtcApi.pluginImport(path)
      await window.mtcApi.pluginSet(plugin)
      setActivePlugin(plugin)
      showToast(`Plugin "${plugin.name}" v${plugin.version} installé ✓`, 'success')
    } catch (e: any) { setPluginError(e?.message || 'Erreur import plugin.') }
    setPluginLoading(false)
  }

  const handleRemovePlugin = async () => {
    if (!confirm('Supprimer le plugin et revenir au formulaire MTC intégré ?')) return
    await window.mtcApi.pluginRemove()
    setActivePlugin(null)
    showToast('Plugin supprimé — formulaire MTC restauré', 'success')
  }

  if (loading || !settings) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', flexDirection: 'column', gap: 12 }}>
        <div className="loading-dots"><span /><span /><span /></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>
      </div>
    )
  }

  // ── RENDU PRINCIPAL ──────────────────────────────────────────────
  return (
    <div className="settings-layout">

      {/* ── SIDEBAR ── */}
      <aside className="settings-sidebar">
        <div className="settings-sidebar-header">
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
            ⚙️ Paramètres
          </div>
        </div>

        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`settings-sidebar-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="settings-sidebar-icon">{tab.icon}</span>
            <div>
              <div className="settings-sidebar-label">{tab.label}</div>
              <div className="settings-sidebar-desc">{tab.desc}</div>
            </div>
          </button>
        ))}
      </aside>

      {/* ── CONTENU ── */}
      <div className="settings-content">

        {/* ════ SAUVEGARDES ════ */}
        {activeTab === 'sauvegardes' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">💾 Sauvegardes</div>
              <div className="settings-tab-desc">Chemins de destination et automatisation des sauvegardes chiffrées</div>
            </div>

            {/* Sauvegarde générale */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-green">💾</span>
                Sauvegarde générale (base complète)
              </div>
              <div className="settings-path-row">
                <label className="settings-label">Dossier de destination</label>
                <div className="settings-path-input-wrap">
                  <input type="text" value={settings.backupGeneralPath}
                    onChange={e => setSettings({ ...settings, backupGeneralPath: e.target.value })}
                    onBlur={e => save({ backupGeneralPath: e.target.value })}
                    className="settings-path-input" />
                  <button className="btn btn-secondary btn-sm" onClick={() => browsePath('backupGeneralPath')}>📁</button>
                </div>
              </div>
              {info && (
                <div className="settings-info-row">
                  <div className="settings-info-block">
                    <StatusDot ok={info.general.accessible} />
                    <span style={{ fontWeight: 600, color: info.general.accessible ? 'var(--accent)' : 'var(--red)' }}>
                      {info.general.accessible ? 'Accessible' : 'Inaccessible'}
                    </span>
                  </div>
                  <div className="settings-info-block">
                    <span className="detail-label">Dernière sauvegarde</span>
                    <span>{fmtDate(info.general.lastBackup)}</span>
                  </div>
                  <div className="settings-info-block">
                    <span className="detail-label">Fichiers</span><span>{info.general.fileCount}</span>
                  </div>
                  <div className="settings-info-block">
                    <span className="detail-label">Taille</span><span>{info.general.sizeFormatted}</span>
                  </div>
                </div>
              )}
              <div className="settings-actions">
                <button className="btn btn-primary btn-sm" onClick={handleGeneralBackup} disabled={backingUp}>
                  {backingUp ? '⏳ Sauvegarde…' : '💾 Sauvegarder maintenant'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.mtcApi.openBackupFolder('general')}>
                  📂 Ouvrir le dossier
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleImport}>
                  📥 Importer une sauvegarde
                </button>
              </div>
              <div className="settings-enc-note">
                🔒 Sauvegardes chiffrées AES-256-GCM · Format : <code>backup-global-YYYY-MM-DD-HHhMM.json.enc</code>
              </div>
            </div>

            {/* Sauvegarde patients */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">👤</span>
                Sauvegarde individuelle patients
              </div>
              <div className="settings-path-row">
                <label className="settings-label">Dossier de destination</label>
                <div className="settings-path-input-wrap">
                  <input type="text" value={settings.backupPatientPath}
                    onChange={e => setSettings({ ...settings, backupPatientPath: e.target.value })}
                    onBlur={e => save({ backupPatientPath: e.target.value })}
                    className="settings-path-input" />
                  <button className="btn btn-secondary btn-sm" onClick={() => browsePath('backupPatientPath')}>📁</button>
                </div>
              </div>
              {info && (
                <div className="settings-info-row">
                  <div className="settings-info-block">
                    <StatusDot ok={info.patient.accessible} />
                    <span style={{ fontWeight: 600, color: info.patient.accessible ? 'var(--accent)' : 'var(--red)' }}>
                      {info.patient.accessible ? 'Accessible' : 'Inaccessible'}
                    </span>
                  </div>
                  <div className="settings-info-block">
                    <span className="detail-label">Dossiers patients</span><span>{info.patient.patientFolderCount}</span>
                  </div>
                  <div className="settings-info-block">
                    <span className="detail-label">Taille</span><span>{info.patient.sizeFormatted}</span>
                  </div>
                </div>
              )}
              <div className="settings-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => window.mtcApi.openBackupFolder('patient')}>
                  📂 Ouvrir le dossier
                </button>
              </div>
              <div className="settings-enc-note">
                📁 Structure : <code>DUPONT_Jean/DUPONT_Jean_2026-05-28.xlsx</code> + <code>.json.enc</code><br />
                Les exports depuis les pages Séances sont sauvegardés ici automatiquement.
              </div>
            </div>

            {/* Automatisation */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">🔄</span>
                Automatisation
              </div>
              <div className="settings-toggle-list">
                <label className="settings-toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Sauvegarde à la fermeture</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sauvegarde générale chiffrée à chaque fermeture de l'appli</div>
                  </div>
                  <div className={`settings-toggle ${settings.autoBackupOnClose ? 'on' : ''}`}
                    onClick={() => set('autoBackupOnClose', !settings.autoBackupOnClose)} />
                </label>
                <label className="settings-toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Sauvegarde quotidienne automatique</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Une sauvegarde par jour au démarrage (si pas encore faite aujourd'hui)</div>
                  </div>
                  <div className={`settings-toggle ${settings.autoBackupDaily ? 'on' : ''}`}
                    onClick={() => set('autoBackupDaily', !settings.autoBackupDaily)} />
                </label>
              </div>
              <div className="settings-retention-row">
                <label className="settings-label">Conserver les sauvegardes pendant</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={7} max={365} step={1}
                    value={settings.backupRetentionDays}
                    onChange={e => setSettings({ ...settings, backupRetentionDays: Number(e.target.value) })}
                    onMouseUp={e => save({ backupRetentionDays: Number((e.target as HTMLInputElement).value) })}
                    style={{ width: 200 }} />
                  <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 60 }}>
                    {settings.backupRetentionDays} jours
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Les fichiers plus anciens sont supprimés automatiquement
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ FACTURATION ════ */}
        {activeTab === 'facturation' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">🧾 Facturation</div>
              <div className="settings-tab-desc">Chemin de sauvegarde des factures et numérotation</div>
            </div>
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-amber">🧾</span>
                Dossier de sauvegarde des factures
              </div>
              <div className="settings-path-row">
                <label className="settings-label">Dossier de destination</label>
                <div className="settings-path-input-wrap">
                  <input type="text" value={settings.invoicePath || ''}
                    onChange={e => setSettings({ ...settings, invoicePath: e.target.value })}
                    onBlur={e => save({ invoicePath: e.target.value })}
                    className="settings-path-input" />
                  <button className="btn btn-secondary btn-sm" onClick={async () => {
                    const path = await window.mtcApi.showOpenDialog({ filters: [] })
                    if (path) save({ invoicePath: path })
                  }}>📁</button>
                </div>
              </div>
              <div className="settings-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.mtcApi.openPath(settings.invoicePath || '')}>
                  📂 Ouvrir le dossier factures
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-amber">🔢</span>
                Numérotation des factures
              </div>
              <div style={{ marginBottom: 6 }}>
                <label className="settings-label">Prochain numéro de facture</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 18 }}>
                    {new Date().getFullYear()}-
                  </span>
                  <input
                    type="number" min={1} step={1}
                    value={(settings.lastInvoiceNumber || 0) + 1}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v) && v >= 1) setSettings({ ...settings, lastInvoiceNumber: v - 1 })
                    }}
                    onBlur={e => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v) && v >= 1) {
                        save({ lastInvoiceNumber: v - 1 })
                        showToast('Numérotation mise à jour ✓', 'success')
                      }
                    }}
                    style={{ width: 120, fontWeight: 700, fontSize: 18, color: 'var(--amber)', textAlign: 'center' }}
                  />
                </div>
              </div>
              <div className="settings-enc-note">
                Modifiez ce numéro si vous avez déjà émis des factures avant ce logiciel.
                La prochaine facture générée portera ce numéro.
                La numérotation repart à 1 chaque année civile.
              </div>
            </div>
          </div>
        )}

        {/* ════ RGPD ════ */}
        {activeTab === 'rgpd' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">🔒 RGPD</div>
              <div className="settings-tab-desc">Coordonnées du praticien, notice patient, durée de conservation</div>
            </div>
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">🔒</span>
                Informations du praticien
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Utilisées dans la notice remise aux patients et dans le registre des traitements (Art. 30 RGPD).
              </p>
              <div className="grid2">
                <div className="field" style={{ margin: 0 }}>
                  <label>Nom du praticien / cabinet</label>
                  <input type="text" value={settings.rgpdPractitionerName || ''}
                    onChange={e => setSettings({ ...settings, rgpdPractitionerName: e.target.value })}
                    onBlur={e => save({ rgpdPractitionerName: e.target.value })}
                    placeholder="Jean-Pierre Timoner MTC" />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Email du praticien</label>
                  <input type="email" value={settings.rgpdPractitionerEmail || ''}
                    onChange={e => setSettings({ ...settings, rgpdPractitionerEmail: e.target.value })}
                    onBlur={e => save({ rgpdPractitionerEmail: e.target.value })}
                    placeholder="email@exemple.com" />
                </div>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">⏰</span>
                Durée de conservation des données
              </div>
              <div className="settings-retention-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <input type="range" min={1} max={30} step={1}
                    value={settings.dataRetentionYears ?? 10}
                    onChange={e => setSettings({ ...settings, dataRetentionYears: Number(e.target.value) })}
                    onMouseUp={e => save({ dataRetentionYears: Number((e.target as HTMLInputElement).value) })}
                    style={{ width: 200 }} />
                  <span style={{ fontWeight: 700, color: 'var(--teal)', minWidth: 80, fontSize: 16 }}>
                    {settings.dataRetentionYears ?? 10} ans
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Une alerte s'affiche dans la page 🔒 RGPD pour les patients sans activité depuis cette durée.
                </div>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">📄</span>
                Notice d'information patient (Art. 13)
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Ce texte est remis à chaque nouveau patient pour l'informer du traitement de ses données.
                Modifiable librement, imprimable depuis la page RGPD.
              </p>
              <div className="field">
                <textarea value={settings.rgpdNotice || ''}
                  onChange={e => setSettings({ ...settings, rgpdNotice: e.target.value })}
                  onBlur={e => save({ rgpdNotice: e.target.value })}
                  style={{ minHeight: 160, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6 }} />
              </div>
            </div>
          </div>
        )}

        {/* ════ SÉCURITÉ ════ */}
        {activeTab === 'securite' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">🔐 Sécurité</div>
              <div className="settings-tab-desc">Mot de passe, chiffrement des données, mise à jour du logiciel</div>
            </div>

            {/* Mot de passe */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal)' }}>🔐</span>
                Changer le mot de passe
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Le mot de passe protège l'accès et chiffre la base de données en <strong>AES-256-GCM</strong>.
                Demandé à chaque démarrage et après 20 min d'inactivité.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Mot de passe actuel</label>
                  <input type="password" value={oldPwd}
                    onChange={e => { setOldPwd(e.target.value); setPwdError(''); setPwdOk(false) }}
                    placeholder="••••••••" autoComplete="current-password" />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Nouveau mot de passe</label>
                  <input type="password" value={newPwd}
                    onChange={e => { setNewPwd(e.target.value); setPwdError(''); setPwdOk(false) }}
                    placeholder="Min. 6 caractères" autoComplete="new-password" />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Confirmer le nouveau</label>
                  <input type="password" value={confirmPwd}
                    onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setPwdOk(false) }}
                    placeholder="••••••••" autoComplete="new-password" />
                </div>
              </div>
              {pwdError && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: '#FEF0F0', borderRadius: 8 }}>⚠️ {pwdError}</div>}
              {pwdOk    && <div style={{ color: 'var(--teal)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--teal-light)', borderRadius: 8 }}>✓ Mot de passe modifié — base re-chiffrée.</div>}
              <div className="settings-actions">
                <button className="btn btn-primary btn-sm" onClick={handleChangePassword}
                  disabled={pwdLoading || !oldPwd || !newPwd || !confirmPwd}>
                  {pwdLoading ? '⏳ Re-chiffrement…' : '🔐 Changer le mot de passe'}
                </button>
              </div>
              <div className="settings-enc-note">⚠️ Notez votre mot de passe. Sans lui, les données sont irrécupérables.</div>
            </div>

            {/* Infos chiffrement */}
            <div className="settings-card settings-card-security">
              <div className="settings-card-title">
                <span className="card-title-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>🛡️</span>
                Informations de sécurité
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                <div>
                  <div className="detail-label">Algorithme</div>
                  <div className="detail-value">AES-256-GCM (authentifié)</div>
                </div>
                <div>
                  <div className="detail-label">Clé de chiffrement</div>
                  <div className="detail-value">Générée localement, stockée dans le dossier de données</div>
                </div>
                <div>
                  <div className="detail-label">Données patient</div>
                  <div className="detail-value">Jamais dans les dossiers projet (src, dist, release)</div>
                </div>
                <div>
                  <div className="detail-label">Base de données</div>
                  <div className="detail-value">
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                      onClick={async () => { const p = await window.mtcApi.getDataPath(); window.mtcApi.openPath(p) }}>
                      📁 Ouvrir le dossier de données
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mise à jour */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">🔄</span>
                Mise à jour de l'application
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Version installée : <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 14 }}>
                  v{appVersion || '…'}
                </strong>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Sélectionnez le fichier <code>.exe</code> de la nouvelle version (clé USB ou téléchargements).
                L'application se fermera pour lancer l'installation — <strong>vos données ne sont pas supprimées</strong>.
              </p>
              {updatePath && (
                <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: 'var(--teal-light)', border: '1px solid rgba(42,122,106,.2)', fontSize: 12, color: 'var(--teal)', wordBreak: 'break-all' }}>
                  ✓ Fichier sélectionné : <strong>{updatePath}</strong>
                </div>
              )}
              <div className="settings-actions">
                <button className="btn btn-secondary btn-sm" onClick={handleSelectUpdate} disabled={updating}>
                  📥 Sélectionner le fichier de mise à jour (.exe)
                </button>
                {updatePath && (
                  <button className="btn btn-primary btn-sm" onClick={handleLaunchUpdate} disabled={updating}
                    style={{ background: 'var(--teal)', borderColor: 'var(--teal)' }}>
                    {updating ? '⏳ Lancement…' : '🚀 Installer la mise à jour'}
                  </button>
                )}
                {updatePath && <button className="btn btn-secondary btn-sm" onClick={() => setUpdatePath('')} disabled={updating}>✕ Annuler</button>}
              </div>
              <div className="settings-enc-note" style={{ color: 'var(--amber)', background: 'var(--amber-light)', borderRadius: 6, padding: '6px 10px', marginTop: 10 }}>
                ⚠️ L'application se fermera. Enregistrez votre travail avant de procéder.
              </div>
            </div>
          </div>
        )}

        {/* ════ GOOGLE CALENDAR ════ */}
        {activeTab === 'gcal' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">📅 Google Calendar</div>
              <div className="settings-tab-desc">
                Synchronise automatiquement les rendez-vous avec votre téléphone (Android / iPhone).
                Les événements apparaissent uniquement avec le titre <strong>Consultation</strong>, sans aucune donnée patient.
              </div>
            </div>

            {/* ── Non connecté ── */}
            {!gcalInfo?.connected && (
              <div>
                <div className="settings-section-title">Configuration Google Cloud</div>
                <div className="settings-enc-note" style={{ marginBottom: 16 }}>
                  <strong>Étapes préalables (une seule fois) :</strong>
                  <ol style={{ paddingLeft: 18, marginTop: 8, lineHeight: 1.8 }}>
                    <li>Aller sur <strong>console.cloud.google.com</strong> → Créer un projet</li>
                    <li>Activer l'API <strong>Google Calendar API</strong></li>
                    <li>Identifiants → Créer → <strong>ID client OAuth 2.0</strong> → Application de bureau</li>
                    <li>Ajouter l'URI de redirection : <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>http://127.0.0.1:42813/oauth2callback</code></li>
                    <li>Copier le <strong>Client ID</strong> et <strong>Client Secret</strong> ci-dessous</li>
                  </ol>
                </div>

                <div className="grid2" style={{ marginBottom: 14 }}>
                  <div className="field">
                    <label>Client ID</label>
                    <input
                      type="text"
                      value={gcalClientId}
                      onChange={e => setGcalClientId(e.target.value)}
                      placeholder="xxxxxxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div className="field">
                    <label>Client Secret</label>
                    <input
                      type="password"
                      value={gcalClientSec}
                      onChange={e => setGcalClientSec(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleGcalConnect}
                  disabled={gcalLoading || !gcalClientId.trim() || !gcalClientSec.trim()}
                >
                  {gcalLoading ? '⏳ Connexion…' : '🔗 Connecter Google Calendar'}
                </button>
              </div>
            )}

            {/* ── Connecté ── */}
            {gcalInfo?.connected && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'var(--accent-light)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--accent-mid)',
                  marginBottom: 20,
                }}>
                  <span style={{ fontSize: 24 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Connecté à Google Calendar</div>
                    {gcalInfo.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{gcalInfo.email}</div>}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 'auto', color: 'var(--red)' }}
                    onClick={handleGcalDisconnect}
                  >
                    Déconnecter
                  </button>
                </div>

                <div className="settings-section-title">Calendrier utilisé</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'var(--bg)',
                    borderRadius: 'var(--radius)', border: '1px solid var(--border-soft)',
                    marginBottom: 10,
                  }}>
                    <span>📅</span>
                    <span style={{ fontWeight: 600 }}>
                      {gcalInfo.calendarName || 'Calendrier principal'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {gcalInfo.calendarId}
                    </span>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleGcalLoadCalendars}
                    disabled={gcalLoading}
                  >
                    {gcalLoading ? '⏳ Chargement…' : '🔄 Changer de calendrier'}
                  </button>
                </div>

                {/* Liste des calendriers disponibles */}
                {gcalCalendars.length > 0 && (
                  <div>
                    <div className="settings-section-title" style={{ marginTop: 16 }}>Choisir un calendrier</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {gcalCalendars.map(cal => (
                        <div
                          key={cal.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            background: gcalInfo.calendarId === cal.id ? 'var(--accent-light)' : 'var(--bg)',
                            borderRadius: 'var(--radius)',
                            border: `1px solid ${gcalInfo.calendarId === cal.id ? 'var(--accent-mid)' : 'var(--border-soft)'}`,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleGcalSetCalendar(cal.id, cal.summary)}
                        >
                          <span>📅</span>
                          <span style={{ flex: 1, fontWeight: 500 }}>{cal.summary}</span>
                          {cal.primary && (
                            <span style={{ fontSize: 10, background: 'var(--accent)', color: 'white', padding: '1px 6px', borderRadius: 8 }}>
                              Principal
                            </span>
                          )}
                          {gcalInfo.calendarId === cal.id && (
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="settings-enc-note" style={{ marginTop: 20 }}>
                  <strong>Comment ça fonctionne :</strong> Chaque RDV créé, modifié ou supprimé dans le calendrier de l'application
                  est automatiquement synchronisé. Les événements Google n'affichent que <strong>Consultation</strong> — aucune donnée patient ne quitte l'application.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ PLUGIN ════ */}
        {activeTab === 'plugin' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">🔌 Plugin de spécialité</div>
              <div className="settings-tab-desc">Formulaire d'anamnèse selon votre spécialité thérapeutique</div>
            </div>
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">🔌</span>
                Spécialité active
              </div>

              {activePlugin ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 36 }}>{activePlugin.icon || '🔌'}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: activePlugin.accentColor || 'var(--accent)' }}>
                        {activePlugin.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {activePlugin.specialty} · v{activePlugin.version}
                        {activePlugin.author && ` · ${activePlugin.author}`}
                      </div>
                      {activePlugin.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>{activePlugin.description}</div>
                      )}
                    </div>
                  </div>

                  {activePlugin.useBuiltinForm ? (
                    <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--accent)' }}>
                      ✅ <strong>Formulaire MTC intégré complet actif</strong> — interrogatoire, langue, pouls, observation, diagnostic, traitement, barrage homéopathique, systèmes, tests énergétiques.
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <strong>{activePlugin.sections.length} section{activePlugin.sections.length > 1 ? 's' : ''}</strong> ·{' '}
                      <strong>{activePlugin.sections.reduce((n, s) => n + s.fields.filter(f => f.type !== 'separator').length, 0)} champs</strong>
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {activePlugin.sections.map(s => (
                          <span key={s.id} style={{ background: (s.accentColor || 'var(--accent)') + '22', border: `1px solid ${s.accentColor || 'var(--accent)'}44`, color: s.accentColor || 'var(--accent)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                            {s.icon} {s.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="settings-actions">
                    <button className="btn btn-secondary btn-sm" onClick={handleImportPlugin} disabled={pluginLoading}>📥 Remplacer le plugin</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }} onClick={handleRemovePlugin}>✕ Supprimer le plugin</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                    <span style={{ fontSize: 22 }}>🌿</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>Formulaire générique simple actif</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anamnèse · Traitement effectué · Résultats &amp; Réactions</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                    Importez un fichier <code>.json</code> de plugin pour adapter le formulaire de séance
                    à votre spécialité (MTC, Kinésiologie, Ostéopathie, Naturopathie…).
                  </p>
                  <div className="settings-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleImportPlugin} disabled={pluginLoading}>
                      {pluginLoading ? '⏳ Import…' : '📥 Importer un plugin (.json)'}
                    </button>
                  </div>
                </div>
              )}

              {pluginError && (
                <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10, padding: '8px 12px', background: '#FEF0F0', borderRadius: 8 }}>
                  ⚠️ {pluginError}
                </div>
              )}
              <div className="settings-enc-note">
                Le plugin ne modifie pas la base de données. Les données restent accessibles même si le plugin change.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
