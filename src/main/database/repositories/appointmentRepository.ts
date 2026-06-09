import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'
import type { Appointment } from '../../../shared/types'

export function getAllAppointments(): Appointment[] {
  return getDb().prepare('SELECT * FROM appointments ORDER BY date, heure_debut').all() as Appointment[]
}

export function getAppointmentsByDate(date: string): Appointment[] {
  return getDb().prepare('SELECT * FROM appointments WHERE date = ? ORDER BY heure_debut').all(date) as Appointment[]
}

export function getAppointmentsByPatient(patientId: string): Appointment[] {
  return getDb().prepare('SELECT * FROM appointments WHERE patient_id = ? ORDER BY date, heure_debut').all(patientId) as Appointment[]
}

export function getAppointmentsByMonth(year: number, month: number): Appointment[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare("SELECT * FROM appointments WHERE date LIKE ? ORDER BY date, heure_debut").all(`${prefix}%`) as Appointment[]
}

export function getAppointmentById(id: string): Appointment | undefined {
  return getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Appointment | undefined
}

export function createAppointment(data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>): Appointment {
  const id  = uuidv4()
  const now = new Date().toISOString()
  const appt: Appointment = { ...data, id, created_at: now, updated_at: now }
  getDb().prepare(`
    INSERT INTO appointments
      (id, patient_id, date, heure_debut, heure_fin, note, is_done,
       guest_last_name, guest_first_name, guest_phone,
       google_event_id, created_at, updated_at)
    VALUES
      (@id, @patient_id, @date, @heure_debut, @heure_fin, @note, @is_done,
       @guest_last_name, @guest_first_name, @guest_phone,
       @google_event_id, @created_at, @updated_at)
  `).run({ ...appt, google_event_id: appt.google_event_id ?? null })
  return appt
}

export function updateAppointment(id: string, data: Partial<Appointment>): Appointment {
  const now      = new Date().toISOString()
  const existing = getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Appointment | undefined
  if (!existing) throw new Error(`Appointment ${id} not found`)
  const updated: Appointment = { ...existing, ...data, id, updated_at: now }
  getDb().prepare(`
    UPDATE appointments SET
      patient_id=@patient_id, date=@date, heure_debut=@heure_debut, heure_fin=@heure_fin,
      note=@note, is_done=@is_done,
      guest_last_name=@guest_last_name, guest_first_name=@guest_first_name, guest_phone=@guest_phone,
      google_event_id=@google_event_id,
      updated_at=@updated_at
    WHERE id=@id
  `).run({ ...updated, google_event_id: updated.google_event_id ?? null })
  return updated
}

export function deleteAppointment(id: string): void {
  getDb().prepare('DELETE FROM appointments WHERE id = ?').run(id)
}
