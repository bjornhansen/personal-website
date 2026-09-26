import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBenchmark, createRandom } from '../components/wallowa/benchmark/config.js'
import { createGpuTimer, summarizeFrames } from '../components/wallowa/benchmark/metrics.js'
import { analyze, formatReport } from './wallowa-benchmark-report.mjs'
import { createFrameCap } from '../components/wallowa/frameCap.js'
import { createReflectionSchedule } from '../components/wallowa/reflectionSchedule.js'

test('benchmark overrides are opt-in and invalid configurations are explicit', () => {
  assert.equal(parseBenchmark('?fps=30'), null)
  const baseline = parseBenchmark('?bench=1')
  assert.equal(baseline.seed, 1849)
  assert.equal(baseline.dpr, null)
  assert.deepEqual(baseline.errors, [])
  const invalid = parseBenchmark('?bench=1&dpr=NaN&duration=-1&reflectionWidth=720&sky=missing')
  assert.equal(invalid.errors.length, 4)
  assert.equal(invalid.dpr, null)
  assert.equal(parseBenchmark('?bench=1&reflectionSamples=0&forest=0').forest, 0)
})

test('seeded streams reproduce scene randomness independently', () => {
  const a = createRandom(1849)
  const b = createRandom(1849)
  const c = createRandom(1850)
  const first = Array.from({ length: 100 }, a)
  assert.deepEqual(first, Array.from({ length: 100 }, b))
  assert.notDeepEqual(first, Array.from({ length: 100 }, c))
  assert(first.every((n) => n >= 0 && n < 1))
})

test('cadence summaries exclude the first interval and honor a 30 FPS budget', () => {
  const frames = [null, 1000 / 30, 1000 / 30, 50].map((intervalMs) => ({
    intervalMs, cpuUpdateMs: 1, cpuSubmitMs: 2, cpuTotalMs: 3, gpuMs: null,
    calls: 80, triangles: 1000, reflectionPasses: 1, shadowUpdates: 0,
  }))
  const result = summarizeFrames(frames, 30)
  assert.equal(result.intervalMs.count, 3)
  assert.equal(result.missedIntervals, 1)
  assert.equal(result.gpuMs, null)
  assert.equal(result.reflectionPasses, 4)
  assert.equal(result.intervalMs.p95, 50)
  assert.equal(result.cpuTotalMs.mean, 3)
})

test('GPU results resolve asynchronously and disjoint samples are discarded', () => {
  let available = false
  let disjoint = false
  let deletes = 0
  const gl = {
    QUERY_RESULT_AVAILABLE: 'available', QUERY_RESULT: 'result',
    getExtension: () => ({ GPU_DISJOINT_EXT: 'disjoint', TIME_ELAPSED_EXT: 'time' }),
    getParameter: () => disjoint,
    createQuery: () => ({}), beginQuery() {}, endQuery() {},
    getQueryParameter: (_, key) => key === 'available' ? available : 2500000,
    deleteQuery: () => { deletes++ },
  }
  const timer = createGpuTimer(gl)
  const valid = { gpuMs: null }
  timer.begin(valid)
  timer.end()
  timer.poll()
  assert.equal(valid.gpuMs, null)
  available = true
  timer.poll()
  assert.equal(valid.gpuMs, 2.5)
  const invalid = { gpuMs: null }
  timer.begin(invalid)
  timer.end()
  disjoint = true
  timer.poll()
  assert.equal(invalid.gpuMs, null)
  assert.equal(timer.stats.discarded, 1)
  assert.equal(deletes, 2)
  assert.equal(createGpuTimer({ getExtension: () => null }).stats.status, 'unavailable')
})

