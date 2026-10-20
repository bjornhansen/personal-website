'use client'

import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { noise2D } from './noise'
import { withAtmosphere } from './atmosphere'
import { NOISE_GLSL } from './glsl'
import { DIRT, GROUND_EXTENT, CREEK, commitGround, groundTexture, paintBlob, paintPath } from './groundMap'
import { TRAIL_HALF_WIDTH, getTrails } from './trails'
import { CREEK_BANK_RADIUS, CREEK_DEPTH, creekCarve, getCreek } from './creekbed'
import { baseHeight, lakeBowl, meadowMask } from './heightfield'
import { CAMP } from './places'
import { benchmark, markBenchmark, measureGeneration } from './benchmark/config'
import { DETAIL_TILE, createTerrainDetail } from './terrainDetail'
import { TERRAIN_CELL, TERRAIN_SEGMENTS, TERRAIN_VERTS, getHeightGrid, vertexPosition } from './terrainMesh'

const SIZE = GROUND_EXTENT
const SEGMENTS = TERRAIN_SEGMENTS
const WATER_LEVEL = 0

export { baseHeight, meadowMask, lakeBowl }
export { groundHeight, groundContact, groundNormal, groundSlope } from './terrainMesh'

export function terrainHeight(x, z) {
  const base = baseHeight(x, z)
  return base - creekCarve(x, z, base)
}

const cGrass = new THREE.Color('#4f6b3a')
const cGrassDry = new THREE.Color('#7d7f4e')
const cMeadow = new THREE.Color('#8fa14e')
const cMeadowDry = new THREE.Color('#b3a75f')
const cGranite = new THREE.Color('#8f8c87')
const cGraniteWet = new THREE.Color('#6e6b66')
const cSand = new THREE.Color('#9a8f76')
const cAlpine = new THREE.Color('#6f7552')

const surfaceVertex = /* glsl */ `
  attribute vec2 aSurface;
  varying vec2 vSurface;
  varying vec3 vGroundPos;
`

const surfaceFragment = /* glsl */ `
  uniform sampler2D uGround;
  uniform sampler2D uField;
  uniform sampler2D uDetail;
  uniform sampler2D uFacet;
  uniform vec3 uRock;
  uniform vec3 uRockDark;
  uniform vec3 uSnow;
  uniform vec3 uDuff;
  uniform vec3 uDirt;
  varying vec2 vSurface;
  varying vec3 vGroundPos;
  ${NOISE_GLSL}
`

const bakedFields = /* glsl */ `
  vec4 field = texture2D(uField, gp / ${SIZE.toFixed(1)} + 0.5);
  vec4 detail = texture2D(uDetail, gp / ${DETAIL_TILE.toFixed(1)});
  float nLarge = field.r;
  float nMid = field.g;
  float tuftNoise = field.b;
  float clumpNoise = field.a;
  float nFine = detail.r;
  float stoneEdge = detail.g * 0.25;
  float stoneId = detail.b;
  float gritId = detail.a;
  float facetId = texture2D(uFacet, gp / ${DETAIL_TILE.toFixed(1)}).r;
`

const proceduralFields = /* glsl */ `
  float nLarge = fbm2(gp * 0.07 + 11.0, 3);
  float nMid = fbm2(gp * 0.35 - 4.0, 3);
  float tuftNoise = fbm2(gp * 0.16 + 3.0, 3);
  float clumpNoise = vnoise(gp * 0.9 + 21.0);
  float nFine = vnoise(gp * 2.1);
  vec3 stones = voronoi(gp * 3.2);
  float stoneEdge = stones.y;
  float stoneId = stones.z;
  float gritId = voronoi(gp * 2.2 + 9.0).z;
  float facetId = voronoi(gp * 0.75).z;
`

