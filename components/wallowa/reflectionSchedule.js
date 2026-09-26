export const REFLECTION_MAX_AGE_MS = 1000
export const REFLECTION_MOVE = 0.1
export const REFLECTION_TURN = 0.0175

export function createReflectionSchedule({
  maxAgeMs = REFLECTION_MAX_AGE_MS,
  move = REFLECTION_MOVE,
  turn = REFLECTION_TURN,
} = {}) {
  let last = null
  const position = { x: 0, y: 0, z: 0 }
  const rotation = { x: 0, y: 0, z: 0, w: 1 }

  return {
    due(now, camera, force = false) {
      const p = camera.position
      const q = camera.quaternion
      if (!force && last !== null && now - last < maxAgeMs) {
        const dx = p.x - position.x
        const dy = p.y - position.y
        const dz = p.z - position.z
        const dot = Math.min(1, Math.abs(q.x * rotation.x + q.y * rotation.y + q.z * rotation.z + q.w * rotation.w))
        if (dx * dx + dy * dy + dz * dz <= move * move && 2 * Math.acos(dot) <= turn) return false
      }
      last = now
      position.x = p.x
      position.y = p.y
      position.z = p.z
      rotation.x = q.x
      rotation.y = q.y
      rotation.z = q.z
      rotation.w = q.w
      return true
    },
  }
}
