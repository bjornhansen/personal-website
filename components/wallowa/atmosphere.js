import * as THREE from 'three'

export const FOG_NEAR = 120
export const FOG_FAR = 640

export const ATMOSPHERE = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
  uZenith: { value: new THREE.Color() },
  uHorizon: { value: new THREE.Color() },
  uGlow: { value: new THREE.Color() },
  uGlowStrength: { value: 0 },
  uEarthShadow: { value: new THREE.Color() },
  uBelt: { value: new THREE.Color() },
  uTwilight: { value: 0 },
  uHalo: { value: new THREE.Color() },
  uSunDisc: { value: new THREE.Color() },
  uMoonLight: { value: 0 },
  uStars: { value: 0 },
  uCelestial: { value: new THREE.Matrix3() },
  uCloudCover: { value: 0.4 },
  uCirrus: { value: 0.5 },
  uCloudLit: { value: new THREE.Color() },
  uCloudShade: { value: new THREE.Color() },
  uSkyTime: { value: 0 },
  uMist: { value: 0 },
  uBreeze: { value: 0.2 },
  uWater: { value: new THREE.Color() },
}

export const ATMOSPHERE_GLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform float uGlowStrength;
  uniform vec3 uEarthShadow;
  uniform vec3 uBelt;
  uniform float uTwilight;
  uniform vec3 uHalo;
  uniform float uMoonLight;
  uniform float uMist;

  vec3 skyGradient(vec3 dir) {
    float y = clamp(dir.y, 0.0, 1.0);
    vec2 hd = dir.xz / max(length(dir.xz), 1e-4);
    vec2 sd = uSunDir.xz / max(length(uSunDir.xz), 1e-4);
    float toward = clamp(dot(hd, sd) * 0.5 + 0.5, 0.0, 1.0);

    vec3 horizon = mix(uHorizon, uEarthShadow, uTwilight * pow(1.0 - toward, 1.5));
    float glow = uGlowStrength * pow(toward, 3.0);
    horizon = mix(horizon, uGlow, glow);

    float lift = smoothstep(0.0, 1.0, pow(y, 0.5));
    vec3 col = mix(horizon, uZenith, lift);
    col = mix(col, uGlow, glow * exp(-y * 5.0) * 0.35);

    float belt = exp(-pow((y - 0.11) / 0.07, 2.0)) * pow(1.0 - toward, 1.3) * uTwilight;
    col = mix(col, uBelt, belt * 0.8);

    float mu = max(dot(dir, uSunDir), 0.0);
    col += uHalo * (pow(mu, 8.0) * 0.35 + pow(mu, 96.0) * 1.1);

    float moonMu = max(dot(dir, uMoonDir), 0.0);
    col += vec3(0.55, 0.62, 0.78) * uMoonLight * (pow(moonMu, 24.0) * 0.03 + pow(moonMu, 400.0) * 0.12);
    return col;
  }

  vec3 hazeColor(vec3 dir) {
    return skyGradient(normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0, 1e-4, 0.0)));
  }

  vec3 toDisplay(vec3 c) {
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    return linearToOutputTexel(vec4(c, 1.0)).rgb;
  }
`

const FOG_FRAGMENT = /* glsl */ `
  #ifdef USE_FOG
    vec3 atmoDir = normalize(transpose(mat3(viewMatrix)) * -vViewPosition);
    float atmoDist = length(vViewPosition);
    float atmoFog = smoothstep(fogNear, fogFar, atmoDist);
    float atmoY = cameraPosition.y + atmoDir.y * atmoDist;
    atmoFog = max(atmoFog, uMist * exp(-max(atmoY, 0.0) / 3.5) * smoothstep(10.0, 90.0, atmoDist));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, toDisplay(hazeColor(atmoDir)), atmoFog);
  #endif
`

export function withAtmosphere(material, key = 'default') {
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer)
    Object.assign(shader.uniforms, ATMOSPHERE)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>\n${ATMOSPHERE_GLSL}`)
      .replace('#include <fog_fragment>', FOG_FRAGMENT)
  }
  material.customProgramCacheKey = () => `atmosphere-${key}`
  return material
}
