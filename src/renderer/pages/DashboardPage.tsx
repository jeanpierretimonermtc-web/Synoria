import React, { useEffect, useState, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardStats, UpcomingSession, Appointment, Patient, FollowUpPatient } from '../../shared/types'
import { ToastContext } from '../App'
import { fmtDate, getInitials, getEvolBadgeClass } from '../utils/format'
import { UsersIcon, ClipboardIcon, CalendarIcon, CheckIcon, CloseIcon } from '../components/common/Icon'
import EmptyState from '../components/common/EmptyState'

const MONTHS_FR    = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const MONTHS_FULL  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const DAYS_FR      = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

function todayLabel() {
  const d = new Date()
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Statut RDV ────────────────────────────────────────────────────

type ApptStatus = 'upcoming' | 'done' | 'unconfirmed' | 'cancelled'

function getApptStatus(appt: Appointment, todayStr: string): ApptStatus {
  if (appt.is_cancelled) return 'cancelled'
  if (appt.is_done)      return 'done'
  if (appt.date < todayStr) return 'unconfirmed'
  return 'upcoming'
}

const STATUS_CONFIG: Record<ApptStatus, { bg: string; border: string; dot: string; label: string; labelColor: string }> = {
  upcoming:    { bg: 'var(--blue-light)',   border: 'var(--blue-mid)',   dot: 'var(--blue)',   label: 'Planifié',     labelColor: 'var(--blue)'   },
  done:        { bg: 'var(--accent-light)', border: 'var(--accent-mid)', dot: 'var(--accent)', label: 'Réalisé',      labelColor: 'var(--accent)' },
  unconfirmed: { bg: 'var(--amber-light)',  border: 'var(--amber)',      dot: 'var(--amber)',  label: 'À confirmer',  labelColor: 'var(--amber)'  },
  cancelled:   { bg: 'var(--red-light)',    border: 'var(--red)',        dot: 'var(--red)',    label: 'Annulé',       labelColor: 'var(--red)'    },
}

// ── Helpers partagés ──────────────────────────────────────────────

function resolvePatientName(appt: Appointment, patients: Patient[]) {
  if (appt.patient_id) {
    const p = patients.find(x => x.id === appt.patient_id)
    return p
      ? { last: p.last_name.toUpperCase(), first: p.first_name, id: p.id }
      : { last: '—', first: '', id: undefined }
  }
  return {
    last:  (appt.guest_last_name  || '').toUpperCase(),
    first:  appt.guest_first_name || '',
    id:    undefined,
  }
}

// ── SVG chart helpers ─────────────────────────────────────────────

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i]
    const cx = (p0.x + p1.x) / 2
    d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`
  }
  return d
}

// ── ActivityChart (SVG courbe) ────────────────────────────────────

function ActivityChart({ data }: { data: { label: string; count: number }[] }) {
  if (data.length === 0) return null
  const W = 420, H = 88, PX = 18, PY = 10
  const max = Math.max(...data.map(d => d.count), 1)
  const pts = data.map((d, i) => ({
    x: PX + (i / (data.length - 1)) * (W - PX * 2),
    y: PY + (1 - d.count / max) * (H - PY * 2),
    ...d,
  }))
  const linePath = smoothPath(pts)
  const areaPath = pts.length > 1
    ? `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`
    : ''

  return (
    <div className="dash-activity-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 72, display: 'block' }}>
        <defs>
          <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#actGrad)" />}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y}
            r={i === data.length - 1 ? 4.5 : 3}
            fill={i === data.length - 1 ? 'var(--accent)' : 'var(--surface)'}
            stroke="var(--accent)" strokeWidth="2"
            opacity={i === data.length - 1 ? 1 : 0.75}
          />
        ))}
      </svg>
      <div className="dash-chart-labels">
        {data.map((d, i) => {
          const isLast = i === data.length - 1
          return (
            <div key={i} className={`dash-chart-label ${isLast ? 'active' : ''}`}>
              <span className="dash-chart-label-month">{d.label}</span>
              {d.count > 0 && <span className="dash-chart-label-count">{d.count}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── TodaySection ──────────────────────────────────────────────────

function TodaySection({ appts, patients, onNavigate }: {
  appts: Appointment[]
  patients: Patient[]
  onNavigate: () => void
}) {
  if (appts.length === 0) return null
  const todayStr  = toDateStr(new Date())
  const sorted    = [...appts].sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))
  const doneCount = sorted.filter(a => a.is_done).length

  return (
    <div className="dash-today-card" onClick={onNavigate}>
      <div className="dash-today-header">
        <span className="dash-today-title">Aujourd'hui</span>
        <span className="dash-today-meta">
          {doneCount}/{sorted.length} réalisé{doneCount > 1 ? 's' : ''}
        </span>
      </div>
      <div className="dash-today-slots">
        {sorted.map(appt => {
          const status = getApptStatus(appt, todayStr)
          const cfg    = STATUS_CONFIG[status]
          const { last, first } = resolvePatientName(appt, patients)
          return (
            <div key={appt.id} className="dash-today-slot" style={{ borderColor: cfg.border, background: cfg.bg }}>
              <span className="dash-today-time">{appt.heure_debut}</span>
              <span className="dash-today-dot" style={{ background: cfg.dot }} />
              <span className="dash-today-name">{last}{first ? ` ${first[0]}.` : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── FollowUpSection ───────────────────────────────────────────────

function FollowUpSection({ followUp, onNavigate }: {
  followUp: FollowUpPatient[]
  onNavigate: (id: string) => void
}) {
  if (followUp.length === 0) return null

  return (
    <div className="card">
      <div className="card-title">
        <span className="card-title-icon icon-amber">⏰</span>
        Patients à revoir
        <span className="page-header-count" style={{ background: 'var(--amber-light)', color: 'var(--amber)', marginLeft: 6 }}>
          {followUp.length}
        </span>
      </div>
      <div className="recent-sessions-list">
        {followUp.map((item, idx) => {
          const days = item.daysSince
          const urgency = days === null ? 'new' : days > 180 ? 'high' : 'medium'
          const avatarBg = urgency === 'high' ? 'var(--red)' : urgency === 'medium' ? 'var(--amber)' : 'var(--text-muted)'
          return (
            <div
              key={item.patient.id}
              className="recent-session-row"
              onClick={() => onNavigate(item.patient.id)}
              style={{ animationDelay: `${idx * 30}ms`, cursor: 'pointer' }}
            >
              <div className="initials" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0, background: avatarBg, color: '#fff' }}>
                {getInitials(item.patient.first_name, item.patient.last_name)}
              </div>
              <div className="recent-session-info">
                <div className="recent-session-name">
                  <strong>{item.patient.last_name.toUpperCase()}</strong> {item.patient.first_name}
                </div>
                <div className="recent-session-meta">
                  {item.lastSessionDate
                    ? <span className="recent-session-date">Dernière séance : {fmtDate(item.lastSessionDate)}</span>
                    : <span className="recent-session-date" style={{ color: 'var(--text-muted)' }}>Aucune séance enregistrée</span>
                  }
                </div>
              </div>
              <div>
                {days === null
                  ? <span className="badge badge-muted">Nouveau</span>
                  : days > 180
                  ? <span className="badge" style={{ background: 'var(--red)', color: '#fff' }}>{Math.round(days / 30)} mois</span>
                  : <span className="badge badge-amber">{days} j</span>
                }
              </div>
              <div className="recent-session-chevron">›</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Drawer RDV du mois ────────────────────────────────────────────

function RdvDrawer({ initialYear, initialMonth, patients, onClose }: {
  initialYear:  number
  initialMonth: number
  patients:     Patient[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [year,   setYear]       = useState(initialYear)
  const [month,  setMonth]      = useState(initialMonth)
  const [appts,      setAppts]      = useState<Appointment[]>([])
  const [loading,    setLoading]    = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const todayStr = toDateStr(new Date())

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setAppts(await window.mtcApi.getAppointmentsByMonth(y, m))
    setLoading(false)
  }, [])

  useEffect(() => { load(year, month) }, [year, month, load])

  const markDone = async (apptId: string) => {
    setConfirming(apptId)
    try {
      await window.mtcApi.updateAppointment(apptId, { is_done: 1 })
      setAppts(prev => prev.map(a => a.id === apptId ? { ...a, is_done: 1 } : a))
    } catch { /* ignore */ }
    setConfirming(null)
  }

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) }  else setMonth(m => m + 1) }

  const sorted = [...appts].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.heure_debut.localeCompare(b.heure_debut)
  })

  const counts = {
    upcoming:    sorted.filter(a => getApptStatus(a, todayStr) === 'upcoming').length,
    done:        sorted.filter(a => getApptStatus(a, todayStr) === 'done').length,
    unconfirmed: sorted.filter(a => getApptStatus(a, todayStr) === 'unconfirmed').length,
    cancelled:   sorted.filter(a => getApptStatus(a, todayStr) === 'cancelled').length,
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,.35)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn .2s ease',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101,
        width: 'min(540px, 92vw)',
        background: 'var(--surface)',
        boxShadow: '-4px 0 32px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .25s ease',
      }}>
        {/* En-tête */}
        <div style={{
          background: 'linear-gradient(135deg, #2A5A8A 0%, #1A3A6B 100%)',
          padding: '20px 22px 18px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Rendez-vous
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', fontSize: 16, lineHeight: 1 }}>‹</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-serif, serif)' }}>
              {MONTHS_FULL[month - 1]} {year}
            </span>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', fontSize: 16, lineHeight: 1 }}>›</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(counts) as ApptStatus[]).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.12)', borderRadius: 20, padding: '3px 10px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG[s].dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>{STATUS_CONFIG[s].label}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
              <div className="loading-dots"><span /><span /><span /></div>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              Aucun rendez-vous ce mois-ci
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {sorted.map(appt => {
                const status = getApptStatus(appt, todayStr)
                const cfg    = STATUS_CONFIG[status]
                const { last, first, id: patId } = resolvePatientName(appt, patients)
                const initials = (last[0] || '') + (first[0] || '') || '?'
                const isToday  = appt.date === todayStr

                return (
                  <div
                    key={appt.id}
                    onClick={() => patId && navigate('/calendrier')}
                    style={{
                      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
                      borderRadius: 12, padding: '12px 13px',
                      cursor: patId ? 'pointer' : 'default',
                      transition: 'transform .15s, box-shadow .15s',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                    onMouseEnter={e => { if (patId) { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = 'var(--shadow-md)' } }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: cfg.labelColor, background: 'var(--surface)', borderRadius: 20, padding: '2px 8px' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cfg.dot, marginRight: 4, verticalAlign: 'middle' }} />
                        {cfg.label}
                      </span>
                      {isToday && (
                        <span style={{ fontSize: 9, fontWeight: 700, background: '#2A5A8A', color: '#fff', borderRadius: 20, padding: '2px 7px' }}>
                          Aujourd'hui
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: cfg.dot, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, textTransform: 'uppercase' }}>
                        {initials.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {new Date(appt.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span>·</span>
                      <span>{appt.heure_debut}{appt.heure_fin ? ` → ${appt.heure_fin}` : ''}</span>
                    </div>

                    {appt.note && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {appt.note}
                      </div>
                    )}

                    {status === 'unconfirmed' && (
                      <button
                        onClick={e => { e.stopPropagation(); markDone(appt.id) }}
                        disabled={confirming === appt.id}
                        style={{
                          marginTop: 2, width: '100%', padding: '7px 0',
                          background: confirming === appt.id ? 'rgba(74,103,65,.15)' : 'rgba(193,123,42,.12)',
                          border: `1.5px solid ${confirming === appt.id ? '#4A6741' : '#C17B2A'}`,
                          borderRadius: 8, cursor: confirming === appt.id ? 'default' : 'pointer',
                          fontSize: 11, fontWeight: 700,
                          color: confirming === appt.id ? '#4A6741' : '#C17B2A',
                          letterSpacing: '.02em', transition: 'background .15s, border-color .15s, color .15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                        onMouseEnter={e => { if (confirming !== appt.id) { const b = e.currentTarget; b.style.background = 'rgba(74,103,65,.18)'; b.style.borderColor = '#4A6741'; b.style.color = '#4A6741' } }}
                        onMouseLeave={e => { if (confirming !== appt.id) { const b = e.currentTarget; b.style.background = 'rgba(193,123,42,.12)'; b.style.borderColor = '#C17B2A'; b.style.color = '#C17B2A' } }}
                      >
                        {confirming === appt.id
                          ? <><span style={{ fontSize: 13 }}>✓</span> Confirmé !</>
                          : <><span style={{ fontSize: 13 }}>✓</span> Marquer réalisé</>
                        }
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pied */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-soft)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { onClose(); navigate('/calendrier') }}>
            Ouvrir le calendrier →
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────

export default function DashboardPage() {
  const [stats,           setStats]           = useState<DashboardStats | null>(null)
  const [upcoming,        setUpcoming]        = useState<UpcomingSession[]>([])
  const [monthlyActivity, setMonthlyActivity] = useState<{ label: string; count: number }[]>([])
  const [monthApptCount,  setMonthApptCount]  = useState(0)
  const [drawerOpen,      setDrawerOpen]      = useState(false)
  const [todayAppts,      setTodayAppts]      = useState<Appointment[]>([])
  const [patients,        setPatients]        = useState<Patient[]>([])
  const [followUpPatients,setFollowUpPatients]= useState<FollowUpPatient[]>([])
  const navigate  = useNavigate()
  const showToast = useContext(ToastContext)

  const now      = new Date()
  const todayStr = toDateStr(now)

  useEffect(() => {
    window.mtcApi.getDashboardStats().then(setStats).catch(() => showToast('Erreur chargement stats', 'error'))
    window.mtcApi.getUpcomingSessions().then(setUpcoming).catch(() => {})
    window.mtcApi.getPatients().then(setPatients).catch(() => {})
    window.mtcApi.getAppointmentsByDate(todayStr).then(setTodayAppts).catch(() => {})
    window.mtcApi.getPatientsToFollowUp(90).then(setFollowUpPatients).catch(() => {})

    window.mtcApi.getAppointmentsByMonth(now.getFullYear(), now.getMonth() + 1)
      .then(a => setMonthApptCount(a.length))
      .catch(() => {})

    const promises = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return window.mtcApi.getSessionsByMonth(d.getFullYear(), d.getMonth() + 1)
        .then(s => ({ label: MONTHS_SHORT[d.getMonth()], count: s.length }))
        .catch(() => ({ label: MONTHS_SHORT[d.getMonth()], count: 0 }))
    })
    Promise.all(promises).then(setMonthlyActivity)
  }, [])

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div className="loading-dots"><span /><span /><span /></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>
      </div>
    )
  }

  const monthLabel     = `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`
  const followedRatio  = stats.total_patients > 0 ? Math.round((stats.active_patients / stats.total_patients) * 100) : 0
  const maxMonth       = Math.max(...monthlyActivity.map(m => m.count), 1)
  const thisMonthRatio = Math.round((stats.sessions_this_month / maxMonth) * 100)

  // Tendance séances : mois en cours vs mois précédent
  const lastMonthCount   = monthlyActivity.length >= 2 ? monthlyActivity[monthlyActivity.length - 2].count : null
  const sessionsTrend    = lastMonthCount !== null ? stats.sessions_this_month - lastMonthCount : null

  return (
    <div className="dashboard">

      {/* ── Bienvenue ── */}
      <div className="dash-welcome">
        <div>
          <div className="dash-welcome-title">Bienvenue</div>
          <div className="dash-welcome-date">{todayLabel()}</div>
        </div>
        <div className="dash-quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/nouvelle')}>＋ Nouvelle séance</button>
          <button className="btn btn-secondary" onClick={() => navigate('/patients')}>Patients</button>
          <button className="btn btn-secondary" onClick={() => navigate('/calendrier')}>Calendrier</button>
        </div>
      </div>

      {/* ── Aujourd'hui ── */}
      <TodaySection
        appts={todayAppts}
        patients={patients}
        onNavigate={() => navigate('/calendrier')}
      />

      {/* ── Statistiques ── */}
      <div className="stats-grid">
        <StatCard
          num={stats.total_patients}
          label="Patients"
          sub="au total"
          icon={<UsersIcon size={18} />}
          iconBg="#5B8CF7"
          barRatio={followedRatio}
          barColor="#5B8CF7"
        />
        <StatCard
          num={stats.total_sessions}
          label="Séances"
          sub="depuis le début"
          icon={<ClipboardIcon size={18} />}
          iconBg="#BF5AF2"
        />
        <StatCard
          num={stats.sessions_this_month}
          label="Ce mois"
          sub={monthLabel}
          icon={<CalendarIcon size={18} />}
          iconBg="#FF453A"
          barRatio={thisMonthRatio}
          barColor="#FF453A"
          trend={sessionsTrend}
        />
        <StatCard
          num={stats.active_patients}
          label="Patients suivis"
          sub={`${followedRatio}% actifs`}
          icon={<CheckIcon size={18} />}
          iconBg="#30D158"
          barRatio={followedRatio}
          barColor="#30D158"
        />
        <StatCard
          num={monthApptCount}
          label="RDV du mois"
          sub={monthLabel}
          icon={<span style={{ fontSize: 18 }}>📅</span>}
          iconBg="#2A5A8A"
          clickable
          onClick={() => setDrawerOpen(true)}
        />
      </div>

      {/* ── Activité — 6 derniers mois (SVG) ── */}
      {monthlyActivity.length > 0 && (
        <div className="dash-activity">
          <div className="dash-activity-header">
            <span className="dash-activity-title">Activité — 6 derniers mois</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {monthlyActivity.reduce((s, m) => s + m.count, 0)} séances
            </span>
          </div>
          <ActivityChart data={monthlyActivity} />
        </div>
      )}

      {/* ── Prochains rendez-vous ── */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="card-title-icon icon-teal">📅</span>
            Prochains rendez-vous
            <span className="page-header-count" style={{ background: 'var(--teal-light)', color: 'var(--teal)', marginLeft: 6 }}>{upcoming.length}</span>
          </div>
          <div className="recent-sessions-list">
            {upcoming.map((u, idx) => {
              const rdvDate = new Date(u.next_session_date)
              const today   = new Date(); today.setHours(0,0,0,0)
              const diffDays = Math.ceil((rdvDate.getTime() - today.getTime()) / 86400000)
              const isToday  = diffDays === 0
              const isSoon   = diffDays <= 3
              return (
                <div key={u.session_id + u.next_session_date} className="recent-session-row" onClick={() => navigate(`/nouvelle/${u.patient_id}`)} style={{ animationDelay: `${idx * 30}ms`, cursor: 'pointer' }}>
                  <div className="initials" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0, background: isToday ? 'var(--teal)' : 'var(--accent)', color: '#fff' }}>
                    {getInitials(u.first_name, u.last_name)}
                  </div>
                  <div className="recent-session-info">
                    <div className="recent-session-name">{u.first_name} {u.last_name}</div>
                    <div className="recent-session-meta">
                      <span className="recent-session-date">{fmtDate(u.next_session_date)}</span>
                      {u.motif && <span className="recent-session-motif">· {u.motif.slice(0, 50)}{u.motif.length > 50 ? '…' : ''}</span>}
                    </div>
                  </div>
                  <div>
                    {isToday
                      ? <span className="badge" style={{ background: 'var(--teal)', color: '#fff' }}>Aujourd'hui !</span>
                      : isSoon
                      ? <span className="badge badge-amber">Dans {diffDays} j</span>
                      : <span className="badge badge-muted">Dans {diffDays} j</span>
                    }
                  </div>
                  <div className="recent-session-chevron">›</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Patients à revoir ── */}
      <FollowUpSection
        followUp={followUpPatients}
        onNavigate={id => navigate(`/patients`)}
      />

      {/* ── Séances récentes ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon icon-green">📋</span>
          Dernières séances
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/seances')}>Voir tout</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/nouvelle')}>＋ Nouvelle</button>
          </div>
        </div>
        {stats.recent_sessions.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon size={30} />}
            title="Aucune séance enregistrée"
            description="Commencez par créer votre première séance patient."
            action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/nouvelle')}>Créer la première séance</button>}
          />
        ) : (
          <div className="recent-sessions-list">
            {stats.recent_sessions.map((s, idx) => (
              <div key={s.id} className="recent-session-row" onClick={() => navigate(`/seances/${s.id}`)} style={{ animationDelay: `${idx * 40}ms` }}>
                <div className="initials" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>{getInitials(s.first_name, s.last_name)}</div>
                <div className="recent-session-info">
                  <div className="recent-session-name"><strong>{s.last_name.toUpperCase()}</strong> {s.first_name}</div>
                  <div className="recent-session-meta">
                    <span className="recent-session-date">{fmtDate(s.date)}</span>
                    {s.motif && <span className="recent-session-motif">· {s.motif.replace(/<[^>]+>/g, '').slice(0, 55)}{s.motif.length > 55 ? '…' : ''}</span>}
                  </div>
                </div>
                <div className="recent-session-badges">
                  {s.diagnostic_mtc && <span className="badge badge-green">{s.diagnostic_mtc.slice(0, 32)}{s.diagnostic_mtc.length > 32 ? '…' : ''}</span>}
                  {s.evolution_tags && <span className={`badge ${getEvolBadgeClass(s.evolution_tags)}`}>{s.evolution_tags}</span>}
                </div>
                <div className="recent-session-chevron">›</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Drawer RDV ── */}
      {drawerOpen && (
        <RdvDrawer
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth() + 1}
          patients={patients}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────

function StatCard({ num, label, sub, icon, iconBg, barRatio, barColor, trend, clickable, onClick }: {
  num: number
  label: string
  sub: string
  icon: React.ReactNode
  iconBg: string
  barRatio?: number
  barColor?: string
  trend?: number | null
  clickable?: boolean
  onClick?: () => void
}) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: clickable ? 'pointer' : undefined, position: 'relative' }}
    >
      {clickable && (
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, color: 'var(--text-hint)', fontWeight: 600, letterSpacing: '.04em' }}>
          voir tout →
        </div>
      )}
      <div className="stat-card-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="stat-num">{num}</div>
      <div className="stat-lbl">{label}</div>
      <div className="stat-sub">{sub}</div>
      {trend !== null && trend !== undefined && (
        <div
          className="stat-trend"
          style={{ color: trend > 0 ? 'var(--green)' : trend < 0 ? 'var(--red)' : 'var(--text-muted)' }}
        >
          {trend > 0 ? `+${trend}` : trend === 0 ? '=' : `${trend}`} vs mois dernier
        </div>
      )}
      {barRatio !== undefined && barColor && (
        <div className="stat-bar-track">
          <div className="stat-bar-fill" style={{ width: `${barRatio}%`, background: barColor }} />
        </div>
      )}
    </div>
  )
}
