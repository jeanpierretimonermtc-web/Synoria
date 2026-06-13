import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
// xlsx-js-style : fork gratuit de xlsx avec support complet des styles de cellules
// Chargé comme module externe (non bundlé par Rollup)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx-js-style') as typeof import('xlsx-js-style')
import { getSessionById } from '../database/repositories/sessionRepository'
import { getPatientById } from '../database/repositories/patientRepository'

// ── PALETTE (identique au CSS de l'application) ───────────────────
const C = {
  white:       'FFFFFF',
  pageBg:      'F5F2ED',
  border:      'C8C2B8',
  text:        '1C1A17',
  textMuted:   '7A7468',
  // Vert (accent)
  green:       '4A6741',
  greenMid:    '7A9F74',
  greenLight:  'EAF0E8',
  // Améthyste / violet (tests énergétiques)
  purple:      '5A4A7A',
  purpleLight: 'F0EDF7',
  // Ambre (consultation)
  amber:       'C17B2A',
  amberLight:  'FDF3E3',
  // Teal (observation / suivi)
  teal:        '2A7A6A',
  tealLight:   'E5F5F2',
  // Bleu (questionnaire)
  blue:        '2A5A8A',
  blueLight:   'E8F0F8',
}

// ── HELPERS ───────────────────────────────────────────────────────
type Side = { style: 'thin' | 'medium'; color: { rgb: string } }
type Border = { top: Side; bottom: Side; left: Side; right: Side }

function border(color = C.border, style: 'thin' | 'medium' = 'thin'): Border {
  const s: Side = { style, color: { rgb: color } }
  return { top: s, bottom: s, left: s, right: s }
}

function cell(v: string, s: Record<string, unknown> = {}): unknown {
  return { v: v ?? '', t: 's', s }
}

// Ligne de séparation (fond page, pas de contenu)
function gap(): unknown[] {
  const s = { fill: { fgColor: { rgb: C.pageBg }, patternType: 'solid' } }
  return [cell('', s), cell('', s)]
}

