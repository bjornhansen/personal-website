// Compact 2D simplex noise (Stefan Gustavson public-domain port).
import { benchmark, createRandom } from './benchmark/config.js'
const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

const GRAD = [
  1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1,
]

export const DEFAULT_SEED = 1849

function worldSeed() {
  if (benchmark) return benchmark.seed
  if (typeof window === 'undefined') return DEFAULT_SEED
  const raw = new URLSearchParams(window.location.search).get('seed')
  const value = raw === null || raw === '' ? NaN : Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_SEED
}

export const WORLD_SEED = worldSeed()

const perm = new Uint8Array(512)
const p = new Uint8Array(256)
const random = createRandom(WORLD_SEED)
for (let i = 0; i < 256; i++) p[i] = i
for (let i = 255; i > 0; i--) {
  const j = Math.floor(random() * (i + 1))
  ;[p[i], p[j]] = [p[j], p[i]]
}
for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

export function noise2D(xin, yin) {
  const s = (xin + yin) * F2
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const t = (i + j) * G2
  const x0 = xin - (i - t)
  const y0 = yin - (j - t)
  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1
  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2
  const ii = i & 255
  const jj = j & 255
  let n = 0
  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 > 0) {
    const g = (perm[ii + perm[jj]] % 8) * 2
    t0 *= t0
    n += t0 * t0 * (GRAD[g] * x0 + GRAD[g + 1] * y0)
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 > 0) {
    const g = (perm[ii + i1 + perm[jj + j1]] % 8) * 2
    t1 *= t1
    n += t1 * t1 * (GRAD[g] * x1 + GRAD[g + 1] * y1)
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 > 0) {
    const g = (perm[ii + 1 + perm[jj + 1]] % 8) * 2
    t2 *= t2
    n += t2 * t2 * (GRAD[g] * x2 + GRAD[g + 1] * y2)
  }
  return 70 * n
}

export function noise2Dd(xin, yin, out = [0, 0, 0]) {
  const s = (xin + yin) * F2
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const t = (i + j) * G2
  const x0 = xin - (i - t)
  const y0 = yin - (j - t)
  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1
  const ii = i & 255
  const jj = j & 255
  let n = 0
  let dx = 0
  let dy = 0
  const corner = (x, y, g) => {
    let tt = 0.5 - x * x - y * y
    if (tt <= 0) return
    const gx = GRAD[g]
    const gy = GRAD[g + 1]
    const gdot = gx * x + gy * y
    const t2 = tt * tt
    const t4 = t2 * t2
    const t3g = -8 * t2 * tt * gdot
    n += t4 * gdot
    dx += t3g * x + t4 * gx
    dy += t3g * y + t4 * gy
  }
  corner(x0, y0, (perm[ii + perm[jj]] % 8) * 2)
  corner(x0 - i1 + G2, y0 - j1 + G2, (perm[ii + i1 + perm[jj + j1]] % 8) * 2)
  corner(x0 - 1 + 2 * G2, y0 - 1 + 2 * G2, (perm[ii + 1 + perm[jj + 1]] % 8) * 2)
  out[0] = 70 * n
  out[1] = 70 * dx
  out[2] = 70 * dy
  return out
}

const erosionSample = [0, 0, 0]

export function erodedFbm(x, y, octaves = 5, erosion = 1, lacunarity = 2, gain = 0.5) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < octaves; i++) {
    const [n, nx, ny] = noise2Dd(x * freq, y * freq, erosionSample)
    dx += nx * amp
    dy += ny * amp
    sum += (amp * n) / (1 + erosion * (dx * dx + dy * dy))
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

export function fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2D(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

export function ridged(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2D(x * freq, y * freq))
    sum += amp * n * n
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

export function ridgedMulti(x, y, octaves = 6, lacunarity = 2, gain = 0.5) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  let weight = 1
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise2D(x * freq, y * freq))
    n *= n * weight
    weight = Math.min(1, Math.max(0, n * 2))
    sum += amp * n
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
