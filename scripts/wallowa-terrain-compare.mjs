import { chromium } from 'playwright'

const origin = process.argv[2] ?? 'http://localhost:3100'
const views = [null, 'building', 'background', 'contact']
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles' })
const page = await context.newPage()

async function captureAll(terrain) {
  const query = new URLSearchParams({ bench: '1', duration: '2', warmup: '0', panel: 'off', camera: 'fixed', reflection: 'frozen', terrain })
  await page.goto(`${origin}/wallowa?${query}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.wallowaBenchmark?.status().phase === 'complete', null, { timeout: 120000 })
  const captures = []
  for (const view of views) {
    if (view) await page.click(`button[data-wallowa-section="${view}"]`)
    captures.push(await page.evaluate(() => window.wallowaBenchmark.capture(16)))
  }
  return captures
}

function compare(a, b) {
  let diff = 0
  let lower = 0
  let lowerCount = 0
  let detailA = 0
  let detailB = 0
  let large = 0
  a.blocks.forEach((block, i) => {
    const other = b.blocks[i]
    const d = (Math.abs(block[0] - other[0]) + Math.abs(block[1] - other[1]) + Math.abs(block[2] - other[2])) / 3
    diff += d
    if (d > 8) large++
    if (Math.floor(i / a.cols) < a.rows * 0.5) {
      lower += d
      lowerCount++
      detailA += block[3]
      detailB += other[3]
    }
  })
  const n = a.blocks.length
  return {
    meanBlockDiff: +(diff / n).toFixed(2),
    lowerHalfBlockDiff: +(lower / lowerCount).toFixed(2),
    blocksOver8: `${(100 * large / n).toFixed(1)}%`,
    lowerHalfDetail: `${(detailA / lowerCount).toFixed(2)} vs ${(detailB / lowerCount).toFixed(2)}`,
  }
}

try {
  const procedural = await captureAll('procedural')
  const proceduralRepeat = await captureAll('procedural')
  const baked = await captureAll('full')
  const rows = views.map((view, i) => ({
    view: view ?? 'overview',
    noiseFloor: compare(procedural[i], proceduralRepeat[i]),
    baked: compare(procedural[i], baked[i]),
  }))
  console.log(JSON.stringify(rows, null, 2))
} finally {
  await browser.close()
}
