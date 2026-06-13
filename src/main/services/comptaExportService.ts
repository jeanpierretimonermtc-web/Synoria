/**
 * Export Excel comptabilité — 4 feuilles
 *   1. COMPTABILITÉ   — vue générale revenus / dépenses / URSAF / résultats (existante)
 *   2. DÉPENSES        — charges fixes par mois + dépenses variables détaillées
 *   3. FACTURES        — liste triée par date avec AutoFilter (mois, nom, n° facture)
 *   4. CA PAR MOIS     — résumé mensuel CA brut / dépenses / URSAF / CA net
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
  bgAlt:  'EEF2F8',
  muted:  '9B9590',
  border: 'DDD8CF',
  amber:  'C17B2A',
  red:    'A83232',
  rowEven:'F4F7FB',
}

// ── Primitives ────────────────────────────────────────────────────

function s(style: 'thin' | 'medium', color = C.border) {
  return { style, color: { rgb: color } }
}
const border = { top: s('thin'), bottom: s('thin'), left: s('thin'), right: s('thin') }

function cell(v: string | number, style: Record<string, unknown> = {}) {
  return { v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s: style }
}

function hdr(label: string, bg = C.navy, color = C.white, wrap = true) {
  return cell(label, {
    font: { bold: true, sz: 10, color: { rgb: color } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: wrap },
    border: { top: s('thin', bg), bottom: s('thin', bg), left: s('thin', bg), right: s('thin', bg) },
  })
}

function labelCell(v: string, indent = 0, bold = false, bg = C.white) {
  return cell(v, {
    font: { sz: 9, bold, color: { rgb: C.navy } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', indent },
    border,
  })
}

function numCell(v: number, isCurrency = false, bold = false, bg = C.white) {
  return {
    v, t: 'n',
    z: isCurrency ? '#,##0.00 "€"' : '0',
    s: {
      font: { sz: 9, bold, color: { rgb: v < 0 ? C.red : C.navy } },
      fill: { fgColor: { rgb: bg }, patternType: 'solid' },
      alignment: { horizontal: 'right' },
      border,
    },
  }
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

function rateCell(v: number, bg = C.white) {
  return {
    v, t: 'n', z: '0.0%',
    s: {
      font: { sz: 9, bold: true, color: { rgb: C.teal } },
      fill: { fgColor: { rgb: bg }, patternType: 'solid' },
      alignment: { horizontal: 'center' },
      border,
    },
  }
}

function emptyRow(cols: number) {
  return Array(cols).fill(cell(''))
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS3 = MONTHS.map(m => m.slice(0, 3).toUpperCase())

// ── Données partagées (calculées une fois) ───────────────────────

function buildComptaData(year: number) {
  const types    = getConsultationTypes().filter(t => t.is_active)
  const revenues = getMonthlyRevenue(year)
  const ursafs   = getUrsafRates(year)
  const fixedExp = getExpenseConfig()
  const varExp   = getMonthlyVarExpenses(year)

  const getNb = (m: number, tid: string) =>
    revenues.find(r => r.month === m && r.type_id === tid)?.nb_seances ?? 0

  const getRate = (m: number) =>
    ursafs.find(u => u.month === m)?.rate ?? 0.256

  const fixedForMonth = (m: number) => fixedExp.reduce((s, e) => {
    if (e.months && !e.months.split(',').map(Number).includes(m)) return s
    return s + (e.is_shared ? e.monthly_amount / 2 : e.monthly_amount)
  }, 0)

  const varCats    = ['publicite', 'logiciel', 'dasri']
  const varLabels: Record<string, string> = { publicite: 'Publicité', logiciel: 'Logiciel', dasri: 'DASRI' }
  const getVarCat  = (m: number, cat: string) =>
    varExp.find(v => v.month === m && v.category === cat)?.amount ?? 0
  const getVarTotal = (m: number) =>
    varExp.filter(v => v.month === m).reduce((s, v) => s + v.amount, 0)

  const caForMonth = (m: number) => types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
  const nbForMonth = (m: number) => types.reduce((s, t) => s + getNb(m, t.id), 0)

  return { types, revenues, ursafs, fixedExp, varExp, varCats, varLabels, getNb, getRate, fixedForMonth, getVarCat, getVarTotal, caForMonth, nbForMonth }
}

// ── Feuille 1 : COMPTABILITÉ (vue générale) ───────────────────────

function buildComptaSheet(year: number) {
  const d = buildComptaData(year)
  const { types, getNb, getRate, fixedForMonth, getVarCat, varCats, varLabels } = d

  const ws_data: unknown[][] = []
  let ri = 0

  // Titre
  ws_data.push([
    cell(`COMPTABILITÉ ${year}`, {
      font: { bold: true, sz: 14, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.navy }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    ...Array(26).fill(cell('', { fill: { fgColor: { rgb: C.navy }, patternType: 'solid' } }))
  ]); ri++

  // En-têtes colonnes
  ws_data.push([
    hdr('TYPE / DÉSIGNATION', C.teal),
    hdr('TARIF', C.teal),
    ...MONTHS3.flatMap(m => [hdr(`NB\n${m}`, C.teal), hdr(`REV\n${m}`, C.teal)]),
  ]); ri++

  // Revenus par type
  for (const t of types) {
    const row: unknown[] = [labelCell(t.name, 1), numCell(t.price, true)]
    for (let m = 1; m <= 12; m++) {
      const nb = getNb(m, t.id)
      row.push(numCell(nb), numCell(nb * t.price, true))
    }
    ws_data.push(row); ri++
  }

  // Total revenus
  const totRevRow: unknown[] = [labelCell('TOTAL REVENUS', 0, true, C.bg), cell('')]
  for (let m = 1; m <= 12; m++) {
    totRevRow.push(
      numCell(types.reduce((s, t) => s + getNb(m, t.id), 0), false, true),
      totalCell(types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0), C.green)
    )
  }
  ws_data.push(totRevRow); ri++

  ws_data.push(emptyRow(26)); ri++

  // Dépenses
  ws_data.push([hdr('DÉPENSES', C.amber, C.white), ...Array(25).fill(hdr('', C.amber))]); ri++

  for (const exp of d.fixedExp) {
    const expRow: unknown[] = [labelCell(exp.label), cell('')]
    for (let m = 1; m <= 12; m++) {
      const active = !exp.months || exp.months.split(',').map(Number).includes(m)
      const val    = active ? (exp.is_shared ? exp.monthly_amount / 2 : exp.monthly_amount) : 0
      expRow.push(cell(''), numCell(val, true))
    }
    ws_data.push(expRow); ri++
  }

  for (const cat of varCats) {
    const vRow: unknown[] = [labelCell(varLabels[cat]), cell('')]
    for (let m = 1; m <= 12; m++) vRow.push(cell(''), numCell(getVarCat(m, cat), true))
    ws_data.push(vRow); ri++
  }

  const totDepRow: unknown[] = [labelCell('TOTAL DÉPENSES', 0, true, C.bg), cell('')]
  for (let m = 1; m <= 12; m++) {
    totDepRow.push(cell(''), totalCell(fixedForMonth(m) + d.getVarTotal(m), C.amber))
  }
  ws_data.push(totDepRow); ri++

  ws_data.push(emptyRow(26)); ri++

  // URSAF
  ws_data.push([hdr('URSAF', C.teal, C.white), ...Array(25).fill(hdr('', C.teal))]); ri++

  const rateRow: unknown[] = [labelCell('Taux URSAF'), cell('')]
  for (let m = 1; m <= 12; m++) rateRow.push(cell(''), rateCell(getRate(m)))
  ws_data.push(rateRow); ri++

  const coutRow: unknown[] = [labelCell('Coût URSAF'), cell('')]
  for (let m = 1; m <= 12; m++) {
    const rev = types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0)
    coutRow.push(cell(''), numCell(rev * getRate(m), true))
  }
  ws_data.push(coutRow); ri++

  ws_data.push(emptyRow(26)); ri++

  // Résultats
  ws_data.push([hdr('RÉSULTATS', C.navy, C.white), ...Array(25).fill(hdr('', C.navy))]); ri++

  const resultRows = [
    { label: 'CA BRUT',             fn: (m: number) => types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0), bg: C.teal },
    { label: 'CA NET (hors URSAF)', fn: (m: number) => types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0) - fixedForMonth(m) - d.getVarTotal(m), bg: C.teal },
    { label: 'CA NET (après URSAF)',fn: (m: number) => { const ca = types.reduce((s, t) => s + getNb(m, t.id) * t.price, 0); return ca - fixedForMonth(m) - d.getVarTotal(m) - ca * getRate(m) }, bg: C.navy },
  ]
  for (const { label, fn, bg } of resultRows) {
    const r: unknown[] = [labelCell(label, 0, true, C.bg), cell('')]
    for (let m = 1; m <= 12; m++) r.push(cell(''), totalCell(fn(m), bg))
    ws_data.push(r); ri++
  }

  ws_data.push(emptyRow(26)); ri++
  ws_data.push([hdr('TOTAUX ANNUELS', C.navy, C.white), ...Array(25).fill(hdr('', C.navy))]); ri++

  const annualRows = [
    { label: 'CA BRUT ANNUEL',                fn: () => Array.from({length:12},(_,i) => types.reduce((s,t)=>s+getNb(i+1,t.id)*t.price,0)).reduce((a,b)=>a+b,0) },
    { label: 'CA NET ANNUEL (hors URSAF)',     fn: () => Array.from({length:12},(_,i) => types.reduce((s,t)=>s+getNb(i+1,t.id)*t.price,0) - fixedForMonth(i+1) - d.getVarTotal(i+1)).reduce((a,b)=>a+b,0) },
    { label: 'CA NET ANNUEL (après URSAF)',    fn: () => Array.from({length:12},(_,i) => { const ca=types.reduce((s,t)=>s+getNb(i+1,t.id)*t.price,0); return ca-fixedForMonth(i+1)-d.getVarTotal(i+1)-ca*getRate(i+1) }).reduce((a,b)=>a+b,0) },
  ]
  for (const { label, fn } of annualRows) {
    ws_data.push([labelCell(label, 0, true, C.bg), totalCell(fn(), C.navy), ...Array(24).fill(cell(''))])
    ri++
  }

  const ws = XLSX.utils.aoa_to_sheet(ws_data)
  ws['!cols'] = [{ wch: 28 }, { wch: 8 }, ...Array(24).fill({ wch: 7 })]
  ws['!rows'] = ws_data.map((rowData, i) => {
    if (i === 0) return { hpx: 28 }
    if (i === 1) return { hpx: 30 }
    const v = (rowData[0] as any)?.v
    const text = v ? String(v) : ''
    const lines = text.split('\n').reduce((n, s) => n + Math.max(1, Math.ceil((s.length || 1) / 27)), 0)
    return { hpx: Math.max(20, lines * 16) }
  })
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 25 } }]
  return ws
}

// ── Feuille 2 : DÉPENSES ──────────────────────────────────────────

function buildDepensesSheet(year: number) {
  const fixedExp = getExpenseConfig()
  const varExp   = getMonthlyVarExpenses(year)
  const rows: unknown[][] = []

  // ─ Charges fixes
  rows.push([hdr(`CHARGES FIXES — ${year}`, C.amber), ...Array(14).fill(hdr('', C.amber))])
  rows.push([
    hdr('DÉSIGNATION', C.navy), hdr('MONTANT\nMENSUEL', C.navy), hdr('PARTAGÉ', C.navy),
    hdr('MOIS\nACTIFS', C.navy),
    ...MONTHS3.map(m => hdr(m, C.navy)),
    hdr('TOTAL\nANNUEL', C.gold),
  ])

  let totalAnnuelFixe = 0
  for (const exp of fixedExp) {
    const montantEff = exp.is_shared ? exp.monthly_amount / 2 : exp.monthly_amount
    const moisActifs = exp.months ? exp.months.split(',').map(Number) : Array.from({length:12},(_,i)=>i+1)
    const totalAnn   = moisActifs.reduce((s, m) => s + montantEff, 0)
    totalAnnuelFixe += totalAnn
    const row: unknown[] = [
      labelCell(exp.label, 0, true),
      numCell(exp.monthly_amount, true),
      labelCell(exp.is_shared ? 'Oui (÷2)' : 'Non', 0, false, exp.is_shared ? C.rowEven : C.white),
      labelCell(moisActifs.length === 12 ? 'Tous' : moisActifs.map(m => MONTHS3[m-1]).join(', ')),
    ]
    for (let m = 1; m <= 12; m++) {
      const active = moisActifs.includes(m)
      row.push(active ? numCell(montantEff, true) : cell('—', { font: { sz: 9, color: { rgb: C.muted } }, fill: { fgColor: { rgb: C.rowEven }, patternType: 'solid' }, alignment: { horizontal: 'center' }, border }))
    }
    row.push(totalCell(totalAnn, C.amber))
    rows.push(row)
  }

  // Total charges fixes
  const totFixeRow: unknown[] = [labelCell('TOTAL CHARGES FIXES', 0, true, C.bg), cell(''), cell(''), cell('')]
  for (let m = 1; m <= 12; m++) {
    const total = fixedExp.reduce((s, e) => {
      const active = !e.months || e.months.split(',').map(Number).includes(m)
      return s + (active ? (e.is_shared ? e.monthly_amount / 2 : e.monthly_amount) : 0)
    }, 0)
    totFixeRow.push(totalCell(total, C.amber))
  }
  totFixeRow.push(totalCell(totalAnnuelFixe, C.amber))
  rows.push(totFixeRow)

  rows.push(emptyRow(16))

  // ─ Dépenses variables
  rows.push([hdr(`DÉPENSES VARIABLES — ${year}`, C.teal), ...Array(3).fill(hdr('', C.teal))])
  rows.push([hdr('MOIS', C.navy), hdr('CATÉGORIE', C.navy), hdr('LIBELLÉ', C.navy), hdr('MONTANT', C.navy)])

  const sorted = [...varExp].sort((a, b) => a.month - b.month || a.category.localeCompare(b.category))
  let totalVar = 0
  for (let idx = 0; idx < sorted.length; idx++) {
    const v   = sorted[idx]
    const bg  = idx % 2 === 0 ? C.white : C.rowEven
    totalVar += v.amount
    rows.push([
      labelCell(MONTHS[v.month - 1], 0, false, bg),
      labelCell(v.category, 0, false, bg),
      labelCell(v.label, 0, false, bg),
      numCell(v.amount, true, false, bg),
    ])
  }

  if (sorted.length === 0) {
    rows.push([cell('Aucune dépense variable enregistrée', { font: { sz: 9, color: { rgb: C.muted }, italic: true }, fill: { fgColor: { rgb: C.white }, patternType: 'solid' }, alignment: { horizontal: 'left' }, border }), cell(''), cell(''), cell('')])
  }

  rows.push([labelCell('TOTAL DÉPENSES VARIABLES', 0, true, C.bg), cell(''), cell(''), totalCell(totalVar, C.teal)])

  rows.push(emptyRow(4))

  // ─ Récap total dépenses
  rows.push([
    labelCell('TOTAL DÉPENSES (fixes + variables)', 0, true, C.bg),
    cell(''), cell(''),
    totalCell(totalAnnuelFixe + totalVar, C.navy),
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, ...Array(12).fill({ wch: 9 }), { wch: 12 }]
  ws['!rows'] = rows.map((rowData, i) => {
    if (i === 0 || i === 1) return { hpx: 30 }
    const v = (rowData[0] as any)?.v
    const text = v ? String(v) : ''
    const lines = text.split('\n').reduce((n, s) => n + Math.max(1, Math.ceil((s.length || 1) / 25)), 0)
    return { hpx: Math.max(20, lines * 16) }
  })

  // AutoFilter sur les dépenses variables (header row)
  const varHdrRowIdx = rows.findIndex((r: any) => r[0]?.v === 'MOIS')
  if (varHdrRowIdx >= 0) {
    ws['!autofilter'] = { ref: `A${varHdrRowIdx + 1}:D${varHdrRowIdx + 1}` }
  }

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
  ]
  return ws
}

// ── Feuille 3 : FACTURES (avec AutoFilter) ────────────────────────

function buildFacturesSheet(year: number) {
  const invoices = [...getInvoicesLog(year)].sort((a, b) =>
    new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
  )
  const rows: unknown[][] = []

  // Titre
  rows.push([hdr(`FACTURES ${year}`, C.navy), ...Array(8).fill(hdr('', C.navy))])

  // En-têtes avec AutoFilter
  rows.push([
    hdr('MOIS', C.teal), hdr('N° FACTURE', C.teal), hdr('DATE ÉMISSION', C.teal),
    hdr('NOM', C.teal), hdr('PRÉNOM', C.teal), hdr('DÉSIGNATION', C.teal),
    hdr('DATE SÉANCE', C.teal), hdr('EMAIL', C.teal), hdr('MONTANT', C.teal),
  ])

  let total = 0
  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx]
    const d   = new Date(inv.invoice_date)
    const bg  = idx % 2 === 0 ? C.white : C.rowEven
    const moisStr  = !isNaN(d.getTime()) ? MONTHS[d.getMonth()] : ''
    const dateStr  = !isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR') : inv.invoice_date
    const sd       = inv.session_date ? new Date(inv.session_date) : null
    const sessStr  = sd && !isNaN(sd.getTime()) ? sd.toLocaleDateString('fr-FR') : ''
    total += inv.montant
    rows.push([
      labelCell(moisStr, 0, false, bg),
      labelCell(inv.invoice_number, 0, true, bg),
      labelCell(dateStr, 0, false, bg),
      labelCell(inv.patient_last_name.toUpperCase(), 0, true, bg),
      labelCell(inv.patient_first_name, 0, false, bg),
      cell(inv.description || '', {
        font: { sz: 9, color: { rgb: C.navy } },
        fill: { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { horizontal: 'left', wrapText: true, vertical: 'top' },
        border,
      }),
      labelCell(sessStr, 0, false, bg),
      labelCell(inv.email || '', 0, false, bg),
      numCell(inv.montant, true, false, bg),
    ])
  }

  if (invoices.length === 0) {
    rows.push([cell('Aucune facture pour cette période', { font: { sz: 9, color: { rgb: C.muted }, italic: true }, fill: { fgColor: { rgb: C.white }, patternType: 'solid' }, alignment: { horizontal: 'left' }, border }), ...Array(8).fill(cell(''))])
  }

  rows.push([
    labelCell('TOTAL', 0, true, C.bg), ...Array(7).fill(cell('')),
    totalCell(total, C.navy),
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 38 }, { wch: 12 }, { wch: 26 }, { wch: 12 }]
  ws['!rows'] = rows.map((rowData, i) => {
    if (i === 0) return { hpx: 28 }
    if (i === 1) return { hpx: 30 }
    const v = (rowData[5] as any)?.v
    const text = v ? String(v) : ''
    const lines = text.split('\n').reduce((n, s) => n + Math.max(1, Math.ceil((s.length || 1) / 36)), 0)
    return { hpx: Math.max(20, lines * 16) }
  })
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }]
  // AutoFilter sur la ligne d'en-têtes (row index 1)
  ws['!autofilter'] = { ref: 'A2:I2' }
  return ws
}

// ── Feuille 4 : CA PAR MOIS ───────────────────────────────────────

function buildCaParMoisSheet(year: number) {
  const d  = buildComptaData(year)
  const { types, getNb, getRate, fixedForMonth, getVarTotal, caForMonth, nbForMonth } = d
  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const rows: unknown[][] = []

  // Titre
  rows.push([hdr(`RÉSUMÉ CA PAR MOIS — ${year}`, C.navy), ...Array(8).fill(hdr('', C.navy))])

  // En-têtes
  rows.push([
    hdr('MOIS', C.teal),
    hdr('NB\nSÉANCES', C.teal),
    hdr('CA BRUT', C.teal),
    hdr('CHARGES\nFIXES', C.amber),
    hdr('DÉPENSES\nVAR.', C.amber),
    hdr('TOTAL\nDÉPENSES', C.amber),
    hdr('TAUX\nURSAF', C.teal),
    hdr('COÛT\nURSAF', C.teal),
    hdr('CA NET', C.green),
  ])

  let annNb = 0, annCA = 0, annFixed = 0, annVar = 0, annUrsaf = 0, annNet = 0

  for (let m = 1; m <= 12; m++) {
    const isCurrentMonth = year === currentYear && m === currentMonth
    const bg  = isCurrentMonth ? 'E8F5E9' : m % 2 === 0 ? C.rowEven : C.white
    const nb  = nbForMonth(m)
    const ca  = caForMonth(m)
    const fix = fixedForMonth(m)
    const vari = getVarTotal(m)
    const dep  = fix + vari
    const rate = getRate(m)
    const urs  = ca * rate
    const net  = ca - dep - urs

    annNb += nb; annCA += ca; annFixed += fix; annVar += vari; annUrsaf += urs; annNet += net

    const netStyle = {
      v: net, t: 'n', z: '#,##0.00 "€"',
      s: {
        font: { sz: 9, bold: true, color: { rgb: net >= 0 ? C.green : C.red } },
        fill: { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { horizontal: 'right' },
        border,
      },
    }

    rows.push([
      cell(MONTHS[m - 1], {
        font: { bold: isCurrentMonth, sz: 10, color: { rgb: C.navy } },
        fill: { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { horizontal: 'left' }, border,
      }),
      numCell(nb, false, isCurrentMonth, bg),
      numCell(ca, true, isCurrentMonth, bg),
      numCell(fix, true, false, bg),
      numCell(vari, true, false, bg),
      numCell(dep, true, false, bg),
      rateCell(rate, bg),
      numCell(urs, true, false, bg),
      netStyle,
    ])
  }

  rows.push(emptyRow(9))

  // Totaux annuels
  rows.push([
    cell('TOTAL ANNUEL', {
      font: { bold: true, sz: 11, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.navy }, patternType: 'solid' },
      alignment: { horizontal: 'center' }, border,
    }),
    { v: annNb, t: 'n', z: '0', s: { font: { bold: true, sz: 10, color: { rgb: C.white } }, fill: { fgColor: { rgb: C.navy }, patternType: 'solid' }, alignment: { horizontal: 'center' }, border } },
    totalCell(annCA, C.teal),
    totalCell(annFixed, C.amber),
    totalCell(annVar, C.amber),
    totalCell(annFixed + annVar, C.amber),
    cell('', { fill: { fgColor: { rgb: C.bg }, patternType: 'solid' }, border }),
    totalCell(annUrsaf, C.teal),
    totalCell(annNet, annNet >= 0 ? C.green : C.red),
  ])

  rows.push(emptyRow(9))

  // Légende
  rows.push([
    cell('ℹ️  CA NET = CA Brut − Total Dépenses − Coût URSAF', {
      font: { sz: 9, italic: true, color: { rgb: C.muted } },
      fill: { fgColor: { rgb: C.bg }, patternType: 'solid' },
      alignment: { horizontal: 'left' },
    }),
    ...Array(8).fill(cell('', { fill: { fgColor: { rgb: C.bg }, patternType: 'solid' } }))
  ])
  rows.push([
    cell(`★  Mois en cours mis en évidence (fond vert clair)`, {
      font: { sz: 9, italic: true, color: { rgb: C.muted } },
      fill: { fgColor: { rgb: C.bg }, patternType: 'solid' },
      alignment: { horizontal: 'left' },
    }),
    ...Array(8).fill(cell('', { fill: { fgColor: { rgb: C.bg }, patternType: 'solid' } }))
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 10 }, { wch: 13 }, { wch: 14 }]
  ws['!rows'] = [{ hpx: 28 }, { hpx: 36 }, ...Array(12).fill({ hpx: 22 }), { hpx: 8 }, { hpx: 24 }, { hpx: 8 }, { hpx: 16 }, { hpx: 16 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }]
  return ws
}

// ── Export principal ──────────────────────────────────────────────

export function exportComptaExcel(year: number): string {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildComptaSheet(year),      'COMPTABILITÉ')
  XLSX.utils.book_append_sheet(wb, buildDepensesSheet(year),    'DÉPENSES')
  XLSX.utils.book_append_sheet(wb, buildFacturesSheet(year),    'FACTURES')
  XLSX.utils.book_append_sheet(wb, buildCaParMoisSheet(year),   'CA PAR MOIS')

  const settings = getSettings() as any
  const dir = (settings.invoicePath as string) || ''
  if (!dir) throw new Error('Aucun dossier de destination configuré. Définissez-le dans Paramètres > Facturation.')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `Comptabilité_${year}.xlsx`)

  const buf: Buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  writeFileSync(filePath, buf)
  return filePath
}
