'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import * as THREE from 'three'
import Terrain from './Terrain'
import Lake from './Lake'
import Bear from './Bear'
import CampProps from './CampProps'
import CameraRig from './CameraRig'
import Greeting from './Greeting'
import Forest from './Forest'
import GroundCover from './GroundCover'
import { useDayNight } from './DayNight'
import { useIsMobile } from './hooks'

export default function Scene() {
  const {
    sunPosition,
    sunColor,
    nightFactor,
    ambientIntensity,
    sunIntensity,
    fogColor,
    isNight,
  } = useDayNight()
  const isMobile = useIsMobile()

  return (
    <Canvas
      dpr={[1, isMobile ? 1.75 : 2]}
      camera={{ position: [0, 28, 185], fov: 55, near: 0.5, far: 9000 }}
      gl={{
        antialias: !isMobile,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.25,
      }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach='background' args={[fogColor]} />
      <fog attach='fog' args={[fogColor, 120, 640]} />

      {!isNight && (
        <Sky
          distance={3000}
          sunPosition={[sunPosition.x, sunPosition.y, sunPosition.z]}
          turbidity={10}
          rayleigh={3}
        />
      )}
      <Stars radius={400} depth={60} count={2000} factor={5} fade speed={0.3} />

      {isNight && (
        <mesh position={[-220, 300, -350]}>
          <sphereGeometry args={[18, 24, 24]} />
          <meshBasicMaterial color='#dfe6f2' />
        </mesh>
      )}

      <hemisphereLight
        intensity={ambientIntensity}
        groundColor='#3a3226'
        color={isNight ? '#26364f' : '#cfe4f2'}
      />
      <directionalLight
        position={[sunPosition.x, sunPosition.y, sunPosition.z]}
        intensity={sunIntensity}
        color={sunColor}
      />

      <Terrain />
      <Lake sunColor={sunColor} nightFactor={nightFactor} />
      <Suspense fallback={null}>
        <Forest
          pines={isMobile ? 180 : 520}
          snowPines={isMobile ? 50 : 140}
          aspens={isMobile ? 80 : 200}
          willows={isMobile ? 14 : 36}
          bushes={isMobile ? 40 : 100}
          berries={isMobile ? 22 : 55}
          rocks={isMobile ? 50 : 130}
          mossRocks={isMobile ? 24 : 60}
        />
        <GroundCover
          grass={isMobile ? 700 : 2000}
          shortGrass={isMobile ? 250 : 700}
          flowers={isMobile ? 100 : 260}
          lilypads={isMobile ? 30 : 70}
        />
      </Suspense>

      <Bear />
      <CampProps />
      <Greeting />
      <CameraRig />
    </Canvas>
  )
}
