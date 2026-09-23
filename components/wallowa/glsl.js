export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  vec3 voronoi(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash22(n + g) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = n + g;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), hash12(id));
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  vec3 vnoised(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 du = 6.0 * f * (1.0 - f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    float k1 = b - a;
    float k2 = c - a;
    float k4 = a - b - c + d;
    return vec3(
      a + k1 * u.x + k2 * u.y + k4 * u.x * u.y,
      du * vec2(k1 + k4 * u.y, k2 + k4 * u.x)
    );
  }

  float fbm2(vec2 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      sum += amp * vnoise(p);
      norm += amp;
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      amp *= 0.5;
    }
    return sum / norm;
  }
`

export const NOISE3_GLSL = /* glsl */ `
  float vnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  float fbm3(vec3 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 5; i++) {
      if (i >= octaves) break;
      sum += amp * vnoise3(p);
      norm += amp;
      p = p * 2.03 + vec3(1.7, 9.2, 4.1);
      amp *= 0.5;
    }
    return sum / norm;
  }
`
