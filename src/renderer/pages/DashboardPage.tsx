import React, { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardStats, UpcomingSession } from '../../shared/types'
import { ToastContext } from '../App'
import { fmtDate, getInitials, getEvolBadgeClass } from '../utils/format'
import { UsersIcon, ClipboardIcon, CalendarIcon, CheckIcon } from '../components/common/Icon'
import EmptyState from '../components/common/EmptyState'

const MONTHS_FR   = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const DAYS_FR     = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

function todayLabel() {
  const d = new Date()
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export default function DashboardPage() {
  const [stats,           setStats]           = useState<DashboardStats | null>(null)
  const [upcoming,        setUpcoming]        = useState<UpcomingSession[]>([])
  const [monthlyActivity, setMonthlyActivity] = useState<{ label: string; count: number }[]>([])
  const navigate   = useNavigate()
  const showToast  = useContext(ToastContext)

  useEffect(() => {
    window.mtcApi.getDashboardStats().then(setStats).catch(() => showToast('Erreur chargement stats', 'error'))
    window.mtcApi.getUpcomingSessions().then(setUpcoming).catch(() => {})

    // Activité sur 6 mois glissants
    const now = new Date()
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

  const monthLabel = `${MONTHS_FR[new Date().getMonth()]} ${new Date().getFullYear()}`

  // Ratio patients suivis vs total pour la barre de progression
  const followedRatio = stats.total_patients > 0
    ? Math.round((stats.active_patients / stats.total_patients) * 100)
    : 0

  // Ratio séances ce mois vs max des 6 mois (pour la barre de la stat card)
  const maxMonth = Math.max(...monthlyActivity.map(m => m.count), 1)
  const thisMonthRatio = Math.round((stats.sessions_this_month / maxMonth) * 100)

  return (
    <div className="dashboard">

      {/* ── Bienvenue ──────────────────────────────────────────────── */}
      <div className="dash-welcome">
        <div>
          <div className="dash-welcome-title">Bienvenue</div>
          <div className="dash-welcome-date">{todayLabel()}</div>
        </div>
        <div className="dash-quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/nouvelle')}>
            ＋ Nouvelle séance
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/patients')}>
            Patients
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/calendrier')}>
            Calendrier
          </button>
        </div>
      </div>

      {/* ── Statistiques ───────────────────────────────────────────── */}
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
        />
        <StatCard
          num={stats.active_patients}
          label="Patients suivis"
          sub="≥ 1 séance"
          icon={<CheckIcon size={18} />}
          iconBg="#30D158"
          barRatio={followedRatio}
          barColor="#30D158"
        />
      </div>

      {/* ── Activité — 6 derniers mois ────────────────────────────── */}
      {monthlyActivity.length > 0 && (
        <div className="dash-activity">
          <div className="dash-activity-header">
            <span className="dash-activity-title">Activité — 6 derniers mois</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {monthlyActivity.reduce((s, m) => s + m.count, 0)} séances
            </span>
          </div>
          <div className="dash-activity-bars">
            {monthlyActivity.map((m, i) => {
              const isLast = i === monthlyActivity.length - 1
              const heightPct = maxMonth > 0 ? Math.max((m.count / maxMonth) * 100, m.count > 0 ? 6 : 4) : 4
              return (
                <div key={i} className="dash-bar-col" title={`${m.count} séance${m.count > 1 ? 's' : ''}`}>
                  <div
                    className="dash-bar"
                    style={{
                      height: `${heightPct}%`,
                      background: isLast ? 'var(--accent)' : 'var(--accent-mid)',
                      opacity: isLast ? 1 : 0.45 + (i / (monthlyActivity.length - 1)) * 0.4,
                    }}
                  />
                  <span className="dash-bar-label">{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Prochains rendez-vous ──────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="card-title-icon icon-teal">📅</span>
            Prochains rendez-vous
            <span className="page-header-count" style={{ background: 'var(--teal-light)', color: 'var(--teal)', marginLeft: 6 }}>
              {upcoming.length}
            </span>
          </div>
          <div className="recent-sessions-list">
            {upcoming.map((u, idx) => {
              const rdvDate = new Date(u.next_session_date)
              const today = new Date(); today.setHours(0,0,0,0)
              const diffDays = Math.ceil((rdvDate.getTime() - today.getTime()) / 86400000)
              const isToday = diffDays === 0
              const isSoon  = diffDays <= 3
              return (
                <div
                  key={u.session_id + u.next_session_date}
                  className="recent-session-row"
                  onClick={() => navigate(`/nouvelle/${u.patient_id}`)}
                  style={{ animationDelay: `${idx * 30}ms`, cursor: 'pointer' }}
                >
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

      {/* ── Séances récentes ───────────────────────────────────────── */}
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
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/nouvelle')}>
                Créer la première séance
              </button>
            }
          />
        ) : (
          <div className="recent-sessions-list">
            {stats.recent_sessions.map((s, idx) => (
              <div
                key={s.id}
                className="recent-session-row"
                onClick={() => navigate(`/seances/${s.id}`)}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="initials" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>
                  {getInitials(s.first_name, s.last_name)}
                </div>
                <div className="recent-session-info">
                  <div className="recent-session-name">
                    <strong>{s.last_name.toUpperCase()}</strong> {s.first_name}
                  </div>
                  <div className="recent-session-meta">
                    <span className="recent-session-date">{fmtDate(s.date)}</span>
                    {s.motif && <span className="recent-session-motif">· {s.motif.replace(/<[^>]+>/g, '').slice(0, 55)}{s.motif.length > 55 ? '…' : ''}</span>}
                  </div>
                </div>
                <div className="recent-session-badges">
                  {s.diagnostic_mtc && (
                    <span className="badge badge-green">{s.diagnostic_mtc.slice(0, 32)}{s.diagnostic_mtc.length > 32 ? '…' : ''}</span>
                  )}
                  {s.evolution_tags && (
                    <span className={`badge ${getEvolBadgeClass(s.evolution_tags)}`}>{s.evolution_tags}</span>
                  )}
                </div>
                <div className="recent-session-chevron">›</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

function StatCard({ num, label, sub, icon, iconBg, barRatio, barColor }: {
  num: number
  label: string
  sub: string
  icon: React.ReactNode
  iconBg: string
  barRatio?: number
  barColor?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="stat-num">{num}</div>
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
