import React, { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Session, Patient } from '../../shared/types'
import type { PluginDefinition } from '../../shared/pluginTypes'
import { ToastContext } from '../App'
import { fmtDate, getInitials, getEvolBadgeClass } from '../utils/format'
import { SummaryContent } from './SummaryPage'
import EmptyState from '../components/common/EmptyState'
import { ClipboardIcon, SearchIcon } from '../components/common/Icon'

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function SeancesPage() {
  const { sessionId }  = useParams<{ sessionId?: string }>()
  const navigate       = useNavigate()
  const location       = useLocation()
  const showToast      = useContext(ToastContext)

  const presetPatient  = (location.state as any)?.patientId || ''

  const [sessions,     setSessions]     = useState<Session[]>([])
  const [patients,     setPatients]     = useState<Patient[]>([])
  const [activePlugin, setActivePlugin] = useState<PluginDefinition | null>(null)
  const [loading,      setLoading]      = useState(true)

  // Filtres
  const [search,         setSearch]         = useState('')
  const [filterPatient,  setFilterPatient]  = useState(presetPatient)
  const [filterYear,     setFilterYear]     = useState('')
  const [filterMonth,    setFilterMonth]    = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        window.mtcApi.getSessions(),
        window.mtcApi.getPatients(),
      ])
      setSessions(s)
      setPatients(p)
      window.mtcApi.pluginGet().then(pl => setActivePlugin(pl || null)).catch(() => {})
    } catch { showToast('Erreur chargement', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (presetPatient) setFilterPatient(presetPatient) }, [presetPatient])

  // ── Séance sélectionnée ──────────────────────────────────────────
  const selectedSession = sessionId ? sessions.find(s => s.id === sessionId) || null : null
  const selectedPatient = selectedSession
    ? patients.find(p => p.id === selectedSession.patient_id) || null
    : null

  // ── Filtrage ─────────────────────────────────────────────────────
  const getPatient = (id: string) => patients.find(p => p.id === id)

  const filtered = sessions.filter(s => {
    const p = getPatient(s.patient_id)
    if (filterPatient && s.patient_id !== filterPatient) return false
    if (filterYear  && !s.date.startsWith(filterYear))  return false
    if (filterMonth && !s.date.startsWith(
      `${filterYear || s.date.slice(0,4)}-${filterMonth}`)) return false
    if (search) {
      const txt = `${p?.first_name} ${p?.last_name} ${s.motif || ''} ${s.diagnostic_mtc || ''} ${s.date}`.toLowerCase()
      if (!txt.includes(search.toLowerCase())) return false
    }
    return true
  })

  const years = [...new Set(sessions.map(s => s.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a))

  // ── Actions ──────────────────────────────────────────────────────
  const handleSelect = (id: string) => {
    navigate(`/seances/${id}`, { replace: true })
    const s = sessions.find(x => x.id === id)
    const p = patients.find(x => x.id === s?.patient_id)
    if (s && p) {
      window.mtcApi.logAccess(
        s.patient_id, 'séance_consultée', `${p.first_name} ${p.last_name} — ${s.date}`,
      ).catch(() => {})
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette séance ?')) return
    try {
      await window.mtcApi.deleteSession(id)
      showToast('Séance supprimée')
      if (sessionId === id) navigate('/seances', { replace: true })
      load()
    } catch { showToast('Erreur suppression', 'error') }
  }

  const handleDuplicate = async (id: string) => {
    try { await window.mtcApi.duplicateSession(id); showToast('Séance dupliquée ✓'); load() }
    catch { showToast('Erreur duplication', 'error') }
  }

  const handleExportExcel = async () => {
    if (!selectedSession) return
    try { const f = await window.mtcApi.exportSessionExcel(selectedSession.id); await window.mtcApi.openPath(f); showToast('Export Excel créé ✓') }
    catch { showToast('Erreur export Excel', 'error') }
  }

  const handleExportJson = async () => {
    if (!selectedSession) return
    try { const f = await window.mtcApi.exportSessionJson(selectedSession.id); await window.mtcApi.openPath(f); showToast('Export JSON créé ✓') }
    catch { showToast('Erreur export JSON', 'error') }
  }

  if (loading) return <div className="empty">Chargement…</div>

  return (
    <div className="seances-layout">

      {/* ══════════ PANNEAU GAUCHE — Liste ══════════ */}
      <div className="seances-left">

        {/* Filtres */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface)' }}>
          <div className="search-wrap" style={{ marginBottom: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filterPatient}
            onChange={e => setFilterPatient(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
          >
            <option value="">Tous les patients</option>
            {patients.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(p => (
              <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }}
              style={{ flex: 1 }}
            >
              <option value="">Toutes années</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              disabled={!filterYear}
              style={{ flex: 1 }}
            >
              <option value="">Tous mois</option>
              {MONTH_NAMES.map((n, i) => (
                <option key={i} value={String(i + 1).padStart(2, '0')}>{n}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {filtered.length} séance{filtered.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Liste avec séparateurs de mois */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={24} />}
            title="Aucune séance"
            description={search || filterPatient || filterYear ? 'Aucun résultat pour ces filtres.' : 'Aucune séance enregistrée.'}
          />
        ) : (() => {
          const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
          const items: React.ReactNode[] = []
          let lastMonthKey = ''
          sorted.forEach(s => {
            const p = getPatient(s.patient_id)
            const isSelected = s.id === sessionId
            const monthKey = s.date.slice(0, 7)
            if (monthKey !== lastMonthKey) {
              lastMonthKey = monthKey
              const [y, m] = monthKey.split('-')
              items.push(
                <div key={`sep-${monthKey}`} className="seance-month-separator">
                  {MONTH_NAMES[parseInt(m, 10) - 1]} {y}
                </div>
              )
            }
            items.push(
              <div
                key={s.id}
                className={`seance-list-item${isSelected ? ' selected' : ''}`}
                onClick={() => handleSelect(s.id)}
              >
                <div className="initials" style={{
                  width: 30, height: 30, fontSize: 10, flexShrink: 0,
                  background: isSelected ? 'white' : 'var(--accent)',
                  color: isSelected ? 'var(--accent)' : 'white',
                  borderRadius: '50%',
                }}>
                  {p ? getInitials(p.first_name, p.last_name) : '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p ? `${p.last_name.toUpperCase()} ${p.first_name}` : '—'}
                  </div>
                  <div style={{ fontSize: 11, opacity: .75, marginTop: 1 }}>
                    {fmtDate(s.date)}
                  </div>
                  {s.motif && (
                    <div style={{ fontSize: 10.5, opacity: .7, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.motif.replace(/<[^>]+>/g, '').slice(0, 42)}
                    </div>
                  )}
                  {s.evolution_tags && (
                    <span className={`badge ${getEvolBadgeClass(s.evolution_tags)}`} style={{ fontSize: 9, marginTop: 3, display: 'inline-block' }}>
                      {s.evolution_tags}
                    </span>
                  )}
                </div>
              </div>
            )
          })
          return <div>{items}</div>
        })()}
      </div>

      {/* ══════════ PANNEAU DROIT — Détail ══════════ */}
      <div className="seances-right">
        {!selectedSession ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
            <EmptyState
              icon={<ClipboardIcon size={28} />}
              title="Sélectionnez une séance"
              description={`${sessions.length} séance${sessions.length > 1 ? 's' : ''} au total — cliquez sur une entrée dans la liste à gauche.`}
            />
          </div>
        ) : (
          <>
            {/* Barre d'actions */}
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
              padding: '12px 0 16px',
              borderBottom: '1px solid var(--border-soft)', marginBottom: 16,
              position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
            }}>
              <button className="btn btn-secondary btn-sm" onClick={handleExportJson}>⬇ JSON</button>
              <button className="btn btn-secondary btn-sm" onClick={handleExportExcel}>⬇ Excel</button>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Imprimer</button>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-amber btn-sm"
                onClick={() => navigate(`/modifier/${selectedSession.id}`)}
              >✏️ Modifier</button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleDuplicate(selectedSession.id)}
              >Dupliquer</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(selectedSession.id)}
              >Supprimer</button>
            </div>

            {/* Contenu complet de la séance */}
            <SummaryContent
              session={selectedSession}
              patient={selectedPatient}
              activePlugin={activePlugin}
            />
          </>
        )}
      </div>
    </div>
  )
}
