import React, { useEffect, useState, useContext } from 'react'
import type { Patient, AccessLog } from '../../shared/types'
import { ToastContext } from '../App'
import { fmtDate } from '../utils/format'

function fmtTs(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } catch { return iso }
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'fiche_ouverte':      { label: 'Fiche ouverte',      color: 'var(--blue)'   },
  'séance_consultée':   { label: 'Séance consultée',   color: 'var(--accent)' },
  'séance_créée':       { label: 'Séance créée',       color: 'var(--teal)'   },
  'séance_modifiée':    { label: 'Séance modifiée',    color: 'var(--amber)'  },
  'données_exportées':  { label: 'Export données',     color: 'var(--purple)' },
}

export default function RgpdPage() {
  const showToast = useContext(ToastContext)

  const [patients,        setPatients]        = useState<Patient[]>([])
  const [accessLog,       setAccessLog]       = useState<AccessLog[]>([])
  const [alerts,          setAlerts]          = useState<{ nearRetention: Patient[]; overRetention: Patient[] }>({ nearRetention: [], overRetention: [] })
  const [notice,          setNotice]          = useState('')
  const [loading,         setLoading]         = useState(true)
  const [activeTab,       setActiveTab]       = useState<'consentements' | 'journal' | 'alertes' | 'notice' | 'registre'>('consentements')
  const [exportingReg,    setExportingReg]    = useState(false)
  const [logFilter,       setLogFilter]       = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, log, al, s] = await Promise.all([
        window.mtcApi.getPatients(),
        window.mtcApi.getAccessLog(undefined, 300),
        window.mtcApi.getRgpdAlerts(),
        window.mtcApi.getSettings(),
      ])
      setPatients(p)
      setAccessLog(log)
      setAlerts(al)
      setNotice(s.rgpdNotice || '')
    } catch { showToast('Erreur chargement RGPD', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Stats consentement ──────────────────────────────────────────
  const activePatients    = patients.filter(p => p.is_active !== 0)
  const withConsent       = activePatients.filter(p => p.consent_given)
  const withoutConsent    = activePatients.filter(p => !p.consent_given)
  const pct               = activePatients.length ? Math.round((withConsent.length / activePatients.length) * 100) : 0

  // ── Export registre ─────────────────────────────────────────────
  const handleExportRegister = async () => {
    setExportingReg(true)
    try {
      const path = await window.mtcApi.exportTraitementRegister()
      await window.mtcApi.openPath(path)
      showToast('Registre des traitements généré ✓', 'success')
    } catch (e: any) {
      showToast(`Erreur : ${e?.message || e}`, 'error')
    }
    setExportingReg(false)
  }

  // ── Journal filtré ──────────────────────────────────────────────
  const filteredLog = logFilter
    ? accessLog.filter(l =>
        l.action.includes(logFilter) ||
        (l.detail || '').toLowerCase().includes(logFilter.toLowerCase())
      )
    : accessLog

  if (loading) return <div className="empty">Chargement…</div>

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-soft)'}`,
    transition: 'all .12s',
  })

  return (
    <div>
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--teal)', margin: 0 }}>
            🔒 Conformité RGPD
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Gestion des consentements, journal d'accès et registre des traitements (Art. 30 RGPD)
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleExportRegister}
          disabled={exportingReg}
          style={{ background: 'var(--teal)', borderColor: 'var(--teal)' }}
        >
          {exportingReg ? '⏳…' : '📄 Exporter le registre Art. 30'}
        </button>
      </div>

      {/* ── Alertes rapides ── */}
      {(alerts.overRetention.length > 0 || alerts.nearRetention.length > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {alerts.overRetention.length > 0 && (
            <div style={{ background: '#FEE8E8', border: '1px solid rgba(168,50,50,.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--red)' }}>
              ⛔ <strong>{alerts.overRetention.length} patient(s)</strong> dépassent la durée de conservation — action requise
            </div>
          )}
          {alerts.nearRetention.length > 0 && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid rgba(193,123,42,.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--amber)' }}>
              ⚠️ <strong>{alerts.nearRetention.length} patient(s)</strong> approchent la limite de conservation
            </div>
          )}
        </div>
      )}

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          ['consentements', `✅ Consentements (${withConsent.length}/${activePatients.length})`],
          ['journal',       `📋 Journal d'accès (${accessLog.length})`],
          ['alertes',       `⏰ Alertes (${alerts.nearRetention.length + alerts.overRetention.length})`],
          ['notice',        '📄 Notice patient'],
          ['registre',      '📊 Registre Art. 30'],
        ] as [typeof activeTab, string][]).map(([tab, label]) => (
          <button key={tab} style={TAB_STYLE(activeTab === tab)} onClick={() => setActiveTab(tab)}>{label}</button>
        ))}
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* TAB : CONSENTEMENTS */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'consentements' && (
        <div>
          {/* Barre de progression */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--teal)' }}>
                Taux de consentement : {pct}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {withConsent.length} / {activePatients.length} patients actifs
              </div>
            </div>
            <div style={{ height: 10, background: 'var(--border-soft)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--amber)' : 'var(--red)', borderRadius: 5, transition: 'width .4s' }} />
            </div>
          </div>

          {/* Patients sans consentement */}
          {withoutConsent.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ color: 'var(--red)' }}>
                ⚠️ Patients sans consentement documenté ({withoutConsent.length})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Pensez à recueillir et enregistrer leur consentement lors de la prochaine consultation.
              </div>
              {withoutConsent.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                  {p.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.phone}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Créé le {fmtDate(p.created_at.slice(0, 10))}</div>
                </div>
              ))}
            </div>
          )}

          {/* Patients avec consentement */}
          {withConsent.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ color: 'var(--accent)' }}>
                ✅ Consentements documentés ({withConsent.length})
              </div>
              {withConsent.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                  {p.consent_date && (
                    <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                      Consenti le {fmtDate(p.consent_date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB : JOURNAL D'ACCÈS */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'journal' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
            <input
              type="text"
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              placeholder="Filtrer par patient, action…"
              style={{ flex: 1, maxWidth: 350 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredLog.length} entrée(s)</span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredLog.length === 0 ? (
              <div className="empty">Aucun accès enregistré.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-hover)' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Date / Heure</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Action</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map(log => {
                    const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'var(--text)' }
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '7px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtTs(log.timestamp)}</td>
                        <td style={{ padding: '7px 14px' }}>
                          <span style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}44`, borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '7px 14px', color: 'var(--text)' }}>{log.detail || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB : ALERTES CONSERVATION */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'alertes' && (
        <div>
          {alerts.overRetention.length === 0 && alerts.nearRetention.length === 0 ? (
            <div style={{ padding: '20px', background: 'var(--accent-light)', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 13, color: 'var(--accent)', textAlign: 'center' }}>
              ✅ Aucune alerte de conservation — tous les dossiers sont dans les délais.
            </div>
          ) : (
            <>
              {alerts.overRetention.length > 0 && (
                <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--red)' }}>
                  <div className="card-title" style={{ color: 'var(--red)' }}>
                    ⛔ Durée de conservation dépassée ({alerts.overRetention.length})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Ces patients n'ont pas eu d'activité depuis plus longtemps que la durée de conservation configurée. Envisagez l'archivage ou la suppression du dossier après contact avec le patient.
                  </div>
                  {alerts.overRetention.map(p => (
                    <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: 13 }}>
                      <strong>{p.first_name} {p.last_name}</strong>
                      {p.phone && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
              {alerts.nearRetention.length > 0 && (
                <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
                  <div className="card-title" style={{ color: 'var(--amber)' }}>
                    ⚠️ Limite de conservation approchante ({alerts.nearRetention.length})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Ces patients approchent la limite. Pensez à les recontacter ou à documenter une nouvelle consultation.
                  </div>
                  {alerts.nearRetention.map(p => (
                    <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: 13 }}>
                      <strong>{p.first_name} {p.last_name}</strong>
                      {p.phone && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB : NOTICE PATIENT */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'notice' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📄 Notice d'information remise aux patients</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Ce texte est remis aux patients pour les informer du traitement de leurs données (Art. 13 RGPD).
              Modifiez-le dans <strong>⚙️ Paramètres → RGPD</strong>.
            </div>
            <div style={{
              background: '#FAFAF8', border: '1px solid var(--border-soft)', borderRadius: 8,
              padding: '18px 20px', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8,
              whiteSpace: 'pre-wrap', color: 'var(--text)',
            }}>
              {notice || '— Notice non configurée. Rendez-vous dans Paramètres → RGPD pour la saisir. —'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              🖨 Imprimer la notice
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB : REGISTRE ART. 30 */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'registre' && (
        <div className="card">
          <div className="card-title">📊 Registre des traitements — Article 30 RGPD</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Le registre des traitements est un document obligatoire pour tout responsable de traitement de données personnelles.
            Il décrit les activités de traitement, les catégories de données, les mesures de sécurité et les durées de conservation.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Responsable', 'Praticien de santé (vous)'],
              ['Finalité', 'Gestion des dossiers patients et suivi thérapeutique'],
              ['Base légale', 'Art. 9(2)(h) RGPD — Soins de santé'],
              ['Données traitées', 'Identité, coordonnées, données de santé, consentement'],
              ['Destinataires', 'Praticien uniquement — aucun tiers'],
              ['Stockage', '100% local — aucun cloud'],
              ['Chiffrement', 'AES-256-GCM (base + sauvegardes)'],
              ['Transferts UE', 'Aucun'],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '10px 14px', background: 'var(--surface-hover)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleExportRegister}
            disabled={exportingReg}
            style={{ background: 'var(--teal)', borderColor: 'var(--teal)' }}
          >
            {exportingReg ? '⏳ Génération…' : '📄 Générer et ouvrir le registre complet (HTML)'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
            Le registre est généré en HTML — ouvrez-le dans votre navigateur et imprimez en PDF si nécessaire.
          </div>
        </div>
      )}
    </div>
  )
}
