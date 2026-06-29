/**
 * Script de build sécurisé pour "Synoria utilisation cabinet"
 * Copie les sources depuis synoria_test, préserve les identifiants du cabinet,
 * bumpe la version et lance le build.
 * 
 * Usage : node scripts/build-cabinet.js [version]
 * Ex :    node scripts/build-cabinet.js 1.5.2
 */
const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SRC = path.resolve(__dirname, '..')
const DST = path.resolve(__dirname, '../../Synoria utilisation cabinet')

// ── Identifiants cabinet — NE JAMAIS CHANGER ────────────────────────
const CABINET_APPID    = 'com.synoria.cabinet'
const CABINET_NAME     = 'Synoria'
const CABINET_GUID     = 'C7A3F1E2-9B4D-4E8F-A2C6-D5F7E0B2C4A8'
const CABINET_UNINST   = 'Synoria'

// ── Version ──────────────────────────────────────────────────────────
const newVersion = process.argv[2]
if (!newVersion) {
  console.error('Usage: node scripts/build-cabinet.js <version>')
  console.error('Ex:    node scripts/build-cabinet.js 1.5.2')
  process.exit(1)
}

console.log(`\n🔨 Build cabinet Synoria v${newVersion}\n`)

// ── 1. Copier src/ et public/ ────────────────────────────────────────
console.log('📁 Copie des sources...')
;['src', 'public'].forEach(dir => {
  // robocopy exit codes < 8 = succès (1 = fichiers copiés, 0 = rien à faire)
  try {
    execSync(`robocopy "${path.join(SRC, dir)}" "${path.join(DST, dir)}" /E /PURGE /NP /NJH /NJS /NFL /NDL`, { stdio: 'ignore' })
  } catch (e) { if ((e.status || 0) >= 8) throw e }
})
fs.copyFileSync(path.join(SRC, 'tsconfig.json'),  path.join(DST, 'tsconfig.json'))
fs.copyFileSync(path.join(SRC, 'vite.config.ts'), path.join(DST, 'vite.config.ts'))
console.log('✓ Sources copiées')

// ── 2. Générer package.json avec identifiants stables ───────────────
console.log('📦 Génération package.json cabinet...')
const src = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'))

src.version              = newVersion
src.build.appId          = CABINET_APPID
src.build.productName    = CABINET_NAME
src.build.nsis.guid      = CABINET_GUID
src.build.nsis.uninstallDisplayName = CABINET_UNINST
src.build.nsis.shortcutName         = CABINET_NAME

// S'assurer que deleteAppDataOnUninstall est false (protection données)
src.build.nsis.deleteAppDataOnUninstall = false

// Supprimer les cibles mac du build cabinet Windows (on build mac via CI)
// Garder uniquement la config win pour le build local

const out = JSON.stringify(src, null, 2)
// Écriture sans BOM (critique pour JSON/Node.js)
fs.writeFileSync(path.join(DST, 'package.json'), out, { encoding: 'utf8' })
console.log(`✓ package.json v${newVersion} (appId: ${CABINET_APPID}, GUID: ${CABINET_GUID})`)

// ── 3. Vérification TypeScript ───────────────────────────────────────
console.log('🔍 Vérification TypeScript...')
try {
  execSync(`npx tsc -p "${path.join(DST, 'tsconfig.json')}" --noEmit`, { cwd: DST, stdio: 'pipe' })
  console.log('✓ TypeScript OK')
} catch (e) {
  console.error('❌ Erreur TypeScript :', e.stdout?.toString() || e.message)
  process.exit(1)
}

// ── 4. Build ─────────────────────────────────────────────────────────
console.log('⚙️  Build electron...')
execSync('npm run electron:build', { cwd: DST, stdio: 'inherit' })

// ── 5. Copier dans release/ ──────────────────────────────────────────
const relDir = path.join(SRC, 'release', `V${newVersion}`)
fs.mkdirSync(relDir, { recursive: true })
const cabinetRelease = path.join(DST, 'release')
const files = fs.readdirSync(cabinetRelease).filter(f =>
  f.includes(newVersion) && (f.endsWith('.exe') || f.endsWith('.yml'))
)
files.forEach(f => {
  fs.copyFileSync(path.join(cabinetRelease, f), path.join(relDir, f))
  console.log(`✓ Copié : ${f}`)
})

console.log(`\n✅ Build cabinet v${newVersion} terminé`)
console.log(`📂 Fichiers : release/V${newVersion}/`)
