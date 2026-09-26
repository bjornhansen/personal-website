'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useSceneStore } from './store'
import { terrainHeight } from './Terrain'
import { usePrefersReducedMotion } from './hooks'
import { benchmark, benchmarkState, markBenchmark } from './benchmark/config'
import { withAtmosphere } from './atmosphere'

export const CAMP = { x: 56, z: 88 }
export const BEAR = { x: 62, z: 95 }
export const SPAWN = { x: 130, z: 40 }
export const WALK_SECONDS = 9

const DEST = new THREE.Vector3(BEAR.x, 0, BEAR.z)
const SPAWN_V = new THREE.Vector3(SPAWN.x, 0, SPAWN.z)
const WALK_DIR = new THREE.Vector3().subVectors(DEST, SPAWN_V)
const WALK_YAW = Math.atan2(WALK_DIR.x, WALK_DIR.z)
const BEAR_SCALE = 1.8
const WALK_STRIDE = 0.7
const MODEL_SPAWN = DEST.clone().addScaledVector(WALK_DIR, -12 / WALK_DIR.length())

function useCastShadows(group) {
  useEffect(() => {
    group.current?.traverse((o) => {
      if (o.isMesh) o.castShadow = true
    })
  }, [group])
}

function useWalkIn(start = SPAWN_V) {
  const progress = useRef(0)
  const setBearArrived = useSceneStore((s) => s.setBearArrived)
  const reducedMotion = usePrefersReducedMotion()
  const arrived = useRef(false)

  const pos = useRef(new THREE.Vector3().copy(start))
  const walking = useRef(!reducedMotion)
  const stepDistance = useRef(0)

  useEffect(() => {
    markBenchmark('bear-ready')
  }, [])

  useFrame((_, delta) => {
    stepDistance.current = 0
    if (arrived.current) {
      walking.current = false
      return
    }
    progress.current = Math.min(1, progress.current + delta / WALK_SECONDS)
    if (progress.current >= 1 || reducedMotion) {
      arrived.current = true
      walking.current = false
      setBearArrived()
    }
    const t = reducedMotion ? 1 : progress.current
    const eased = t * t * (3 - 2 * t)
    const previousX = pos.current.x
    const previousZ = pos.current.z
    pos.current.lerpVectors(start, DEST, eased)
    pos.current.y = terrainHeight(pos.current.x, pos.current.z)
    if (!reducedMotion) {
      stepDistance.current = Math.hypot(pos.current.x - previousX, pos.current.z - previousZ)
    }
  })

  return { pos, walking, stepDistance }
}

function BearGLB() {
  const { scene, animations } = useGLTF('/models/bear.glb')
  const { pos, walking, stepDistance } = useWalkIn(MODEL_SPAWN)
  const reducedMotion = usePrefersReducedMotion()
  const group = useRef()
  const animation = useRef(null)

  useEffect(() => {
    const parent = group.current
    const model = clone(scene)
    const materials = new Map()
    const skeletons = new Set()
    const prepareMaterial = (source) => {
      if (!materials.has(source)) {
        materials.set(source, withAtmosphere(source.clone(), 'bear'))
      }
      return materials.get(source)
    }
    model.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = Array.isArray(object.material)
        ? object.material.map(prepareMaterial)
        : prepareMaterial(object.material)
      if (object.isSkinnedMesh) skeletons.add(object.skeleton)
    })
    const mixer = new THREE.AnimationMixer(model)
    const action = (name) => {
      const clip = THREE.AnimationClip.findByName(animations, name) ?? animations[0]
      return clip ? mixer.clipAction(clip) : null
    }
    const stride = Number(scene.userData.strideLength)
    animation.current = {
      mixer,
      walk: action('Walk'),
      idle: action('Idle'),
      stride: Number.isFinite(stride) && stride > 0 ? stride : WALK_STRIDE,
      active: null,
      reducedMotion: null,
    }
    parent.add(model)
    return () => {
      animation.current = null
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      parent.remove(model)
      materials.forEach((material) => material.dispose())
      skeletons.forEach((skeleton) => skeleton.dispose())
    }
  }, [scene, animations])

  useFrame(({ camera, gl }, delta) => {
    const state = animation.current
    if (!group.current || !state) return
    group.current.position.copy(pos.current)
    if (walking.current) {
      group.current.rotation.y = WALK_YAW
    } else if (!reducedMotion) {
      const angle = Math.atan2(camera.position.x - pos.current.x, camera.position.z - pos.current.z)
      const difference = angle - group.current.rotation.y
      const turn = Math.atan2(Math.sin(difference), Math.cos(difference)) * (1 - Math.exp(-1.2 * delta))
      group.current.rotation.y += turn
      if (Math.abs(turn) > 0.001) gl.shadowMap.needsUpdate = true
    } else {
      group.current.rotation.y = WALK_YAW
    }

    const next = walking.current && !reducedMotion ? state.walk : state.idle
    if (next && (next !== state.active || state.reducedMotion !== reducedMotion)) {
      if (reducedMotion) state.mixer.stopAllAction()
      else if (state.active && state.active !== next) state.active.fadeOut(0.3)
      next.reset().play()
      if (!reducedMotion && state.active && state.active !== next) next.fadeIn(0.3)
      state.active = next
      state.reducedMotion = reducedMotion
      gl.shadowMap.needsUpdate = true
    }
    if (walking.current && state.walk && delta > 0) {
      state.walk.timeScale = stepDistance.current * state.walk.getClip().duration / (BEAR_SCALE * state.stride * delta)
    }
    state.mixer.update(reducedMotion ? 0 : delta)
  })

  return <group ref={group} scale={BEAR_SCALE} />
}

