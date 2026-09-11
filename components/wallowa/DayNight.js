'use client'

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useSceneStore } from './store'

export const SUNRISE = 6
export const SUNSET = 20

export function useDayNight() {
  const setTimeOfDay = useSceneStore((s) => s.setTimeOfDay)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const hour = now.getHours() + now.getMinutes() / 60
  const fraction = (hour - SUNRISE) / (SUNSET - SUNRISE)
  const isNight = fraction < 0 || fraction > 1

  useEffect(() => {
    setTimeOfDay(hour)
  }, [hour, setTimeOfDay])

  return useMemo(() => {
    const elevation = isNight
      ? -0.35
      : Math.sin(Math.PI * THREE.MathUtils.clamp(fraction, 0, 1))
    const azimuth = THREE.MathUtils.clamp(fraction, 0, 1) * Math.PI - Math.PI / 2
    const daySun = new THREE.Vector3(
      Math.sin(azimuth) * 80,
      Math.max(elevation, 0.02) * 90,
      -Math.cos(azimuth) * 60 - 30
    )
    const moonPosition = new THREE.Vector3(-90, 120, -140)
    const sunPosition = isNight ? moonPosition : daySun

    const nightFactor = isNight
      ? 1
      : 1 - THREE.MathUtils.smoothstep(elevation, 0, 0.35)

    const sunColor = isNight ? '#93a7c9' : elevation < 0.25 ? '#ffb77e' : '#fff3e0'

    const ambientIntensity = THREE.MathUtils.lerp(1.1, 0.35, nightFactor)
    const sunIntensity = THREE.MathUtils.lerp(3.5, 1.1, nightFactor)
    const fogColor = isNight ? '#0a1220' : elevation < 0.25 ? '#e5b98c' : '#c3d6e2'

    return {
      sunPosition,
      sunColor,
      nightFactor,
      ambientIntensity,
      sunIntensity,
      fogColor,
      isNight,
      hour,
    }
  }, [fraction, isNight, hour])
}
