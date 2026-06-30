import { existsSync, statSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import * as os from 'os'
import { app } from 'electron'
import { isDatabaseOpen, getDb } from '../database/connection'
import { getSettings } from './settingsService'
import { getRecentLogs } from './logService'
import { authFilePath, dbEncPath } from './authService'

export function generateSupportDoc(): string {
  const userData = app.getPath('userData')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Documentation — Rapport de diagnostic Synoria</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.55; background: #fff; }
  .cover { text-align: center; padding: 40px 0 32px; border-bottom: 2px solid #2d6a4f; margin-bottom: 28px; }
  .cover-logo { font-size: 36px; margin-bottom: 8px; }
  .cover-title { font-size: 22px; font-weight: 700; color: #2d6a4f; letter-spacing: .5px; margin-bottom: 4px; }
  .cover-sub { font-size: 13px; color: #555; margin-bottom: 16px; }
  .cover-meta { font-size: 10px; color: #888; }
  h2 { font-size: 13px; font-weight: 700; color: #2d6a4f; background: #eaf3ee; border-left: 4px solid #2d6a4f;
       padding: 6px 12px; margin: 24px 0 10px; border-radius: 0 4px 4px 0; page-break-after: avoid; }
  h3 { font-size: 11px; font-weight: 700; color: #1a1a2e; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { background: #f0f4f8; font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase;
       letter-spacing: .4px; padding: 5px 8px; text-align: left; border-bottom: 1px solid #dde; }
  td { padding: 5px 8px; border-bottom: 1px solid #eef; vertical-align: top; }
  td:first-child { font-family: 'Courier New', monospace; font-size: 10px; color: #2d6a4f; white-space: nowrap;
                   width: 210px; font-weight: 600; }
  td:nth-child(2) { color: #444; }
  td.warn { color: #b45309; }
  td.ok   { color: #2d6a4f; }
  .tag { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 700;
         margin-left: 4px; vertical-align: middle; }
  .tag-req  { background: #fee2e2; color: #b91c1c; }
  .tag-opt  { background: #dbeafe; color: #1d4ed8; }
  .tag-info { background: #e0f2fe; color: #0369a1; }
  .note { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 8px 12px;
          font-size: 10.5px; color: #78350f; margin: 10px 0 0; }
  .note strong { color: #92400e; }
  .section-intro { font-size: 11px; color: #555; margin-bottom: 8px; line-height: 1.5; }
  .footer { margin-top: 32px; border-top: 1px solid #dde; padding-top: 12px; text-align: center;
            font-size: 9.5px; color: #999; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-logo">🔧</div>
  <div class="cover-title">Rapport de diagnostic — Guide de lecture</div>
  <div class="cover-sub">Synoria — v${app.getVersion()}</div>
  <div class="cover-meta">Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} · support@synoria.fr</div>
</div>

<p class="section-intro">
Ce document décrit chaque ligne du rapport de diagnostic généré par l'application. Le rapport ne contient <strong>aucune donnée patient</strong>.
Il sert à identifier rapidement l'origine d'un problème technique.
Pour ouvrir le rapport : <em>Paramètres → Support → Générer le rapport de diagnostic</em>.
</p>

<h2>1. IDENTITÉ</h2>
<p class="section-intro">Informations sur la version de l'application et l'environnement d'exécution.</p>
<table>
  <tr><th>Ligne</th><th>Description</th></tr>
  <tr><td>Version app</td><td>Numéro de version de l'application (ex : <em>1.3.0</em>). À communiquer systématiquement au support.</td></tr>
  <tr><td>Date / heure</td><td>Horodatage de génération du rapport. Permet de corréler avec les journaux d'erreurs.</td></tr>
  <tr><td>Plateforme</td><td>Système d'exploitation : <em>win32</em> (Windows), <em>darwin</em> (macOS), <em>linux</em>. Suivi de l'architecture : <em>x64</em> (64 bits) ou <em>arm64</em>.</td></tr>
  <tr><td>OS release</td><td>Numéro de build précis du système. Sous Windows 11 : ex. <em>10.0.22631</em>. Utile pour identifier des bugs liés à une version spécifique de l'OS.</td></tr>
  <tr><td>Electron</td><td>Version du runtime Electron embarqué (ex : <em>28.x</em>). Détermine les API disponibles et les limites de sécurité.</td></tr>
  <tr><td>Node</td><td>Version de Node.js intégrée à Electron. Conditionne la compatibilité de modules comme <em>better-sqlite3</em>.</td></tr>
  <tr><td>Chrome</td><td>Version du moteur Chromium (rendu de l'interface). Impacte le comportement CSS et les API web disponibles.</td></tr>
  <tr><td>Mode portable</td><td><strong>non</strong> = installation standard. <strong>oui (chemin)</strong> = l'app tourne depuis une clé USB, les données sont stockées dans le dossier indiqué plutôt que dans AppData.</td></tr>
</table>

<h2>2. BASE DE DONNÉES</h2>
<p class="section-intro">État du fichier SQLite chiffré et statistiques anonymes. La base est chiffrée au repos (AES-256-GCM) et déchiffrée uniquement pendant la session active.</p>
<table>
  <tr><th>Ligne</th><th>Description</th></tr>
  <tr>
    <td>DB chiffrée</td>
    <td>
      <span class="tag tag-req">CRITIQUE</span><br>
      Indique si le fichier <em>mtc.sqlite.enc</em> existe dans le dossier de données.<br>
      <span class="ok">✅ oui</span> : normal en production, la base est protégée.<br>
      <span class="warn">⚠️ non</span> : soit c'est la toute première utilisation (avant tout mot de passe), soit le fichier a été supprimé accidentellement → risque de perte de données.
    </td>
  </tr>
  <tr>
    <td>Taille .enc</td>
    <td>Taille du fichier chiffré en Ko. Croît avec le nombre de séances. Un fichier anormalement petit (&lt; 10 Ko avec des données) peut indiquer une corruption.</td>
  </tr>
  <tr>
    <td>DB ouverte</td>
    <td>
      <span class="tag tag-info">SESSION</span><br>
      <span class="ok">✅ oui</span> : l'utilisateur est connecté, la base de travail est active.<br>
      <span class="warn">⚠️ non</span> : le rapport a été généré depuis l'écran de connexion ou après verrouillage. Les statistiques ci-dessous seront absentes.
    </td>
  </tr>
  <tr>
    <td>user_version</td>
    <td>Numéro de version du schéma SQLite. Doit correspondre à la dernière migration connue (ex : <em>14</em>). Une valeur inférieure indique que les migrations n'ont pas toutes été appliquées.</td>
  </tr>
  <tr>
    <td>Patients actifs</td>
    <td>Nombre de patients dont le champ <em>is_active = 1</em>. Les patients archivés ne sont pas comptés. Aucun nom ni prénom n'est inclus dans le rapport.</td>
  </tr>
  <tr>
    <td>Séances totales</td>
    <td>Nombre total d'enregistrements dans la table <em>sessions</em>, tous patients confondus.</td>
  </tr>
  <tr>
    <td>RDV totaux</td>
    <td>Nombre total d'entrées dans la table <em>appointments</em> (calendrier). Inclut RDV planifiés, réalisés et en attente.</td>
  </tr>
  <tr>
    <td>Dernière séance</td>
    <td>Date ISO (YYYY-MM-DD) de la séance la plus récente. Permet de vérifier que les données récentes sont bien présentes après une migration ou restauration.</td>
  </tr>
  <tr>
    <td>Dernière sauveg. générale</td>
    <td>Date et heure de la dernière sauvegarde générale chiffrée (.json.enc). <em>jamais</em> = aucune sauvegarde n'a encore été effectuée → recommander une sauvegarde immédiate.</td>
  </tr>
  <tr>
    <td>Dernière sauveg. auto</td>
    <td>Date de la dernière sauvegarde automatique (quotidienne au démarrage). <em>jamais</em> = la sauvegarde automatique n'a jamais déclenché ou est désactivée.</td>
  </tr>
</table>

<div class="note">
  <strong>🔒 Sécurité :</strong> Si <em>DB chiffrée = non</em> et <em>DB ouverte = non</em> simultanément, la base de données est inaccessible et potentiellement perdue. Vérifier la présence du fichier <em>mtc.sqlite.enc</em> dans le dossier de données.
</div>

<h2>3. CONFIGURATION</h2>
<p class="section-intro">Paramètres actifs de l'application au moment de la génération du rapport.</p>
<table>
  <tr><th>Ligne</th><th>Description</th></tr>
  <tr>
    <td>Plugin actif</td>
    <td>Identifiant et nom du plugin de formulaire chargé (ex : <em>mtc_jp (MTC — Formulaire intégré)</em>) ou <em>aucun</em> si le formulaire générique est actif. Le fichier <em>active.plugin.json</em> est la source.</td>
  </tr>
  <tr>
    <td>Sauveg. à la fermeture</td>
    <td><em>oui / non</em> — Si activé, une sauvegarde générale chiffrée est créée automatiquement à chaque fermeture de l'application.</td>
  </tr>
  <tr>
    <td>Sauveg. auto quotidienne</td>
    <td><em>oui / non</em> — Si activé, une sauvegarde est créée une fois par jour au démarrage (si pas encore faite ce jour-là).</td>
  </tr>
  <tr>
    <td>Conservation RGPD</td>
    <td>Durée de conservation configurée (en années, défaut : 10). Sert à calculer les alertes RGPD pour les dossiers inactifs depuis trop longtemps.</td>
  </tr>
  <tr>
    <td>Chemin sauveg. générale</td>
    <td><em>configuré / non configuré</em> — Si non configuré, les sauvegardes générales sont enregistrées dans le dossier de données par défaut.</td>
  </tr>
  <tr>
    <td>Chemin sauveg. patient</td>
    <td><em>configuré / non configuré</em> — Même logique pour les sauvegardes par patient.</td>
  </tr>
</table>

<h2>4. FICHIERS SYSTÈME</h2>
<p class="section-intro">Présence des fichiers critiques dans le dossier de données (<em>%AppData%\\Synoria\\</em> ou dossier portable).</p>
<table>
  <tr><th>Fichier</th><th>Rôle et état attendu</th></tr>
  <tr>
    <td>auth.json</td>
    <td>
      <span class="tag tag-req">CRITIQUE</span>
      Contient le sel PBKDF2 et le vérificateur chiffré du mot de passe.<br>
      <span class="ok">✅ présent</span> : normal si un mot de passe a été configuré.<br>
      <span class="warn">⚠️ absent</span> : l'application est en mode « première utilisation » (pas encore de mot de passe) ou le fichier a été supprimé → impossible de déverrouiller la base.
    </td>
  </tr>
  <tr>
    <td>encryption.key</td>
    <td>
      <span class="tag tag-req">CRITIQUE</span>
      Clé hexadécimale 32 octets utilisée pour chiffrer/déchiffrer les fichiers de <strong>sauvegarde</strong> (.json.enc). Distincte du mot de passe.<br>
      <span class="warn">⚠️ absent</span> : les sauvegardes existantes ne peuvent plus être restaurées et de nouvelles sauvegardes ne peuvent pas être créées.
    </td>
  </tr>
  <tr>
    <td>active.plugin.json</td>
    <td>
      <span class="tag tag-opt">OPTIONNEL</span>
      Définition du plugin de formulaire actif. <em>absent</em> = formulaire générique utilisé, c'est normal sans plugin installé.
    </td>
  </tr>
  <tr>
    <td>settings.json</td>
    <td>
      <span class="tag tag-req">CRITIQUE</span>
      Fichier de configuration général (chemins, facturation, RGPD, Google Calendar…).<br>
      <span class="warn">⚠️ absent</span> : l'application recrée ce fichier avec les valeurs par défaut au prochain démarrage, mais tous les paramètres personnalisés sont perdus.
    </td>
  </tr>
  <tr>
    <td>exports/ (taille)</td>
    <td>Taille totale du dossier d'exports (Excel, PDF factures, JSON séances, registre RGPD, rapports de diagnostic…). Utile pour identifier un dossier encombré ou vérifier que les exports sont bien générés.</td>
  </tr>
</table>

<h2>5. ERREURS RÉCENTES</h2>
<p class="section-intro">Dernières lignes du journal d'erreurs (<em>synoria.log</em> dans le dossier de données). Ce journal est alimenté uniquement par les erreurs critiques (authentification, changement de mot de passe).</p>
<table>
  <tr><th>Élément</th><th>Description</th></tr>
  <tr>
    <td>Aucun journal trouvé</td>
    <td><span class="ok">✅ Bonne nouvelle</span> : aucune erreur critique n'a été enregistrée. Le fichier <em>synoria.log</em> n'existe pas ou est vide.</td>
  </tr>
  <tr>
    <td>Ligne de journal</td>
    <td>Format : <em>[ISO-timestamp] [contexte] Message d'erreur</em><br>
    Exemples de contextes : <em>auth:setup</em> (création du mot de passe), <em>auth:changePassword</em> (modification du mot de passe).<br>
    Le contenu exact du message aide à identifier si l'erreur est liée au système de fichiers, aux droits, ou à une corruption de données.</td>
  </tr>
  <tr>
    <td>Rotation du journal</td>
    <td>Quand le fichier dépasse 500 Ko, il est renommé <em>synoria.log.old</em> et un nouveau journal est créé. Seules les 20 dernières lignes du journal courant sont incluses dans le rapport.</td>
  </tr>
</table>

<div class="note">
  <strong>📬 Envoi au support :</strong> Pour tout incident, générez le rapport (<em>Paramètres → Support → Générer le rapport de diagnostic</em>) et envoyez-le à <strong>support@synoria.fr</strong> avec une description du problème rencontré. Le rapport est un fichier texte sans données patients, il peut être ouvert dans n'importe quel éditeur.
</div>

<div class="footer">
  Synoria v${app.getVersion()} · Document généré le ${new Date().toLocaleDateString('fr-FR')} · support@synoria.fr
</div>

</body>
</html>`

  const exportsDir = join(userData, 'exports')
  mkdirSync(exportsDir, { recursive: true })
  const outPath = join(exportsDir, 'guide_rapport_diagnostic_synoria.html')
  writeFileSync(outPath, html, 'utf-8')
  return outPath
}

function folderSize(dir: string): number {
  if (!existsSync(dir)) return 0
  let total = 0
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      try {
        const st = statSync(full)
        total += st.isDirectory() ? folderSize(full) : st.size
      } catch {}
    }
  } catch {}
  return total
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
}

export function generateRecoveryDoc(): string {
  const userData = app.getPath('userData')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Mot de passe oublié — Synoria</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; line-height: 1.6; background: #fff; }

  .header { background: linear-gradient(135deg, #4A6741, #2A7A6A); color: #fff; padding: 28px 32px; border-radius: 0 0 12px 12px; margin-bottom: 28px; }
  .header-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header-sub   { font-size: 13px; opacity: .85; }
  .container    { padding: 0 32px 32px; max-width: 700px; margin: 0 auto; }

  .warning {
    background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 10px;
    padding: 16px 20px; margin-bottom: 24px;
  }
  .warning-title { font-size: 14px; font-weight: 700; color: #92400E; margin-bottom: 6px; }
  .warning-body  { font-size: 12px; color: #78350F; line-height: 1.7; }

  h2 { font-size: 15px; font-weight: 700; color: #2d6a4f; margin: 24px 0 14px;
       border-bottom: 2px solid #eaf3ee; padding-bottom: 6px; }

  .steps { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
  .step  { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px;
           border: 1px solid #DDE8DB; border-radius: 10px; background: #F9FCF8; }
  .step-num {
    background: #4A6741; color: #fff; border-radius: 50%;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 1px;
  }
  .step-title { font-weight: 700; font-size: 13px; color: #1a3a2a; margin-bottom: 4px; }
  .step-desc  { font-size: 11.5px; color: #4a5568; line-height: 1.6; }
  .step-path  {
    display: inline-block; margin-top: 6px; padding: 4px 10px;
    background: #1a1a2e; color: #7ee8a2; border-radius: 6px;
    font-family: 'Courier New', monospace; font-size: 10.5px; word-break: break-all;
  }
  .step-warn {
    display: inline-block; margin-top: 6px; padding: 4px 10px;
    background: #FEF3C7; color: #92400E; border-radius: 6px; font-size: 11px;
  }

  .no-backup { background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; }
  .no-backup-title { font-size: 13px; font-weight: 700; color: #991B1B; margin-bottom: 6px; }
  .no-backup-body  { font-size: 11.5px; color: #7F1D1D; line-height: 1.7; }

  .contact { background: #EAF0E8; border-radius: 10px; padding: 14px 18px; }
  .contact strong { color: #2d6a4f; }

  .footer { margin-top: 28px; border-top: 1px solid #dde; padding-top: 12px;
            text-align: center; font-size: 10px; color: #aaa; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .step { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-title">🔑 Mot de passe oublié — Procédure de récupération</div>
  <div class="header-sub">Synoria v${app.getVersion()} · support@synoria.fr</div>
</div>

<div class="container">

  <div class="warning">
    <div class="warning-title">⚠️ Il n'existe pas de récupération directe du mot de passe</div>
    <div class="warning-body">
      Le mot de passe chiffre la base de données en <strong>AES-256</strong>.
      Sans lui, la base est mathématiquement inaccessible — même pour le support Synoria.<br><br>
      <strong>La seule voie de récupération passe par une sauvegarde (.json.enc).</strong>
      Si vous avez des sauvegardes automatiques activées, la procédure ci-dessous permet de retrouver vos données.
    </div>
  </div>

  <h2>✅ Procédure de récupération (si vous avez une sauvegarde)</h2>

  <div class="steps">

    <div class="step">
      <div class="step-num">1</div>
      <div>
        <div class="step-title">Localisez votre dernière sauvegarde</div>
        <div class="step-desc">
          Trouvez le fichier <strong>.json.enc</strong> le plus récent dans votre dossier de sauvegardes.<br>
          Si vous avez configuré un chemin personnalisé, cherchez là-bas. Sinon, cherchez dans :
          <div class="step-path">${userData.replace(/\\/g, '\\\\')}\\exports\\</div>
          <div class="step-warn">⚠️ Conservez ce fichier en lieu sûr avant de continuer.</div>
        </div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div>
        <div class="step-title">Supprimez les fichiers de verrouillage</div>
        <div class="step-desc">
          Dans l'Explorateur Windows, naviguez vers le dossier de données de l'application :<br>
          <div class="step-path">${userData.replace(/\\/g, '\\\\')}</div>
          Supprimez (ou renommez) ces deux fichiers :
          <ul style="margin: 8px 0 0 16px; font-size: 11.5px; color: #4a5568;">
            <li><strong>auth.json</strong> — le vérificateur du mot de passe</li>
            <li><strong>database\\mtc.sqlite.enc</strong> — la base chiffrée (inaccessible sans le mot de passe)</li>
          </ul>
          <div class="step-warn">⚠️ L'application croira être en première utilisation au prochain démarrage.</div>
        </div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">3</div>
      <div>
        <div class="step-title">Créez un nouveau mot de passe</div>
        <div class="step-desc">
          Relancez l'application. L'écran de création de mot de passe apparaît (comme lors de la première installation).<br>
          Choisissez un nouveau mot de passe fort et <strong>notez-le immédiatement</strong>.
        </div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">4</div>
      <div>
        <div class="step-title">Importez votre sauvegarde</div>
        <div class="step-desc">
          Une fois connecté, allez dans <strong>Paramètres → Sauvegardes → Importer une sauvegarde</strong>.<br>
          Sélectionnez votre fichier <strong>.json.enc</strong>.<br><br>
          La sauvegarde est chiffrée avec une clé indépendante du mot de passe (le fichier <code>encryption.key</code>).
          Elle sera déchiffrée automatiquement et toutes vos données seront restaurées.
        </div>
      </div>
    </div>

  </div>

  <div class="no-backup">
    <div class="no-backup-title">❌ Sans sauvegarde disponible</div>
    <div class="no-backup-body">
      Si vous n'avez aucun fichier de sauvegarde <strong>.json.enc</strong>, les données sont définitivement perdues.<br>
      Aucune technique, aucun outil, aucun support ne peut déchiffrer la base sans le mot de passe original.<br><br>
      Pour éviter cette situation à l'avenir : <strong>Paramètres → Sauvegardes → activer "Sauvegarde à la fermeture" et "Sauvegarde quotidienne automatique"</strong>.
    </div>
  </div>

  <div class="contact">
    <strong>📬 Besoin d'aide ?</strong><br>
    Contactez le support à <strong>support@synoria.fr</strong> en joignant :
    votre fichier de sauvegarde <strong>.json.enc</strong> et le rapport de diagnostic
    (Paramètres → Support → Générer le rapport de diagnostic).
  </div>

  <div class="footer">
    Synoria v${app.getVersion()} · Document généré le ${new Date().toLocaleDateString('fr-FR')} · support@synoria.fr
  </div>

</div>
</body>
</html>`

  const exportsDir = join(userData, 'exports')
  mkdirSync(exportsDir, { recursive: true })
  const outPath = join(exportsDir, 'procedure_mot_de_passe_oublie.html')
  writeFileSync(outPath, html, 'utf-8')
  return outPath
}

export function generateDiagnosticReport(): string {
  const userData = app.getPath('userData')
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push('    RAPPORT DE DIAGNOSTIC — Synoria')
  lines.push('='.repeat(60))
  lines.push('')

  // ── 1. Identité ──────────────────────────────────────────────
  lines.push('── 1. IDENTITÉ ─────────────────────────────────────────────')
  try {
    lines.push(`Version app      : ${app.getVersion()}`)
    lines.push(`Date / heure     : ${new Date().toLocaleString('fr-FR')}`)
    lines.push(`Plateforme       : ${os.platform()} (${os.arch()})`)
    lines.push(`OS release       : ${os.release()}`)
    lines.push(`Electron         : ${process.versions.electron}`)
    lines.push(`Node             : ${process.versions.node}`)
    lines.push(`Chrome           : ${process.versions.chrome}`)
    const portable = process.env.PORTABLE_EXECUTABLE_DIR
    lines.push(`Mode portable    : ${portable ? 'oui (' + portable + ')' : 'non'}`)
  } catch (e) {
    lines.push(`[ERREUR section identité] ${e}`)
  }
  lines.push('')

  // ── 2. Base de données ───────────────────────────────────────
  lines.push('── 2. BASE DE DONNÉES ──────────────────────────────────────')
  try {
    const encPath = dbEncPath()
    const encExists = existsSync(encPath)
    lines.push(`DB chiffrée      : ${encExists ? 'oui' : 'non'}`)
    if (encExists) {
      const sz = statSync(encPath).size
      lines.push(`Taille .enc      : ${(sz / 1024).toFixed(1)} Ko`)
    }
    lines.push(`DB ouverte       : ${isDatabaseOpen() ? 'oui' : 'non'}`)
    if (isDatabaseOpen()) {
      try {
        const db = getDb()
        const version = db.pragma('user_version', { simple: true })
        lines.push(`user_version     : ${version}`)
        const activePatients = (db.prepare('SELECT COUNT(*) as n FROM patients WHERE is_active = 1').get() as any).n
        const totalSessions  = (db.prepare('SELECT COUNT(*) as n FROM sessions').get() as any).n
        const totalAppts     = (db.prepare('SELECT COUNT(*) as n FROM appointments').get() as any).n
        const lastSession    = (db.prepare('SELECT MAX(date) as d FROM sessions').get() as any).d
        lines.push(`Patients actifs  : ${activePatients}`)
        lines.push(`Séances totales  : ${totalSessions}`)
        lines.push(`RDV totaux       : ${totalAppts}`)
        lines.push(`Dernière séance  : ${lastSession || 'aucune'}`)
      } catch (e) {
        lines.push(`[ERREUR accès DB] ${e}`)
      }
    }
    try {
      const settings = getSettings()
      lines.push(`Dernière sauveg. générale : ${settings.lastGeneralBackup || 'jamais'}`)
      lines.push(`Dernière sauveg. auto     : ${settings.lastAutoBackup || 'jamais'}`)
    } catch {}
  } catch (e) {
    lines.push(`[ERREUR section DB] ${e}`)
  }
  lines.push('')

  // ── 3. Configuration ────────────────────────────────────────
  lines.push('── 3. CONFIGURATION ────────────────────────────────────────')
  try {
    const pluginPath = join(userData, 'active.plugin.json')
    if (existsSync(pluginPath)) {
      try {
        const plugin = JSON.parse(readFileSync(pluginPath, 'utf-8'))
        lines.push(`Plugin actif     : ${plugin.id} (${plugin.name})`)
      } catch {
        lines.push(`Plugin actif     : fichier invalide`)
      }
    } else {
      lines.push(`Plugin actif     : aucun`)
    }
    const settings = getSettings()
    lines.push(`Sauveg. à la fermeture   : ${settings.autoBackupOnClose ? 'oui' : 'non'}`)
    lines.push(`Sauveg. auto quotidienne : ${settings.autoBackupDaily ? 'oui' : 'non'}`)
    lines.push(`Conservation RGPD        : ${settings.dataRetentionYears ?? 10} ans`)
    lines.push(`Chemin sauveg. générale  : ${settings.backupGeneralPath ? 'configuré' : 'non configuré'}`)
    lines.push(`Chemin sauveg. patient   : ${settings.backupPatientPath ? 'configuré' : 'non configuré'}`)
  } catch (e) {
    lines.push(`[ERREUR section config] ${e}`)
  }
  lines.push('')

  // ── 4. Fichiers système ─────────────────────────────────────
  lines.push('── 4. FICHIERS SYSTÈME ─────────────────────────────────────')
  try {
    const files = [
      { name: 'auth.json',           path: authFilePath() },
      { name: 'encryption.key',      path: join(userData, 'encryption.key') },
      { name: 'active.plugin.json',  path: join(userData, 'active.plugin.json') },
      { name: 'settings.json',       path: join(userData, 'settings.json') },
    ]
    for (const f of files) {
      lines.push(`${f.name.padEnd(22)} : ${existsSync(f.path) ? 'présent' : 'absent'}`)
    }
    const exportsSz = folderSize(join(userData, 'exports'))
    lines.push(`exports/ (taille)      : ${(exportsSz / 1024).toFixed(1)} Ko`)
  } catch (e) {
    lines.push(`[ERREUR section fichiers] ${e}`)
  }
  lines.push('')

  // ── 5. Erreurs récentes ─────────────────────────────────────
  lines.push('── 5. ERREURS RÉCENTES ─────────────────────────────────────')
  try {
    const logs = getRecentLogs(20)
    if (logs.length === 0) {
      lines.push("Aucun journal d'erreurs trouvé.")
    } else {
      lines.push(...logs)
    }
  } catch (e) {
    lines.push(`[ERREUR lecture log] ${e}`)
  }
  lines.push('')
  lines.push('='.repeat(60))

  const exportsDir = join(userData, 'exports')
  mkdirSync(exportsDir, { recursive: true })
  const outPath = join(exportsDir, `diagnostic_synoria_${timestamp()}.txt`)
  writeFileSync(outPath, lines.join('\n'), 'utf-8')
  return outPath
}
