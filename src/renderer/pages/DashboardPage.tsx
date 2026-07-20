import React, { useEffect, useState, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardStats, UpcomingSession, Appointment, Patient, FollowUpPatient, GCalCalendar } from '../../shared/types'
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

// ── Couleur GCal personnalisée ────────────────────────────────────
function gcalCustomColor(appt: Appointment, calendars: GCalCalendar[]): string | null {
  const prefix = 'gcalExternal:'
  if (!appt.google_event_id?.startsWith(prefix)) return null
  const encodedId = appt.google_event_id.slice(prefix.length).split(':')[0]
  const cal = calendars.find(c => encodeURIComponent(c.id) === encodedId)
  return cal?.color || null
}
function mixWithWhite(hex: string, t: number): string {
  const c = hex.replace('#',''); if (!/^[0-9a-fA-F]{6}$/.test(c)) return '#E8F0F8'
  const n = parseInt(c,16), r=(n>>16)&255, g=(n>>8)&255, b=n&255
  const m=(v:number)=>Math.round(v+(255-v)*t)
  return `#${[m(r),m(g),m(b)].map(v=>v.toString(16).padStart(2,'0')).join('')}`
}
function darkenColor(hex: string, t: number): string {
  const c = hex.replace('#',''); if (!/^[0-9a-fA-F]{6}$/.test(c)) return '#1a1a2e'
  const n = parseInt(c,16), r=(n>>16)&255, g=(n>>8)&255, b=n&255
  const d=(v:number)=>Math.round(v*(1-t))
  return `#${[d(r),d(g),d(b)].map(v=>v.toString(16).padStart(2,'0')).join('')}`
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
  const [upcomingAppts,   setUpcomingAppts]   = useState<Appointment[]>([])
  const [monthlyActivity, setMonthlyActivity] = useState<{ label: string; count: number }[]>([])
  const [monthApptCount,  setMonthApptCount]  = useState(0)
  const [drawerOpen,      setDrawerOpen]      = useState(false)
  const [todayAppts,      setTodayAppts]      = useState<Appointment[]>([])
  const [patients,        setPatients]        = useState<Patient[]>([])
  const [followUpPatients,setFollowUpPatients]= useState<FollowUpPatient[]>([])
  const [pendingReminders,setPendingReminders]= useState<import('../../shared/types').PendingReminder[]>([])
  const [overdueInvoices, setOverdueInvoices] = useState<import('../../shared/types').InvoiceLog[]>([])
  const [gcalCalendars,   setGcalCalendars]   = useState<GCalCalendar[]>([])
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [backupWarning,   setBackupWarning]   = useState<'none' | 'old' | 'never'>('none')
  const [backupDismissed, setBackupDismissed] = useState(false)
  const navigate  = useNavigate()
  const showToast = useContext(ToastContext)

  const now      = new Date()
  const todayStr = toDateStr(now)

  useEffect(() => {
    window.mtcApi.getDashboardStats().then(setStats).catch(() => showToast('Erreur chargement stats', 'error'))
    window.mtcApi.getUpcomingSessions().then(setUpcoming).catch(() => {})
    window.mtcApi.getPatients().then(setPatients).catch(() => {})
    window.mtcApi.getAppointmentsByDate(todayStr).then(setTodayAppts).catch(() => {})

    // Prochains RDV depuis la table appointments — uniquement ceux de Synoria
    // (les RDV importés de Google Calendar ont google_event_id commençant par 'gcalExternal:')
    window.mtcApi.getAppointments().then(all => {
      const future = all
        .filter(a =>
          !a.is_done &&
          !a.is_cancelled &&
          a.date >= todayStr &&
          !a.google_event_id?.startsWith('gcalExternal:')
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut))
        .slice(0, 15)
      setUpcomingAppts(future)
    }).catch(() => {})
    window.mtcApi.getPatientsToFollowUp(90).then(setFollowUpPatients).catch(() => {})
    window.mtcApi.getPendingReminders().then(setPendingReminders).catch(() => {})
    window.mtcApi.gcalStatus().then(g => setGcalCalendars(g.importCalendars ?? [])).catch(() => {})
    window.mtcApi.getSettings().then(s => {
      window.mtcApi.getOverdueInvoices(s.invoiceOverdueDays ?? 30).then(setOverdueInvoices).catch(() => {})

      // Vérifier date dernière sauvegarde
      const dismissKey = 'synoria-backup-warn-dismissed'
      const dismissedAt = localStorage.getItem(dismissKey)
      const dismissExpired = !dismissedAt || (Date.now() - +dismissedAt) > 86400000 // 24h
      if (dismissExpired) {
        const last = s.lastGeneralBackup || s.lastAutoBackup
        if (!last) {
          setBackupWarning('never')
        } else {
          const daysSince = (Date.now() - new Date(last).getTime()) / 86400000
          if (daysSince > 7) setBackupWarning('old')
        }
      }
    }).catch(() => window.mtcApi.getOverdueInvoices(30).then(setOverdueInvoices).catch(() => {}))

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

      {/* ── Alerte sauvegarde ── */}
      {backupWarning !== 'none' && !backupDismissed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px',
          background: backupWarning === 'never' ? '#FEF3F2' : '#FFFBEB',
          border: `1.5px solid ${backupWarning === 'never' ? '#FECACA' : '#FDE68A'}`,
          borderRadius: 10, marginBottom: 16,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{backupWarning === 'never' ? '🚨' : '⚠️'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: backupWarning === 'never' ? '#991B1B' : '#92400E' }}>
              {backupWarning === 'never' ? 'Aucune sauvegarde configurée' : 'Sauvegarde ancienne de plus de 7 jours'}
            </div>
            <div style={{ fontSize: 12, color: backupWarning === 'never' ? '#B91C1C' : '#B45309', marginTop: 2 }}>
              {backupWarning === 'never'
                ? 'En cas de panne ou perte de l\'ordinateur, toutes vos données patients seront perdues.'
                : 'Pensez à sauvegarder régulièrement pour éviter toute perte de données.'}
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: backupWarning === 'never' ? '#DC2626' : '#F59E0B', color: '#fff', border: 'none', flexShrink: 0 }}
            onClick={() => navigate('/parametres', { state: { tab: 'backup' } })}
          >
            Configurer les sauvegardes →
          </button>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 18, flexShrink: 0, lineHeight: 1, padding: '2px 4px' }}
            title="Ignorer pour 24h"
            onClick={() => {
              localStorage.setItem('synoria-backup-warn-dismissed', String(Date.now()))
              setBackupDismissed(true)
            }}
          >×</button>
        </div>
      )}

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

      {/* ── Prochains rendez-vous (source : table appointments = calendrier) ── */}
      {upcomingAppts.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="card-title-icon icon-teal">📅</span>
            Prochains rendez-vous
            <span className="page-header-count" style={{ background: 'var(--teal-light)', color: 'var(--teal)', marginLeft: 6 }}>{upcomingAppts.length}</span>
          </div>
          <div className="recent-sessions-list">
            {upcomingAppts.map((appt, idx) => {
              const pat = patients.find(p => p.id === appt.patient_id)
              const guestName = [appt.guest_first_name, appt.guest_last_name].filter(Boolean).join(' ')
              const name = pat
                ? `${pat.first_name} ${pat.last_name}`
                : guestName || appt.note?.slice(0, 30) || 'Consultation'
              const initials = pat
                ? getInitials(pat.first_name, pat.last_name)
                : guestName
                  ? ((appt.guest_first_name?.[0] || '') + (appt.guest_last_name?.[0] || '')).toUpperCase()
                  : 'RDV'
              const [ry, rm, rd] = appt.date.split('-').map(Number)
              const apptDate = new Date(ry, rm - 1, rd)
              const tod      = new Date(); tod.setHours(0, 0, 0, 0)
              const diffDays = Math.round((apptDate.getTime() - tod.getTime()) / 86400000)
              const isToday  = diffDays === 0
              const isSoon   = diffDays <= 3
              // Couleurs : couleur GCal personnalisée si disponible, sinon STATUS_CONFIG
              const status    = getApptStatus(appt, todayStr)
              const gcalColor = gcalCustomColor(appt, gcalCalendars)
              const cfg = gcalColor
                ? { bg: mixWithWhite(gcalColor, .88), border: gcalColor, dot: gcalColor, label: STATUS_CONFIG[status].label, labelColor: darkenColor(gcalColor, .52) }
                : STATUS_CONFIG[status]
              return (
                <div key={appt.id} className="recent-session-row"
                  style={{ animationDelay: `${idx * 30}ms`, cursor: 'default', alignItems: 'center', borderLeft: `3px solid ${cfg.border}`, paddingLeft: 8 }}>

                  {/* Initiales — couleur du statut calendrier */}
                  <div className="initials" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0, background: cfg.dot, color: '#fff' }}>
                    {initials}
                  </div>

                  {/* Nom + date + motif */}
                  <div className="recent-session-info">
                    <div className="recent-session-name">{name}</div>
                    <div className="recent-session-meta">
                      <span className="recent-session-date">
                        {fmtDate(appt.date)}{appt.heure_debut ? ` · ${appt.heure_debut}` : ''}{appt.heure_fin ? `–${appt.heure_fin}` : ''}
                      </span>
                      {appt.note && <span className="recent-session-motif">· {appt.note.slice(0, 40)}{appt.note.length > 40 ? '…' : ''}</span>}
                    </div>
                  </div>

                  {/* Badge délai + statut — couleurs calendrier */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    <span className="badge" style={{ background: cfg.bg, color: cfg.labelColor, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                    {isToday
                      ? <span className="badge" style={{ background: cfg.dot, color: '#fff' }}>Aujourd'hui !</span>
                      : diffDays > 0
                        ? <span className="badge badge-muted">J{diffDays > 0 ? `+${diffDays}` : diffDays}</span>
                        : null
                    }
                  </div>

                  {/* 3 boutons d'action */}
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>

                    {/* 1. Nouvelle séance — toujours visible */}
                    <button
                      className="btn btn-secondary btn-sm"
                      title={pat ? `Nouvelle séance — ${name}` : 'Nouvelle séance (sélectionner le patient dans le formulaire)'}
                      onClick={e => {
                        e.stopPropagation()
                        const params = new URLSearchParams()
                        params.set('date', appt.date)
                        params.set('apptId', appt.id)
                        if (appt.note) params.set('motif', appt.note)
                        if (pat) {
                          navigate(`/nouvelle/${pat.id}?${params.toString()}`)
                        } else {
                          navigate(`/nouvelle?${params.toString()}`)
                        }
                      }}
                      style={{ padding: '4px 8px', color: cfg.dot, borderColor: cfg.border }}
                    >
                      ＋ Séance
                    </button>

                    {/* 2. Ouvrir le calendrier sur la date du RDV */}
                    <button
                      className="btn btn-secondary btn-sm"
                      title="Voir ce RDV dans le calendrier"
                      onClick={e => { e.stopPropagation(); navigate('/calendrier', { state: { focusDate: appt.date } }) }}
                      style={{ padding: '4px 8px', color: cfg.dot, borderColor: cfg.border }}
                    >
                      📅 Calendrier
                    </button>

                    {/* 3. Historique séances + RDV du patient */}
                    {pat && (
                      <button
                        className="btn btn-secondary btn-sm"
                        title={`Historique de ${name}`}
                        onClick={e => { e.stopPropagation(); navigate('/seances', { state: { patientId: pat.id } }) }}
                        style={{ padding: '4px 8px', color: 'var(--purple)', borderColor: 'var(--purple-mid)' }}
                      >
                        👤 Patient
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Rappels email J-1 ── */}
      {pendingReminders.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--blue)' }}>
          <div className="card-title">
            <span className="card-title-icon icon-blue">✉️</span>
            Rappels à envoyer — RDV demain
            <span className="page-header-count" style={{ background: 'var(--blue-light)', color: 'var(--blue)', marginLeft: 6 }}>
              {pendingReminders.length}
            </span>
          </div>
          <div className="recent-sessions-list">
            {pendingReminders.map((r, idx) => (
              <div key={r.appointment_id} className="recent-session-row" style={{ animationDelay: `${idx * 30}ms` }}>
                <div className="initials" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0, background: 'var(--blue)', color: '#fff' }}>
                  {r.patient_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="recent-session-info">
                  <div className="recent-session-name">{r.patient_name}</div>
                  <div className="recent-session-meta">
                    <span className="recent-session-date">{fmtDate(r.appt_date)} · {r.appt_heure}</span>
                    {r.appt_note && <span className="recent-session-motif">· {r.appt_note.slice(0, 40)}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--blue)', flexShrink: 0 }}>{r.patient_email}</div>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={sendingReminder === r.appointment_id}
                  style={{ color: 'var(--blue)', borderColor: 'var(--blue-mid)', flexShrink: 0 }}
                  onClick={async () => {
                    setSendingReminder(r.appointment_id)
                    try {
                      await window.mtcApi.sendAppointmentReminder(r.appointment_id)
                      await window.mtcApi.markReminderSent(r.appointment_id)
                      setPendingReminders(prev => prev.filter(x => x.appointment_id !== r.appointment_id))
                      showToast(`Rappel envoyé à ${r.patient_name} ✓`)
                    } catch (e: any) {
                      showToast(`Erreur : ${e?.message || e}`, 'error')
                    }
                    setSendingReminder(null)
                  }}
                >
                  {sendingReminder === r.appointment_id ? '⏳…' : '✉ Envoyer rappel'}
                </button>
              </div>
            ))}
          </div>
          {pendingReminders.length > 1 && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-soft)', marginTop: 4 }}>
              <button className="btn btn-primary btn-sm"
                style={{ background: 'var(--blue)', borderColor: 'var(--blue)' }}
                onClick={async () => {
                  for (const r of pendingReminders) {
                    try {
                      await window.mtcApi.sendAppointmentReminder(r.appointment_id)
                      await window.mtcApi.markReminderSent(r.appointment_id)
                    } catch { /* continue */ }
                  }
                  setPendingReminders([])
                  showToast(`${pendingReminders.length} rappels envoyés ✓`)
                }}>
                ✉ Envoyer tous les rappels ({pendingReminders.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Alertes factures en retard ── */}
      {overdueInvoices.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="card-title">
            <span className="card-title-icon icon-amber">⚠️</span>
            Factures non payées — plus de 30 jours
            <span className="page-header-count" style={{ background: 'var(--amber-light)', color: 'var(--amber)', marginLeft: 6 }}>
              {overdueInvoices.length}
            </span>
          </div>
          <div className="recent-sessions-list">
            {overdueInvoices.slice(0, 5).map((inv, idx) => {
              const daysOld = Math.round((Date.now() - new Date(inv.invoice_date).getTime()) / 86400000)
              return (
                <div key={inv.id} className="recent-session-row" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {inv.patient_first_name} {inv.patient_last_name.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      N° {inv.invoice_number} · {fmtDate(inv.invoice_date)}
                      {inv.description ? ` · ${inv.description.slice(0, 30)}` : ''}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {inv.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </span>
                  <span className="badge" style={{ background: daysOld > 60 ? 'var(--red)' : 'var(--amber)', color: '#fff', flexShrink: 0 }}>
                    {daysOld} j
                  </span>
                  <button className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--accent)', borderColor: 'var(--accent-mid)', flexShrink: 0 }}
                    onClick={async () => {
                      await window.mtcApi.markInvoicePaid(inv.id, true)
                      setOverdueInvoices(prev => prev.filter(x => x.id !== inv.id))
                      showToast('Facture marquée comme payée ✓')
                    }}>
                    ✓ Marquer payée
                  </button>
                  <button className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={() => navigate('/factures-liste')}>
                    Voir →
                  </button>
                </div>
              )
            })}
          </div>
          {overdueInvoices.length > 5 && (
            <div style={{ paddingTop: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              + {overdueInvoices.length - 5} autre{overdueInvoices.length - 5 > 1 ? 's' : ''} ·
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate('/factures-liste')}>Tout voir</button>
            </div>
          )}
        </div>
      )}

      {/* ── Patients à revoir ── */}
      <FollowUpSection
        followUp={followUpPatients}
        onNavigate={id => navigate('/seances', { state: { patientId: id } })}
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
      style={{
        cursor: clickable ? 'pointer' : undefined,
        position: 'relative',
        borderTop: `3px solid ${iconBg}`,
        background: `linear-gradient(145deg, var(--surface) 60%, ${iconBg}08 100%)`,
      }}
    >
      {clickable && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, color: 'var(--text-hint)', fontWeight: 600, letterSpacing: '.04em' }}>
          voir tout →
        </div>
      )}

      {/* Icône + tendance sur la même ligne */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="stat-card-icon" style={{ background: iconBg }}>{icon}</div>
        {trend !== null && trend !== undefined && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.02em',
            color: trend > 0 ? '#10B981' : trend < 0 ? 'var(--red)' : 'var(--text-muted)',
            background: trend > 0 ? '#ECFDF5' : trend < 0 ? 'var(--red-light)' : 'var(--border-soft)',
            borderRadius: 20, padding: '2px 7px',
          }}>
            {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '→ ='}
          </div>
        )}
      </div>

      <div className="stat-num" style={{ color: iconBg }}>{num}</div>
      <div className="stat-lbl">{label}</div>
      <div className="stat-sub">{sub}</div>

      {barRatio !== undefined && barColor && (
        <div className="stat-bar-track">
          <div className="stat-bar-fill" style={{ width: `${barRatio}%`, background: barColor }} />
        </div>
      )}
    </div>
  )
}
