'use client'

import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Terrain from './Terrain'
import Lake from './Lake'
import LakeMist from './LakeMist'
import Bear from './Bear'
import CampProps from './CampProps'
import CameraRig from './CameraRig'
import Greeting from './Greeting'
import Forest from './Forest'
import GroundCover from './GroundCover'
import Atmosphere from './DayNight'
import Sky from './Sky'
import { useIsMobile } from './hooks'
import { useObserverLocation } from './location'
import { benchmark } from './benchmark/config'
import { createFrameCap } from './frameCap'

function CappedFrameloop() {
  const advance = useThree((s) => s.advance)

  useEffect(() => {
    const cap = createFrameCap()
    let start = null
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick)
      if (start === null) start = now
      if (cap.tick(now)) advance((now - start) / 1000)
    })
    return () => cancelAnimationFrame(raf)
  }, [advance])

  return null
}

export default function Scene({ Benchmark }) {
  const isMobile = useIsMobile()
  useObserverLocation()

  return (
    <Canvas
      frameloop='never'
      dpr={benchmark?.dpr ?? [1, isMobile ? 1.75 : 2]}
      shadows={{ enabled: benchmark?.shadows !== 'off', type: THREE.PCFShadowMap }}
      camera={{ position: [0, 28, 185], fov: 55, near: 0.5, far: 9000 }}
      gl={{
        antialias: !isMobile,
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 1,
      }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach='background' args={['#05070c']} />
      <Atmosphere shadowMapSize={isMobile ? 2048 : 4096} />
      <Sky />

      <Terrain />
      <Lake quality={isMobile ? 'low' : 'high'} />
      <LakeMist />
      <Suspense fallback={null}>
        <Forest
          pines={isMobile ? 220 : 650}
          snowPines={isMobile ? 50 : 140}
          aspens={isMobile ? 50 : 130}
          willows={isMobile ? 12 : 30}
          bushes={isMobile ? 24 : 60}
          berries={isMobile ? 12 : 30}
          rocks={isMobile ? 80 : 200}
          mossRocks={isMobile ? 36 : 90}
        />
        <GroundCover
          grass={isMobile ? 700 : 2000}
          shortGrass={isMobile ? 300 : 900}
          flowers={isMobile ? 100 : 260}
        />
      </Suspense>

      <Bear />
      <CampProps />
      <Greeting />
      <CameraRig />
      {Benchmark ? <Benchmark /> : <CappedFrameloop />}
    </Canvas>
  )
}
