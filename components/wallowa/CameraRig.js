'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from './store'
import { terrainHeight } from './Terrain'
import { SPOTS } from './CampProps'
import { usePrefersReducedMotion } from './hooks'
import { benchmark, benchmarkState } from './benchmark/config'

const OVERVIEW_POS = new THREE.Vector3(0, 28, 185)
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 20)

function viewpointFor(id) {
  const { x, z } = SPOTS[id]
  const gy = terrainHeight(x, z)
  if (id === 'contact') {
    return {
      pos: new THREE.Vector3(x - 7, gy + 2.6, z + 8),
      target: new THREE.Vector3(x + 1, gy + 0.8, z - 1),
    }
  }
  if (id === 'background') {
    return {
      pos: new THREE.Vector3(x + 7, gy + 3, z + 11),
      target: new THREE.Vector3(x, gy + 1.6, z),
    }
  }
  return {
    pos: new THREE.Vector3(x + 11, gy + 6.5, z + 14),
    target: new THREE.Vector3(x, gy + 2, z),
  }
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const activeSection = useSceneStore((s) => s.activeSection)
  const reducedMotion = usePrefersReducedMotion()
  const posGoal = useRef(OVERVIEW_POS.clone())
  const targetGoal = useRef(OVERVIEW_TARGET.clone())
  const sampleReset = useRef(false)

  useEffect(() => {
    const view = activeSection ? viewpointFor(activeSection) : { pos: OVERVIEW_POS, target: OVERVIEW_TARGET }
    posGoal.current.copy(view.pos)
    targetGoal.current.copy(view.target)
  }, [activeSection])

  useFrame((state, delta) => {
    const t = benchmark ? benchmarkState.animationTime : state.clock.elapsedTime
    const speed = reducedMotion ? 1 : Math.min(1, delta * 2.4)

    if (benchmark) {
      const section = useSceneStore.getState().activeSection
      const view = section ? viewpointFor(section) : { pos: OVERVIEW_POS, target: OVERVIEW_TARGET }
      posGoal.current.copy(view.pos)
      targetGoal.current.copy(view.target)
      if (benchmarkState.sampleStarted && !sampleReset.current) {
        sampleReset.current = true
        camera.position.copy(view.pos)
      }
    }

    const desired = posGoal.current.clone()
    const look = targetGoal.current.clone()
    if (!reducedMotion && benchmark?.camera !== 'fixed') {
      const driftX = Math.sin(t * 0.12) * 2.2
      const driftY = Math.sin(t * 0.08) * 0.6
      desired.x += driftX
      desired.y += driftY
      look.x += driftX * 0.05
      look.y += driftY * 0.05
    }

    const before = benchmarkState.inputPending ? camera.position.clone() : null
    camera.position.lerp(desired, benchmark?.camera === 'fixed' ? 1 : speed)
    camera.lookAt(look)
    if (benchmarkState.inputPending && before && camera.position.distanceToSquared(before) > 1e-10) {
      benchmarkState.inputPending.applied = true
    }
  })

  return null
}
