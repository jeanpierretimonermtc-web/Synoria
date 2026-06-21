import React, { useEffect, useState, useContext } from 'react'
import type { AppSettings, BackupInfo, GoogleCalendarInfo, GCalCalendar } from '../../shared/types'
import type { PluginDefinition } from '../../shared/pluginTypes'
import { ToastContext } from '../App'
import { showConfirm } from '../components/common/ConfirmDialog'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDate(iso: string | null): string {
  if (!iso) return 'â€”'
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR')} Ã  ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? 'var(--accent)' : 'var(--red)', marginRight: 6,
    }} />
  )
}

// â”€â”€ Onglets de la sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Tab = 'sauvegardes' | 'facturation' | 'rgpd' | 'securite' | 'plugin' | 'gcal' | 'support'

const TABS: { id: Tab; icon: string; label: string; desc: string }[] = [
  { id: 'sauvegardes', icon: 'ðŸ’¾', label: 'Sauvegardes',  desc: 'Chemins, automatisation'     },
  { id: 'facturation', icon: 'ðŸ§¾', label: 'Facturation',  desc: 'Factures, numÃ©rotation'       },
  { id: 'rgpd',        icon: 'ðŸ”’', label: 'RGPD',         desc: 'Notice, consentements'        },
  { id: 'securite',    icon: 'ðŸ”', label: 'SÃ©curitÃ©',     desc: 'Mot de passe, mise Ã  jour'    },
  { id: 'plugin',      icon: 'ðŸ”Œ', label: 'Plugin',       desc: 'Formulaire de spÃ©cialitÃ©'     },
  { id: 'gcal',        icon: 'ðŸ“…', label: 'Google Cal.',  desc: 'Sync calendrier tÃ©lÃ©phone'    },
  { id: 'support',     icon: 'ðŸ”§', label: 'Support',      desc: 'Diagnostic, assistance'       },
]

