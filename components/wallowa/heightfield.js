import * as THREE from 'three'
import { fbm, ridged, ridgedMulti, noise2D } from './noise.js'

export function baseHeight(x, z) {
  const worldX = x * 0.012
  const worldZ = z * 0.012
  const warpX = fbm(worldX * 0.9 + 5.2, worldZ * 0.9 + 1.3, 3) * 0.5
  const warpZ = fbm(worldX * 0.9 - 7.1, worldZ * 0.9 + 3.7, 3) * 0.5
  const wx = worldX + warpX
  const wz = worldZ + warpZ

  let h = fbm(wx, wz, 5) * 4 + 2.5
  h += fbm(wx * 3.7 + 91.3, wz * 3.7 - 44.8, 3) * 1.1

  const backness = THREE.MathUtils.smoothstep(-z, 30, 160)
  const peakMask = backness * THREE.MathUtils.smoothstep(
    Math.abs(x) * 0.4 + backness * 60,
    20,
    90
  )
  const horns =
    ridged(worldX * 0.55 + 13.2 + warpX * 0.2, worldZ * 0.55 - 7.8, 6) * 40 +
    ridgedMulti(worldX * 1.4 - 3.1, worldZ * 1.4 + 5.5, 5) * 18
  const gully = Math.pow(1 - Math.abs(noise2D(wx * 4.2 + 3.3, worldZ * 1.4 - 8.1)), 6)
  h += peakMask * (horns - gully * 3.5 * THREE.MathUtils.smoothstep(horns, 8, 24))

  const lakeX = THREE.MathUtils.clamp((x + 10) / 90, -1, 1)
  const lakeZ = THREE.MathUtils.clamp((z - 45) / 110, -1, 1)
  const bowl =
    1 -
    Math.min(1, Math.sqrt(lakeX * lakeX + lakeZ * lakeZ) * 1.15)
  h -= bowl * 9
  h -= bowl * bowl * 5

  const shoreNoise = noise2D(worldX * 2.3, worldZ * 2.3) * 0.6
  h += shoreNoise * (0.3 + 1 - Math.abs(bowl))

  return h
}

export function meadowMask(x, z) {
  const n = fbm(x * 0.0075 + 41.7, z * 0.0075 - 17.3, 4)
  return (n + 1) * 0.5
}

export function lakeBowl(x, z) {
  const lakeX = THREE.MathUtils.clamp((x + 10) / 90, -1, 1)
  const lakeZ = THREE.MathUtils.clamp((z - 45) / 110, -1, 1)
  return 1 - Math.min(1, Math.sqrt(lakeX * lakeX + lakeZ * lakeZ) * 1.15)
}
