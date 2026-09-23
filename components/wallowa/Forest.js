'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { withAtmosphere } from './atmosphere'
import { terrainHeight, meadowMask, lakeBowl } from './Terrain'
import { CAMP, BEAR } from './Bear'
import { CANOPY, CONTACT, commitGround, paintBlob } from './groundMap'
import { trailDistance } from './trails'

const model = (n) => `/models/nature/${n}.glb`

const TYPES = [
  { file: 'PineTree_1', kind: 'pine', target: 7 },
  { file: 'PineTree_2', kind: 'pine', target: 7.5 },
  { file: 'PineTree_3', kind: 'pine', target: 6.5 },
  { file: 'PineTree_Snow_1', kind: 'pineSnow', target: 7 },
  { file: 'PineTree_Snow_2', kind: 'pineSnow', target: 6 },
  { file: 'BirchTree_2', kind: 'aspen', target: 6 },
  { file: 'BirchTree_3', kind: 'aspen', target: 5.5 },
  { file: 'BirchTree_Autumn_1', kind: 'aspen', target: 6.5 },
  { file: 'Willow_1', kind: 'willow', target: 5 },
  { file: 'Willow_3', kind: 'willow', target: 4.5 },
  { file: 'Bush_1', kind: 'bush', target: 1.6 },
  { file: 'Bush_2', kind: 'bush', target: 1.4 },
  { file: 'BushBerries_1', kind: 'berries', target: 1.5 },
  { file: 'Rock_1', kind: 'rock', target: 1.6 },
  { file: 'Rock_2', kind: 'rock', target: 1.1 },
  { file: 'Rock_Moss_1', kind: 'rockMoss', target: 1.4 },
  { file: 'Rock_Moss_2', kind: 'rockMoss', target: 0.9 },
  { file: 'WoodLog', kind: 'log', target: 1.4 },
  { file: 'TreeStump', kind: 'stump', target: 1.2 },
  { file: 'Rock_1', kind: 'pebble', target: 0.5 },
  { file: 'Rock_2', kind: 'pebble', target: 0.4 },
  { file: 'Rock_Moss_2', kind: 'pebble', target: 0.45 },
]

const URLS = TYPES.map((t) => model(t.file))

const KINDS = ['pine', 'pineSnow', 'aspen', 'willow', 'bush', 'berries', 'rock', 'rockMoss', 'log', 'stump', 'pebble']

