/**
 * Service de génération de factures PDF
 *
 * - Logo embarqué en base64 (aucune dépendance réseau)
 * - Palette de couleurs issue du logo (bleu marine / teal / or)
 * - Montant unique, sans décomposition TVA
 * - Numérotation ANNÉE-XXXX, remise à zéro chaque 1er janvier
 */

import { BrowserWindow, app } from 'electron'
import { writeFileSync, mkdirSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getSettings, saveSettings } from './settingsService'
import { addInvoiceLog } from '../database/repositories/comptaRepository'

// ── Types ─────────────────────────────────────────────────────────

export interface InvoiceData {
  patientFirstName: string
  patientLastName:  string
  patientAddress?:  string
  sessionDate:      string   // YYYY-MM-DD
  description:      string
  invoiceDate:      string   // YYYY-MM-DD
  montant:          number   // Montant total (pas de décomposition TVA)
}

export interface InvoiceResult {
  filePath:      string
  invoiceNumber: string
  montant:       number
}

// ── Numérotation ──────────────────────────────────────────────────

function getNextInvoiceNumber(): string {
  const settings = getSettings() as any
  const currentYear = String(new Date().getFullYear())
  const lastYear  = settings.lastInvoiceYear || ''
  let   lastNum   = typeof settings.lastInvoiceNumber === 'number' ? settings.lastInvoiceNumber : 0

  if (lastYear !== currentYear) lastNum = 0
  const nextNum = lastNum + 1
  saveSettings({ lastInvoiceNumber: nextNum, lastInvoiceYear: currentYear } as any)
  return `${currentYear}-${String(nextNum).padStart(4, '0')}`
}

// ── Logo (base64) ─────────────────────────────────────────────────

function getLogoDataUrl(): string {
  const candidates = [
    join(app.getAppPath(), 'dist', 'logo_entreprise.jpg'),
    join(__dirname, '../../dist/logo_entreprise.jpg'),
    join(__dirname, '../../../dist/logo_entreprise.jpg'),
    join(__dirname, '../../../public/logo_entreprise.jpg'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const b64 = readFileSync(p).toString('base64')
        return `data:image/jpeg;base64,${b64}`
      } catch { /* essayer suivant */ }
    }
  }
  return ''
}

// ── Helpers ───────────────────────────────────────────────────────

const euro = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

const frDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
}

// ── Palette issue du logo ──────────────────────────────────────────
// Bleu marine  #1A3A6B
// Teal         #2A7FA8
// Or/Doré      #C4973A
// Crème fond   #F9F7F4

// ── Template HTML ─────────────────────────────────────────────────

