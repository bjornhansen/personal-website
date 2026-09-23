'use client'

import { useEffect } from 'react'
import { useSceneStore } from './store'

const SOUTHERN_ZONES = [
  ['Australia/', -32],
  ['Pacific/Auckland', -40],
  ['Pacific/Chatham', -44],
  ['America/Argentina', -34],
  ['America/Santiago', -33],
  ['America/Sao_Paulo', -23],
  ['America/Montevideo', -35],
  ['America/Asuncion', -25],
  ['America/Lima', -12],
  ['America/La_Paz', -16],
  ['Africa/Johannesburg', -26],
  ['Africa/Maputo', -26],
  ['Africa/Windhoek', -22],
  ['Indian/Mauritius', -20],
  ['Antarctica/', -75],
]

export function locationFromTimezone(date = new Date()) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset()
  const standardOffset = Math.max(jan, jul)
  const lng = Math.max(-180, Math.min(180, (-standardOffset / 60) * 15))
  let zone = ''
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    zone = ''
  }
  const southern = SOUTHERN_ZONES.find(([prefix]) => zone.startsWith(prefix))
  return { lat: southern ? southern[1] : 40, lng, source: 'timezone' }
}

export function readSkyParams() {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  const num = (k) => {
    const v = q.get(k)
    if (v === null || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return {
    hour: num('t'),
    date: q.get('date') || undefined,
    speed: num('speed'),
    lat: num('lat'),
    lng: num('lng'),
    clouds: num('clouds'),
  }
}

export function startDate({ hour, date }) {
  const d = new Date()
  if (date) {
    const [y, m, day] = date.split('-').map(Number)
    if (y && m && day) d.setFullYear(y, m - 1, day)
  }
  if (hour !== undefined) {
    const h = Math.floor(hour)
    const min = Math.round((hour - h) * 60)
    d.setHours(h, min, 0, 0)
  }
  return d
}

export function useObserverLocation() {
  const setObserver = useSceneStore((s) => s.setObserver)

  useEffect(() => {
    const params = readSkyParams()
    if (params.lat !== undefined && params.lng !== undefined) {
      setObserver({ lat: params.lat, lng: params.lng, source: 'url' })
      return
    }
    setObserver(locationFromTimezone())

    let cancelled = false
    let precise = false

    fetch('/api/geo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (cancelled || precise || !geo) return
        setObserver({ lat: geo.lat, lng: geo.lng, source: 'ip' })
      })
      .catch(() => {})

    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return
            precise = true
            setObserver({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              source: 'device',
            })
          },
          () => {},
          { maximumAge: 3600000, timeout: 8000 }
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [setObserver])
}
