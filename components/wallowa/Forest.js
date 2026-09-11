'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight } from './Terrain'
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

function makeMatrix(x, y, z, scale, rotY) {
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotY
    ),
    new THREE.Vector3(scale, scale * (0.9 + 0.2 * ((x * 13 + z * 7) % 5) / 5), scale)
  )
  return m
}

export default function Forest({ count = 900 }) {
  const { canopies, trunks } = useMemo(() => {
    const rand = mulberry32(1849)
    const spots = []
    let attempts = 0
    while (spots.length < count && attempts < count * 30) {
      attempts++
      const x = (rand() - 0.5) * 400
      const z = (rand() - 0.5) * 400
      const h = terrainHeight(x, z)
      if (h < 1.2 || h > 22) continue
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < 18) continue
      if (Math.hypot(x - CAMP.x + 60, z - CAMP.z - 20) < 25) continue
      const clump = (rand() + rand() + rand()) / 3
      if (clump < 0.35) continue
      const scale = 0.7 + rand() * 0.9 + clump * 0.5
      const rotY = rand() * Math.PI * 2
      spots.push({ x, y: h, z, scale, rotY })
    }

    const canopy = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: '#2f4a2e', roughness: 0.95, flatShading: true }),
      spots.length
    )
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.14, 0.2, 1, 5),
      new THREE.MeshStandardMaterial({ color: '#4d3b28', roughness: 1 }),
      spots.length
    )
    spots.forEach((s, i) => {
      canopy.setMatrixAt(
        i,
        makeMatrix(s.x, s.y + 2.2 * s.scale, s.z, s.scale, s.rotY)
      )
      trunk.setMatrixAt(
        i,
        makeMatrix(s.x, s.y + 0.5 * s.scale, s.z, s.scale, s.rotY)
      )
    })
    canopy.instanceMatrix.needsUpdate = true
    trunk.instanceMatrix.needsUpdate = true
    return { canopies: canopy, trunks: trunk }
  }, [count])

  return (
    <>
      <primitive object={canopies} />
      <primitive object={trunks} />
    </>
  )
}
