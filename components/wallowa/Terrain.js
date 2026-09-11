'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { fbm, ridged, noise2D } from './noise'

const SIZE = 420
const SEGMENTS = 220
const WATER_LEVEL = 0

export function terrainHeight(x, z) {
  const worldX = x * 0.012
  const worldZ = z * 0.012

  let h = fbm(worldX, worldZ, 5) * 4 + 2.5

  const backness = THREE.MathUtils.smoothstep(-z, 30, 160)
  const peakMask = backness * THREE.MathUtils.smoothstep(
    Math.abs(x) * 0.4 + backness * 60,
    20,
    90
  )
  const horns =
    ridged(worldX * 0.55 + 13.2, worldZ * 0.55 - 7.8, 6) * 46 +
    ridged(worldX * 1.4 - 3.1, worldZ * 1.4 + 5.5, 4) * 14
  h += peakMask * horns

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

const cRock = new THREE.Color('#8a8178')
const cRockDark = new THREE.Color('#5c554e')
const cGrass = new THREE.Color('#4f6b3a')
const cGrassDry = new THREE.Color('#7d7f4e')
const cSand = new THREE.Color('#9a8f76')
const cSnow = new THREE.Color('#eef2f4')

export default function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const color = new THREE.Color()
    const sample = 2

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = terrainHeight(x, z)
      pos.setY(i, h)

      const hx = terrainHeight(x + sample, z)
      const hz = terrainHeight(x, z + sample)
      const slope = Math.min(
        1,
        Math.sqrt(
          ((hx - h) / sample) * ((hx - h) / sample) +
            ((hz - h) / sample) * ((hz - h) / sample)
        ) * 0.9
      )

      const n = (noise2D(x * 0.08, z * 0.08) + 1) * 0.5

      if (h < WATER_LEVEL + 1.2) {
        color.copy(cSand)
      } else if (h > 26 + n * 10) {
        color.copy(cSnow)
      } else {
        color.copy(cGrass).lerp(cGrassDry, n * 0.6)
        if (h > 14) color.lerp(cRock, Math.min(1, (h - 14) / 16))
      }
      color.lerp(cRock, slope * 0.8)
      color.lerp(cRockDark, Math.max(0, n - 0.6))

      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} position={[0, 0, 0]}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  )
}
