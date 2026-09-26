import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const origin = process.argv[2] ?? 'http://localhost:3100'
const output = `.context/wallowa-benchmarks/smoke-${Date.now()}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1, timezoneId: 'America/Los_Angeles' })
const page = await context.newPage()
await page.addInitScript(() => {
  window.__webglDraws = 0
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = WebGL2RenderingContext.prototype[name]
    WebGL2RenderingContext.prototype[name] = function (...args) {
      window.__webglDraws++
      return original.apply(this, args)
    }
  }
})
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

async function run(name, params = {}, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion })
  const query = new URLSearchParams({ bench: '1', duration: '2', warmup: '0', fps: '30', panel: 'off', ...params })
  await page.goto(`${origin}/wallowa?${query}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.wallowaBenchmark?.status().phase === 'complete', null, { timeout: 90000 })
  const { result, draws } = await page.evaluate(() => ({ result: window.wallowaBenchmark.result(), draws: window.__webglDraws }))
  assert.deepEqual(errors, [], name)
  assert.equal(result.valid, true, `${name}: ${result.invalidReasons}`)
  assert.equal(result.environment.mode, 'production')
  assert.equal(result.summary.calls.count, result.frames.length)
  const bakeDraws = result.marks['terrain-detail-baked']?.detail.passes ?? 0
  assert.equal(draws - bakeDraws, [...result.startupFrames, ...result.frames].reduce((sum, frame) => sum + frame.calls, 0), `${name}: multipass counters match actual WebGL draws`)
  assert(result.marks['bear-arrived'], name)
  if (params.scenario !== 'startup') assert.equal(result.summary.shadowUpdates, 0, `${name}: shadows settled`)
  await writeFile(`${output}/${name}.json`, JSON.stringify(result))
  await page.screenshot({ path: `${output}/${name}.png` })
  console.log(`PASS ${name}: ${result.frames.length} frames, ${result.gpuTiming.status} GPU timing, draw counts verified`)
  return result
}

try {
  const first = await run('baseline')
  const repeated = await run('repeat')
  assert.equal(first.sceneInventory.placementHash, repeated.sceneInventory.placementHash)
  assert.deepEqual(first.sceneInventory.instances, repeated.sceneInventory.instances)
  assert(first.summary.reflectionPasses >= 1 && first.summary.reflectionPasses < first.frames.length / 2, `scheduled reflections: ${first.summary.reflectionPasses}`)
  const every = await run('every', { reflection: 'every' })
  assert.equal(every.summary.reflectionPasses, every.frames.length)
  const frozen = await run('frozen', { reflection: 'frozen' })
  assert.equal(frozen.summary.reflectionPasses, 0)
  assert(frozen.summary.calls.median < every.summary.calls.median)
  const simple = await run('simple-reduced-motion', {
    terrain: 'simple', sky: 'simple', forest: '0.5', groundCover: '0', mist: 'off', shadows: 'off',
    reflectionWidth: '256', reflectionHeight: '128', reflectionSamples: '0', reflectionFps: '15',
  }, 'reduce')
  assert.equal(simple.sceneInventory.placementHash, first.sceneInventory.placementHash)
  assert.equal(simple.reflection.width, 256)
  assert.equal(simple.reflection.height, 128)
  assert(simple.summary.reflectionPasses < simple.frames.length)
  assert(simple.summary.renderedFps >= 27 && simple.summary.renderedFps <= 32)
  const startup = await run('startup', { scenario: 'startup', duration: '14', terrain: 'simple', sky: 'simple' })
  assert(startup.marks['first-input-frame-submitted']?.detail.latencyMs > 0)
  assert(startup.marks['first-input-frame-submitted'].time > startup.marks['core-first-frame-submitted'].time)
  await page.goto(`${origin}/wallowa?bench=1&duration=NaN`)
  await page.waitForFunction(() => window.wallowaBenchmark?.status().phase === 'complete')
  assert.equal(await page.evaluate(() => window.wallowaBenchmark.result().valid), false)
  await page.goto(`${origin}/wallowa`)
  await page.waitForSelector('canvas')
  assert.equal(await page.evaluate(() => typeof window.wallowaBenchmark), 'undefined')
  await page.waitForTimeout(4000)
  const cadence = await page.evaluate(() => new Promise((resolve) => {
    let rafs = 0
    let rendered = 0
    let last = window.__webglDraws
    const start = performance.now()
    requestAnimationFrame(function tick(now) {
      rafs++
      if (window.__webglDraws !== last) rendered++
      last = window.__webglDraws
      if (now - start < 3000) requestAnimationFrame(tick)
      else resolve({ rafFps: rafs / ((now - start) / 1000), renderedFps: rendered / ((now - start) / 1000) })
    })
  }))
  assert(cadence.renderedFps > 45 && cadence.renderedFps < 66, `normal route renders near 60 FPS: ${JSON.stringify(cadence)}`)
  console.log(`PASS normal route cadence: ${cadence.renderedFps.toFixed(1)} rendered FPS at ${cadence.rafFps.toFixed(1)} rAF/s`)
  assert.deepEqual(errors, [])
  console.log(`Smoke checks passed. Artifacts: ${output}`)
} finally {
  await browser.close()
}
