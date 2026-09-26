export function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const percentile = (p) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
  return {
    count: sorted.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    median: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

export function summarizeFrames(frames, budgetFps) {
  const intervals = frames.map((f) => f.intervalMs).filter(Number.isFinite)
  const budgetMs = 1000 / budgetFps
  const toleranceMs = Math.max(1, budgetMs * 0.1)
  const missed = intervals.filter((ms) => ms > budgetMs + toleranceMs).length
  return {
    frames: frames.length,
    renderedFps: intervals.length ? 1000 * intervals.length / intervals.reduce((a, b) => a + b, 0) : null,
    budgetMs,
    toleranceMs,
    missedIntervals: missed,
    missedRatio: intervals.length ? missed / intervals.length : null,
    intervalMs: summarize(intervals),
    cpuUpdateMs: summarize(frames.map((f) => f.cpuUpdateMs)),
    cpuSubmitMs: summarize(frames.map((f) => f.cpuSubmitMs)),
    cpuTotalMs: summarize(frames.map((f) => f.cpuTotalMs)),
    gpuMs: summarize(frames.map((f) => f.gpuMs)),
    calls: summarize(frames.map((f) => f.calls)),
    triangles: summarize(frames.map((f) => f.triangles)),
    reflectionPasses: frames.reduce((n, f) => n + f.reflectionPasses, 0),
    shadowUpdates: frames.reduce((n, f) => n + f.shadowUpdates, 0),
  }
}

export function createGpuTimer(gl, enabled = true) {
  const ext = enabled ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null
  const pending = []
  const stats = { status: ext ? 'available' : enabled ? 'unavailable' : 'disabled', discarded: 0, skipped: 0 }
  let active = null
  const discard = () => {
    for (const { query } of pending) gl.deleteQuery(query)
    stats.discarded += pending.length
    pending.length = 0
  }
  return {
    stats,
    begin(frame) {
      if (!ext) return
      if (pending.length >= 16 || gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        stats.skipped++
        return
      }
      const query = gl.createQuery()
      if (!query) return
      active = { query, frame }
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query)
    },
    end() {
      if (!active) return
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      pending.push(active)
      active = null
    },
    poll() {
      if (!ext) return
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        discard()
        return
      }
      while (pending.length && gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
        const { query, frame } = pending.shift()
        const ns = gl.getQueryParameter(query, gl.QUERY_RESULT)
        if (Number.isFinite(ns) && ns > 0) frame.gpuMs = ns / 1e6
        else stats.discarded++
        gl.deleteQuery(query)
      }
    },
    get pending() { return pending.length },
    dispose() {
      if (active) {
        gl.endQuery(ext.TIME_ELAPSED_EXT)
        gl.deleteQuery(active.query)
        active = null
      }
      discard()
    },
  }
}
