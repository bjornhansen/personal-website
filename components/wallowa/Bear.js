'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainHeight } from './Terrain'

export const CAMP = { x: 56, z: 88 }
export const BEAR = { x: 62, z: 95 }

export default function Bear() {
  const group = useRef()
  const head = useRef()
  const body = useRef()

  const y = terrainHeight(BEAR.x, BEAR.z)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (body.current) {
      body.current.scale.y = 1 + Math.sin(t * 1.6) * 0.015
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.3) * 0.25
      head.current.rotation.z = Math.sin(t * 0.45) * 0.04
    }
    if (group.current) {
      const look = new THREE.Vector3(
        state.camera.position.x,
        group.current.position.y + 2,
        state.camera.position.z
      )
      const toCam = new THREE.Vector3()
        .subVectors(look, group.current.position)
      const angle = Math.atan2(toCam.x, toCam.z)
      let current = group.current.rotation.y
      let delta = angle - current
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      current += delta * 0.02
      group.current.rotation.y = current
    }
  })

  return (
    <group ref={group} position={[BEAR.x, y, BEAR.z]} rotation={[0, -0.6, 0]}>
      <group ref={body} position={[0, 1.05, 0]}>
        <mesh castShadow>
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
        <mesh position={[0, -0.35, 0.55]} rotation={[0.7, 0, 0]}>
          <capsuleGeometry args={[0.28, 0.5, 6, 10]} />
          <meshStandardMaterial color='#4a382c' roughness={0.9} />
        </mesh>
      </group>
      {[
        [0.42, -0.1, 0.35],
        [-0.42, -0.1, 0.35],
      ].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, 0.35, lz]}>
          <capsuleGeometry args={[0.22, 0.4, 6, 10]} />
          <meshStandardMaterial color='#3d2e24' roughness={0.9} />
        </mesh>
      ))}
      {[
        [0.38, -0.3, -0.35],
        [-0.38, -0.3, -0.35],
      ].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, 0.35, lz]}>
          <capsuleGeometry args={[0.2, 0.3, 6, 10]} />
          <meshStandardMaterial color='#3d2e24' roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
