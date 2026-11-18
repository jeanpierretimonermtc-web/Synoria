/**
 * Import de patients depuis un fichier CSV/Excel.
 *
 * Deux temps :
 *   1. parseImportFile()  — lit le fichier, renvoie en-têtes + lignes brutes.
 *   2. importPatients()   — à partir des lignes + de l'association de colonnes
 *      choisie par l'utilisateur, crée les patients (dédoublonnés sur
 *      prénom+nom+date de naissance) et, pour chaque ligne contenant des
 *      informations de séance, une séance en mode simple, triée par ordre
 *      chronologique. Toute colonne non associée est ajoutée telle quelle
 *      dans l'anamnèse de la séance (rien n'est perdu silencieusement).
 */

import { readFileSync, writeFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { getDb } from '../database/connection'
import * as patientRepo from '../database/repositories/patientRepository'
import * as sessionRepo from '../database/repositories/sessionRepository'
import type {
  ImportParsedFile, PatientImportMapping, PatientImportResult, PatientImportFieldKey,
} from '../../shared/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSXStyle = require('xlsx-js-style') as typeof import('xlsx-js-style')

// Parseur CSV dédié (texte brut, aucune détection de type) : SheetJS reformate
// automatiquement les colonnes "qui ressemblent à des dates" en format
// américain M/D/YY lors de la lecture d'un .csv, ce qui est ambigu (siècle
// perdu) et casse le tri chronologique. Un CSV n'a pas de types de cellules —
// on le lit donc nous-mêmes, telle quelle, colonne par colonne.
function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ','

  const table: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field); field = ''
    } else if (c === '\r') {
      // ignoré — géré par \n
    } else if (c === '\n') {
      row.push(field); field = ''
      table.push(row); row = []
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); table.push(row) }

  const nonEmpty = table.filter(r => r.some(c => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map(h => h.trim())
  const rows = nonEmpty.slice(1).map(r => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim() })
    return obj
  })
  return { headers, rows }
}

// Excel « CSV (séparateur : point-virgule) » sous Windows en France écrit le
// fichier en Windows-1252/ANSI, pas en UTF-8 — les accents seraient corrompus
// si on décodait toujours en UTF-8. On détecte : BOM UTF-8 explicite → UTF-8 ;
// sinon on décode en UTF-8 et on vérifie l'absence de caractère de remplacement
// U+FFFD (signe d'octets invalides en UTF-8) ; sinon on retombe sur Latin-1,
// identique à Windows-1252 sur la plage des lettres accentuées françaises.
function decodeCsvBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.subarray(3).toString('utf8')
  }
  const asUtf8 = buf.toString('utf8')
  if (!asUtf8.includes('�')) return asUtf8
  return buf.toString('latin1')
}

export function parseImportFile(filePath: string): ImportParsedFile {
  if (filePath.toLowerCase().endsWith('.csv')) {
    const text = decodeCsvBuffer(readFileSync(filePath)).replace(/^﻿/, '')
    const { headers, rows } = parseCsvText(text)
    return { headers, rows, rowCount: rows.length }
  }

  // .xlsx / .xls : dateNF force un format ISO non ambigu pour les vraies
  // cellules de type date (contrairement au CSV, un fichier Excel connaît
  // le type réel de chaque cellule).
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' }) as Record<string, string>[]
  const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] | undefined
  const headers = headerRow ?? (rows.length > 0 ? Object.keys(rows[0]) : [])
  return { headers, rows, rowCount: rows.length }
}

function norm(s: string | undefined | null): string {
  return (s ?? '').trim().toLowerCase()
}

// Vérifie que jour/mois/année forment une date calendaire réelle (rejette
// 31/02/2020, 32/01/2020, etc.) plutôt que de réarranger les chiffres à l'aveugle.
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

