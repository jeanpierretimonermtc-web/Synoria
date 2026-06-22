import React, { useEffect, useState, useContext, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Session, Patient, Appointment, CalendarBlock, GCalCalendar } from '../../shared/types'
import { ToastContext } from '../App'
import { showConfirm } from '../components/common/ConfirmDialog'
import { fmtDate, getInitials } from '../utils/format'

/* ── Constantes ──────────────────────────────────────────────────── */

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_SHORT   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const DAY_FULL    = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

// Créneaux précis toutes les 5 min de 07:00 à 20:00 (sélecteurs modal)
const FINE_TIMES: string[] = []
for (let h = 7; h <= 20; h++) {
  for (let m = 0; m < 60; m += 5) {
    if (h === 20 && m > 0) break
    FINE_TIMES.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
}

// Grille horaire (vues semaine/jour)
const GRID_START  = 7   // 07:00
const GRID_END    = 20  // 20:00
const HOUR_H      = 64  // px par heure
const TOTAL_H     = (GRID_END - GRID_START) * HOUR_H
const GRID_HOURS  = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i)

// Vue mois : créneaux 30 min de 08:00 à 19:30
const TIME_SLOTS: string[] = []
for (let h = 8; h < 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
}

type CalView = 'month' | 'week' | 'day'

/* ── Helpers ─────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0')

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function timeToY(t: string): number {
  return Math.max(0, timeToMins(t) - GRID_START * 60) * (HOUR_H / 60)
}
function durationPx(start: string, end?: string): number {
  if (!end) return Math.round(45 * HOUR_H / 60)
  return Math.max(22, (timeToMins(end) - timeToMins(start)) * (HOUR_H / 60))
}
function mixWithWhite(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#E8F0F8'
  const n = parseInt(clean, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return `#${[mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

function googleCalendarColor(appt: Appointment, calendars: GCalCalendar[]): string | null {
  const prefix = 'gcalExternal:'
  if (!appt.google_event_id?.startsWith(prefix)) return null
  const encodedCalendarId = appt.google_event_id.slice(prefix.length).split(':')[0]
  const cal = calendars.find(c => encodeURIComponent(c.id) === encodedCalendarId)
  return cal?.color || null
}

function apptColor(appt: Appointment, today: string, calendarColor?: string | null): { bg: string; border: string; text: string } {
  if (appt.is_cancelled)  return { bg: '#FBEAEA', border: '#A83232', text: '#7A1E1E' }
  if (calendarColor)      return { bg: mixWithWhite(calendarColor, .84), border: calendarColor, text: calendarColor }
  if (appt.is_done)       return { bg: '#EAF0E8', border: '#4A6741', text: '#2F5D34' }
  if (appt.date < today)  return { bg: '#FDF3E3', border: '#C17B2A', text: '#9A5B12' }
  return { bg: '#E8F0F8', border: '#2A5A8A', text: '#1A3A6B' }
}
const BLOCK_COLOR = { bg: '#F0EDF7', border: '#5A4A7A', text: '#3A2E5A' }

function getWeekStart(d: Date): Date {
  const r = new Date(d)
  const dow = r.getDay()
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1))
  r.setHours(0, 0, 0, 0)
  return r
}
function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d })
}
function weekRangeLabel(ws: Date): string {
  const we = new Date(ws); we.setDate(we.getDate() + 6)
  if (ws.getMonth() === we.getMonth())
    return `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`
  if (ws.getFullYear() === we.getFullYear())
    return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()].slice(0,3)} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()].slice(0,3)} ${ws.getFullYear()}`
  return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()].slice(0,3)} ${ws.getFullYear()} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()].slice(0,3)} ${we.getFullYear()}`
}

/* ── COMBOBOX PATIENTS ───────────────────────────────────────────── */

