const fs = require('fs')
const path = require('path')

const root = process.cwd()
const inputDir = path.join(root, 'documentation_synoria')
const outputDir = path.join(root, 'documentation_synoria_html')

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inlineMarkdown(value) {
  let html = escapeHtml(value)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return html
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function parseTable(lines, start) {
  const rows = []
  let i = start
  while (i < lines.length && lines[i].trim().includes('|')) {
    if (!isTableSeparator(lines[i])) {
      const row = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '')
        .split('|')
        .map(cell => inlineMarkdown(cell.trim()))
      rows.push(row)
    }
    i++
  }
  if (rows.length < 1) return null
  const head = rows[0]
  const body = rows.slice(1)
  const html = [
    '<table>',
    '<thead><tr>' + head.map(cell => `<th>${cell}</th>`).join('') + '</tr></thead>',
    '<tbody>',
    ...body.map(row => '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'),
    '</tbody>',
    '</table>',
  ].join('\n')
  return { html, next: i }
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let inCode = false
  let codeLang = ''
  let codeLines = []

  function closeCode() {
    out.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    inCode = false
    codeLang = ''
    codeLines = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (inCode) {
        closeCode()
      } else {
        inCode = true
        codeLang = trimmed.slice(3).trim()
        codeLines = []
      }
      i++
      continue
    }

    if (inCode) {
      codeLines.push(line)
      i++
      continue
    }

    if (!trimmed) {
      i++
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const level = heading[1].length
      const text = heading[2].trim()
      const id = slugify(text)
      out.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`)
      i++
      continue
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const table = parseTable(lines, i)
      if (table) {
        out.push(table.html)
        i = table.next
        continue
      }
    }

    if (/^-{3,}$/.test(trimmed)) {
      out.push('<hr>')
      i++
      continue
    }

    if (/^-\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^-\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>\n${items.join('\n')}\n</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>\n${items.join('\n')}\n</ol>`)
      continue
    }

    const para = [trimmed]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('```') &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i].trim())
      i++
    }
    out.push(`<p>${inlineMarkdown(para.join(' '))}</p>`)
  }

  if (inCode) closeCode()
  return out.join('\n')
}

const css = `
:root {
  --ink: #1f2933;
  --muted: #65717f;
  --line: #d9e0e7;
  --soft: #f5f7f8;
  --brand: #315c4f;
  --brand-2: #486f66;
  --accent: #b07b43;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--ink);
  background: #eef2f3;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.65;
}
.page {
  width: min(980px, calc(100% - 32px));
  margin: 24px auto;
  background: #fff;
  box-shadow: 0 18px 60px rgba(20, 30, 40, .12);
}
.cover {
  padding: 54px 64px 42px;
  color: #fff;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
}
.cover .label {
  text-transform: uppercase;
  letter-spacing: .08em;
  font-size: 12px;
  opacity: .78;
  font-weight: 700;
}
.cover h1 {
  margin: 8px 0 12px;
  color: #fff;
  border: 0;
  font-size: 34px;
  line-height: 1.15;
}
.cover .meta {
  font-size: 14px;
  opacity: .85;
}
main {
  padding: 44px 64px 58px;
}
h1, h2, h3, h4 {
  color: var(--brand);
  line-height: 1.25;
}
h1 {
  font-size: 30px;
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 3px solid var(--brand);
}
h2 {
  font-size: 22px;
  margin: 34px 0 12px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--line);
}
h3 { font-size: 18px; margin: 26px 0 10px; }
h4 { font-size: 16px; margin: 22px 0 8px; }
p { margin: 0 0 13px; }
ul, ol { margin: 8px 0 18px 26px; padding: 0; }
li { margin: 4px 0; }
code {
  background: #f1f4f6;
  border: 1px solid #dce3e8;
  border-radius: 5px;
  padding: 1px 5px;
  font-family: Consolas, "Courier New", monospace;
  font-size: .92em;
}
pre {
  overflow-x: auto;
  padding: 14px 16px;
  background: #17212b;
  color: #eef6ff;
  border-radius: 8px;
  margin: 14px 0 20px;
}
pre code {
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 22px;
  font-size: 14px;
}
th {
  background: var(--brand);
  color: #fff;
  text-align: left;
  padding: 9px 11px;
}
td {
  border-bottom: 1px solid var(--line);
  padding: 9px 11px;
  vertical-align: top;
}
tr:nth-child(even) td { background: var(--soft); }
a { color: #1d5f91; }
hr {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 28px 0;
}
.toc {
  margin: 0;
  padding: 22px 64px 26px;
  background: #f7faf9;
  border-bottom: 1px solid var(--line);
}
.toc h2 {
  margin: 0 0 10px;
  font-size: 17px;
  border: 0;
}
.toc a {
  display: block;
  padding: 3px 0;
  color: var(--ink);
  text-decoration: none;
}
.footer {
  padding: 18px 64px 30px;
  color: var(--muted);
  font-size: 12px;
  border-top: 1px solid var(--line);
}
@media print {
  @page { size: A4; margin: 14mm; }
  body { background: #fff; font-size: 11pt; }
  .page { width: auto; margin: 0; box-shadow: none; }
  .cover { padding: 28mm 16mm 18mm; }
  main { padding: 12mm 0 0; }
  .toc { padding: 10mm 0; }
  .footer { padding: 8mm 0 0; }
  h1, h2, h3 { page-break-after: avoid; }
  table, pre, ul, ol { page-break-inside: avoid; }
}
`

