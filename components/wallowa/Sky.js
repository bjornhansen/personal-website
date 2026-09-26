'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { ATMOSPHERE, ATMOSPHERE_GLSL } from './atmosphere'
import { NOISE3_GLSL, NOISE_GLSL } from './glsl'
import { benchmark } from './benchmark/config'

const RADIUS = 4000

const vert = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w;
  }
`

const frag = /* glsl */ `
  uniform vec3 uSunDisc;
  uniform float uStars;
  uniform mat3 uCelestial;
  uniform float uCloudCover;
  uniform float uCirrus;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uSkyTime;
  varying vec3 vWorldPos;

  ${NOISE_GLSL}
  ${NOISE3_GLSL}
  ${ATMOSPHERE_GLSL}

  const vec3 GALACTIC_POLE = vec3(-0.8676, -0.1981, 0.4560);
  const vec3 GALACTIC_CENTER = vec3(-0.0549, -0.8734, -0.4838);

  float starLayer(vec3 c, float scale, float density) {
    vec3 p = c * scale;
    vec3 cell = floor(p);
    vec3 f = fract(p);
    vec3 h = hash33(cell);
    float present = step(1.0 - density, hash13(cell + 17.31));
    float d = length(f - (0.25 + 0.5 * h));
    float px = max(length(fwidth(p)), 1e-4);
    float size = px * 0.9;
    float core = smoothstep(size * 1.6, 0.0, d);
    float mag = 0.05 + pow(h.x, 7.0) * 2.2;
    float twinkle = 0.75 + 0.25 * sin(uSkyTime * (1.5 + h.y * 3.0) + h.z * 40.0);
    return present * core * mag * twinkle;
  }

  vec3 starColor(vec3 c, float scale) {
    float t = hash13(floor(c * scale) + 3.7);
    return mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.86, 0.7), t);
  }

  float milkyWay(vec3 c) {
    float lat = dot(c, GALACTIC_POLE);
    float band = exp(-pow(lat / 0.16, 2.0));
    float core = pow(max(dot(c, GALACTIC_CENTER), 0.0), 3.0);
    float clouds = fbm3(c * 6.0, 5);
    float dust = smoothstep(0.45, 0.7, fbm3(c * 11.0 + 4.0, 4)) * exp(-pow(lat / 0.05, 2.0));
    return band * (0.35 + core * 1.2) * smoothstep(0.3, 0.75, clouds) * (1.0 - dust * 0.85);
  }

  vec4 moonDisc(vec3 dir) {
    const float R = 0.021;
    vec3 m = normalize(uMoonDir);
    vec3 t = normalize(cross(m, abs(m.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 b = cross(t, m);
    vec3 rel = dir - m * dot(dir, m);
    vec2 uv = vec2(dot(rel, t), dot(rel, b)) / R;
    float r2 = dot(uv, uv);
    if (dot(dir, m) < 0.0 || r2 > 1.2) return vec4(0.0);
    float px = max(length(fwidth(uv)), 1e-4);
    float edge = smoothstep(1.0, 1.0 - px * 1.5, sqrt(r2));
    vec3 n = t * uv.x + b * uv.y - m * sqrt(max(1.0 - r2, 0.0));
    float lit = smoothstep(-0.08, 0.12, dot(n, uSunDir));
    float maria = smoothstep(0.45, 0.7, fbm2(uv * 2.2 + 7.0, 4));
    vec3 albedo = mix(vec3(1.0, 0.98, 0.93), vec3(0.62, 0.64, 0.68), maria * 0.8);
    return vec4(albedo * (lit * 1.6 + 0.015), edge);
  }

  vec3 clouds(vec3 dir, vec3 col, out float alpha) {
    alpha = 0.0;
    if (dir.y <= 0.0) return col;
    float mu = max(dot(dir, uSunDir), 0.0);
    vec3 haze = hazeColor(dir);
    float horizonFade = smoothstep(0.0, 0.18, dir.y);

    vec2 cp = dir.xz / (dir.y + 0.1) * 0.55 + vec2(0.012, 0.004) * uSkyTime;
    float n = fbm2(cp * 1.4, 5);
    float threshold = mix(0.74, 0.42, uCloudCover);
    float density = smoothstep(threshold, threshold + 0.16, n);
    vec2 toSun = normalize(uSunDir.xz + vec2(1e-4)) * 0.18;
    float towardSun = fbm2((cp + toSun) * 1.4, 4);
    float shade = 1.0 - smoothstep(threshold - 0.05, threshold + 0.25, towardSun) * 0.75;
    vec3 lit = mix(uCloudShade, uCloudLit, shade);
    lit += uHalo * pow(mu, 6.0) * (1.0 - density) * 1.5;
    lit = mix(lit, haze, (1.0 - horizonFade) * 0.7);
    float a = density * horizonFade * 0.95;

    vec2 hp = dir.xz / (dir.y + 0.05) * 0.18 + vec2(0.02, 0.009) * uSkyTime;
    hp = mat2(0.8, -0.6, 0.6, 0.8) * hp;
    float streak = fbm2(hp * vec2(1.2, 6.0), 5);
    float cirrus = smoothstep(0.55, 0.8, streak) * uCirrus * horizonFade * 0.55;
    vec3 cirrusCol = mix(uCloudLit, uGlow, uTwilight * 0.35) + uHalo * pow(mu, 4.0);

    col = mix(col, cirrusCol, cirrus);
    col = mix(col, lit, a);
    alpha = max(a, cirrus);
    return col;
  }

  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    vec3 col = skyGradient(dir);
    float aboveHorizon = smoothstep(-0.005, 0.02, dir.y);

    if (uStars > 0.001) {
      vec3 c = uCelestial * dir;
      vec3 s =
        starColor(c, 60.0) * starLayer(c, 60.0, 0.3) * 1.4 +
        starColor(c, 140.0) * starLayer(c, 140.0, 0.22) * 0.8 +
        starColor(c, 300.0) * starLayer(c, 300.0, 0.14) * 0.5;
      float mw = milkyWay(c) * (1.0 - clamp(uMoonLight, 0.0, 1.0) * 0.8);
      float extinction = smoothstep(0.0, 0.3, dir.y);
      col += (s + vec3(0.62, 0.68, 0.85) * mw * 0.3) * uStars * extinction;
    }

    vec4 moon = moonDisc(dir);
    col = mix(col, max(col, moon.rgb), moon.a * aboveHorizon);

    float sunCos = dot(dir, uSunDir);
    float sunPx = max(fwidth(sunCos), 1e-6);
    float disc = smoothstep(0.99992 - sunPx, 0.99992 + sunPx, sunCos);
    col += uSunDisc * disc * aboveHorizon;

    float cloudAlpha;
    col = clouds(dir, col, cloudAlpha);

    col = mix(hazeColor(dir), col, aboveHorizon);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const simpleFrag = `
  varying vec3 vWorldPos;
  ${ATMOSPHERE_GLSL}
  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    gl_FragColor = vec4(skyGradient(dir), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export default function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: benchmark?.sky === 'simple' ? simpleFrag : frag,
        uniforms: ATMOSPHERE,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    []
  )

  return (
    <mesh
      material={material}
      frustumCulled={false}
      renderOrder={-1}
      onBeforeRender={function (renderer, scene, camera) {
        this.position.copy(camera.position)
        this.updateMatrixWorld()
      }}
    >
      <sphereGeometry args={[RADIUS, 64, 32]} />
    </mesh>
  )
}
