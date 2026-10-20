'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { ATMOSPHERE, withAtmosphere } from './atmosphere'
import { groundGradient, groundHeight, groundSlope } from './terrainMesh'
import { BEAR, CAMP, HERD } from './places'
import { trailDistance } from './trails'
import { CREEK_BANK_RADIUS, creekDistance } from './creekbed'
import { hasObstacles, obstacleClearance, pathClear } from './obstacles'
import { usePrefersReducedMotion } from './hooks'
import { benchmark, createRandom, markBenchmark } from './benchmark/config'

const SPECIES = {
  deer: { url: '/models/animals/Deer.glb', scale: 0.45, shadow: [1.9, 1.0] },
  stag: { url: '/models/animals/Stag.glb', scale: 0.47, shadow: [2.1, 1.1] },
}
const URLS = [SPECIES.deer.url, SPECIES.stag.url]

const HERD_RADIUS = 14
const CLEARANCE = 1.2
const SPACING = 3
const TURN_RATE = 1.8
const FADE = 0.35
const ARRIVE = 0.4

const smoothstep = THREE.MathUtils.smoothstep

function standable(x, z) {
  const h = groundHeight(x, z)
  if (h < 0.6 || h > 8) return false
  if (groundSlope(x, z) > 0.22) return false
  if (trailDistance(x, z) < 2.5) return false
  if (creekDistance(x, z) < CREEK_BANK_RADIUS + 1) return false
  if (obstacleClearance(x, z) < CLEARANCE) return false
  if (Math.hypot(x - CAMP.x, z - CAMP.z) < 30) return false
  if (Math.hypot(x - BEAR.x, z - BEAR.z) < 25) return false
  return true
}

function findHome() {
  let best = null
  let bestScore = Infinity
  for (let z = HERD.z - 30; z <= HERD.z + 30; z += 2) {
    for (let x = HERD.x - 45; x <= HERD.x + 45; x += 2) {
      if (!standable(x, z)) continue
      let open = 0
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        if (standable(x + Math.cos(a) * 6, z + Math.sin(a) * 6)) open++
      }
      if (open < 6) continue
      const score = Math.hypot(x - HERD.x, z - HERD.z) + (8 - open) * 10
      if (score < bestScore) {
        bestScore = score
        best = { x, z }
      }
    }
  }
  return best
}

function makeShadowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,1)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

function pickNext(rand, state) {
  const r = rand()
  if (state === 'idle') return r < 0.5 ? 'graze' : r < 0.8 ? 'walk' : 'look'
  if (state === 'graze') return r < 0.45 ? 'idle' : r < 0.8 ? 'walk' : 'look'
  if (state === 'look') return r < 0.6 ? 'graze' : 'idle'
  return r < 0.6 ? 'graze' : 'idle'
}

function playAction(actor, name, immediate = false) {
  const next = actor.actions[name]
  if (!next || next === actor.active) return
  if (actor.active && !immediate) actor.active.fadeOut(FADE)
  next.reset()
  next.timeScale = 1
  if (actor.active && !immediate) next.fadeIn(FADE)
  next.play()
  actor.active = next
}

function enterState(h, actor, state) {
  const { rand, actors } = h
  actor.state = state
  if (state === 'idle') {
    playAction(actor, rand() < 0.6 ? 'Idle' : 'Idle_2')
    actor.timer = 3 + rand() * 5
  } else if (state === 'graze') {
    playAction(actor, 'Eating')
    actor.timer = 6 + rand() * 14
  } else if (state === 'look') {
    playAction(actor, 'Idle_Headlow')
    actor.timer = 3 + rand() * 4
  } else if (state === 'walk') {
    let target = null
    for (let tries = 0; tries < 12 && !target; tries++) {
      const a = rand() * Math.PI * 2
      const r = 4 + rand() * HERD_RADIUS
      const tx = h.home.x + Math.cos(a) * r
      const tz = h.home.z + Math.sin(a) * r
      if (Math.hypot(tx - actor.x, tz - actor.z) < 3) continue
      if (!standable(tx, tz)) continue
      if (!pathClear(actor.x, actor.z, tx, tz, CLEARANCE)) continue
      const crowded = actors.some(
        (o) => o !== actor && (Math.hypot(o.x - tx, o.z - tz) < SPACING || (o.target && Math.hypot(o.target.x - tx, o.target.z - tz) < SPACING))
      )
      if (crowded) continue
      target = { x: tx, z: tz }
    }
    if (!target) {
      enterState(h, actor, 'graze')
      return
    }
    actor.target = target
    playAction(actor, 'Walk')
    actor.timer = 30
  }
}

function placeHerd(h) {
  const home = findHome()
  if (!home) return false
  const { rand, actors } = h
  h.home = home
  actors.forEach((actor, i) => {
    let placed = false
    for (let tries = 0; tries < 30 && !placed; tries++) {
      const a = rand() * Math.PI * 2
      const r = i === 0 ? 0 : 3 + rand() * 7
      const x = home.x + Math.cos(a) * r
      const z = home.z + Math.sin(a) * r
      if (!standable(x, z)) continue
      if (actors.some((o) => o !== actor && o.placed && Math.hypot(o.x - x, o.z - z) < SPACING)) continue
      actor.x = x
      actor.z = z
      placed = true
    }
    if (!placed) {
      actor.x = home.x
      actor.z = home.z
    }
    actor.placed = true
    actor.yaw = rand() * Math.PI * 2
    playAction(actor, i === 0 ? 'Idle' : 'Eating', true)
    actor.state = i === 0 ? 'idle' : 'graze'
    actor.timer = 2 + rand() * 6
    if (actor.active) actor.active.time = rand() * actor.active.getClip().duration
  })
  h.placed = true
  markBenchmark('animals-ready', { home, count: actors.length })
  return true
}

