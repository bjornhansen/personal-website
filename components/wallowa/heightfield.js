import * as THREE from 'three'
import { fbm, erodedFbm, ridged, ridgedMulti, noise2D } from './noise.js'
import { CAMP, LAKE } from './places.js'
import { datan2, dcos, dsin, pow6 } from './dmath.js'

const SHORE = 0.8
const SHORE_WOBBLE = 0.09
const SHORE_RADIUS = (LAKE.rx + LAKE.rz) / 2
const BEACH_SLOPE = 0.12
const FLOOR_BASE = 2.2
const HILL_HEIGHT = 6
const CAMP_ANGLE = datan2((CAMP.z - LAKE.z) / LAKE.rz, (CAMP.x - LAKE.x) / LAKE.rx)

const { smoothstep } = THREE.MathUtils
const square = (v) => v * v

function shoreRadius(angle) {
  const c = dcos(angle)
  const s = dsin(angle)
  const wobble = noise2D(c * 1.7 + 3.1, s * 1.7 - 2.4) * 0.75 + noise2D(c * 3.9 - 1.2, s * 3.9 + 6.8) * 0.25
  return SHORE * (1 + SHORE_WOBBLE * wobble * (1 - campCloseness(angle)))
}

function campCloseness(angle) {
  let diff = Math.abs(angle - CAMP_ANGLE)
  diff = Math.min(diff, Math.PI * 2 - diff)
  return 1 - smoothstep(diff, 0.2, 0.7)
}

function beachSlope(angle) {
  const c = dcos(angle)
  const s = dsin(angle)
  const n = noise2D(c * 2.3 + 8.5, s * 2.3 - 4.1)
  return BEACH_SLOPE * (1 + 0.6 * n * (1 - campCloseness(angle)) + 0.5 * campCloseness(angle))
}

function shoreOffset(x, z) {
  const ex = (x - LAKE.x) / LAKE.rx
  const ez = (z - LAKE.z) / LAKE.rz
  const d = Math.hypot(ex, ez)
  const angle = datan2(ez, ex)
  const radius = shoreRadius(angle)
  return { w: (d - radius) * SHORE_RADIUS, d, radius, angle }
}

function lakeDepth(w, slope) {
  const inward = -w
  return Math.min(12.5, slope * inward + 9 * smoothstep(inward, 5, 45))
}

function valleyFloor(x, z, w) {
  const worldX = x * 0.012
  const worldZ = z * 0.012
  const undulation = fbm(worldX * 0.6 + 5.2, worldZ * 0.6 + 1.3, 3) * 0.6
  const warpX = fbm(worldX * 0.9 + 5.2, worldZ * 0.9 + 1.3, 2) * 0.35
  const warpZ = fbm(worldX * 0.9 - 7.1, worldZ * 0.9 + 3.7, 2) * 0.35
  const hills = erodedFbm(worldX * 1.3 + warpX + 17.4, worldZ * 1.3 + warpZ - 9.6, 5, 1.6)
  const meadow = meadowMask(x, z)
  const flat = smoothstep(meadow, 0.5, 0.64)
  const nearShore = smoothstep(w, 4, 40)
  const hillMask = (1 - flat * 0.8) * nearShore
  const rise = 0.012 * Math.max(0, w - 20)
  const wall = square(smoothstep(Math.abs(x), 150, 210)) * 8
  return FLOOR_BASE + undulation * smoothstep(w, 0, 20) + HILL_HEIGHT * (0.5 + 0.5 * hills) * hillMask + rise + wall
}

function peaks(x, z, worldX, worldZ, w) {
  const backness = smoothstep(-z, 30, 160)
  const peakMask = backness * smoothstep(Math.abs(x) * 0.4 + backness * 60, 20, 90)
  if (peakMask <= 0) return 0
  const warpX = fbm(worldX * 0.9 + 5.2, worldZ * 0.9 + 1.3, 3) * 0.5
  const wx = worldX + warpX
  const horns =
    ridged(worldX * 0.55 + 13.2 + warpX * 0.2, worldZ * 0.55 - 7.8, 6) * 40 +
    ridgedMulti(worldX * 1.4 - 3.1, worldZ * 1.4 + 5.5, 5) * 18
  const gully = pow6(1 - Math.abs(noise2D(wx * 4.2 + 3.3, worldZ * 1.4 - 8.1)))
  return peakMask * (horns - gully * 3.5 * smoothstep(horns, 8, 24)) * smoothstep(w, -6, 12)
}

export function baseHeight(x, z) {
  const { w, angle } = shoreOffset(x, z)
  const slope = beachSlope(angle)
  let h
  if (w < 0) {
    h = -lakeDepth(w, slope)
  } else {
    const beach = slope * w
    const floor = valleyFloor(x, z, w)
    h = beach + (floor - beach) * smoothstep(w, 0, 18 + 12 * (BEACH_SLOPE / slope))
  }
  return h + peaks(x, z, x * 0.012, z * 0.012, w)
}

export function meadowMask(x, z) {
  const n = fbm(x * 0.0075 + 41.7, z * 0.0075 - 17.3, 4)
  return (n + 1) * 0.5
}

export function lakeBowl(x, z) {
  const { d, radius } = shoreOffset(x, z)
  return 1 - Math.min(1, d / (radius * 1.15))
}

export function shoreDistance(x, z) {
  return shoreOffset(x, z).w
}