// Accepte AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA et les dates Excel déjà résolues en texte.
function parseDateLoose(v: string | undefined | null): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [yyyy, mm, dd] = s.slice(0, 10).split('-').map(Number)
    return isRealCalendarDate(yyyy, mm, dd) ? s.slice(0, 10) : null
  }
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (m) {
    const [, ddStr, mmStr, yyyyStr] = m
    const dd = Number(ddStr), mm = Number(mmStr), yyyy = Number(yyyyStr)
    if (!isRealCalendarDate(yyyy, mm, dd)) return null
    return `${yyyy}-${mmStr.padStart(2, '0')}-${ddStr.padStart(2, '0')}`
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function importPatients(
  rows: Record<string, string>[],
  mapping: PatientImportMapping,
): PatientImportResult {
  const result: PatientImportResult = {
    patientsCreated: 0, sessionsCreated: 0, duplicatesSkipped: 0,
    missingSessionDate: 0, nameConflicts: [], errors: [],
  }

  const { patientFields, sessionFields } = mapping
  const fnCol = patientFields.first_name
  const lnCol = patientFields.last_name
  if (!fnCol || !lnCol) {
    result.errors.push({ row: 0, message: 'Colonnes Prénom et Nom obligatoires pour l\'import.' })
    return result
  }
  const birthCol = patientFields.birth_date

  // Dédoublonnage : prénom + nom + date de naissance (normalisés)
  const existing = patientRepo.getAllPatients()
  const existingKey = (fn: string, ln: string, bd: string) => `${norm(fn)}|${norm(ln)}|${norm(bd)}`
  const existingSet = new Set(existing.map(p => existingKey(p.first_name, p.last_name, p.birth_date ?? '')))

  // Regroupe les lignes par patient (une ligne = une visite possible)
  interface RowEntry { row: Record<string, string>; idx: number }
  const groups = new Map<string, { identity: Record<string, string>; birthDate: string; rows: RowEntry[] }>()
  const nameOnlyToKeys = new Map<string, Set<string>>()

  rows.forEach((row, idx) => {
    const firstName = (row[fnCol] ?? '').trim()
    const lastName  = (row[lnCol] ?? '').trim()
    if (!firstName || !lastName) {
      result.errors.push({ row: idx + 2, message: 'Prénom ou nom manquant — ligne ignorée.' })
      return
    }
    const birthDate = birthCol ? (parseDateLoose(row[birthCol]) ?? '') : ''
    const key = existingKey(firstName, lastName, birthDate)

    const nameKey = `${norm(firstName)}|${norm(lastName)}`
    if (!nameOnlyToKeys.has(nameKey)) nameOnlyToKeys.set(nameKey, new Set())
    nameOnlyToKeys.get(nameKey)!.add(key)

    if (!groups.has(key)) groups.set(key, { identity: row, birthDate, rows: [] })
    groups.get(key)!.rows.push({ row, idx })
  })

  // Signale les mêmes nom/prénom avec des dates de naissance différentes (à vérifier manuellement)
  for (const [nameKey, keys] of nameOnlyToKeys) {
    if (keys.size > 1) {
      const [firstName, lastName] = nameKey.split('|')
      result.nameConflicts.push({
        name: `${firstName} ${lastName}`,
        detail: `${keys.size} fiches distinctes détectées (dates de naissance différentes) — vérifiez qu'il ne s'agit pas de la même personne.`,
      })
    }
  }

  // Sans date de naissance pour distinguer les homonymes, plusieurs lignes du
  // même nom sont fusionnées en un seul nouveau patient (plusieurs visites
  // d'une même personne). Si leurs coordonnées (téléphone/email/adresse)
  // diffèrent, c'est un signal que ce sont peut-être deux personnes
  // distinctes — on prévient plutôt que de fusionner en silence.
  if (!birthCol) {
    const phoneCol = patientFields.phone
    const emailCol = patientFields.email
    const addressCol = patientFields.address
    for (const group of groups.values()) {
      if (group.rows.length < 2) continue
      const distinctValues = (col: string | undefined) => new Set(
        group.rows.map(({ row }) => col ? norm(row[col]) : '').filter(Boolean),
      )
      if (distinctValues(phoneCol).size > 1 || distinctValues(emailCol).size > 1 || distinctValues(addressCol).size > 1) {
        result.nameConflicts.push({
          name: `${group.identity[fnCol]} ${group.identity[lnCol]}`,
          detail: `${group.rows.length} lignes regroupées sous ce nom sans date de naissance pour les distinguer, avec des coordonnées différentes (téléphone/email/adresse) — vérifiez qu'il ne s'agit pas de deux personnes distinctes avant de valider l'import.`,
        })
      }
    }
  }

  const patientColSet = new Set(
    (Object.keys(patientFields) as PatientImportFieldKey[])
      .map(k => patientFields[k])
      .filter((c): c is string => !!c),
  )
  const dateCol  = sessionFields.session_date
  const motifCol = sessionFields.motif
  const noteCol  = sessionFields.anamnese
  const sessionColSet = new Set([dateCol, motifCol, noteCol].filter((c): c is string => !!c))
  const mappedCols = new Set([...patientColSet, ...sessionColSet])

  // Une seule transaction pour tout l'import : plus rapide (un seul commit
  // disque au lieu d'un par ligne) et atomique — si l'appli est interrompue
  // en cours d'import, rien n'est écrit plutôt qu'un import à moitié fait.
  const runImport = getDb().transaction(() => {
  for (const [key, group] of groups) {
    if (existingSet.has(key)) {
      result.duplicatesSkipped++
      continue
    }

    const identity = group.identity
    const getP = (f: PatientImportFieldKey): string | undefined => {
      const col = patientFields[f]
      const v = col ? (identity[col] ?? '').trim() : ''
      return v || undefined
    }

    let patientId: string
    try {
      const patient = patientRepo.createPatient({
        first_name:     getP('first_name')!,
        last_name:      getP('last_name')!,
        birth_date:     group.birthDate || undefined,
        phone:          getP('phone'),
        email:          getP('email'),
        address:        getP('address'),
        notes_general:  getP('notes_general'),
        antecedents:    getP('antecedents'),
        medications:    getP('medications'),
        regular_doctor: getP('regular_doctor'),
      })
      patientId = patient.id
      result.patientsCreated++
      existingSet.add(key)
    } catch (e) {
      result.errors.push({ row: group.rows[0].idx + 2, message: `Échec création patient : ${(e as Error).message}` })
      continue
    }

    // Construit les séances (mode simple) à partir des lignes du groupe
    const sessionRows = group.rows
      .map(({ row, idx }) => {
        const date = dateCol ? parseDateLoose(row[dateCol]) : null
        const motif = motifCol ? (row[motifCol] ?? '').trim() : ''
        const note = noteCol ? (row[noteCol] ?? '').trim() : ''
        const leftover = Object.entries(row)
          .filter(([col, v]) => !mappedCols.has(col) && String(v ?? '').trim() !== '')
          .map(([col, v]) => `${col} : ${v}`)
          .join('\n')
        const fullNote = [note, leftover].filter(Boolean).join('\n\n')
        const hasSessionData = !!(date || motif || fullNote.trim())
        return { idx, date, motif, note: fullNote, hasSessionData }
      })
      .filter(r => r.hasSessionData)
      .sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date)
        if (a.date) return -1
        if (b.date) return 1
        return a.idx - b.idx
      })

    sessionRows.forEach((s, i) => {
      if (!s.date) result.missingSessionDate++
      try {
        sessionRepo.createSession({
          patient_id: patientId,
          date: s.date ?? new Date().toISOString().slice(0, 10),
          motif: s.motif || undefined,
          full_data_json: JSON.stringify({
            sessionNum: i + 1,
            anamnese: s.note || undefined,
            importedFromFile: true,
          }),
        })
        result.sessionsCreated++
      } catch (e) {
        result.errors.push({ row: s.idx + 2, message: `Échec création séance : ${(e as Error).message}` })
      }
    })
  }
  })

  runImport()
  return result
}

