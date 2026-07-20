import React, { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppSettings, BackupInfo, GoogleCalendarInfo, GCalCalendar } from '../../shared/types'
import type { PluginDefinition } from '../../shared/pluginTypes'
import { ToastContext } from '../App'
import { showConfirm } from '../components/common/ConfirmDialog'
import PluginBuilder from '../components/plugin/PluginBuilder'
import PluginFormRenderer from '../components/plugin/PluginFormRenderer'

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

type Tab = 'apparence' | 'sauvegardes' | 'facturation' | 'rgpd' | 'securite' | 'plugin' | 'gcal' | 'support'

const TABS: { id: Tab; icon: string; label: string; desc: string }[] = [
  { id: 'apparence',   icon: '🎨', label: 'Apparence',   desc: 'Thème, affichage'             },
  { id: 'sauvegardes', icon: '💾', label: 'Sauvegardes', desc: 'Chemins, automatisation'      },
  { id: 'facturation', icon: '🧾', label: 'Facturation', desc: 'Factures, numérotation'       },
  { id: 'rgpd',        icon: '🔒', label: 'RGPD',        desc: 'Notice, consentements'        },
  { id: 'securite',    icon: '🔐', label: 'Sécurité',    desc: 'Mot de passe, mise à jour'    },
  { id: 'plugin',      icon: '📋', label: 'Formulaire métier', desc: 'Spécialité thérapeutique'  },
  { id: 'gcal',        icon: '📅', label: 'Google Cal.', desc: 'Sync calendrier téléphone'    },
  { id: 'support',     icon: '🔧', label: 'Support',     desc: 'Diagnostic, assistance'       },
]

