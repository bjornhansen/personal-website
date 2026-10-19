import { noise2D } from './noise'
import { baseHeight } from './Terrain'
import { LAKE } from './trails'
import { BEAR, CAMP, SPAWN } from './Bear'
import { GROUND_EXTENT } from './groundMap'

export const CREEK_HALF_WIDTH = 1.7
export const CREEK_DEPTH = 1
export const CREEK_BANK_RADIUS = CREEK_HALF_WIDTH * 2
export const CREEK_MAX_POINTS = 110

const FIELD_RES = 512
const FIELD_EXTENT = GROUND_EXTENT
const FAR = 100
const SPACING = 1
const EXTENT_LIMIT = FIELD_EXTENT / 2 - 3

let cache = null
let field = null

const smooth = (t) => t * t * (3 - 2 * t)

function gradient(x, z) {
  const eps = 0.7
  return [
    (baseHeight(x + eps, z) - baseHeight(x - eps, z)) / (2 * eps),
    (baseHeight(x, z + eps) - baseHeight(x, z - eps)) / (2 * eps),
  ]
}

function shoreCrossing(cos, sin) {
  let inside = -1
  for (let k = 0.75; k >= 0.35; k -= 0.05) {
    const h = baseHeight(LAKE.x + cos * LAKE.rx * k, LAKE.z + sin * LAKE.rz * k)
    if (h < 0) {
      inside = k
      break
    }
  }
  if (inside < 0) return null
  for (let k = inside + 0.01; k <= 1.25; k += 0.01) {
    const x = LAKE.x + cos * LAKE.rx * k
    const z = LAKE.z + sin * LAKE.rz * k
    if (baseHeight(x, z) > 0) return { x, z }
  }
  return null
}

function outletCandidates() {
  const candidates = []
  for (let a = 0; a < Math.PI * 2; a += 0.025) {
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const crossing = shoreCrossing(cos, sin)
    if (!crossing) continue
    const { x, z } = crossing
    const blocked =
      Math.hypot(x - CAMP.x, z - CAMP.z) < 10 ||
      Math.hypot(x - BEAR.x, z - BEAR.z) < 10 ||
      Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10
    let dry = true
    for (let r = 1; r <= 3; r++) {
      if (baseHeight(x + cos * r, z + sin * r) < 0.05) {
        dry = false
        break
      }
    }
    candidates.push({
      x,
      z,
      dirx: cos,
      dirz: sin,
      blocked,
      dry,
      rim: baseHeight(x + cos * 4, z + sin * 4),
    })
  }
  candidates.sort((p, q) => {
    const tier = (c) => (c.dry && !c.blocked && c.rim <= 3 ? 0 : 1)
    return tier(p) - tier(q) || p.rim - q.rim
  })
  return candidates
}

function walkFrom(c) {
  const points = []
  let px = c.x
  let pz = c.z
  let dirX = c.dirx
  let dirZ = c.dirz
  let stuck = 0
  let prevH = baseHeight(px, pz)
  let minH = prevH
  let wetSteps = 0
  for (let step = 0; step < CREEK_MAX_POINTS; step++) {
    const [gx, gz] = gradient(px, pz)
    let downX = -gx
    let downZ = -gz
    const gl = Math.hypot(downX, downZ)
    if (gl > 1e-5) {
      downX /= gl
      downZ /= gl
    } else {
      downX = dirX
      downZ = dirZ
    }
    const outward = step < 4 ? 0.75 : 0.5
    const tx = dirX * outward + downX * (1 - outward)
    const tz = dirZ * outward + downZ * (1 - outward)
    const meander = noise2D(step * 0.3, 91.3) * 0.5
    const cm = Math.cos(meander)
    const sm = Math.sin(meander)
    const rx = tx * cm - tz * sm
    const rz = tx * sm + tz * cm
    const rl = Math.hypot(rx, rz) || 1
    dirX = rx / rl
    dirZ = rz / rl
    const nx = px + dirX * SPACING
    const nz = pz + dirZ * SPACING
    if (Math.abs(nx) > EXTENT_LIMIT || Math.abs(nz) > EXTENT_LIMIT) break
    if (step > 12 && Math.hypot(nx - c.x, nz - c.z) < 6) break
    const nh = baseHeight(nx, nz)
    if (nh < -0.4) break
    if (nh < 0.05) {
      wetSteps++
      if (wetSteps > 4) break
    } else {
      wetSteps = 0
    }
    if (nh > minH + 0.6) break
    if (nh > prevH + 0.3) {
      stuck++
      if (stuck > 6) break
    } else {
      stuck = 0
    }
    px = nx
    pz = nz
    prevH = nh
    minH = Math.min(minH, nh)
    points.push([px, pz])
  }
  return points
}

function buildCreek() {
  let fallback = null
  for (const c of outletCandidates().slice(0, 60)) {
    const walk = walkFrom(c)
    if (walk.length >= 15) return assemble(c, walk)
    if (walk.length >= 8 && (!fallback || walk.length > fallback.walk.length)) fallback = { c, walk }
  }
  return fallback ? assemble(fallback.c, fallback.walk) : { points: [], bedHeights: [], lengths: [], mouthIndex: 0 }
}

function assemble(c, walk) {
  const head = [
    [c.x - c.dirx * 3.5, c.z - c.dirz * 3.5],
    [c.x - c.dirx * 1.75, c.z - c.dirz * 1.75],
    [c.x, c.z],
  ]
  const points = head.concat(walk)
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    )
  }
  const bedHeights = points.map(([x, z]) => baseHeight(x, z) - CREEK_DEPTH)
  let mouthIndex = 0
  for (let i = 0; i < points.length; i++) {
    if (baseHeight(points[i][0], points[i][1]) >= 0) {
      mouthIndex = i
      break
    }
  }
  return { points, lengths, bedHeights, mouthIndex }
}

export function getCreek() {
  if (!cache) cache = buildCreek()
  return cache
}

function buildField(points) {
  field = new Float32Array(FIELD_RES * FIELD_RES).fill(FAR)
  const reach = ((CREEK_BANK_RADIUS / FIELD_EXTENT) * FIELD_RES) + 1
  const toI = (v) => (v / FIELD_EXTENT + 0.5) * FIELD_RES
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s]
    const [bx, bz] = points[s + 1]
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
        if (d < field[k]) field[k] = d
      }
    }
  }
}

function sampleField(x, z) {
  const fx = (x / FIELD_EXTENT + 0.5) * FIELD_RES - 0.5
  const fz = (z / FIELD_EXTENT + 0.5) * FIELD_RES - 0.5
  const i = Math.floor(fx)
  const j = Math.floor(fz)
  if (i < 0 || j < 0 || i >= FIELD_RES - 1 || j >= FIELD_RES - 1) return FAR
  const tx = fx - i
  const tz = fz - j
  const k = j * FIELD_RES + i
  const top = field[k] * (1 - tx) + field[k + 1] * tx
  const bottom = field[k + FIELD_RES] * (1 - tx) + field[k + FIELD_RES + 1] * tx
  return top * (1 - tz) + bottom * tz
}

export function creekDistance(x, z) {
  if (!field) buildField(getCreek().points)
  return sampleField(x, z)
}

export function creekCarve(x, z) {
  if (!getCreek().points.length) return 0
  const d = creekDistance(x, z)
  if (d >= CREEK_BANK_RADIUS) return 0
  const inner = CREEK_HALF_WIDTH * 0.75
  const t = Math.min(1, Math.max(0, (CREEK_BANK_RADIUS - d) / (CREEK_BANK_RADIUS - inner)))
  return CREEK_DEPTH * smooth(t)
}
