'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, meadowMask } from './Terrain'
import { CAMP } from './Bear'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BLADE = new THREE.Color('#4f6b3a')
const BLADE_DRY = new THREE.Color('#a8a05e')
const BLADE_FRESH = new THREE.Color('#6f8f3f')

export default function GroundCover({ count = 4500 }) {
  const tufts = useMemo(() => {
    const rand = mulberry32(7719)
    const spots = []
    let attempts = 0
    const limit = count * 12
    while (spots.length < count && attempts < limit) {
      attempts++
      const x = (rand() - 0.5) * 340
      const z = (rand() - 0.5) * 340
      if (Math.hypot(x + 10, z - 45) > 170) continue
      const h = terrainHeight(x, z)
      if (h < 0.7 || h > 18) continue
      const meadow = meadowMask(x, z)
      const nearCamp = Math.hypot(x - CAMP.x, z - CAMP.z) < 30
      if (meadow < 0.5 && !nearCamp) continue
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < 9) continue
      spots.push({ x, y: h, z, s: 0.6 + rand() * 0.7 })
    }

    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.07, 0.75, 4),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      spots.length
    )
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    spots.forEach((s, i) => {
      const vrand = mulberry32(spots.length + i * 7)
      const hue = vrand()
      m.compose(
        new THREE.Vector3(s.x, s.y + 0.35 * s.s, s.z),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          vrand() * Math.PI * 2
        ),
        new THREE.Vector3(s.s, s.s * 1.2, s.s)
      )
      mesh.setMatrixAt(i, m)
      c.copy(BLADE)
        .lerp(BLADE_FRESH, vrand() * 0.5)
        .lerp(BLADE_DRY, hue * 0.35)
      mesh.setColorAt(i, c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    return mesh
  }, [count])

  return <primitive object={tufts} />
}
