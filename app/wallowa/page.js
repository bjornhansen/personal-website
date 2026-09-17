'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSceneStore } from '@/components/wallowa/store'
import AmbientAudio from '@/components/wallowa/AmbientAudio'
import { CURSOR_DEFAULT } from '@/components/wallowa/cursor'

const Scene = dynamic(() => import('@/components/wallowa/Scene'), {
  ssr: false,
  loading: () => (
    <div className='fixed inset-0 flex items-center justify-center bg-[#0a1220] text-stone-300'>
      <p className='font-mono text-sm tracking-wide'>hiking to the lake…</p>
    </div>
  ),
})

function TimeOfDay() {
  const timeOfDay = useSceneStore((s) => s.timeOfDay)
  if (timeOfDay === null) return null
  const label = `~${Math.floor(timeOfDay)}:00`
  return (
    <span className='font-mono text-xs text-stone-300/80'>
      local time {label}
    </span>
  )
}

export default function WallowaPage() {
  return (
    <main
      className='fixed inset-0 overflow-hidden'
      style={{ cursor: CURSOR_DEFAULT }}
    >
      <Scene />
      <div className='pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-end p-5'>
        <div className='flex items-center gap-4 rounded-full border border-white/10 bg-[#141410]/70 px-4 py-1.5 backdrop-blur-sm'>
          <TimeOfDay />
          <AmbientAudio />
        </div>
      </div>
      <p className='pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#141410]/70 px-4 py-1.5 font-mono text-xs text-stone-300/80 backdrop-blur-sm'>
        Bear wanders in when he&apos;s ready — enjoy the valley
      </p>
    </main>
  )
}
