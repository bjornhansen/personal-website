'use client'

import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../store'
import { ATMOSPHERE } from '../atmosphere'
import { readSkyParams } from '../location'
import { benchmark, benchmarkState, markBenchmark } from './config'
import { createGpuTimer, summarize, summarizeFrames } from './metrics'
import { createFrameCap } from '../frameCap'

function environment(renderer) {
  const context = renderer.getContext()
  const debug = context.getExtension('WEBGL_debug_renderer_info')
  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2())
  return {
    userAgent: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    drawingBuffer: { width: buffer.x, height: buffer.y },
    nativeDpr: window.devicePixelRatio,
    renderDpr: renderer.getPixelRatio(),
    screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory ?? null,
    webgl: context.getParameter(context.VERSION),
    gpu: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    contextAttributes: context.getContextAttributes(),
    build: process.env.NEXT_PUBLIC_WALLOWA_BUILD ?? 'unknown',
    mode: process.env.NODE_ENV,
    skyParameters: readSkyParams(),
  }
}

function download(result) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `wallowa-${result.id}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sceneInventory(scene) {
  const instances = []
  let hash = 2166136261
  const addArray = (array) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619)
  }
  scene.traverse((object) => {
    if (object.userData.benchmarkPopulation === undefined) return
    addArray(object.instanceMatrix.array)
    instances.push({
      vertices: object.geometry.attributes.position.count,
      triangles: (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3,
      population: object.userData.benchmarkPopulation,
      submittedInstances: object.count,
    })
  })
  return { placementHash: (hash >>> 0).toString(16), instances }
}

function startBenchmark(get, notify) {
  const state = get()
  const renderer = state.gl
  const canvas = renderer.domElement
  const measured = benchmark.metrics === 'on'
  const gpu = createGpuTimer(renderer.getContext(), measured && benchmark.gpu === 'on')
  const id = `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID().slice(0, 8)}`
  const env = environment(renderer)
  const frames = []
  const startupFrames = []
  const rafIntervals = []
  const longTasks = []
  const invalidReasons = new Set(benchmark.errors)
  if (/swiftshader|llvmpipe|software/i.test(env.gpu ?? '')) invalidReasons.add('software-renderer-not-reference-hardware')
  const metadata = {
    device: null, osVersion: null, browserVersion: null, displayRefreshHz: null,
    powerMode: null, pluggedIn: null, brightness: null, cache: null, network: null,
    thermalStart: null, powerTool: null, notes: null,
  }
  let firstRaf = null
  let previousRaf = null
  let previousRendered = null
  const cap = createFrameCap(benchmark.fps)
  let sampleStart = null
  let firstFrame = null
  let lastShadow = 0
  let current = null
  let depth = 0
  let renderStarted = 0
  let cpuStarted = 0
  let raf = 0
  let stopped = false
  let finishedAt = null
  let navigationStep = -1
  let result = null
  let observer = null
  const originalRender = renderer.render
  const originalShadowRender = renderer.shadowMap.render
  const originalAutoReset = renderer.info.autoReset
  const originalShaderError = renderer.debug.onShaderError
  const originalFrameloop = state.frameloop
  const originalStore = useSceneStore.getState()

  benchmarkState.phase = 'warming'
  benchmarkState.sampleStarted = false
  benchmarkState.animationTime = 0
  useSceneStore.setState({ activeSection: null, bearArrived: false, splash: null })
  state.setFrameloop('never')
  renderer.info.autoReset = !measured
  renderer.debug.onShaderError = (...args) => {
    invalidReasons.add('shader-compilation-error')
    originalShaderError?.(...args)
  }

  if (measured) {
    renderer.render = function (...args) {
      const outer = depth === 0
      if (outer) {
        renderStarted = performance.now()
        if (current) current.cpuUpdateMs = renderStarted - cpuStarted
      } else if (current) current.reflectionPasses++
      depth++
      try {
        return originalRender.apply(this, args)
      } finally {
        depth--
        if (outer && current) current.cpuSubmitMs = performance.now() - renderStarted
      }
    }
  }
  renderer.shadowMap.render = function (...args) {
    const requested = this.enabled && (this.autoUpdate || this.needsUpdate)
    const value = originalShadowRender.apply(this, args)
    if (requested && !this.needsUpdate) {
      lastShadow = performance.now()
      if (current) current.shadowUpdates++
    }
    return value
  }

  const unsubscribe = useSceneStore.subscribe((next, prev) => {
    if (next.activeSection === prev.activeSection) return
    benchmarkState.inputPending = { requestedAt: performance.now(), section: next.activeSection, applied: false }
    markBenchmark('first-input-requested', { section: next.activeSection })
  })

  if (measured && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, duration: entry.duration })
    })
    observer.observe({ type: 'longtask', buffered: true })
  }

  const invalidate = (reason) => invalidReasons.add(reason)
  const visibility = () => { if (document.hidden && !stopped) finish('tab-hidden') }
  const resize = () => { if (!stopped) finish('viewport-or-dpr-changed') }
  const lost = () => { if (!stopped) finish('webgl-context-lost') }
  const input = (event) => { if (event.isTrusted && !stopped) invalidate('manual-input-during-run') }
  const error = () => { if (!stopped) invalidate('runtime-error') }
  const sound = () => { if (!stopped) invalidate('sound-changed-during-run') }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('resize', resize)
  window.addEventListener('error', error)
  window.addEventListener('unhandledrejection', error)
  window.addEventListener('wallowa-sound-change', sound)
  canvas.addEventListener('webglcontextlost', lost)
  document.addEventListener('pointerdown', input)
  document.addEventListener('keydown', input)
  visibility()

  function ready() {
    return benchmarkState.marks['forest-ready'] && benchmarkState.marks['ground-cover-ready'] &&
      benchmarkState.marks['bear-ready'] && useSceneStore.getState().bearArrived
  }

  function finish(reason) {
    if (stopped) return
    if (reason) invalidate(reason)
    if (!ready()) invalidate('incomplete-load-or-bear-arrival')
    stopped = true
    finishedAt = performance.now()
    benchmarkState.phase = 'draining'
    notify('Finishing GPU queries…')
  }

  function exportResult() {
    const budget = benchmark.fps || benchmark.budgetFps
    const minuteGroups = new Map()
    for (const frame of frames) {
      const minute = Math.floor(frame.sampleMs / 60000)
      if (!minuteGroups.has(minute)) minuteGroups.set(minute, [])
      minuteGroups.get(minute).push(frame)
    }
    return {
      schemaVersion: 1, id, url: window.location.href, config: benchmark, environment: env,
      metadata: { ...metadata }, valid: invalidReasons.size === 0 && benchmarkState.phase === 'complete',
      invalidReasons: [...invalidReasons, ...(benchmarkState.phase === 'complete' ? [] : ['sample-incomplete'])],
      status: benchmarkState.phase,
      startedAt: performance.timeOrigin + (firstFrame ?? 0),
      sampleStart, finishedAt,
      marks: { ...benchmarkState.marks }, generation: [...benchmarkState.generation],
      events: [...benchmarkState.events],
      atmosphere: { sunAltitude: useSceneStore.getState().sunAltitude, mist: ATMOSPHERE.uMist.value },
      reflection: benchmarkState.reflectionSize,
      frameCap: { targetFps: benchmark.fps, divisor: cap.divisor, refreshIntervalMs: cap.refreshInterval },
      sceneInventory: sceneInventory(get().scene),
      gpuTiming: { ...gpu.stats, pending: gpu.pending },
      rafIntervalMs: summarize(rafIntervals),
      summary: measured ? summarizeFrames(frames, budget) : null,
      startupSummary: measured ? summarizeFrames(startupFrames, budget) : null,
      minutes: [...minuteGroups].map(([minute, samples]) => ({ minute, ...summarizeFrames(samples, budget) })),
      rendererMemory: { ...renderer.info.memory, programs: renderer.info.programs?.length },
      longTasks,
      resources: performance.getEntriesByType('resource').map((entry) => ({
        name: entry.name, initiatorType: entry.initiatorType, start: entry.startTime,
        duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize,
      })),
      navigation: performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
      frames, startupFrames,
    }
  }

  const api = {
    status: () => ({ phase: benchmarkState.phase, frames: frames.length, invalidReasons: [...invalidReasons] }),
    result: () => result ? { ...result, metadata: { ...metadata } } : exportResult(),
    setMetadata: (values) => Object.assign(metadata, values),
    download: () => download(api.result()),
    stop: () => finish('manually-stopped'),
    capture: (block = 16) => {
      if (benchmarkState.phase !== 'complete') return null
      const s = get()
      s.advance(s.clock.elapsedTime, false)
      const context = renderer.getContext()
      const width = context.drawingBufferWidth
      const height = context.drawingBufferHeight
      const pixels = new Uint8Array(width * height * 4)
      context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
      const cols = Math.floor(width / block)
      const rows = Math.floor(height / block)
      const blocks = []
      for (let by = 0; by < rows; by++) {
        for (let bx = 0; bx < cols; bx++) {
          let r = 0, g = 0, b = 0, l = 0, l2 = 0
          for (let y = by * block; y < (by + 1) * block; y++) {
            for (let x = bx * block; x < (bx + 1) * block; x++) {
              const i = (y * width + x) * 4
              const lum = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
              r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; l += lum; l2 += lum * lum
            }
          }
          const n = block * block
          blocks.push([r / n, g / n, b / n, Math.sqrt(Math.max(0, l2 / n - (l / n) ** 2))])
        }
      }
      return { width, height, block, cols, rows, blocks }
    },
  }
  window.wallowaBenchmark = api

  function tick(now) {
    raf = requestAnimationFrame(tick)
    gpu.poll()
    if (stopped) {
      if (!gpu.pending || performance.now() - finishedAt > 2000) {
        gpu.dispose()
        benchmarkState.phase = 'complete'
        result = exportResult()
        notify(result.valid ? 'Complete' : `Invalid: ${result.invalidReasons.join(', ')}`)
        window.dispatchEvent(new CustomEvent('wallowa-benchmark-complete', { detail: api.result() }))
        cancelAnimationFrame(raf)
      }
      return
    }
    if (firstRaf === null) firstRaf = now
    if (previousRaf !== null && measured && rafIntervals.length < 10000) rafIntervals.push(now - previousRaf)
    previousRaf = now
    if (benchmark.errors.length) {
      finish('invalid-configuration')
      return
    }
    if (window.devicePixelRatio !== env.nativeDpr) invalidate('viewport-or-dpr-changed')
    if (!cap.tick(now)) return
    if (firstFrame === null) firstFrame = now
    const elapsed = (now - firstRaf) / 1000
    const warmed = now - firstFrame >= benchmark.warmup * 1000 && ready() && now - lastShadow >= 2000
    if (sampleStart === null && (benchmark.scenario === 'startup' || warmed)) {
      sampleStart = now
      benchmarkState.phase = 'sampling'
      benchmarkState.sampleStarted = true
      get().clock.elapsedTime = 0
      markBenchmark('sample-start')
      notify('Sampling…')
    }
    if (sampleStart === null && now - firstFrame > 180000) {
      finish('readiness-timeout')
      return
    }
    const sampleMs = sampleStart === null ? null : now - sampleStart
    benchmarkState.animationTime = (sampleMs ?? (now - firstRaf)) / 1000
    if (sampleMs !== null && sampleMs >= benchmark.duration * 1000) {
      finish()
      return
    }
    if (benchmark.scenario === 'navigation' && sampleMs !== null) {
      const step = Math.floor(sampleMs / 10000)
      if (step !== navigationStep) {
        navigationStep = step
        const sequence = [null, 'building', 'background', 'contact', null]
        useSceneStore.getState().openSection(sequence[step % sequence.length])
      }
    }
    if (benchmark.scenario === 'startup' && sampleMs >= 500 && navigationStep < 0) {
      navigationStep = 0
      document.querySelector('button[data-wallowa-section="building"]')?.click()
    }
    current = {
      time: now, sampleMs, intervalMs: previousRendered === null ? null : now - previousRendered,
      cpuUpdateMs: null, cpuSubmitMs: null, cpuTotalMs: null, gpuMs: null,
      reflectionPasses: 0, shadowUpdates: 0,
    }
    if (sampleMs === 0) current.intervalMs = null
    previousRendered = now
    if (measured) renderer.info.reset()
    gpu.begin(current)
    cpuStarted = performance.now()
    try {
      get().advance(sampleMs === null ? elapsed : sampleMs / 1000, false)
    } catch (error) {
      invalidate(`render-error: ${error.message}`)
      finish('render-failed')
    } finally {
      current.cpuTotalMs = performance.now() - cpuStarted
      gpu.end()
    }
    markBenchmark('core-first-frame-submitted')
    if (benchmarkState.inputPending?.applied) {
      const pending = benchmarkState.inputPending
      markBenchmark('first-input-frame-submitted', {
        section: pending.section, requestedAt: pending.requestedAt,
        latencyMs: performance.now() - pending.requestedAt,
        synthetic: benchmark.scenario === 'startup' || benchmark.scenario === 'navigation',
      })
      benchmarkState.inputPending = null
    }
    if (useSceneStore.getState().bearArrived) markBenchmark('bear-arrived')
    if (measured) {
      Object.assign(current, {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        lines: renderer.info.render.lines, points: renderer.info.render.points,
      })
      if (sampleMs === null) startupFrames.push(current)
      else frames.push(current)
    }
    current = null
  }

  notify('Warming up…')
  raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    gpu.dispose()
    observer?.disconnect()
    unsubscribe()
    renderer.render = originalRender
    renderer.shadowMap.render = originalShadowRender
    renderer.info.autoReset = originalAutoReset
    renderer.debug.onShaderError = originalShaderError
    state.setFrameloop(originalFrameloop)
    useSceneStore.setState({ activeSection: originalStore.activeSection, bearArrived: originalStore.bearArrived, splash: originalStore.splash })
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('resize', resize)
    window.removeEventListener('error', error)
    window.removeEventListener('unhandledrejection', error)
    window.removeEventListener('wallowa-sound-change', sound)
    canvas.removeEventListener('webglcontextlost', lost)
    document.removeEventListener('pointerdown', input)
    document.removeEventListener('keydown', input)
    if (window.wallowaBenchmark === api) delete window.wallowaBenchmark
  }
}

export default function Benchmark() {
  const get = useThree((s) => s.get)
  useEffect(() => startBenchmark(get, (message) => {
    window.dispatchEvent(new CustomEvent('wallowa-benchmark-status', { detail: message }))
  }), [get])
  return null
}

export function BenchmarkPanel() {
  const [status, setStatus] = useState('Preparing…')
  useEffect(() => {
    const update = (event) => setStatus(event.detail)
    window.addEventListener('wallowa-benchmark-status', update)
    return () => window.removeEventListener('wallowa-benchmark-status', update)
  }, [])

  if (benchmark.panel === 'off') return null
  return (
    <aside className='fixed bottom-16 right-4 z-50 max-w-sm rounded-lg bg-black/85 p-4 font-mono text-xs text-white' aria-label='Wallowa benchmark'>
      <p>Benchmark · {benchmark.label} · {benchmark.scenario}</p>
      <p className='my-2'>{status}</p>
      <p>{benchmark.warmup}s warm-up + {benchmark.duration}s sample</p>
      <div className='mt-3 flex gap-4'>
        <button type='button' className='underline' onClick={() => window.wallowaBenchmark?.download()}>Export JSON</button>
        <button type='button' className='underline' onClick={() => window.wallowaBenchmark?.stop()}>Stop</button>
      </div>
      <p className='mt-2 opacity-70'>Fresh navigation for each run. Timing ends with a frozen view.</p>
    </aside>
  )
}
