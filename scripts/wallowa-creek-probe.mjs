const seed = Number(process.argv[2] ?? 1849)
const map = process.argv.includes('--map')
globalThis.window = { location: { search: `?bench=1&seed=${seed}` } }

const { getCreek, creekCarve, creekDistance, CREEK_BANK_RADIUS, CREEK_DEPTH } = await import(
  '../components/wallowa/creekbed.js'
)
const { baseHeight } = await import('../components/wallowa/heightfield.js')

const WATER_DEPTH = 0.45
const t0 = performance.now()
const creek = getCreek()
const t1 = performance.now()
creekDistance(0, 0)
const t2 = performance.now()

const n = creek.points.length
if (!n) {
  console.log(JSON.stringify({ seed, ok: false }))
  process.exit(0)
}

let maxStepDrop = 0
let minFreeboard = Infinity
let minChannel = Infinity
let bedMismatch = 0
for (let i = 0; i < n; i++) {
  const [x, z] = creek.points[i]
  if (i > 0) maxStepDrop = Math.max(maxStepDrop, creek.levels[i - 1] - creek.levels[i])
  const carved = baseHeight(x, z) - creekCarve(x, z)
  if (Math.abs(carved - creek.bedHeights[i]) > 0.15) bedMismatch++
  const water = Math.max(creek.bedHeights[i] + WATER_DEPTH, 0)
  if (creek.base[i] > 0.1) {
    minFreeboard = Math.min(minFreeboard, creek.base[i] - water)
    minChannel = Math.min(minChannel, creek.base[i] - creek.bedHeights[i])
  }
}

const source = creek.points[0]
const mouth = creek.points[creek.mouthIndex]
console.log(
  JSON.stringify({
    seed,
    ok: true,
    points: n,
    length: Math.round(creek.lengths[n - 1]),
    source: [Math.round(source[0]), Math.round(source[1]), Number(creek.base[0].toFixed(1))],
    mouth: [Math.round(mouth[0]), Math.round(mouth[1])],
    maxCut: Number(creek.maxCut.toFixed(2)),
    maxStepDrop: Number(maxStepDrop.toFixed(2)),
    minFreeboard: Number(minFreeboard.toFixed(2)),
    minChannel: Number(minChannel.toFixed(2)),
    channelDepth: CREEK_DEPTH,
    bedMismatch,
    routeMs: Number((t1 - t0).toFixed(1)),
    fieldMs: Number((t2 - t1).toFixed(1)),
  })
)

if (map) {
  const W = 84
  const H = 42
  const rows = []
  for (let j = 0; j < H; j++) {
    let row = ''
    for (let i = 0; i < W; i++) {
      const x = (i / W - 0.5) * 420
      const z = (j / H - 0.5) * 420
      const h = baseHeight(x, z)
      let ch = h < 0 ? '~' : h < 4 ? '.' : h < 10 ? ':' : h < 20 ? '+' : '#'
      if (creekDistance(x, z) < CREEK_BANK_RADIUS + 1.5) ch = 'C'
      if (Math.abs(x) < 3 && Math.abs(z - 185) < 6) ch = '@'
      if (Math.abs(x - 56) < 3 && Math.abs(z - 88) < 6) ch = 'T'
      row += ch
    }
    rows.push(row)
  }
  console.error(rows.join('\n'))
}
