/**
 * Génère un dossier patient complet en HTML → PDF
 * Format médical A4, imprimable directement depuis le navigateur
 */

import { app }         from 'electron'
import { join }        from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { getPatientById }   from '../database/repositories/patientRepository'
import { getAllSessions }    from '../database/repositories/sessionRepository'
import { getSettings }      from './settingsService'

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin',
                   'juillet','août','septembre','octobre','novembre','décembre']

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function calcAge(bd?: string): string {
  if (!bd) return ''
  const age = Math.floor((Date.now() - new Date(bd + 'T12:00:00').getTime()) / 31557600000)
  return `${age} ans`
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()
}

// ── Rendu d'un groupe de champs ─────────────────────────────────────
function renderGroup(title: string, rows: string[]): string {
  const content = rows.filter(r => r.trim()).join('')
  if (!content) return ''
  return `
  <div class="group">
    <div class="group-title">${title}</div>
    ${content}
  </div>`
}

function row(label: string, value?: string | null): string {
  if (!value?.trim() || value === '<br>') return ''
  const clean = value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g,' ').trim()
  if (!clean) return ''
  return `<div class="row"><span class="lbl">${label}</span><span class="val">${escHtml(clean)}</span></div>`
}

function rowHtml(label: string, value?: string | null): string {
  if (!value?.trim() || value === '<br>') return ''
  const clean = stripHtml(value)
  if (!clean) return ''
  return `<div class="row"><span class="lbl">${label}</span><span class="val">${value}</span></div>`
}