// ── PAGE ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const showToast = useContext(ToastContext)
  const navigate  = useNavigate()

  // État général
  const [settings, setSettings]   = useState<AppSettings | null>(null)
  const [info, setInfo]           = useState<BackupInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]             = useState(false)
  const [backingUp, setBackingUp]       = useState(false)
  const [verifying, setVerifying]       = useState(false)
  // Modal aide import backup (mot de passe ou fichier clé)
  const [bkpModal,   setBkpModal]   = useState<{ filePath: string; mode: 'password' | 'key' } | null>(null)
  const [bkpPwdInput,   setBkpPwdInput]   = useState('')
  const [bkpPwdError,   setBkpPwdError]   = useState('')
  const [bkpPwdLoading, setBkpPwdLoading] = useState(false)
  const [activeTab, setActiveTab]       = useState<Tab>('sauvegardes')

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

  // Profils de séance (Phase 3)
  const [profiles,        setProfiles]        = useState<import('../../shared/sessionProfileTypes').SessionFormProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)

  // Owner
  const [isOwner, setIsOwner] = useState(false)

  // Plugin
  const [activePlugin,     setActivePlugin]     = useState<PluginDefinition | null>(null)
  const [availablePlugins, setAvailablePlugins] = useState<PluginDefinition[]>([])
  const [pluginLoading,    setPluginLoading]    = useState(false)
  const [pluginError,      setPluginError]      = useState('')
  const [showBuilder,        setShowBuilder]        = useState(false)
  const [builderInitial,     setBuilderInitial]     = useState<PluginDefinition | undefined>(undefined)
  const [library,            setLibrary]            = useState<{ plugin: PluginDefinition; savedAt: string; isNative?: boolean }[]>([])
  const [previewPlugin,      setPreviewPlugin]      = useState<PluginDefinition | null>(null)
  const [builderLivePreview, setBuilderLivePreview] = useState<PluginDefinition | null>(null)
  const [previewZoom,        setPreviewZoom]        = useState(0.48)

  // Google Calendar
  const [gcalInfo,        setGcalInfo]        = useState<GoogleCalendarInfo | null>(null)
  const [gcalCalendars,   setGcalCalendars]   = useState<GCalCalendar[]>([])
  const [gcalLoading,     setGcalLoading]     = useState(false)
  // Calendriers à importer — état local (id → { selected, color })
  const [gcalImportState, setGcalImportState] = useState<Record<string, { selected: boolean; color: string }>>({})
  const [gcalImportSaving, setGcalImportSaving] = useState(false)

  // Apparence — thème (état local synchronisé avec localStorage + App)
  const [localThemeMode, setLocalThemeMode] = useState<'light'|'dark'|'system'>(
    () => (localStorage.getItem('synoria-theme-mode') || 'light') as 'light'|'dark'|'system'
  )
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent<'light'|'dark'|'system'>).detail
      if (mode) setLocalThemeMode(mode)
    }
    window.addEventListener('synoria-theme-change', handler)
    return () => window.removeEventListener('synoria-theme-change', handler)
  }, [])
  const applyThemeMode = (mode: 'light'|'dark'|'system') => {
    setLocalThemeMode(mode)
    localStorage.setItem('synoria-theme-mode', mode)
    window.dispatchEvent(new CustomEvent('synoria-theme-change', { detail: mode }))
    window.mtcApi.saveSettings({ themeMode: mode } as any).catch(() => {})
  }

  // Support
  const [diagGenerating, setDiagGenerating] = useState(false)

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
    setGcalLoading(true)
    try {
      await window.mtcApi.gcalConnect()
      await loadGcalStatus()
      showToast('Connecté à Google Calendar ✓', 'success')
      const cals = await window.mtcApi.gcalListCalendars()
      setGcalCalendars(cals)
    } catch (e: any) {
      showToast(`Connexion échouée : ${e?.message || e}`, 'error')
    }
    setGcalLoading(false)
  }

  const handleGcalDisconnect = async () => {
    if (!await showConfirm({ message: 'Déconnecter Google Calendar ?\n\nLes futurs RDV ne seront plus synchronisés.', title: 'Déconnecter Google Calendar', confirmLabel: 'Déconnecter', danger: true })) return
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

  const loadGcalImportCalendars = async () => {
    setGcalLoading(true)
    try {
      const cals = await window.mtcApi.gcalListCalendars()
      setGcalCalendars(cals)
      // Initialiser l'état depuis les calendriers déjà importés
      const importMap: Record<string, { selected: boolean; color: string }> = {}
      const already = gcalInfo?.importCalendars || []
      for (const cal of cals) {
        const existing = already.find(c => c.id === cal.id)
        importMap[cal.id] = {
          selected: !!existing,
          color:    existing?.color || cal.color || '#1a73e8',
        }
      }
      setGcalImportState(importMap)
    } catch (e: any) { showToast(`Erreur chargement calendriers : ${e?.message || e}`, 'error') }
    setGcalLoading(false)
  }

  const handleSaveImportCalendars = async () => {
    setGcalImportSaving(true)
    try {
      const selected = gcalCalendars
        .filter(cal => gcalImportState[cal.id]?.selected)
        .map(cal => ({ id: cal.id, summary: cal.summary, color: gcalImportState[cal.id]?.color || '#1a73e8' }))
      await window.mtcApi.gcalSetImportCalendars(selected)
      await loadGcalStatus()
      showToast(`${selected.length} calendrier(s) à importer enregistrés ✓`, 'success')
    } catch { showToast('Erreur sauvegarde', 'error') }
    setGcalImportSaving(false)
  }

  useEffect(() => {
    load()
    window.mtcApi.getAppVersion().then(setAppVersion).catch(() => {})
    window.mtcApi.pluginGet().then(p => setActivePlugin(p || null)).catch(() => { showToast("Impossible de charger le formulaire actif", "error") })
    window.mtcApi.ownerCheck().then(setIsOwner).catch(() => {})
    loadGcalStatus()
  }, [])

  useEffect(() => {
    if (activeTab !== 'plugin') return
    window.mtcApi.pluginListAvailable().then(setAvailablePlugins).catch(() => {})
    window.mtcApi.pluginGet().then(p => setActivePlugin(p || null)).catch(() => {})
    window.mtcApi.pluginLibraryGet().then(lib => setLibrary(lib)).catch(() => { showToast("Erreur chargement bibliothèque de formulaires", "error") })
    window.mtcApi.profilesGetAll().then(list => setProfiles(list || [])).catch(() => {})
  }, [activeTab])

  // ── Profils de séance (Phase 3) ─────────────────────────────────
  const loadProfiles = async () => {
    try { setProfiles(await window.mtcApi.profilesGetAll()) }
    catch { showToast('Erreur chargement des profils de séance', 'error') }
  }
  const handleSetDefaultProfile = async (id: string) => {
    try { await window.mtcApi.profilesSetDefault(id); await loadProfiles(); showToast('Profil par défaut mis à jour ✓', 'success') }
    catch { showToast('Impossible de définir ce profil par défaut', 'error') }
  }
  const handleDuplicateProfile = async (p: import('../../shared/sessionProfileTypes').SessionFormProfile) => {
    try { await window.mtcApi.profilesDuplicate(p.id, `${p.name} (copie)`); await loadProfiles(); showToast('Profil dupliqué ✓', 'success') }
    catch { showToast('Impossible de dupliquer le profil', 'error') }
  }
  const handleArchiveProfile = async (p: import('../../shared/sessionProfileTypes').SessionFormProfile) => {
    if (!await showConfirm({ message: `Archiver le profil « ${p.name} » ? Il n'apparaîtra plus dans le sélecteur de séance.`, title: 'Archiver le profil', confirmLabel: 'Archiver' })) return
    try { await window.mtcApi.profilesArchive(p.id); await loadProfiles(); showToast('Profil archivé', 'success') }
    catch (e) { showToast(e instanceof Error ? e.message : 'Impossible d\'archiver le profil', 'error') }
  }
  const handleMigrateProfiles = async () => {
    setProfilesLoading(true)
    try {
      const res = await window.mtcApi.profilesMigrate()
      await loadProfiles()
      showToast(res.migrated ? `Profil migré depuis le formulaire actif ✓` : (res.reason || 'Aucune migration nécessaire'), 'success')
    } catch { showToast('Erreur migration des profils', 'error') }
    setProfilesLoading(false)
  }

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
    const path = await window.mtcApi.showOpenDialog({
      filters: [],
      properties: ['openDirectory', 'createDirectory'],
    })
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

  const finishImport = (result: { patientsUpserted: number; sessionsUpserted: number; sessionsSkipped?: number; errors: string[] }) => {
    const skipped = result.sessionsSkipped ?? 0
    showToast(
      `Import terminé ✓ — ${result.patientsUpserted} patient(s), ${result.sessionsUpserted} séance(s)${skipped > 0 ? ` · ${skipped} doublon(s) ignoré(s)` : ''}`,
      skipped > 0 ? 'warning' : 'success',
    )
    if (skipped > 0) {
      setTimeout(() => window.alert(
        `⚠️ ${skipped} séance${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}\n\nCes séances existent déjà dans la base et n'ont pas été réimportées.`
      ), 400)
    }
    setBkpModal(null)
    setTimeout(() => navigate('/'), 800)
  }

  const handleImport = async () => {
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Sauvegarde / Dossier patient', extensions: ['enc', 'json'] }] })
    if (!path) return
    // Ouvre le fichier JSON dans l'éditeur système pour lecture visuelle
    if (path.endsWith('.json')) {
      window.mtcApi.openPath(path).catch(() => {})
    }
    try {
      const result = await window.mtcApi.importBackupJson(path)
      if ('__needsPassword' in result) {
        setBkpPwdInput(''); setBkpPwdError(''); setBkpModal({ filePath: result.filePath, mode: 'password' })
        return
      }
      if ('__needsKey' in result) {
        setBkpPwdInput(''); setBkpPwdError(''); setBkpModal({ filePath: result.filePath, mode: 'key' })
        return
      }
      finishImport(result)
    } catch (e: any) { showToast(`Erreur import : ${e?.message || e}`, 'error') }
  }

  const handleImportWithPassword = async () => {
    if (!bkpModal || !bkpPwdInput.trim()) return
    setBkpPwdLoading(true); setBkpPwdError('')
    try {
      const result = await window.mtcApi.importBackupJsonWithPassword(bkpModal.filePath, bkpPwdInput)
      setBkpModal(null); finishImport(result)
    } catch (e: any) {
      const raw = e?.message || String(e)
      if (raw.includes('OLD_FORMAT:')) {
        // Sauvegarde V1.4.3 — basculer automatiquement vers "Fichier clé"
        setBkpModal(prev => prev ? { ...prev, mode: 'key' } : prev)
        setBkpPwdError('Sauvegarde format ancien (V1.4.3) — utilisez l\'onglet "Fichier clé" avec votre fichier encryption.key')
      } else {
        const clean = raw.replace(/Error invoking remote method '[^']+': Error: /, '').replace('WRONG_PASSWORD:', '').trim()
        setBkpPwdError(clean)
      }
    }
    setBkpPwdLoading(false)
  }

  const handleImportWithKey = async () => {
    if (!bkpModal) return
    setBkpPwdLoading(true); setBkpPwdError('')
    try {
      const result = await window.mtcApi.importBackupJsonWithKey(bkpModal.filePath)
      setBkpModal(null); finishImport(result)
    } catch (e: any) {
      const msg = (e?.message || String(e)).replace(/Error invoking remote method '[^']+': Error: /, '').replace('WRONG_KEY:', '')
      if (msg.trim() === 'Sélection annulée') { setBkpPwdLoading(false); return }
      setBkpPwdError(msg.trim())
    }
    setBkpPwdLoading(false)
  }

  const handleExportKey = async () => {
    try {
      const path = await window.mtcApi.exportEncryptionKey()
      if (path) showToast(`Clé sauvegardée ✓ — ${path}`, 'success')
    } catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error') }
  }

  const handleVerifyBackup = async () => {
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Sauvegarde Synoria', extensions: ['enc', 'json'] }] })
    if (!path) return
    setVerifying(true)
    try {
      const r = await window.mtcApi.verifyBackup(path)
      const date = r.exportedAt ? new Date(r.exportedAt).toLocaleString('fr-FR') : '?'
      showToast(`✅ Sauvegarde valide — ${r.patients} patient(s), ${r.sessions} séance(s) — exportée le ${date}`, 'success')
    } catch (e: any) { showToast(`❌ Sauvegarde corrompue ou illisible : ${e?.message || e}`, 'error') }
    setVerifying(false)
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
    if (!await showConfirm({ message: 'L\'application va se fermer pour lancer l\'installation.\n\nVos données ne seront pas supprimées.\n\nContinuer ?', title: 'Lancer la mise à jour', confirmLabel: 'Mettre à jour' })) return
    setUpdating(true)
    try { await window.mtcApi.launchInstaller(updatePath) }
    catch (e: any) { showToast(`Erreur : ${e?.message || e}`, 'error'); setUpdating(false) }
  }

  const handleImportPlugin = async () => {
    setPluginError('')
    const path = await window.mtcApi.showOpenDialog({ filters: [{ name: 'Formulaire Synoria', extensions: ['json'] }] })
    if (!path) return
    setPluginLoading(true)
    try {
      const plugin = await window.mtcApi.pluginImport(path)
      await window.mtcApi.pluginSet(plugin)
      setActivePlugin(plugin)
      // Sauvegarde automatique comme entrée native (ignorée si déjà présente)
      await window.mtcApi.pluginLibrarySaveNative(plugin)
      setLibrary(lib => {
        if (lib.some(e => e.plugin.id === plugin.id && e.isNative)) return lib
        return [...lib, { plugin, savedAt: new Date().toISOString(), isNative: true }]
      })
      showToast(`Formulaire "${plugin.name}" v${plugin.version} activé ✓`, 'success')
    } catch (e: any) { setPluginError(e?.message || 'Erreur import formulaire.') }
    setPluginLoading(false)
  }

  const handleRemovePlugin = async () => {
    if (!await showConfirm({ message: 'Supprimer le formulaire métier et revenir au formulaire intégré ?', title: 'Supprimer le formulaire métier', confirmLabel: 'Supprimer', danger: true })) return
    await window.mtcApi.pluginRemove()
    setActivePlugin(null)
    showToast('Formulaire supprimé — formulaire MTC restauré', 'success')
  }

  const handleSaveBuiltPlugin = async (plugin: PluginDefinition) => {
    await window.mtcApi.pluginSet(plugin)
    setActivePlugin(plugin)
    setShowBuilder(false)
    showToast(`Formulaire "${plugin.name}" enregistré ✓`, 'success')
  }

  const handleSaveToLibrary = async (plugin: PluginDefinition) => {
    await window.mtcApi.pluginLibrarySave(plugin)
    setLibrary(lib => {
      const idx = lib.findIndex(e => e.plugin.id === plugin.id)
      const entry = { plugin, savedAt: new Date().toISOString() }
      if (idx >= 0) { const n = [...lib]; n[idx] = entry; return n }
      return [...lib, entry]
    })
    showToast(`"${plugin.name}" sauvegardé dans la bibliothèque ✓`, 'success')
  }

  const handleLoadFromLibrary = async (plugin: PluginDefinition) => {
    await window.mtcApi.pluginSet(plugin)
    setActivePlugin(plugin)
    showToast(`Formulaire "${plugin.name}" activé ✓`, 'success')
  }

  const handleEditFromLibrary = (entry: { plugin: PluginDefinition; isNative?: boolean }) => {
    if (entry.isNative) {
      // Clone avec un nouvel ID pour ne jamais écraser le natif
      setBuilderInitial({
        ...entry.plugin,
        id:   entry.plugin.id + '_custom',
        name: entry.plugin.name + ' (personnalisé)',
      })
    } else {
      setBuilderInitial(entry.plugin)
    }
    setShowBuilder(true)
  }

  const handleDeleteFromLibrary = async (pluginId: string, pluginName: string) => {
    if (!await showConfirm({ message: `Supprimer "${pluginName}" de la bibliothèque ?`, title: 'Supprimer', confirmLabel: 'Supprimer', danger: true })) return
    await window.mtcApi.pluginLibraryDelete(pluginId)
    setLibrary(lib => lib.filter(e => e.plugin.id !== pluginId))
    showToast('Formulaire supprimé de la bibliothèque', 'success')
  }

  const handleExportLibrary = async () => {
    const dest = await window.mtcApi.showSaveDialog({ defaultPath: 'synoria-bibliotheque-formulaires.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!dest) return
    try {
      await window.mtcApi.pluginLibraryExport(dest)
      showToast('Bibliothèque exportée ✓', 'success')
      await window.mtcApi.openPath(dest)
    } catch (e: any) { showToast(e?.message || 'Erreur export', 'error') }
  }

  const handleImportLibrary = async () => {
    const src = await window.mtcApi.showOpenDialog({ filters: [{ name: 'JSON', extensions: ['json'] }], title: 'Importer une bibliothèque de formulaires' })
    if (!src) return
    try {
      const result = await window.mtcApi.pluginLibraryImport(src)
      const updated = await window.mtcApi.pluginLibraryGet()
      setLibrary(updated)
      showToast(`Bibliothèque importée — ${result.added} ajouté(s), ${result.updated} mis à jour`, 'success')
    } catch (e: any) { showToast(e?.message || 'Erreur import', 'error') }
  }

  const handleGenerateDiagnostic = async () => {
    setDiagGenerating(true)
    try {
      const path = await window.mtcApi.generateDiagnosticReport()
      showToast('Rapport généré ✓', 'success')
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

        {isOwner && (
          <div style={{
            margin: '12px 8px 4px',
            padding: '7px 10px',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))',
            border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{ fontSize: 15 }}>👑</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Mode propriétaire</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Accès complet sans abonnement</div>
            </div>
          </div>
        )}

        {/* ── Mini aperçu live du formulaire en cours d'édition ── */}
        {showBuilder && builderLivePreview && builderLivePreview.sections.some(s => s.fields.length > 0) && (
          <div style={{
            margin: '16px 8px 20px',
            borderRadius: 10,
            border: '1px solid var(--border-soft)',
            background: 'var(--surface)',
            boxShadow: [
              '0 1px 2px rgba(0,0,0,.06)',
              '0 4px 12px rgba(0,0,0,.12)',
              '0 16px 40px rgba(0,0,0,.10)',
              '-6px 0 20px rgba(0,0,0,.05)',
              '6px 0 20px rgba(0,0,0,.05)',
            ].join(', '),
            transform: 'translateY(-1px)',
            overflow: 'hidden',
          }}>
            {/* En-tête : icône + nom + contrôles zoom */}
            <div style={{
              padding: '7px 8px',
              background: `color-mix(in srgb, ${builderLivePreview.accentColor || 'var(--accent)'} 12%, var(--surface))`,
              borderBottom: `2px solid ${builderLivePreview.accentColor || 'var(--accent)'}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{builderLivePreview.icon || '📋'}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: builderLivePreview.accentColor || 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {builderLivePreview.name || 'Mon formulaire'}
              </span>
              {/* Contrôles zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  onClick={() => setPreviewZoom(z => Math.max(0.28, parseFloat((z - 0.06).toFixed(2))))}
                  style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 0 }}
                  title="Zoom arrière"
                >−</button>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 26, textAlign: 'center' }}>
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom(z => Math.min(0.85, parseFloat((z + 0.06).toFixed(2))))}
                  style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 0 }}
                  title="Zoom avant"
                >+</button>
              </div>
            </div>

            {/* Formulaire complet — zoom CSS affecte le layout, on voit tout sans clip */}
            <div style={{ overflowY: 'auto' }}>
              <div style={{
                zoom: previewZoom,
                pointerEvents: 'none',
                userSelect: 'none',
                padding: 6,
              }}>
                <PluginFormRenderer
                  plugin={builderLivePreview}
                  data={{}}
                  onChange={() => {}}
                />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── CONTENU ── */}
      <div className="settings-content">

        {/* ════ APPARENCE ════ */}
        {activeTab === 'apparence' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">🎨 Apparence</div>
              <div className="settings-tab-desc">Personnalisez l'affichage de Synoria</div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-purple">🌓</span>
                Thème de l'interface
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Choisissez entre le mode clair, sombre, ou laissez Synoria suivre automatiquement
                les préférences de votre système d'exploitation.
              </p>

              {/* Sélecteur 3 boutons — state dans le composant parent, pas d'IIFE */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {([
                  { id: 'light'  as const, icon: '☀️', label: 'Clair',   desc: 'Fond blanc, idéal en journée'  },
                  { id: 'dark'   as const, icon: '🌙', label: 'Sombre',  desc: 'Fond foncé, confort le soir'   },
                  { id: 'system' as const, icon: '⚙️', label: 'Système', desc: 'Suit votre OS automatiquement' },
                ]).map(o => {
                  const active = localThemeMode === o.id
                  return (
                    <button
                      key={o.id}
                      onClick={() => applyThemeMode(o.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 8, padding: '20px 12px', borderRadius: 12,
                        border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
                        background: active ? 'var(--accent-light)' : 'var(--surface)',
                        cursor: 'pointer', transition: 'all .15s', outline: 'none',
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{o.icon}</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: active ? 'var(--accent)' : 'var(--text)' }}>
                        {o.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                        {o.desc}
                      </div>
                      {active && (
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--accent)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800,
                        }}>✓</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

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
                <button className="btn btn-secondary btn-sm" onClick={handleVerifyBackup} disabled={verifying}>
                  {verifying ? '⏳ Vérification…' : '🔍 Vérifier une sauvegarde'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportKey}
                  title="Copier le fichier encryption.key dans un emplacement de votre choix">
                  🔑 Sauvegarder la clé
                </button>
              </div>
              <div className="settings-enc-note">
                🔒 Sauvegardes chiffrées AES-256-GCM · Format : <code>backup-global-YYYY-MM-DD-HHhMM.json.enc</code>
                {' · '}<span style={{ color: 'var(--accent)' }}>Nouvelles sauvegardes protégées par votre mot de passe</span>
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
                <button className="btn btn-secondary btn-sm" onClick={handleImport}>
                  📥 Importer une sauvegarde patient
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
                    const path = await window.mtcApi.showOpenDialog({
                      filters: [],
                      properties: ['openDirectory', 'createDirectory'],
                    })
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

            {/* Alerte retard de paiement */}
            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-amber">⚠️</span>
                Alerte retard de paiement
              </div>
              <div style={{ marginBottom: 8, fontSize: 13 }}>
                Afficher une alerte sur le tableau de bord pour les factures non payées depuis plus de :
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={7} max={90} step={1}
                  value={settings.invoiceOverdueDays ?? 30}
                  onChange={e => setSettings({ ...settings, invoiceOverdueDays: Number(e.target.value) })}
                  onMouseUp={e => save({ invoiceOverdueDays: Number((e.target as HTMLInputElement).value) })}
                  style={{ width: 200 }} />
                <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 16, minWidth: 70 }}>
                  {settings.invoiceOverdueDays ?? 30} jours
                </span>
              </div>
              <div className="settings-enc-note" style={{ marginTop: 8 }}>
                Les factures non marquées comme payées depuis ce délai apparaissent en alerte sur le tableau de bord.
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
                    placeholder="Nom Prénom ou Cabinet" />
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
              {/* Badge version */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-light)', border: '1px solid rgba(var(--accent-rgb, 42,122,106),.2)' }}>
                <span style={{ fontSize: 28 }}>📦</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Version installée</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>
                    v{appVersion || '…'}
                  </div>
                </div>
                {!updatePath && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--teal)', background: 'var(--teal-light)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(42,122,106,.2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} />
                    À jour
                  </div>
                )}
                {updatePath && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--amber)', background: 'var(--amber-light)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(215,119,0,.2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
                    Mise à jour prête
                  </div>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                {isMac
                  ? <>Sélectionnez le fichier <code>.dmg</code> de la nouvelle version. Il s'ouvrira dans le Finder — glissez l'app dans Applications pour remplacer l'ancienne version.</>
                  : <>Sélectionnez le fichier <code>.exe</code> de la nouvelle version. L'application se fermera pour lancer l'installation — <strong>vos données ne sont pas supprimées</strong>.</>
                }
              </p>
              {updatePath && (
                <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: 'var(--teal-light)', border: '1px solid rgba(42,122,106,.2)', fontSize: 12, color: 'var(--teal)', wordBreak: 'break-all' }}>
                  ✓ Fichier sélectionné : <strong>{updatePath}</strong>
                </div>
              )}
              <div className="settings-actions">
                <button className="btn btn-secondary btn-sm" onClick={handleSelectUpdate} disabled={updating}>
                  📥 Sélectionner le fichier de mise à jour ({isMac ? '.dmg' : '.exe'})
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
                <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                  Cliquez sur le bouton ci-dessous pour connecter votre compte Google.
                  Votre navigateur s'ouvrira pour vous demander d'autoriser l'accès à Google Calendar.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleGcalConnect}
                  disabled={gcalLoading}
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

                {/* ── Calendriers à importer avec couleurs ── */}
                <div style={{ marginTop: 24 }}>
                  <div className="settings-section-title">Calendriers à importer</div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Les événements de ces calendriers apparaîtront dans Synoria à titre d'information (non modifiables).
                    Choisissez une couleur distincte pour chaque calendrier.
                  </p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={loadGcalImportCalendars}
                    disabled={gcalLoading}
                    style={{ marginBottom: 14 }}
                  >
                    {gcalLoading ? '⏳ Chargement…' : '🔄 Charger mes calendriers Google'}
                  </button>

                  {gcalCalendars.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                        {gcalCalendars.map(cal => {
                          const state = gcalImportState[cal.id] || { selected: false, color: '#1a73e8' }
                          return (
                            <div key={cal.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', borderRadius: 'var(--radius)',
                              border: `1.5px solid ${state.selected ? state.color : 'var(--border-soft)'}`,
                              background: state.selected ? `${state.color}10` : 'var(--bg)',
                              opacity: gcalInfo?.calendarId === cal.id ? .55 : 1,
                              transition: 'border-color .15s, background .15s',
                            }}>
                              {/* Couleur */}
                              <input
                                type="color"
                                value={state.color}
                                disabled={!state.selected || gcalInfo?.calendarId === cal.id}
                                title="Couleur des RDV importés"
                                style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: state.selected ? 'pointer' : 'not-allowed', padding: 2 }}
                                onChange={e => setGcalImportState(prev => ({
                                  ...prev,
                                  [cal.id]: { ...prev[cal.id], color: e.target.value }
                                }))}
                              />
                              {/* Nom */}
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                                {cal.summary}
                                {cal.primary && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>· Principal</span>}
                                {gcalInfo?.calendarId === cal.id && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>· Utilisé pour export</span>}
                              </span>
                              {/* Toggle */}
                              {gcalInfo?.calendarId !== cal.id && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                                  <input
                                    type="checkbox"
                                    checked={state.selected}
                                    onChange={e => setGcalImportState(prev => ({
                                      ...prev,
                                      [cal.id]: { ...prev[cal.id], selected: e.target.checked }
                                    }))}
                                  />
                                  Importer
                                </label>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveImportCalendars}
                        disabled={gcalImportSaving}
                      >
                        {gcalImportSaving ? '⏳ Enregistrement…' : '💾 Enregistrer la sélection'}
                      </button>
                    </div>
                  )}

                  {gcalInfo?.importCalendars && gcalInfo.importCalendars.length > 0 && gcalCalendars.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Calendriers importés actuellement :</div>
                      {gcalInfo.importCalendars.map(cal => (
                        <div key={cal.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-soft)' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: cal.color || '#1a73e8', flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ fontSize: 12 }}>{cal.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ PLUGIN ════ */}
        {activeTab === 'plugin' && (() => {
          // Seul "basique" est gratuit et inclus dans l'application.
          // Tous les autres formulaires sont payants et importés séparément.
          // Exception : le propriétaire (isOwner) a accès à tous les formulaires bundlés.
          const FREE_FORM_IDS = ['basique']
          const officialForms = isOwner
            ? availablePlugins
            : FREE_FORM_IDS
                .map(id => availablePlugins.find(p => p.id === id))
                .filter((p): p is PluginDefinition => Boolean(p))

          const handleSetDefault = async (form: PluginDefinition) => {
            setPluginError('')
            setPluginLoading(true)
            try {
              await window.mtcApi.pluginSet(form)
              setActivePlugin(form)
              showToast(`Formulaire « ${form.name} » défini par défaut ✓`, 'success')
            } catch (e: any) { setPluginError(e?.message || 'Erreur.') }
            setPluginLoading(false)
          }

          const importedActive = !isOwner && activePlugin && !FREE_FORM_IDS.includes(activePlugin.id) ? activePlugin : null

          return (
            <div>
              <div className="settings-tab-header">
                <div className="settings-tab-title">📋 Formulaire métier</div>
                <div className="settings-tab-desc">Choisissez le formulaire utilisé par défaut à la création d'une nouvelle séance. Vous pouvez toujours en changer directement dans la page « Nouvelle séance ».</div>
              </div>

              {/* ── Formulaire gratuit ── */}
              <div className="settings-card">
                <div className="settings-card-title">
                  <span className="card-title-icon icon-blue">📋</span>
                  Formulaire gratuit — inclus
                </div>
                {officialForms.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement des formulaires…</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {officialForms.map(form => {
                      const isActive = activePlugin?.id === form.id || (!activePlugin && form.id === 'basique')
                      return (
                        <div key={form.id} style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                          borderRadius: 10, border: isActive ? `2px solid ${form.accentColor || 'var(--accent)'}` : '1.5px solid var(--border-soft)',
                          background: isActive ? (form.accentColor || 'var(--accent)') + '0D' : 'var(--surface)',
                          transition: 'border-color .15s',
                        }}>
                          <div style={{ fontSize: 30, flexShrink: 0 }}>{form.icon || '📋'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: form.accentColor || 'var(--accent)' }}>{form.name}</span>
                              {isActive && (
                                <span style={{ fontSize: 10, fontWeight: 700, background: form.accentColor || 'var(--accent)', color: '#fff', borderRadius: 10, padding: '2px 8px' }}>
                                  Actif
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {form.specialty}
                              {form.description && <span> — {form.description}</span>}
                            </div>
                          </div>
                          {!isActive && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetDefault(form)}
                              disabled={pluginLoading}
                              style={{ flexShrink: 0 }}
                            >
                              Définir par défaut
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="settings-enc-note" style={{ marginTop: 14 }}>
                  Le choix du formulaire ne modifie pas les données existantes. Toutes les séances restent accessibles quel que soit le formulaire actif.
                </div>
              </div>

              {/* ── Formulaire acheté ── */}
              <div className="settings-card" style={{ marginTop: 16 }}>
                <div className="settings-card-title">
                  <span className="card-title-icon icon-amber">📥</span>
                  Formulaire acheté
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  Si vous avez acheté un formulaire Synoria, vous avez reçu un fichier <strong>.json</strong>.
                  Sélectionnez-le ci-dessous pour l'activer sur votre poste.
                </p>

                {importedActive && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', marginBottom: 14,
                    borderRadius: 10, border: `2px solid ${importedActive.accentColor || 'var(--accent)'}`,
                    background: (importedActive.accentColor || 'var(--accent)') + '0D',
                  }}>
                    <div style={{ fontSize: 28, flexShrink: 0 }}>{importedActive.icon || '📋'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: importedActive.accentColor || 'var(--accent)' }}>
                          {importedActive.name}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, background: importedActive.accentColor || 'var(--accent)', color: '#fff', borderRadius: 10, padding: '2px 8px' }}>
                          Actif
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {importedActive.specialty} — v{importedActive.version}
                        {importedActive.author && <span> · {importedActive.author}</span>}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleRemovePlugin}
                      disabled={pluginLoading}
                      style={{ flexShrink: 0, color: 'var(--red)', borderColor: 'var(--red)' }}
                    >
                      Supprimer
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleImportPlugin}
                    disabled={pluginLoading}
                  >
                    {pluginLoading ? '⏳ Import…' : '📂 Sélectionner un formulaire…'}
                  </button>
                  {importedActive && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Sélectionner un nouveau fichier remplacera le formulaire actif.
                    </span>
                  )}
                </div>

                {pluginError && (
                  <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10, padding: '8px 12px', background: '#FEF0F0', borderRadius: 8 }}>
                    ⚠️ {pluginError}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ════ SUPPORT TECHNIQUE ════ */}
        {activeTab === 'support' && (
          <div>
            <div className="settings-tab-header">
              <div className="settings-tab-title">🔧 Support technique</div>
              <div className="settings-tab-desc">Diagnostic et assistance</div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-green">📖</span>
                Documentation d'utilisation
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Guide complet du logiciel : patients, séances, calendrier, comptabilité, sauvegardes, RGPD et plugins.
              </p>
              <div className="settings-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => window.mtcApi.openDocumentation()}
                >
                  📖 Ouvrir la documentation
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">💿</span>
                Guide d'installation
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Installation Windows, transfert vers un autre poste, mises à jour et désinstallation.
              </p>
              <div className="settings-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.mtcApi.openInstallGuide()}
                >
                  💿 Ouvrir le guide d'installation
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-purple">⚖️</span>
                Guide RGPD praticien
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Obligations légales, base juridique, consentement patient, durée de conservation, registre Art. 30 et marche à suivre en cas d'incident.
              </p>
              <div className="settings-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.mtcApi.openRgpdGuide()}
                >
                  ⚖️ Ouvrir le guide RGPD
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-blue">📋</span>
                Rapport de diagnostic
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                En cas de problème, générez un rapport de diagnostic et envoyez-le à&nbsp;
                <strong>contact@logiciel-synoria.fr</strong>.
                Le rapport sera ouvert automatiquement dans votre éditeur de texte.
              </p>
              <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                ✅ <strong>Ce rapport ne contient aucune donnée patient</strong> (ni nom, prénom, email, notes). Il inclut uniquement des informations techniques : version, OS, statistiques anonymes de la base de données, configuration et journal d'erreurs.
              </div>
              <div className="settings-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerateDiagnostic}
                  disabled={diagGenerating}
                >
                  {diagGenerating ? '⏳ Génération…' : '🔧 Générer le rapport de diagnostic'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenSupportDoc}
                >
                  📄 Guide de lecture du rapport
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-title">
                <span className="card-title-icon icon-green">✉️</span>
                Contact support
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <div><strong>Email :</strong> contact@logiciel-synoria.fr</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Joignez le rapport de diagnostic à votre message pour accélérer le traitement.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal unifiée : déverrouiller backup (mot de passe OU fichier clé) */}
        {bkpModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBkpModal(null)}>
            <div className="modal" style={{ maxWidth: 460 }}>
              <button className="modal-close" onClick={() => setBkpModal(null)}>×</button>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                🔓 Déverrouiller la sauvegarde
              </h2>

              {/* Sélecteur de méthode */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {([['password', '🔑 Mot de passe'], ['key', '📄 Fichier clé']] as const).map(([m, label]) => (
                  <button key={m} type="button"
                    onClick={() => { setBkpModal(prev => prev ? { ...prev, mode: m } : prev); setBkpPwdError('') }}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `2px solid ${bkpModal.mode === m ? 'var(--accent)' : 'var(--border)'}`,
                      background: bkpModal.mode === m ? 'var(--accent-light)' : 'transparent',
                      color: bkpModal.mode === m ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {bkpModal.mode === 'password' ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                    Pour les sauvegardes créées avec <strong>Synoria V1.4.4+</strong>.<br />
                    Saisissez le mot de passe Synoria utilisé sur la machine d'origine.
                  </p>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Mot de passe Synoria</label>
                    <input type="password" value={bkpPwdInput} autoFocus
                      onChange={e => { setBkpPwdInput(e.target.value); setBkpPwdError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleImportWithPassword()}
                      placeholder="Votre mot de passe Synoria…" />
                  </div>
                  {bkpPwdError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>⚠ {bkpPwdError}</div>}
                  <div className="modal-footer">
                    <button className="btn btn-primary" onClick={handleImportWithPassword} disabled={!bkpPwdInput.trim() || bkpPwdLoading}>
                      {bkpPwdLoading ? '⏳…' : '✓ Restaurer'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setBkpModal(null)}>Annuler</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    Pour les sauvegardes créées avec <strong>Synoria V1.4.3 et antérieures</strong>.<br />
                    Sélectionnez le fichier <code>encryption.key</code> de la machine d'origine.
                  </p>
                  <div style={{ background: 'var(--amber-light)', border: '1px solid rgba(193,123,42,.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
                    <strong>📍 Où trouver ce fichier sur la machine d'origine :</strong><br />
                    <code style={{ fontSize: 11 }}>C:\Users\[votre nom]\AppData\Roaming\Synoria\encryption.key</code>
                  </div>
                  {bkpPwdError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>⚠ {bkpPwdError}</div>}
                  <div className="modal-footer">
                    <button className="btn btn-primary" onClick={handleImportWithKey} disabled={bkpPwdLoading}>
                      {bkpPwdLoading ? '⏳…' : '📂 Sélectionner le fichier clé'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setBkpModal(null)}>Annuler</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      {/* Modal prévisualisation plugin bibliothèque */}
      {previewPlugin && (
        <div className="modal-overlay" onClick={() => setPreviewPlugin(null)}>
          <div className="modal" style={{ maxWidth: 800, width: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewPlugin(null)}>✕</button>
            <h2 style={{ color: previewPlugin.accentColor || 'var(--accent)' }}>
              {previewPlugin.icon || '📋'} Aperçu — {previewPlugin.name}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {previewPlugin.specialty} · v{previewPlugin.version}
            </div>
            {previewPlugin.useBuiltinForm ? (
              <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, color: 'var(--accent)', fontSize: 13 }}>
                ✅ Ce formulaire utilise le <strong>formulaire MTC intégré</strong> (non prévisualisable ici).
              </div>
            ) : (
              <PluginFormRenderer
                plugin={previewPlugin}
                data={{}}
                onChange={() => {}}
              />
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewPlugin(null)}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { handleLoadFromLibrary(previewPlugin); setPreviewPlugin(null) }}>✅ Activer ce formulaire</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