function PatientCombobox({ patients, value, onChange }: {
  patients: Patient[]
  value: string
  onChange: (id: string) => void
}) {
  const sorted  = [...patients].sort((a, b) => a.last_name.localeCompare(b.last_name))
  const selected = sorted.find(p => p.id === value)

  const [query, setQuery] = useState(selected ? `${selected.last_name} ${selected.first_name}` : '')
  const [open,  setOpen]  = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Sync query when value changes from outside (ex: édition d'un RDV existant)
  useEffect(() => {
    const p = sorted.find(x => x.id === value)
    setQuery(p ? `${p.last_name} ${p.first_name}` : '')
  }, [value])

  // Fermer en cliquant en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Restaurer le nom du patient sélectionné si l'utilisateur avait tapé sans choisir
        const p = sorted.find(x => x.id === value)
        setQuery(p ? `${p.last_name} ${p.first_name}` : '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value, sorted])

  const filtered = query.trim().length === 0
    ? sorted
    : sorted.filter(p => {
        const full = `${p.last_name} ${p.first_name}`.toLowerCase()
        return full.includes(query.toLowerCase())
      })

  const handleSelect = (id: string) => {
    onChange(id)
    const p = sorted.find(x => x.id === id)
    setQuery(p ? `${p.last_name} ${p.first_name}` : '')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setOpen(true)
    if (!e.target.value) onChange('')
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un patient…"
          style={{ paddingRight: 32, width: '100%' }}
        />
        {value && (
          <button
            type="button"
            onMouseDown={handleClear}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
              padding: '2px 4px', display: 'flex', alignItems: 'center',
            }}
            title="Effacer la sélection"
          >×</button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 6px 24px rgba(0,0,0,.14)',
          maxHeight: 220,
          overflowY: 'auto',
        }}>
          {/* Option "sans fiche" toujours visible */}
          <div
            onMouseDown={() => handleSelect('')}
            style={{
              padding: '9px 13px',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              borderBottom: '1px solid var(--border-soft)',
              background: !value ? 'var(--blue-light)' : undefined,
            }}
          >
            — Nouveau patient / sans fiche —
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '10px 13px', fontSize: 12, color: 'var(--text-hint)' }}>
              Aucun patient trouvé
            </div>
          ) : filtered.map(p => (
            <div
              key={p.id}
              onMouseDown={() => handleSelect(p.id)}
              style={{
                padding: '9px 13px',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex', gap: 8, alignItems: 'baseline',
                background: p.id === value ? 'var(--blue-light)' : undefined,
              }}
              onMouseEnter={e => { if (p.id !== value) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { if (p.id !== value) (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p.last_name}</span>
              <span style={{ color: 'var(--text-muted)' }}>{p.first_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── MODAL RDV ───────────────────────────────────────────────────── */

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
  const showToast = useContext(ToastContext)
  const [localDate,      setLocalDate]      = useState(appointment?.date || date)
  const [patientId,      setPatientId]      = useState(appointment?.patient_id   || '')
  const [heureD,         setHeureD]         = useState(appointment?.heure_debut  || slotTime || '09:00')
  const [heureF,         setHeureF]         = useState(appointment?.heure_fin    || '')
  const [note,           setNote]           = useState(appointment?.note          || '')
  const [isDone,         setIsDone]         = useState(appointment?.is_done === 1)
  const [guestLastName,  setGuestLastName]  = useState(appointment?.guest_last_name  || '')
  const [guestFirstName, setGuestFirstName] = useState(appointment?.guest_first_name || '')
  const [guestPhone,     setGuestPhone]     = useState(appointment?.guest_phone       || '')
  const [isCancelled,    setIsCancelled]    = useState(appointment?.is_cancelled === 1)
  const [creating,       setCreating]       = useState(false)
  const navigate = useNavigate()

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
      is_cancelled:     isCancelled ? 1 : 0,
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

  const handleCreatePatient = async () => {
    if (!guestLastName && !guestFirstName) return
    if (!await showConfirm({ message: `Créer une fiche patient pour ${guestFirstName} ${guestLastName} ?`, title: 'Nouvelle fiche patient', confirmLabel: 'Créer' })) return
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
      if (appointment) {
        await window.mtcApi.updateAppointment(appointment.id, {
          patient_id: newPatient.id,
          guest_last_name: undefined, guest_first_name: undefined, guest_phone: undefined,
        })
      }
      onPatientCreated?.()
      onClose()
    } catch (e: any) { showToast(`Erreur : ${(e as any)?.message || e}`, 'error') }
    setCreating(false)
  }

  const hasGuestInfo = !patientId && (guestLastName || guestFirstName)

  const patientEmail = patientId ? (patients.find(p => p.id === patientId)?.email || '') : ''
  const canSendReminder = !!appointment && !!patientId && !!patientEmail && !isDone

  const handleSendReminder = async () => {
    if (!appointment) return
    try {
      await window.mtcApi.sendAppointmentReminder(appointment.id)
      showToast("Le mail de rappel a été préparé dans votre client mail. S'il n'est pas envoyé immédiatement, il partira automatiquement dès que votre connexion sera rétablie.")
    } catch (e: any) {
      showToast(`Impossible d'ouvrir le client mail : ${e?.message || e}`, 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <span>📅</span>
          <span>{appointment ? 'Modifier le RDV' : 'Nouveau rendez-vous'}</span>
          {isCancelled && (
            <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(168,50,50,.2)', borderRadius: 20, padding: '2px 10px', marginLeft: 4 }}>
              ✕ Annulé
            </span>
          )}
        </h2>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>Date du rendez-vous *</label>
          <input type="date" value={localDate} onChange={e => setLocalDate(e.target.value)}
            style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }} required />
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Patient existant</label>
          <PatientCombobox patients={patients} value={patientId} onChange={handlePatientChange} />
        </div>

        {!patientId && (
          <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
              Contact (nouveau patient)
            </div>
            <div className="grid2" style={{ marginBottom: 8 }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Nom</label>
                <input type="text" value={guestLastName} onChange={e => setGuestLastName(e.target.value)}
                  placeholder="DUPONT" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Prénom</label>
                <input type="text" value={guestFirstName} onChange={e => setGuestFirstName(e.target.value)} placeholder="Jean" />
              </div>
            </div>
            <div className="grid2">
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Téléphone</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="06 00 00 00 00" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>Motif de venue</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Douleurs, bilan…" />
              </div>
            </div>
            {hasGuestInfo && (
              <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 8 }}>✓ Le nom s'affichera sur le planning</div>
            )}
          </div>
        )}

        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Heure début *</label>
            <select value={heureD} onChange={e => setHeureD(e.target.value)}>
              {FINE_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Heure fin</label>
            <select value={heureF} onChange={e => setHeureF(e.target.value)}>
              <option value="">—</option>
              {FINE_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>
            Motif de visite / Objet du RDV
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Douleurs lombaires, bilan mensuel, suivi acupuncture, première consultation…"
            style={{ minHeight: 110, resize: 'vertical', fontSize: 13, lineHeight: 1.5 }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDone} onChange={e => setIsDone(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
          <span>Marquer comme réalisé</span>
        </label>

        <div className="modal-footer" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            {appointment ? '💾 Mettre à jour' : '+ Créer le RDV'}
          </button>
          {patientId && !appointment?.is_done && (
            <button className="btn btn-secondary" onClick={handleConvert} title="Ouvre le formulaire de séance">
              📋 Créer la séance
            </button>
          )}
          {hasGuestInfo && appointment && (
            <button className="btn btn-secondary" style={{ color: 'var(--teal)', borderColor: 'var(--teal)' }}
              onClick={handleCreatePatient} disabled={creating} title="Crée une fiche patient">
              {creating ? '⏳…' : '👤 Créer la fiche patient'}
            </button>
          )}
          {appointment && (
            <button
              className="btn btn-secondary"
              style={{ color: isCancelled ? 'var(--teal)' : 'var(--amber)' }}
              onClick={() => { setIsCancelled(c => !c); if (isDone) setIsDone(false) }}
              title={isCancelled ? 'Rétablir le rendez-vous' : 'Marquer comme annulé'}
            >
              {isCancelled ? '↩ Rétablir' : '✕ Annuler le RDV'}
            </button>
          )}
          {canSendReminder && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--teal)' }}
              onClick={handleSendReminder}
              title={`Envoyer un rappel à ${patientEmail}`}>
              ✉ Rappel par email
            </button>
          )}
          {appointment && onDelete && (
            <button className="btn btn-secondary" style={{ color: 'var(--red)' }} onClick={onDelete}>Supprimer</button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

/* ── MODAL BLOC ──────────────────────────────────────────────────── */

interface BlockModalProps {
  date: string
  slotTime?: string
  block?: CalendarBlock
  onSave: (data: Omit<CalendarBlock, 'id' | 'created_at' | 'updated_at'>) => void
  onDelete?: () => void
  onClose: () => void
}

function BlockModal({ date, slotTime, block, onSave, onDelete, onClose }: BlockModalProps) {
  const [localDate, setLocalDate] = useState(block?.date || date)
  const [isDay,     setIsDay]     = useState(block ? block.is_day === 1 : false)
  const [heureD,    setHeureD]    = useState(block?.heure_debut || slotTime || '09:00')
  const [heureF,    setHeureF]    = useState(block?.heure_fin   || '')
  const [motif,     setMotif]     = useState(block?.motif       || '')

  const handleSave = () => {
    if (!localDate) return
    onSave({
      date:        localDate,
      is_day:      isDay ? 1 : 0,
      heure_debut: isDay ? undefined : (heureD || undefined),
      heure_fin:   isDay ? undefined : (heureF || undefined),
      motif:       motif || undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ color: BLOCK_COLOR.border }}>⊘</span>
          <span>{block ? 'Modifier la plage perso' : 'Créneau perso / Indisponibilité'}</span>
        </h2>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontWeight: 700, color: BLOCK_COLOR.border, fontSize: 12 }}>Date *</label>
          <input type="date" value={localDate} onChange={e => setLocalDate(e.target.value)}
            style={{ fontWeight: 600, fontSize: 14, color: BLOCK_COLOR.border }} required />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[false, true].map(val => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setIsDay(val)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `2px solid ${isDay === val ? BLOCK_COLOR.border : 'var(--border)'}`,
                background: isDay === val ? BLOCK_COLOR.bg : 'transparent',
                color: isDay === val ? BLOCK_COLOR.text : 'var(--text-muted)',
              }}
            >
              {val ? '📅 Journée entière' : '🕐 Créneau horaire'}
            </button>
          ))}
        </div>

        {!isDay && (
          <div className="grid2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Heure début</label>
              <select value={heureD} onChange={e => setHeureD(e.target.value)}>
                {FINE_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Heure fin</label>
              <select value={heureF} onChange={e => setHeureF(e.target.value)}>
                <option value="">—</option>
                {FINE_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="field" style={{ marginBottom: 20 }}>
          <label>Motif (optionnel)</label>
          <input type="text" value={motif} onChange={e => setMotif(e.target.value)}
            placeholder="Formation, congé, rendez-vous perso…" />
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSave}
            style={{ background: BLOCK_COLOR.border, borderColor: BLOCK_COLOR.border }}>
            {block ? '💾 Mettre à jour' : '⊘ Enregistrer'}
          </button>
          {block && onDelete && (
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

/* ── GRILLE HORAIRE — partagée entre vue Semaine et vue Jour ──────── */

interface GridProps {
  days: Date[]
  todayStr: string
  sessionsByDate: Record<string, Session[]>
  apptByDate: Record<string, Appointment[]>
  blocksByDate: Record<string, CalendarBlock[]>
  patients: Patient[]
  onSlotClick: (date: string, time: string) => void
  onApptClick: (appt: Appointment) => void
  onBlockClick: (block: CalendarBlock) => void
  onSessClick: (sessId: string) => void
  onDayHeaderClick: (d: Date) => void
  googleImportCalendars: GCalCalendar[]
}

function TimeGridView({ days, todayStr, sessionsByDate, apptByDate, blocksByDate, patients, onSlotClick, onApptClick, onBlockClick, onSessClick, onDayHeaderClick, googleImportCalendars }: GridProps) {
  const [nowY, setNowY] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const getPatient = useCallback((id?: string) => id ? patients.find(p => p.id === id) : undefined, [patients])
  const getApptLabel = (appt: Appointment): string => {
    const p = getPatient(appt.patient_id)
    if (p) return `${p.first_name} ${p.last_name}`
    return [appt.guest_first_name, appt.guest_last_name].filter(Boolean).join(' ') || '—'
  }

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes() - GRID_START * 60
      const y = mins * (HOUR_H / 60)
      setNowY(y >= 0 && y <= TOTAL_H ? y : null)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll initial vers l'heure courante (ou 09:00)
  useEffect(() => {
    if (!bodyRef.current) return
    const target = nowY !== null ? Math.max(0, nowY - 120) : 2 * HOUR_H
    bodyRef.current.scrollTop = target
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSessions = days.some(d => (sessionsByDate[toDateStr(d)] || []).length > 0)
  const isMultiDay = days.length > 1

  return (
    <div className="cal-grid-wrap">
      {/* ── En-têtes colonnes ── */}
      <div className="cal-col-header-row">
        <div className="cal-time-gutter" />
        {days.map((day, i) => {
          const ds = toDateStr(day)
          const isT = ds === todayStr
          const dow = (day.getDay() + 6) % 7
          return (
            <div
              key={i}
              className={`cal-col-header${isT ? ' today' : ''}`}
              onClick={() => isMultiDay && onDayHeaderClick(day)}
              title={isMultiDay ? 'Cliquer pour voir ce jour' : ''}
            >
              <div className="ch-name">{DAY_SHORT[dow]}</div>
              <div className="ch-num">
                {isT ? (
                  <span className="ch-today-circle">{day.getDate()}</span>
                ) : (
                  <span>{day.getDate()}</span>
                )}
              </div>
              {isMultiDay && (
                <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 1, lineHeight: 1.2 }}>
                  {MONTH_NAMES[day.getMonth()].slice(0, 4)}.
                </div>
              )}
              {(() => {
                const dayBlock = (blocksByDate[ds] || []).find(b => b.is_day === 1)
                return dayBlock ? (
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: BLOCK_COLOR.border,
                    marginTop: 3, padding: '1px 5px',
                    background: BLOCK_COLOR.bg,
                    border: `1px dashed ${BLOCK_COLOR.border}`,
                    borderRadius: 4, lineHeight: 1.4,
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    ⊘ {dayBlock.motif || 'Indispo'}
                  </div>
                ) : null
              })()}
            </div>
          )
        })}
      </div>

      {/* ── Bande séances (toute la journée, pas d'horaire fixe) ── */}
      {hasSessions && (
        <div className="cal-allday-row">
          <div className="cal-allday-gutter">Séances</div>
          {days.map((day, i) => {
            const sess = sessionsByDate[toDateStr(day)] || []
            return (
              <div key={i} className="cal-allday-col">
                {sess.map(s => {
                  const p = getPatient(s.patient_id)
                  return (
                    <div key={s.id} className="cal-sess-pill" onClick={() => onSessClick(s.id)}>
                      {p ? `${p.first_name} ${p.last_name.charAt(0)}.` : '—'}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Corps : grille horaire scrollable ── */}
      <div className="cal-grid-body" ref={bodyRef}>
        <div className="cal-grid-inner" style={{ height: TOTAL_H }}>

          {/* Colonne des heures */}
          <div className="cal-time-col" style={{ height: TOTAL_H }}>
            {GRID_HOURS.map(h => (
              <div
                key={h}
                className="cal-time-label"
                style={{ top: (h - GRID_START) * HOUR_H + 3 }}
              >
                {pad(h)}:00
              </div>
            ))}
          </div>

          {/* Colonnes jours */}
          {days.map((day, ci) => {
            const ds    = toDateStr(day)
            const appts = (apptByDate[ds] || []).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))
            const isT   = ds === todayStr

            const dayBlocks  = (blocksByDate[ds] || [])
            const dayIsBlocked = dayBlocks.some(b => b.is_day === 1)
            const slotBlocks = dayBlocks.filter(b => b.is_day === 0)

            return (
              <div key={ci} className="cal-day-col" style={{ height: TOTAL_H }}>

                {/* Journée entière bloquée : overlay violet hacheté */}
                {dayIsBlocked && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
                    background: 'repeating-linear-gradient(-45deg, rgba(90,74,122,.09) 0px, rgba(90,74,122,.09) 5px, transparent 5px, transparent 14px)',
                    borderLeft: `3px solid ${BLOCK_COLOR.border}`,
                    borderRight: `1px solid rgba(90,74,122,.15)`,
                  }} />
                )}

                {/* Lignes de fond par heure */}
                {GRID_HOURS.map(h => (
                  <React.Fragment key={h}>
                    <div className="cal-hour-line" style={{ top: (h - GRID_START) * HOUR_H }} />
                    <div className="cal-half-line"  style={{ top: (h - GRID_START) * HOUR_H + HOUR_H / 2 }} />
                  </React.Fragment>
                ))}

                {/* Zones cliquables (créneaux 30 min) */}
                {GRID_HOURS.flatMap(h => [0, 30].map(m => (
                  <div
                    key={`${h}:${m}`}
                    className="cal-slot-click"
                    style={{
                      top:    (h - GRID_START) * HOUR_H + m * (HOUR_H / 60),
                      height: HOUR_H / 2,
                    }}
                    onClick={() => onSlotClick(ds, `${pad(h)}:${pad(m)}`)}
                  />
                )))}

                {/* Blocs personnels / indisponibilités */}
                {slotBlocks.map(blk => {
                  const y = blk.heure_debut ? timeToY(blk.heure_debut) : 0
                  const h = durationPx(blk.heure_debut || '00:00', blk.heure_fin)
                  return (
                    <div
                      key={blk.id}
                      className="cal-block-personal"
                      style={{ top: y, height: h, zIndex: 3 }}
                      onClick={e => { e.stopPropagation(); onBlockClick(blk) }}
                    >
                      <div className="cal-appt-name">⊘ {blk.motif || 'Perso / Indispo'}</div>
                      {h >= 32 && blk.heure_debut && (
                        <div className="cal-appt-time">
                          {blk.heure_debut}{blk.heure_fin ? ` – ${blk.heure_fin}` : ''}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Blocs RDV */}
                {appts.map(appt => {
                  const y   = timeToY(appt.heure_debut)
                  const h   = durationPx(appt.heure_debut, appt.heure_fin)
                  const c   = apptColor(appt, todayStr, googleCalendarColor(appt, googleImportCalendars))
                  const lbl = getApptLabel(appt)
                  return (
                    <div
                      key={appt.id}
                      className="cal-appt-block"
                      style={{ top: y, height: h, background: c.bg, borderColor: c.border, color: c.text, zIndex: 2 }}
                      onClick={e => { e.stopPropagation(); onApptClick(appt) }}
                    >
                      <div className="cal-appt-name">{lbl}</div>
                      {h >= 22 && (
                        <div className="cal-appt-time">
                          {appt.heure_debut}{appt.heure_fin ? ` – ${appt.heure_fin}` : ''}
                        </div>
                      )}
                      {h >= 40 && appt.note && (
                        <div style={{
                          fontSize: 10, lineHeight: 1.3, marginTop: 2,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                          opacity: .85,
                        }}>
                          {appt.note}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Indicateur heure courante */}
                {isT && nowY !== null && (
                  <div className="cal-now-line" style={{ top: nowY }}>
                    <div className="cal-now-dot" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── PAGE PRINCIPALE ─────────────────────────────────────────────── */

export default function CalendarPage() {
  const today    = new Date()
  const todayStr = toDateStr(today)

  const [view,         setView]         = useState<CalView>('month')
  const [year,         setYear]         = useState(today.getFullYear())
  const [month,        setMonth]        = useState(today.getMonth())
  const [selectedDay,  setSelectedDay]  = useState<string>(todayStr)
  const [weekStart,    setWeekStart]    = useState(() => getWeekStart(today))
  const [sessions,     setSessions]     = useState<Session[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients,     setPatients]     = useState<Patient[]>([])
  const [blocks,       setBlocks]       = useState<CalendarBlock[]>([])
  const [modalOpen,    setModalOpen]    = useState(false)
  const [modalAppt,    setModalAppt]    = useState<Appointment | undefined>()
  const [modalDate,    setModalDate]    = useState<string>(todayStr)
  const [modalSlot,    setModalSlot]    = useState<string | undefined>()
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [editBlock,      setEditBlock]      = useState<CalendarBlock | undefined>()
  const [blockModalDate, setBlockModalDate] = useState<string>(todayStr)
  const [blockModalSlot, setBlockModalSlot] = useState<string | undefined>()
  const [gcalConnected,  setGcalConnected]  = useState(false)
  const [gcalImportCalendars, setGcalImportCalendars] = useState<GCalCalendar[]>([])
  const [syncing,        setSyncing]        = useState(false)

  const showToast = useContext(ToastContext)
  const navigate  = useNavigate()
  const location  = useLocation()

  const load = useCallback(async (skipBackfill = false) => {
    // Rattrapage silencieux : crée les RDV manquants depuis les séances existantes
    if (!skipBackfill && window.mtcApi.appointmentsBackfillFromSessions) {
      try {
        const r = await window.mtcApi.appointmentsBackfillFromSessions()
        if (r.created > 0) {
          // Des RDV ont été créés, on continue — les getAppointments ci-dessous les incluront
        }
      } catch { /* non bloquant */ }
    }

    const [s, p, a] = await Promise.all([
      window.mtcApi.getSessions().catch((): Session[]      => []),
      window.mtcApi.getPatients().catch((): Patient[]      => []),
      window.mtcApi.getAppointments().catch((): Appointment[] => []),
    ])
    setSessions(s); setPatients(p); setAppointments(a)

    if (window.mtcApi.getCalendarBlocks) {
      window.mtcApi.getCalendarBlocks().then(setBlocks).catch(() => {})
    }
    window.mtcApi.gcalStatus()
      .then(g => {
        setGcalConnected(g.connected)
        setGcalImportCalendars(g.importCalendars ?? [])
      })
      .catch(() => {
        setGcalConnected(false)
        setGcalImportCalendars([])
      })
  }, [])   // stable — ne dépend d'aucun state

  useEffect(() => { load() }, [load])

  // Quand on arrive depuis une séance avec un prochain RDV, aller sur cette date
  useEffect(() => {
    const focusDate = (location.state as any)?.focusDate as string | undefined
    if (!focusDate) return
    const d = new Date(focusDate + 'T12:00:00')
    if (isNaN(d.getTime())) return
    setSelectedDay(focusDate)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setWeekStart(getWeekStart(d))
    setView('month')
    // Effacer le state pour ne pas re-naviguer au prochain montage
    window.history.replaceState({}, '')
  }, [location.state])

  /* ── Index par date ── */
  const sessionsByDate: Record<string, Session[]> = {}
  sessions.forEach(s => { (sessionsByDate[s.date] ??= []).push(s) })

  const apptByDate: Record<string, Appointment[]> = {}
  appointments.forEach(a => { (apptByDate[a.date] ??= []).push(a) })

  const blocksByDate: Record<string, CalendarBlock[]> = {}
  blocks.forEach(b => { (blocksByDate[b.date] ??= []).push(b) })

  /* ── Helpers patient ── */
  const getPatient = (id?: string) => id ? patients.find(p => p.id === id) : undefined
  const getApptLabel = (appt: Appointment): string => {
    const p = getPatient(appt.patient_id)
    if (p) return `${p.first_name} ${p.last_name}`
    return [appt.guest_first_name, appt.guest_last_name].filter(Boolean).join(' ') || '—'
  }
  const getApptInitials = (appt: Appointment): string => {
    const p = getPatient(appt.patient_id)
    if (p) return getInitials(p.first_name, p.last_name)
    if (appt.guest_first_name || appt.guest_last_name)
      return getInitials(appt.guest_first_name || '', appt.guest_last_name || '')
    return '?'
  }

  /* ── Calendrier mensuel ── */
  const firstDay    = new Date(year, month, 1)
  const daysCount   = new Date(year, month + 1, 0).getDate()
  let startOffset   = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysCount; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const monthStr  = `${year}-${pad(month + 1)}`
  const monthSess = sessions.filter(s => s.date.startsWith(monthStr))
  const monthAppt = appointments.filter(a => a.date.startsWith(monthStr))

  /* ── Navigation ── */
  const goToPrevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1) } else setMonth(m => m-1) }
  const goToNextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1) } else setMonth(m => m+1) }
  const goToPrevWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d) }
  const goToNextWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d) }
  const goToPrevDay   = () => { const d = new Date(selectedDay); d.setDate(d.getDate()-1); setSelectedDay(toDateStr(d)) }
  const goToNextDay   = () => { const d = new Date(selectedDay); d.setDate(d.getDate()+1); setSelectedDay(toDateStr(d)) }
  const goToToday     = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth())
    setSelectedDay(todayStr); setWeekStart(getWeekStart(today))
  }

  /* ── Changement de vue ── */
  const switchView = (v: CalView) => {
    if (v === 'week') setWeekStart(getWeekStart(new Date(selectedDay)))
    if (v === 'month') { const sd = new Date(selectedDay); setYear(sd.getFullYear()); setMonth(sd.getMonth()) }
    setView(v)
  }

  const handleDayHeaderClick = (d: Date) => {
    setSelectedDay(toDateStr(d))
    setView('day')
  }

  /* ── Modal ── */
  const openNewAppt = (date: string, slot?: string) => {
    setModalAppt(undefined); setModalDate(date); setModalSlot(slot); setModalOpen(true)
  }
  const openEditAppt = (appt: Appointment) => {
    setModalAppt(appt); setModalDate(appt.date); setModalSlot(undefined); setModalOpen(true)
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
      setModalOpen(false); load(true)
    } catch { showToast('Erreur enregistrement RDV', 'error') }
  }
  const handleDeleteAppt = async () => {
    if (!modalAppt || !await showConfirm({ message: 'Supprimer ce rendez-vous ?', title: 'Supprimer le RDV', confirmLabel: 'Supprimer', danger: true })) return
    try {
      await window.mtcApi.deleteAppointment(modalAppt.id)
      showToast('RDV supprimé'); setModalOpen(false); load(true)

    } catch { showToast('Erreur suppression RDV', 'error') }
  }

  /* ── Blocs calendrier ── */
  const openNewBlock = (date: string, slot?: string) => {
    setEditBlock(undefined); setBlockModalDate(date); setBlockModalSlot(slot); setBlockModalOpen(true)
  }
  const openEditBlock = (blk: CalendarBlock) => {
    setEditBlock(blk); setBlockModalDate(blk.date); setBlockModalSlot(undefined); setBlockModalOpen(true)
  }
  const handleSaveBlock = async (data: Omit<CalendarBlock, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editBlock) {
        await window.mtcApi.updateCalendarBlock(editBlock.id, data)
        showToast('Bloc mis à jour ✓')
      } else {
        await window.mtcApi.createCalendarBlock(data)
        showToast('Créneau bloqué ✓')
      }
      setBlockModalOpen(false); load(true)
    } catch { showToast('Erreur enregistrement bloc', 'error') }
  }
  const handleDeleteBlock = async () => {
    if (!editBlock || !await showConfirm({ message: 'Supprimer ce bloc ?', title: 'Supprimer le bloc', confirmLabel: 'Supprimer', danger: true })) return
    try {
      await window.mtcApi.deleteCalendarBlock(editBlock.id)
      showToast('Bloc supprimé'); setBlockModalOpen(false); load(true)
    } catch { showToast('Erreur suppression bloc', 'error') }
  }

  /* ── Libellés navigation ── */
  const weekDays = getWeekDays(weekStart)
  let navLabel = ''
  let onPrev: () => void
  let onNext: () => void
  if (view === 'month') {
    navLabel = `${MONTH_NAMES[month]} ${year}`
    onPrev = goToPrevMonth; onNext = goToNextMonth
  } else if (view === 'week') {
    navLabel = weekRangeLabel(weekStart)
    onPrev = goToPrevWeek; onNext = goToNextWeek
  } else {
    const sd  = new Date(selectedDay)
    const dow = (sd.getDay() + 6) % 7
    navLabel  = `${DAY_FULL[dow]} ${sd.getDate()} ${MONTH_NAMES[sd.getMonth()]} ${sd.getFullYear()}`
    onPrev = goToPrevDay; onNext = goToNextDay
  }

  /* ── Stats en-tête ── */
  const currentCount = view === 'week'
    ? appointments.filter(a => weekDays.some(d => toDateStr(d) === a.date)).length
    : view === 'day'
      ? (apptByDate[selectedDay] || []).length
      : monthAppt.length
  const currentSess = view === 'week'
    ? sessions.filter(s => weekDays.some(d => toDateStr(d) === s.date)).length
    : view === 'day'
      ? (sessionsByDate[selectedDay] || []).length
      : monthSess.length
  const periodLabel = view === 'month' ? MONTH_NAMES[month] : view === 'week' ? 'cette semaine' : 'ce jour'

  /* ── Sync Google Calendar ── */
  const handleGcalSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      // Calcule la plage de dates visible selon la vue
      let startDate: string
      let endDate:   string
      if (view === 'week') {
        startDate = toDateStr(weekDays[0])
        endDate   = toDateStr(weekDays[6])
      } else if (view === 'day') {
        startDate = selectedDay
        endDate   = selectedDay
      } else {
        // Vue mois : mois entier + tampon 7j de chaque côté
        const first = new Date(year, month, 1)
        const last  = new Date(year, month + 1, 0)
        first.setDate(first.getDate() - 7)
        last.setDate(last.getDate() + 7)
        startDate = toDateStr(first)
        endDate   = toDateStr(last)
      }
      const result = await window.mtcApi.gcalSync(startDate, endDate)
      const parts: string[] = []
      if (result.imported > 0) parts.push(`${result.imported} importé${result.imported > 1 ? 's' : ''}`)
      if (result.updated  > 0) parts.push(`${result.updated} mis à jour`)
      if (result.exported > 0) parts.push(`${result.exported} envoyé${result.exported > 1 ? 's' : ''} vers Google`)
      if (result.sessionsExported > 0) parts.push(`${result.sessionsExported} séance${result.sessionsExported > 1 ? 's' : ''} envoyée${result.sessionsExported > 1 ? 's' : ''}`)
      if (result.sessionsUpdated > 0) parts.push(`${result.sessionsUpdated} séance${result.sessionsUpdated > 1 ? 's' : ''} mise${result.sessionsUpdated > 1 ? 's' : ''} à jour`)
      if (parts.length === 0)  parts.push('Tout est à jour')
      showToast(`Google Calendar — ${parts.join(', ')} ✓`)
      load(true)
    } catch (e: any) {
      showToast(`Erreur sync Google Calendar : ${e?.message || e}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  /* ── Données vue mois ── */
  const daySessions     = selectedDay ? (sessionsByDate[selectedDay] || []) : []
  const dayAppointments = selectedDay ? (apptByDate[selectedDay]     || []) : []

  return (
    <div>
      {/* ── Barre de contrôle principale ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>

        {/* Sélecteur de vue */}
        <div className="cal-view-switcher">
          {(['month', 'week', 'day'] as CalView[]).map(v => (
            <button
              key={v}
              className={`cal-view-btn${view === v ? ' active' : ''}`}
              onClick={() => switchView(v)}
            >
              {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Jour'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={onPrev} style={{ minWidth: 32, fontWeight: 700, fontSize: 16 }}>‹</button>
          <div style={{ textAlign: 'center', minWidth: view === 'week' ? 260 : 200 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-serif)', lineHeight: 1.2 }}>
              {navLabel}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {currentSess} séance{currentSess !== 1 ? 's' : ''} · {currentCount} RDV {periodLabel !== MONTH_NAMES[month] ? periodLabel : ''}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onNext} style={{ minWidth: 32, fontWeight: 700, fontSize: 16 }}>›</button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={goToToday}>Aujourd'hui</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openNewAppt(
              view === 'week' ? toDateStr(weekDays[0]) :
              view === 'day'  ? selectedDay : selectedDay || todayStr
            )}
          >
            + Nouveau RDV
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ color: BLOCK_COLOR.border, borderColor: BLOCK_COLOR.border }}
            onClick={() => openNewBlock(
              view === 'week' ? toDateStr(weekDays[0]) :
              view === 'day'  ? selectedDay : selectedDay || todayStr
            )}
          >
            ⊘ Perso / Indispo
          </button>
          {gcalConnected && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ color: '#1a73e8', borderColor: '#1a73e8', opacity: syncing ? .6 : 1, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={handleGcalSync}
              disabled={syncing}
              title="Importer / mettre à jour les événements Google Calendar sur la période visible"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {syncing ? 'Sync…' : 'Sync GCal'}
            </button>
          )}
        </div>
      </div>

      {/* ═══ VUE MOIS ═══════════════════════════════════════════════ */}
      {view === 'month' && (
        <div>
          {/* Sélecteurs rapides */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <select value={year} onChange={e => setYear(+e.target.value)} style={{ width: 90 }}>
              {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 5 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={{ width: 130 }}>
              {MONTH_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Calendrier mensuel */}
            <div className="card" style={{ padding: '10px' }}>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> Séance
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block' }} /> RDV planifié
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} /> En attente
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => switchView('week')}>
                  Vue semaine →
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
                {DAY_SHORT.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`e-${idx}`} />
                  const ds    = dateStr(year, month, day)
                  const sess    = sessionsByDate[ds] || []
                  const appts   = apptByDate[ds] || []
                  const blkDay  = (blocksByDate[ds] || [])
                  const isT     = ds === todayStr
                  const isSel   = ds === selectedDay
                  const dots    = sess.length > 0 || appts.length > 0 || blkDay.length > 0

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDay(isSel ? '' : ds)}
                      onDoubleClick={() => { setSelectedDay(ds); switchView('day') }}
                      title="Clic : voir le jour · Double-clic : vue jour"
                      style={{
                        borderRadius: 6, padding: '4px 2px', minHeight: 44, cursor: 'pointer',
                        background: isSel ? 'var(--accent)' : isT ? 'var(--accent-light)' : dots ? 'var(--surface-hover)' : 'transparent',
                        border: isT && !isSel ? '2px solid var(--accent)' : isSel ? '2px solid var(--accent)' : '2px solid transparent',
                        transition: 'all .12s',
                      }}
                    >
                      <div style={{
                        textAlign: 'center', fontSize: 12,
                        fontWeight: isT || isSel ? 700 : 400,
                        color: isSel ? 'white' : isT ? 'var(--accent)' : 'var(--text)',
                        marginBottom: 2,
                      }}>
                        {day}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
                        {sess.slice(0, 2).map((_, i) => (
                          <div key={`s${i}`} style={{ width: 6, height: 6, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,.9)' : 'var(--accent)' }} />
                        ))}
                        {appts.filter(a => !a.is_cancelled).slice(0, 3).map((appt, i) => {
                          // Couleur du point : réalisé=vert · GCal=couleur GCal · passé=ambre · futur=bleu
                          const gColor = googleCalendarColor(appt, gcalImportCalendars)
                          const dotColor = isSel ? 'rgba(255,255,255,.9)'
                            : gColor        ? gColor
                            : appt.is_done  ? 'var(--accent)'
                            : appt.date < todayStr ? 'var(--amber)'
                            : 'var(--blue)'
                          return (
                            <div
                              key={`ap${i}`}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: appt.is_done ? 3 : '50%',  // carré = réalisé, rond = planifié
                                background: dotColor,
                                boxShadow: isSel ? '0 0 0 1px rgba(255,255,255,.85)' : undefined,
                              }}
                            />
                          )
                        })}
                        {blkDay.length > 0 && (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,.9)' : BLOCK_COLOR.border }} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panneau jour ou résumé mensuel */}
            <div>
              {selectedDay ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{fmtDate(selectedDay)}</h3>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, cursor: 'pointer' }}
                        onClick={() => switchView('day')}>
                        → Vue jour complète
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => openNewAppt(selectedDay)}>
                        + Nouveau RDV
                      </button>
                      <button className="btn btn-secondary btn-sm"
                        style={{ color: BLOCK_COLOR.border, borderColor: BLOCK_COLOR.border }}
                        onClick={() => openNewBlock(selectedDay)}
                        title="Ajouter un créneau perso / indisponibilité">
                        ⊘
                      </button>
                    </div>
                  </div>

                  {/* Blocs du jour */}
                  {(blocksByDate[selectedDay] || []).length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {(blocksByDate[selectedDay] || []).map(blk => (
                        <div key={blk.id}
                          onClick={() => openEditBlock(blk)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                            borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                            border: `1.5px dashed ${BLOCK_COLOR.border}`,
                            background: 'repeating-linear-gradient(-45deg, rgba(90,74,122,.05) 0px, rgba(90,74,122,.05) 3px, rgba(240,237,247,.9) 3px, rgba(240,237,247,.9) 10px)',
                          }}
                        >
                          <span style={{ fontSize: 13, color: BLOCK_COLOR.border }}>⊘</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: BLOCK_COLOR.text, fontStyle: 'italic' }}>
                              {blk.is_day === 1 ? 'Journée entière' : `${blk.heure_debut}${blk.heure_fin ? ` – ${blk.heure_fin}` : ''}`}
                            </div>
                            {blk.motif && <div style={{ fontSize: 11, color: BLOCK_COLOR.text, opacity: .75 }}>{blk.motif}</div>}
                          </div>
                          <span style={{ fontSize: 9, color: BLOCK_COLOR.border, opacity: .6 }}>Perso</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {daySessions.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                        Séances réalisées
                      </div>
                      {daySessions.map(sess => {
                        const pat = getPatient(sess.patient_id)
                        return (
                          <div key={sess.id} onClick={() => navigate(`/seances/${sess.id}`)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: '#EAF0E8', border: '1px solid #4A6741', cursor: 'pointer' }}
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

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                    Planning du jour
                  </div>
                  <div className="time-grid">
                    {TIME_SLOTS.map((slot, slotIdx) => {
                      const nextSlot  = TIME_SLOTS[slotIdx + 1] ?? '20:00'
                      const startAppts = dayAppointments.filter(a => a.heure_debut >= slot && a.heure_debut < nextSlot)
                      const contAppts  = dayAppointments.filter(a => a.heure_debut < slot && a.heure_fin && a.heure_fin > slot)
                      const isEmpty    = startAppts.length === 0 && contAppts.length === 0

                      return (
                        <div key={slot} className="time-slot">
                          <div className="time-slot-label">{slot}</div>
                          <div className="time-slot-content">
                            {isEmpty && (
                              <div className="time-slot-empty" onClick={() => openNewAppt(selectedDay, slot)} title="Cliquer pour créer un RDV">
                                <span className="time-slot-plus">+</span>
                              </div>
                            )}
                            {startAppts.map(appt => {
                              const cols  = apptColor(appt, todayStr, googleCalendarColor(appt, gcalImportCalendars))
                              const label = appt.is_done ? 'Réalisé' : appt.date < todayStr ? 'En attente' : 'Planifié'
                              const name  = getApptLabel(appt)
                              const isGuest = !appt.patient_id && (appt.guest_first_name || appt.guest_last_name)
                              return (
                                <div key={appt.id} className="rdv-block"
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
                                      {appt.note && (
                                        <div style={{ fontSize: 10, color: cols.text, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.note}</div>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 9, color: cols.border, fontWeight: 700, flexShrink: 0 }}>{label}</span>
                                  </div>
                                </div>
                              )
                            })}
                            {contAppts.map(appt => {
                              const cols = apptColor(appt, todayStr, googleCalendarColor(appt, gcalImportCalendars))
                              return (
                                <div key={`cont-${appt.id}`}
                                  style={{ height: '100%', borderLeft: `3px solid ${cols.border}`, background: `${cols.bg}88`, borderRadius: 4, cursor: 'pointer', minHeight: 28 }}
                                  onClick={() => openEditAppt(appt)} />
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
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 6 }}>
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
                            const cols = apptColor(appt, todayStr, googleCalendarColor(appt, gcalImportCalendars))
                            return (
                              <div key={appt.id}
                                onClick={() => { setSelectedDay(appt.date); openEditAppt(appt) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: cols.bg, border: `1px solid ${cols.border}`, borderRadius: 8, marginBottom: 4, cursor: 'pointer' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: cols.text, minWidth: 36 }}>{appt.heure_debut}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: cols.text }}>{getApptLabel(appt)}</div>
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
        </div>
      )}

      {/* ═══ VUE SEMAINE ════════════════════════════════════════════ */}
      {view === 'week' && (
        <TimeGridView
          days={weekDays}
          todayStr={todayStr}
          sessionsByDate={sessionsByDate}
          apptByDate={apptByDate}
          blocksByDate={blocksByDate}
          patients={patients}
          onSlotClick={(ds, time) => openNewAppt(ds, time)}
          onApptClick={openEditAppt}
          onBlockClick={openEditBlock}
          onSessClick={id => navigate(`/seances/${id}`)}
          onDayHeaderClick={handleDayHeaderClick}
          googleImportCalendars={gcalImportCalendars}
        />
      )}

      {/* ═══ VUE JOUR ═══════════════════════════════════════════════ */}
      {view === 'day' && (
        <TimeGridView
          days={[new Date(selectedDay + 'T12:00:00')]}
          todayStr={todayStr}
          sessionsByDate={sessionsByDate}
          apptByDate={apptByDate}
          blocksByDate={blocksByDate}
          patients={patients}
          onSlotClick={(ds, time) => openNewAppt(ds, time)}
          onApptClick={openEditAppt}
          onBlockClick={openEditBlock}
          onSessClick={id => navigate(`/seances/${id}`)}
          onDayHeaderClick={() => {}}
          googleImportCalendars={gcalImportCalendars}
        />
      )}

      {/* ── Modal RDV ── */}
      {modalOpen && (
        <ApptModal
          date={modalDate}
          slotTime={modalSlot}
          appointment={modalAppt}
          patients={patients}
          onSave={handleSaveAppt}
          onDelete={modalAppt ? handleDeleteAppt : undefined}
          onClose={() => setModalOpen(false)}
          onPatientCreated={() => { setModalOpen(false); load(true) }}

        />
      )}

      {/* ── Modal Bloc ── */}
      {blockModalOpen && (
        <BlockModal
          date={blockModalDate}
          slotTime={blockModalSlot}
          block={editBlock}
          onSave={handleSaveBlock}
          onDelete={editBlock ? handleDeleteBlock : undefined}
          onClose={() => setBlockModalOpen(false)}
        />
      )}
    </div>
  )
}
