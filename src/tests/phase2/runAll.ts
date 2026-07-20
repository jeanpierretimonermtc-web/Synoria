/**
 * Lanceur agrégé des tests Phase 2 + non-régression Phase 1.
 * Exécuter :  npx tsx src/tests/phase2/runAll.ts
 */

import { runTests as normalizer } from '../sessionDataNormalizer.test'
import { runTests as builder } from './exportDocumentBuilder.test'
import { runTests as jsonExporter } from './sessionJsonExporter.test'
import { runTests as excelExporter } from './sessionExcelExporter.test'

const suites: Array<[string, () => { passed: number; failed: number; failures: string[] }]> = [
  ['sessionDataNormalizer (Phase 1)', normalizer],
  ['exportDocumentBuilder', builder],
  ['sessionJsonExporter', jsonExporter],
  ['sessionExcelExporter', excelExporter],
]

let totalPassed = 0, totalFailed = 0
for (const [name, run] of suites) {
  const r = run()
  totalPassed += r.passed
  totalFailed += r.failed
  const status = r.failed === 0 ? 'OK ' : 'FAIL'
  console.log(`[${status}] ${name}: ${r.passed} passed, ${r.failed} failed`)
  r.failures.forEach(f => console.error('       x ' + f))
}

console.log(`\nTOTAL: ${totalPassed} passed, ${totalFailed} failed`)
if (totalFailed > 0 && typeof process !== 'undefined') process.exitCode = 1
