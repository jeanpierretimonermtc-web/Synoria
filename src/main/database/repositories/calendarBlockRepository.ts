import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'
import type { CalendarBlock } from '../../../shared/types'

export function getAllBlocks(): CalendarBlock[] {
  return getDb().prepare('SELECT * FROM calendar_blocks ORDER BY date, heure_debut').all() as CalendarBlock[]
}

export function getBlocksByMonth(year: number, month: number): CalendarBlock[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getDb()
    .prepare("SELECT * FROM calendar_blocks WHERE date LIKE ? ORDER BY date, heure_debut")
    .all(`${prefix}%`) as CalendarBlock[]
}

export function createBlock(data: Omit<CalendarBlock, 'id' | 'created_at' | 'updated_at'>): CalendarBlock {
  const now = new Date().toISOString()
  const id  = uuidv4()
  getDb().prepare(`
    INSERT INTO calendar_blocks (id, date, is_day, heure_debut, heure_fin, motif, created_at, updated_at)
    VALUES (@id, @date, @is_day, @heure_debut, @heure_fin, @motif, @created_at, @updated_at)
  `).run({ id, ...data, created_at: now, updated_at: now })
  return getDb().prepare('SELECT * FROM calendar_blocks WHERE id = ?').get(id) as CalendarBlock
}

export function updateBlock(id: string, data: Partial<Omit<CalendarBlock, 'id' | 'created_at' | 'updated_at'>>): void {
  const now = new Date().toISOString()
  getDb().prepare(`
    UPDATE calendar_blocks
    SET date = COALESCE(@date, date),
        is_day = COALESCE(@is_day, is_day),
        heure_debut = @heure_debut,
        heure_fin   = @heure_fin,
        motif       = @motif,
        updated_at  = @updated_at
    WHERE id = @id
  `).run({ id, date: data.date ?? null, is_day: data.is_day ?? null, heure_debut: data.heure_debut ?? null, heure_fin: data.heure_fin ?? null, motif: data.motif ?? null, updated_at: now })
}

export function deleteBlock(id: string): void {
  getDb().prepare('DELETE FROM calendar_blocks WHERE id = ?').run(id)
}