// â”€â”€ PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SettingsPage() {
  const showToast = useContext(ToastContext)

  // Ã‰tat gÃ©nÃ©ral
  const [settings, setSettings]   = useState<AppSettings | null>(null)
  const [info, setInfo]           = useState<BackupInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]             = useState(false)
  const [backingUp, setBackingUp]       = useState(false)
  const [verifying, setVerifying]       = useState(false)
  const [bkpPwdModal,   setBkpPwdModal]   = useState<{ filePath: string } | null>(null)
  const [bkpPwdInput,   setBkpPwdInput]   = useState('')
  const [bkpPwdError,   setBkpPwdError]   = useState('')
  const [bkpPwdLoading, setBkpPwdLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('sauvegardes')

  // SÃ©curitÃ© / MAJ
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

  // Support
  const [diagGenerating, setDiagGenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, i] = await Promise.all([window.mtcApi.getSettings(), window.mtcApi.getBackupInfo()])
      setSettings(s); setInfo(i)
    } catch { showToast('Erreur chargement paramÃ¨tres', 'error') }
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
      showToast('ConnectÃ© Ã  Google Calendar âœ“', 'success')
      // Charge la liste des calendriers
      const cals = await window.mtcApi.gcalListCalendars()
      setGcalCalendars(cals)
    } catch (e: any) {
      showToast(`Connexion Ã©chouÃ©e : ${e?.message || e}`, 'error')
    }
    setGcalLoading(false)
  }

  const handleGcalDisconnect = async () => {
    if (!await showConfirm({ message: 'DÃ©connecter Google Calendar ?\n\nLes futurs RDV ne seront plus synchronisÃ©s.', title: 'DÃ©connecter Google Calendar', confirmLabel: 'DÃ©connecter', danger: true })) return
    await window.mtcApi.gcalDisconnect()
    setGcalInfo(null); setGcalCalendars([])
    showToast('DÃ©connectÃ© de Google Calendar', 'success')
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
    showToast(`Calendrier "${name}" sÃ©lectionnÃ© âœ“`, 'success')
  }

  const handleGcalToggleImportCalendar = async (cal: GCalCalendar) => {
    const current = gcalInfo?.importCalendars ?? []
    if (gcalInfo?.calendarId === cal.id) {
      showToast('Ce calendrier est deja importe automatiquement', 'success')
      return
    }
    const exists = current.some(c => c.id === cal.id)
    const next = exists
      ? current.filter(c => c.id !== cal.id)
      : [...current, { id: cal.id, summary: cal.summary, primary: cal.primary }]
    try {
      await window.mtcApi.gcalSetImportCalendars(next)
      setGcalInfo(info => info ? { ...info, importCalendars: next } : info)
      showToast('Calendriers a importer enregistres', 'success')
    } catch (e: any) {
      showToast(`Erreur enregistrement calendriers : ${e?.message || e}`, 'error')
    }
  }

  const handleGcalImportColor = async (cal: GCalCalendar, color: string) => {
    const current = gcalInfo?.importCalendars ?? []
    const exists = current.some(c => c.id === cal.id)
    const next = exists
      ? current.map(c => c.id === cal.id ? { ...c, color } : c)
      : [...current, { id: cal.id, summary: cal.summary, primary: cal.primary, color }]
    try {
      await window.mtcApi.gcalSetImportCalendars(next)
      setGcalInfo(info => info ? { ...info, importCalendars: next } : info)
      showToast('Couleur calendrier enregistree', 'success')
    } catch (e: any) {
      showToast(`Erreur enregistrement couleur : ${e?.message || e}`, 'error')
    }
  }

  const handleGcalCleanupOldImports = async () => {
    const ok = await showConfirm({
      title: 'Nettoyer les anciens agendas Google',
      message: 'Supprimer de Synoria les RDV importÃ©s depuis des calendriers Google qui ne sont plus cochÃ©s ?\n\nLes RDV du nouveau calendrier sÃ©lectionnÃ© seront conservÃ©s. Rien ne sera supprimÃ© dans Google Calendar.',
      confirmLabel: 'Nettoyer',
      danger: true,
    })
    if (!ok) return
    try {
      let result: { deleted: number }
      try {
        result = await window.mtcApi.gcalCleanupOldImportedAppointments()
      } catch (e: any) {
        if (!String(e?.message || e).includes('No handler registered')) throw e
        const selected = new Set((gcalInfo?.importCalendars ?? []).map(cal => encodeURIComponent(cal.id)))
        const appointments = await window.mtcApi.getAppointments()
        let deleted = 0
        for (const appt of appointments) {
          const id = appt.google_event_id || ''
          if (!id.startsWith('gcalExternal:')) continue
          const encodedCalendarId = id.slice('gcalExternal:'.length).split(':')[0]
          if (selected.has(encodedCalendarId)) continue
          await window.mtcApi.deleteAppointment(appt.id)
          deleted++
        }
        result = { deleted }
      }
      showToast(`${result.deleted} RDV importÃ©${result.deleted > 1 ? 's' : ''} supprimÃ©${result.deleted > 1 ? 's' : ''}`, 'success')
    } catch (e: any) {
      showToast(`Nettoyage impossible : ${e?.message || e}`, 'error')
    }
  }

  useEffect(() => {
    load()
    window.mtcApi.getAppVersion().then(setAppVersion).catch(() => {})
    window.mtcApi.pluginGet().then(p => setActivePlugin(p || null)).catch(() => {})
    loadGcalStatus()
  }, [])

  // â”€â”€ Helpers save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const save = async (partial: Partial<AppSettings>) => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await window.mtcApi.saveSettings(partial)
      setSettings(updated)
      showToast('EnregistrÃ© âœ“', 'success')
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

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleGeneralBackup = async () => {
    setBackingUp(true)
    try {
      const path = await window.mtcApi.exportGeneralBackup()
      showToast('Sauvegarde gÃ©nÃ©rale crÃ©Ã©e âœ“', 'success')
      const [newInfo, updated] = await Promise.all([window.mtcApi.getBackupInfo(), window.mtcApi.getSettings()])
      setInfo(newInfo); setSettings(updated)
      await window.mtcApi.openPath(path)
    } catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error') }
    setBackingUp(false)
  }

  const handleImport = async () => {
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Sauvegarde Synoria', extensions: ['enc', 'json'] }] })
    if (!path) return
    try {
      const result = await window.mtcApi.importBackupJson(path)
      if ('__needsPassword' in result) {
        setBkpPwdInput(''); setBkpPwdError(''); setBkpPwdModal({ filePath: result.filePath })
        return
      }
      showToast(`Import terminé ✓ — ${result.patientsUpserted} patient(s), ${result.sessionsUpserted} séance(s)${result.errors.length ? ` (${result.errors.length} ignoré(s))` : ''}`, 'success')
      window.location.reload()
    } catch (e: any) { showToast(`Erreur import : ${e?.message || e}`, 'error') }
  }

  const handleImportWithPassword = async () => {
    if (!bkpPwdModal || !bkpPwdInput.trim()) return
    setBkpPwdLoading(true); setBkpPwdError('')
    try {
      const result = await window.mtcApi.importBackupJsonWithPassword(bkpPwdModal.filePath, bkpPwdInput)
      showToast(`Import terminÃ© âœ“ â€” ${result.patientsUpserted} patient(s), ${result.sessionsUpserted} sÃ©ance(s)`, 'success')
      setBkpPwdModal(null)
      window.location.reload()
    } catch (e: any) {
      const msg = (e?.message || String(e)).replace('WRONG_PASSWORD:', '')
      setBkpPwdError(msg)
    }
    setBkpPwdLoading(false)
  }

  const handleExportKey = async () => {
    try {
      const path = await window.mtcApi.exportEncryptionKey()
      if (path) showToast(`ClÃ© sauvegardÃ©e âœ“ â€” ${path}`, 'success')
    } catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error') }
  }

  const handleVerifyBackup = async () => {
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Sauvegarde Synoria', extensions: ['enc', 'json'] }] })
    if (!path) return
    setVerifying(true)
    try {
      const r = await window.mtcApi.verifyBackup(path)
      const date = r.exportedAt ? new Date(r.exportedAt).toLocaleString('fr-FR') : '?'
      showToast(`âœ… Sauvegarde valide â€” ${r.patients} patient(s), ${r.sessions} sÃ©ance(s) â€” exportÃ©e le ${date}`, 'success')
    } catch (e: any) { showToast(`âŒ Sauvegarde corrompue ou illisible : ${e?.message || e}`, 'error') }
    setVerifying(false)
  }

  const handleChangePassword = async () => {
    setPwdError(''); setPwdOk(false)
    if (!oldPwd || !newPwd)      { setPwdError('Tous les champs sont obligatoires.'); return }
    if (newPwd.length < 6)       { setPwdError('Le nouveau mot de passe doit faire au moins 6 caractÃ¨res.'); return }
    if (newPwd !== confirmPwd)   { setPwdError('Les mots de passe ne correspondent pas.'); return }
    setPwdLoading(true)
    const result = await window.mtcApi.authChangePassword(oldPwd, newPwd)
    if (result.ok) { setPwdOk(true); setOldPwd(''); setNewPwd(''); setConfirmPwd('') }
    else { setPwdError(result.error || 'Erreur.') }
    setBkpPwdLoading(false)
  }

  const isMac = navigator.userAgent.includes('Macintosh')

  const handleSelectUpdate = async () => {
    const filters = isMac
      ? [{ name: 'Installateur Synoria', extensions: ['dmg'] }]
      : [{ name: 'Installateur Synoria', extensions: ['exe'] }]
    const path = await window.mtcApi.showOpenDialog({ filters })
    if (path) setUpdatePath(path)
  }

  const handleLaunchUpdate = async () => {
    if (!updatePath) return
    if (!await showConfirm({ message: 'L\'application va se fermer pour lancer l\'installation.\n\nVos donnÃ©es ne seront pas supprimÃ©es.\n\nContinuer ?', title: 'Lancer la mise Ã  jour', confirmLabel: 'Mettre Ã  jour' })) return
    setUpdating(true)
    try { await window.mtcApi.launchInstaller(updatePath) }
    catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error'); setUpdating(false) }
  }

  const handleImportPlugin = async () => {
    setPluginError('')
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Plugin Synoria', extensions: ['json'] }] })
    if (!path) return
    setPluginLoading(true)
    try {
      const plugin = await window.mtcApi.pluginImport(path)
      await window.mtcApi.pluginSet(plugin)
      setActivePlugin(plugin)
      showToast(`Plugin "${plugin.name}" v${plugin.version} installÃ© âœ“`, 'success')
    } catch (e: any) { setPluginError(e?.message || 'Erreur import plugin.') }
    setPluginLoading(false)
  }

  const handleRemovePlugin = async () => {
    if (!await showConfirm({ message: 'Supprimer le plugin et revenir au formulaire intÃ©grÃ© ?', title: 'Supprimer le plugin', confirmLabel: 'Supprimer', danger: true })) return
    await window.mtcApi.pluginRemove()
    setActivePlugin(null)
    showToast('Plugin supprimÃ© â€” formulaire MTC restaurÃ©', 'success')
  }

  const handleGenerateDiagnostic = async () => {
    setDiagGenerating(true)
    try {
      const path = await window.mtcApi.generateDiagnosticReport()
      showToast('Rapport gÃ©nÃ©rÃ© âœ“', 'success')
      await window.mtcApi.openPath(path)
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
    }
    setDiagGenerating(false)
  }

  const handleOpenSupportDoc = async () => {
    try {
      const path = await window.mtcApi.generateSupportDoc()
      await window.mtcApi.openPath(path)
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
    }
  }

  if (loading || !settings) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', flexDirection: 'column', gap: 12 }}>
        <div className="loading-dots"><span /><span /><span /></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargementâ€¦</div>
      </div>
    )
  }

  // â”€â”€ RENDU PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <>
    <div className="settings-layout">

      {/* â”€â”€ SIDEBAR â”€â”€ */}
      <aside className="settings-sidebar">
        <div className="settings-sidebar-header">
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
            âš™ï¸ ParamÃ¨tres
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

      {/* â”€â”€ CONTENU â”€â”€ */}
      <div className="settings-content">

        {/* â•â•â•â• SAUVEGARDES â•â•â•â• */}
        {activeTab === 'sauvegardes' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ’¾ Sauvegardes</div>
              <div className="settings-tab-desc">Chemins de destination et automatisation des sauvegardes chiffrÃ©es</div>
            </div>

            {/* Sauvegarde gÃ©nÃ©rale */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-green">ðŸ’¾</span>
                Sauvegarde gÃ©nÃ©rale (base complÃ¨te)
              </div>
              <div className="settings-path-row">
                <label className="settings-label">Dossier de destination</label>
                <div className="settings-path-input-wrap">
                  <input type="text" value={settings.backupGeneralPath}
                    onChange={e => setSettings({ ...settings, backupGeneralPath: e.target.value })}
                    onBlur={e => save({ backupGeneralPath: e.target.value })}
                    className="settings-path-input" />
                  <button className="btn btn-secondary btn-sm" onClick={() => browsePath('backupGeneralPath')}>ðŸ“</button>
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
                    <span className="detail-label">DerniÃ¨re sauvegarde</span>
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
                  {backingUp ? 'â³ Sauvegardeâ€¦' : 'ðŸ’¾ Sauvegarder maintenant'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.mtcApi.openBackupFolder('general')}>
                  ðŸ“‚ Ouvrir le dossier
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleImport}>
                  ðŸ“¥ Importer une sauvegarde
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleVerifyBackup} disabled={verifying}>
                  {verifying ? 'â³ VÃ©rificationâ€¦' : 'ðŸ” VÃ©rifier une sauvegarde'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportKey}
                  title="Copie le fichier encryption.key dans un emplacement de votre choix. Ã€ conserver en lieu sÃ»r.">
                  ðŸ”‘ Sauvegarder la clÃ©
                </button>
              </div>
              <div className="settings-enc-note">
                ðŸ”’ Sauvegardes chiffrÃ©es AES-256-GCM Â· Format : <code>backup-global-YYYY-MM-DD-HHhMM.json.enc</code>
                {' '}<span style={{ color: 'var(--amber)', fontSize: 11 }}>Â· Les nouvelles sauvegardes sont protÃ©gÃ©es par votre mot de passe Synoria</span>
              </div>
            </div>

            {/* Sauvegarde patients */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">ðŸ‘¤</span>
                Sauvegarde individuelle patients
              </div>
              <div className="settings-path-row">
                <label className="settings-label">Dossier de destination</label>
                <div className="settings-path-input-wrap">
                  <input type="text" value={settings.backupPatientPath}
                    onChange={e => setSettings({ ...settings, backupPatientPath: e.target.value })}
                    onBlur={e => save({ backupPatientPath: e.target.value })}
                    className="settings-path-input" />
                  <button className="btn btn-secondary btn-sm" onClick={() => browsePath('backupPatientPath')}>ðŸ“</button>
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
                  ðŸ“‚ Ouvrir le dossier
                </button>
              </div>
              <div className="settings-enc-note">
                ðŸ“ Structure : <code>DUPONT_Jean/DUPONT_Jean_2026-05-28.xlsx</code> + <code>.json.enc</code><br />
                Les exports depuis les pages SÃ©ances sont sauvegardÃ©s ici automatiquement.
              </div>
            </div>

            {/* Automatisation */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">ðŸ”„</span>
                Automatisation
              </div>
              <div className="settings-toggle-list">
                <label className="settings-toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Sauvegarde Ã  la fermeture</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sauvegarde gÃ©nÃ©rale chiffrÃ©e Ã  chaque fermeture de l'appli</div>
                  </div>
                  <div className={`settings-toggle ${settings.autoBackupOnClose ? 'on' : ''}`}
                    onClick={() => set('autoBackupOnClose', !settings.autoBackupOnClose)} />
                </label>
                <label className="settings-toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Sauvegarde quotidienne automatique</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Une sauvegarde par jour au dÃ©marrage (si pas encore faite aujourd'hui)</div>
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
                  Les fichiers plus anciens sont supprimÃ©s automatiquement
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â• FACTURATION â•â•â•â• */}
        {activeTab === 'facturation' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ§¾ Facturation</div>
              <div className="settings-tab-desc">Chemin de sauvegarde des factures et numÃ©rotation</div>
            </div>
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-amber">ðŸ§¾</span>
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
                  }}>ðŸ“</button>
                </div>
              </div>
              <div className="settings-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.mtcApi.openPath(settings.invoicePath || '')}>
                  ðŸ“‚ Ouvrir le dossier factures
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-amber">ðŸ”¢</span>
                NumÃ©rotation des factures
              </div>
              <div style={{ marginBottom: 6 }}>
                <label className="settings-label">Prochain numÃ©ro de facture</label>
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
                        showToast('NumÃ©rotation mise Ã  jour âœ“', 'success')
                      }
                    }}
                    style={{ width: 120, fontWeight: 700, fontSize: 18, color: 'var(--amber)', textAlign: 'center' }}
                  />
                </div>
              </div>
              <div className="settings-enc-note">
                Modifiez ce numÃ©ro si vous avez dÃ©jÃ  Ã©mis des factures avant ce logiciel.
                La prochaine facture gÃ©nÃ©rÃ©e portera ce numÃ©ro.
                La numÃ©rotation repart Ã  1 chaque annÃ©e civile.
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â• RGPD â•â•â•â• */}
        {activeTab === 'rgpd' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ”’ RGPD</div>
              <div className="settings-tab-desc">CoordonnÃ©es du praticien, notice patient, durÃ©e de conservation</div>
            </div>
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">ðŸ”’</span>
                Informations du praticien
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                UtilisÃ©es dans la notice remise aux patients et dans le registre des traitements (Art. 30 RGPD).
              </p>
              <div className="grid2">
                <div className="field" style={{ margin: 0 }}>
                  <label>Nom du praticien / cabinet</label>
                  <input type="text" value={settings.rgpdPractitionerName || ''}
                    onChange={e => setSettings({ ...settings, rgpdPractitionerName: e.target.value })}
                    onBlur={e => save({ rgpdPractitionerName: e.target.value })}
                    placeholder="Nom PrÃ©nom ou Cabinet" />
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
                <span className="card-title-icon icon-teal">â°</span>
                DurÃ©e de conservation des donnÃ©es
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
                  Une alerte s'affiche dans la page ðŸ”’ RGPD pour les patients sans activitÃ© depuis cette durÃ©e.
                </div>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-teal">ðŸ“„</span>
                Notice d'information patient (Art. 13)
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Ce texte est remis Ã  chaque nouveau patient pour l'informer du traitement de ses donnÃ©es.
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

        {/* â•â•â•â• SÃ‰CURITÃ‰ â•â•â•â• */}
        {activeTab === 'securite' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ” SÃ©curitÃ©</div>
              <div className="settings-tab-desc">Mot de passe, chiffrement des donnÃ©es, mise Ã  jour du logiciel</div>
            </div>

            {/* Mot de passe */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal)' }}>ðŸ”</span>
                Changer le mot de passe
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Le mot de passe protÃ¨ge l'accÃ¨s et chiffre la base de donnÃ©es en <strong>AES-256-GCM</strong>.
                DemandÃ© Ã  chaque dÃ©marrage et aprÃ¨s 20 min d'inactivitÃ©.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Mot de passe actuel</label>
                  <input type="password" value={oldPwd}
                    onChange={e => { setOldPwd(e.target.value); setPwdError(''); setPwdOk(false) }}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" autoComplete="current-password" />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Nouveau mot de passe</label>
                  <input type="password" value={newPwd}
                    onChange={e => { setNewPwd(e.target.value); setPwdError(''); setPwdOk(false) }}
                    placeholder="Min. 6 caractÃ¨res" autoComplete="new-password" />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Confirmer le nouveau</label>
                  <input type="password" value={confirmPwd}
                    onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setPwdOk(false) }}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" autoComplete="new-password" />
                </div>
              </div>
              {pwdError && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: '#FEF0F0', borderRadius: 8 }}>âš ï¸ {pwdError}</div>}
              {pwdOk    && <div style={{ color: 'var(--teal)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--teal-light)', borderRadius: 8 }}>âœ“ Mot de passe modifiÃ© â€” base re-chiffrÃ©e.</div>}
              <div className="settings-actions">
                <button className="btn btn-primary btn-sm" onClick={handleChangePassword}
                  disabled={pwdLoading || !oldPwd || !newPwd || !confirmPwd}>
                  {pwdLoading ? 'â³ Re-chiffrementâ€¦' : 'ðŸ” Changer le mot de passe'}
                </button>
              </div>
              <div className="settings-enc-note">âš ï¸ Notez votre mot de passe. Sans lui, les donnÃ©es sont irrÃ©cupÃ©rables.</div>
            </div>

            {/* Infos chiffrement */}
            <div className="settings-card settings-card-security">
              <div className="settings-card-title">
                <span className="card-title-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>ðŸ›¡ï¸</span>
                Informations de sÃ©curitÃ©
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                <div>
                  <div className="detail-label">Algorithme</div>
                  <div className="detail-value">AES-256-GCM (authentifiÃ©)</div>
                </div>
                <div>
                  <div className="detail-label">ClÃ© de chiffrement</div>
                  <div className="detail-value">GÃ©nÃ©rÃ©e localement, stockÃ©e dans le dossier de donnÃ©es</div>
                </div>
                <div>
                  <div className="detail-label">DonnÃ©es patient</div>
                  <div className="detail-value">Jamais dans les dossiers projet (src, dist, release)</div>
                </div>
                <div>
                  <div className="detail-label">Base de donnÃ©es</div>
                  <div className="detail-value">
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                      onClick={async () => { const p = await window.mtcApi.getDataPath(); window.mtcApi.openPath(p) }}>
                      ðŸ“ Ouvrir le dossier de donnÃ©es
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mise Ã  jour */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">ðŸ”„</span>
                Mise Ã  jour de l'application
              </div>
              {/* Badge version */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-light)', border: '1px solid rgba(var(--accent-rgb, 42,122,106),.2)' }}>
                <span style={{ fontSize: 28 }}>ðŸ“¦</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Version installÃ©e</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>
                    v{appVersion || 'â€¦'}
                  </div>
                </div>
                {!updatePath && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--teal)', background: 'var(--teal-light)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(42,122,106,.2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} />
                    Ã€ jour
                  </div>
                )}
                {updatePath && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--amber)', background: 'var(--amber-light)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(215,119,0,.2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
                    Mise Ã  jour prÃªte
                  </div>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                {isMac
                  ? <>SÃ©lectionnez le fichier <code>.dmg</code> de la nouvelle version. Il s'ouvrira dans le Finder â€” glissez l'app dans Applications pour remplacer l'ancienne version.</>
                  : <>SÃ©lectionnez le fichier <code>.exe</code> de la nouvelle version (clÃ© USB ou tÃ©lÃ©chargements). L'application se fermera pour lancer l'installation â€” <strong>vos donnÃ©es ne sont pas supprimÃ©es</strong>.</>
                }
              </p>
              {updatePath && (
                <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: 'var(--teal-light)', border: '1px solid rgba(42,122,106,.2)', fontSize: 12, color: 'var(--teal)', wordBreak: 'break-all' }}>
                  âœ“ Fichier sÃ©lectionnÃ© : <strong>{updatePath}</strong>
                </div>
              )}
              <div className="settings-actions">
                <button className="btn btn-secondary btn-sm" onClick={handleSelectUpdate} disabled={updating}>
                  ðŸ“¥ SÃ©lectionner le fichier de mise Ã  jour ({isMac ? '.dmg' : '.exe'})
                </button>
                {updatePath && (
                  <button className="btn btn-primary btn-sm" onClick={handleLaunchUpdate} disabled={updating}
                    style={{ background: 'var(--teal)', borderColor: 'var(--teal)' }}>
                    {updating ? 'â³ Lancementâ€¦' : 'ðŸš€ Installer la mise Ã  jour'}
                  </button>
                )}
                {updatePath && <button className="btn btn-secondary btn-sm" onClick={() => setUpdatePath('')} disabled={updating}>âœ• Annuler</button>}
              </div>
              <div className="settings-enc-note" style={{ color: 'var(--amber)', background: 'var(--amber-light)', borderRadius: 6, padding: '6px 10px', marginTop: 10 }}>
                âš ï¸ L'application se fermera. Enregistrez votre travail avant de procÃ©der.
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â• GOOGLE CALENDAR â•â•â•â• */}
        {activeTab === 'gcal' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ“… Google Calendar</div>
              <div className="settings-tab-desc">
                Synchronise automatiquement les rendez-vous avec votre tÃ©lÃ©phone (Android / iPhone).
                Les Ã©vÃ©nements apparaissent uniquement avec le titre <strong>Consultation</strong>, sans aucune donnÃ©e patient.
              </div>
            </div>

            <details className="settings-card" open={!gcalInfo?.connected} style={{ marginBottom: 18 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--accent)', listStyle: 'none' }}>
                Guide de premiÃ¨re synchronisation Google Calendar
              </summary>
              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }}>
                  <strong>Objectif :</strong> Synoria crÃ©e automatiquement un calendrier Google nommÃ© <strong>Synoria</strong>.
                  Les consultations et sÃ©ances Synoria y sont envoyÃ©es avec le titre <strong>Consultation</strong>, sans nom de patient.
                  Vous pouvez aussi importer vos calendriers personnels dans le planning Synoria pour voir vos indisponibilitÃ©s.
                </div>

                <div className="grid2" style={{ gap: 12 }}>
                  <div style={{ border: '1px solid var(--border-soft)', borderRadius: 8, padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>1. PrÃ©parer Google Cloud</div>
                    <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7, fontSize: 13 }}>
                      <li>Aller sur <strong>console.cloud.google.com</strong>.</li>
                      <li>CrÃ©er ou choisir un projet Google.</li>
                      <li>Activer <strong>Google Calendar API</strong>.</li>
                      <li>CrÃ©er un <strong>ID client OAuth 2.0</strong> de type <strong>Application de bureau</strong>.</li>
                      <li>Copier le <strong>Client ID</strong> et le <strong>Client Secret</strong> dans Synoria.</li>
                    </ol>
                  </div>

                  <div style={{ border: '1px solid var(--border-soft)', borderRadius: 8, padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>2. Connecter Synoria</div>
                    <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7, fontSize: 13 }}>
                      <li>Cliquer sur <strong>Connecter Google Calendar</strong>.</li>
                      <li>Le navigateur Google s'ouvre automatiquement.</li>
                      <li>Choisir le compte Google Ã  utiliser.</li>
                      <li>Accepter les autorisations demandÃ©es.</li>
                      <li>Revenir dans Synoria quand le message de rÃ©ussite s'affiche.</li>
                    </ol>
                  </div>
                </div>

                <div className="grid2" style={{ gap: 12 }}>
                  <div style={{ border: '1px solid var(--border-soft)', borderRadius: 8, padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>3. Lancer la synchronisation</div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)' }}>
                      Aller dans <strong>Agenda</strong>, puis cliquer sur <strong>Sync GCal</strong>.
                      Synoria envoie les RDV et sÃ©ances dans Google, puis importe les Ã©vÃ©nements Google sÃ©lectionnÃ©s dans le planning Synoria.
                    </p>
                  </div>

                  <div style={{ border: '1px solid var(--border-soft)', borderRadius: 8, padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>4. Calendriers personnels et couleurs</div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)' }}>
                      AprÃ¨s connexion, cliquez sur <strong>Afficher les calendriers Google</strong>, cochez les calendriers personnels Ã  importer,
                      puis choisissez une couleur locale pour mieux les repÃ©rer dans l'agenda Synoria.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <div><strong>SynchronisÃ© de Synoria vers Google :</strong> RDV, sÃ©ances passÃ©es et sÃ©ances Ã  venir, dans le calendrier Google <strong>Synoria</strong>.</div>
                  <div><strong>SynchronisÃ© de Google vers Synoria :</strong> Ã©vÃ©nements horaires des calendriers Google sÃ©lectionnÃ©s. Les Ã©vÃ©nements toute la journÃ©e sont ignorÃ©s.</div>
                  <div><strong>ConfidentialitÃ© :</strong> les Ã©vÃ©nements envoyÃ©s par Synoria vers Google sont nommÃ©s <strong>Consultation</strong>, sans nom de patient.</div>
                  <div><strong>Couleur Google :</strong> Synoria ne force pas la couleur du calendrier Google. Les couleurs choisies dans Synoria servent seulement Ã  l'affichage local.</div>
                </div>
              </div>
            </details>

            {/* â”€â”€ Non connectÃ© â”€â”€ */}
            {!gcalInfo?.connected && (
              <div>
                <div className="settings-section-title">Configuration Google Cloud</div>
                <div className="settings-enc-note" style={{ marginBottom: 16 }}>
                  Renseignez ici le <strong>Client ID</strong> et le <strong>Client Secret</strong> crÃ©Ã©s dans Google Cloud.
                  Le guide ci-dessus dÃ©taille toute la procÃ©dure pour une premiÃ¨re configuration.
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
                  {gcalLoading ? 'â³ Connexionâ€¦' : 'ðŸ”— Connecter Google Calendar'}
                </button>
              </div>
            )}

            {/* â”€â”€ ConnectÃ© â”€â”€ */}
            {gcalInfo?.connected && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'var(--accent-light)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--accent-mid)',
                  marginBottom: 20,
                }}>
                  <span style={{ fontSize: 24 }}>âœ…</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>ConnectÃ© Ã  Google Calendar</div>
                    {gcalInfo.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{gcalInfo.email}</div>}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 'auto', color: 'var(--red)' }}
                    onClick={handleGcalDisconnect}
                  >
                    DÃ©connecter
                  </button>
                </div>

                <div className="settings-section-title">Calendrier utilisÃ©</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'var(--bg)',
                    borderRadius: 'var(--radius)', border: '1px solid var(--border-soft)',
                    marginBottom: 10,
                  }}>
                    <span>ðŸ“…</span>
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
                    {gcalLoading ? 'â³ Chargementâ€¦' : 'ðŸ”„ Changer de calendrier'}
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
                          <span>ðŸ“…</span>
                          <span style={{ flex: 1, fontWeight: 500 }}>{cal.summary}</span>
                          {cal.primary && (
                            <span style={{ fontSize: 10, background: 'var(--accent)', color: 'white', padding: '1px 6px', borderRadius: 8 }}>
                              Principal
                            </span>
                          )}
                          {gcalInfo.calendarId === cal.id && (
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>âœ“</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="settings-section-title" style={{ marginTop: 20 }}>Calendriers Google a importer</div>
                <div className="settings-enc-note" style={{ marginBottom: 10 }}>
                  Cochez les agendas personnels dont les evenements doivent apparaitre dans le planning Synoria.
                  Le calendrier <strong>Synoria</strong> reste utilise pour envoyer les consultations vers Google.
                </div>
                {gcalCalendars.length === 0 ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleGcalLoadCalendars}
                    disabled={gcalLoading}
                  >
                    {gcalLoading ? 'Chargement...' : 'Afficher les calendriers Google'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gcalCalendars.map(cal => {
                      const isExportCalendar = gcalInfo.calendarId === cal.id
                      const checked = isExportCalendar || (gcalInfo.importCalendars ?? []).some(c => c.id === cal.id)
                      return (
                        <div
                          key={`import-${cal.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            background: checked ? 'var(--accent-light)' : 'var(--bg)',
                            borderRadius: 'var(--radius)',
                            border: `1px solid ${checked ? 'var(--accent-mid)' : 'var(--border-soft)'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleGcalToggleImportCalendar(cal)}
                          />
                          <input
                            type="color"
                            value={(gcalInfo.importCalendars ?? []).find(c => c.id === cal.id)?.color || cal.color || '#2A5A8A'}
                            disabled={isExportCalendar}
                            title="Couleur dans Synoria"
                            onChange={e => handleGcalImportColor(cal, e.target.value)}
                            style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: isExportCalendar ? 'default' : 'pointer' }}
                          />
                          <span style={{ flex: 1, fontWeight: 500 }}>{cal.summary}</span>
                          {cal.primary && (
                            <span style={{ fontSize: 10, background: 'var(--accent)', color: 'white', padding: '1px 6px', borderRadius: 8 }}>
                              Principal
                            </span>
                          )}
                          {isExportCalendar && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Importe automatiquement</span>
                          )}
                        </div>
                      )
                    })}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleGcalCleanupOldImports}
                      style={{ marginTop: 8, alignSelf: 'flex-start', color: 'var(--red)', borderColor: 'var(--red)' }}
                    >
                      Nettoyer les anciens RDV Google importÃ©s
                    </button>
                  </div>
                )}

                <div className="settings-enc-note" style={{ marginTop: 20 }}>
                  <strong>Comment Ã§a fonctionne :</strong> Chaque RDV crÃ©Ã©, modifiÃ© ou supprimÃ© dans le calendrier de l'application
                  est automatiquement synchronisÃ©. Les Ã©vÃ©nements Google n'affichent que <strong>Consultation</strong> â€” aucune donnÃ©e patient ne quitte l'application.
                </div>
              </div>
            )}
          </div>
        )}

        {/* â•â•â•â• PLUGIN â•â•â•â• */}
        {activeTab === 'plugin' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ”Œ Plugin de spÃ©cialitÃ©</div>
              <div className="settings-tab-desc">Formulaire d'anamnÃ¨se selon votre spÃ©cialitÃ© thÃ©rapeutique</div>
            </div>
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">ðŸ”Œ</span>
                SpÃ©cialitÃ© active
              </div>

              {activePlugin ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 36 }}>{activePlugin.icon || 'ðŸ”Œ'}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: activePlugin.accentColor || 'var(--accent)' }}>
                        {activePlugin.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {activePlugin.specialty} Â· v{activePlugin.version}
                        {activePlugin.author && ` Â· ${activePlugin.author}`}
                      </div>
                      {activePlugin.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>{activePlugin.description}</div>
                      )}
                    </div>
                  </div>

                  {activePlugin.useBuiltinForm ? (
                    <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--accent)' }}>
                      âœ… <strong>Formulaire MTC intÃ©grÃ© complet actif</strong> â€” interrogatoire, langue, pouls, observation, diagnostic, traitement, barrage homÃ©opathique, systÃ¨mes, tests Ã©nergÃ©tiques.
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <strong>{activePlugin.sections.length} section{activePlugin.sections.length > 1 ? 's' : ''}</strong> Â·{' '}
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
                    <button className="btn btn-secondary btn-sm" onClick={handleImportPlugin} disabled={pluginLoading}>ðŸ“¥ Remplacer le plugin</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }} onClick={handleRemovePlugin}>âœ• Supprimer le plugin</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                    <span style={{ fontSize: 22 }}>ðŸŒ¿</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>Formulaire gÃ©nÃ©rique simple actif</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AnamnÃ¨se Â· Traitement effectuÃ© Â· RÃ©sultats &amp; RÃ©actions</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                    Importez un fichier <code>.json</code> de plugin pour adapter le formulaire de sÃ©ance
                    Ã  votre spÃ©cialitÃ© (MTC, KinÃ©siologie, OstÃ©opathie, Naturopathieâ€¦).
                  </p>
                  <div className="settings-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleImportPlugin} disabled={pluginLoading}>
                      {pluginLoading ? 'â³ Importâ€¦' : 'ðŸ“¥ Importer un plugin (.json)'}
                    </button>
                  </div>
                </div>
              )}

              {pluginError && (
                <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10, padding: '8px 12px', background: '#FEF0F0', borderRadius: 8 }}>
                  âš ï¸ {pluginError}
                </div>
              )}
              <div className="settings-enc-note">
                Le plugin ne modifie pas la base de donnÃ©es. Les donnÃ©es restent accessibles mÃªme si le plugin change.
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â• SUPPORT TECHNIQUE â•â•â•â• */}
        {activeTab === 'support' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">ðŸ”§ Support technique</div>
              <div className="settings-tab-desc">Diagnostic et assistance</div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">ðŸ“‹</span>
                Rapport de diagnostic
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                En cas de problÃ¨me, gÃ©nÃ©rez un rapport de diagnostic et envoyez-le Ã &nbsp;
                <strong>support@synoria.fr</strong>.
                Le rapport sera ouvert automatiquement dans votre Ã©diteur de texte.
              </p>
              <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                âœ… <strong>Ce rapport ne contient aucune donnÃ©e patient</strong> (ni nom, prÃ©nom, email, notes). Il inclut uniquement des informations techniques : version, OS, statistiques anonymes de la base de donnÃ©es, configuration et journal d'erreurs.
              </div>
              <div className="settings-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerateDiagnostic}
                  disabled={diagGenerating}
                >
                  {diagGenerating ? 'â³ GÃ©nÃ©rationâ€¦' : 'ðŸ”§ GÃ©nÃ©rer le rapport de diagnostic'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenSupportDoc}
                >
                  ðŸ“„ Guide de lecture du rapport
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon" style={{ background: '#FEF3C722', color: '#92400E' }}>ðŸ”‘</span>
                Mot de passe oubliÃ©
              </div>

              {/* Avertissement principal */}
              <div style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: '#92400E', lineHeight: 1.7 }}>
                <strong>âš ï¸ Il n'existe pas de rÃ©cupÃ©ration directe.</strong><br />
                Le mot de passe est la seule clÃ© de la base de donnÃ©es â€” mÃªme le support Synoria ne peut pas la dÃ©chiffrer sans lui.
              </div>

              {/* Chemin de rÃ©cupÃ©ration via sauvegarde */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                  âœ… RÃ©cupÃ©ration possible si vous avez une sauvegarde
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    ['1', 'Localisez votre derniÃ¨re sauvegarde', 'Fichier .json.enc dans votre dossier de sauvegardes (ParamÃ¨tres â†’ Sauvegardes â†’ Ouvrir le dossier)'],
                    ['2', 'Supprimez les fichiers de verrouillage', 'Dans le dossier de donnÃ©es de l\'app, supprimez auth.json et mtc.sqlite.enc â€” l\'app reviendra en mode "premiÃ¨re utilisation"'],
                    ['3', 'CrÃ©ez un nouveau mot de passe', 'Au prochain dÃ©marrage, l\'app vous proposera de crÃ©er un nouveau mot de passe'],
                    ['4', 'Importez votre sauvegarde', 'ParamÃ¨tres â†’ Sauvegardes â†’ Importer une sauvegarde â€” la sauvegarde est chiffrÃ©e avec une clÃ© indÃ©pendante du mot de passe'],
                  ] as [string, string, string][]).map(([num, title, desc]) => (
                    <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 12px', background: 'var(--surface-alt, var(--bg))', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                      <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{num}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Si pas de sauvegarde */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 4 }}>
                <strong style={{ color: 'var(--red)' }}>âŒ Sans sauvegarde</strong>, les donnÃ©es sont dÃ©finitivement inaccessibles.<br />
                C'est pourquoi les sauvegardes automatiques doivent Ãªtre activÃ©es dÃ¨s la crÃ©ation du mot de passe.
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-green">âœ‰ï¸</span>
                Contact support
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <div><strong>Email :</strong> support@synoria.fr</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Joignez le rapport de diagnostic Ã  votre message pour accÃ©lÃ©rer le traitement.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* â”€â”€ Modal : sauvegarde protÃ©gÃ©e par mot de passe â”€â”€ */}
    {bkpPwdModal && (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBkpPwdModal(null)}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <button className="modal-close" onClick={() => setBkpPwdModal(null)}>Ã—</button>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            ðŸ”‘ Sauvegarde protÃ©gÃ©e par mot de passe
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
            Cette sauvegarde a Ã©tÃ© crÃ©Ã©e avec le nouveau format sÃ©curisÃ©.
            Saisissez le <strong>mot de passe Synoria</strong> utilisÃ© sur la machine d'origine.
          </p>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Mot de passe Synoria</label>
            <input
              type="password"
              value={bkpPwdInput}
              onChange={e => { setBkpPwdInput(e.target.value); setPwdError('') }}
              onKeyDown={e => e.key === 'Enter' && handleImportWithPassword()}
              placeholder="Votre mot de passe Synoriaâ€¦"
              autoFocus
            />
            {pwdError && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>âš  {pwdError}</div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={handleImportWithPassword} disabled={!bkpPwdInput.trim() || pwdLoading}>
              {pwdLoading ? 'â³ Restaurationâ€¦' : 'âœ“ Restaurer'}
            </button>
            <button className="btn btn-secondary" onClick={() => setBkpPwdModal(null)}>Annuler</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

