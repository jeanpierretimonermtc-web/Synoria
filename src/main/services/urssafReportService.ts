/**
 * Rapport annuel Urssaf — synthèse CA/trimestre + cotisations estimées
 * Format HTML imprimable (1 page A4)
 */
import { app }       from 'electron'
import { join }      from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { getSettings }           from './settingsService'
import { getConsultationTypes, getMonthlyRevenue, getUrsafRates } from '../database/repositories/comptaRepository'
// Note: getUrsafRates existe dans comptaRepository (vérifié)

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const TRIMESTRES = [
  { label: 'T1', months: [1, 2, 3], color: '#EFF6FF', border: '#3B82F6' },
  { label: 'T2', months: [4, 5, 6], color: '#F0FDF4', border: '#22C55E' },
  { label: 'T3', months: [7, 8, 9], color: '#FFFBEB', border: '#F59E0B' },
  { label: 'T4', months: [10, 11, 12], color: '#FDF4FF', border: '#A855F7' },
]

function eur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function exportUrssafReport(year: number): string {
  const settings = getSettings()
  const practName = settings.rgpdPractitionerName || '_______________'
  const types   = getConsultationTypes()
  const revenues = getMonthlyRevenue(year)
  const ursafRates = getUrsafRates(year)

  // CA par mois
  const caByMonth: Record<number, number> = {}
  const rateByMonth: Record<number, number> = {}

  for (let m = 1; m <= 12; m++) {
    const monthRevs = revenues.filter(r => r.month === m)
    let ca = 0
    for (const rev of monthRevs) {
      const type = types.find(t => t.id === rev.type_id)
      if (type) ca += (type.price || 0) * (rev.nb_seances || 0)
    }
    caByMonth[m] = ca
    const ursafRow = ursafRates.find((r: any) => r.month === m)
    rateByMonth[m] = ursafRow?.rate ?? 23.1
  }

  const totalCA       = Object.values(caByMonth).reduce((s, v) => s + v, 0)
  const totalCotis    = Object.entries(caByMonth).reduce((s, [m, ca]) => s + ca * (rateByMonth[+m] / 100), 0)

  // Lignes du tableau mensuel
  const monthRows = Array.from({ length: 12 }, (_, i) => {
    const m    = i + 1
    const ca   = caByMonth[m]
    const rate = rateByMonth[m]
    const cotis = ca * (rate / 100)
    return { m, ca, rate, cotis }
  })

  // Données trimestrielles
  const trimData = TRIMESTRES.map(t => {
    const ca    = t.months.reduce((s, m) => s + (caByMonth[m] || 0), 0)
    const cotis = t.months.reduce((s, m) => s + (caByMonth[m] || 0) * ((rateByMonth[m] || 23.1) / 100), 0)
    return { ...t, ca, cotis }
  })

  const today = new Date().toLocaleDateString('fr-FR')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport Urssaf ${year} — ${practName}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 12px; line-height: 1.5; color: #1a1a1a;
  max-width: 820px; margin: 0 auto; padding: 28px 36px;
}
.doc-header {
  background: linear-gradient(135deg, #2d4a26, #4e7a45);
  color: #fff; border-radius: 10px; padding: 18px 24px;
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 24px;
}
.doc-title  { font-size: 20px; font-weight: 800; margin-bottom: 3px; }
.doc-sub    { font-size: 12px; opacity: .85; }
.doc-right  { text-align: right; font-size: 11px; opacity: .8; line-height: 1.8; }

/* KPI row */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.kpi-card { border-radius: 8px; padding: 12px 16px; border: 1.5px solid #e0e0e0; }
.kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #666; margin-bottom: 4px; }
.kpi-value { font-size: 20px; font-weight: 800; color: #1a1a1a; letter-spacing: -.02em; }
.kpi-sub   { font-size: 10px; color: #888; margin-top: 2px; }

/* Trimestres */
.trim-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
.trim-card { border-radius: 8px; padding: 12px 14px; }
.trim-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #555; margin-bottom: 8px; }
.trim-ca    { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
.trim-rate  { font-size: 10px; color: #777; }
.trim-cotis { font-size: 13px; font-weight: 700; margin-top: 4px; }

/* Tableau mensuel */
table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
th { background: #f0f5ef; color: #2d4a26; font-weight: 700; padding: 7px 10px; text-align: left; border-bottom: 2px solid #c8d8c5; }
td { padding: 6px 10px; border-bottom: 1px solid #eee; }
tr:last-child td { border-bottom: none; }
.td-num   { text-align: right; font-variant-numeric: tabular-nums; }
.td-total { font-weight: 800; background: #f8f9f8; }
.td-zero  { color: #ccc; }

.notice {
  background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 8px;
  padding: 10px 14px; font-size: 11px; color: #92400E; margin-bottom: 16px;
}
.footer { padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
@media print {
  body { padding: 0; max-width: none; font-size: 11px; }
  @page { size: A4; margin: 15mm 12mm; }
}
</style>
</head>
<body>

<div class="doc-header">
  <div>
    <div class="doc-title">Rapport Urssaf — Exercice ${year}</div>
    <div class="doc-sub">${practName} · Estimation des cotisations sociales</div>
  </div>
  <div class="doc-right">Généré le ${today}<br>⚠ Document indicatif — se référer au portail Urssaf</div>
</div>

<!-- KPI annuels -->
<div class="kpi-row">
  <div class="kpi-card" style="background:#F0FDF4;border-color:#BBF7D0">
    <div class="kpi-label">CA annuel</div>
    <div class="kpi-value" style="color:#166534">${eur(totalCA)}</div>
    <div class="kpi-sub">Chiffre d'affaires brut</div>
  </div>
  <div class="kpi-card" style="background:#EFF6FF;border-color:#BFDBFE">
    <div class="kpi-label">Cotisations estimées</div>
    <div class="kpi-value" style="color:#1D4ED8">${eur(totalCotis)}</div>
    <div class="kpi-sub">Basé sur les taux renseignés</div>
  </div>
  <div class="kpi-card" style="background:#FFFBEB;border-color:#FDE68A">
    <div class="kpi-label">Taux moyen</div>
    <div class="kpi-value" style="color:#92400E">${totalCA > 0 ? (totalCotis / totalCA * 100).toFixed(1) : '—'} %</div>
    <div class="kpi-sub">Taux moyen pondéré</div>
  </div>
  <div class="kpi-card" style="background:#F0F5EF;border-color:#C8D8C5">
    <div class="kpi-label">Reste net estimé</div>
    <div class="kpi-value" style="color:#2d4a26">${eur(totalCA - totalCotis)}</div>
    <div class="kpi-sub">CA — cotisations</div>
  </div>
</div>

<!-- Trimestres -->
<div class="trim-grid">
  ${trimData.map(t => `
  <div class="trim-card" style="background:${t.color};border:1.5px solid ${t.border}">
    <div class="trim-label" style="color:${t.border}">${t.label} — ${MONTHS_FR[t.months[0]-1].slice(0,3)} à ${MONTHS_FR[t.months[2]-1].slice(0,3)}</div>
    <div class="trim-ca">${eur(t.ca)}</div>
    <div class="trim-cotis" style="color:${t.border}">${eur(t.cotis)}</div>
    <div class="trim-rate">Cotisations estimées T${t.label.slice(1)}</div>
  </div>`).join('')}
</div>

<!-- Tableau mensuel -->
<table>
  <thead>
    <tr>
      <th>Mois</th>
      <th class="td-num">CA HT</th>
      <th class="td-num">Taux Urssaf</th>
      <th class="td-num">Cotisation estimée</th>
      <th class="td-num">Net estimé</th>
    </tr>
  </thead>
  <tbody>
    ${monthRows.map(r => `
    <tr>
      <td>${MONTHS_FR[r.m - 1]}</td>
      <td class="td-num ${r.ca === 0 ? 'td-zero' : ''}">${eur(r.ca)}</td>
      <td class="td-num">${r.rate.toFixed(1)} %</td>
      <td class="td-num ${r.cotis === 0 ? 'td-zero' : ''}">${eur(r.cotis)}</td>
      <td class="td-num ${r.ca === 0 ? 'td-zero' : ''}">${eur(r.ca - r.cotis)}</td>
    </tr>`).join('')}
    <tr>
      <td class="td-total">TOTAL ${year}</td>
      <td class="td-num td-total">${eur(totalCA)}</td>
      <td class="td-num td-total">—</td>
      <td class="td-num td-total">${eur(totalCotis)}</td>
      <td class="td-num td-total">${eur(totalCA - totalCotis)}</td>
    </tr>
  </tbody>
</table>

<div class="notice">
  ⚠️ <strong>Estimation uniquement.</strong> Ce document est généré à partir des taux renseignés dans Synoria.
  Les cotisations réelles peuvent différer selon votre situation (ACRE, exonérations, régime réel…).
  <strong>Déclarez sur le portail Urssaf (urssaf.fr)</strong> — les montants affichés ici ne constituent pas une déclaration officielle.
</div>

<div class="footer">
  <span>Synoria · ${practName} · Exercice ${year}</span>
  <span>Document indicatif — ${today}</span>
</div>

</body>
</html>`

  const dir = join(app.getPath('userData'), 'exports')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `Rapport_Urssaf_${year}_${new Date().toISOString().slice(0,10)}.html`)
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}