function stepHerd(h, dt) {
  const walking = h.actors.some((a) => a.state === 'walk')
  for (const actor of h.actors) {
    if (dt > 0) {
      actor.timer -= dt
      if (actor.state === 'walk') {
        const dx = actor.target.x - actor.x
        const dz = actor.target.z - actor.z
        const dist = Math.hypot(dx, dz)
        const desired = Math.atan2(dx, dz)
        let diff = desired - actor.yaw
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        actor.yaw += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt)
        const aligned = 1 - Math.min(1, Math.abs(diff) / Math.PI) * 0.8
        const step = Math.min(dist, actor.speed * aligned * dt)
        actor.x += Math.sin(actor.yaw) * step
        actor.z += Math.cos(actor.yaw) * step
        if (actor.active) actor.active.timeScale = Math.max(0.2, step / (actor.speed * dt))
        if (dist - step < ARRIVE || actor.timer <= 0) {
          actor.target = null
          enterState(h, actor, pickNext(h.rand, 'walk'))
        }
      } else if (actor.timer <= 0) {
        let next = pickNext(h.rand, actor.state)
        if (next === 'walk' && walking) next = 'graze'
        enterState(h, actor, next)
      }
    }
    const y = groundHeight(actor.x, actor.z)
    groundGradient(actor.x, actor.z, h.gradient)
    const ahead = h.gradient[0] * Math.sin(actor.yaw) + h.gradient[1] * Math.cos(actor.yaw)
    actor.holder.position.set(actor.x, y, actor.z)
    actor.holder.rotation.y = actor.yaw
    actor.holder.rotation.x = -Math.atan(ahead) * 0.8
    actor.mixer.update(dt)
  }
}

function createActor(species, gltf, material, shadowGeometry, shadowMaterial, skeletons) {
  const spec = SPECIES[species]
  const model = clone(gltf.scene)
  model.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = false
    object.receiveShadow = true
    object.frustumCulled = false
    object.material = material
    if (object.isSkinnedMesh) skeletons.add(object.skeleton)
  })
  model.scale.setScalar(spec.scale)
  const mixer = new THREE.AnimationMixer(model)
  const actions = {}
  for (const name of ['Idle', 'Idle_2', 'Idle_Headlow', 'Eating', 'Walk']) {
    const c = THREE.AnimationClip.findByName(gltf.animations, name)
    if (c) actions[name] = mixer.clipAction(c)
  }
  const holder = new THREE.Group()
  holder.rotation.order = 'YXZ'
  holder.add(model)
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial)
  shadow.scale.set(spec.shadow[0], 1, spec.shadow[1])
  shadow.position.y = 0.04
  shadow.renderOrder = 1
  holder.add(shadow)
  const stride = Number(gltf.scene.userData.strideLength)
  const walkDuration = actions.Walk ? actions.Walk.getClip().duration : 1
  return {
    species,
    holder,
    mixer,
    actions,
    active: null,
    state: 'idle',
    timer: 0,
    x: 0,
    z: 0,
    yaw: 0,
    target: null,
    placed: false,
    speed: ((Number.isFinite(stride) && stride > 0 ? stride : 2.8) * spec.scale) / walkDuration,
  }
}

function Herd({ count, reducedMotion }) {
  const gltfs = useGLTF(URLS)
  const group = useRef()
  const herd = useRef(null)

  useEffect(() => {
    const parent = group.current
    const material = withAtmosphere(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true }),
      'animals'
    )
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: makeShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const skeletons = new Set()
    const roster = ['stag', 'deer', 'deer'].slice(0, Math.max(1, count))
    const actors = roster.map((species) =>
      createActor(species, gltfs[URLS.indexOf(SPECIES[species].url)], material, shadowGeometry, shadowMaterial, skeletons)
    )
    actors.forEach((a) => parent.add(a.holder))
    herd.current = {
      actors,
      home: null,
      placed: false,
      rand: benchmark ? createRandom(benchmark.seed ^ 0xa11a) : Math.random,
      gradient: [0, 0],
      shadowMaterial,
    }
    return () => {
      herd.current = null
      actors.forEach((a) => {
        a.mixer.stopAllAction()
        a.mixer.uncacheRoot(a.holder)
        parent.remove(a.holder)
      })
      skeletons.forEach((s) => s.dispose())
      material.dispose()
      shadowMaterial.map.dispose()
      shadowMaterial.dispose()
      shadowGeometry.dispose()
    }
  }, [gltfs, count])

  useFrame((_, delta) => {
    const h = herd.current
    if (!h) return
    if (!h.placed && (!hasObstacles('forest') || !placeHerd(h))) return
    h.shadowMaterial.opacity = 0.5 * smoothstep(ATMOSPHERE.uSunDir.value.y, -0.02, 0.12)
    stepHerd(h, reducedMotion ? 0 : delta)
  })

  return <group ref={group} />
}

export default function Animals({ count = 3 }) {
  const reducedMotion = usePrefersReducedMotion()
  if (benchmark?.animals === 'off') return null
  return (
    <Suspense fallback={null}>
      <Herd count={count} reducedMotion={reducedMotion} />
    </Suspense>
  )
}
