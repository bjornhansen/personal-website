'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from './store'
import { terrainHeight } from './Terrain'
import { SPOTS } from './CampProps'
import { usePrefersReducedMotion } from './hooks'
import { BEAR } from './Bear'

const DEFAULT_CAM = new THREE.Vector3(0, 28, 185)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 20)

function viewFor(id) {
  const { x, z } = SPOTS[id]
  const gy = terrainHeight(x, z)
  if (id === 'contact') {
    return {
      pos: new THREE.Vector3(x - 6, gy + 3, z + 9),
      target: new THREE.Vector3(x, gy + 1, z),
    }
  }
  return {
    pos: new THREE.Vector3(x + 10, gy + 8, z + 16),
    target: new THREE.Vector3(x, gy + 2, z),
  }
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const activeSection = useSceneStore((s) => s.activeSection)
  const reducedMotion = usePrefersReducedMotion()
  const goal = useRef(null)
  const target = useRef(null)

  useEffect(() => {
    if (activeSection) {
      goal.current = viewFor(activeSection).pos
      target.current = viewFor(activeSection).target
    } else {
      goal.current = DEFAULT_CAM
      target.current = DEFAULT_TARGET
    }
  }, [activeSection])

  useFrame(() => {
    if (!goal.current || !target.current) return
    const t = reducedMotion ? 1 : 0.045
    camera.position.lerp(goal.current, t)
    if (controls) {
      controls.target.lerp(target.current, t)
      controls.update()
    }
  })

  return null
}