export async function exportPatientReport(patientId: string): Promise<string> {
  const patient = getPatientById(patientId)
  if (!patient) throw new Error('Patient introuvable')

  const sessions = getAllSessions(patientId).sort((a, b) => a.date.localeCompare(b.date))
  const patientName = `${patient.first_name} ${patient.last_name}`
  const exportDate  = fmtDate(new Date().toISOString().slice(0, 10))
  const version     = app.getVersion()

  // ── Séances ─────────────────────────────────────────────────────
  const sessionsHtml = sessions.length === 0
    ? '<p class="empty">Aucune séance enregistrée.</p>'
    : sessions.map((s, idx) => {
        let fd: Record<string, unknown> = {}
        try { if (s.full_data_json) fd = JSON.parse(s.full_data_json) } catch {}

        const pluginId   = (fd.pluginId as string) || ''
        const pluginData = (fd.pluginData as Record<string, unknown>) || {}
        const pluginSchema = fd.pluginSchema as {
          specialty?: string
          sections?: Array<{ title: string; fields: Array<{ id: string; label: string; type: string }> }>
        } | null
        const isBuiltin   = !!(fd.pluginIsBuiltin) || pluginId === 'mtc_jp'
        const sessionNum  = (fd.sessionNum as number) || idx + 1
        const anamnese    = (fd.anamnese as string) || ''
        const poulsPos    = fd.poulsPos as Record<string,string> | null
        const langueNote  = (fd.langueNote as string) || ''
        const poulsNote   = (fd.poulsNote as string) || ''
        const barrageNiv1 = (fd.barrageNiv1 as string) || ''
        const barrageNiv2 = (fd.barrageNiv2 as string) || ''
        const barrageNiv3 = (fd.barrageNiv3 as string) || ''
        const barrageNiv4 = (fd.barrageNiv4 as string) || ''

        // Badge spécialité
        const specialty = isBuiltin ? 'MTC'
          : pluginSchema?.specialty || (pluginId ? pluginId : 'Consultation générale')

        let body = ''

        // ── Motif & Évolution ──
        body += renderGroup('Motif & Évolution', [
          rowHtml('Motif', s.motif),
          rowHtml(isBuiltin ? 'Interrogatoire / Anamnèse' : 'Histoire de la plainte', anamnese),
          rowHtml('Problématiques / Terrain', s.problematiques),
          row('Évolution', s.evolution_tags),
          rowHtml('Évolution (détail)', s.evolution),
        ])

        // ── Mode simple ──
        if (!pluginId) {
          body += renderGroup('Anamnèse', [
            rowHtml('Contexte & vie', fd.simpleContextVie as string),
            rowHtml('Traitements en cours', fd.simpleTraitementsEnCours as string),
            rowHtml('Objectifs du patient', fd.simpleObjectifs as string),
            rowHtml('Observations cliniques', s.observation),
            rowHtml('Notes entretien', fd.simpleNotesEntretien as string),
          ])
          body += renderGroup('Traitement', [
            rowHtml('Traitement effectué', s.traitement_notes),
            rowHtml('Réactions', s.reactions),
          ])
        }

        // ── Mode MTC intégré ──
        if (isBuiltin) {
          // Observation
          const langueDisplay = [s.langue, langueNote].filter(Boolean).join(' — ')
          const poulsDisplay  = [s.pouls, poulsNote].filter(Boolean).join(' — ')
          let poulsPosTxt = ''
          if (poulsPos) {
            const pp = Object.entries(poulsPos).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' | ')
            if (pp) poulsPosTxt = pp
          }
          body += renderGroup('Observation clinique', [
            row('Langue', langueDisplay),
            row('Pouls', poulsDisplay),
            poulsPosTxt ? `<div class="row"><span class="lbl">Positions pouls</span><span class="val" style="font-size:11px">${escHtml(poulsPosTxt)}</span></div>` : '',
            row('Constitution', s.constitution),
            row('Type de corps', s.type_corps),
            row('Teint', s.teint),
            rowHtml('Observation générale', s.observation),
          ])

          // Analyse
          body += renderGroup('Analyse & Diagnostic', [
            row('Diagnostic MTC', s.diagnostic_mtc),
            row('5 Éléments', s.cinq_elements),
            row('Causes', s.causes),
            rowHtml('Analyse / Mécanisme', s.analyse),
            row('Principes de traitement', s.principes),
          ])

          // Traitement
          body += renderGroup('Traitement', [
            row('Points d\'acupuncture', s.points),
            row('Points d\'oreille', s.pts_oreille),
            row('Techniques', s.techniques),
            row('Plantes / Formule', s.plantes),
            rowHtml('Réactions', s.reactions),
            rowHtml('Notes traitement', s.traitement_notes),
          ])

          // Barrage homéopathique
          const bArr = [barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4]
          const bContent = bArr.map((v, i) =>
            v ? `<div class="row" style="padding-left:12px"><span class="lbl">Niveau ${i+1}</span><span class="val">${escHtml(stripHtml(v))}</span></div>` : ''
          ).join('')
          if (bContent) {
            body += `<div class="group"><div class="group-title">Barrage homéopathique</div>${bContent}</div>`
          }
        }

        // ── Plugin tiers ──
        if (pluginId && !isBuiltin && pluginSchema) {
          for (const sec of (pluginSchema.sections || [])) {
            const rows = sec.fields
              .filter(f => f.type !== 'separator')
              .map(f => {
                const val = pluginData[f.id]
                if (val === null || val === undefined || val === '') return ''
                let display: string
                if (Array.isArray(val)) display = (val as string[]).join(', ')
                else if (f.type === 'checkbox') display = val ? `✓ Oui` : '✗ Non'
                else if (f.type === 'rating') display = `${val} / 5`
                else display = String(val).replace(/<[^>]+>/g,'').trim()
                return display ? row(f.label, display) : ''
              })
              .filter(Boolean)
            if (rows.length) {
              body += `<div class="group"><div class="group-title">${escHtml(sec.title)}</div>${rows.join('')}</div>`
            }
          }
        }

        // ── Suivi ──
        body += renderGroup('Plan de suivi', [
          rowHtml('Conseils', s.conseils),
          rowHtml('Plan à long terme', s.plan),
          row('À surveiller', s.surveiller),
          row('Prochain RDV', fmtDate(s.next_session_date)),
        ])

        if (!body.trim()) {
          body = '<p class="empty">Séance sans données détaillées enregistrées.</p>'
        }

        return `
<div class="session-block">
  <div class="session-header">
    <div>
      <span class="session-date">${fmtDate(s.date)}</span>
      <span class="session-num">· Séance n°&nbsp;${sessionNum}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${s.practitioner ? `<span class="session-prat">${escHtml(s.practitioner)}</span>` : ''}
      <span class="session-badge">${escHtml(specialty)}</span>
    </div>
  </div>
  <div class="session-body">${body}</div>
</div>`
      }).join('')

  // ── Index des séances ─────────────────────────────────────────────
  const tocHtml = sessions.length > 2 ? `
<div class="toc">
  <div class="toc-title">Index des séances (${sessions.length} au total)</div>
  <div class="toc-list">
    ${sessions.map((s, i) => `<span class="toc-item">${i+1}. ${fmtDate(s.date)}</span>`).join('')}
  </div>
</div>` : ''

  // ── HTML final ────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Dossier — ${escHtml(patientName)}</title>
