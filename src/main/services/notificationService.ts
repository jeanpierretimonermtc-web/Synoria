/**
 * Notifications desktop natives (Windows + Mac)
 * - Rappels J-1 : liste les RDV du lendemain au démarrage
 * - Rappel 15 min : alerte juste avant un RDV (géré dans index.ts)
 */
import { Notification, app } from 'electron'
import { join }              from 'path'
import * as auth             from './authService'

const iconPath = process.platform === 'darwin'
  ? join(__dirname, '../../../build/icons/icon.png')
  : join(__dirname, '../../../build/icons/icon.ico')

/** Affiche une notification des RDV du lendemain — appelée au login */
export function checkJ1Reminders(): void {
  if (!auth.isKeyLoaded()) return
  try {
    // Import dynamique pour éviter les dépendances circulaires
    // (les repos ne sont disponibles qu'après initDatabase)
    const { getAllAppointments } = require('../database/repositories/appointmentRepository')
    const { getPatientById }    = require('../database/repositories/patientRepository')

    const now      = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const tStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`

    const appts = (getAllAppointments() as any[]).filter((a: any) =>
      a.date === tStr && !a.is_done && !a.is_cancelled && !a.reminder_sent && a.patient_id
    )
    if (appts.length === 0) return

    const lines = appts.slice(0, 5).map((a: any) => {
      try {
        const p = getPatientById(a.patient_id) as any
        return p ? `${p.first_name} ${p.last_name} · ${a.heure_debut}` : `RDV · ${a.heure_debut}`
      } catch { return `RDV · ${a.heure_debut}` }
    })
    if (appts.length > 5) lines.push(`…et ${appts.length - 5} autre(s)`)

    const notif = new Notification({
      title:  `📅 Synoria — ${appts.length} RDV demain`,
      body:   lines.join('\n'),
      icon:   iconPath,
    })
    notif.show()
  } catch (e) {
    console.error('[Notif J-1]', e)
  }
}

/** Notification immédiate — RDV dans moins de 15 min */
const notifiedIds = new Set<string>()
export function checkUpcomingAppointments(): void {
  if (!auth.isKeyLoaded()) return
  try {
    const { getAppointmentsByDate } = require('../database/repositories/appointmentRepository')
    const { getPatientById }        = require('../database/repositories/patientRepository')
    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    const appts = getAppointmentsByDate(today) as any[]
    for (const appt of appts) {
      if (appt.is_done || appt.is_cancelled || notifiedIds.has(appt.id)) continue
      const [h, m]   = (appt.heure_debut as string).split(':').map(Number)
      const apptTime = new Date(now); apptTime.setHours(h, m, 0, 0)
      const diffMin  = (apptTime.getTime() - now.getTime()) / 60000
      if (diffMin > 0 && diffMin <= 15) {
        notifiedIds.add(appt.id)
        let name = 'Patient'
        if (appt.patient_id) {
          try { const p = getPatientById(appt.patient_id) as any; if (p) name = `${p.first_name} ${p.last_name}` } catch {}
        } else if (appt.guest_first_name) {
          name = `${appt.guest_first_name} ${appt.guest_last_name ?? ''}`.trim()
        }
        new Notification({
          title: `Synoria — RDV dans ${Math.round(diffMin)} min`,
          body:  `${name} à ${appt.heure_debut}${appt.note ? ' · ' + appt.note : ''}`,
          icon:  iconPath,
        }).show()
      }
    }
  } catch { /* DB pas encore ouverte */ }
}
