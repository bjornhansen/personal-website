'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ATMOSPHERE, ATMOSPHERE_GLSL, FOG_FAR, FOG_NEAR } from './atmosphere'
import { NOISE_GLSL } from './glsl'
import { noise2D } from './noise'
import { CREEK_DEPTH, CREEK_HALF_WIDTH, getCreek } from './creekbed'
import { usePrefersReducedMotion } from './hooks'
import { benchmark, benchmarkState, measureGeneration } from './benchmark/config'

const MAX_DROP = 0.3
const BED_CLEARANCE = 0.12
const BANK_CLEARANCE = 0.35

const vert = /* glsl */ `
  attribute float aCenter;
  attribute float aSpeed;
  attribute float aFade;
  varying vec3 vWorldPos;
  varying float vFlow;
  varying float vCenter;
  varying float vSpeed;
  varying float vFade;
  void main() {
    vCenter = aCenter;
    vSpeed = aSpeed;
    vFade = aFade;
    vFlow = uv.y;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const frag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWater;
  uniform vec3 uSunDisc;
  varying vec3 vWorldPos;
  varying float vFlow;
  varying float vCenter;
  varying float vSpeed;
  varying float vFade;

  ${NOISE_GLSL}
  ${ATMOSPHERE_GLSL}

  void main() {
    float speed = 0.55 + vSpeed * 3.0;
    vec3 n1 = vnoised(vec2(vCenter * 1.7, vFlow * 0.5) - vec2(0.0, uTime * speed * 0.3));
    vec3 n2 = vnoised(vec2(vCenter * 3.4 + 5.0, vFlow * 1.35) - vec2(0.0, uTime * speed * 0.85));
    vec2 slope = n1.yz * 0.35 + n2.yz * 0.18;
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));

    vec3 viewVec = cameraPosition - vWorldPos;
    float dist = length(viewVec);
    vec3 view = viewVec / dist;
    float cosV = max(dot(normal, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
    fresnel = mix(fresnel, 1.0, 0.08);

    vec3 reflection = skyGradient(reflect(-view, normal));
    vec3 halfDir = normalize(uSunDir + view);
    float glint = pow(max(dot(normal, halfDir), 0.0), 1200.0);
    float night = smoothstep(0.1, -0.15, uSunDir.y);
    reflection = mix(reflection, reflection * 0.15, night);
    reflection += uSunDisc * glint * 0.15;

    vec3 shallow = uWater * vec3(1.8, 2.2, 1.95) + uHalo * 0.05;
    vec3 body = mix(shallow, uWater, 0.75);
    float bodyAlpha = 0.5;
    float alpha = 1.0 - (1.0 - fresnel) * (1.0 - bodyAlpha);
    vec3 col = (reflection * fresnel + body * bodyAlpha * (1.0 - fresnel)) / max(alpha, 1e-3);

    float rush = fbm2(vec2(vCenter * 1.9 + 2.0, vFlow * 0.85) - vec2(0.0, uTime * speed * 0.22), 2);
    float bankFoam = smoothstep(0.65, 0.98, abs(vCenter)) * smoothstep(0.76, 0.96, rush + vSpeed * 0.25);
    float patchFoam = smoothstep(0.84, 0.96, rush) * vSpeed * 0.35 * (1.0 - smoothstep(0.5, 0.85, abs(vCenter)));
    float foam = clamp(bankFoam * 0.4 + patchFoam, 0.0, 0.55);
    foam *= mix(1.0, 0.3, night);
    col = mix(col, vec3(0.75, 0.78, 0.8), foam);

    float edge = 1.0 - smoothstep(0.78, 1.0, abs(vCenter));
    alpha = clamp(max(alpha, foam * 0.85), 0.0, 1.0) * edge * vFade;

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    float fogF = smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, dist);
    fogF = max(fogF, uMist * smoothstep(10.0, 90.0, dist));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, toDisplay(hazeColor(-view)), fogF);
  }
`

function buildRibbon() {
  const creek = getCreek()
  const { points, bedHeights, lengths, mouthIndex } = creek
  const n = points.length
  if (n < 4) return null

  const ys = new Float32Array(n)
  let prev = 0
  for (let i = 0; i < n; i++) {
    if (i <= mouthIndex) {
      ys[i] = 0
    } else {
      const ds = lengths[i] - lengths[i - 1]
      const target = Math.max(bedHeights[i] + BED_CLEARANCE, prev - MAX_DROP * ds)
      ys[i] = Math.min(prev, target, bedHeights[i] + CREEK_DEPTH + BANK_CLEARANCE)
    }
    prev = ys[i]
  }

  const positions = new Float32Array(n * 2 * 3)
  const uvs = new Float32Array(n * 2 * 2)
  const centers = new Float32Array(n * 2)
  const speeds = new Float32Array(n * 2)
  const fades = new Float32Array(n * 2)

  const startFade = lengths[mouthIndex] - 1
  const endFadeStart = lengths[n - 1] - 5

  for (let i = 0; i < n; i++) {
    const [x, z] = points[i]
    const prevP = points[Math.max(0, i - 1)]
    const nextP = points[Math.min(n - 1, i + 1)]
    let tx = nextP[0] - prevP[0]
    let tz = nextP[1] - prevP[1]
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const w = CREEK_HALF_WIDTH * (0.6 + 0.2 * (noise2D(lengths[i] * 0.22, 47.9) + 1))
    const px = -tz * w
    const pz = tx * w

    const slope = i === 0 ? 0 : (bedHeights[i - 1] - bedHeights[i]) / Math.max(0.001, lengths[i] - lengths[i - 1])
    const speed = THREE.MathUtils.clamp(slope * 5, 0.15, 1.2)
    const fade =
      THREE.MathUtils.smoothstep(lengths[i], startFade, startFade + 3) *
      (1 - THREE.MathUtils.smoothstep(lengths[i], endFadeStart, lengths[n - 1]))

    for (let side = 0; side < 2; side++) {
      const v = i * 2 + side
      const sign = side === 0 ? 1 : -1
      positions[v * 3] = x + px * sign
      positions[v * 3 + 1] = ys[i]
      positions[v * 3 + 2] = z + pz * sign
      uvs[v * 2] = 0
      uvs[v * 2 + 1] = lengths[i]
      centers[v] = sign
      speeds[v] = speed
      fades[v] = fade
    }
  }

  const indices = new Uint32Array((n - 1) * 6)
  let k = 0
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    indices[k++] = a
    indices[k++] = a + 1
    indices[k++] = a + 2
    indices[k++] = a + 1
    indices[k++] = a + 3
    indices[k++] = a + 2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 1))
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
  geometry.setAttribute('aFade', new THREE.BufferAttribute(fades, 1))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}

export default function Creek() {
  const reducedMotion = usePrefersReducedMotion()
  const disabled = benchmark?.creek === 'off'

  const geometry = useMemo(
    () => (disabled ? null : measureGeneration('creek-generation', buildRibbon)),
    [disabled]
  )
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: Object.assign({ uTime: { value: 0 } }, ATMOSPHERE),
      }),
    []
  )

  const time = useRef(0)
  const mesh = useRef(null)
  useFrame((_, delta) => {
    const m = mesh.current?.material
    if (!m) return
    if (benchmark) {
      m.uniforms.uTime.value = reducedMotion ? 0 : benchmarkState.animationTime
    } else {
      time.current += delta
      m.uniforms.uTime.value = reducedMotion ? 0 : time.current
    }
  })

  if (!geometry) return null

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={2} />
}