// ── Modèle Excel téléchargeable (mise en forme xlsx-js-style) ─────────────
// En-têtes volontairement identiques aux synonymes reconnus par la modal
// d'import (ImportPatientsModal.tsx) pour que l'association de colonnes
// soit pré-remplie automatiquement si l'utilisateur réimporte ce modèle
// une fois rempli.

const TPL = {
  navy:   '1A3A6B',
  teal:   '2A7FA8',
  green:  '4A6741',
  gold:   'C4973A',
  amber:  'C17B2A',
  amberLight: 'FDF2E3',
  greenLight: 'EAF1E6',
  white:  'FFFFFF',
  bg:     'F9F7F4',
  rowEven:'F4F7FB',
  muted:  '6B6459',
  border: 'DDD8CF',
}

function tplBorderSide(color = TPL.border) {
  return { style: 'thin', color: { rgb: color } }
}
const tplBorder = { top: tplBorderSide(), bottom: tplBorderSide(), left: tplBorderSide(), right: tplBorderSide() }

function tplCell(v: string | number, style: Record<string, unknown> = {}) {
  return { v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s: style }
}

// Bandeau plein largeur (titre de page)
function tplTitle(v: string, bg = TPL.navy) {
  return tplCell(v, {
    font: { bold: true, sz: 15, color: { rgb: TPL.white } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center' },
  })
}

// Bandeau secondaire (sous-titre / avertissement)
function tplBanner(v: string, bg: string, color = TPL.white) {
  return tplCell(v, {
    font: { bold: true, sz: 11, color: { rgb: color } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true, indent: 1 },
  })
}

// En-tête de colonne (groupe coloré)
function tplHeader(v: string, bg: string) {
  return tplCell(v, {
    font: { bold: true, sz: 10, color: { rgb: TPL.white } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { top: tplBorderSide(bg), bottom: tplBorderSide(bg), left: tplBorderSide(TPL.white), right: tplBorderSide(TPL.white) },
  })
}

function tplData(v: string, bgRow: string, bold = false) {
  return tplCell(v, {
    font: { sz: 10, bold, color: { rgb: '2A2A28' } },
    fill: { fgColor: { rgb: bgRow }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: tplBorder,
  })
}

function tplEmptyRow(cols: number, bg = TPL.bg) {
  return Array(cols).fill(tplCell('', { fill: { fgColor: { rgb: bg }, patternType: 'solid' } }))
}

export function writeImportTemplate(filePath: string): void {
  // 10 champs patient (teal) + 3 champs séance (vert) + 1 colonne libre d'exemple (or)
  const patientHeaders = ['Prénom', 'Nom', 'Date de naissance', 'Téléphone', 'Email', 'Adresse', 'Notes', 'Antécédents', 'Médicaments', 'Médecin traitant']
  const sessionHeaders = ['Date de séance', 'Motif', 'Anamnèse']
  const freeHeaders    = ['Commentaire interne']
  const allHeaders     = [...patientHeaders, ...sessionHeaders, ...freeHeaders]
  const nCols = allHeaders.length

  const exampleRows = [
    ['Marie', 'Dupont', '1985-03-12', '0601020304', 'marie.dupont@example.fr', '12 rue des Lilas, 75011 Paris',
      'Patiente stressée, sportive', 'Aucun antécédent notable', 'Aucun', 'Dr Martin',
      '2025-05-02', 'Bilan initial', 'Première séance, anamnèse complète, tensions cervicales', 'Vue via recommandation'],
    ['Marie', 'Dupont', '1985-03-12', '0601020304', 'marie.dupont@example.fr', '12 rue des Lilas, 75011 Paris',
      '', '', '', '', '2025-06-10', 'Suivi', 'Nette amélioration, poursuite du traitement', ''],
    ['Jean', 'Petit', '1978-11-02', '0611223344', '', '',
      '', 'Diabète type 2', 'Metformine', 'Dr Bernard', '', '', '', ''],
  ]

  const colWidths = allHeaders.map(h => Math.max(16, h.length + 4))

  // Estime le nombre de lignes affichées une fois le retour à la ligne automatique
  // appliqué, pour calculer une hauteur de ligne suffisante (sinon le texte est
  // visuellement tronqué même si la donnée est bien présente dans la cellule).
  function estimateLines(text: unknown, colChars: number): number {
    const s = String(text ?? '')
    if (!s) return 1
    return s.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil((line.length || 1) / Math.max(8, colChars))), 0)
  }

  const ws_data: unknown[][] = []

  // Titre
  ws_data.push([tplTitle('MODÈLE D’IMPORT — PATIENTS SYNORIA'), ...Array(nCols - 1).fill(tplCell('', { fill: { fgColor: { rgb: TPL.navy }, patternType: 'solid' } }))])
  // Avertissement
  ws_data.push([tplBanner('⚠️  Remplacez les lignes d’exemple ci-dessous par vos données, puis importez ce fichier depuis Patients → Importer dans Synoria.', TPL.amber), ...Array(nCols - 1).fill(tplCell('', { fill: { fgColor: { rgb: TPL.amber }, patternType: 'solid' } }))])

  // Légende couleurs — vraies cellules remplies (fill), pas des emoji carrés
  // colorés : ceux-ci s'affichent souvent en noir et blanc selon la police
  // système d'Excel/LibreOffice, donc invisibles comme indicateur de couleur.
  const legendSwatch = (bg: string) => tplCell('', { fill: { fgColor: { rgb: bg }, patternType: 'solid' }, border: { top: tplBorderSide(TPL.bg), bottom: tplBorderSide(TPL.bg), left: tplBorderSide(TPL.bg), right: tplBorderSide(TPL.bg) } })
  const legendLabel = (v: string) => tplCell(v, {
    font: { bold: true, sz: 10.5, color: { rgb: '4A4136' } },
    fill: { fgColor: { rgb: TPL.bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center' },
  })
  const legendFiller = () => tplCell('', { fill: { fgColor: { rgb: TPL.bg }, patternType: 'solid' } })
  // Chaque étiquette est FUSIONNÉE sur plusieurs colonnes (et non laissée à
  // déborder visuellement) : Excel ne laisse pas le texte déborder dans une
  // cellule voisine dès que celle-ci a son propre remplissage, même de la
  // même couleur — le texte serait sinon coupé à la bordure de la cellule.
  const LEGEND_ROW_IDX = 2  // titre(0), avertissement(1), légende(2)
  const legendRow = [
    legendSwatch(TPL.teal),  legendLabel('Champs patient'),                           legendFiller(), legendFiller(),
    legendSwatch(TPL.green), legendLabel('Champs séance (optionnels)'),                legendFiller(), legendFiller(), legendFiller(),
    legendSwatch(TPL.gold),  legendLabel('Exemple de colonne libre (conservée auto.)'), legendFiller(), legendFiller(), legendFiller(),
  ]
  while (legendRow.length < nCols) legendRow.push(legendFiller())
  ws_data.push(legendRow.slice(0, nCols))

  // Espaceur
  ws_data.push(tplEmptyRow(nCols))

  // En-têtes de colonnes, groupées par couleur
  ws_data.push([
    ...patientHeaders.map((h, i) => tplHeader(h + (i < 2 ? ' *' : ''), TPL.teal)),
    ...sessionHeaders.map(h => tplHeader(h, TPL.green)),
    ...freeHeaders.map(h => tplHeader(h, TPL.gold)),
  ])

  // Lignes d'exemple (alternées), hauteur calculée selon le texte le plus long de la ligne
  const exampleRowHeights: { hpx: number }[] = []
  exampleRows.forEach((row, i) => {
    const bg = i % 2 === 0 ? TPL.white : TPL.rowEven
    ws_data.push(row.map(v => tplData(v, bg)))
    const maxLines = row.reduce((m, v, c) => Math.max(m, estimateLines(v, colWidths[c])), 1)
    exampleRowHeights.push({ hpx: Math.max(34, maxLines * 15 + 10) })
  })

  const ws = XLSXStyle.utils.aoa_to_sheet(ws_data)
  ws['!cols'] = colWidths.map(wch => ({ wch }))
  ws['!rows'] = [{ hpx: 30 }, { hpx: 34 }, { hpx: 22 }, { hpx: 8 }, { hpx: 32 }, ...exampleRowHeights]
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
    { s: { r: LEGEND_ROW_IDX, c: 1 },  e: { r: LEGEND_ROW_IDX, c: 3 } },
    { s: { r: LEGEND_ROW_IDX, c: 5 },  e: { r: LEGEND_ROW_IDX, c: 8 } },
    { s: { r: LEGEND_ROW_IDX, c: 10 }, e: { r: LEGEND_ROW_IDX, c: 13 } },
  ]
  ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft' } as unknown as never

  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Patients')
  XLSXStyle.utils.book_append_sheet(wb, buildTplInstructionsSheet(), 'Instructions')

  const buf = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  writeFileSync(filePath, buf)
}

function buildTplInstructionsSheet() {
  const sub = (v: string, bg = TPL.teal) => [tplCell(v, {
    font: { bold: true, sz: 12, color: { rgb: TPL.white } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  }), tplCell('', { fill: { fgColor: { rgb: bg }, patternType: 'solid' } })]

  const bullet = (v: string) => [tplCell(v, {
    font: { sz: 10.5, color: { rgb: '2A2A28' } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 },
  }), tplCell('')]

  const callout = (v: string, bg: string, color = '2A2A28') => [tplCell(v, {
    font: { sz: 10.5, bold: true, color: { rgb: color } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true, indent: 1 },
    border: tplBorder,
  }), tplCell('', { fill: { fgColor: { rgb: bg }, patternType: 'solid' }, border: tplBorder })]

  const spacer = () => [tplCell('', { fill: { fgColor: { rgb: TPL.white }, patternType: 'solid' } }), tplCell('')]

  const rows: unknown[][] = [
    [tplTitle('GUIDE D’IMPORTATION', TPL.navy), tplCell('', { fill: { fgColor: { rgb: TPL.navy }, patternType: 'solid' } })],
    spacer(),
    sub('📋 Comment ça fonctionne'),
    spacer(),
    bullet('• Une ligne = une visite. Si un même patient (prénom + nom + date de naissance identiques) apparaît sur plusieurs lignes, chaque ligne devient une séance, remise automatiquement dans l’ordre chronologique des dates — peu importe l’ordre dans le fichier.'),
    bullet('• Vous pouvez renommer, réorganiser ou supprimer des colonnes : à l’import, vous associez vous-même chaque colonne au bon champ Synoria.'),
    bullet('• Toute colonne supplémentaire que vous ajoutez (comme "Commentaire interne" dans l’exemple) est automatiquement ajoutée dans l’anamnèse de la séance — rien n’est perdu, même sans la renommer.'),
    spacer(),
    sub('✅ Champs obligatoires', TPL.teal),
    spacer(),
    callout('Prénom  —  Nom', TPL.amberLight, TPL.amber),
    bullet('Toute ligne sans prénom ou sans nom est ignorée (signalée dans le résumé après import).'),
    spacer(),
    sub('❓ Champs séance (optionnels)', TPL.green),
    spacer(),
    bullet('Date de séance, Motif, Anamnèse — si les trois sont vides sur une ligne, seule la fiche patient est créée pour cette ligne (aucune séance). La Date de séance détermine l’ordre chronologique si un patient a plusieurs visites ; sans elle, l’ordre du fichier est utilisé.'),
    spacer(),
    sub('🔍 Doublons & vérifications', TPL.navy),
    spacer(),
    bullet('Un patient est considéré comme déjà existant (et donc ignoré) si son prénom, son nom ET sa date de naissance correspondent exactement à une fiche déjà présente dans Synoria.'),
    bullet('Si deux lignes ont le même prénom/nom mais des dates de naissance différentes, elles créent deux fiches distinctes — Synoria vous le signale dans le résumé pour vérification manuelle.'),
    spacer(),
    callout('💡 Astuce : remplacez simplement les lignes d’exemple de l’onglet "Patients" par vos propres données, puis importez ce fichier depuis Patients → Importer.', TPL.greenLight, TPL.green),
  ]

  const COL_A_CHARS = 100
  const ws = XLSXStyle.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: COL_A_CHARS }, { wch: 4 }]
  ws['!rows'] = rows.map((r, i) => {
    if (i === 0) return { hpx: 32 }
    const text = String((r[0] as { v?: unknown })?.v ?? '')
    if (!text) return { hpx: 10 }
    const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil((line.length || 1) / (COL_A_CHARS - 6))), 0)
    return { hpx: Math.max(22, lines * 16 + 8) }
  })
  ws['!merges'] = rows.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: 1 } }))
  return ws
}
