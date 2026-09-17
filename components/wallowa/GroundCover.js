'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { terrainHeight, meadowMask, lakeBowl } from './Terrain'
import { CAMP } from './Bear'

const model = (n) => `/models/nature/${n}.glb`

const TYPES = [
  { file: 'Grass', target: 0.9 },
  { file: 'Grass_Short', target: 0.55 },
  { file: 'Flowers', target: 0.8 },
  { file: 'Lilypad', target: 0.7 },
]

const URLS = TYPES.map((t) => model(t.file))

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function GroundCover({
  grass = 2000,
  shortGrass = 700,
  flowers = 260,
  lilypads = 70,
}) {
  const gltfs = useGLTF(URLS)

  const meshes = useMemo(() => {
    const rand = mulberry32(7719)
    const counts = [grass, shortGrass, flowers, lilypads]
    const placed = TYPES.map(() => [])

    const place = (typeIdx, x, y, z, scale) =>
      placed[typeIdx].push({ x, y, z, scale, rot: rand() * Math.PI * 2 })

    let attempts = 0
    const need = counts.reduce((a, b) => a + b, 0)
    const have = () => placed.reduce((s, p) => s + p.length, 0)
    while (have() < need && attempts < need * 14) {
      attempts++
      const x = (rand() - 0.5) * 340
      const z = (rand() - 0.5) * 340
      if (Math.hypot(x + 10, z - 45) > 165) continue

      const bowl = lakeBowl(x, z)
      if (bowl > 0.18 && bowl < 0.6 && placed[3].length < counts[3] && rand() < 0.5) {
        place(3, x, 0.03, z, 1)
        continue
      }

      const h = terrainHeight(x, z)
      if (h < 0.8 || h > 16) continue
      const meadow = meadowMask(x, z)
      const nearCamp = Math.hypot(x - CAMP.x, z - CAMP.z) < 26
      if (meadow < 0.5 && !nearCamp) continue
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < 8) continue

      const r = rand()
      if (placed[2].length < counts[2] && r < 0.12 && meadow > 0.6) {
        place(2, x, h, z, 1)
      } else if (placed[1].length < counts[1] && r < 0.4) {
        place(1, x, h, z, 1)
      } else if (placed[0].length < counts[0]) {
        place(0, x, h, z, 1)
      }
    }

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    })

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const tint = new THREE.Color()

    const group = new THREE.Group()
    TYPES.forEach((t, idx) => {
      const instances = placed[idx]
      if (!instances.length) return
      const source = gltfs[idx].scene.children[0]
      const geo = source.geometry.clone()
      geo.computeBoundingBox()
      const height = geo.boundingBox.max.y - geo.boundingBox.min.y
      const min = geo.boundingBox.min.y
      const mesh = new THREE.InstancedMesh(geo, material, instances.length)
      instances.forEach((inst, i) => {
        const scale = (t.target / height) * inst.scale * (0.85 + rand() * 0.4)
        q.setFromAxisAngle(up, inst.rot)
        p.set(inst.x, inst.y - min * scale, inst.z)
        s.set(scale, scale, scale)
        m.compose(p, q, s)
        mesh.setMatrixAt(i, m)
        tint.setScalar(0.9 + rand() * 0.2)
        mesh.setColorAt(i, tint)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      group.add(mesh)
    })

    return group
  }, [gltfs, grass, shortGrass, flowers, lilypads])

  return <primitive object={meshes} />
}
