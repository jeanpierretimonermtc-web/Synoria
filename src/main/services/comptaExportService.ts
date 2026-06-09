/**
 * Export Excel comptabilité — 3 feuilles (même structure que le .xlsm de l'utilisateur)
 *   1. COMPTABILITÉ  — tableau revenus / dépenses / URSAF
 *   2. DÉTAILS DÉPENSES — config des charges fixes
 *   3. FACTURES — liste des factures générées
 */

import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import {
  getConsultationTypes, getMonthlyRevenue, getUrsafRates,
  getExpenseConfig, getMonthlyVarExpenses, getInvoicesLog,
} from '../database/repositories/comptaRepository'
import { getSettings } from './settingsService'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx-js-style') as typeof import('xlsx-js-style')

// ── Palette ───────────────────────────────────────────────────────
const C = {
  navy:   '1A3A6B',
  teal:   '2A7FA8',
  gold:   'C4973A',
  green:  '4A6741',
  white:  'FFFFFF',
  bg:     'F9F7F4',
  muted:  '9B9590',
  border: 'DDD8CF',
  amber:  'C17B2A',
  red:    'A83232',
}

function cell(v: string | number, s: Record<string, unknown> = {}) {
  return { v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s }
}

function hdr(label: string, bg = C.navy, color = C.white) {
  return cell(label, {
    font: { bold: true, sz: 10, color: { rgb: color } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { top: s('thin', C.border), bottom: s('thin', C.border), left: s('thin', C.border), right: s('thin', C.border) },
  })
}

function s(style: 'thin' | 'medium', color = C.border) {
  return { style, color: { rgb: color } }
}

function numCell(v: number, isCurrency = false, bold = false) {
  return {
    v, t: 'n',
    z: isCurrency ? '#,##0.00 "€"' : '0',
    s: {
      font: { sz: 9, bold, color: { rgb: v < 0 ? C.red : C.navy } },
      fill: { fgColor: { rgb: C.white }, patternType: 'solid' },
      alignment: { horizontal: 'right' },
      border: { top: s('thin'), bottom: s('thin'), left: s('thin'), right: s('thin') },
    },
  }
}

function labelCell(v: string, indent = 0, bold = false, bg = C.white) {
  return cell(v, {
    font: { sz: 9, bold, color: { rgb: C.navy } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', indent },
    border: { top: s('thin'), bottom: s('thin'), left: s('thin'), right: s('thin') },
  })
}

function totalCell(v: number, bg = C.navy) {
  return {
    v, t: 'n', z: '#,##0.00 "€"',
    s: {
      font: { sz: 10, bold: true, color: { rgb: C.white } },
      fill: { fgColor: { rgb: bg }, patternType: 'solid' },
      alignment: { horizontal: 'right' },
      border: { top: s('medium', bg), bottom: s('medium', bg), left: s('thin', bg), right: s('thin', bg) },
    },
  }
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ── Feuille 1 : COMPTABILITÉ ──────────────────────────────────────

function buildComptaSheet(year: number) {
  const types    = getConsultationTypes().filter(t => t.is_active)
  const revenues = getMonthlyRevenue(year)
  const ursafs   = getUrsafRates(year)
  const fixedExp = getExpenseConfig()
  const varExp   = getMonthlyVarExpenses(year)

  // Helper : nb séances pour (month, typeId)
  const getNb = (m: number, tid: string) =>
    revenues.find(r => r.month === m && r.type_id === tid)?.nb_seances ?? 0

  // URSAF rate pour le mois (défaut 24.6%)
  const getRate = (m: number) =>
    ursafs.find(u => u.month === m)?.rate ?? 0.246

  // Charges fixes effectives pour un mois donné (tient compte du champ months)
  const fixedTotalForMonth = (m: number) => fixedExp.reduce((s, e) => {
    if (e.months) {
      const active = e.months.split(',').map(Number)
      if (!active.includes(m)) return s
    }
    return s + (e.is_shared ? e.monthly_amount / 2 : e.monthly_amount)
  }, 0)
  // Total fixe du mois courant pour l'affichage d'en-tête
  const fixedTotal = fixedTotalForMonth(new Date().getMonth() + 1)

  // Variable expense for (month, category)
  const getVar = (m: number, cat: string) =>
    varExp.find(v => v.month === m && v.category === cat)?.amount ?? 0

  const varCats = ['publicite', 'logiciel', 'dasri']
  const varLabels: Record<string, string> = { publicite: 'Publicité', logiciel: 'Logiciel', dasri: 'DASRI' }

  const ws_data: unknown[][] = []
  let ri = 0

  // ── Titre ──
  const titleRow = [
    cell(`COMPTABILITÉ ${year}`, {
      font: { bold: true, sz: 14, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.navy }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    ...Array(26).fill(cell('', { fill: { fgColor: { rgb: C.navy }, patternType: 'solid' } }))
  ]
  ws_data.push(titleRow); ri++

  // ── Sous-titre colonnes ──
  const subHdr = [
    hdr('TYPE CONSULTATION', C.teal),
    hdr('TARIF', C.teal),
    ...MONTHS.flatMap(m => [hdr(`NB\n${m.slice(0,3).toUpperCase()}`, C.teal), hdr(`REV\n${m.slice(0,3).toUpperCase()}`, C.teal)]),
  ]
  ws_data.push(subHdr); ri++

  // ── Lignes revenus ──
  const revenueStartRi = ri
  for (const t of types) {
    const row: unknown[] = [
      labelCell(t.name, 1),
      numCell(t.price, true),
    ]
    for (let m = 1; m <= 12; m++) {
      const nb  = getNb(m, t.id)
      const rev = nb * t.price
      row.push(numCell(nb), numCell(rev, true))
    }
    ws_data.push(row); ri++
  }

  // ── Total revenus ──
  const totRevRow: unknown[] = [labelCell('TOTAL REVENUS', 0, true, C.bg), cell('')]
  for (let m = 1; m <= 12; m++) {
    const totalNb  = types.reduce((s, t) => s + getNb(m, t.id), 0)
    const totalRev = types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
    totRevRow.push(numCell(totalNb, false, true), totalCell(totalRev, C.green))
  }
  ws_data.push(totRevRow); ri++

  // ── Séparation ──
  ws_data.push(Array(26).fill(cell(''))); ri++

  // ── Dépenses titre ──
  ws_data.push([hdr('DÉPENSES', C.amber, C.white), ...Array(25).fill(hdr('', C.amber))]); ri++

  // Charges fixes — une ligne par charge, montant variable selon les mois actifs
  for (const exp of fixedExp) {
    const expRow: unknown[] = [labelCell(exp.label), cell('')]
    for (let m = 1; m <= 12; m++) {
      const active = !exp.months || exp.months.split(',').map(Number).includes(m)
      const val    = active ? (exp.is_shared ? exp.monthly_amount / 2 : exp.monthly_amount) : 0
      expRow.push(cell(''), numCell(val, true))
    }
    ws_data.push(expRow); ri++
  }

  // Variable expenses
  for (const cat of varCats) {
    const vRow: unknown[] = [labelCell(varLabels[cat]), cell('')]
    for (let m = 1; m <= 12; m++) {
      vRow.push(cell(''), numCell(getVar(m, cat), true))
    }
    ws_data.push(vRow); ri++
  }

  // Total dépenses (charges fixes filtrées par mois + variables)
  const totDepRow: unknown[] = [labelCell('TOTAL DÉPENSES', 0, true, C.bg), cell('')]
  for (let m = 1; m <= 12; m++) {
    const total = fixedTotalForMonth(m) + varCats.reduce((s, c) => s + getVar(m, c), 0)
    totDepRow.push(cell(''), totalCell(total, C.amber))
  }
  ws_data.push(totDepRow); ri++

  // ── Séparation ──
  ws_data.push(Array(26).fill(cell(''))); ri++

  // ── URSAF ──
  ws_data.push([hdr('URSAF', C.teal, C.white), ...Array(25).fill(hdr('', C.teal))]); ri++

  const rateRow: unknown[] = [labelCell('Taux URSAF'), cell('')]
  for (let m = 1; m <= 12; m++) {
    rateRow.push(cell(''), {
      v: getRate(m), t: 'n', z: '0.0%',
      s: { font: { sz: 9, bold: true, color: { rgb: C.teal } }, fill: { fgColor: { rgb: C.white }, patternType: 'solid' }, alignment: { horizontal: 'center' } },
    })
  }
  ws_data.push(rateRow); ri++

  const coutRow: unknown[] = [labelCell('Coût URSAF'), cell('')]
  for (let m = 1; m <= 12; m++) {
    const rev  = types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
    const cout = rev * getRate(m)
    coutRow.push(cell(''), numCell(cout, true))
  }
  ws_data.push(coutRow); ri++

  // ── Séparation ──
  ws_data.push(Array(26).fill(cell(''))); ri++

  // ── Résultats ──
  ws_data.push([hdr('RÉSULTATS', C.navy, C.white), ...Array(25).fill(hdr('', C.navy))]); ri++

  const caRows = [
    { label: 'CA BRUT', fn: (m: number) => types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0), bg: C.teal },
    { label: 'CA NET (hors URSAF)', fn: (m: number) => {
      const rev  = types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
      const dep  = fixedTotalForMonth(m) + varCats.reduce((s, c) => s + getVar(m, c), 0)
      return rev - dep
    }, bg: C.teal },
    { label: 'CA NET (après URSAF)', fn: (m: number) => {
      const rev  = types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
      const dep  = fixedTotalForMonth(m) + varCats.reduce((s, c) => s + getVar(m, c), 0)
      const urs  = rev * getRate(m)
      return rev - dep - urs
    }, bg: C.navy },
  ]

  for (const { label, fn, bg } of caRows) {
    const r: unknown[] = [labelCell(label, 0, true, C.bg), cell('')]
    for (let m = 1; m <= 12; m++) r.push(cell(''), totalCell(fn(m), bg))
    ws_data.push(r); ri++
  }

  // ── Totaux annuels ──
  ws_data.push(Array(26).fill(cell(''))); ri++
  ws_data.push([hdr('TOTAUX ANNUELS', C.navy, C.white), ...Array(25).fill(hdr('', C.navy))]); ri++

  const annualRows = [
    { label: 'CA BRUT ANNUEL', fn: () => types.reduce((s, t) => s + Array.from({length:12}, (_,i) => getNb(i+1, t.id) * t.price).reduce((a,b)=>a+b,0), 0) },
    { label: 'CA NET ANNUEL (hors URSAF)', fn: () => Array.from({length:12}, (_,i) => {
      const rev = types.reduce((s,t) => s + getNb(i+1, t.id) * t.price, 0)
      const dep = fixedTotalForMonth(i+1) + varCats.reduce((s,c) => s + getVar(i+1, c), 0)
      return rev - dep
    }).reduce((a,b)=>a+b,0) },
    { label: 'CA NET ANNUEL (après URSAF)', fn: () => Array.from({length:12}, (_,i) => {
      const rev = types.reduce((s,t) => s + getNb(i+1, t.id) * t.price, 0)
      const dep = fixedTotalForMonth(i+1) + varCats.reduce((s,c) => s + getVar(i+1, c), 0)
      return rev - dep - rev * getRate(i+1)
    }).reduce((a,b)=>a+b,0) },
  ]

  for (const { label, fn } of annualRows) {
    ws_data.push([
      labelCell(label, 0, true, C.bg),
      totalCell(fn(), C.navy),
      ...Array(24).fill(cell('')),
    ])
    ri++
  }

  // Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(ws_data)
  ws['!cols'] = [{ wch: 28 }, { wch: 8 }, ...Array(24).fill({ wch: 7 })]
  ws['!rows'] = ws_data.map((_, i) => ({ hpx: i === 0 ? 28 : i === 1 ? 30 : 18 }))

  // Merge titre
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 25 } }]

  return ws
}

// ── Feuille 2 : DÉTAILS DÉPENSES ─────────────────────────────────

function buildDepensesSheet() {
  const configs = getExpenseConfig()
  const rows: unknown[][] = []

  rows.push([hdr('DÉTAILS DÉPENSES', C.navy), ...Array(3).fill(hdr('', C.navy))])
  rows.push([labelCell('Désignation', 0, true), labelCell('Montant mensuel', 0, true), labelCell('Partagé ?', 0, true), labelCell('Montant effectif', 0, true)])

  for (const c of configs) {
    const eff = c.is_shared ? c.monthly_amount / 2 : c.monthly_amount
    rows.push([
      labelCell(c.label),
      numCell(c.monthly_amount, true),
      cell(c.is_shared ? 'Oui (÷2)' : 'Non'),
      numCell(eff, true),
    ])
  }

  const total = configs.reduce((s, c) => s + (c.is_shared ? c.monthly_amount / 2 : c.monthly_amount), 0)
  rows.push([labelCell('TOTAL MENSUEL', 0, true, C.bg), totalCell(total, C.navy), cell(''), totalCell(total, C.navy)])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 16 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]
  return ws
}

