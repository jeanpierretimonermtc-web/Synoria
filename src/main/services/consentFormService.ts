/**
 * Génère un formulaire de consentement RGPD imprimable (HTML → PDF via navigateur)
 * À faire signer physiquement par chaque patient lors de la première consultation.
 */
import { app }       from 'electron'
import { join }      from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { getSettings }   from './settingsService'
import { getPatientById } from '../database/repositories/patientRepository'

function fmtDate(iso?: string | null): string {
  if (!iso) return '_____ / _____ / _______'
  const d = new Date(iso + 'T12:00:00')
  const M = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export function exportConsentForm(patientId?: string): string {
  const settings = getSettings()
  const patient  = patientId ? getPatientById(patientId) : null

  const practName     = settings.rgpdPractitionerName || (settings as any).practitionerFirstName ? `${(settings as any).practitionerFirstName || ''} ${(settings as any).practitionerLastName || ''}`.trim() : '_______________'
  const practEmail    = settings.rgpdPractitionerEmail || (settings as any).practitionerEmail || '_______________'
  const practAddress  = (settings as any).practitionerAddress || '_______________'
  const retentionYrs  = settings.dataRetentionYears || 10
  const today         = fmtDate(new Date().toISOString().slice(0, 10))

  const patName  = patient ? `${patient.first_name} ${patient.last_name}` : ''
  const patDOB   = patient?.birth_date ? fmtDate(patient.birth_date) : ''
  const patEmail = patient?.email || ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Formulaire de consentement RGPD${patient ? ` — ${escHtml(patName)}` : ''}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 12px; line-height: 1.6; color: #1a1a1a;
  max-width: 760px; margin: 0 auto; padding: 32px 40px;
}
h1 { font-size: 18px; font-weight: 800; color: #2d4a26; margin-bottom: 4px; }
h2 { font-size: 13px; font-weight: 800; color: #2d4a26; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1.5px solid #dde8db; padding-bottom: 4px; }
.header { border: 2px solid #2d4a26; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
.header-sub { color: #555; font-size: 11px; }
.info-grid { display: grid; grid-template-columns: 160px 1fr; gap: 3px 12px; margin: 8px 0; }
.info-label { font-weight: 700; color: #555; }
.section { margin-bottom: 16px; }
.highlight { background: #f0f5ef; border-left: 3px solid #4e7a45; border-radius: 0 6px 6px 0; padding: 10px 14px; margin: 8px 0; font-size: 11.5px; }
.rights-list { padding-left: 20px; }
.rights-list li { margin: 4px 0; }
.sign-block { border: 1.5px solid #ccc; border-radius: 8px; padding: 16px 20px; margin-top: 20px; }
.sign-row { display: flex; gap: 24px; margin-top: 10px; }
.sign-col { flex: 1; }
.sign-line { border-bottom: 1px solid #888; margin: 28px 0 4px; }
.sign-label { font-size: 10px; color: #777; text-align: center; }
.checkbox-row { display: flex; align-items: flex-start; gap: 10px; margin: 8px 0; font-size: 11.5px; }
.checkbox-box { width: 16px; height: 16px; border: 1.5px solid #555; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }
.footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
@media print {
  body { padding: 0; max-width: none; }
  @page { size: A4; margin: 18mm 14mm; }
}
</style>
</head>
<body>

<div class="header">
  <h1>Formulaire d'Information et de Consentement</h1>
  <div class="header-sub">Protection des données personnelles — Règlement Général sur la Protection des Données (RGPD)</div>
  <div style="margin-top:10px">
    <div class="info-grid">
      <span class="info-label">Praticien :</span><span>${escHtml(practName)}</span>
      <span class="info-label">Adresse :</span><span>${escHtml(practAddress)}</span>
      <span class="info-label">Email :</span><span>${escHtml(practEmail)}</span>
      <span class="info-label">Date du document :</span><span>${today}</span>
    </div>
  </div>
</div>

<!-- Identité du patient -->
<div class="section">
  <h2>Identité du patient</h2>
  <div class="info-grid">
    <span class="info-label">Nom et prénom :</span>
    <span>${patName ? escHtml(patName) : '<span style="border-bottom:1px solid #999;display:inline-block;min-width:240px">&nbsp;</span>'}</span>
    <span class="info-label">Date de naissance :</span>
    <span>${patDOB || '<span style="border-bottom:1px solid #999;display:inline-block;min-width:180px">&nbsp;</span>'}</span>
    <span class="info-label">Email :</span>
    <span>${patEmail ? escHtml(patEmail) : '<span style="border-bottom:1px solid #999;display:inline-block;min-width:240px">&nbsp;</span>'}</span>
  </div>
</div>

<!-- Données collectées -->
<div class="section">
  <h2>Données collectées et finalité</h2>
  <p>Dans le cadre de votre suivi, les données suivantes sont collectées et traitées :</p>
  <div class="highlight">
    <strong>Catégories de données :</strong> coordonnées (nom, prénom, date de naissance, téléphone, email, adresse), données de santé (antécédents médicaux, traitements en cours, séances de consultation, diagnostics, prescriptions).
  </div>
  <p style="margin-top:8px"><strong>Base légale :</strong> Art. 9 §2 h) du RGPD — traitement nécessaire à des fins de médecine préventive ou de médecine du travail, de diagnostic médical, de prise en charge sanitaire ou sociale.</p>
  <p style="margin-top:6px"><strong>Durée de conservation :</strong> ${retentionYrs} ans à compter de la dernière consultation, conformément au Code de la Santé Publique.</p>
</div>

<!-- Sécurité -->
<div class="section">
  <h2>Sécurité et confidentialité</h2>
  <p>Vos données sont stockées <strong>exclusivement sur l'ordinateur du praticien</strong>, chiffrées par un algorithme AES-256 de niveau bancaire. Elles ne sont <strong>jamais transmises à des tiers</strong>, ne font l'objet d'aucun traitement commercial et ne sont pas hébergées sur un serveur distant.</p>
</div>

<!-- Droits -->
<div class="section">
  <h2>Vos droits</h2>
  <p>Conformément au RGPD, vous disposez des droits suivants :</p>
  <ul class="rights-list">
    <li><strong>Droit d'accès</strong> (Art. 15) — obtenir une copie de vos données</li>
    <li><strong>Droit de rectification</strong> (Art. 16) — corriger des données inexactes</li>
    <li><strong>Droit à l'effacement</strong> (Art. 17) — demander la suppression de vos données, dans les limites légales</li>
    <li><strong>Droit d'opposition</strong> (Art. 21) — vous opposer à certains traitements</li>
    <li><strong>Droit à la portabilité</strong> (Art. 20) — recevoir vos données dans un format lisible</li>
  </ul>
  <p style="margin-top:8px">Pour exercer ces droits, contactez le praticien : <strong>${escHtml(practEmail)}</strong></p>
  <p style="margin-top:4px; font-size:11px; color:#555">En cas de réponse insatisfaisante, vous pouvez saisir la CNIL (www.cnil.fr) ou appeler le 01 53 73 22 22.</p>
</div>

<!-- Consentements -->
<div class="sign-block">
  <h2 style="margin-top:0">Déclaration de consentement</h2>
  <p style="margin-bottom:10px">Je soussigné(e) :</p>

  <div class="checkbox-row">
    <div class="checkbox-box"></div>
    <span>J'ai lu et compris les informations ci-dessus relatives à l'utilisation de mes données personnelles.</span>
  </div>
  <div class="checkbox-row">
    <div class="checkbox-box"></div>
    <span>Je consens à la collecte et au traitement de mes données personnelles et de santé dans le cadre de mon suivi par ${escHtml(practName)}, conformément à la base légale Art. 9 §2 h) du RGPD.</span>
  </div>
  <div class="checkbox-row">
    <div class="checkbox-box"></div>
    <span>Je consens à être contacté(e) par email pour des rappels de rendez-vous. <em>(optionnel)</em></span>
  </div>

  <div class="sign-row" style="margin-top:20px">
    <div class="sign-col">
      <div class="sign-label">Fait à</div>
      <div class="sign-line"></div>
      <div class="sign-label">Lieu</div>
    </div>
    <div class="sign-col">
      <div class="sign-label">Le</div>
      <div class="sign-line"></div>
      <div class="sign-label">Date</div>
    </div>
    <div class="sign-col" style="flex:2">
      <div class="sign-label">Signature du patient (précédée de "Lu et approuvé")</div>
      <div class="sign-line" style="margin-top:44px"></div>
      <div class="sign-label">Signature</div>
    </div>
  </div>
</div>

<div class="footer">
  <span>Synoria — Gestion de dossiers patients · ${escHtml(practName)}</span>
  <span>Document généré le ${today}</span>
</div>

</body>
</html>`

  const dir = join(app.getPath('userData'), 'exports')
  mkdirSync(dir, { recursive: true })
  const slug = patient ? `${patient.last_name}_${patient.first_name}` : 'vierge'
  const filePath = join(dir, `Consentement_RGPD_${slug}_${new Date().toISOString().slice(0,10)}.html`)
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}
