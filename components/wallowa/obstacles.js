const CELL = 8
const sources = new Map()
let cells = new Map()

const key = (i, j) => `${i},${j}`

function rebuild() {
  cells = new Map()
  for (const list of sources.values()) {
    for (const o of list) {
      const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL))
      if (!cells.has(k)) cells.set(k, [])
      cells.get(k).push(o)
    }
  }
}

export function registerObstacles(source, list) {
  sources.set(source, list)
  rebuild()
}

export function hasObstacles(source) {
  return sources.has(source)
}

export function obstacleClearance(x, z) {
  const i = Math.floor(x / CELL)
  const j = Math.floor(z / CELL)
  let best = Infinity
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const bucket = cells.get(key(i + di, j + dj))
      if (!bucket) continue
      for (const o of bucket) {
        const d = Math.hypot(x - o.x, z - o.z) - o.radius
        if (d < best) best = d
      }
    }
  }
  return best
}

export function pathClear(ax, az, bx, bz, margin, step = 0.75) {
  const len = Math.hypot(bx - ax, bz - az)
  const steps = Math.max(1, Math.ceil(len / step))
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    if (obstacleClearance(ax + (bx - ax) * t, az + (bz - az) * t) < margin) return false
  }
  return true
}
