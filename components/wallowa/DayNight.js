'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from './store'
import { ATMOSPHERE, FOG_FAR, FOG_NEAR } from './atmosphere'
import { celestialBasis, celestialState } from './sun'
import { createPalette, samplePalette } from './palette'
import { locationFromTimezone, readSkyParams, startDate } from './location'
import { usePrefersReducedMotion } from './hooks'

const LIGHT_DISTANCE = 450
const SHADOW_EXTENT = 250
const MOON_COLOR = new THREE.Color('#a4b6dc')
const MIN_LIGHT_Y = 0.045
const MOON_ZENITH = new THREE.Color(0.004, 0.008, 0.02)
const MOON_HORIZON = new THREE.Color(0.008, 0.012, 0.024)

function dailyWeather(date) {
  const seed = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate()
  const r = (n) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return { cover: 0.12 + r(1) * 0.5, cirrus: r(2), misty: r(3) > 0.35, gusty: r(4) }
}

export default function Atmosphere({ shadowMapSize = 4096 }) {
  const get = useThree((s) => s.get)
  const observer = useSceneStore((s) => s.observer)
  const setSky = useSceneStore((s) => s.setSky)
  const reducedMotion = usePrefersReducedMotion()
  const params = useMemo(() => readSkyParams(), [])

  const sunLight = useRef()
  const hemi = useRef()
  const fog = useRef()
  const clock = useRef(null)
  const state = useRef({
    palette: createPalette(),
    lightDir: new THREE.Vector3(0, 1, 0),
    lastLightDir: new THREE.Vector3(),
    sinceUpdate: Infinity,
    sinceCount: 0,
    objectCount: 0,
    lastMinute: -1,
    fallback: null,
  })

  useEffect(() => {
    clock.current = { origin: startDate(params), started: performance.now() }
    state.current.fallback = locationFromTimezone()
  }, [params])

  useEffect(() => {
    const { shadowMap } = get().gl
    shadowMap.autoUpdate = false
    shadowMap.needsUpdate = true
    return () => {
      shadowMap.autoUpdate = true
    }
  }, [get])

  useFrame(({ gl, scene }, delta) => {
    const c = clock.current
    const s = state.current
    if (!c || !sunLight.current || !hemi.current) return

    if (!reducedMotion) ATMOSPHERE.uSkyTime.value += delta

    s.sinceCount += delta
    if (s.sinceCount > 1) {
      s.sinceCount = 0
      let count = 0
      scene.traverse(() => count++)
      if (count !== s.objectCount) {
        s.objectCount = count
        gl.shadowMap.needsUpdate = true
      }
    }
    if (!useSceneStore.getState().bearArrived) gl.shadowMap.needsUpdate = true

    const speed = params.speed ?? 1
    s.sinceUpdate += delta
    if (s.sinceUpdate < (speed > 1 ? 0 : 1)) return
    s.sinceUpdate = 0

    const now = new Date(c.origin.valueOf() + (performance.now() - c.started) * speed)
    const loc = observer ?? s.fallback
    const sky = celestialState(now, loc.lat, loc.lng)
    const pal = samplePalette(sky.sunAltitude, s.palette)
    const weather = dailyWeather(now)
    const A = ATMOSPHERE

    A.uSunDir.value.set(sky.sunDir.x, sky.sunDir.y, sky.sunDir.z)
    A.uMoonDir.value.set(sky.moonDir.x, sky.moonDir.y, sky.moonDir.z)
    A.uZenith.value.copy(pal.zenith)
    A.uHorizon.value.copy(pal.horizon)
    A.uGlow.value.copy(pal.glow)
    A.uGlowStrength.value = pal.glowStrength
    A.uEarthShadow.value.copy(pal.earthShadow)
    A.uBelt.value.copy(pal.belt)
    A.uTwilight.value = pal.twilight
    A.uHalo.value.copy(pal.halo).multiplyScalar(pal.haloStrength)
    A.uSunDisc.value
      .copy(pal.sunLight)
      .multiplyScalar(6 * THREE.MathUtils.smoothstep(sky.sunAltitude, -1.5, 0.5))
    A.uStars.value = pal.stars
    A.uCloudLit.value.copy(pal.cloudLit)
    A.uCloudShade.value.copy(pal.cloudShade)
    A.uCloudCover.value = params.clouds ?? weather.cover
    A.uCirrus.value = weather.cirrus
    A.uCelestial.value.set(...celestialBasis(sky.lst, sky.phi))

    const moonUp = THREE.MathUtils.smoothstep(sky.moonAltitude, -2, 8)
    const moonLight = sky.moonIllumination * moonUp
    A.uMoonLight.value = moonLight * (0.3 + 0.7 * pal.stars)
    const moonSky = moonLight * pal.stars
    A.uZenith.value.add(MOON_ZENITH.clone().multiplyScalar(moonSky))
    A.uHorizon.value.add(MOON_HORIZON.clone().multiplyScalar(moonSky))
    A.uStars.value = pal.stars * (1 - 0.4 * moonSky)

    const morning = sky.sunDir.x < 0
    const mistWindow =
      THREE.MathUtils.smoothstep(sky.sunAltitude, -10, -2) *
      (1 - THREE.MathUtils.smoothstep(sky.sunAltitude, 3, 16))
    A.uMist.value = mistWindow * (morning ? 1 : 0.25) * (weather.misty ? 0.32 : 0.12)

    const dayness = THREE.MathUtils.smoothstep(sky.sunAltitude, 2, 25)
    A.uBreeze.value = 0.08 + dayness * (0.2 + 0.6 * weather.gusty) * (morning ? 0.6 : 1)
    A.uWater.value.copy(pal.water)

    const sunI = pal.sunIntensity
    const moonI = moonLight * 1.1 * pal.stars
    const light = sunLight.current
    if (sunI >= moonI) {
      s.lightDir.copy(A.uSunDir.value)
      light.color.copy(pal.sunLight)
      light.intensity = sunI
    } else {
      s.lightDir.copy(A.uMoonDir.value)
      light.color.copy(MOON_COLOR)
      light.intensity = moonI
    }
    s.lightDir.y = Math.max(s.lightDir.y, MIN_LIGHT_Y)
    s.lightDir.normalize()
    light.position.copy(s.lightDir).multiplyScalar(LIGHT_DISTANCE)
    if (s.lightDir.angleTo(s.lastLightDir) > 0.002) {
      s.lastLightDir.copy(s.lightDir)
      gl.shadowMap.needsUpdate = true
    }

    hemi.current.color.copy(pal.hemiSky)
    hemi.current.groundColor.copy(pal.hemiGround)
    hemi.current.intensity = pal.hemiIntensity + moonLight * pal.stars * 0.6

    gl.toneMappingExposure = pal.exposure
    if (fog.current) fog.current.color.copy(pal.horizon)

    const hour = now.getHours() + now.getMinutes() / 60
    const minute = Math.floor(hour * 60)
    if (minute !== s.lastMinute) {
      s.lastMinute = minute
      setSky({ hour, sunAltitude: sky.sunAltitude })
    }
  })

  return (
    <>
      <fog ref={fog} attach='fog' args={['#8899aa', FOG_NEAR, FOG_FAR]} />
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sunLight}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={50}
        shadow-camera-far={LIGHT_DISTANCE * 2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.35}
      />
    </>
  )
}
