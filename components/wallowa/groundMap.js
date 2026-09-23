import * as THREE from 'three'

export const GROUND_EXTENT = 420
const RES = 1024
const TEXEL = GROUND_EXTENT / RES

export const CONTACT = 0
export const CANOPY = 1
export const DIRT = 2

const data = new Uint8Array(RES * RES * 4)

export const groundTexture = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.UnsignedByteType)
groundTexture.magFilter = THREE.LinearFilter
groundTexture.minFilter = THREE.LinearFilter
groundTexture.needsUpdate = true

const toTexel = (v) => (v / GROUND_EXTENT + 0.5) * RES

function stamp(channel, x, z, radius, strength, falloff) {
  const cx = toTexel(x)
  const cz = toTexel(z)
  const r = radius / TEXEL
  const i0 = Math.max(0, Math.floor(cx - r))
  const i1 = Math.min(RES - 1, Math.ceil(cx + r))
  const j0 = Math.max(0, Math.floor(cz - r))
  const j1 = Math.min(RES - 1, Math.ceil(cz + r))
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / r
      if (d >= 1) continue
      const v = Math.round(255 * strength * Math.pow(1 - d, falloff))
      const k = (j * RES + i) * 4 + channel
      if (v > data[k]) data[k] = v
    }
  }
}

export function paintBlob(channel, x, z, radius, strength = 1, falloff = 1.5) {
  stamp(channel, x, z, radius, strength, falloff)
}

export function paintPath(channel, points, halfWidth, strength = 1) {
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s]
    const [bx, bz] = points[s + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.max(1, Math.ceil(len / (TEXEL * 0.75)))
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      stamp(channel, ax + (bx - ax) * t, az + (bz - az) * t, halfWidth, strength, 0.6)
    }
  }
}

export function commitGround() {
  groundTexture.needsUpdate = true
}
