import { app }                 from 'electron'
import { join }                from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { getSettings }         from './settingsService'
import { getAllPatients }       from '../database/repositories/patientRepository'
import { getAllSessions }      from '../database/repositories/sessionRepository'
import type { Patient }        from '../../shared/types'

// ── Alertes de conservation ────────────────────────────────────────

export function getRgpdAlerts(): { nearRetention: Patient[]; overRetention: Patient[] } {
  const settings    = getSettings()
  const retention   = settings.dataRetentionYears ?? 10
  const patients    = getAllPatients()
  const sessions    = getAllSessions()
  const now         = new Date()

  // Date de la dernière séance par patient
  const lastSessionDate: Record<string, string> = {}
  for (const s of sessions) {
    if (!lastSessionDate[s.patient_id] || s.date > lastSessionDate[s.patient_id]) {
      lastSessionDate[s.patient_id] = s.date
    }
  }

  const nearRetention:  Patient[] = []
  const overRetention:  Patient[] = []

  for (const p of patients) {
    if (!p.is_active) continue
    const lastActivity = lastSessionDate[p.id] || p.created_at.slice(0, 10)
    const last  = new Date(lastActivity)
    const years = (now.getTime() - last.getTime()) / (365.25 * 24 * 3600 * 1000)

    if (years >= retention) {
      overRetention.push(p)
    } else if (years >= retention - 1) {
      nearRetention.push(p)
    }
  }

  return { nearRetention, overRetention }
}

// ── Registre des traitements (Art. 30 RGPD) ───────────────────────