const surfaceColor = (fields) => /* glsl */ `
  vec2 gp = vGroundPos.xz;
  vec4 ground = texture2D(uGround, gp / ${SIZE.toFixed(1)} + 0.5);
  ${fields}

  vec3 base = diffuseColor.rgb;
  float tuft = smoothstep(0.47, 0.53, tuftNoise);
  base *= mix(0.9, 1.07, tuft) * (0.94 + nFine * 0.12);
  base = mix(base, base * vec3(1.08, 1.02, 0.86), smoothstep(0.55, 0.62, nLarge) * 0.6);

  base *= 1.0 + (facetId - 0.5) * 0.1;
  float clump = smoothstep(0.5, 0.56, clumpNoise);
  base = mix(base, base * vec3(0.8, 0.9, 0.76), clump * 0.6);

  float creek = ground.a;
  float shoreZone = 1.0 - smoothstep(1.2, 1.9, vGroundPos.y + (nMid - 0.5) * 0.4);
  float gap = 1.0 - smoothstep(0.02, 0.12, stoneEdge);
  vec3 pebbles = base * mix(0.86, 1.14, stoneId) * (1.0 - gap * 0.16);
  base = mix(base, pebbles, max(shoreZone, creek * 0.75));
  vec3 creekStone = mix(uRockDark * 0.55, uRock * 0.8, stoneId) * (0.82 + nFine * 0.25) * vec3(0.92, 0.96, 1.0);
  base = mix(base, creekStone, creek);

  vec3 bloom = voronoi(gp * 2.4 + 50.0);
  float greenness = clamp((diffuseColor.g - diffuseColor.r) * 6.0, 0.0, 1.0);
  float petal = step(0.975, bloom.z) * (1.0 - smoothstep(0.07, 0.11, bloom.x)) * greenness;
  vec3 petalColor = mix(vec3(0.95, 0.9, 0.55), vec3(0.75, 0.62, 0.9), step(0.9875, bloom.z));

  float floorMask = smoothstep(0.35, 0.6, ground.g + (nMid - 0.5) * 0.5);
  vec3 duff = uDuff * (0.85 + nFine * 0.3) * mix(0.9, 1.1, tuft);
  base = mix(base, duff, floorMask * 0.85);

  float dirt = smoothstep(0.32, 0.52, ground.b + (nMid - 0.5) * 0.35 + (nFine - 0.5) * 0.12);
  base = mix(base, uDirt * (0.84 + nFine * 0.16 + gritId * 0.14), dirt);

  float rockMask = smoothstep(0.47, 0.53, vSurface.x + (nMid - 0.5) * 0.45 + (nLarge - 0.5) * 0.3);
  float strata = vnoise(vec2(vGroundPos.y * 0.55 + nMid * 1.8, gp.x * 0.02));
  vec3 rock = mix(uRockDark, uRock, 0.3 + 0.7 * smoothstep(0.3, 0.7, strata)) * (0.9 + nFine * 0.2);
  base = mix(base, rock, rockMask);

  float snowMask = smoothstep(0.48, 0.52, vSurface.y + (nMid - 0.5) * 0.5 + (nFine - 0.5) * 0.08);
  base = mix(base, uSnow * (0.96 + nFine * 0.06), snowMask);

  float waterline = vGroundPos.y + (nFine - 0.5) * 0.15;
  float wet = (1.0 - smoothstep(0.05, 0.55, waterline)) * step(-0.6, waterline);
  wet = max(wet, creek);
  base *= mix(1.0, 0.6, wet * (1.0 - snowMask)) * mix(1.0, 0.75, creek);

  base = mix(base, petalColor, petal * (1.0 - floorMask) * (1.0 - dirt) * (1.0 - rockMask) * (1.0 - snowMask) * (1.0 - shoreZone) * (1.0 - creek));
  base *= 1.0 - ground.r * 0.6;
  diffuseColor.rgb = base;
`

const surfaceRoughness = /* glsl */ `
  roughnessFactor = mix(roughnessFactor, 0.68, wet);
  roughnessFactor = mix(roughnessFactor, 0.5, creek);
  roughnessFactor = mix(roughnessFactor, 0.75, snowMask);
`

const surfaceNormal = /* glsl */ `
  vec3 facet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  normal = normalize(mix(normal, facet, max(rockMask * 0.9, 0.4)));
`

function paintCampGround() {
  getTrails().forEach((path) => paintPath(DIRT, path, TRAIL_HALF_WIDTH, 0.9))
  paintBlob(DIRT, CAMP.x, CAMP.z, 10, 1, 0.4)
  paintBlob(DIRT, CAMP.x - 12, CAMP.z + 3, 3.4, 1, 0.5)
  const creek = getCreek()
  if (creek.points.length > 3) {
    paintPath(CREEK, creek.points, CREEK_BANK_RADIUS, 1, 0.3)
    for (let i = 0; i < creek.points.length; i += 4) {
      const [x, z] = creek.points[i]
      paintBlob(CREEK, x, z, CREEK_BANK_RADIUS + 1.5, 0.4, 1.2)
    }
    paintBlob(CREEK, creek.points[0][0], creek.points[0][1], CREEK_BANK_RADIUS + 2, 0.7, 1)
  }
  commitGround()
}

