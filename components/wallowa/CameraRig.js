'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePrefersReducedMotion } from './hooks'

const OVERVIEW_POS = new THREE.Vector3(0, 28, 185)
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 20)

export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const reducedMotion = usePrefersReducedMotion()
  const target = useRef(OVERVIEW_TARGET.clone())

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const speed = reducedMotion ? 1 : Math.min(1, delta * 2.4)

    let desired = OVERVIEW_POS
    let look = target.current
    if (!reducedMotion) {
      const driftX = Math.sin(t * 0.12) * 2.2
      const driftY = Math.sin(t * 0.08) * 0.6
      desired = new THREE.Vector3(
        OVERVIEW_POS.x + driftX,
        OVERVIEW_POS.y + driftY,
        OVERVIEW_POS.z
      )
      look = new THREE.Vector3(
        OVERVIEW_TARGET.x + driftX * 0.05,
        OVERVIEW_TARGET.y + driftY * 0.05,
        OVERVIEW_TARGET.z
      )
    }

    camera.position.lerp(desired, speed)
    camera.lookAt(look)
  })

  return null
}
