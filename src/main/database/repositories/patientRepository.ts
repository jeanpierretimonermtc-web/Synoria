import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'
import type { Patient, FollowUpPatient } from '../../../shared/types'

export function getAllPatients(): Patient[] {
  return getDb().prepare('SELECT * FROM patients ORDER BY last_name, first_name').all() as Patient[]
}

export function getPatientById(id: string): Patient | null {
  return (getDb().prepare('SELECT * FROM patients WHERE id = ?').get(id) as Patient) ?? null
}

export function createPatient(data: Omit<Patient, 'id' | 'created_at' | 'updated_at'>): Patient {
  const id = uuidv4()
  const now = new Date().toISOString()
  const patient: Patient = { ...data, id, is_active: 1, created_at: now, updated_at: now }
  getDb().prepare(`
    INSERT INTO patients (id, first_name, last_name, birth_date, phone, email, address,
      notes_general, alerts, regular_doctor, medications, antecedents, profession,
      civility, is_active, consent_given, consent_date, created_at, updated_at)
    VALUES (@id, @first_name, @last_name, @birth_date, @phone, @email, @address,
      @notes_general, @alerts, @regular_doctor, @medications, @antecedents, @profession,
      @civility, @is_active, @consent_given, @consent_date, @created_at, @updated_at)
  `).run({ civility: '', consent_given: 0, consent_date: null, ...patient })
  return patient
}

export function updatePatient(id: string, data: Partial<Patient>): Patient {
  const now = new Date().toISOString()
  const existing = getPatientById(id)
  if (!existing) throw new Error(`Patient ${id} not found`)
  const updated: Patient = { ...existing, ...data, id, updated_at: now }
  getDb().prepare(`
    UPDATE patients SET
      first_name=@first_name, last_name=@last_name, birth_date=@birth_date,
      phone=@phone, email=@email, address=@address, notes_general=@notes_general,
      alerts=@alerts, regular_doctor=@regular_doctor, medications=@medications,
      antecedents=@antecedents, profession=@profession, civility=@civility,
      is_active=@is_active, consent_given=@consent_given, consent_date=@consent_date,
      updated_at=@updated_at
    WHERE id=@id
  `).run(updated)
  return updated
}

export function deletePatient(id: string): void {
  getDb().prepare('DELETE FROM patients WHERE id = ?').run(id)
}

/**
 * Patients actifs dont la dernière séance remonte à plus de `daysSince` jours
 * (ou qui n'ont aucune séance). Limité aux 8 premiers résultats, les plus anciens en tête.
 */
export function getPatientsToFollowUp(daysSince: number): FollowUpPatient[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysSince)
  const c = cutoff
  const cutoffStr = `${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,'0')}-${String(c.getDate()).padStart(2,'0')}`

  type Row = Patient & { last_session_date: string | null }
  const rows = getDb().prepare(`
    SELECT p.*, MAX(s.date) AS last_session_date
    FROM patients p
    LEFT JOIN sessions s ON s.patient_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING MAX(s.date) IS NULL OR MAX(s.date) < ?
    ORDER BY MAX(s.date) ASC
    LIMIT 8
  `).all(cutoffStr) as Row[]

  const today = new Date()
  return rows.map(row => {
    const { last_session_date, ...rest } = row as any
    const days = last_session_date
      ? Math.floor((today.getTime() - new Date((last_session_date as string) + 'T00:00').getTime()) / 86400000)
      : null
    return { patient: rest as Patient, lastSessionDate: last_session_date as string | null, daysSince: days }
  })
}

/**
 * UPSERT : insère le patient s'il n'existe pas, le remplace sinon (même id).
 * Utilisé par l'import de sauvegarde — préserve les timestamps d'origine.
 */
export function upsertPatient(patient: Patient): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO patients
      (id, first_name, last_name, birth_date, phone, email, address,
       notes_general, alerts, regular_doctor, medications, antecedents,
       profession, is_active, consent_given, consent_date, created_at, updated_at)
    VALUES
      (@id, @first_name, @last_name, @birth_date, @phone, @email, @address,
       @notes_general, @alerts, @regular_doctor, @medications, @antecedents,
       @profession, @is_active, @consent_given, @consent_date, @created_at, @updated_at)
  `).run({ consent_given: 0, consent_date: null, ...patient, is_active: patient.is_active ?? 1 })
}
