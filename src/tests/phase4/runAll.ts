/**
 * Lanceur agrégé des tests Phase 4.
 * Exécuter :  npx tsx src/tests/phase4/runAll.ts
 */

import { runTests as registry } from './moduleRegistry.test'

const suites: Array<[string, () => { passed: number; failed: number; failures: string[] }]> = [
  ['moduleRegistry + adapters (Phase 4)', registry],
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