function titleFromMarkdown(markdown, fallback) {
  const match = /^#\s+(.+)$/m.exec(markdown)
  return match ? match[1].trim() : fallback
}

function documentHtml(title, body, sourceName) {
  const headings = [...body.matchAll(/<h2 id="([^"]+)">(.+?)<\/h2>/g)]
  const toc = headings.length
    ? `<nav class="toc"><h2>Sommaire</h2>${headings.map(h => `<a href="#${h[1]}">${h[2].replace(/<[^>]+>/g, '')}</a>`).join('')}</nav>`
    : ''

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <article class="page">
    <header class="cover">
      <div class="label">Documentation Synoria</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Version de travail 1.5.0 - Source : ${escapeHtml(sourceName)}</div>
    </header>
    ${toc}
    <main>
${body}
    </main>
    <footer class="footer">Document genere automatiquement depuis les sources Markdown Synoria.</footer>
  </article>
</body>
</html>
`
}

fs.mkdirSync(outputDir, { recursive: true })

const markdownFiles = fs.readdirSync(inputDir)
  .filter(file => file.toLowerCase().endsWith('.md'))
  .sort()

const indexItems = []
const combinedSections = []

for (const file of markdownFiles) {
  const source = path.join(inputDir, file)
  const markdown = fs.readFileSync(source, 'utf8')
  const title = titleFromMarkdown(markdown, file.replace(/\.md$/i, ''))
  const body = markdownToHtml(markdown)
  const outName = file.replace(/\.md$/i, '.html')
  const outPath = path.join(outputDir, outName)
  fs.writeFileSync(outPath, documentHtml(title, body, file), 'utf8')
  indexItems.push({ title, outName })
  combinedSections.push(`<section class="doc-section">\n${body}\n</section>`)
}

const indexBody = [
  '<h1>Documentation Synoria</h1>',
  '<p>Documents HTML generes depuis les manuels Markdown.</p>',
  '<ul>',
  ...indexItems.map(item => `<li><a href="${item.outName}">${escapeHtml(item.title)}</a></li>`),
  '</ul>',
].join('\n')
fs.writeFileSync(path.join(outputDir, 'index.html'), documentHtml('Documentation Synoria', indexBody, 'index'), 'utf8')

fs.writeFileSync(
  path.join(outputDir, 'Synoria_Documentation_complete.html'),
  documentHtml('Documentation Synoria complete', combinedSections.join('\n<hr>\n'), 'documentation_synoria/*.md'),
  'utf8',
)

console.log(`Generated ${markdownFiles.length + 2} HTML files in ${outputDir}`)
