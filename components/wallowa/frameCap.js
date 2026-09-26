export const TARGET_FPS = 60

export function createFrameCap(targetFps = TARGET_FPS) {
  const samples = []
  let last = null
  let interval = null
  let divisor = 1
  let owed = 0

  return {
    get divisor() {
      return divisor
    },
    get refreshInterval() {
      return interval
    },
    tick(now) {
      if (last === null) {
        last = now
        return true
      }
      const dt = now - last
      last = now
      if (dt > 2 && dt < 100) {
        samples.push(dt)
        if (samples.length > 30) samples.shift()
        if (samples.length >= 6) {
          const sorted = [...samples].sort((a, b) => a - b)
          interval = sorted[sorted.length >> 1]
          divisor = targetFps > 0 ? Math.max(1, Math.round(1000 / targetFps / interval)) : 1
        }
      }
      owed += interval ? Math.max(1, Math.round(dt / interval)) : 1
      if (owed < divisor) return false
      owed = 0
      return true
    },
  }
}
