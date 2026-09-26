import { parseArgs } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import { writeReport } from './wallowa-benchmark-report.mjs'

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000/wallowa' },
    experiment: { type: 'string', default: 'baseline' },
    scenario: { type: 'string', default: 'day' },
    repeat: { type: 'string', default: '3' },
    duration: { type: 'string', default: '60' },
    warmup: { type: 'string', default: '20' },
    width: { type: 'string', default: '1440' },
    height: { type: 'string', default: '900' },
    dpr: { type: 'string', default: '2' },
    timezone: { type: 'string', default: 'America/Los_Angeles' },
    cooldown: { type: 'string', default: '30' },
    channel: { type: 'string' },
    cache: { type: 'string', default: 'warm' },
    metadata: { type: 'string' },
    output: { type: 'string', default: '.context/wallowa-benchmarks' },
    'reduced-motion': { type: 'boolean', default: false },
    headless: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
  },
})

const numeric = (key, min, max) => {
  const n = Number(values[key])
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid --${key}`)
  return n
}
const width = Math.round(numeric('width', 320, 3840))
const height = Math.round(numeric('height', 320, 2160))
const dpr = numeric('dpr', 0.5, 3)
const repeat = Math.floor(numeric('repeat', 1, 20))
const duration = numeric('duration', 1, 900)
const warmup = numeric('warmup', 0, 120)
const cooldown = numeric('cooldown', 0, 600)
const experiments = {
  baseline: [],
  dpr: [{ dpr: 1 }],
  cadence: [{ fps: 0 }, { fps: 30 }],
  'terrain-bake': [{ terrain: 'procedural' }],
  'previous-default': [{ fps: 0, terrain: 'procedural', reflection: 'every' }],
  reflection: [{ reflection: 'frozen' }],
  'reflection-resolution': [{ reflectionScale: 0.25 }],
  'reflection-msaa': [{ reflectionSamples: 0 }],
  'reflection-cadence': [{ reflectionFps: 30 }, { reflectionFps: 15 }],
  'reflection-schedule': [{ reflection: 'every' }],
  terrain: [{ terrain: 'simple' }],
  sky: [{ sky: 'simple' }],
  forest: [{ forest: 0.5 }, { forest: 0 }],
  'ground-cover': [{ groundCover: 0.5 }, { groundCover: 0 }],
  shadows: [{ shadows: 'off' }],
  mist: [{ mist: 'off' }],
  overhead: [{ metrics: 'off' }],
}
if (!Object.hasOwn(experiments, values.experiment)) throw new Error(`Unknown experiment: ${Object.keys(experiments).join(', ')}`)
if (!['cold', 'warm'].includes(values.cache)) throw new Error('--cache must be cold or warm')
if (!['day', 'night', 'dawn', 'navigation', 'startup'].includes(values.scenario)) throw new Error('Unknown scenario')
const base = new URL(values.url)
for (const [key, value] of Object.entries({ bench: 1, scenario: values.scenario, duration, warmup, panel: 'off' })) {
  base.searchParams.set(key, value)
}
if (values.experiment === 'dpr') {
  base.searchParams.set('reflectionWidth', Math.round(width * Math.min(2, dpr) * 0.5))
  base.searchParams.set('reflectionHeight', Math.round(height * Math.min(2, dpr) * 0.5))
}

const runs = []
const variants = experiments[values.experiment]
const labelFor = (settings) => settings ? Object.entries(settings).map(([k, v]) => `${k}-${v}`).join('_') : 'baseline'
for (const variant of variants.length ? variants : [null]) {
  const group = labelFor(variant)
  for (let pair = 0; pair < repeat; pair++) {
    const members = variant ? (pair % 2 ? [variant, null] : [null, variant]) : [null]
    for (const settings of members) {
      const url = new URL(base)
      const label = labelFor(settings)
      for (const [key, value] of Object.entries(settings ?? {})) url.searchParams.set(key, value)
      url.searchParams.set('label', label)
      runs.push({ pair: pair + 1, group, label, url: url.href })
    }
  }
}

if (values.list) {
  console.log(JSON.stringify({ viewport: { width, height }, dpr, timezone: values.timezone, runs }, null, 2))
} else {
  const output = resolve(values.output, new Date().toISOString().replaceAll(':', '-'))
  await mkdir(output, { recursive: true })
  const metadata = values.metadata ? JSON.parse(await readFile(values.metadata, 'utf8')) : {}
  const browser = await chromium.launch({ headless: values.headless, channel: values.channel })
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dpr, timezoneId: values.timezone,
    reducedMotion: values['reduced-motion'] ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const summaries = []
  try {
    if (values.cache === 'warm') {
      console.log('Priming browser HTTP cache…')
      const prime = new URL(base)
      prime.searchParams.set('duration', '1')
      await page.goto(prime.href, { waitUntil: 'load' })
      await page.waitForFunction(() => window.wallowaBenchmark?.status().phase === 'complete', null, { timeout: 240000 })
      await page.goto('about:blank')
      await delay(cooldown * 1000)
    }
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]
      console.log(`[${i + 1}/${runs.length}] ${run.label} · pair ${run.pair}`)
      if (values.cache === 'cold') {
        await cdp.send('Network.clearBrowserCache')
        await cdp.send('Storage.clearDataForOrigin', { origin: base.origin, storageTypes: 'all' })
      }
      const errors = []
      const onError = (error) => errors.push(error.message)
      page.on('pageerror', onError)
      await page.goto(run.url, { waitUntil: 'load' })
      await page.waitForFunction(() => Boolean(window.wallowaBenchmark), null, { timeout: 60000 })
      await page.evaluate((metadata) => window.wallowaBenchmark.setMetadata(metadata), {
        ...metadata, browserVersion: browser.version(), cache: values.cache,
        network: metadata.network ?? 'unthrottled', runner: 'playwright-chromium',
        headless: values.headless, pair: run.pair, group: run.group, experiment: values.experiment,
      })
      await page.waitForFunction(() => window.wallowaBenchmark.status().phase === 'complete', null, { timeout: (duration + 200) * 1000 })
      const result = await page.evaluate(() => window.wallowaBenchmark.result())
      result.runnerErrors = errors
      if (errors.length) {
        result.valid = false
        result.invalidReasons.push('runner-observed-page-errors')
      }
      const prefix = `${String(i + 1).padStart(2, '0')}-${run.label}`
      await writeFile(resolve(output, `${prefix}.json`), JSON.stringify(result))
      await page.screenshot({ path: resolve(output, `${prefix}.png`) })
      summaries.push({ file: `${prefix}.json`, experiment: values.experiment, scenario: values.scenario, group: run.group, pair: run.pair, label: run.label, valid: result.valid, invalidReasons: result.invalidReasons, summary: result.summary })
      await writeFile(resolve(output, 'summary.json'), JSON.stringify(summaries, null, 2))
      page.off('pageerror', onError)
      console.log(`  ${result.valid ? 'valid' : 'INVALID'} · ${result.summary?.renderedFps?.toFixed(1) ?? 'unmeasured'} FPS · ${result.gpuTiming.status}`)
      await page.goto('about:blank')
      if (i < runs.length - 1) await delay(cooldown * 1000)
    }
  } finally {
    await browser.close()
  }
  if (summaries.length) console.log(`\n${await writeReport(output)}`)
  console.log(`Results: ${output}`)
}
