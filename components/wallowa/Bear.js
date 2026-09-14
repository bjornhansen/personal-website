'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from './store'
import { terrainHeight } from './Terrain'
import { usePrefersReducedMotion } from './hooks'

export const CAMP = { x: 56, z: 88 }
export const BEAR = { x: 62, z: 95 }
export const SPAWN = { x: 130, z: 40 }
export const WALK_SECONDS = 9

const DEST = new THREE.Vector3(BEAR.x, 0, BEAR.z)
const SPAWN_V = new THREE.Vector3(SPAWN.x, 0, SPAWN.z)
const WALK_DIR = new THREE.Vector3().subVectors(DEST, SPAWN_V)
const WALK_YAW = Math.atan2(WALK_DIR.x, WALK_DIR.z)

function useWalkIn() {
  const progress = useRef(0)
  const setBearArrived = useSceneStore((s) => s.setBearArrived)
  const reducedMotion = usePrefersReducedMotion()
  const arrived = useRef(reducedMotion)

  const pos = useRef(new THREE.Vector3().copy(SPAWN_V))
  const walking = useRef(!reducedMotion)

  useFrame((_, delta) => {
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
    pos.current.lerpVectors(SPAWN_V, DEST, eased)
    pos.current.y = terrainHeight(pos.current.x, pos.current.z)
  })

  return { pos, walking }
}

function BearGLB() {
  const { scene, animations } = useGLTF('/models/bear.glb')
  const { actions } = useAnimations(animations, scene)
  const { pos, walking } = useWalkIn()
  const bearArrived = useSceneStore((s) => s.bearArrived)
  const group = useRef()
  const camera = useThree((s) => s.camera)
  const tPos = useRef(new THREE.Vector3())

  const clips = useMemo(() => {
    const all = Object.values(actions)
    const byName = (names) =>
      all.find((a) =>
        names.some((n) => a.getClip().name.toLowerCase().includes(n))
      ) || all[0]
    return {
      idle: byName(['idle', 'standing']),
      walk: byName(['walk', 'run']),
    }
  }, [actions])

  useEffect(() => {
    if (!clips.idle && !clips.walk) return
    const next = bearArrived ? clips.idle : clips.walk || clips.idle
    const prev = bearArrived ? clips.walk : clips.idle
    if (!next) return
    if (prev && prev !== next) prev.fadeOut(0.4)
    next.reset().fadeIn(0.4).play()
  }, [clips, bearArrived])

  useFrame(() => {
    if (!group.current) return
    group.current.position.copy(pos.current)
    if (walking.current) {
      group.current.rotation.y = WALK_YAW
    } else {
      const toCam = tPos.current.subVectors(camera.position, group.current.position)
      const angle = Math.atan2(toCam.x, toCam.z)
      let delta = angle - group.current.rotation.y
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      group.current.rotation.y += delta * 0.02
    }
  })

  return (
    <group ref={group} scale={0.05}>
      <primitive object={scene} />
    </group>
  )
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

  useFrame((state) => {
    const t = state.clock.elapsedTime
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
