import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'
import type { SessionTemplate } from '../../../shared/types'

export function getAllTemplates(): SessionTemplate[] {
  return getDb().prepare('SELECT * FROM session_templates ORDER BY name').all() as SessionTemplate[]
}

export function saveTemplate(name: string, description: string, dataJson: string): SessionTemplate {
  const id  = uuidv4()
  const now = new Date().toISOString()
  const t: SessionTemplate = { id, name, description, data_json: dataJson, created_at: now, updated_at: now }
  getDb().prepare(`
    INSERT INTO session_templates (id, name, description, data_json, created_at, updated_at)
    VALUES (@id, @name, @description, @data_json, @created_at, @updated_at)
  `).run(t)
  return t
}

export function deleteTemplate(id: string): void {
  getDb().prepare('DELETE FROM session_templates WHERE id = ?').run(id)
}
