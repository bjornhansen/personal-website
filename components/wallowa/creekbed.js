import { noise2D } from './noise.js'
import { baseHeight } from './heightfield.js'
import { BEAR, CAMP, LAKE, SPAWN } from './places.js'
import { GROUND_EXTENT } from './groundMap.js'
import { dcos, dsin } from './dmath.js'

export const CREEK_HALF_WIDTH = 2.4
export const CREEK_DEPTH = 1.6
export const CREEK_BANK_RADIUS = CREEK_HALF_WIDTH * 2
export const CREEK_MAX_POINTS = 260
export const CREEK_MOUTH_DEPTH = 1.2

const FIELD_RES = 512
const FIELD_EXTENT = GROUND_EXTENT
const FAR = 100
const SPACING = 1
const EXTENT_LIMIT = FIELD_EXTENT / 2 - 6
const EAST_LIMIT = 40
const SOUTH_LIMIT = 70
const MAX_CUT = 2.2
const MAX_STEP_DROP = 0.5
const SMOOTH_RADIUS = 5
const MIN_CHANNEL = 1
const MIN_LENGTH = 45
const SOURCE_MIN_HEIGHT = 3.5
const SOURCE_MAX_HEIGHT = 26
const SOURCE_SCALES = [1.35, 1.5, 1.65, 1.8, 2.0, 2.2]
const SOURCE_ANGLE_STEP = 0.05
const GOOD_SCORE = 150
const KEEP_OUT = [
  [CAMP, 32],
  [BEAR, 26],
  [SPAWN, 26],
]

const EMPTY = { points: [], levels: [], base: [], bedHeights: [], lengths: [], mouthIndex: 0, maxCut: 0 }

let cache = null
let field = null
let fieldBed = null

const smooth = (t) => t * t * (3 - 2 * t)

function allowed(x, z) {
  if (Math.abs(x) > EXTENT_LIMIT || Math.abs(z) > EXTENT_LIMIT) return false
  if (x > EAST_LIMIT || z > SOUTH_LIMIT) return false
  for (const [p, r] of KEEP_OUT) {
    if (Math.hypot(x - p.x, z - p.z) < r) return false
  }
  return true
}

function gradient(x, z) {
  const eps = 0.8
  return [
    (baseHeight(x + eps, z) - baseHeight(x - eps, z)) / (2 * eps),
    (baseHeight(x, z + eps) - baseHeight(x, z - eps)) / (2 * eps),
  ]
}

function walk(sx, sz) {
  let px = sx
  let pz = sz
  let dirX = LAKE.x - sx
  let dirZ = LAKE.z - sz
  const dl = Math.hypot(dirX, dirZ) || 1
  dirX /= dl
  dirZ /= dl
  let level = baseHeight(sx, sz)
  const points = [[sx, sz]]
  const levels = [level]
  const base = [level]
  let maxCut = 0
  let mouthIndex = -1
  let reached = false

  for (let step = 1; step < CREEK_MAX_POINTS; step++) {
    const [gx, gz] = gradient(px, pz)
    const gl = Math.hypot(gx, gz)
    const downX = gl > 1e-4 ? -gx / gl : 0
    const downZ = gl > 1e-4 ? -gz / gl : 0
    let lakeX = LAKE.x - px
    let lakeZ = LAKE.z - pz
    const ll = Math.hypot(lakeX, lakeZ) || 1
    lakeX /= ll
    lakeZ /= ll
    const pooled = base[base.length - 1] - level > 0.05
    const wDown = pooled ? 0.15 : 0.6
    const wLake = pooled ? 0.5 : 0.2
    const tx = downX * wDown + lakeX * wLake + dirX * 0.35
    const tz = downZ * wDown + lakeZ * wLake + dirZ * 0.35
    const meander = noise2D(step * 0.21 + sx * 0.013, 37.7 + sz * 0.013) * 0.4
    const cm = dcos(meander)
    const sm = dsin(meander)
    const rx = tx * cm - tz * sm
    const rz = tx * sm + tz * cm
    const rl = Math.hypot(rx, rz) || 1
    dirX = rx / rl
    dirZ = rz / rl
    const nx = px + dirX * SPACING
    const nz = pz + dirZ * SPACING
    if (!allowed(nx, nz)) return null
    const h = baseHeight(nx, nz)
    level = Math.min(level, h)
    const cut = h - level
    if (cut > MAX_CUT) return null
    maxCut = Math.max(maxCut, cut)
    px = nx
    pz = nz
    points.push([px, pz])
    levels.push(level)
    base.push(h)
    if (mouthIndex < 0 && h < 0) mouthIndex = points.length - 1
    if (h < -CREEK_MOUTH_DEPTH) {
      reached = true
      break
    }
  }
  if (!reached || mouthIndex < 0) return null
  return { points, levels, base, maxCut, mouthIndex }
}

function sourceCandidates() {
  const out = []
  for (const k of SOURCE_SCALES) {
    for (let a = 0; a < Math.PI * 2; a += SOURCE_ANGLE_STEP) {
      const x = LAKE.x + dcos(a) * LAKE.rx * k
      const z = LAKE.z + dsin(a) * LAKE.rz * k
      if (!allowed(x, z)) continue
      const h = baseHeight(x, z)
      if (h < SOURCE_MIN_HEIGHT || h > SOURCE_MAX_HEIGHT) continue
      out.push({ x, z, h })
    }
  }
  return out
}

