import React, { useEffect, useState, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session, Patient, Appointment } from '../../shared/types'
import { ToastContext } from '../App'
import { fmtDate, getInitials } from '../utils/format'

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_NAMES   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

// Créneaux de 30 min de 08:00 à 19:30 (vue jour)
const TIME_SLOTS: string[] = []
for (let h = 8; h < 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
}

// Créneaux précis toutes les 5 min de 07:00 à 20:00 (sélecteurs de la modal)
const FINE_TIMES: string[] = []
for (let h = 7; h <= 20; h++) {
  for (let m = 0; m < 60; m += 5) {
    if (h === 20 && m > 0) break
    FINE_TIMES.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// RDV couleur selon statut
function apptColor(appt: Appointment, today: string): { bg: string; border: string; text: string } {
  if (appt.is_done) return { bg: '#EAF0E8', border: '#4A6741', text: '#2F5D34' }
  if (appt.date < today) return { bg: '#FDF3E3', border: '#C17B2A', text: '#9A5B12' }
  return { bg: '#E8F0F8', border: '#2A5A8A', text: '#1A3A6B' }
}

/* ─── MODAL RDV ────────────────────────────────────────────────────────── */
interface ApptModalProps {
  date: string
  slotTime?: string
  appointment?: Appointment
  patients: Patient[]
  onSave: (data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => void
  onDelete?: () => void
  onClose: () => void
  onPatientCreated?: () => void
}

function ApptModal({ date, slotTime, appointment, patients, onSave, onDelete, onClose, onPatientCreated }: ApptModalProps) {
  // Détermine si le RDV existant était un invité
  const wasGuest = !!appointment && !appointment.patient_id

  const [localDate,       setLocalDate]       = useState(appointment?.date || date)
  const [patientId,       setPatientId]       = useState(appointment?.patient_id   || '')
  const [heureD,          setHeureD]          = useState(appointment?.heure_debut  || slotTime || '09:00')
  const [heureF,          setHeureF]          = useState(appointment?.heure_fin    || '')
  const [note,            setNote]            = useState(appointment?.note          || '')
  const [isDone,          setIsDone]          = useState(appointment?.is_done === 1)
  const [guestLastName,   setGuestLastName]   = useState(appointment?.guest_last_name  || '')
  const [guestFirstName,  setGuestFirstName]  = useState(appointment?.guest_first_name || '')
  const [guestPhone,      setGuestPhone]      = useState(appointment?.guest_phone       || '')
  const [creating,        setCreating]        = useState(false)
  const navigate = useNavigate()

  // Quand un patient existant est sélectionné, vider les champs invité
  const handlePatientChange = (id: string) => {
    setPatientId(id)
    if (id) { setGuestLastName(''); setGuestFirstName(''); setGuestPhone('') }
  }

  const handleSave = () => {
    if (!localDate || !heureD) return
    const hasGuest = !patientId && (guestLastName || guestFirstName)
    onSave({
      patient_id:       patientId || undefined,
      date:             localDate,
      heure_debut:      heureD,
      heure_fin:        heureF || undefined,
      note:             note   || undefined,
      is_done:          isDone ? 1 : 0,
      guest_last_name:  hasGuest ? (guestLastName  || undefined) : undefined,
      guest_first_name: hasGuest ? (guestFirstName || undefined) : undefined,
      guest_phone:      hasGuest ? (guestPhone     || undefined) : undefined,
    })
  }

  const handleConvert = () => {
    if (!patientId) return
    const params = new URLSearchParams()
    if (note) params.set('motif', note)
    params.set('date', localDate)
    onClose()
    navigate(`/nouvelle/${patientId}?${params.toString()}`)
  }

  // Crée une fiche patient depuis les infos invité et lie le RDV
  const handleCreatePatient = async () => {
    if (!guestLastName && !guestFirstName) return
    if (!confirm(`Créer une fiche patient pour ${guestFirstName} ${guestLastName} ?`)) return
    setCreating(true)
    try {
      const now = new Date().toISOString().slice(0, 10)
      const newPatient = await window.mtcApi.createPatient({
        first_name: guestFirstName || '—',
        last_name:  guestLastName  || '—',
        phone:      guestPhone     || undefined,
        birth_date: undefined, email: undefined, address: undefined,
        notes_general: undefined, alerts: undefined,
        regular_doctor: undefined, medications: undefined,
        antecedents: undefined, profession: undefined,
        created_at: now, updated_at: now, is_active: 1,
      } as any)
      // Met à jour le RDV pour lier le patient et effacer les champs invité
      if (appointment) {
        await window.mtcApi.updateAppointment(appointment.id, {
          patient_id: newPatient.id,
          guest_last_name: undefined, guest_first_name: undefined, guest_phone: undefined,
        })
      }
      onPatientCreated?.()
      onClose()
    } catch (e: any) {
      alert(`Erreur : ${e?.message || e}`)
    }
    setCreating(false)
  }

  const timeOptions  = FINE_TIMES
  const hasGuestInfo = !patientId && (guestLastName || guestFirstName)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span>📅</span>
          <span>{appointment ? 'Modifier le RDV' : 'Nouveau rendez-vous'}</span>
        </h2>

        {/* Date — saisie manuelle possible */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>Date du rendez-vous *</label>
          <input
            type="date"
            value={localDate}
            onChange={e => setLocalDate(e.target.value)}
            style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}
            required
          />
        </div>

        {/* ── Patient existant ── */}
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Patient existant</label>
          <select value={patientId} onChange={e => handlePatientChange(e.target.value)}>
            <option value="">— Nouveau patient / sans fiche —</option>
            {patients.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(p => (
              <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>
            ))}
          </select>
        </div>

        {/* ── Champs nouveau patient (si pas de patient sélectionné) ── */}
        {!patientId && (
          <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
              Contact (nouveau patient)
            </div>
            <div className="grid2" style={{ marginBottom: 8 }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Nom</label>
                <input
                  type="text"
                  value={guestLastName}
                  onChange={e => setGuestLastName(e.target.value)}
                  placeholder="DUPONT"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Prénom</label>
                <input
                  type="text"
                  value={guestFirstName}
                  onChange={e => setGuestFirstName(e.target.value)}
                  placeholder="Jean"
                />
              </div>
            </div>
            <div className="grid2" style={{ marginBottom: 0 }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Téléphone</label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="06 00 00 00 00"
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Motif de venue</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Douleurs, bilan, stress…"
                />
              </div>
            </div>
            {hasGuestInfo && (
              <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 8 }}>
                ✓ Le nom et le motif s'afficheront sur le planning
              </div>
            )}
          </div>
        )}

        {/* ── Horaires ── */}
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Heure début *</label>
            <select value={heureD} onChange={e => setHeureD(e.target.value)}>
              {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Heure fin</label>
            <select value={heureF} onChange={e => setHeureF(e.target.value)}>
              <option value="">—</option>
              {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* ── Note / Motif (patients connus uniquement) ── */}
        {patientId && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Motif de visite / Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Motif de la consultation, demande du patient…"
              style={{ minHeight: 60, resize: 'vertical' }}
            />
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDone} onChange={e => setIsDone(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
          <span>Marquer comme réalisé</span>
        </label>

        <div className="row-btns" style={{ marginTop: 4, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            {appointment ? '💾 Mettre à jour' : '+ Créer le RDV'}
          </button>
          {patientId && !appointment?.is_done && (
            <button className="btn btn-secondary" onClick={handleConvert} title="Ouvre le formulaire de séance avec le motif pré-rempli">
              📋 Créer la séance
            </button>
          )}
          {/* Convertir invité en fiche patient */}
          {hasGuestInfo && appointment && (
            <button
              className="btn btn-secondary"
              style={{ color: 'var(--teal)', borderColor: 'var(--teal)' }}
              onClick={handleCreatePatient}
              disabled={creating}
              title="Crée une fiche patient et lie ce RDV"
            >
              {creating ? '⏳…' : '👤 Créer la fiche patient'}
            </button>
          )}
          {appointment && onDelete && (
            <button className="btn btn-secondary" style={{ color: 'var(--red)' }} onClick={onDelete}>
              Supprimer
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

/* ─── PAGE PRINCIPALE ──────────────────────────────────────────────────── */
export default function CalendarPage() {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`

  const [year,        setYear]        = useState(today.getFullYear())
  const [month,       setMonth]       = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string>(todayStr)
  const [sessions,    setSessions]    = useState<Session[]>([])
  const [appointments,setAppointments]= useState<Appointment[]>([])
  const [patients,    setPatients]    = useState<Patient[]>([])

  // Modal
  const [modalOpen,   setModalOpen]   = useState(false)
  const [modalAppt,   setModalAppt]   = useState<Appointment | undefined>()
  const [modalSlot,   setModalSlot]   = useState<string | undefined>()

  const showToast = useContext(ToastContext)
  const navigate  = useNavigate()

  const load = useCallback(async () => {
    try {
      const [s, p, a] = await Promise.all([
        window.mtcApi.getSessions(),
        window.mtcApi.getPatients(),
        window.mtcApi.getAppointments(),
      ])
      setSessions(s)
      setPatients(p)
      setAppointments(a)
    } catch { showToast('Erreur chargement', 'error') }
  }, [showToast])

  useEffect(() => { load() }, [load])

  /* ── Calendrier mensuel ── */
  const firstDay  = new Date(year, month, 1)
  const lastDay   = new Date(year, month + 1, 0)
  const daysCount = lastDay.getDate()
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysCount; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const sessionsByDate: Record<string, Session[]> = {}
  sessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = []
    sessionsByDate[s.date].push(s)
  })

  const apptByDate: Record<string, Appointment[]> = {}
  appointments.forEach(a => {
    if (!apptByDate[a.date]) apptByDate[a.date] = []
    apptByDate[a.date].push(a)
  })

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  /* ── Données du jour sélectionné ── */
  const daySessions    = selectedDay ? (sessionsByDate[selectedDay] || []) : []
  const dayAppointments= selectedDay ? (apptByDate[selectedDay]    || []) : []

  const getPatient = (id?: string) => id ? patients.find(p => p.id === id) : undefined

  // Nom à afficher sur le planning pour un RDV
  const getApptLabel = (appt: Appointment): string => {
    const pat = getPatient(appt.patient_id)
    if (pat) return `${pat.first_name} ${pat.last_name}`
    const gn = [appt.guest_first_name, appt.guest_last_name].filter(Boolean).join(' ')
    return gn || '— Sans patient'
  }
  const getApptInitials = (appt: Appointment): string => {
    const pat = getPatient(appt.patient_id)
    if (pat) return getInitials(pat.first_name, pat.last_name)
    if (appt.guest_first_name || appt.guest_last_name)
      return getInitials(appt.guest_first_name || '', appt.guest_last_name || '')
    return '?'
  }

  /* ── Stats du mois ── */
  const monthStr  = `${year}-${pad(month + 1)}`
  const monthSess = sessions.filter(s => s.date.startsWith(monthStr))
  const monthAppt = appointments.filter(a => a.date.startsWith(monthStr))

  /* ── Handlers RDV ── */
  const openNewAppt = (slot?: string) => {
    setModalAppt(undefined)
    setModalSlot(slot)
    // Si aucun jour sélectionné → on passe quand même : la modal utilisera sa propre date state
    setModalOpen(true)
  }
  const openEditAppt = (appt: Appointment) => {
    setModalAppt(appt)
    setModalSlot(undefined)
    setModalOpen(true)
  }

  const handleSaveAppt = async (data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modalAppt) {
        await window.mtcApi.updateAppointment(modalAppt.id, data)
        showToast('RDV mis à jour ✓')
      } else {
        await window.mtcApi.createAppointment(data)
        showToast('RDV créé ✓')
      }
      setModalOpen(false)
      load()
    } catch { showToast('Erreur enregistrement RDV', 'error') }
  }

  const handleDeleteAppt = async () => {
    if (!modalAppt) return
    if (!confirm('Supprimer ce rendez-vous ?')) return
    try {
      await window.mtcApi.deleteAppointment(modalAppt.id)
      showToast('RDV supprimé')
      setModalOpen(false)
      load()
    } catch { showToast('Erreur suppression RDV', 'error') }
  }

  return (
    <div>
      {/* ── En-tête : navigation mois + bouton nouveau RDV ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>← Préc.</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--accent)' }}>
            {MONTH_NAMES[month]} {year}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {monthSess.length} séance{monthSess.length !== 1 ? 's' : ''} · {monthAppt.length} RDV
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openNewAppt()}
            title="Créer un nouveau rendez-vous (date libre)"
          >
            + Nouveau RDV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>Suiv. →</button>
        </div>
      </div>

      {/* ── Sélecteurs rapides ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: '0.75rem' }}>
        <select value={year} onChange={e => setYear(+e.target.value)} style={{ width: 90 }}>
          {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 5 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={month} onChange={e => setMonth(+e.target.value)} style={{ width: 130 }}>
          {MONTH_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm"
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(todayStr) }}>
          Aujourd'hui
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── CALENDRIER MENSUEL (gauche) ── */}
        <div className="card" style={{ padding: '10px' }}>
          {/* Légende */}
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> Séance réalisée
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block' }} /> RDV planifié
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} /> RDV en attente
            </span>
          </div>

          {/* Jours de la semaine */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Cellules */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} />
              const ds    = dateStr(year, month, day)
              const sess  = sessionsByDate[ds] || []
              const appts = apptByDate[ds] || []
              const isToday    = ds === todayStr
              const isSelected = ds === selectedDay
              const hasDots    = sess.length > 0 || appts.length > 0

              return (
                <div
                  key={ds}
                  onClick={() => setSelectedDay(isSelected ? '' : ds)}
                  style={{
                    borderRadius: 6,
                    padding: '4px 2px',
                    minHeight: 44,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent)' : isToday ? 'var(--accent-light)' : hasDots ? 'var(--surface-hover)' : 'transparent',
                    border: isToday && !isSelected ? '2px solid var(--accent)' : isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'all .12s',
                  }}
                >
                  <div style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: isToday || isSelected ? 700 : 400,
                    color: isSelected ? 'white' : isToday ? 'var(--accent)' : 'var(--text)',
                    marginBottom: 2,
                  }}>
                    {day}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
                    {sess.slice(0, 2).map((_, i) => (
                      <div key={`s${i}`} style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--accent)' }} />
                    ))}
                    {appts.filter(a => a.is_done).slice(0, 1).map((_, i) => (
                      <div key={`ad${i}`} style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--accent)' }} />
                    ))}
                    {appts.filter(a => !a.is_done && a.date >= todayStr).slice(0, 2).map((_, i) => (
                      <div key={`ap${i}`} style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--blue)' }} />
                    ))}
                    {appts.filter(a => !a.is_done && a.date < todayStr).slice(0, 1).map((_, i) => (
                      <div key={`am${i}`} style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--amber)' }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── VUE JOUR avec créneaux horaires (droite) ── */}
        <div>
          {selectedDay ? (
            <div>
              {/* En-tête du jour */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
                  {fmtDate(selectedDay)}
                </h3>
                <button className="btn btn-primary btn-sm" onClick={() => openNewAppt()}>
                  + Nouveau RDV
                </button>
              </div>

              {/* Séances réalisées du jour (sans horaire fixe) */}
              {daySessions.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                    Séances réalisées
                  </div>
                  {daySessions.map(sess => {
                    const pat = getPatient(sess.patient_id)
                    return (
                      <div key={sess.id}
                        onClick={() => navigate(`/seances/${sess.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                          background: '#EAF0E8', border: '1px solid #4A6741',
                          cursor: 'pointer', transition: 'opacity .15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        <div className="initials" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0, background: 'var(--accent)', color: 'white' }}>
                          {pat ? getInitials(pat.first_name, pat.last_name) : '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#2F5D34' }}>
                            {pat ? `${pat.first_name} ${pat.last_name}` : '—'}
                          </div>
                          {sess.motif && (
                            <div style={{ fontSize: 11, color: '#4A7A54', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sess.motif.replace(/<[^>]+>/g, '')}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>Voir →</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Créneaux horaires */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Planning du jour
              </div>
              <div className="time-grid">
                {TIME_SLOTS.map((slot, slotIdx) => {
                  const nextSlot = TIME_SLOTS[slotIdx + 1] ?? '20:00'
                  // RDV qui démarre dans ce créneau de 30 min (ex: 09:00-09:29)
                  const startAppts = dayAppointments.filter(a =>
                    a.heure_debut >= slot && a.heure_debut < nextSlot
                  )
                  // RDV en cours qui enjambe ce créneau
                  const continuedAppts = dayAppointments.filter(a =>
                    a.heure_debut < slot && a.heure_fin && a.heure_fin > slot
                  )
                  const isEmpty = startAppts.length === 0 && continuedAppts.length === 0

                  return (
                    <div key={slot} className="time-slot">
                      <div className="time-slot-label">{slot}</div>
                      <div className="time-slot-content">
                        {isEmpty && (
                          <div
                            className="time-slot-empty"
                            onClick={() => openNewAppt(slot)}
                            title="Cliquer pour créer un RDV"
                          >
                            <span className="time-slot-plus">+</span>
                          </div>
                        )}
                        {startAppts.map(appt => {
                          const cols  = apptColor(appt, todayStr)
                          const label = appt.is_done ? 'Réalisé' : appt.date < todayStr ? 'En attente' : 'Planifié'
                          const name  = getApptLabel(appt)
                          const isGuest = !appt.patient_id && (appt.guest_first_name || appt.guest_last_name)
                          return (
                            <div
                              key={appt.id}
                              className="rdv-block"
                              style={{ background: cols.bg, border: `1.5px solid ${cols.border}` }}
                              onClick={() => openEditAppt(appt)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="initials" style={{ width: 22, height: 22, fontSize: 9, flexShrink: 0, background: cols.border, color: 'white' }}>
                                  {getApptInitials(appt)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 11, color: cols.text }}>
                                    {name}
                                    {isGuest && <span style={{ fontSize: 9, marginLeft: 4, opacity: .75 }}>· nouveau</span>}
                                    {appt.heure_fin && <span style={{ fontWeight: 400, marginLeft: 4 }}>({appt.heure_debut}–{appt.heure_fin})</span>}
                                  </div>
                                  {appt.guest_phone && !appt.patient_id && (
                                    <div style={{ fontSize: 10, color: cols.text, opacity: .75 }}>☎ {appt.guest_phone}</div>
                                  )}
                                  {appt.note && (
                                    <div style={{ fontSize: 10, color: cols.text, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {appt.note}
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontSize: 9, color: cols.border, fontWeight: 700, flexShrink: 0 }}>{label}</span>
                              </div>
                            </div>
                          )
                        })}
                        {continuedAppts.map(appt => {
                          const cols = apptColor(appt, todayStr)
                          return (
                            <div
                              key={`cont-${appt.id}`}
                              style={{
                                height: '100%',
                                borderLeft: `3px solid ${cols.border}`,
                                background: `${cols.bg}88`,
                                borderRadius: 4,
                                cursor: 'pointer',
                                minHeight: 28,
                              }}
                              onClick={() => openEditAppt(appt)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Résumé mensuel si aucun jour sélectionné */
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
                Résumé — {MONTH_NAMES[month]} {year}
              </div>
              {monthSess.length === 0 && monthAppt.length === 0 ? (
                <div className="empty">Aucune activité ce mois-ci.</div>
              ) : (
                <>
                  {monthSess.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.06em', marginBottom: 8 }}>
                        Séances réalisées ({monthSess.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
                        {Array.from(new Set(monthSess.map(s => s.patient_id))).map(pid => {
                          const pat   = getPatient(pid)
                          const count = monthSess.filter(s => s.patient_id === pid).length
                          return (
                            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#EAF0E8', borderRadius: 8 }}>
                              <div className="initials" style={{ width: 24, height: 24, fontSize: 9, flexShrink: 0, background: 'var(--accent)', color: 'white' }}>
                                {pat ? getInitials(pat.first_name, pat.last_name) : '?'}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2F5D34' }}>
                                  {pat ? `${pat.first_name} ${pat.last_name}` : '—'}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{count} séance{count > 1 ? 's' : ''}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {monthAppt.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.06em', marginBottom: 8 }}>
                        RDV du mois ({monthAppt.length})
                      </div>
                      {monthAppt.sort((a,b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut)).map(appt => {
                        const cols = apptColor(appt, todayStr)
                        return (
                          <div key={appt.id}
                            onClick={() => { setSelectedDay(appt.date); openEditAppt(appt) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: cols.bg, border: `1px solid ${cols.border}`, borderRadius: 8, marginBottom: 4, cursor: 'pointer' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: cols.text, minWidth: 36 }}>{appt.heure_debut}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: cols.text }}>
                                {getApptLabel(appt)}
                              </div>
                              {appt.guest_phone && !appt.patient_id && (
                                <div style={{ fontSize: 10, color: cols.text, opacity: .75 }}>☎ {appt.guest_phone}</div>
                              )}
                              {appt.note && <div style={{ fontSize: 10, color: cols.text, opacity: .7 }}>{appt.note}</div>}
                            </div>
                            <div style={{ fontSize: 10, color: cols.text, opacity: .7 }}>{fmtDate(appt.date)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal RDV ── */}
      {modalOpen && (
        <ApptModal
          date={selectedDay || todayStr}
          slotTime={modalSlot}
          appointment={modalAppt}
          patients={patients}
          onSave={handleSaveAppt}
          onDelete={modalAppt ? handleDeleteAppt : undefined}
          onClose={() => setModalOpen(false)}
          onPatientCreated={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}