// ── Feuille 3 : FACTURES ─────────────────────────────────────────

function buildFacturesSheet(year: number) {
  const invoices = getInvoicesLog(year)
  const rows: unknown[][] = []

  rows.push([hdr(`FACTURES ${year}`, C.navy), ...Array(6).fill(hdr('', C.navy))])
  rows.push([
    hdr('N° FACTURE', C.teal), hdr('DATE', C.teal), hdr('NOM', C.teal),
    hdr('PRÉNOM', C.teal), hdr('ADRESSE', C.teal), hdr('EMAIL', C.teal),
    hdr('TÉLÉPHONE', C.teal), hdr('MONTANT', C.teal),
  ])

  for (const inv of invoices) {
    const d = new Date(inv.invoice_date)
    const dateStr = isNaN(d.getTime()) ? inv.invoice_date : d.toLocaleDateString('fr-FR')
    rows.push([
      labelCell(inv.invoice_number),
      labelCell(dateStr),
      labelCell(inv.patient_last_name.toUpperCase()),
      labelCell(inv.patient_first_name),
      labelCell(inv.patient_address || ''),
      labelCell(inv.email || ''),
      labelCell(inv.phone || ''),
      numCell(inv.montant, true),
    ])
  }

  // Total
  const total = invoices.reduce((s, i) => s + i.montant, 0)
  rows.push([
    labelCell('TOTAL', 0, true, C.bg), ...Array(6).fill(cell('')),
    totalCell(total, C.navy),
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 36 }, { wch: 28 }, { wch: 14 }, { wch: 12 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]
  return ws
}

// ── Export principal ──────────────────────────────────────────────

export function exportComptaExcel(year: number): string {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildComptaSheet(year),   'COMPTABILITÉ')
  XLSX.utils.book_append_sheet(wb, buildDepensesSheet(),      'DÉTAILS DÉPENSES')
  XLSX.utils.book_append_sheet(wb, buildFacturesSheet(year),  'FACTURES')

  const settings = getSettings() as any
  const dir = settings.invoicePath ||
    'C:\\Users\\timjp\\Desktop\\Entreprise\\Cabinet\\Comptabilité\\Facture 2026'
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `Comptabilité_${year}.xlsx`)

  const buf: Buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  writeFileSync(filePath, buf)
  return filePath
}
