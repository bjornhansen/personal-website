import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const probe = fileURLToPath(new URL('./wallowa-creek-probe.mjs', import.meta.url))
const seeds = [1849, 1, 2, 3, 5, 7, 9, 10, 19, 20]

function run(seed) {
  const out = execFileSync(process.execPath, ['--no-warnings', probe, String(seed)], { encoding: 'utf8' })
  return JSON.parse(out.trim().split('\n').pop())
}

for (const seed of seeds) {
  test(`creek route is valid for seed ${seed}`, () => {
    const r = run(seed)
    assert.equal(r.ok, true, 'a creek route was found')
    assert.ok(r.length >= 45, `route is long enough (${r.length})`)
    assert.ok(r.source[2] >= 3.5, `source sits above the lake (${r.source[2]})`)
    assert.ok(r.maxCut <= 2.2, `humps are not cut too deeply (${r.maxCut})`)
    assert.ok(r.maxStepDrop <= 0.5 + 1e-6, `bed never drops faster than the cap (${r.maxStepDrop})`)
    assert.ok(r.minFreeboard > 0.05, `water stays below the natural bank (${r.minFreeboard})`)
    assert.ok(r.minChannel >= 0.95, `channel keeps its minimum depth (${r.minChannel})`)
    assert.ok(r.mouth[0] < 40 && r.mouth[1] < 70, `mouth stays clear of the camp side (${r.mouth})`)
    assert.ok(r.routeMs + r.fieldMs < 250, `generation stays cheap (${r.routeMs + r.fieldMs} ms)`)
  })
}
