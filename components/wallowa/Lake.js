'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 0.25 + uTime * 0.8) * 0.12;
    p.z += sin(p.y * 0.4 - uTime * 0.6) * 0.08;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const frag = /* glsl */ `
  uniform vec3 uColorDeep;
  uniform vec3 uColorShallow;
  uniform vec3 uColorSky;
  uniform float uTime;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ripple =
      sin(vWorldPos.x * 0.6 + uTime * 1.4) *
      sin(vWorldPos.z * 0.5 - uTime * 1.1);
    vec3 normal = normalize(vec3(
      cos(vWorldPos.x * 0.6 + uTime * 1.4) * 0.06,
      1.0,
      cos(vWorldPos.z * 0.5 - uTime * 1.1) * 0.06
    ));
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);
    float dist = length(vWorldPos.xz) / 220.0;
    vec3 water = mix(uColorShallow, uColorDeep, clamp(dist * 1.6, 0.0, 1.0));
    vec3 col = mix(water, uColorSky, fresnel * 0.75);
    col += ripple * 0.015;
    gl_FragColor = vec4(col, 0.88);
  }
`

export default function Lake({ sunColor, nightFactor }) {
  const matRef = useRef()
  const deepBase = useRef(new THREE.Color('#16323a')).current
  const nightBase = useRef(new THREE.Color('#050a12')).current
  const skyBase = useRef(new THREE.Color('#bcd8e6')).current
  const nightSky = useRef(new THREE.Color('#101828')).current
  const sunTint = useRef(new THREE.Color()).current

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color('#16323a') },
      uColorShallow: { value: new THREE.Color('#3b6b74') },
      uColorSky: { value: new THREE.Color('#bcd8e6') },
    }),
    []
  )

  useFrame((state) => {
    const u = matRef.current?.uniforms
    if (!u) return
    u.uTime.value = state.clock.elapsedTime
    u.uColorDeep.value.copy(deepBase).lerp(nightBase, nightFactor)
    u.uColorSky.value.copy(skyBase).lerp(nightSky, nightFactor)
    sunTint.set(sunColor)
    u.uColorSky.value.lerp(sunTint, 0.2)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0, 45]}>
      <planeGeometry args={[190, 240, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  )
}