// En-tête de section : toute la largeur, fond coloré, texte blanc gras
function sectionHeader(label: string, bg: string): unknown[] {
  const s = {
    font: { bold: true, sz: 11, color: { rgb: C.white } },
    fill: { fgColor: { rgb: bg }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    border: border(bg, 'medium'),
  }
  return [
    cell(label, s),
    cell('', { fill: { fgColor: { rgb: bg }, patternType: 'solid' }, border: border(bg, 'medium') }),
  ]
}

// Ligne de données : colonne label (fond clair, gras) + colonne valeur (blanc)
function row(label: string, value: string | undefined | null, labelBg = C.greenLight): unknown[] | null {
  if (!value?.trim()) return null
  return [
    cell(label, {
      font: { bold: true, sz: 10, color: { rgb: C.text } },
      fill: { fgColor: { rgb: labelBg }, patternType: 'solid' },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
      border: border(),
    }),
    cell(value, {
      font: { sz: 10, color: { rgb: C.text } },
      fill: { fgColor: { rgb: C.white }, patternType: 'solid' },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
      border: border(),
    }),
  ]
}

// Ajoute une ligne (filtre les null automatiquement)
function push(ws_data: unknown[][], line: unknown[] | null) {
  if (line) ws_data.push(line)
}

function getExportDir(): string {
  const dir = join(app.getPath('userData'), 'exports')
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── EXPORT PRINCIPAL ──────────────────────────────────────────────
/** @param outputDir — si fourni, remplace le dossier exports par défaut */
export function exportSessionExcel(sessionId: string, outputDir?: string): string {
  const session = getSessionById(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)
  const patient = session.patient_id ? getPatientById(session.patient_id) : null

  // ── Données étendues depuis full_data_json ────────────────────────
  let fd: Record<string, unknown> = {}
  if (session.full_data_json) { try { fd = JSON.parse(session.full_data_json) } catch {} }
  const sessionNum: number   = (fd.sessionNum as number) || 0
  const langueNote: string   = (fd.langueNote as string) || ''
  const poulsNote: string    = (fd.poulsNote  as string) || ''
  const poulsPos             = (fd.poulsPos   as Record<string, string>) || {}
  const barrageNiv1: string  = (fd.barrageNiv1 as string) || ''
  const barrageNiv2: string  = (fd.barrageNiv2 as string) || ''
  const barrageNiv3: string  = (fd.barrageNiv3 as string) || ''
  const barrageNiv4: string  = (fd.barrageNiv4 as string) || ''

  const ws_data: unknown[][] = []
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  let ri = 0 // row index courant

  // ── TITRE ────────────────────────────────────────────────────────
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient inconnu'
  const seanceLabel = sessionNum > 0
    ? (sessionNum === 1 ? ' — 1ère séance' : ` — ${sessionNum}ème séance`)
    : ''

  ws_data.push([
    cell('DOSSIER PATIENT MTC', {
      font: { bold: true, sz: 18, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.green }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    cell('', { fill: { fgColor: { rgb: C.green }, patternType: 'solid' } }),
  ])
  merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }); ri++

  ws_data.push([
    cell(`${patientName}${seanceLabel}   ·   Séance du ${session.date || '—'}${session.practitioner ? '   ·   ' + session.practitioner : ''}`, {
      font: { sz: 12, italic: true, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.greenMid }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    cell('', { fill: { fgColor: { rgb: C.greenMid }, patternType: 'solid' } }),
  ])
  merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }); ri++

  ws_data.push(gap()); ri++

  // ── PATIENT ──────────────────────────────────────────────────────
  if (patient) {
    ws_data.push(sectionHeader('PATIENT', C.green)); ri++
    push(ws_data, row('Nom complet',       `${patient.first_name} ${patient.last_name}`, C.greenLight)); ri++
    if (patient.birth_date)     { push(ws_data, row('Date de naissance', patient.birth_date,     C.greenLight)); ri++ }
    if (patient.phone)          { push(ws_data, row('Téléphone',         patient.phone,           C.greenLight)); ri++ }
    if (patient.email)          { push(ws_data, row('Email',             patient.email,           C.greenLight)); ri++ }
    if (patient.regular_doctor) { push(ws_data, row('Médecin traitant',  patient.regular_doctor,  C.greenLight)); ri++ }
    if (patient.medications)    { push(ws_data, row('Médicaments',       patient.medications,     C.greenLight)); ri++ }
    if (patient.antecedents)    { push(ws_data, row('Antécédents',       patient.antecedents,     C.greenLight)); ri++ }
    if (patient.alerts)         { push(ws_data, row('Alertes',           patient.alerts,          C.greenLight)); ri++ }
    ws_data.push(gap()); ri++
  }

  // ── CONSULTATION ─────────────────────────────────────────────────
  const hasConsult = session.motif || session.evolution_tags || session.evolution
  if (hasConsult) {
    ws_data.push(sectionHeader('CONSULTATION', C.amber)); ri++
    push(ws_data, row('Motif de consultation', session.motif,          C.amberLight)); if (session.motif)          ri++
    push(ws_data, row('Évolution (tag)',        session.evolution_tags, C.amberLight)); if (session.evolution_tags) ri++
    push(ws_data, row('Évolution (détail)',     session.evolution,      C.amberLight)); if (session.evolution)      ri++
    ws_data.push(gap()); ri++
  }

  // ── OBSERVATION MTC ──────────────────────────────────────────────
  const hasObs = session.langue || session.pouls || session.constitution || session.type_corps || session.teint || session.observation || langueNote || poulsNote || Object.values(poulsPos).some(Boolean)
  if (hasObs) {
    ws_data.push(sectionHeader('OBSERVATION MTC', C.teal)); ri++

    // Langue
    if (session.langue) { push(ws_data, row('Langue — qualités', session.langue, C.tealLight)); ri++ }
    if (langueNote)     { push(ws_data, row('Langue — notes',    langueNote,     C.tealLight)); ri++ }

    // Pouls qualités globales
    if (session.pouls) { push(ws_data, row('Pouls — qualités globales', session.pouls, C.tealLight)); ri++ }

    // Pouls positions
    const poulsLines: string[] = []
    if (poulsPos.droitAvant   || poulsPos.droitMilieu   || poulsPos.droitArriere)  poulsLines.push(`Droite  — Cun: ${poulsPos.droitAvant||'—'}  Guan: ${poulsPos.droitMilieu||'—'}  Chi: ${poulsPos.droitArriere||'—'}`)
    if (poulsPos.gaucheAvant  || poulsPos.gaucheMilieu  || poulsPos.gaucheArriere) poulsLines.push(`Gauche — Cun: ${poulsPos.gaucheAvant||'—'}  Guan: ${poulsPos.gaucheMilieu||'—'}  Chi: ${poulsPos.gaucheArriere||'—'}`)
    if (poulsLines.length) { push(ws_data, row('Pouls — positions', poulsLines.join('\n'), C.tealLight)); ri++ }
    if (poulsNote) { push(ws_data, row('Pouls — notes', poulsNote, C.tealLight)); ri++ }

    push(ws_data, row('Constitution',      session.constitution, C.tealLight)); if (session.constitution) ri++
    push(ws_data, row('Type de corps',     session.type_corps,   C.tealLight)); if (session.type_corps)   ri++
    push(ws_data, row('Teint',             session.teint,        C.tealLight)); if (session.teint)        ri++
    push(ws_data, row('Notes observation', session.observation,  C.tealLight)); if (session.observation)  ri++
    ws_data.push(gap()); ri++
  }

  // ── QUESTIONNAIRE PAR SYSTÈMES ────────────────────────────────────
  if (session.systemes_json) {
    try {
      const sys = JSON.parse(session.systemes_json)
      const SYS_LABELS: Record<string, string> = {
        cardio:       'Cardiaque / Sommeil',
        pulmo:        'Pulmonaire',
        mental:       'Santé mentale',
        vision:       'Vision & Audition',
        reins:        'Reins / Vessie',
        rate:         'Système de la Rate',
        estomac:      'Système de l\'Estomac',
        grosIntestin: 'Gros Intestin',
        peau:         'Santé de la Peau',
        tete:         'Maux de tête',
        temp:         'Température',
        musculo:      'Musculo-squelettique',
        feminin:      'Santé Féminine',
        fertilite:    'Fertilité',
        masculin:     'Santé Masculine',
        // rétrocompat
        digestif:     'Digestif (ancien)',
      }
      const hasAny = Object.values(sys).some((v: unknown) => {
        const vv = v as Record<string, unknown>
        return (Array.isArray(vv?.checked) && (vv.checked as unknown[]).length > 0) ||
               vv?.note || vv?.stress || vv?.anxiete || vv?.energie || vv?.douleur
      })
      if (hasAny) {
        ws_data.push(sectionHeader('QUESTIONNAIRE PAR SYSTEMES', C.blue)); ri++
        for (const [k, v] of Object.entries(sys) as [string, Record<string, unknown>][]) {
          if (!v || typeof v !== 'object') continue
          const label = SYS_LABELS[k] || k
          const lines: string[] = []

          // Éléments cochés
          if (Array.isArray(v.checked) && v.checked.length)
            lines.push(`Coché : ${(v.checked as string[]).join(', ')}`)

          // Scores
          if (k === 'mental') {
            if (v.stress)  lines.push(`Stress : ${v.stress}/10`)
            if (v.anxiete) lines.push(`Anxiété : ${v.anxiete}/10`)
          }
          if (k === 'rate' || k === 'digestif') {
            if (v.energie)            lines.push(`Énergie : ${v.energie}/10`)
            if (v.regimeAlimentaire)  lines.push(`Régime alimentaire : ${v.regimeAlimentaire}`)
          }
          if (k === 'musculo') {
            if (v.douleur)      lines.push(`Douleur : ${v.douleur}/10`)
            if (v.localisation) lines.push(`Localisation : ${v.localisation}`)
          }

          // Peau
          if (k === 'peau') {
            if (v.emplacementAcne)   lines.push(`Emplacement acné : ${v.emplacementAcne}`)
            if (v.emplacementEczema) lines.push(`Emplacement eczéma : ${v.emplacementEczema}`)
          }

          // Féminin
          if (k === 'feminin') {
            if (v.ageMenarche)   lines.push(`Ménarche : ${v.ageMenarche} ans`)
            if (v.jourCycle)     lines.push(`Jour du cycle : ${v.jourCycle}`)
            if (v.longueurCycle) lines.push(`Longueur cycle : ${v.longueurCycle}`)
            if (v.dureeMin || v.dureeMax) lines.push(`Durée menstruations : ${v.dureeMin||'?'}–${v.dureeMax||'?'} j`)
            if (v.couleurSang)   lines.push(`Couleur sang : ${v.couleurSang}`)
            if (v.ecoulement)    lines.push(`Écoulement : ${v.ecoulement}`)
            if (Array.isArray(v.caillots) && (v.caillots as string[]).length) lines.push(`Caillots : ${(v.caillots as string[]).join(', ')}`)
            if (Array.isArray(v.crampes)  && (v.crampes  as string[]).length) lines.push(`Crampes : ${(v.crampes  as string[]).join(', ')}`)
            if (Array.isArray(v.spm)      && (v.spm      as string[]).length) lines.push(`SPM : ${(v.spm as string[]).join(', ')}`)
          }

          // Fertilité
          if (k === 'fertilite') {
            if (v.essaiConception) lines.push(`Essai conception : ${v.essaiConception}`)
            if (v.testsSanguins)   lines.push(`Tests sanguins : ${v.testsSanguins}`)
            if (v.resultatTests)   lines.push(`Résultats tests : ${v.resultatTests}`)
            if (Array.isArray(v.diagnosticFertilite) && (v.diagnosticFertilite as string[]).length)
              lines.push(`Diagnostic fertilité : ${(v.diagnosticFertilite as string[]).join(', ')}`)
            if (v.debutMenopause)  lines.push(`Début ménopause : ${v.debutMenopause} ans`)
            if (v.enceinte)        lines.push(`Enceinte${v.nbSemaines ? ` (${v.nbSemaines} sem.)` : ''}`)
            if (v.cesarienne)      lines.push(`Césarienne : oui`)
            if (v.datePrevue)      lines.push(`Date prévue accouchement : ${v.datePrevue}`)
            if (v.enfants)         lines.push(`Enfants : oui`)
          }

          // Note
          if (v.note) lines.push(`Notes : ${v.note}`)

          if (lines.length) { push(ws_data, row(label, lines.join('\n'), C.blueLight)); ri++ }
        }
        ws_data.push(gap()); ri++
      }
    } catch { /* ignore */ }
  }

  // ── DIAGNOSTIC MTC ───────────────────────────────────────────────
  const hasDiag = session.diagnostic_mtc || session.cinq_elements || session.causes || session.analyse || session.principes
  if (hasDiag) {
    ws_data.push(sectionHeader('DIAGNOSTIC MTC', C.purple)); ri++
    push(ws_data, row('Diagnostic MTC',         session.diagnostic_mtc, C.purpleLight)); if (session.diagnostic_mtc) ri++
    push(ws_data, row('5 Elements',             session.cinq_elements,  C.purpleLight)); if (session.cinq_elements)  ri++
    push(ws_data, row('Causes',                 session.causes,         C.purpleLight)); if (session.causes)         ri++
    push(ws_data, row('Analyse / Mecanisme',    session.analyse,        C.purpleLight)); if (session.analyse)        ri++
    push(ws_data, row('Principes traitement',   session.principes,      C.purpleLight)); if (session.principes)      ri++
    ws_data.push(gap()); ri++
  }

  // ── TESTS ENERGETIQUES ────────────────────────────────────────────
  if (session.energy_tests_json) {
    try {
      const et = JSON.parse(session.energy_tests_json)
      const rech = (et.rechauffeurs || []).filter((x: Record<string,unknown>) => x.active)
        .map((x: Record<string,unknown>) => `${x.key} (${x.polarite || '?'})`).join(', ')
      const foyers = (et.foyers || []).filter((x: Record<string,unknown>) => x.active)
        .map((x: Record<string,unknown>) => `${x.key}: ${(x.subs as string[] || []).join(', ')}`).join(' | ')
      const mvList = (et.merveilleuxVaisseaux || [])
        .filter((m: Record<string,unknown>) => m.fonctionExterne || m.axeDistribution || m.fonctionInterne || m.note)
        .map((m: Record<string,unknown>) =>
          `${m.name}: ${[m.fonctionExterne && 'Ext.', m.axeDistribution && 'Axe', m.fonctionInterne && 'Int.', m.note].filter(Boolean).join('/')}`)
        .join(' | ')
      const penEmp  = Array.isArray(et.penetrationEmp)  ? et.penetrationEmp.join(', ')  : (et.penetrationEmp  || '')
      const penComp = Array.isArray(et.penetrationComp) ? et.penetrationComp.join(', ') : (et.penetrationComp || '')
      const ec = et.energieComp || {}
      const hasEnergy = rech || foyers || mvList || et.pointsMu?.length || et.empereur ||
        et.syndrome?.length || et.syndromeClimat?.length || penEmp || penComp ||
        ec.biaoli || ec.midiMinuit || ec.gmMeridien || et.testsNotes

      if (hasEnergy) {
        ws_data.push(sectionHeader('TESTS ENERGETIQUES — PROTOCOLE ENTONNOIR', C.purple)); ri++
        push(ws_data, row('Rechauffeurs',          rech,                                          C.purpleLight)); if (rech)                  ri++
        push(ws_data, row('Foyers',                foyers,                                        C.purpleLight)); if (foyers)                ri++
        push(ws_data, row('Merveilleux Vaisseaux', mvList,                                        C.purpleLight)); if (mvList)               ri++
        if (et.pointsMu?.length)      { push(ws_data, row('Points Mu',            et.pointsMu.join(', '),       C.purpleLight)); ri++ }
        if (et.empereur)              { push(ws_data, row('Empereur',              `${et.empereur} (${et.empereurPolarite || '?'})`, C.purpleLight)); ri++ }
        if (et.syndrome?.length)      { push(ws_data, row('Syndrome',             et.syndrome.join(', '),       C.purpleLight)); ri++ }
        if (et.syndromeClimat?.length){ push(ws_data, row('Climat / Wu Shu',      et.syndromeClimat.join(', '), C.purpleLight)); ri++ }
        push(ws_data, row('Penetration Empereur',    penEmp,   C.purpleLight)); if (penEmp)  ri++
        push(ws_data, row('Penetration Energie comp.', penComp, C.purpleLight)); if (penComp) ri++
        if (ec.biaoli)       { push(ws_data, row('Biao Li',          ec.biaoli,  C.purpleLight)); ri++ }
        if (ec.midiMinuit)   { push(ws_data, row('Midi / Minuit',    ec.midiMinuit, C.purpleLight)); ri++ }
        if (ec.gmMeridien)   {
          const gmVal = `${ec.gmMeridien}${ec.gmType?.length ? ` — ${ec.gmType.join(', ')}` : ''}${ec.gmNotes ? ` — ${ec.gmNotes}` : ''}`
          push(ws_data, row('Grand Meridien', gmVal, C.purpleLight)); ri++
        }
        if (ec.cinqMouvements?.length){ push(ws_data, row('5 Mouvements', ec.cinqMouvements.join(', '), C.purpleLight)); ri++ }
        if (ec.element)      { push(ws_data, row('Element compensateur', ec.element, C.purpleLight)); ri++ }
        if (ec.notes)        { push(ws_data, row('Notes energie comp.', ec.notes,  C.purpleLight)); ri++ }
        if (et.testsNotes)   { push(ws_data, row('Notes tests',         et.testsNotes, C.purpleLight)); ri++ }
        ws_data.push(gap()); ri++
      }
    } catch { /* ignore */ }
  }

  // ── TRAITEMENT ────────────────────────────────────────────────────
  const hasTrait = session.points || session.pts_oreille || session.techniques ||
    session.plantes || session.reactions || session.traitement_notes
  if (hasTrait) {
    ws_data.push(sectionHeader('TRAITEMENT', C.green)); ri++
    push(ws_data, row('Points acupuncture',        session.points,           C.greenLight)); if (session.points)           ri++
    push(ws_data, row('Points oreille',            session.pts_oreille,      C.greenLight)); if (session.pts_oreille)      ri++
    push(ws_data, row('Techniques utilisees',      session.techniques,       C.greenLight)); if (session.techniques)       ri++
    push(ws_data, row('Plantes / Formule',         session.plantes,          C.greenLight)); if (session.plantes)          ri++
    push(ws_data, row('Reactions / observations',  session.reactions,        C.greenLight)); if (session.reactions)        ri++
    push(ws_data, row('Notes traitement',          session.traitement_notes, C.greenLight)); if (session.traitement_notes) ri++
    ws_data.push(gap()); ri++
  }

  // ── BARRAGE HOMÉOPATHIQUE ─────────────────────────────────────────
  const hasBarrage = barrageNiv1 || barrageNiv2 || barrageNiv3 || barrageNiv4
  if (hasBarrage) {
    ws_data.push(sectionHeader('BARRAGE HOMÉOPATHIQUE', C.amber)); ri++
    if (barrageNiv1) { push(ws_data, row('Niveau 1', barrageNiv1, C.amberLight)); ri++ }
    if (barrageNiv2) { push(ws_data, row('Niveau 2', barrageNiv2, C.amberLight)); ri++ }
    if (barrageNiv3) { push(ws_data, row('Niveau 3', barrageNiv3, C.amberLight)); ri++ }
    if (barrageNiv4) { push(ws_data, row('Niveau 4', barrageNiv4, C.amberLight)); ri++ }
    ws_data.push(gap()); ri++
  }

  // ── SUIVI & CONSEILS ──────────────────────────────────────────────
  const hasSuivi = session.conseils || session.plan || session.surveiller
  if (hasSuivi) {
    ws_data.push(sectionHeader('SUIVI & CONSEILS', C.teal)); ri++
    push(ws_data, row('Conseils au patient', session.conseils,   C.tealLight)); if (session.conseils)   ri++
    push(ws_data, row('Plan de suivi',       session.plan,       C.tealLight)); if (session.plan)       ri++
    push(ws_data, row('A surveiller',        session.surveiller, C.tealLight)); if (session.surveiller) ri++
    ws_data.push(gap()); ri++
  }

  // ── DONNÉES PLUGIN ───────────────────────────────────────────────
  type PluginFieldMeta = { id: string; label: string; type: string; max?: number }
  type PluginSectionMeta = { title: string; accentColor?: string; fields: PluginFieldMeta[] }
  type PluginSchemaMeta  = { name?: string; icon?: string; sections?: PluginSectionMeta[] }

  const pluginData   = (fd.pluginData   as Record<string, unknown>) || {}
  const pluginSchema = (fd.pluginSchema as PluginSchemaMeta)        || null

  if (pluginSchema && Object.keys(pluginData).length > 0) {
    const pluginBg    = C.teal
    const pluginLight = C.tealLight
    const pluginName  = (pluginSchema.name || 'Plugin').toUpperCase()

    ws_data.push(sectionHeader(`DONNÉES ${pluginName}`, pluginBg)); ri++

    for (const section of (pluginSchema.sections || [])) {
      // Sous-en-tête de section
      const subS = {
        font:      { bold: true, sz: 10, color: { rgb: pluginBg } },
        fill:      { fgColor: { rgb: pluginLight }, patternType: 'solid' },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
        border:    border(pluginBg),
      }
      ws_data.push([
        cell(`▶  ${section.title}`, subS),
        cell('', { fill: { fgColor: { rgb: pluginLight }, patternType: 'solid' }, border: border(pluginBg) }),
      ]); ri++

      for (const field of section.fields) {
        if (field.type === 'separator') continue
        const val = pluginData[field.id]
        if (val === null || val === undefined || val === '') continue

        let strVal: string
        if (Array.isArray(val)) {
          strVal = (val as string[]).join(', ')
        } else if (typeof val === 'boolean') {
          strVal = val ? `✓ ${field.label}` : ''
        } else if (field.type === 'rating') {
          strVal = `${val} / ${field.max ?? 10}`
        } else {
          // Retirer les balises HTML pour l'export texte
          strVal = String(val).replace(/<[^>]+>/g, '')
        }
        if (!strVal.trim()) continue

        push(ws_data, row(field.label, strVal, pluginLight)); ri++
      }
    }
    ws_data.push(gap()); ri++
  }

  // ── CONSTRUCTION DU WORKSHEET ────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(ws_data)

  // Largeurs de colonnes
  ws['!cols'] = [{ wch: 30 }, { wch: 80 }]

  // Fusions (titre + sous-titre)
  ws['!merges'] = merges

  // Hauteurs de lignes auto-calculées d'après le contenu de la colonne valeur (B)
  const COL_A_WCH = 29   // largeur réelle col A en caractères
  const COL_B_WCH = 79   // largeur réelle col B en caractères
  ws['!rows'] = ws_data.map((rowData, i) => {
    if (i === 0) return { hpx: 40 }
    if (i === 1) return { hpx: 28 }
    if (i === 2) return { hpx: 8  }
    let maxLines = 1
    for (const [ci, wch] of [[0, COL_A_WCH], [1, COL_B_WCH]] as [number, number][]) {
      const v = (rowData[ci] as any)?.v
      if (!v) continue
      const lines = String(v).split('\n').reduce(
        (n, seg) => n + Math.max(1, Math.ceil((seg.length || 1) / wch)), 0
      )
      if (lines > maxLines) maxLines = lines
    }
    return { hpx: Math.max(22, maxLines * 16) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Seance MTC')

  const dir = outputDir ? (mkdirSync(outputDir, { recursive: true }), outputDir) : getExportDir()
  const patientSlug = patient
    ? `${patient.last_name.toUpperCase()}_${patient.first_name}`.replace(/[^a-zA-Z0-9_]/g, '_')
    : 'patient'
  const fileName = `${patientSlug}_${session.date || 'sans-date'}.xlsx`
  const filePath = join(dir, fileName)

  // Écriture via Buffer (XLSX.writeFile échoue dans le bundle Rollup)
  const buf: Buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  writeFileSync(filePath, buf)

  return filePath
}
