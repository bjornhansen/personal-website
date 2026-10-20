import { baseHeight } from './heightfield.js'
import { creekCarve } from './creekbed.js'
import { GROUND_EXTENT } from './groundMap.js'

export const TERRAIN_SIZE = GROUND_EXTENT
export const TERRAIN_SEGMENTS = 256
export const TERRAIN_VERTS = TERRAIN_SEGMENTS + 1
export const TERRAIN_CELL = TERRAIN_SIZE / TERRAIN_SEGMENTS

const HALF = TERRAIN_SIZE / 2
const N = TERRAIN_VERTS

let grid = null

export function vertexPosition(index) {
  const ix = index % N
  const iy = Math.floor(index / N)
  return [ix * TERRAIN_CELL - HALF, iy * TERRAIN_CELL - HALF]
}

export function getHeightGrid() {
  if (grid) return grid
  grid = new Float32Array(N * N)
  for (let iy = 0; iy < N; iy++) {
    const z = iy * TERRAIN_CELL - HALF
    for (let ix = 0; ix < N; ix++) {
      const x = ix * TERRAIN_CELL - HALF
      const base = baseHeight(x, z)
      grid[iy * N + ix] = base - creekCarve(x, z, base)
    }
  }
  return grid
}

function locate(x, z) {
  const fx = Math.min(Math.max((x + HALF) / TERRAIN_CELL, 0), TERRAIN_SEGMENTS - 1e-6)
  const fz = Math.min(Math.max((z + HALF) / TERRAIN_CELL, 0), TERRAIN_SEGMENTS - 1e-6)
  const ix = Math.floor(fx)
  const iy = Math.floor(fz)
  return [ix, iy, fx - ix, fz - iy]
}

function plane(ix, iy, u, v) {
  const g = getHeightGrid()
  const k = iy * N + ix
  const h00 = g[k]
  const h01 = g[k + N]
  const h10 = g[k + 1]
  const h11 = g[k + N + 1]
  if (u + v < 1) {
    return [h00, (h10 - h00) / TERRAIN_CELL, (h01 - h00) / TERRAIN_CELL, 0, 0]
  }
  return [h11, (h11 - h01) / TERRAIN_CELL, (h11 - h10) / TERRAIN_CELL, 1, 1]
}

export function groundHeight(x, z) {
  const [ix, iy, u, v] = locate(x, z)
  const [h, gx, gz, ou, ov] = plane(ix, iy, u, v)
  return h + gx * (u - ou) * TERRAIN_CELL + gz * (v - ov) * TERRAIN_CELL
}

export function groundGradient(x, z, out = [0, 0]) {
  const [ix, iy, u, v] = locate(x, z)
  const [, gx, gz] = plane(ix, iy, u, v)
  out[0] = gx
  out[1] = gz
  return out
}

export function groundSlope(x, z) {
  const [gx, gz] = groundGradient(x, z)
  return Math.hypot(gx, gz)
}

export function groundNormal(x, z, out = [0, 1, 0]) {
  const [gx, gz] = groundGradient(x, z)
  const len = Math.hypot(gx, 1, gz)
  out[0] = -gx / len
  out[1] = 1 / len
  out[2] = -gz / len
  return out
}

export function groundContact(x, z, radius, samples = 6) {
  let y = groundHeight(x, z)
  if (radius <= 0) return y
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2
    y = Math.min(y, groundHeight(x + Math.cos(a) * radius, z + Math.sin(a) * radius))
  }
  return y
}