function score(route) {
  const length = route.points.length * SPACING
  if (length < MIN_LENGTH) return -Infinity
  const drop = route.base[0]
  return Math.min(length, 140) + drop * 2 - route.maxCut * 25
}

function assemble(route) {
  const { points, levels, base, mouthIndex, maxCut } = route
  for (let i = levels.length - 2; i >= 0; i--) {
    levels[i] = Math.min(levels[i], levels[i + 1] + MAX_STEP_DROP * SPACING)
  }
  const smoothed = levels.map((_, i) => {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - SMOOTH_RADIUS); j <= Math.min(levels.length - 1, i + SMOOTH_RADIUS); j++) {
      sum += levels[j]
      count++
    }
    return sum / count
  })
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    )
  }
  for (let i = 0; i < smoothed.length; i++) {
    smoothed[i] = Math.min(smoothed[i], base[i] - MIN_CHANNEL + CREEK_DEPTH)
    if (i > 0) smoothed[i] = Math.min(smoothed[i], smoothed[i - 1])
  }
  const bedHeights = smoothed.map((l) => l - CREEK_DEPTH)
  return { points, levels: smoothed, base, bedHeights, lengths, mouthIndex, maxCut }
}

function buildCreek() {
  let best = null
  let bestScore = -Infinity
  for (const c of sourceCandidates()) {
    const route = walk(c.x, c.z)
    if (!route) continue
    const s = score(route)
    if (s > bestScore) {
      best = route
      bestScore = s
      if (s >= GOOD_SCORE) break
    }
  }
  return best ? assemble(best) : EMPTY
}

export function getCreek() {
  if (!cache) cache = buildCreek()
  return cache
}

function buildField(points, bedHeights) {
  field = new Float32Array(FIELD_RES * FIELD_RES).fill(FAR)
  fieldBed = new Float32Array(FIELD_RES * FIELD_RES)
  const cell = FIELD_EXTENT / FIELD_RES
  const reach = Math.ceil(CREEK_BANK_RADIUS / cell) + 3
  const toI = (v) => (v / FIELD_EXTENT + 0.5) * FIELD_RES
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s]
    const [bx, bz] = points[s + 1]
    const bedA = bedHeights[s]
    const bedB = bedHeights[s + 1]
    const ia = toI(ax)
    const ja = toI(az)
    const ib = toI(bx)
    const jb = toI(bz)
    const i0 = Math.max(0, Math.floor(Math.min(ia, ib) - reach))
    const i1 = Math.min(FIELD_RES - 1, Math.ceil(Math.max(ia, ib) + reach))
    const j0 = Math.max(0, Math.floor(Math.min(ja, jb) - reach))
    const j1 = Math.min(FIELD_RES - 1, Math.ceil(Math.max(ja, jb) + reach))
    const dx = bx - ax
    const dz = bz - az
    const lenSq = dx * dx + dz * dz || 1
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const wx = ((i + 0.5) / FIELD_RES) * FIELD_EXTENT - FIELD_EXTENT / 2
        const wz = ((j + 0.5) / FIELD_RES) * FIELD_EXTENT - FIELD_EXTENT / 2
        const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wz - az) * dz) / lenSq))
        const d = Math.hypot(wx - ax - dx * t, wz - az - dz * t)
        const k = j * FIELD_RES + i
        if (d < field[k]) {
          field[k] = d
          fieldBed[k] = bedA + (bedB - bedA) * t
        }
      }
    }
  }
}

function ensureField() {
  if (!field) {
    const creek = getCreek()
    buildField(creek.points, creek.bedHeights)
  }
}

function fieldIndex(x, z) {
  const fx = (x / FIELD_EXTENT + 0.5) * FIELD_RES - 0.5
  const fz = (z / FIELD_EXTENT + 0.5) * FIELD_RES - 0.5
  const i = Math.floor(fx)
  const j = Math.floor(fz)
  if (i < 0 || j < 0 || i >= FIELD_RES - 1 || j >= FIELD_RES - 1) return null
  return [j * FIELD_RES + i, fx - i, fz - j]
}

function bilinear(arr, k, tx, tz) {
  const top = arr[k] * (1 - tx) + arr[k + 1] * tx
  const bottom = arr[k + FIELD_RES] * (1 - tx) + arr[k + FIELD_RES + 1] * tx
  return top * (1 - tz) + bottom * tz
}

export function creekDistance(x, z) {
  ensureField()
  const idx = fieldIndex(x, z)
  if (!idx) return FAR
  return bilinear(field, idx[0], idx[1], idx[2])
}

export function creekCarve(x, z, base = baseHeight(x, z)) {
  if (!getCreek().points.length) return 0
  ensureField()
  const idx = fieldIndex(x, z)
  if (!idx) return 0
  const d = bilinear(field, idx[0], idx[1], idx[2])
  if (d >= CREEK_BANK_RADIUS) return 0
  const bed = bilinear(fieldBed, idx[0], idx[1], idx[2])
  const inner = CREEK_HALF_WIDTH * 0.8
  const t = Math.min(1, Math.max(0, (CREEK_BANK_RADIUS - d) / (CREEK_BANK_RADIUS - inner)))
  return Math.max(0, base - bed) * smooth(t)
}
