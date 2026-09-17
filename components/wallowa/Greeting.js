'use client'

import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import { useSceneStore } from './store'
import { terrainHeight } from './Terrain'
import { BEAR } from './Bear'

function line(hour, name = 'traveler') {
  if (hour >= 20 || hour < 5)
    return `Evening, ${name}. Fire's warm. Mind the dark.`
  if (hour < 12) return `Morning, ${name}. Coffee's on the fire.`
  if (hour < 17) return `Afternoon, ${name}. The lake's quiet today.`
  return `Evening, ${name}. Sun's going down behind the horns.`
}

export default function Greeting() {
  const timeOfDay = useSceneStore((s) => s.timeOfDay)
  const bearArrived = useSceneStore((s) => s.bearArrived)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setExpired(true), 12000)
    return () => clearTimeout(id)
  }, [])

  const visible = bearArrived && !expired && timeOfDay !== null
  const y = terrainHeight(BEAR.x, BEAR.z)

  return (
    <Html
      position={[BEAR.x, y + 3.2, BEAR.z]}
      center
      style={{ pointerEvents: 'none' }}
      zIndexRange={[10, 0]}
    >
      <div
        className={`transition-opacity duration-1000 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className='rounded-2xl border border-white/10 bg-[#141410]/90 px-4 py-3 font-serif text-[15px] leading-snug text-[#FBFAF6] shadow-lg'>
          {timeOfDay !== null && line(timeOfDay)}
        </div>
        <div className='mx-auto h-3 w-3 -rotate-45 border-b border-r border-white/10 bg-[#141410]/90' />
      </div>
    </Html>
  )
}
