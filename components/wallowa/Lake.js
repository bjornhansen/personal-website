'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { ATMOSPHERE, ATMOSPHERE_GLSL, FOG_FAR, FOG_NEAR } from './atmosphere'
import { NOISE_GLSL } from './glsl'
import { terrainHeight } from './Terrain'
import { useSceneStore } from './store'
import { usePrefersReducedMotion } from './hooks'
import { benchmark, benchmarkState, createRandom, measureGeneration } from './benchmark/config'
import { createReflectionSchedule } from './reflectionSchedule'

const CENTER = { x: -10, z: 45 }
const WIDTH = 190
const LENGTH = 240
const DEPTH_RES = [96, 120]
const MAX_DEPTH = 12
const RIPPLES = 8
const DROPS = 14
const SPLASHES = 4

const vert = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const frag = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D uDepth;
  uniform float uTime;
  uniform float uBreeze;
  uniform vec3 uWater;
  uniform vec3 uSunDisc;
  uniform vec4 uRipples[${RIPPLES}];
  varying vec4 vUv;
  varying vec3 vWorldPos;

  ${NOISE_GLSL}
  ${ATMOSPHERE_GLSL}

  vec2 ringSlope(vec2 p) {
    vec2 slope = vec2(0.0);
    for (int i = 0; i < ${RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 7.0) continue;
      vec2 d = p - r.xy;
      float dist = length(d);
      float front = age * 1.3;
      float width = 0.5 + age * 0.35;
      float behind = front - dist;
      float env = smoothstep(-0.25, 0.1, behind) * exp(-max(behind, 0.0) / width);
      float k = 4.2 / (1.0 + age * 0.12);
      float amp = r.w * 0.12 / (1.0 + age * 1.2);
      slope += (d / max(dist, 1e-3)) * amp * k * cos(k * behind) * env;
    }
    return slope;
  }

  void main() {
    vec2 p = vWorldPos.xz;
    vec2 depthUv = vec2(
      (p.x - ${CENTER.x.toFixed(1)}) / ${WIDTH.toFixed(1)} + 0.5,
      (p.y - ${CENTER.z.toFixed(1)}) / ${LENGTH.toFixed(1)} + 0.5
    );
    float depth = texture2D(uDepth, depthUv).r * ${MAX_DEPTH.toFixed(1)};

    float paws = smoothstep(0.5, 0.78, fbm2(p * 0.022 + vec2(uTime * 0.011, uTime * 0.004), 3));
    float calm = mix(0.012, 0.075, paws) * (0.25 + uBreeze * 1.5);
    vec3 n1 = vnoised(p * 0.8 + vec2(uTime * 0.07, uTime * 0.03));
    vec3 n2 = vnoised(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.6 - vec2(uTime * 0.05, -uTime * 0.08));
    float near = clamp(35.0 / length(cameraPosition - vWorldPos), 0.0, 1.0);
    vec2 slope = (n1.yz * 0.8 * mix(0.35, 1.0, near) + n2.yz * 2.6 * 0.35 * near * near) * calm;
    slope += ringSlope(p);
    slope *= smoothstep(0.0, 0.6, depth);
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));

    vec3 viewVec = cameraPosition - vWorldPos;
    float dist = length(viewVec);
    vec3 view = viewVec / dist;
    float cosV = max(dot(normal, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
    fresnel = mix(fresnel, 1.0, 0.08);

    vec2 ruv = vUv.xy / vUv.w + normal.xz * 0.35 * min(1.0, 40.0 / dist + 0.25);
    vec3 reflection = texture2D(tDiffuse, ruv).rgb;

    vec3 halfDir = normalize(uSunDir + view);
    float glint = pow(max(dot(normal, halfDir), 0.0), 900.0) * (0.3 + paws);
    reflection += uSunDisc * glint * 0.6;

    float murk = 1.0 - exp(-depth * 0.55);
    vec3 shallow = uWater * vec3(1.9, 2.3, 2.0) + uHalo * 0.05;
    vec3 body = mix(shallow, uWater, smoothstep(0.0, 5.0, depth));
    float bodyAlpha = mix(0.15, 0.97, murk);

    float alpha = 1.0 - (1.0 - fresnel) * (1.0 - bodyAlpha);
    vec3 col = (reflection * fresnel + body * bodyAlpha * (1.0 - fresnel)) / max(alpha, 1e-3);
    alpha *= smoothstep(0.0, 0.18, depth);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    float fogF = smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, dist);
    fogF = max(fogF, uMist * smoothstep(10.0, 90.0, dist));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, toDisplay(hazeColor(-view)), fogF);
  }