function ProceduralBear() {
  const { pos, walking } = useWalkIn()
  const group = useRef()
  const body = useRef()
  const head = useRef()
  const legFL = useRef()
  const legFR = useRef()
  const legBL = useRef()
  const legBR = useRef()
  const camera = useThree((s) => s.camera)
  const legRefs = [legFL, legFR, legBL, legBR]
  useCastShadows(group)

  useFrame((state) => {
    const t = benchmark ? benchmarkState.animationTime : state.clock.elapsedTime
    if (!group.current) return
    group.current.position.copy(pos.current)

    if (walking.current) {
      group.current.rotation.y = WALK_YAW
      const s = Math.sin(t * 6)
      const swing = [
        [legFL, s],
        [legFR, -s],
        [legBL, -s],
        [legBR, s],
      ]
      for (const [leg, a] of swing) {
        if (leg.current) leg.current.rotation.x = a * 0.55
      }
      if (body.current) body.current.position.y = 1.05 + Math.abs(s) * 0.06
    } else {
      for (const leg of [legFL, legFR, legBL, legBR]) {
        if (leg.current) leg.current.rotation.x = 0
      }
      if (body.current) {
        body.current.position.y = 1.05
        body.current.scale.y = 1 + Math.sin(t * 1.6) * 0.015
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.3) * 0.25
        head.current.rotation.z = Math.sin(t * 0.45) * 0.04
      }
      const toCam = new THREE.Vector3().subVectors(
        camera.position,
        group.current.position
      )
      const angle = Math.atan2(toCam.x, toCam.z)
      let delta = angle - group.current.rotation.y
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      group.current.rotation.y += delta * 0.02
    }
  })

  return (
    <group ref={group}>
      <group ref={body} position={[0, 1.05, 0]}>
        <mesh>
          <capsuleGeometry args={[0.85, 1.1, 6, 12]} />
          <meshStandardMaterial color='#4a382c' roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.95, 0.45]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color='#5a4536' roughness={0.9} />
        </mesh>
        <group ref={head} position={[0, 1.35, 0.75]}>
          <mesh>
            <sphereGeometry args={[0.42, 16, 16]} />
            <meshStandardMaterial color='#4a382c' roughness={0.9} />
          </mesh>
          <mesh position={[0.28, 0.3, 0]}>
            <sphereGeometry args={[0.13, 10, 10]} />
            <meshStandardMaterial color='#4a382c' roughness={0.9} />
          </mesh>
          <mesh position={[-0.28, 0.3, 0]}>
            <sphereGeometry args={[0.13, 10, 10]} />
            <meshStandardMaterial color='#4a382c' roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.05, 0.38]}>
            <capsuleGeometry args={[0.14, 0.18, 6, 10]} />
            <meshStandardMaterial color='#8a6a52' roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.05, 0.5]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color='#1c150f' roughness={0.6} />
          </mesh>
        </group>
      </group>
      {[
        [0.42, 0.35],
        [-0.42, 0.35],
        [0.38, -0.35],
        [-0.38, -0.35],
      ].map(([lx, lz], i) => (
        <group key={i} ref={legRefs[i]} position={[lx, 0.7, lz]}>
          <mesh position={[0, -0.35, 0]}>
            <capsuleGeometry args={[0.22, 0.4, 6, 10]} />
            <meshStandardMaterial color='#3d2e24' roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function Bear() {
  const [hasModel, setHasModel] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    fetch('/models/bear.glb', { method: 'HEAD' })
      .then((r) => setHasModel(r.ok))
      .catch(() => setHasModel(false))
      .finally(() => setChecked(true))
  }, [])

  if (!checked) return null
  if (hasModel) {
    return (
      <Suspense fallback={null}>
        <BearGLB />
      </Suspense>
    )
  }
  return <ProceduralBear />
}
