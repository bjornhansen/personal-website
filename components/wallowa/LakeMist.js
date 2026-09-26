'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ATMOSPHERE, ATMOSPHERE_GLSL } from './atmosphere'
import { NOISE_GLSL } from './glsl'
import { benchmark } from './benchmark/config'

const CENTER = { x: -10, z: 45 }
const LAYERS = [0.35, 0.9, 1.5, 2.2]

const vert = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const frag = /* glsl */ `
  uniform float uSkyTime;
  uniform float uLayer;
  varying vec3 vWorldPos;
  ${NOISE_GLSL}
  ${ATMOSPHERE_GLSL}

  void main() {
    vec2 p = vWorldPos.xz;
    vec2 drift = vec2(0.35, 0.12) * uSkyTime * (0.6 + uLayer * 0.25);
    float n = fbm2((p + drift) * 0.03 + uLayer * 7.3, 4);
    float wisps = smoothstep(0.42, 0.72, n);
    vec2 e = (p - vec2(${CENTER.x.toFixed(1)}, ${CENTER.z.toFixed(1)})) / vec2(88.0, 108.0);
    float edge = 1.0 - smoothstep(0.65, 1.0, length(e));
    vec3 toFrag = vWorldPos - cameraPosition;
    float dist = length(toFrag);
    vec3 dir = toFrag / dist;
    float camFade = smoothstep(0.4, 2.5, abs(cameraPosition.y - vWorldPos.y)) * smoothstep(4.0, 20.0, dist);
    float alpha = uMist * wisps * edge * camFade * (0.55 - uLayer * 0.1);
    float mu = max(dot(dir, uSunDir), 0.0);
    vec3 col = hazeColor(dir) * 1.08 + uHalo * pow(mu, 4.0) * 0.4;
    gl_FragColor = vec4(toDisplay(col), alpha);
  }
`

export default function LakeMist() {
  const group = useRef()
  const materials = useMemo(
    () =>
      LAYERS.map(
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms: { ...ATMOSPHERE, uLayer: { value: i } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
      ),
    []
  )

  useFrame(() => {
    if (group.current) group.current.visible = benchmark?.mist !== 'off' && ATMOSPHERE.uMist.value > 0.01
  })

  return (
    <group ref={group} visible={false}>
      {LAYERS.map((y, i) => (
        <mesh
          key={y}
          material={materials[i]}
          position={[CENTER.x, y, CENTER.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={2 + i}
        >
          <planeGeometry args={[200, 250]} />
        </mesh>
      ))}
    </group>
  )
}