export function exportTraitementRegister(): string {
  const settings  = getSettings()
  const patients  = getAllPatients()
  const sessions  = getAllSessions()
  const today     = new Date().toLocaleDateString('fr-FR')
  const name      = settings.rgpdPractitionerName  || '—'
  const email     = settings.rgpdPractitionerEmail || '—'
  const retention = settings.dataRetentionYears    ?? 10

  const totalPatients  = patients.length
  const activePatients = patients.filter(p => p.is_active).length
  const withConsent    = patients.filter(p => p.consent_given).length

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Registre des traitements RGPD — ${today}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10pt; color:#2C2C2C; padding:40px 56px; }
  h1 { font-size:20pt; font-weight:800; color:#3B6B3A; margin-bottom:4px; }
  .subtitle { font-size:11pt; color:#888; margin-bottom:32px; }
  h2 { font-size:13pt; font-weight:700; color:#3B6B3A; margin:24px 0 10px;
       border-bottom:2px solid #4A6741; padding-bottom:6px; }
  table { width:100%; border-collapse:collapse; margin:10px 0 20px; font-size:9.5pt; }
  th { background:#4A6741; color:white; padding:8px 12px; text-align:left; font-weight:600; }
  td { padding:7px 12px; border-bottom:1px solid #E8E4DC; vertical-align:top; }
  tr:nth-child(even) td { background:#F8F6F2; }
  .stat { display:inline-block; padding:8px 18px; background:#EDF4EC; border:1px solid #C0D8BC;
           border-radius:8px; margin:4px; font-size:10pt; }
  .stat strong { font-size:16pt; color:#3B6B3A; display:block; }
  .footer { margin-top:40px; padding-top:12px; border-top:1px solid #E0DDD8; font-size:9pt; color:#999; }
  .warn { background:#FEF8EE; border-left:4px solid #C17B2A; padding:10px 14px; border-radius:0 6px 6px 0; margin:10px 0; font-size:9.5pt; }
  @media print { body { padding:20px 30px; } }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
  <div>
    <h1>Registre des traitements</h1>
    <div class="subtitle">Article 30 du RGPD (Règlement UE 2016/679) — Généré le ${today}</div>
  </div>
  <div style="font-size:10pt;text-align:right;color:#666;">
    <div><strong>${name}</strong></div>
    <div>${email}</div>
  </div>
</div>

<h2>1. Responsable du traitement</h2>
<table>
  <tr><th style="width:30%">Champ</th><th>Valeur</th></tr>
  <tr><td>Nom / Raison sociale</td><td>${name || '— À compléter dans Paramètres RGPD —'}</td></tr>
  <tr><td>Adresse email</td><td>${email || '— À compléter dans Paramètres RGPD —'}</td></tr>
  <tr><td>Qualité</td><td>Praticien de santé</td></tr>
  <tr><td>Logiciel utilisé</td><td>Synoria v${app.getVersion()}</td></tr>
</table>

<h2>2. Activité de traitement — Dossiers patients</h2>
<table>
  <tr><th style="width:30%">Critère</th><th>Description</th></tr>
  <tr><td>Finalité du traitement</td><td>Gestion des dossiers patients dans le cadre de consultations thérapeutiques. Suivi médical, anamnèse, traitement, facturation.</td></tr>
  <tr><td>Base légale</td><td>Art. 9(2)(h) RGPD — Traitement nécessaire à des fins de médecine préventive ou de médecine du travail, de diagnostics médicaux, de prise en charge sanitaire.</td></tr>
  <tr><td>Catégories de personnes</td><td>Patients adultes et mineurs accompagnés de leurs représentants légaux.</td></tr>
  <tr><td>Catégories de données traitées</td><td>
    <strong>Données d'identité :</strong> nom, prénom, date de naissance, adresse, téléphone, email, profession.<br>
    <strong>Données de santé (Art. 9) :</strong> anamnèse, diagnostics, traitements, prescriptions, antécédents médicaux, notes cliniques.<br>
    <strong>Données de consentement :</strong> date et confirmation du consentement éclairé.
  </td></tr>
  <tr><td>Destinataires</td><td>Praticien uniquement. Aucune transmission à des tiers sans accord explicite du patient.</td></tr>
  <tr><td>Transferts hors UE</td><td>Aucun. Données stockées localement sur le poste du praticien ou clé USB personnelle.</td></tr>
  <tr><td>Durée de conservation</td><td>${retention} ans après la dernière consultation (configurable dans Paramètres RGPD).</td></tr>
</table>

<h2>3. Mesures de sécurité techniques et organisationnelles</h2>
<table>
  <tr><th style="width:30%">Mesure</th><th>Description</th></tr>
  <tr><td>Chiffrement des données</td><td>Base de données SQLite chiffrée avec AES-256-GCM. Clé dérivée du mot de passe via PBKDF2 (600 000 itérations, SHA-256).</td></tr>
  <tr><td>Contrôle d'accès</td><td>Authentification par mot de passe obligatoire au démarrage. Verrouillage automatique après 20 minutes d'inactivité.</td></tr>
  <tr><td>Sauvegardes</td><td>Sauvegardes chiffrées AES-256-GCM. Rétention configurable (${settings.backupRetentionDays} jours).</td></tr>
  <tr><td>Journal d'accès</td><td>Journalisation horodatée de toutes les consultations de dossiers.</td></tr>
  <tr><td>Localisation des données</td><td>100% local — aucune donnée transmise sur Internet ou stockée dans un cloud.</td></tr>
  <tr><td>Intégrité</td><td>HMAC d'intégrité intégré dans le chiffrement GCM (authentification des données).</td></tr>
</table>

<h2>4. Statistiques au ${today}</h2>
<div>
  <span class="stat"><strong>${totalPatients}</strong> patients total</span>
  <span class="stat"><strong>${activePatients}</strong> patients actifs</span>
  <span class="stat"><strong>${sessions.length}</strong> séances enregistrées</span>
  <span class="stat"><strong>${withConsent}</strong> consentements collectés</span>
  <span class="stat"><strong>${totalPatients - withConsent}</strong> consentements manquants</span>
</div>

${totalPatients - withConsent > 0 ? `
<div class="warn" style="margin-top:14px;">
  ⚠️ <strong>${totalPatients - withConsent} patient(s)</strong> sans consentement documenté.
  Pensez à recueillir et enregistrer leur consentement lors de la prochaine consultation.
</div>` : '<div style="margin-top:14px;padding:10px 14px;background:#EDF4EC;border-left:4px solid #4A6741;border-radius:0 6px 6px 0;font-size:9.5pt;">✅ Tous les patients actifs ont un consentement documenté.</div>'}

<h2>5. Droits des personnes concernées</h2>
<p style="font-size:9.5pt;color:#555;line-height:1.7;margin-bottom:10px;">
  Conformément aux articles 15 à 22 du RGPD, les patients bénéficient des droits suivants :
</p>
<table>
  <tr><th style="width:25%">Droit</th><th>Modalité d'exercice</th></tr>
  <tr><td>Accès (Art. 15)</td><td>Sur demande écrite à ${email || '[email du praticien]'}. Réponse sous 1 mois.</td></tr>
  <tr><td>Rectification (Art. 16)</td><td>Mise à jour directe dans le dossier lors de la consultation ou sur demande.</td></tr>
  <tr><td>Effacement (Art. 17)</td><td>Suppression du dossier dans le logiciel sur demande, sous réserve des obligations légales de conservation.</td></tr>
  <tr><td>Portabilité (Art. 20)</td><td>Export JSON ou Excel disponible depuis la page Résumé du logiciel.</td></tr>
  <tr><td>Opposition (Art. 21)</td><td>Contacter le praticien à ${email || '[email du praticien]'}.</td></tr>
  <tr><td>Réclamation</td><td>Auprès de la CNIL : www.cnil.fr</td></tr>
</table>

<div class="footer">
  Document généré automatiquement par Synoria v${app.getVersion()} — ${today}<br>
  Ce registre doit être conservé et mis à jour régulièrement (Art. 30 RGPD).
</div>

</body>
</html>`

  const dir      = join(app.getPath('userData'), 'exports')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `registre-traitements-RGPD-${new Date().toISOString().slice(0, 10)}.html`)
  writeFileSync(filePath, html, 'utf8')
  return filePath
}
