import { getDb } from '../connection'
import { randomUUID } from 'crypto'
import type {
  ConsultationType, MonthlyRevenue, UrsafRate,
  ExpenseConfig, MonthlyVarExpense, InvoiceLog,
} from '../../../shared/types'

// ── Consultation types ─────────────────────────────────────────────

export function getConsultationTypes(): ConsultationType[] {
  return getDb().prepare(
    'SELECT * FROM consultation_types ORDER BY sort_order, name'
  ).all() as ConsultationType[]
}

export function saveConsultationTypes(types: ConsultationType[]): void {
  const db   = getDb()
  const upsert = db.prepare(`
    INSERT INTO consultation_types (id, name, price, is_active, sort_order)
    VALUES (@id, @name, @price, @is_active, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      price = excluded.price,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order
  `)
  const deleteOld = db.prepare('DELETE FROM consultation_types WHERE id = ?')
  const existing  = (db.prepare('SELECT id FROM consultation_types').all() as {id:string}[])
    .map(r => r.id)
  const newIds    = types.map(t => t.id)
  const toDelete  = existing.filter(id => !newIds.includes(id))

  const run = db.transaction(() => {
    for (const id of toDelete) deleteOld.run(id)
    types.forEach((t, i) => upsert.run({ ...t, sort_order: i }))
  })
  run()
}

// ── Monthly revenue ────────────────────────────────────────────────

export function getMonthlyRevenue(year: number): MonthlyRevenue[] {
  return getDb().prepare(
    'SELECT * FROM monthly_revenue WHERE year = ?'
  ).all(year) as MonthlyRevenue[]
}

export function setMonthlyRevenue(
  year: number, month: number, typeId: string, nbSeances: number
): void {
  getDb().prepare(`
    INSERT INTO monthly_revenue (year, month, type_id, nb_seances)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(year, month, type_id) DO UPDATE SET nb_seances = excluded.nb_seances
  `).run(year, month, typeId, nbSeances)
}

// ── URSAF rates ────────────────────────────────────────────────────

export function getUrsafRates(year: number): UrsafRate[] {
  return getDb().prepare(
    'SELECT * FROM ursaf_rates WHERE year = ?'
  ).all(year) as UrsafRate[]
}

export function setUrsafRate(year: number, month: number, rate: number): void {
  getDb().prepare(`
    INSERT INTO ursaf_rates (year, month, rate)
    VALUES (?, ?, ?)
    ON CONFLICT(year, month) DO UPDATE SET rate = excluded.rate
  `).run(year, month, rate)
}

// ── Expense config (charges fixes) ────────────────────────────────

export function getExpenseConfig(): ExpenseConfig[] {
  return getDb().prepare(
    'SELECT * FROM expense_config ORDER BY sort_order'
  ).all() as ExpenseConfig[]
}

export function saveExpenseConfig(configs: ExpenseConfig[]): void {
  const db     = getDb()
  const upsert = db.prepare(`
    INSERT INTO expense_config (id, category, label, monthly_amount, is_shared, sort_order, months)
    VALUES (@id, @category, @label, @monthly_amount, @is_shared, @sort_order, @months)
    ON CONFLICT(id) DO UPDATE SET
      label          = excluded.label,
      monthly_amount = excluded.monthly_amount,
      is_shared      = excluded.is_shared,
      sort_order     = excluded.sort_order,
      months         = excluded.months
  `)
  const del = db.prepare('DELETE FROM expense_config WHERE id = ?')
  const currentIds = (db.prepare('SELECT id FROM expense_config').all() as { id: string }[]).map(r => r.id)
  const newIds = configs.map(c => c.id)
  const run = db.transaction(() => {
    // Supprimer les charges supprimées
    currentIds.filter(id => !newIds.includes(id)).forEach(id => del.run(id))
    // Upsert les charges actives
    configs.forEach((c, i) => upsert.run({ months: null, ...c, sort_order: i }))
  })
  run()
}

// ── Monthly variable expenses ──────────────────────────────────────

export function getMonthlyVarExpenses(year: number): MonthlyVarExpense[] {
  return getDb().prepare(
    'SELECT * FROM monthly_var_expenses WHERE year = ?'
  ).all(year) as MonthlyVarExpense[]
}

export function setMonthlyVarExpense(
  year: number, month: number, category: string, label: string, amount: number
): void {
  getDb().prepare(`
    INSERT INTO monthly_var_expenses (year, month, category, label, amount)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year, month, category) DO UPDATE SET
      label  = excluded.label,
      amount = excluded.amount
  `).run(year, month, category, label, amount)
}

// ── Invoices log ───────────────────────────────────────────────────

export function getInvoicesLog(year?: number): InvoiceLog[] {
  if (year) {
    return getDb().prepare(
      "SELECT * FROM invoices_log WHERE strftime('%Y', invoice_date) = ? ORDER BY invoice_date DESC"
    ).all(String(year)) as InvoiceLog[]
  }
  return getDb().prepare(
    'SELECT * FROM invoices_log ORDER BY invoice_date DESC'
  ).all() as InvoiceLog[]
}

export function addInvoiceLog(inv: Omit<InvoiceLog, 'id' | 'created_at'>): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO invoices_log
      (id, invoice_number, invoice_date, patient_first_name, patient_last_name,
       patient_address, email, phone, session_date, description, montant, file_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    inv.invoice_number, inv.invoice_date,
    inv.patient_first_name, inv.patient_last_name,
    inv.patient_address || null, inv.email || null, inv.phone || null,
    inv.session_date || null, inv.description || null,
    inv.montant, inv.file_path || null,
    new Date().toISOString()
  )
}

export function updateInvoiceLog(id: string, data: Partial<Omit<InvoiceLog, 'id' | 'created_at'>>): void {
  getDb().prepare(`
    UPDATE invoices_log SET
      invoice_number = COALESCE(?, invoice_number),
      invoice_date   = COALESCE(?, invoice_date),
      patient_first_name = COALESCE(?, patient_first_name),
      patient_last_name  = COALESCE(?, patient_last_name),
      patient_address    = ?,
      email              = ?,
      phone              = ?,
      session_date       = ?,
      description        = ?,
      montant            = COALESCE(?, montant)
    WHERE id = ?
  `).run(
    data.invoice_number    ?? null,
    data.invoice_date      ?? null,
    data.patient_first_name ?? null,
    data.patient_last_name  ?? null,
    data.patient_address   ?? null,
    data.email             ?? null,
    data.phone             ?? null,
    data.session_date      ?? null,
    data.description       ?? null,
    data.montant           ?? null,
    id
  )
}

export function deleteInvoiceLog(id: string): void {
  getDb().prepare('DELETE FROM invoices_log WHERE id = ?').run(id)
}

export function getInvoiceLogById(id: string): InvoiceLog | null {
  return getDb().prepare('SELECT * FROM invoices_log WHERE id = ?').get(id) as InvoiceLog | null
}

// ── Années disponibles ─────────────────────────────────────────────

export function getComptaYears(): number[] {
  const rows = getDb().prepare(
    "SELECT DISTINCT strftime('%Y', invoice_date) as y FROM invoices_log ORDER BY y DESC"
  ).all() as { y: string }[]
  const fromInv = rows.map(r => Number(r.y)).filter(Boolean)
  const fromRev = (getDb().prepare(
    'SELECT DISTINCT year FROM monthly_revenue ORDER BY year DESC'
  ).all() as { year: number }[]).map(r => r.year)
  const years = [...new Set([...fromInv, ...fromRev, new Date().getFullYear()])]
  return years.sort((a, b) => b - a)
}