test('reports pair each variant with its own baseline and exclude invalid runs', () => {
  const run = (group, pair, label, gpu, valid = true) => ({
    file: `${group}-${pair}-${label}.json`, group, pair, label, valid, invalidReasons: valid ? [] : ['tab-hidden'],
    summary: { gpuMs: { median: gpu, p95: gpu * 1.5 }, cpuTotalMs: { median: 2 }, renderedFps: 60, intervalMs: { p95: 17, p99: 18 }, missedRatio: 0.01, calls: { median: 90 }, triangles: { median: 5e6 } },
  })
  const report = analyze([
    run('fps-30', 1, 'baseline', 10), run('fps-30', 1, 'fps-30', 6),
    run('fps-30', 2, 'fps-30', 7), run('fps-30', 2, 'baseline', 11),
    run('fps-60', 1, 'baseline', 10), run('fps-60', 1, 'fps-60', 11),
    run('fps-60', 2, 'fps-60', 9), run('fps-60', 2, 'baseline', 10),
    run('fps-60', 3, 'baseline', 1, false), run('fps-60', 3, 'fps-60', 1),
  ])
  assert.equal(report.counts.invalid, 1)
  const [slower, faster] = report.comparisons
  assert.equal(slower.group, 'fps-30')
  assert.equal(slower.pairs, 2)
  assert.equal(slower.deltas.gpuMs.consistent, true)
  assert(Math.abs(slower.deltas.gpuMs.median - (-40 + -400 / 11) / 2) < 1e-9)
  assert.equal(faster.pairs, 2)
  assert.equal(faster.deltas.gpuMs.consistent, false)
  assert.equal(faster.deltas.missedPct.unit, 'pp')
  assert.equal(report.runs.baseline.gpuMs.n, 4)
  assert.match(formatReport(report), /\| fps-60 \| 2 \| .*\?/)
})

test('frame cap renders on whole vsyncs near 60 FPS for common refresh rates', () => {
  const rendered = (hz, targetFps = 60, frames = 240, lateEvery = 0) => {
    const cap = createFrameCap(targetFps)
    const times = []
    let now = 0
    for (let i = 0; i < frames; i++) {
      now += (1000 / hz) * (lateEvery && i % lateEvery === lateEvery - 1 ? 2 : 1)
      if (cap.tick(now)) times.push(now)
    }
    const settled = times.slice(-60)
    const intervals = settled.slice(1).map((t, i) => t - settled[i])
    return { cap, intervals }
  }
  const at = (hz, target) => rendered(hz, target).intervals.every((ms) => Math.abs(ms - 1000 / hz * rendered(hz, target).cap.divisor) < 1e-6)
  assert.equal(rendered(120).cap.divisor, 2)
  assert(at(120))
  assert.equal(rendered(60).cap.divisor, 1)
  assert(at(60))
  assert.equal(rendered(144).cap.divisor, 2)
  assert.equal(rendered(240).cap.divisor, 4)
  assert.equal(rendered(120, 30).cap.divisor, 4)
  assert.equal(rendered(120, 0).cap.divisor, 1)
  const late = rendered(120, 60, 240, 7).intervals
  assert(late.every((ms) => Math.abs(ms - 1000 / 60) < 1e-6 || Math.abs(ms - 1000 / 40) < 1e-6))
  assert(late.filter((ms) => Math.abs(ms - 1000 / 60) < 1e-6).length > late.length * 0.7)
})

test('reflection schedule refreshes on camera movement, turns, force, or age', () => {
  const schedule = createReflectionSchedule()
  const camera = { position: { x: 0, y: 28, z: 185 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }
  assert.equal(schedule.due(0, camera), true)
  assert.equal(schedule.due(16, camera), false)
  camera.position.x = 0.05
  assert.equal(schedule.due(33, camera), false)
  camera.position.x = 0.2
  assert.equal(schedule.due(50, camera), true)
  const half = 0.02 / 2
  camera.quaternion = { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
  assert.equal(schedule.due(66, camera), true)
  assert.equal(schedule.due(83, camera), false)
  assert.equal(schedule.due(100, camera, true), true)
  assert.equal(schedule.due(1099, camera), false)
  assert.equal(schedule.due(1100, camera), true)
  const fixed = createReflectionSchedule({ maxAgeMs: 1000 / 15 - 0.5, move: Infinity, turn: Infinity })
  const updates = Array.from({ length: 60 }, (_, i) => fixed.due(i * 1000 / 60, camera)).filter(Boolean).length
  assert.equal(updates, 15)
})
