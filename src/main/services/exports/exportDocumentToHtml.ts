/**
 * Rendu HTML d'un `ExportDocument` (Phase 2).
 *
 * Consomme UNIQUEMENT la structure `ExportDocument` : ne reconstruit ni ne
 * réinterprète les données de séance. Produit un HTML complet, autonome et
 * imprimable (CSS inline, format A4, gestion des sauts de page).
 *
 * Aucune dépendance Node.js.
 */

import type {
  ExportDocument, ExportSection, ExportBlock,
} from '../../../shared/exportDocumentTypes'

// ── Assainissement / échappement ────────────────────────────────────────────

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Assainit un fragment richtext (approche regex, pas de DOMParser côté Node). */
function sanitizeRich(html: string): string {
  if (!html) return ''
  let s = html
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  s = s.replace(/<object[\s\S]*?<\/object>/gi, '')
  s = s.replace(/<embed[^>]*\/?>/gi, '')
  s = s.replace(/<form[\s\S]*?<\/form>/gi, '')
  s = s.replace(/<input[^>]*\/?>/gi, '')
  s = s.replace(/<link[^>]*\/?>/gi, '')
  s = s.replace(/\s+on[a-z][a-z0-9]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  s = s.replace(/(href|src|action|data)\s*=\s*["']\s*javascript\s*:/gi, '$1="blocked:')
  s = s.replace(/style\s*=\s*"([^"]*)"/gi, (_m, v) => {
    if (/expression\s*\(|javascript\s*:|url\s*\(/i.test(v)) return ''
    return `style="${v}"`
  })
  return s
}

// ── Rendu des blocs ─────────────────────────────────────────────────────────

function renderBlock(block: ExportBlock): string {
  switch (block.type) {
    case 'text': {
      const content = block.isHtml ? sanitizeRich(block.content) : escHtml(block.content).replace(/\n/g, '<br>')
      return `<div class="row">${block.label ? `<span class="lbl">${escHtml(block.label)}</span>` : ''}<span class="val">${content}</span></div>`
    }
    case 'keyvalue':
      return `<div class="row"><span class="lbl">${escHtml(block.label)}</span><span class="val">${escHtml(block.value).replace(/\n/g, '<br>')}</span></div>`
    case 'list': {
      const items = block.items.map(i => `<li>${escHtml(i)}</li>`).join('')
      return `<div class="row"><span class="lbl">${escHtml(block.label ?? '')}</span><span class="val"><ul class="blk-list">${items}</ul></span></div>`
    }
    case 'table': {
      const head = block.columns.map(c => `<th>${escHtml(c)}</th>`).join('')
      const body = block.rows.map(r => `<tr>${r.map(c => `<td>${escHtml(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')
      return `<div class="blk-table-wrap">${block.label ? `<div class="blk-table-label">${escHtml(block.label)}</div>` : ''}<table class="blk-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
    }
    case 'bodychart': {
      const zones = block.zones.map(z => `<li>${escHtml(z)}</li>`).join('')
      const notes = block.notes ? `<div class="bodychart-notes">${escHtml(block.notes).replace(/\n/g, '<br>')}</div>` : ''
      return `<div class="row"><span class="lbl">${escHtml(block.label)}</span><span class="val"><ul class="blk-list">${zones}</ul>${notes}</span></div>`
    }
    case 'notice':
      return `<div class="notice notice-${block.severity}">${block.severity === 'warning' ? '⚠️ ' : 'ℹ️ '}${escHtml(block.text)}</div>`
    case 'pagebreak':
      return `<div class="pagebreak"></div>`
    case 'raw': {
      let json: string
      try { json = JSON.stringify(block.jsonValue, null, 2) } catch { json = String(block.jsonValue) }
      return `<div class="row raw"><span class="lbl">${escHtml(block.label)}</span><pre class="val raw-json">${escHtml(json)}</pre></div>`
    }
    default:
      return ''
  }
}

function renderSection(section: ExportSection): string {
  const blocks = section.blocks.map(renderBlock).join('')
  if (section.omitWhenEmpty && !section.blocks.length) return ''
  return `
  <div class="group">
    <div class="group-title">${escHtml(section.title)}</div>
    ${blocks}
  </div>`
}

// ── Document complet ────────────────────────────────────────────────────────

export function exportDocumentToHtml(doc: ExportDocument): string {
  const m = doc.metadata
  const issuesHtml = doc.issues.length
    ? `<div class="issues">${doc.issues.map(i => `<div class="notice notice-${i.severity === 'error' ? 'warning' : 'info'}">${escHtml(i.message)}</div>`).join('')}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escHtml(doc.title)}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px; line-height: 1.55; color: #222; background: #fff;
  max-width: 900px; margin: 0 auto; padding: 28px 32px;
}
.doc-header {
  background: linear-gradient(135deg, #2d4a26, #4e7a45); color: #fff;
  border-radius: 10px; padding: 20px 28px; margin-bottom: 22px;
  display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
}
.doc-title { font-size: 22px; font-weight: 800; letter-spacing: -.3px; margin-bottom: 3px; }
.doc-sub { font-size: 13px; opacity: .85; }
.doc-right { text-align: right; font-size: 11px; opacity: .85; line-height: 1.9; flex-shrink: 0; }
.confidential {
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.4);
  border-radius: 4px; padding: 2px 10px; font-size: 10px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase; margin-top: 4px; display: inline-block;
}
.group { margin-bottom: 14px; border-radius: 6px; overflow: hidden; border: 1px solid #eaefea; break-inside: avoid; page-break-inside: avoid; }
.group-title {
  background: #f0f5ef; font-size: 10.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .08em; color: #4e7a45; padding: 6px 12px; border-bottom: 1px solid #dde7db;
}
.row { display: flex; align-items: flex-start; gap: 10px; padding: 5px 12px; border-bottom: 1px solid #f2f5f2; font-size: 12.5px; }
.row:last-child { border-bottom: none; }
.lbl { min-width: 170px; max-width: 170px; flex-shrink: 0; font-weight: 700; color: #555; font-size: 11.5px; padding-top: 1px; }
.val { flex: 1; color: #1a1a1a; }
.val p { margin: 0 0 3px; }
.val ul, .blk-list { padding-left: 18px; margin: 2px 0; }
.val strong { font-weight: 700; }
.val em { font-style: italic; }
.blk-table-wrap { padding: 6px 12px; overflow-x: auto; }
.blk-table-label { font-weight: 700; color: #555; font-size: 11.5px; margin-bottom: 4px; }
.blk-table { border-collapse: collapse; width: 100%; font-size: 12px; }
.blk-table th, .blk-table td { border: 1px solid #dde7db; padding: 4px 8px; text-align: left; vertical-align: top; }
.blk-table th { background: #f0f5ef; color: #4e7a45; font-weight: 700; }
.notice { border-radius: 6px; padding: 8px 14px; font-size: 12px; margin: 8px 0; }
.notice-warning { background: #fff8e6; border: 1.5px solid #f59e0b; color: #7c4a03; font-weight: 700; }
.notice-info { background: #eef4fb; border: 1px solid #a9c7ea; color: #234; }
.bodychart-notes { margin-top: 5px; font-style: italic; color: #555; }
.raw-json { white-space: pre-wrap; word-break: break-word; font-family: 'Consolas', monospace; font-size: 11px; background: #f7f7f5; border-radius: 4px; padding: 6px 8px; color: #333; }
.pagebreak { break-after: page; page-break-after: always; height: 0; }
.doc-footer { margin-top: 28px; padding-top: 14px; border-top: 1.5px solid #d8e4d5; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
@media print {
  body { padding: 0; font-size: 12px; max-width: none; }
  .group { break-inside: avoid; page-break-inside: avoid; }
  @page { size: A4 portrait; margin: 18mm 14mm; }
}
</style>
</head>
<body>
<div class="doc-header">
  <div>
    <div class="doc-title">🌿 ${escHtml(doc.title)}</div>
    <div class="doc-sub">${escHtml(m.patientName)} · Séance du ${escHtml(m.sessionDate)}${m.practitioner ? ` · ${escHtml(m.practitioner)}` : ''}</div>
  </div>
  <div class="doc-right">
    Généré le ${escHtml(m.generatedAt.slice(0, 10))}<br>
    Synoria v${escHtml(m.appVersion)}${m.pluginName ? `<br>${escHtml(m.pluginName)}` : ''}
    <div class="confidential">🔒 Confidentiel</div>
  </div>
</div>
${issuesHtml}
${doc.sections.map(renderSection).join('')}
<div class="doc-footer">
  <span>Synoria v${escHtml(m.appVersion)} · ${escHtml(m.patientName)}</span>
  <span>Document confidentiel — usage médical exclusif</span>
</div>
</body>
</html>`
}