<style>
/* ─── Reset & base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: #222;
  background: #fff;
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 32px;
}

/* ─── En-tête ─────────────────────────────────────────────── */
.doc-header {
  background: linear-gradient(135deg, #2d4a26, #4e7a45);
  color: #fff;
  border-radius: 10px;
  padding: 20px 28px;
  margin-bottom: 22px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}
.doc-title  { font-size: 22px; font-weight: 800; letter-spacing: -.3px; margin-bottom: 3px; }
.doc-sub    { font-size: 13px; opacity: .85; }
.doc-right  { text-align: right; font-size: 11px; opacity: .8; line-height: 2; flex-shrink: 0; }
.confidential {
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.4);
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  margin-top: 4px;
  display: inline-block;
}

/* ─── Fiche patient ──────────────────────────────────────── */
.patient-card {
  border: 2px solid #e2e8e0;
  border-radius: 10px;
  padding: 18px 22px;
  margin-bottom: 20px;
  background: #fafcf9;
}
.patient-card-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #4e7a45;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1.5px solid #dde8db;
}
.alert-box {
  background: #fff8e6;
  border: 1.5px solid #f59e0b;
  border-radius: 6px;
  padding: 8px 14px;
  color: #7c4a03;
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 14px;
}
.pi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 28px; }
.pi-grid .pi-full { grid-column: 1 / -1; }
.pi { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; font-size: 12.5px; }
.pi-lbl { font-weight: 700; color: #555; min-width: 130px; flex-shrink: 0; }
.pi-val { color: #222; }

/* ─── Index séances ──────────────────────────────────────── */
.toc {
  background: #f5f7f5;
  border: 1px solid #d8e0d6;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 22px;
}
.toc-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; color: #4e7a45; margin-bottom: 10px; }
.toc-list  { display: flex; flex-wrap: wrap; gap: 6px; }
.toc-item  { font-size: 11px; background: #fff; border: 1px solid #c8d4c5; border-radius: 5px; padding: 3px 10px; color: #333; }

/* ─── Bloc séance ────────────────────────────────────────── */
.session-block {
  border: 1.5px solid #d8e4d5;
  border-radius: 10px;
  margin-bottom: 18px;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}
.session-header {
  background: linear-gradient(90deg, #3d6636, #5a8850);
  color: #fff;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.session-date  { font-size: 15px; font-weight: 800; }
.session-num   { font-size: 12px; opacity: .85; font-weight: 500; }
.session-prat  { font-size: 11px; opacity: .8; }
.session-badge {
  background: rgba(255,255,255,.22);
  border: 1px solid rgba(255,255,255,.45);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
}
.session-body { padding: 14px 18px; }

/* ─── Groupes de champs ──────────────────────────────────── */
.group {
  margin-bottom: 12px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #eaefea;
}
.group:last-child { margin-bottom: 0; }
.group-title {
  background: #f0f5ef;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #4e7a45;
  padding: 5px 12px;
  border-bottom: 1px solid #dde7db;
}
.row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 5px 12px;
  border-bottom: 1px solid #f2f5f2;
  font-size: 12.5px;
}
.row:last-child { border-bottom: none; }
.lbl {
  min-width: 160px;
  max-width: 160px;
  flex-shrink: 0;
  font-weight: 700;
  color: #555;
  font-size: 11.5px;
  padding-top: 1px;
}
.val { flex: 1; color: #1a1a1a; }
.val p   { margin: 0 0 3px; }
.val ul  { padding-left: 18px; margin: 2px 0; }
.val strong { font-weight: 700; }
.val em     { font-style: italic; }

/* ─── Pied de page ───────────────────────────────────────── */
.doc-footer {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1.5px solid #d8e4d5;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #888;
}
.empty { color: #aaa; font-style: italic; font-size: 12px; padding: 8px 0; }

/* ─── Impression A4 ──────────────────────────────────────── */
@media print {
  body { padding: 0; font-size: 12px; max-width: none; }
  .session-block { break-inside: avoid; page-break-inside: avoid; }
  @page {
    size: A4 portrait;
    margin: 18mm 14mm 18mm 14mm;
    @bottom-center {
      content: "Dossier — ${escHtml(patientName)} | Page " counter(page) " / " counter(pages);
      font-size: 9px;
      color: #999;
    }
  }
}
</style>
</head>
<body>

<!-- En-tête -->
<div class="doc-header">
  <div>
    <div class="doc-title">🌿 Dossier Patient — Synoria</div>
    <div class="doc-sub">${escHtml(patientName)} · ${sessions.length} séance${sessions.length > 1 ? 's' : ''}</div>
  </div>
  <div class="doc-right">
    Généré le ${exportDate}<br>
    v${escHtml(version)}
    <div class="confidential">🔒 Confidentiel</div>
  </div>
</div>

<!-- Fiche patient -->
<div class="patient-card">
  <div class="patient-card-title">Informations patient</div>
  ${patient.alerts ? `<div class="alert-box">⚠️ ALERTES : ${escHtml(patient.alerts)}</div>` : ''}
  <div class="pi-grid">
    <div class="pi"><span class="pi-lbl">Nom / Prénom</span><span class="pi-val"><strong>${escHtml(patientName)}</strong></span></div>
    <div class="pi"><span class="pi-lbl">Date de naissance</span><span class="pi-val">${patient.birth_date ? `${fmtDate(patient.birth_date)}&nbsp;&nbsp;(${calcAge(patient.birth_date)})` : '—'}</span></div>
    <div class="pi"><span class="pi-lbl">Téléphone</span><span class="pi-val">${escHtml(patient.phone || '—')}</span></div>
    <div class="pi"><span class="pi-lbl">Email</span><span class="pi-val">${escHtml(patient.email || '—')}</span></div>
    <div class="pi pi-full"><span class="pi-lbl">Adresse</span><span class="pi-val">${escHtml(patient.address || '—')}</span></div>
    <div class="pi"><span class="pi-lbl">Profession</span><span class="pi-val">${escHtml(patient.profession || '—')}</span></div>
    <div class="pi"><span class="pi-lbl">Médecin traitant</span><span class="pi-val">${escHtml(patient.regular_doctor || '—')}</span></div>
    ${patient.medications ? `<div class="pi pi-full"><span class="pi-lbl">Médicaments</span><span class="pi-val">${escHtml(patient.medications)}</span></div>` : ''}
    ${patient.antecedents ? `<div class="pi pi-full"><span class="pi-lbl">Antécédents</span><span class="pi-val">${escHtml(patient.antecedents)}</span></div>` : ''}
    ${patient.notes_general ? `<div class="pi pi-full"><span class="pi-lbl">Notes</span><span class="pi-val">${escHtml(patient.notes_general)}</span></div>` : ''}
  </div>
</div>

${tocHtml}

<!-- Séances -->
${sessionsHtml}

<!-- Pied de page -->
<div class="doc-footer">
  <span>Synoria v${escHtml(version)} · Dossier : ${escHtml(patientName)}</span>
  <span>Document confidentiel — usage médical exclusif — ${exportDate}</span>
</div>

</body>
</html>`

  const settings   = getSettings()
  const dir        = settings.backupPatientPath || settings.backupGeneralPath || app.getPath('documents')
  const slug       = `${patient.last_name.toUpperCase()}_${patient.first_name}`.replace(/[^a-zA-Z0-9_]/g, '_')
  const exportDir  = join(dir, slug)
  mkdirSync(exportDir, { recursive: true })
  const filePath   = join(exportDir, `Dossier_${slug}_${new Date().toISOString().slice(0, 10)}.html`)
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}