function buildHtml(data: InvoiceData, invoiceNum: string, logoDataUrl: string): string {
  const m = data.montant

  return /* html */`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: #2a2a2a;
    background: #fff;
    padding: 44px 52px;
  }

  /* ── Bande décorative haut ── */
  .top-bar {
    height: 6px;
    background: linear-gradient(90deg, #1A3A6B 0%, #2A7FA8 50%, #C4973A 100%);
    margin: -44px -52px 36px -52px;
  }

  /* ── En-tête ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    gap: 24px;
  }

  .prat-block { display: flex; align-items: flex-start; gap: 18px; }
  .prat-logo  { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; }
  .prat-logo-placeholder {
    width: 72px; height: 72px; border-radius: 12px;
    background: linear-gradient(135deg, #1A3A6B, #2A7FA8);
    flex-shrink: 0;
  }
  .prat-name     { font-size: 19px; font-weight: 800; color: #1A3A6B; margin-bottom: 3px; letter-spacing: -.3px; }
  .prat-activity { font-size: 11px; font-style: italic; color: #2A7FA8; margin-bottom: 12px; }
  .prat-info     { font-size: 11px; color: #555; line-height: 1.8; }
  .prat-info strong { color: #1A3A6B; }

  .inv-meta      { text-align: right; flex-shrink: 0; }
  .inv-title     { font-size: 30px; font-weight: 900; color: #1A3A6B; letter-spacing: -1px; margin-bottom: 6px; }
  .inv-num       { font-size: 14px; font-weight: 700; color: #2a2a2a; margin-bottom: 3px; }
  .inv-date      { font-size: 11px; color: #777; }

  /* ── Séparateur or ── */
  .gold-rule { border: none; border-top: 2px solid #C4973A; margin: 0 0 24px 0; }

  /* ── Bloc client ── */
  .client-wrap   { margin-bottom: 30px; }
  .section-lbl   {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .12em; color: #2A7FA8; margin-bottom: 7px;
  }
  .client-name    { font-size: 15px; font-weight: 700; color: #1A3A6B; }
  .client-address { font-size: 11px; color: #666; margin-top: 3px; line-height: 1.55; }

  /* ── Tableau ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead tr { background: #1A3A6B; }
  thead th {
    padding: 10px 16px; color: #fff;
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .08em; text-align: left;
  }
  thead th:not(:first-child) { text-align: right; }
  tbody tr { border-bottom: 1px solid #e8e4dc; }
  tbody tr:last-child { border-bottom: 2px solid #C4973A; }
  tbody td { padding: 14px 16px; vertical-align: top; }
  tbody td:not(:first-child) { text-align: right; }
  .td-main { font-weight: 600; color: #1A3A6B; margin-bottom: 4px; }
  .td-sub  { font-size: 10px; color: #888; }

  /* ── Total unique ── */
  .total-wrap { display: flex; justify-content: flex-end; margin-bottom: 36px; }
  .total-box {
    width: 260px;
    background: #1A3A6B;
    border-radius: 10px;
    padding: 16px 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .total-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.8); }
  .total-amount { font-size: 22px; font-weight: 900; color: #C4973A; letter-spacing: -.5px; }

  /* ── Règlement ── */
  .payment {
    background: #f5f2ec;
    border-left: 4px solid #C4973A;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px; margin-bottom: 36px;
    font-size: 11px; color: #555;
  }
  .payment strong { color: #1A3A6B; }

  /* ── Bande décorative bas + mentions légales ── */
  .footer-bar {
    border-top: 1px solid #ddd;
    padding-top: 18px;
    margin-top: 12px;
  }
  .footer-bar p { font-size: 9px; color: #999; line-height: 1.75; margin-bottom: 2px; }
  .footer-bar .lbl {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .1em; color: #2A7FA8; margin-bottom: 7px;
  }

  @media print {
    body { padding: 0; }
    .top-bar { margin: 0 0 24px 0; }
    @page { size: A4; margin: 14mm 18mm 18mm 18mm; }
  }
</style>
</head>
<body>

<div class="top-bar"></div>

<div class="header">
  <div class="prat-block">
    ${logoDataUrl
      ? `<img src="${logoDataUrl}" class="prat-logo" alt="Logo" />`
      : `<div class="prat-logo-placeholder"></div>`}
    <div>
      <div class="prat-name">JEAN-PIERRE TIMONER</div>
      <div class="prat-activity">Médecine Traditionnelle Chinoise — Acupuncture</div>
      <div class="prat-info">
        19 rue des moulins · 09000 FOIX<br>
        <strong>SIRET :</strong> 929 311 496 00012<br>
        <strong>Email :</strong> jeanpierre.timoner.mtc@gmail.com<br>
        <strong>Code APE :</strong> 8690F
      </div>
    </div>
  </div>
  <div class="inv-meta">
    <div class="inv-title">FACTURE</div>
    <div class="inv-num">N°&nbsp;${invoiceNum}</div>
    <div class="inv-date">Émise le ${frDate(data.invoiceDate)}</div>
  </div>
</div>

<hr class="gold-rule" />

<div class="client-wrap">
  <div class="section-lbl">Facturé à</div>
  <div class="client-name">${data.patientLastName.toUpperCase()}&nbsp;${data.patientFirstName}</div>
  ${data.patientAddress
    ? `<div class="client-address">${data.patientAddress.replace(/\n/g, '<br>')}</div>`
    : ''}
</div>

<table>
  <thead>
    <tr>
      <th style="width:58%">Désignation</th>
      <th>Quantité</th>
      <th>Date de séance</th>
      <th>Montant</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><div class="td-main">${data.description}</div></td>
      <td>1</td>
      <td>${frDate(data.sessionDate)}</td>
      <td>${euro(m)}</td>
    </tr>
  </tbody>
</table>

<div class="total-wrap">
  <div class="total-box">
    <span class="total-label">TOTAL À PAYER</span>
    <span class="total-amount">${euro(m)}</span>
  </div>
</div>

<div class="payment">
  <strong>Modalités de règlement :</strong>
  Espèces&nbsp;·&nbsp;Chèque&nbsp;·&nbsp;Virement bancaire&nbsp;·&nbsp;Wero
</div>

<div class="footer-bar">
  <div class="lbl">Mentions légales</div>
  <p>Auto-entrepreneur soumis au régime micro-BNC — JEAN-PIERRE TIMONER — SIRET 929&nbsp;311&nbsp;496&nbsp;00012</p>
  <p>TVA non applicable — article 293B du Code Général des Impôts.</p>
  <p>Dispensé d'immatriculation au Registre du Commerce et des Sociétés (RCS) et au Répertoire des Métiers (RM) — art. L123-1-1 et L130-1 du Code de Commerce.</p>
</div>

</body>
</html>`
}

