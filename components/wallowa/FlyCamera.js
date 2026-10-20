'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { groundHeight } from './Terrain'
import { debugViewpoint } from './CameraRig'

const MOVE_SPEED = 14
const SPRINT_MULT = 8
const MOUSE_LOOK_SENSITIVITY = 0.0025
const KEY_LOOK_SPEED = 1.6
const GROUND_CLEARANCE = 1.5
const PITCH_LIMIT = Math.PI / 2 - 0.02

export function flyEnabled() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('fly')
}

function clampPitch(pitch) {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch))
}

export default function FlyCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const keys = useRef({})
  const yawPitch = useRef(null)
  const dragging = useRef(false)
  const init = useRef(false)
  const view = typeof window === 'undefined' ? null : debugViewpoint()

  useEffect(() => {
    const down = (e) => {
      keys.current[e.code] = true
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
    }
    const up = (e) => {
      keys.current[e.code] = false
    }
    const clear = () => {
      keys.current = {}
      dragging.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    const el = gl.domElement
    const pointerDown = (e) => {
      if (e.button !== 0) return
      dragging.current = true
      el.setPointerCapture(e.pointerId)
    }
    const pointerMove = (e) => {
      if (!dragging.current) return
      yawPitch.current.yaw -= e.movementX * MOUSE_LOOK_SENSITIVITY
      yawPitch.current.pitch = clampPitch(yawPitch.current.pitch - e.movementY * MOUSE_LOOK_SENSITIVITY)
    }
    const pointerUp = () => {
      dragging.current = false
    }
    el.addEventListener('pointerdown', pointerDown)
    el.addEventListener('pointermove', pointerMove)
    el.addEventListener('pointerup', pointerUp)
    el.addEventListener('pointercancel', pointerUp)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      el.removeEventListener('pointerdown', pointerDown)
      el.removeEventListener('pointermove', pointerMove)
      el.removeEventListener('pointerup', pointerUp)
      el.removeEventListener('pointercancel', pointerUp)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (!init.current) {
      init.current = true
      if (view) {
        camera.position.copy(view.pos)
        const dir = new THREE.Vector3().subVectors(view.target, view.pos)
        const yaw = Math.atan2(-dir.x, -dir.z)
        const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z))
        yawPitch.current = { yaw, pitch: clampPitch(pitch) }
      } else {
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
        yawPitch.current = { yaw: e.y, pitch: e.x }
      }
    }

    const yp = yawPitch.current
    const k = keys.current
    if (k.ArrowLeft) yp.yaw -= KEY_LOOK_SPEED * delta
    if (k.ArrowRight) yp.yaw += KEY_LOOK_SPEED * delta
    if (k.ArrowUp) yp.pitch = clampPitch(yp.pitch - KEY_LOOK_SPEED * delta)
    if (k.ArrowDown) yp.pitch = clampPitch(yp.pitch + KEY_LOOK_SPEED * delta)

    const sprint = k.ShiftLeft || k.ShiftRight ? SPRINT_MULT : 1
    const speed = MOVE_SPEED * sprint * delta
    const forward = new THREE.Vector3(-Math.sin(yp.yaw), 0, -Math.cos(yp.yaw))
    const right = new THREE.Vector3(Math.cos(yp.yaw), 0, -Math.sin(yp.yaw))
    const move = new THREE.Vector3()
    if (k.KeyW) move.add(forward)
    if (k.KeyS) move.sub(forward)
    if (k.KeyD) move.add(right)
    if (k.KeyA) move.sub(right)
    if (k.KeyE || k.Space) move.y += 1
    if (k.KeyQ || k.ControlLeft || k.ControlRight) move.y -= 1
    if (move.lengthSq() > 0) camera.position.addScaledVector(move.normalize(), speed)

    const ground = groundHeight(camera.position.x, camera.position.z) + GROUND_CLEARANCE
    camera.position.setY(Math.max(camera.position.y, ground))
    camera.quaternion.setFromEuler(new THREE.Euler(yp.pitch, yp.yaw, 0, 'YXZ'))
  })

  return null
}
