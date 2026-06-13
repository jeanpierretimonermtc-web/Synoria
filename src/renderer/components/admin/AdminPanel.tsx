import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onClose: () => void
  theme: 'light' | 'dark'
}

type AdminTab = 'system' | 'logs' | 'database' | 'settings'

export default function AdminPanel({ onClose, theme }: Props) {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword]           = useState('')
  const [pwdError, setPwdError]           = useState('')
  const [tab, setTab]                     = useState<AdminTab>('system')

  // System
  const [sysInfo, setSysInfo]             = useState<Record<string, any> | null>(null)
  const [dbStats, setDbStats]             = useState<Record<string, number>>({})

  // Logs
  const [logs, setLogs]                   = useState<string[]>([])
  const [logsLoading, setLogsLoading]     = useState(false)

  // Database
  const [integrityResult, setIntegrityResult] = useState('')
  const [walResult, setWalResult]             = useState('')
  const [dbLoading, setDbLoading]             = useState(false)
  const [backupResult, setBackupResult]       = useState('')

  // Settings
  const [settingsJson, setSettingsJson]   = useState('')

  const inputRef  = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Fermeture avec Echap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!authenticated) setTimeout(() => inputRef.current?.focus(), 100)
  }, [authenticated])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const ok = await window.mtcApi.adminVerify(password)
      if (ok) {
        setAuthenticated(true)
        loadSystem()
      } else {
        setPwdError('Mot de passe incorrect.')
        setPassword('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    } catch {
      setPwdError('Erreur IPC — relancez l\'application (Ctrl+C → npm run electron:dev).')
      setPassword('')
    }
  }

  const loadSystem = useCallback(async () => {
    const [info, stats] = await Promise.all([
      window.mtcApi.adminGetSystemInfo(),
      window.mtcApi.adminDbStats(),
    ])
    setSysInfo(info)
    setDbStats(stats)
  }, [])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const lines = await window.mtcApi.adminGetLogs(200)
    setLogs(lines)
    setLogsLoading(false)
    setTimeout(() => logsEndRef.current?.scrollIntoView(), 50)
  }, [])

  const clearLogs = async () => {
    await window.mtcApi.adminClearLogs()
    setLogs([])
  }

  const runIntegrity = async () => {
    setDbLoading(true)
    setIntegrityResult('')
    const r = await window.mtcApi.adminDbIntegrity()
    setIntegrityResult(r)
    setDbLoading(false)
  }

  const runWal = async () => {
    setDbLoading(true)
    setWalResult('')
    const r = await window.mtcApi.adminWalCheckpoint()
    setWalResult(r)
    setDbLoading(false)
  }

  const runBackup = async () => {
    setDbLoading(true)
    setBackupResult('')
    try {
      const path = await window.mtcApi.adminForceBackup()
      setBackupResult(`✓ Sauvegarde créée : ${path}`)
    } catch (e: any) {
      setBackupResult(`✗ Erreur : ${e?.message}`)
    }
    setDbLoading(false)
  }

  const loadSettings = useCallback(async () => {
    const s = await window.mtcApi.adminGetSettings()
    try { setSettingsJson(JSON.stringify(JSON.parse(s), null, 2)) }
    catch { setSettingsJson(s) }
  }, [])

  useEffect(() => {
    if (!authenticated) return
    if (tab === 'logs')     loadLogs()
    if (tab === 'settings') loadSettings()
    if (tab === 'system')   loadSystem()
  }, [tab, authenticated, loadLogs, loadSettings, loadSystem])

  // ── Styles ────────────────────────────────────────────────────────────────
  const BG      = '#0d0d1a'
  const PANEL   = '#12121f'
  const BORDER  = '#1e1e35'
  const GREEN   = '#00d084'
  const MUTED   = '#6b7280'
  const TEXT    = '#e2e8f0'
  const SUBTEXT = '#94a3b8'
  const FONT    = "'Cascadia Code', 'Fira Code', 'Courier New', monospace"

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'system',   label: 'Système',   icon: '🖥' },
    { id: 'logs',     label: 'Logs',      icon: '📋' },
    { id: 'database', label: 'Base',      icon: '🗄' },
    { id: 'settings', label: 'Config',    icon: '⚙️' },
  ]

  // ── Password gate ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: '40px 48px', width: 380,
          boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        }}>
          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🛡</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, letterSpacing: 2 }}>
              ADMIN · SYNORIA
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
              Accès réservé — mot de passe développeur
            </div>
          </div>

          <form onSubmit={handleVerify}>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwdError('') }}
              placeholder="Mot de passe admin"
              style={{
                width: '100%', padding: '11px 14px', fontSize: 14,
                background: '#0d0d1a', color: TEXT,
                border: `1.5px solid ${pwdError ? '#ef4444' : BORDER}`,
                borderRadius: 8, outline: 'none', fontFamily: FONT,
                letterSpacing: '0.08em', boxSizing: 'border-box',
              }}
              autoComplete="off"
            />
            {pwdError && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{pwdError}</div>
            )}
            <button type="submit" style={{
              width: '100%', marginTop: 16, padding: '11px',
              background: GREEN, color: '#0d0d1a',
              border: 'none', borderRadius: 8, fontWeight: 700,
              fontSize: 14, cursor: 'pointer', fontFamily: FONT,
            }}>
              Accéder
            </button>
            <button type="button" onClick={onClose} style={{
              width: '100%', marginTop: 8, padding: '9px',
              background: 'transparent', color: MUTED,
              border: `1px solid ${BORDER}`, borderRadius: 8,
              fontSize: 13, cursor: 'pointer', fontFamily: FONT,
            }}>
              Annuler
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Panel principal ───────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: BG, fontFamily: FONT, color: TEXT,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: `1px solid ${BORDER}`,
        background: PANEL, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🛡</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: GREEN, letterSpacing: 2 }}>
            ADMIN · SYNORIA
          </span>
          {sysInfo && (
            <span style={{ fontSize: 11, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '2px 8px' }}>
              v{sysInfo.version}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${BORDER}`,
          color: MUTED, borderRadius: 6, padding: '5px 14px',
          cursor: 'pointer', fontSize: 12, fontFamily: FONT,
        }}>
          ✕ Fermer (Échap)
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 24px',
        borderBottom: `1px solid ${BORDER}`,
        background: PANEL, flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'transparent',
            border: 'none', borderBottom: tab === t.id ? `2px solid ${GREEN}` : '2px solid transparent',
            color: tab === t.id ? GREEN : MUTED,
            cursor: 'pointer', fontSize: 13, fontFamily: FONT,
            fontWeight: tab === t.id ? 600 : 400,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

        {/* ── SYSTÈME ── */}
        {tab === 'system' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
            <InfoCard title="Application" color={GREEN}>
              <KV label="Version"   value={sysInfo?.version} />
              <KV label="userData"  value={sysInfo?.userData} mono />
              <KV label="Plateforme" value={`${sysInfo?.platform} ${sysInfo?.arch}`} />
              <KV label="Node.js"   value={sysInfo?.nodeVersion} />
              <KV label="Electron"  value={sysInfo?.electronVersion} />
              <KV label="Uptime"    value={sysInfo ? fmtUptime(sysInfo.uptimeSeconds) : ''} />
              <KV label="Hôte"      value={sysInfo?.hostname} />
            </InfoCard>

            <InfoCard title="Ressources" color="#60a5fa">
              <KV label="DB ouverte"  value={sysInfo?.dbOpen ? '✓ Oui' : '✗ Non'} />
              <KV label="Mémoire app" value={sysInfo ? `${sysInfo.memoryUsedMB} MB` : ''} />
              <KV label="RAM totale"  value={sysInfo ? `${sysInfo.memoryTotalMB} MB` : ''} />
            </InfoCard>

            <InfoCard title="Statistiques base de données" color="#f59e0b">
              {Object.entries(dbStats).map(([t, n]) => (
                <KV key={t} label={t} value={n === -1 ? 'erreur' : String(n) + ' lignes'} />
              ))}
            </InfoCard>

            <InfoCard title="Actions rapides" color="#a78bfa">
              <AdminBtn label="↻ Rafraîchir" onClick={loadSystem} color="#a78bfa" />
            </InfoCard>
          </div>
        )}

        {/* ── LOGS ── */}
        {tab === 'logs' && (
          <div style={{ maxWidth: 1000 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <AdminBtn label="↻ Rafraîchir" onClick={loadLogs}  color={GREEN} />
              <AdminBtn label="🗑 Vider les logs" onClick={clearLogs} color="#ef4444" confirm="Vider synoria.log et synoria.log.old ?" />
            </div>
            <div style={{
              background: '#050508', border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '16px', height: 'calc(100vh - 220px)',
              overflow: 'auto', fontSize: 11.5, lineHeight: 1.7,
            }}>
              {logsLoading && <div style={{ color: MUTED }}>Chargement…</div>}
              {!logsLoading && logs.length === 0 && (
                <div style={{ color: MUTED }}>Aucun log disponible.</div>
              )}
              {logs.map((line, i) => (
                <div key={i} style={{ color: colorLine(line), wordBreak: 'break-all' }}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* ── DATABASE ── */}
        {tab === 'database' && (
          <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <InfoCard title="Vérification d'intégrité SQLite" color="#f59e0b">
              <p style={{ fontSize: 12, color: SUBTEXT, marginBottom: 10 }}>
                Exécute <code>PRAGMA integrity_check</code>. Résultat attendu : <code>ok</code>.
              </p>
              <AdminBtn label="▶ Lancer integrity_check" onClick={runIntegrity} color="#f59e0b" loading={dbLoading} />
              {integrityResult && (
                <pre style={{ marginTop: 12, padding: 12, background: '#050508', borderRadius: 6, fontSize: 11, color: integrityResult === 'ok' ? GREEN : '#ef4444', whiteSpace: 'pre-wrap' }}>
                  {integrityResult}
                </pre>
              )}
            </InfoCard>

            <InfoCard title="WAL Checkpoint" color="#60a5fa">
              <p style={{ fontSize: 12, color: SUBTEXT, marginBottom: 10 }}>
                Force la synchronisation du journal WAL vers le fichier principal.
              </p>
              <AdminBtn label="▶ WAL checkpoint FULL" onClick={runWal} color="#60a5fa" loading={dbLoading} />
              {walResult && (
                <pre style={{ marginTop: 12, padding: 12, background: '#050508', borderRadius: 6, fontSize: 11, color: TEXT, whiteSpace: 'pre-wrap' }}>
                  {walResult}
                </pre>
              )}
            </InfoCard>

            <InfoCard title="Sauvegarde d'urgence" color={GREEN}>
              <p style={{ fontSize: 12, color: SUBTEXT, marginBottom: 10 }}>
                Crée immédiatement une sauvegarde chiffrée générale (.json.enc).
              </p>
              <AdminBtn label="▶ Forcer la sauvegarde" onClick={runBackup} color={GREEN} loading={dbLoading} />
              {backupResult && (
                <div style={{ marginTop: 12, fontSize: 12, color: backupResult.startsWith('✓') ? GREEN : '#ef4444', wordBreak: 'break-all' }}>
                  {backupResult}
                </div>
              )}
            </InfoCard>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <AdminBtn label="↻ Rafraîchir" onClick={loadSettings} color={GREEN} />
            </div>
            <div style={{ fontSize: 12, color: SUBTEXT, marginBottom: 8 }}>
              Contenu brut de <code>settings.json</code> — lecture seule.
            </div>
            <pre style={{
              background: '#050508', border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: 16, fontSize: 11.5,
              color: '#93c5fd', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              height: 'calc(100vh - 230px)', overflow: 'auto', lineHeight: 1.7,
            }}>
              {settingsJson || '{}'}
            </pre>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Composants internes ───────────────────────────────────────────────────────

function InfoCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#12121f', border: '1px solid #1e1e35',
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' as const }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function KV({ label, value, mono }: { label: string; value?: string | number | boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: '#e2e8f0', textAlign: 'right', wordBreak: 'break-all',
        fontFamily: mono ? "'Cascadia Code', monospace" : 'inherit', fontSize: mono ? 10.5 : 12,
      }}>
        {String(value ?? '—')}
      </span>
    </div>
  )
}

function AdminBtn({ label, onClick, color, loading, confirm: confirmMsg }: {
  label: string
  onClick: () => void
  color: string
  loading?: boolean
  confirm?: string
}) {
  const handleClick = () => {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    onClick()
  }
  return (
    <button onClick={handleClick} disabled={loading} style={{
      padding: '8px 16px', background: 'transparent',
      border: `1px solid ${color}`, color: loading ? '#6b7280' : color,
      borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
      fontSize: 12, fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    }}>
      {loading ? '⏳ …' : label}
    </button>
  )
}

function colorLine(line: string): string {
  if (line.includes('] [') && line.toLowerCase().includes('error')) return '#f87171'
  if (line.includes('[warn') || line.toLowerCase().includes('warn')) return '#fbbf24'
  return '#94a3b8'
}

function fmtUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}
