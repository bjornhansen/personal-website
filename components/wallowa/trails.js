import { terrainHeight } from './Terrain'
import { noise2D } from './noise'
import { BEAR, CAMP, SPAWN } from './Bear'

export const TRAIL_HALF_WIDTH = 0.8

const LAKE = { x: -10, z: 45, rx: 78, rz: 96 }

function shoreTrail() {
  const start = Math.atan2((CAMP.z - LAKE.z) / LAKE.rz, (CAMP.x - LAKE.x) / LAKE.rx)
  const points = [[CAMP.x - 2, CAMP.z + 1]]
  for (let a = start + 0.05; a < start + 2.3; a += 0.03) {
    let k = 1.04 + noise2D(a * 3.1, 7.7) * 0.03
    let x = 0
    let z = 0
    for (let tries = 0; tries < 20; tries++) {
      x = LAKE.x + Math.cos(a) * LAKE.rx * k
      z = LAKE.z + Math.sin(a) * LAKE.rz * k
      if (terrainHeight(x, z) > 0.9) break
      k += 0.02
    }
    points.push([x, z])
  }
  return points
}

function wander(waypoints, spacing = 3, amount = 2.5, seed = 0) {
  const out = []
  for (let s = 0; s < waypoints.length - 1; s++) {
    const [ax, az] = waypoints[s]
    const [bx, bz] = waypoints[s + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const nx = -(bz - az) / len
    const nz = (bx - ax) / len
    const steps = Math.max(1, Math.round(len / spacing))
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      const w = noise2D(x * 0.04 + seed, z * 0.04 - seed) * amount
      out.push([x + nx * w, z + nz * w])
    }
  }
  out.push(waypoints[waypoints.length - 1])
  return out
}

let cache = null

export function getTrails() {
  if (cache) return cache
  const sign = [CAMP.x + 18, CAMP.z + 14]
  cache = [
    shoreTrail(),
    wander(
      [
        [CAMP.x + 3, CAMP.z + 4],
        sign,
        [sign[0] + 14, sign[1] - 20],
        [sign[0] + 24, sign[1] - 46],
        [sign[0] + 30, sign[1] - 80],
        [sign[0] + 32, sign[1] - 112],
        [sign[0] + 26, sign[1] - 140],
        [sign[0] + 36, sign[1] - 175],
      ],
      3,
      3,
      11.3
    ),
    wander([[SPAWN.x + 30, SPAWN.z - 40], [SPAWN.x, SPAWN.z], [BEAR.x + 3, BEAR.z - 3]], 3, 2, 42.1),
  ]
  return cache
}

export function trailDistance(x, z) {
  let best = Infinity
  for (const path of getTrails()) {
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i]
      const [bx, bz] = path[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t)
      if (d < best) best = d
    }
  }
  return best
}
