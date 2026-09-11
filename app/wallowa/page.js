'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SECTIONS, useSceneStore } from '@/components/wallowa/store'
import AmbientAudio from '@/components/wallowa/AmbientAudio'

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

function SectionCard() {
  const activeSection = useSceneStore((s) => s.activeSection)
  const closeSection = useSceneStore((s) => s.closeSection)
  if (!activeSection) return null
  const data = SECTIONS[activeSection]

  return (
    <aside
      className={`pointer-events-auto absolute bottom-4 left-4 right-4 top-auto max-w-md border border-white/10 bg-[#141410]/95 p-7 shadow-xl backdrop-blur transition-all duration-500 sm:bottom-6 sm:left-auto sm:right-6 ${
        activeSection
          ? 'translate-y-0 opacity-100'
          : 'translate-y-6 opacity-0'
      }`}
    >
      <button
        onClick={closeSection}
        className='absolute right-4 top-4 font-mono text-xs text-stone-400 transition-colors hover:text-stone-200'
        aria-label='Close'
      >
        ✕
      </button>
      <p className='font-mono text-[11px] tracking-[0.16em] text-[#3ED074] uppercase'>
        {data.number} — {data.label}
      </p>
      <h2 className='mt-3 font-serif text-3xl tracking-[-0.02em] text-[#FBFAF6]'>
        {data.title}
      </h2>
      {(data.role || data.period) && (
        <p className='mt-1 font-mono text-xs text-stone-400'>
          {data.role}
          {data.role && data.period ? ' · ' : ''}
          {data.period}
        </p>
      )}
      <p className='mt-4 font-serif text-[17px] leading-[1.55] text-[#C9C8C0]'>
        {data.description}
      </p>
      <a
        href={data.linkUrl}
        target={activeSection === 'contact' ? undefined : '_blank'}
        rel='noreferrer'
        className='mt-6 inline-block border-b border-[#3ED074] pb-px font-mono text-xs text-[#3ED074] transition-opacity hover:opacity-80'
      >
        {data.linkLabel}
      </a>
    </aside>
  )
}

function NavHints() {
  const openSection = useSceneStore((s) => s.openSection)
  const activeSection = useSceneStore((s) => s.activeSection)
  return (
    <nav className='pointer-events-auto flex gap-3'>
      {Object.entries(SECTIONS).map(([id, data]) => (
        <button
          key={id}
          onClick={() => openSection(id)}
          className={`font-mono text-[11px] transition-colors ${
            activeSection === id
              ? 'text-[#3ED074]'
              : 'text-stone-300/60 hover:text-stone-200'
          }`}
        >
          {data.number} {data.label}
        </button>
      ))}
    </nav>
  )
}

export default function WallowaPage() {
  return (
    <main className='fixed inset-0 overflow-hidden'>
      <Scene />
      <div className='pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between p-5'>
        <Link
          href='/'
          className='pointer-events-auto font-mono text-xs text-stone-300/80 mix-blend-difference'
        >
          ← back
        </Link>
        <div className='flex items-center gap-5'>
          <TimeOfDay />
          <AmbientAudio />
        </div>
      </div>
      <div className='pointer-events-none absolute left-5 top-12'>
        <NavHints />
      </div>
      <SectionCard />
      <p className='pointer-events-none absolute bottom-5 left-0 right-0 text-center font-mono text-xs text-stone-300/60 mix-blend-difference'>
        Wallowa Camp — prototype · drag to look around, scroll to zoom, tap the
        lights
      </p>
    </main>
  )
}
