import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'
import type { Session, DashboardStats, RecentSession, UpcomingSession } from '../../../shared/types'

const SESSION_FIELDS = `
  id, patient_id, date, practitioner, motif, evolution_tags, evolution, problematiques,
  langue, pouls, constitution, type_corps, teint, observation,
  diagnostic_mtc, cinq_elements, causes, analyse, principes,
  points, pts_oreille, techniques, plantes, reactions, traitement_notes,
  conseils, plan, surveiller,
  energy_tests_json, systemes_json, full_data_json,
  next_session_date,
  created_at, updated_at
`

export function getAllSessions(patientId?: string): Session[] {
  if (patientId) {
    return getDb().prepare(`SELECT ${SESSION_FIELDS} FROM sessions WHERE patient_id = ? ORDER BY date DESC`)
      .all(patientId) as Session[]
  }
  return getDb().prepare(`SELECT ${SESSION_FIELDS} FROM sessions ORDER BY date DESC`).all() as Session[]
}

export function getSessionById(id: string): Session | null {
  return (getDb().prepare(`SELECT ${SESSION_FIELDS} FROM sessions WHERE id = ?`).get(id) as Session) ?? null
}

export function createSession(data: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Session {
  const id = uuidv4()
  const now = new Date().toISOString()
  const session: Session = { ...data, id, created_at: now, updated_at: now }
  insertSession(session)
  return session
}

function insertSession(session: Session): void {
  getDb().prepare(`
    INSERT INTO sessions (
      id, patient_id, date, practitioner, motif, evolution_tags, evolution, problematiques,
      langue, pouls, constitution, type_corps, teint, observation,
      diagnostic_mtc, cinq_elements, causes, analyse, principes,
      points, pts_oreille, techniques, plantes, reactions, traitement_notes,
      conseils, plan, surveiller,
      energy_tests_json, systemes_json, full_data_json,
      next_session_date,
      created_at, updated_at
    ) VALUES (
      @id, @patient_id, @date, @practitioner, @motif, @evolution_tags, @evolution, @problematiques,
      @langue, @pouls, @constitution, @type_corps, @teint, @observation,
      @diagnostic_mtc, @cinq_elements, @causes, @analyse, @principes,
      @points, @pts_oreille, @techniques, @plantes, @reactions, @traitement_notes,
      @conseils, @plan, @surveiller,
      @energy_tests_json, @systemes_json, @full_data_json,
      @next_session_date,
      @created_at, @updated_at
    )
  `).run(session)
}

export function updateSession(id: string, data: Partial<Session>): Session {
  const now = new Date().toISOString()
  const existing = getSessionById(id)
  if (!existing) throw new Error(`Session ${id} not found`)
  const updated: Session = { ...existing, ...data, id, updated_at: now }
  getDb().prepare(`
    UPDATE sessions SET
      patient_id=@patient_id, date=@date, practitioner=@practitioner,
      motif=@motif, evolution_tags=@evolution_tags, evolution=@evolution,
      problematiques=@problematiques, langue=@langue, pouls=@pouls,
      constitution=@constitution, type_corps=@type_corps, teint=@teint, observation=@observation,
      diagnostic_mtc=@diagnostic_mtc, cinq_elements=@cinq_elements, causes=@causes,
      analyse=@analyse, principes=@principes, points=@points, pts_oreille=@pts_oreille,
      techniques=@techniques, plantes=@plantes, reactions=@reactions, traitement_notes=@traitement_notes,
      conseils=@conseils, plan=@plan, surveiller=@surveiller,
      energy_tests_json=@energy_tests_json, systemes_json=@systemes_json, full_data_json=@full_data_json,
      next_session_date=@next_session_date,
      updated_at=@updated_at
    WHERE id=@id
  `).run(updated)
  return updated
}

export function deleteSession(id: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

/**
 * UPSERT : insère la séance si elle n'existe pas, la remplace sinon (même id).
 * Utilisé par l'import de sauvegarde — préserve les timestamps d'origine.
 */
export function upsertSession(session: Session): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO sessions (
      id, patient_id, date, practitioner, motif, evolution_tags, evolution, problematiques,
      langue, pouls, constitution, type_corps, teint, observation,
      diagnostic_mtc, cinq_elements, causes, analyse, principes,
      points, pts_oreille, techniques, plantes, reactions, traitement_notes,
      conseils, plan, surveiller,
      energy_tests_json, systemes_json, full_data_json,
      next_session_date,
      created_at, updated_at
    ) VALUES (
      @id, @patient_id, @date, @practitioner, @motif, @evolution_tags, @evolution, @problematiques,
      @langue, @pouls, @constitution, @type_corps, @teint, @observation,
      @diagnostic_mtc, @cinq_elements, @causes, @analyse, @principes,
      @points, @pts_oreille, @techniques, @plantes, @reactions, @traitement_notes,
      @conseils, @plan, @surveiller,
      @energy_tests_json, @systemes_json, @full_data_json,
      @next_session_date,
      @created_at, @updated_at
    )
  `).run(session)
}

export function getUpcomingSessions(): UpcomingSession[] {
  // Date locale (pas UTC) pour éviter le décalage de fuseau horaire
  const now   = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  return getDb().prepare(`
    SELECT s.id AS session_id, s.patient_id, s.next_session_date, s.motif,
           p.first_name, p.last_name
    FROM sessions s
    LEFT JOIN patients p ON p.id = s.patient_id
    WHERE s.next_session_date >= ?
    ORDER BY s.next_session_date ASC
    LIMIT 20
  `).all(today) as UpcomingSession[]
}

export function duplicateSession(id: string): Session {
  const original = getSessionById(id)
  if (!original) throw new Error(`Session ${id} not found`)
  const newId = uuidv4()
  const now = new Date().toISOString()
  const duplicate: Session = {
    ...original,
    id: newId,
    date: new Date().toISOString().slice(0, 10),
    created_at: now,
    updated_at: now,
  }
  insertSession(duplicate)
  return duplicate
}

export function getSessionsByMonth(year: number, month: number): Session[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`SELECT ${SESSION_FIELDS} FROM sessions WHERE date LIKE ? ORDER BY date DESC`)
    .all(`${prefix}%`) as Session[]
}

export function getDashboardStats(): DashboardStats {
  const db = getDb()
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const total_patients = (db.prepare('SELECT COUNT(*) as n FROM patients').get() as { n: number }).n
  const total_sessions = (db.prepare('SELECT COUNT(*) as n FROM sessions').get() as { n: number }).n
  const sessions_this_month = (db.prepare("SELECT COUNT(*) as n FROM sessions WHERE date LIKE ?").get(`${prefix}%`) as { n: number }).n
  const active_patients = (db.prepare('SELECT COUNT(DISTINCT patient_id) as n FROM sessions').get() as { n: number }).n

  const recent_sessions = db.prepare(`
    SELECT s.id, s.patient_id, s.date, s.motif, s.diagnostic_mtc, s.evolution_tags,
           p.first_name, p.last_name
    FROM sessions s
    LEFT JOIN patients p ON p.id = s.patient_id
    ORDER BY s.date DESC LIMIT 8
  `).all() as RecentSession[]

  return { total_patients, total_sessions, sessions_this_month, active_patients, recent_sessions }
}
