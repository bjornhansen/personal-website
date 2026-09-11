// Compact 2D simplex noise (Stefan Gustavson public-domain port).
const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

const GRAD = [
  1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1,
]

const perm = new Uint8Array(512)
const p = new Uint8Array(256)
for (let i = 0; i < 256; i++) p[i] = i
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
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
