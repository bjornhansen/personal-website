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

function matrixAt(mesh, i, x, y, z, scale, rotY, stretch = 1) {
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(scale, scale * stretch, scale)
  )
  mesh.setMatrixAt(i, m)
}

export default function Forest({ count = 700, aspenCount = 220 }) {
  const meshes = useMemo(() => {
    const rand = mulberry32(1849)

    const pineSpots = []
    const aspenSpots = []
    let attempts = 0
    const limit = (count + aspenCount) * 40
    while (attempts < limit) {
      attempts++
      const x = (rand() - 0.5) * 400
      const z = (rand() - 0.5) * 400
      const h = terrainHeight(x, z)
      if (h < 1.2 || h > 22) continue
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < 18) continue
      const clump = (rand() + rand() + rand()) / 3

      const meadow = meadowMask(x, z)
      if (meadow < 0.5) {
        if (pineSpots.length >= count) continue
        if (clump < 0.35) continue
        pineSpots.push({ x, y: h, z, scale: 0.7 + rand() * 0.9 + clump * 0.5, rotY: rand() * Math.PI * 2 })
      } else if (meadow > 0.52 && h < 14) {
        if (aspenSpots.length >= aspenCount) continue
        const grove = (rand() + rand()) / 2
        if (grove < 0.45) continue
        if (clump < 0.5) continue
        aspenSpots.push({ x, y: h, z, scale: 0.9 + rand() * 0.7, rotY: rand() * Math.PI * 2 })
      }
    }

    const pineCanopy = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: '#2f4a2e', roughness: 0.95, flatShading: true }),
      pineSpots.length
    )
    const pineTrunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.14, 0.2, 1, 5),
      new THREE.MeshStandardMaterial({ color: '#4d3b28', roughness: 1 }),
      pineSpots.length
    )
    const aspenCanopy = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#a9b054', roughness: 0.9, flatShading: true }),
      aspenSpots.length
    )
    const aspenTrunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.12, 1, 5),
      new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.85 }),
      aspenSpots.length
    )

    pineSpots.forEach((s, i) => {
      matrixAt(pineCanopy, i, s.x, s.y + 2.2 * s.scale, s.z, s.scale, s.rotY)
      matrixAt(pineTrunk, i, s.x, s.y + 0.5 * s.scale, s.z, s.scale, s.rotY)
    })
    aspenSpots.forEach((s, i) => {
      matrixAt(aspenCanopy, i, s.x, s.y + 4.6 * s.scale, s.z, s.scale * 1.5, s.rotY, 0.8)
      matrixAt(aspenTrunk, i, s.x, s.y + 1.8 * s.scale, s.z, s.scale, s.rotY, 3.8)
    })

    for (const m of [pineCanopy, pineTrunk, aspenCanopy, aspenTrunk]) {
      m.instanceMatrix.needsUpdate = true
    }
    return { pineCanopy, pineTrunk, aspenCanopy, aspenTrunk }
  }, [count, aspenCount])

  return (
    <>
      <primitive object={meshes.pineCanopy} />
      <primitive object={meshes.pineTrunk} />
      <primitive object={meshes.aspenCanopy} />
      <primitive object={meshes.aspenTrunk} />
    </>
  )
}