const FOOTPRINT = {
  pine: { contact: 1.7, canopy: 4.6, dark: 0.75 },
  pineSnow: { contact: 1.6, canopy: 4.2, dark: 0.7 },
  aspen: { contact: 1.2, canopy: 3.2, dark: 0.45 },
  willow: { contact: 1.5, canopy: 3.2, dark: 0.5 },
  bush: { contact: 1.1, canopy: 0, dark: 0.55 },
  berries: { contact: 1.1, canopy: 0, dark: 0.55 },
  rock: { contact: 1.3, canopy: 0, dark: 0.6 },
  rockMoss: { contact: 1.2, canopy: 0, dark: 0.6 },
  log: { contact: 1.6, canopy: 0, dark: 0.55 },
  stump: { contact: 1, canopy: 0, dark: 0.55 },
  pebble: { contact: 0.5, canopy: 0, dark: 0.45 },
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function Forest({
  pines = 650,
  snowPines = 140,
  aspens = 130,
  willows = 30,
  bushes = 60,
  berries = 30,
  rocks = 200,
  mossRocks = 90,
  logs = 22,
  stumps = 16,
  pebbles = 160,
}) {
  const gltfs = useGLTF(URLS)

  const { group, footprints } = useMemo(() => {
    const rand = mulberry32(1849)
    const caps = KINDS.reduce((acc, k) => {
      acc[k] = { pine: pines, pineSnow: snowPines, aspen: aspens, willow: willows, bush: bushes, berries, rock: rocks, rockMoss: mossRocks, log: logs + 2, stump: stumps + 1, pebble: pebbles }[k]
      return acc
    }, {})
    const placed = KINDS.reduce((acc, k) => {
      acc[k] = []
      return acc
    }, {})

    const pick = (kind, x, y, z, scale) => {
      const variants = TYPES.filter((t) => t.kind === kind)
      const t = variants[Math.floor(rand() * variants.length)]
      placed[kind].push({ type: t, x, y, z, scale: scale * (0.85 + rand() * 0.35), rot: rand() * Math.PI * 2 })
    }

    let attempts = 0
    const needTotal = KINDS.reduce((s, k) => s + caps[k], 0)
    const haveTotal = () => KINDS.reduce((s, k) => s + placed[k].length, 0)
    while (haveTotal() < needTotal && attempts < needTotal * 25) {
      attempts++
      const x = (rand() - 0.5) * 400
      const z = (rand() - 0.5) * 400
      const h = terrainHeight(x, z)
      if (h > 24) continue
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < 17) continue
      if (Math.hypot(x - BEAR.x, z - BEAR.z) < 5) continue
      if (h > -0.35 && h < 1.2 && placed.pebble.length < caps.pebble && rand() < 0.6) {
        if (trailDistance(x, z) < 1) continue
        pick('pebble', x, h - 0.08, z, 0.6 + rand() * 1.1)
        continue
      }
      if (h < 1.4) continue
      if (lakeBowl(x, z) > 0.05) continue
      if (trailDistance(x, z) < 2.2) continue

      const meadow = meadowMask(x, z)
      const clump = (rand() + rand() + rand()) / 3
      const shore = lakeBowl(x, z)

      if (h > 14 && placed.pineSnow.length < caps.pineSnow) {
        pick('pineSnow', x, h, z, 1)
        continue
      }
      if (meadow > 0.64 && h < 14 && clump > 0.5) {
        if (placed.aspen.length < caps.aspen && h < 12) {
          pick('aspen', x, h, z, 1)
        } else if (h < 8 && placed.bush.length < caps.bush) {
          pick('bush', x, h, z, 1)
        } else if (placed.berries.length < caps.berries) {
          pick('berries', x, h, z, 1)
        }
        continue
      }
      if (meadow < 0.58 && h < 12 && rand() < 0.04) {
        if (placed.log.length < caps.log && rand() < 0.6) {
          pick('log', x, h, z, 0.8 + rand() * 0.5)
          continue
        }
        if (placed.stump.length < caps.stump) {
          pick('stump', x, h, z, 0.8 + rand() * 0.4)
          continue
        }
      }
      if (meadow < 0.58 && clump > 0.28 && placed.pine.length < caps.pine) {
        pick('pine', x, h, z, 1)
        continue
      }
      if (meadow < 0.58 && rand() < 0.35 && placed.pine.length < caps.pine) {
        pick('pine', x, h, z, 1)
        continue
      }
      if (shore > 0 && shore < 0.22 && h < 3 && placed.willow.length < caps.willow) {
        pick('willow', x, h, z, 1)
        continue
      }
      if (rand() < 0.4 && placed.rock.length < caps.rock) {
        pick('rock', x, h, z, 0.4 + rand() * 0.9)
      } else if (rand() < 0.25 && placed.rockMoss.length < caps.rockMoss) {
        pick('rockMoss', x, h, z, 0.4 + rand() * 0.9)
      }
    }

    const woodLog = TYPES.find((t) => t.file === 'WoodLog')
    const treeStump = TYPES.find((t) => t.file === 'TreeStump')
    placed.log.push({ type: woodLog, x: CAMP.x - 12, y: terrainHeight(CAMP.x - 12, CAMP.z + 3), z: CAMP.z + 3, scale: 1, rot: 0.7 })
    placed.log.push({ type: woodLog, x: CAMP.x + 14, y: terrainHeight(CAMP.x + 14, CAMP.z - 8), z: CAMP.z - 8, scale: 0.9, rot: 2.4 })
    placed.stump.push({ type: treeStump, x: CAMP.x + 8, y: terrainHeight(CAMP.x + 8, CAMP.z - 12), z: CAMP.z - 12, scale: 1, rot: 1.2 })

    const material = withAtmosphere(new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    }), 'forest')

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const tint = new THREE.Color()

    const group = new THREE.Group()
    TYPES.forEach((t, idx) => {
      const instances = placed[t.kind].filter((i) => i.type.file === t.file)
      if (!instances.length) return
      const source = gltfs[idx].scene.children[0]
      const geo = source.geometry.clone()
      geo.computeBoundingBox()
      const height = geo.boundingBox.max.y - geo.boundingBox.min.y
      const min = geo.boundingBox.min.y
      const mesh = new THREE.InstancedMesh(geo, material, instances.length)
      mesh.castShadow = true
      mesh.receiveShadow = true
      instances.forEach((inst, i) => {
        const scale = (t.target / height) * inst.scale
        q.setFromAxisAngle(up, inst.rot)
        p.set(inst.x, inst.y - min * scale, inst.z)
        s.set(scale, scale, scale)
        m.compose(p, q, s)
        mesh.setMatrixAt(i, m)
        const v = 0.85 + mulberry32(i * 31 + idx)( ) * 0.3
        tint.setScalar(v)
        mesh.setColorAt(i, tint)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      group.add(mesh)
    })

    const footprints = KINDS.flatMap((kind) =>
      placed[kind].map((p) => ({ kind, x: p.x, z: p.z, size: (p.type.target / 1.4) * p.scale }))
    )

    return { group, footprints }
  }, [gltfs, pines, snowPines, aspens, willows, bushes, berries, rocks, mossRocks, logs, stumps, pebbles])

  useEffect(() => {
    footprints.forEach(({ kind, x, z, size }) => {
      const f = FOOTPRINT[kind]
      const scale = kind === 'pine' || kind === 'pineSnow' || kind === 'aspen' || kind === 'willow' ? 1 : size
      paintBlob(CONTACT, x, z, f.contact * scale, f.dark, 1.4)
      if (f.canopy) paintBlob(CANOPY, x, z, f.canopy, 0.9, 0.7)
    })
    commitGround()
  }, [footprints])

  return <primitive object={group} />
}