export default function Terrain() {
  const geometry = useMemo(() => measureGeneration('terrain-generation', () => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const surface = new Float32Array(pos.count * 2)
    const color = new THREE.Color()
    const grid = getHeightGrid()
    const N = TERRAIN_VERTS

    for (let i = 0; i < pos.count; i++) {
      const [x, z] = vertexPosition(i)
      const h = grid[i]
      const base = baseHeight(x, z)
      const channel = Math.min(1, (base - h) / CREEK_DEPTH)
      pos.setY(i, h)

      const ix = i % N
      const iy = Math.floor(i / N)
      const hx = grid[iy * N + Math.min(ix + 1, N - 1)]
      const hz = grid[Math.min(iy + 1, N - 1) * N + ix]
      const gx = (hx - h) / TERRAIN_CELL
      const gz = (hz - h) / TERRAIN_CELL
      const slope = Math.min(1, Math.sqrt(gx * gx + gz * gz) * 0.9)
      const northness = THREE.MathUtils.clamp(-gz * 0.8, 0, 1)

      const n = (noise2D(x * 0.08, z * 0.08) + 1) * 0.5
      const meadow = meadowMask(x, z)

      const band = WATER_LEVEL + 0.5 + 1.1 * (0.5 + 0.5 * noise2D(x * 0.035 + 7.7, z * 0.035 - 3.1))
      if (h < band) {
        const shore = THREE.MathUtils.smoothstep(h, WATER_LEVEL - 0.4, band)
        color.copy(cGraniteWet).lerp(cGranite, shore)
        if (h < WATER_LEVEL - 1.5) color.lerp(cSand, 0.5)
      } else if (meadow > 0.62) {
        const open = THREE.MathUtils.smoothstep(meadow, 0.62, 0.74)
        color.copy(cMeadow).lerp(cMeadowDry, n * 0.5).lerp(cGrass, 1 - open)
      } else {
        color.copy(cGrass).lerp(cGrassDry, n * 0.6)
      }
      if (h > 14) color.lerp(cAlpine, Math.min(1, (h - 14) / 12))
      if (channel > 0) color.lerp(cGraniteWet, channel * 0.85)

      const heightRock = THREE.MathUtils.smoothstep(h, 16, 30) * 0.7
      const rock = Math.min(1, Math.max(slope * 0.95, heightRock) + Math.max(0, n - 0.72))
      const snowLine = 27 + n * 8
      let snow = THREE.MathUtils.smoothstep(h, snowLine - 4, snowLine + 2)
      snow += northness * THREE.MathUtils.smoothstep(h, 17, 25) * 0.7
      snow *= 1 - THREE.MathUtils.smoothstep(slope, 0.8, 1) * 0.6

      surface[i * 2] = h < band ? 0 : rock
      surface[i * 2 + 1] = Math.min(1, snow)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSurface', new THREE.BufferAttribute(surface, 2))
    geo.computeVertexNormals()
    return geo
  }), [])

  useEffect(() => {
    paintCampGround()
  }, [])

  const gl = useThree((s) => s.gl)
  const detail = useMemo(() => createTerrainDetail(), [])

  useLayoutEffect(() => {
    const passes = measureGeneration('terrain-detail-bake', () => detail.bake(gl))
    markBenchmark('terrain-detail-baked', { passes })
    return () => detail.dispose()
  }, [gl, detail])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    if (benchmark?.terrain === 'simple') return withAtmosphere(m, 'terrain-simple')
    const procedural = benchmark?.terrain === 'procedural'
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uGround: { value: groundTexture },
        uField: { value: detail.field },
        uDetail: { value: detail.detail },
        uFacet: { value: detail.facet },
        uRock: { value: new THREE.Color('#8d857b') },
        uRockDark: { value: new THREE.Color('#5a534c') },
        uSnow: { value: new THREE.Color('#eef2f4') },
        uDuff: { value: new THREE.Color('#4a3f2c') },
        uDirt: { value: new THREE.Color('#7a6648') },
      })
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${surfaceVertex}`)
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSurface = aSurface;\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${surfaceFragment}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${surfaceColor(procedural ? proceduralFields : bakedFields)}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${surfaceRoughness}`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\n${surfaceNormal}`)
    }
    return withAtmosphere(m, procedural ? 'terrain-procedural' : 'terrain')
  }, [detail])

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
