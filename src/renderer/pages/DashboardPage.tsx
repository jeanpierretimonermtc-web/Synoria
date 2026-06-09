import React, { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardStats, UpcomingSession } from '../../shared/types'
import { ToastContext } from '../App'
import { fmtDate, getInitials, getEvolBadgeClass } from '../utils/format'

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

function todayLabel() {
  const d = new Date()
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([])
  const navigate = useNavigate()
  const showToast = useContext(ToastContext)

  useEffect(() => {
    window.mtcApi.getDashboardStats().then(setStats).catch(() => showToast('Erreur chargement stats', 'error'))
    window.mtcApi.getUpcomingSessions().then(setUpcoming).catch(() => {})
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

  return (
    <div className="dashboard">

      {/* ── Bienvenue ─────────────────────────────────────────── */}
      <div className="dash-welcome">
        <div>
          <div className="dash-welcome-title">Bienvenue</div>
          <div className="dash-welcome-date">{todayLabel()}</div>
        </div>
        <div className="dash-quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/nouvelle')}>
            <span>＋</span> Nouvelle séance
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/patients')}>
            👤 Patients
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/calendrier')}>
            📅 Calendrier
          </button>
        </div>
      </div>

      {/* ── Statistiques ──────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard
          num={stats.total_patients}
          label="Patients total"
          icon="👤"
          color="var(--accent)"
          bg="var(--accent-light)"
          sub="dans la base"
        />
        <StatCard
          num={stats.total_sessions}
          label="Séances totales"
          icon="📋"
          color="var(--blue)"
          bg="var(--blue-light)"
          sub="depuis le début"
        />
        <StatCard
          num={stats.sessions_this_month}
          label="Séances ce mois"
          icon="📅"
          color="var(--purple)"
          bg="var(--purple-light)"
          sub={monthLabel}
        />
        <StatCard
          num={stats.active_patients}
          label="Patients suivis"
          icon="✅"
          color="var(--teal)"
          bg="var(--teal-light)"
          sub="avec au moins 1 séance"
        />
      </div>

      {/* ── Prochains rendez-vous ─────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="card-title-icon icon-teal">📅</span>
            Prochains rendez-vous
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
              ({upcoming.length})
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
                  <div className="recent-session-avatar">
                    <div className="initials" style={{ width: 38, height: 38, fontSize: 13, background: isToday ? 'var(--teal)' : 'var(--accent)' }}>
                      {getInitials(u.first_name, u.last_name)}
                    </div>
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
                      ? <span className="badge badge-teal" style={{ background: 'var(--teal)', color: '#fff' }}>Aujourd'hui !</span>
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

      {/* ── Séances récentes ──────────────────────────────────── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon icon-green">📋</span>
          Dernières séances
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/seances')}>Voir tout</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/nouvelle')}>
              ＋ Nouvelle
            </button>
          </div>
        </div>

        {stats.recent_sessions.length === 0 ? (
          <div className="empty" style={{ padding: '2rem 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
            <div>Aucune séance enregistrée</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/nouvelle')}>
              Créer la première séance
            </button>
          </div>
        ) : (
          <div className="recent-sessions-list">
            {stats.recent_sessions.map((s, idx) => (
              <div
                key={s.id}
                className="recent-session-row"
                onClick={() => navigate(`/seances/${s.id}`)}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="recent-session-avatar">
                  <div className="initials" style={{ width: 38, height: 38, fontSize: 13 }}>
                    {getInitials(s.first_name, s.last_name)}
                  </div>
                </div>
                <div className="recent-session-info">
                  <div className="recent-session-name">
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="recent-session-meta">
                    <span className="recent-session-date">{fmtDate(s.date)}</span>
                    {s.motif && <span className="recent-session-motif">· {s.motif.slice(0, 55)}{s.motif.length > 55 ? '…' : ''}</span>}
                  </div>
                </div>
                <div className="recent-session-badges">
                  {s.diagnostic_mtc && (
                    <span className="badge badge-green">{s.diagnostic_mtc.slice(0, 35)}{s.diagnostic_mtc.length > 35 ? '…' : ''}</span>
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

function StatCard({ num, label, icon, color, bg, sub }: {
  num: number; label: string; icon: string; color: string; bg: string; sub: string
}) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-card-icon" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="stat-num" style={{ color }}>{num}</div>
      <div className="stat-lbl">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}
