'use client'

import { useEffect, useRef, useState } from 'react'

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let b0 = 0,
    b1 = 0,
    b2 = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.997 * b0 + white * 0.029
    b1 = 0.985 * b1 + white * 0.043
    b2 = 0.95 * b2 + white * 0.075
    data[i] = (b0 + b1 + b2 + white * 0.05) * 0.6
  }
  return buf
}

export default function AmbientAudio() {
  const [enabled, setEnabled] = useState(false)
  const ctxRef = useRef(null)
  const nodesRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx

    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)

    const wind = ctx.createBufferSource()
    wind.buffer = noiseBuffer(ctx, 4)
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 420
    const windGain = ctx.createGain()
    windGain.gain.value = 0.05
    const swell = ctx.createOscillator()
    swell.frequency.value = 0.07
    const swellGain = ctx.createGain()
    swellGain.gain.value = 0.025
    swell.connect(swellGain)
    swellGain.connect(windGain.gain)
    wind.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(master)
    wind.start()
    swell.start()

    const fireBuf = ctx.createBuffer(
      1,
      ctx.sampleRate * 0.5,
      ctx.sampleRate
    )
    const fireData = fireBuf.getChannelData(0)
    for (let i = 0; i < fireData.length; i++) {
      if (Math.random() < 0.0012) {
        const amp = (0.15 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1)
        for (let j = 0; j < 4 && i + j < fireData.length; j++) {
          fireData[i + j] = amp * (1 - j / 4)
        }
        i += 3
      }
    }

    let stop = false
    const scheduleCrackle = () => {
      if (stop) return
      const src = ctx.createBufferSource()
      src.buffer = fireBuf
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 900 + Math.random() * 1400
      filter.Q.value = 0.8
      const gain = ctx.createGain()
      gain.gain.value = 0.12 + Math.random() * 0.1
      src.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      src.start()
      setTimeout(scheduleCrackle, 120 + Math.random() * 600)
    }
    scheduleCrackle()

    nodesRef.current = { wind, swell }
    return () => {
      stop = true
      try {
        wind.stop()
        swell.stop()
      } catch {
        /* already stopped */
      }
      ctx.close()
      ctxRef.current = null
      nodesRef.current = null
    }
  }, [enabled])

  return (
    <button
      onClick={() => setEnabled((v) => !v)}
      className='pointer-events-auto font-mono text-xs text-stone-300/80 transition-colors hover:text-stone-100'
      aria-pressed={enabled}
    >
      sound {enabled ? 'on' : 'off'}
    </button>
  )
}
