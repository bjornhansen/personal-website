'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from './store'
import { terrainHeight } from './Terrain'
import { CAMP, BEAR } from './Bear'
import { usePrefersReducedMotion } from './hooks'

export const SPOTS = {
  building: { x: CAMP.x - 6, z: CAMP.z - 18 },
  background: { x: CAMP.x + 18, z: CAMP.z + 14 },
  contact: { x: CAMP.x + 2, z: CAMP.z + 6 },
}

function Marker({ id, position }) {
  const openSection = useSceneStore((s) => s.openSection)
  const reducedMotion = usePrefersReducedMotion()
  const ref = useRef()

  useFrame((state) => {
    if (!ref.current || reducedMotion) return
    const t = state.clock.elapsedTime
    const s = 1 + Math.sin(t * 2.2) * 0.12
    ref.current.scale.set(s, s, s)
  })

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
          openSection(id)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshStandardMaterial
          color='#ffd97a'
          emissive='#ffbf3f'
          emissiveIntensity={2}
          transparent
          opacity={0.85}
        />
      </mesh>
      <pointLight color='#ffd97a' intensity={8} distance={12} />
    </group>
  )
}

function Tent({ position }) {
  return (
    <group position={position} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.85, 0]}>
        <coneGeometry args={[2.1, 1.9, 4]} />
        <meshStandardMaterial color='#b0543c' roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.85, 1.05]} rotation={[0, 0.78, 0]}>
        <planeGeometry args={[0.7, 1.2]} />
        <meshStandardMaterial color='#2b2018' side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Campfire({ position }) {
  const flame = useRef()
  const reducedMotion = usePrefersReducedMotion()
  useFrame((state) => {
    if (!flame.current || reducedMotion) return
    const t = state.clock.elapsedTime
    const s = 1 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.05
    flame.current.scale.set(s, 1.6 + Math.sin(t * 7) * 0.3, s)
  })
  return (
    <group position={position}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75]}
            rotation={[Math.PI / 2.3, a, 0]}
          >
            <capsuleGeometry args={[0.09, 0.5, 4, 8]} />
            <meshStandardMaterial color='#5a4a3a' roughness={1} />
          </mesh>
        )
      })}
      <mesh ref={flame} position={[0, 0.45, 0]}>
        <coneGeometry args={[0.35, 0.9, 8]} />
        <meshStandardMaterial
          color='#ff9a3c'
          emissive='#ff7a1f'
          emissiveIntensity={3}
        />
      </mesh>
      <pointLight
        color='#ff9a3c'
        intensity={25}
        distance={18}
        position={[0, 1.2, 0]}
      />
    </group>
  )
}

function TrailheadSign({ position }) {
  return (
    <group position={position} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 2.2, 8]} />
        <meshStandardMaterial color='#6b5842' roughness={1} />
      </mesh>
      <mesh position={[0, 1.9, 0]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[1.5, 0.55, 0.08]} />
        <meshStandardMaterial color='#8a755a' roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.25, 0]} rotation={[0, -0.15, 0]}>
        <boxGeometry args={[1.1, 0.4, 0.08]} />
        <meshStandardMaterial color='#8a755a' roughness={0.95} />
      </mesh>
    </group>
  )
}

export default function CampProps() {
  return (
    <group>
      <Tent
        position={[SPOTS.building.x, terrainHeight(SPOTS.building.x, SPOTS.building.z), SPOTS.building.z]}
      />
      <Campfire
        position={[SPOTS.contact.x, terrainHeight(SPOTS.contact.x, SPOTS.contact.z), SPOTS.contact.z]}
      />
      <TrailheadSign
        position={[SPOTS.background.x, terrainHeight(SPOTS.background.x, SPOTS.background.z), SPOTS.background.z]}
      />
      {Object.entries(SPOTS).map(([id, { x, z }]) => (
        <Marker key={id} id={id} position={[x, terrainHeight(x, z) + 3, z]} />
      ))}
      <mesh
        position={[CAMP.x, terrainHeight(CAMP.x, CAMP.z) + 0.02, CAMP.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[9, 32]} />
        <meshStandardMaterial color='#6e5c44' roughness={1} />
      </mesh>
      <mesh
        position={[BEAR.x, terrainHeight(BEAR.x, BEAR.z) + 0.02, BEAR.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[2.2, 24]} />
        <meshStandardMaterial color='#57452f' roughness={1} />
      </mesh>
    </group>
  )
}
