/**
 * Génère un dossier patient complet en HTML → PDF
 * Contient : informations patient + toutes les séances dans l'ordre chronologique
 * Format médical professionnel, imprimable directement
 */

import { app }         from 'electron'
import { join }        from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { getPatientById }           from '../database/repositories/patientRepository'
import { getAllSessions }            from '../database/repositories/sessionRepository'
import { getSettings }              from './settingsService'

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin',
                   'juillet','août','septembre','octobre','novembre','décembre']

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function renderHtml(html?: string | null): string {
  if (!html?.trim()) return '<em style="color:#aaa">—</em>'
  return html
}

function calcAge(birthDate?: string): string {
  if (!birthDate) return ''
  const b = new Date(birthDate + 'T12:00:00')
  const age = Math.floor((Date.now() - b.getTime()) / 31557600000)
  return `${age} ans`
}

export async function exportPatientReport(patientId: string): Promise<string> {
  const patient = getPatientById(patientId)
  if (!patient) throw new Error('Patient introuvable')

  const sessions = getAllSessions(patientId)
    .sort((a, b) => a.date.localeCompare(b.date))

  const patientName = `${patient.first_name} ${patient.last_name}`
  const exportDate  = fmtDate(new Date().toISOString().slice(0, 10))

  const sessionHtml = sessions.length === 0
    ? '<p style="color:#999;font-style:italic">Aucune séance enregistrée.</p>'
    : sessions.map((s, idx) => {
        let fd: Record<string, unknown> = {}
        try { if (s.full_data_json) fd = JSON.parse(s.full_data_json) } catch {}

        const pluginId       = (fd.pluginId as string) || ''
        const pluginData     = (fd.pluginData as Record<string, unknown>) || {}
        const pluginSchema   = fd.pluginSchema as { sections?: Array<{ title: string; fields: Array<{ id: string; label: string; type: string }> }> } | null
        const isBuiltin      = !!(fd.pluginIsBuiltin) || pluginId === 'mtc_jp'
        const sessionNum     = (fd.sessionNum as number) || idx + 1
        const anamnese       = (fd.anamnese as string) || ''
        const contextVie     = (fd.simpleContextVie as string) || ''
        const traitemEC      = (fd.simpleTraitementsEnCours as string) || ''
        const objectifs      = (fd.simpleObjectifs as string) || ''
        const notesEntretien = (fd.simpleNotesEntretien as string) || ''
        const barrageNiv1    = (fd.barrageNiv1 as string) || ''
        const barrageNiv2    = (fd.barrageNiv2 as string) || ''
        const barrageNiv3    = (fd.barrageNiv3 as string) || ''
        const barrageNiv4    = (fd.barrageNiv4 as string) || ''

        const fields: string[] = []

        const field = (label: string, value?: string | null, isHtml = false) => {
          if (!value?.trim()) return ''
          return `<div class="field-row">
            <div class="field-label">${label}</div>
            <div class="field-value">${isHtml ? value : escHtml(value)}</div>
          </div>`
        }

        const htmlField = (label: string, value?: string | null) => {
          if (!value?.trim() || value === '<br>') return ''
          return `<div class="field-row">
            <div class="field-label">${label}</div>
            <div class="field-value rich">${value}</div>
          </div>`
        }

        // ── Motif & évolution ──
        fields.push(htmlField('Motif', s.motif))
        if (anamnese) fields.push(htmlField(isBuiltin ? 'Prise de notes / Interrogatoire' : 'Histoire de la plainte', anamnese))
        if (s.problematiques) fields.push(htmlField('Problématiques / Terrain', s.problematiques))
        if (s.evolution_tags) fields.push(field('Évolution (tag)', s.evolution_tags))
        if (s.evolution) fields.push(htmlField('Évolution', s.evolution))

        // ── Mode simple enrichi ──
        if (!pluginId) {
          if (contextVie) fields.push(htmlField('Contexte & vie', contextVie))
          if (traitemEC) fields.push(htmlField('Traitements en cours', traitemEC))
          if (objectifs) fields.push(htmlField('Objectifs du patient', objectifs))
          if (s.observation) fields.push(htmlField('Observations cliniques', s.observation))
          if (notesEntretien) fields.push(htmlField('Notes d\'entretien', notesEntretien))
        }

        // ── Sections MTC intégrées ──
        if (isBuiltin) {
          if (s.langue || fd.langueNote) {
            fields.push(field('Langue', [s.langue, fd.langueNote as string].filter(Boolean).join(' — ')))
          }
          if (s.pouls || fd.poulsNote) {
            fields.push(field('Pouls', [s.pouls, fd.poulsNote as string].filter(Boolean).join(' — ')))
          }
          if (s.constitution) fields.push(field('Constitution', s.constitution))
          if (s.teint) fields.push(field('Teint', s.teint))
          if (s.observation) fields.push(htmlField('Observation générale', s.observation))

          if (s.diagnostic_mtc) fields.push(field('Diagnostic MTC', s.diagnostic_mtc))
          if (s.cinq_elements) fields.push(field('5 Éléments', s.cinq_elements))
          if (s.causes) fields.push(field('Causes', s.causes))
          if (s.analyse) fields.push(field('Analyse / Mécanisme', s.analyse))
          if (s.principes) fields.push(field('Principes de traitement', s.principes))

          if (s.points) fields.push(field('Points d\'acupuncture', s.points))
          if (s.pts_oreille) fields.push(field('Points d\'oreille', s.pts_oreille))
          if (s.techniques) fields.push(field('Techniques', s.techniques))
          if (s.plantes) fields.push(field('Plantes / Formule', s.plantes))
          if (s.reactions) fields.push(htmlField('Réactions', s.reactions))
          if (s.traitement_notes) fields.push(htmlField('Notes traitement', s.traitement_notes))

          const hasBarrage = barrageNiv1 || barrageNiv2 || barrageNiv3 || barrageNiv4
          if (hasBarrage) {
            const bItems = [barrageNiv1, barrageNiv2, barrageNiv3, barrageNiv4]
              .map((v, i) => v ? `<div><strong>N${i+1} :</strong> ${escHtml(stripHtml(v))}</div>` : '')
              .join('')
            fields.push(`<div class="field-row"><div class="field-label">Barrage homéopathique</div><div class="field-value">${bItems}</div></div>`)
          }
        }

        // ── Plugin tiers (Kinésio, Ostéo…) ──
        if (pluginId && !isBuiltin && pluginSchema) {
          for (const section of (pluginSchema.sections || [])) {
            const sectionFields = section.fields
              .filter(f => f.type !== 'separator')
              .map(f => {
                const val = pluginData[f.id]
                if (val === null || val === undefined || val === '') return ''
                let display: string
                if (Array.isArray(val)) display = (val as string[]).join(', ')
                else if (f.type === 'checkbox') display = val ? `✓ ${f.label}` : ''
                else display = String(val).replace(/<[^>]+>/g, '')
                return display ? field(`${section.title} — ${f.label}`, display) : ''
              })
              .filter(Boolean)
            fields.push(...sectionFields)
          }
        }

        // ── Suivi ──
        if (s.conseils) fields.push(htmlField('Conseils', s.conseils))
        if (s.plan) fields.push(htmlField('Plan à long terme', s.plan))
        if (s.surveiller) fields.push(field('À surveiller', s.surveiller))
        if (s.next_session_date) fields.push(field('Prochain RDV prévu', fmtDate(s.next_session_date)))

        const hasContent = fields.some(f => f.length > 0)

        return `
        <div class="session-block" id="session-${idx + 1}">
          <div class="session-header">
            <div class="session-date">${fmtDate(s.date)}</div>
            <div class="session-meta">
              <span class="session-num">Séance n° ${sessionNum}</span>
              ${s.practitioner ? `<span class="session-prat">· ${s.practitioner}</span>` : ''}
              ${pluginId && !isBuiltin ? `<span class="session-plugin">· ${(fd.pluginSchema as any)?.specialty || pluginId}</span>` : ''}
              ${isBuiltin ? '<span class="session-plugin">· MTC</span>' : ''}
            </div>
          </div>
          ${hasContent ? `<div class="session-fields">${fields.join('')}</div>` : '<p style="color:#aaa;font-style:italic;padding:8px 0">Séance sans données détaillées.</p>'}
        </div>`
      }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Dossier — ${patientName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    background: #fff;
    padding: 20px;
    line-height: 1.5;
  }

  /* ── En-tête dossier ── */
  .doc-header {
    background: linear-gradient(135deg, #2d4a26 0%, #4A6741 100%);
    color: #fff;
    padding: 18px 24px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .doc-title { font-size: 20px; font-weight: 800; margin-bottom: 3px; letter-spacing: -.3px; }
  .doc-sub   { font-size: 11px; opacity: .8; }
  .doc-meta  { text-align: right; font-size: 10px; opacity: .75; line-height: 1.8; }

  /* ── Fiche patient ── */
  .patient-card {
    border: 1.5px solid #ddd;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 24px;
  }
  .patient-card .alert {
    grid-column: 1 / -1;
    background: #fff3cd;
    border: 1.5px solid #f59e0b;
    border-radius: 6px;
    padding: 6px 12px;
    color: #92400e;
    font-weight: 700;
    font-size: 10.5px;
    margin-bottom: 8px;
  }
  .pi { display: flex; gap: 6px; font-size: 10.5px; padding: 2px 0; }
  .pi-label { font-weight: 700; color: #555; min-width: 110px; }

  /* ── Index séances ── */
  .toc {
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 20px;
  }
  .toc-title { font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #4A6741; margin-bottom: 8px; }
  .toc-list  { display: flex; flex-wrap: wrap; gap: 6px; }
  .toc-item  { font-size: 10px; background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 3px 8px; color: #333; }

  /* ── Séance ── */
  .session-block {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    margin-bottom: 14px;
    overflow: hidden;
    break-inside: avoid;
  }
  .session-header {
    background: linear-gradient(90deg, #4A6741 0%, #5a8050 100%);
    color: #fff;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .session-date  { font-weight: 800; font-size: 12px; }
  .session-meta  { font-size: 10px; opacity: .85; }
  .session-num   { font-weight: 700; }
  .session-prat  { margin-left: 4px; }
  .session-plugin { margin-left: 4px; background: rgba(255,255,255,.2); padding: 1px 6px; border-radius: 10px; }

  .session-fields { padding: 10px 14px; }

  /* ── Champs ── */
  .field-row {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid #f0f0f0;
    align-items: flex-start;
  }
  .field-row:last-child { border-bottom: none; }
  .field-label {
    min-width: 180px;
    max-width: 180px;
    font-weight: 700;
    font-size: 10px;
    color: #666;
    padding-top: 2px;
    flex-shrink: 0;
  }
  .field-value { flex: 1; font-size: 11px; color: #1a1a1a; }
  .field-value.rich p { margin: 0 0 4px; }
  .field-value.rich strong { font-weight: 700; }
  .field-value.rich em { font-style: italic; }

  /* ── Pied de page ── */
  .doc-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #999;
  }

  @media print {
    body { padding: 10px; font-size: 10px; }
    .session-block { break-inside: avoid; }
    @page { size: A4; margin: 15mm 12mm; }
  }
</style>
</head>
<body>

<!-- En-tête -->
<div class="doc-header">
  <div>
    <div class="doc-title">🌿 Synoria — Dossier Patient</div>
    <div class="doc-sub">${patientName} · ${sessions.length} séance${sessions.length > 1 ? 's' : ''}</div>
  </div>
  <div class="doc-meta">
    Document généré le ${exportDate}<br>
    Usage strictement médical et confidentiel
  </div>
</div>

<!-- Fiche patient -->
<div class="patient-card">
  ${patient.alerts ? `<div class="alert">⚠️ Alertes : ${escHtml(patient.alerts)}</div>` : ''}
  <div class="pi"><span class="pi-label">Nom complet</span><span><strong>${escHtml(patientName)}</strong></span></div>
  <div class="pi"><span class="pi-label">Date de naissance</span><span>${patient.birth_date ? `${fmtDate(patient.birth_date)} (${calcAge(patient.birth_date)})` : '—'}</span></div>
  <div class="pi"><span class="pi-label">Téléphone</span><span>${escHtml(patient.phone || '—')}</span></div>
  <div class="pi"><span class="pi-label">Email</span><span>${escHtml(patient.email || '—')}</span></div>
  <div class="pi"><span class="pi-label">Adresse</span><span>${escHtml(patient.address || '—')}</span></div>
  <div class="pi"><span class="pi-label">Profession</span><span>${escHtml(patient.profession || '—')}</span></div>
  <div class="pi"><span class="pi-label">Médecin traitant</span><span>${escHtml(patient.regular_doctor || '—')}</span></div>
  <div class="pi"><span class="pi-label">Médicaments</span><span>${escHtml(patient.medications || '—')}</span></div>
  <div class="pi" style="grid-column:1/-1"><span class="pi-label">Antécédents</span><span>${escHtml(patient.antecedents || '—')}</span></div>
  ${patient.notes_general ? `<div class="pi" style="grid-column:1/-1"><span class="pi-label">Notes générales</span><span>${escHtml(patient.notes_general)}</span></div>` : ''}
</div>

<!-- Index des séances -->
${sessions.length > 2 ? `
<div class="toc">
  <div class="toc-title">Index des séances</div>
  <div class="toc-list">
    ${sessions.map((s, i) => `<span class="toc-item">${i+1}. ${fmtDate(s.date)}</span>`).join('')}
  </div>
</div>` : ''}

<!-- Séances -->
${sessionHtml}

<!-- Pied de page -->
<div class="doc-footer">
  <span>Dossier : ${escHtml(patientName)} · Synoria v${app.getVersion()}</span>
  <span>Document confidentiel — ${exportDate}</span>
</div>

</body>
</html>`

  const settings = getSettings()
  const dir = settings.backupPatientPath || settings.backupGeneralPath || app.getPath('documents')
  const slug = `${patient.last_name.toUpperCase()}_${patient.first_name}`.replace(/[^a-zA-Z0-9_]/g, '_')
  const exportDir = join(dir, slug)
  mkdirSync(exportDir, { recursive: true })
  const filePath = join(exportDir, `Dossier_${slug}_${new Date().toISOString().slice(0,10)}.html`)
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