// ── Génération ────────────────────────────────────────────────────

export async function generateInvoice(data: InvoiceData): Promise<InvoiceResult> {
  const invoiceNum  = getNextInvoiceNumber()
  const logoDataUrl = getLogoDataUrl()
  const html        = buildHtml(data, invoiceNum, logoDataUrl)

  const settings = getSettings() as any
  const dir = settings.invoicePath ||
    'C:\\Users\\timjp\\Desktop\\Entreprise\\Cabinet\\Comptabilité\\Facture 2026'
  mkdirSync(dir, { recursive: true })

  const slug     = `${data.patientLastName.toUpperCase()}_${data.patientFirstName}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
  const fileName = `Facture_${invoiceNum.replace('-', '_')}_${slug}.pdf`
  const filePath = join(dir, fileName)

  // Écriture dans un fichier temporaire (data: URL trop long avec logo base64)
  const tmpDir  = join(app.getPath('userData'), 'tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmpPath = join(tmpDir, `invoice_${Date.now()}.html`)
  writeFileSync(tmpPath, html, 'utf-8')

  const win = new BrowserWindow({
    show: false,
    width: 794, height: 1123,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false },
  })

  try {
    await new Promise<void>((resolve, reject) => {
      win.webContents.once('did-finish-load', resolve)
      win.webContents.once('did-fail-load', (_e, _c, desc) => reject(new Error(desc)))
      win.loadFile(tmpPath)
    })
    await new Promise(r => setTimeout(r, 700))
    const pdfBuf = await win.webContents.printToPDF({
      pageSize:        'A4',
      printBackground: true,
      margins: { marginType: 'none' },
    })
    writeFileSync(filePath, pdfBuf)
  } finally {
    try { win.close() } catch { /* ignore */ }
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }

  // Enregistrement dans le journal des factures
  try {
    addInvoiceLog({
      invoice_number:     invoiceNum,
      invoice_date:       data.invoiceDate,
      patient_first_name: data.patientFirstName,
      patient_last_name:  data.patientLastName,
      patient_address:    data.patientAddress,
      email:              data.email,
      phone:              data.phone,
      session_date:       data.sessionDate,
      description:        data.description,
      montant:            data.montant,
      file_path:          filePath,
    })
  } catch (e) { console.error('[Invoice] Erreur log DB:', e) }

  return { filePath, invoiceNumber: invoiceNum, montant: data.montant }
}
