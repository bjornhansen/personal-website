import { TARGET_FPS } from '../frameCap.js'

export function parseBenchmark(search) {
  const q = new URLSearchParams(search)
  if (q.get('bench') !== '1') return null
  const errors = []
  const number = (key, fallback, min, max) => {
    if (!q.has(key)) return fallback
    const value = Number(q.get(key))
    if (q.get(key) === '' || !Number.isFinite(value) || value < min || value > max) {
      errors.push(`${key} must be between ${min} and ${max}`)
      return fallback
    }
    return value
  }
  const choice = (key, fallback, values) => {
    const value = q.get(key) ?? fallback
    if (values.includes(value)) return value
    errors.push(`${key} must be one of ${values.join(', ')}`)
    return fallback
  }
  const config = {
    scenario: choice('scenario', 'day', ['day', 'night', 'dawn', 'navigation', 'startup']),
    seed: Math.floor(number('seed', 1849, 0, 4294967295)),
    duration: number('duration', 60, 1, 900),
    warmup: number('warmup', 20, 0, 120),
    fps: number('fps', TARGET_FPS, 0, 240),
    budgetFps: number('budgetFps', 60, 1, 240),
    dpr: number('dpr', null, 0.5, 3),
    reflection: choice('reflection', 'live', ['live', 'every', 'frozen']),
    reflectionWidth: number('reflectionWidth', null, 16, 4096),
    reflectionHeight: number('reflectionHeight', null, 16, 4096),
    reflectionScale: number('reflectionScale', null, 0.1, 1),
    reflectionSamples: number('reflectionSamples', null, 0, 8),
    reflectionFps: number('reflectionFps', 0, 0, 240),
    terrain: choice('terrain', 'full', ['full', 'procedural', 'simple']),
    sky: choice('sky', 'full', ['full', 'simple']),
    forest: number('forest', 1, 0, 1),
    groundCover: number('groundCover', 1, 0, 1),
    shadows: choice('shadows', 'on', ['on', 'off']),
    mist: choice('mist', 'on', ['on', 'off']),
    camera: choice('camera', 'animated', ['animated', 'fixed']),
    metrics: choice('metrics', 'on', ['on', 'off']),
    gpu: choice('gpu', 'on', ['on', 'off']),
    panel: choice('panel', 'on', ['on', 'off']),
    label: (q.get('label') ?? 'baseline').slice(0, 120),
    errors,
  }
  if ((config.reflectionWidth === null) !== (config.reflectionHeight === null)) {
    errors.push('reflectionWidth and reflectionHeight must be supplied together')
  }
  return Object.freeze(config)
}

export function createRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const benchmark = typeof window === 'undefined' ? null : parseBenchmark(window.location.search)

export const benchmarkState = {
  phase: 'loading',
  animationTime: 0,
  sampleStarted: false,
  marks: {},
  generation: [],
  events: [],
  reflectionSize: null,
  inputPending: null,
}

export function markBenchmark(name, detail) {
  if (!benchmark || benchmarkState.marks[name]) return
  const time = performance.now()
  benchmarkState.marks[name] = { time, detail }
  performance.mark(`wallowa:${name}`, { detail })
}

export function measureGeneration(name, generate) {
  if (!benchmark) return generate()
  const start = performance.now()
  const result = generate()
  const end = performance.now()
  benchmarkState.generation.push({ name, start, duration: end - start })
  performance.measure(`wallowa:${name}`, { start, end })
  return result
}
