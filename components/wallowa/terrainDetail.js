import * as THREE from 'three'
import { NOISE_GLSL } from './glsl'
import { GROUND_EXTENT } from './groundMap'

export const DETAIL_TILE = 20

const FIELD_SIZE = 1024
const DETAIL_SIZE = 1024
const FACET_SIZE = 512

const period = (frequency) => (frequency * DETAIL_TILE).toFixed(1)

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  ${NOISE_GLSL}

  float vnoiseP(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(mod(i, period));
    float b = hash12(mod(i + vec2(1.0, 0.0), period));
    float c = hash12(mod(i + vec2(0.0, 1.0), period));
    float d = hash12(mod(i + vec2(1.0, 1.0), period));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  vec3 voronoiP(vec2 x, float period) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 cell = mod(n + g, period);
        vec2 r = g + hash22(cell) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = cell;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), hash12(id));
  }

  void main() {
    #if defined(BAKE_FIELD)
      vec2 gp = (vUv - 0.5) * ${GROUND_EXTENT.toFixed(1)};
      gl_FragColor = vec4(
        fbm2(gp * 0.07 + 11.0, 3),
        fbm2(gp * 0.35 - 4.0, 3),
        fbm2(gp * 0.16 + 3.0, 3),
        vnoise(gp * 0.9 + 21.0)
      );
    #elif defined(BAKE_DETAIL)
      vec2 gp = vUv * ${DETAIL_TILE.toFixed(1)};
      vec3 stones = voronoiP(gp * 3.2, ${period(3.2)});
      gl_FragColor = vec4(
        vnoiseP(gp * 2.1, ${period(2.1)}),
        clamp(stones.y * 4.0, 0.0, 1.0),
        stones.z,
        voronoiP(gp * 2.2 + 9.0, ${period(2.2)}).z
      );
    #else
      vec2 gp = vUv * ${DETAIL_TILE.toFixed(1)};
      gl_FragColor = vec4(voronoiP(gp * 0.75, ${period(0.75)}).z, 0.0, 0.0, 1.0);
    #endif
  }
`

function target(size, wrap) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: wrap,
    wrapT: wrap,
  })
  rt.texture.anisotropy = 8
  return rt
}

function bakeMaterial(define) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    defines: { [define]: '' },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

export function createTerrainDetail() {
  const passes = [
    [target(FIELD_SIZE, THREE.ClampToEdgeWrapping), bakeMaterial('BAKE_FIELD')],
    [target(DETAIL_SIZE, THREE.RepeatWrapping), bakeMaterial('BAKE_DETAIL')],
    [target(FACET_SIZE, THREE.RepeatWrapping), bakeMaterial('BAKE_FACET')],
  ]
  const geometry = new THREE.PlaneGeometry(2, 2)
  const quad = new THREE.Mesh(geometry)
  quad.frustumCulled = false
  const scene = new THREE.Scene().add(quad)
  const camera = new THREE.OrthographicCamera()

  return {
    field: passes[0][0].texture,
    detail: passes[1][0].texture,
    facet: passes[2][0].texture,
    bake(renderer) {
      const previous = renderer.getRenderTarget()
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      for (const [rt, material] of passes) {
        rt.texture.anisotropy = anisotropy
        quad.material = material
        renderer.setRenderTarget(rt)
        renderer.render(scene, camera)
      }
      renderer.setRenderTarget(previous)
      return passes.length
    },
    dispose() {
      for (const [rt, material] of passes) {
        rt.dispose()
        material.dispose()
      }
      geometry.dispose()
    },
  }
}