`

function bakeDepth() {
  const [w, h] = DEPTH_RES
  const data = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = CENTER.x + ((i + 0.5) / w - 0.5) * WIDTH
      const z = CENTER.z + ((j + 0.5) / h - 0.5) * LENGTH
      const depth = Math.max(0, -terrainHeight(x, z))
      data[j * w + i] = Math.min(255, Math.round((depth / MAX_DEPTH) * 255))
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return { tex, data, w, h }
}

function depthAt(depth, x, z) {
  const i = Math.floor(((x - CENTER.x) / WIDTH + 0.5) * depth.w)
  const j = Math.floor(((z - CENTER.z) / LENGTH + 0.5) * depth.h)
  if (i < 0 || j < 0 || i >= depth.w || j >= depth.h) return 0
  return (depth.data[j * depth.w + i] / 255) * MAX_DEPTH
}

function useReflector(depth, resolutionScale, multisample) {
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const width = Math.round(benchmark?.reflectionWidth ?? size.width * dpr * (benchmark?.reflectionScale ?? resolutionScale))
  const height = Math.round(benchmark?.reflectionHeight ?? size.height * dpr * (benchmark?.reflectionScale ?? resolutionScale))
  const samples = Math.floor(benchmark?.reflectionSamples ?? multisample)

  const reflector = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 1, 1)
    const r = new Reflector(geometry, {
      textureWidth: width,
      textureHeight: height,
      clipBias: 0.002,
      multisample: samples,
      shader: {
        name: 'LakeShader',
        uniforms: {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
        },
        vertexShader: vert,
        fragmentShader: frag,
      },
    })
    const u = r.material.uniforms
    Object.assign(u, ATMOSPHERE, {
      uDepth: { value: depth.tex },
      uTime: { value: 0 },
      uRipples: {
        value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)),
      },
    })
    r.material.transparent = true
    r.material.depthWrite = false
    r.rotation.x = -Math.PI / 2
    r.position.set(CENTER.x, 0, CENTER.z)
    r.renderOrder = 1
    return r
  }, [depth, width, height, samples])

  useEffect(() => {
    if (!benchmark) return
    benchmarkState.reflectionSize = { width, height, samples }
  }, [width, height, samples])

  useEffect(() => () => reflector.dispose(), [reflector])
  return reflector
}

function useReflectionSchedule(lakeRef, reflector) {
  useEffect(() => {
    const target = lakeRef.current
    if (!target) return
    const renderReflection = target.onBeforeRender
    const fixedRate = benchmark?.reflectionFps
    const schedule = createReflectionSchedule(fixedRate ? { maxAgeMs: 1000 / fixedRate - 0.5, move: Infinity, turn: Infinity } : undefined)
    let capturedReady = false
    target.onBeforeRender = function (renderer, scene, camera, ...rest) {
      if (benchmark?.reflection === 'frozen' && benchmarkState.sampleStarted && capturedReady) return
      const force = benchmark?.reflection === 'every' || !useSceneStore.getState().bearArrived
      if (!schedule.due(performance.now(), camera, force)) return
      renderReflection.call(this, renderer, scene, camera, ...rest)
      if (benchmark) {
        capturedReady = Boolean(benchmarkState.marks['forest-ready'] && benchmarkState.marks['ground-cover-ready'] && benchmarkState.marks['bear-arrived'])
      }
    }
    return () => { target.onBeforeRender = renderReflection }
  }, [lakeRef, reflector])
}

function Splashes({ splashes, time }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    if (!mesh.current) return
    let n = 0
    splashes.current.forEach((s) => {
      if (s.life <= 0) return
      if (!benchmark) s.life -= delta
      else s.life = 1.2 - (time.current - s.born)
      s.drops.forEach((d) => {
        if (benchmark) {
          const age = time.current - s.born
          d.x = d.startX + d.vx * age
          d.y = 0.02 + d.startVy * age - 4.9 * age * age
          d.z = d.startZ + d.vz * age
        } else {
          d.vy -= 9.8 * delta
          d.x += d.vx * delta
          d.y += d.vy * delta
          d.z += d.vz * delta
        }
        if (d.y < 0 || s.life <= 0) return
        dummy.position.set(d.x, d.y, d.z)
        dummy.scale.setScalar(d.size)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(n++, dummy.matrix)
      })
    })
    mesh.current.count = n
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, DROPS * SPLASHES]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color='#dfe8ec' transparent opacity={0.75} />
    </instancedMesh>
  )
}

function Fish({ fish }) {
  const ref = useRef()
  useFrame(() => {
    const f = fish.current
    const g = ref.current
    if (!g) return
    g.visible = f.active
    if (!f.active) return
    g.position.set(f.x, f.y, f.z)
    g.rotation.set(0, f.heading, 0)
    g.rotateX(-Math.atan2(f.vy, f.speed))
  })
  return (
    <group ref={ref} visible={false}>
      <mesh scale={[0.09, 0.12, 0.34]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color='#8c9a8a' metalness={0.3} roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0, -0.38]} rotation={[Math.PI / 2, 0, 0]} scale={[0.1, 0.12, 0.02]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color='#6d7a6a' flatShading />
      </mesh>
    </group>
  )
}

export default function Lake({ quality = 'high' }) {
  const reducedMotion = usePrefersReducedMotion()
  const emitSplash = useSceneStore((s) => s.emitSplash)
  const depth = useMemo(() => measureGeneration('lake-depth-generation', bakeDepth), [])
  const reflector = useReflector(depth, quality === 'high' ? 0.5 : 0.35, quality === 'high' ? 4 : 0)

  const lake = useRef()
  useReflectionSchedule(lake, reflector)
  const time = useRef(0)
  const nextRipple = useRef(0)
  const nextJump = useRef(-1)
  const splashes = useRef(Array.from({ length: SPLASHES }, () => ({ life: 0, drops: [] })))
  const nextSplash = useRef(0)
  const fish = useRef({ active: false, x: 0, y: 0, z: 0, vy: 0, speed: 0, heading: 0, landed: false })
  const random = useRef(null)
  const sampling = useRef(false)
  const simulationStep = useRef(0)

  useEffect(() => {
    random.current = benchmark ? createRandom(benchmark.seed ^ 0x51a5) : Math.random
  }, [])

  const addRipple = (x, z, strength, delay = 0) => {
    if (!lake.current) return
    const r = lake.current.material.uniforms.uRipples.value[nextRipple.current]
    r.set(x, z, time.current + delay, strength)
    nextRipple.current = (nextRipple.current + 1) % RIPPLES
  }

  const addSplash = (x, z, strength) => {
    const s = splashes.current[nextSplash.current]
    nextSplash.current = (nextSplash.current + 1) % SPLASHES
    s.life = 1.2
    s.born = time.current
    s.drops = Array.from({ length: DROPS }, () => {
      const rand = random.current ?? Math.random
      const a = rand() * Math.PI * 2
      const out = (0.4 + rand() * 0.9) * strength
      const vy = (1.8 + rand() * 2.2) * strength
      return {
        x,
        startX: x,
        startZ: z,
        startVy: vy,
        y: 0.02,
        z,
        vx: Math.cos(a) * out,
        vz: Math.sin(a) * out,
        vy,
        size: 0.03 + rand() * 0.04,
      }
    })
  }

  const disturb = (x, z, strength) => {
    addRipple(x, z, strength)
    addRipple(x, z, strength * 0.5, 0.35)
    addSplash(x, z, Math.min(1.4, 0.6 + strength * 0.4))
    emitSplash(strength)
  }

  const step = (delta) => {
    const rand = random.current ?? Math.random
    time.current += delta
    if (lake.current) lake.current.material.uniforms.uTime.value = reducedMotion ? 0 : time.current

    const f = fish.current
    if (f.active) {
      f.vy -= 9.8 * delta
      f.x += Math.sin(f.heading) * f.speed * delta
      f.z += Math.cos(f.heading) * f.speed * delta
      f.y += f.vy * delta
      if (f.y < 0) {
        f.active = false
        disturb(f.x, f.z, 0.8)
      }
    }

    if (nextJump.current < 0) nextJump.current = time.current + 5 + rand() * 8
    if (reducedMotion || time.current < nextJump.current) return
    nextJump.current = time.current + 14 + rand() * 30
    for (let tries = 0; tries < 20; tries++) {
      const x = CENTER.x + (rand() - 0.5) * WIDTH * 0.8
      const z = CENTER.z + (rand() - 0.5) * LENGTH * 0.8
      if (depthAt(depth, x, z) < 1.5) continue
      Object.assign(f, {
        active: true,
        x,
        y: 0,
        z,
        vy: 3.2 + rand() * 1.2,
        speed: 1.2 + rand() * 0.8,
        heading: rand() * Math.PI * 2,
      })
      if (benchmark) benchmarkState.events.push({ type: 'fish-jump', phase: benchmarkState.phase, time: time.current, x, z, vy: f.vy, speed: f.speed, heading: f.heading })
      addRipple(x, z, 0.6)
      addSplash(x, z, 0.5)
      break
    }
  }

  useFrame((_, delta) => {
    if (!benchmark) {
      step(delta)
      return
    }
    if (benchmarkState.sampleStarted && !sampling.current) {
      sampling.current = true
      simulationStep.current = 0
      time.current = 0
      nextJump.current = -1
      nextRipple.current = 0
      nextSplash.current = 0
      fish.current.active = false
      splashes.current.forEach((s) => { s.life = 0 })
      random.current = createRandom(benchmark.seed ^ 0x51a5)
      lake.current?.material.uniforms.uRipples.value.forEach((r) => r.set(0, 0, -100, 0))
    }
    const target = Math.floor(benchmarkState.animationTime * 60)
    while (simulationStep.current < target) {
      step(1 / 60)
      simulationStep.current++
    }
    if (lake.current) lake.current.material.uniforms.uTime.value = reducedMotion ? 0 : benchmarkState.animationTime
  })

  return (
    <>
      <primitive
        ref={lake}
        object={reflector}
        onClick={(e) => {
          e.stopPropagation()
          if (depthAt(depth, e.point.x, e.point.z) < 0.2) return
          disturb(e.point.x, e.point.z, 1.3)
        }}
      />
      <Splashes splashes={splashes} time={time} />
      <Fish fish={fish} />
    </>
  )
}
