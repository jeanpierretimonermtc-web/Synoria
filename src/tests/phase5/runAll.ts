/**
 * Lanceur agrégé des tests Phase 5.
 * Exécuter :  npx tsx src/tests/phase5/runAll.ts
 */

import { runTests as pipeline } from './exportPipeline.test'

const suites: Array<[string, () => { passed: number; failed: number; failures: string[] }]> = [
  ['exportPipeline — intégration normalizer→builder (Phase 5)', pipeline],
]

let totalPassed = 0, totalFailed = 0
for (const [name, run] of suites) {
  const r = run()
  totalPassed += r.passed
  totalFailed += r.failed
  const status = r.failed === 0 ? 'OK  ' : 'FAIL'
  console.log(`[${status}] ${name}: ${r.passed} passed, ${r.failed} failed`)
  r.failures.forEach(f => console.error('       ✗ ' + f))
}

console.log(`\nTOTAL: ${totalPassed} passed, ${totalFailed} failed`)
if (totalFailed > 0 && typeof process !== 'undefined') process.exitCode = 1
