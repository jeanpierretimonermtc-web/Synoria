/**
 * Lanceur des tests Phase 7 — Formulaires officiels fixes.
 * Exécuter : npx tsx src/tests/phase7/runAll.ts
 */

import { runTests as officialForms } from './officialForms.test'

const suites: Array<[string, () => { passed: number; failed: number; failures: string[] }]> = [
  ['officialForms — 6 formulaires officiels fixes (Phase 7)', officialForms],
]

let totalPassed = 0, totalFailed = 0
for (const [name, run] of suites) {
  const r = run()
  totalPassed += r.passed
  totalFailed += r.failed
  const status = r.failed === 0 ? 'OK  ' : 'FAIL'
  console.log(`\n[${status}] ${name}: ${r.passed} passed, ${r.failed} failed`)
  r.failures.forEach(f => console.error('       ✗ ' + f))
}

console.log(`\nTOTAL: ${totalPassed} passed, ${totalFailed} failed`)
if (totalFailed > 0 && typeof process !== 'undefined') process.exitCode = 1
