import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, Vector3 } from "three";
import type { PlanetKind, Tier } from "@/lib/solar";

// Procedural surfaces for the solar system, written in GLSL (the language
// graphics cards run). Nothing is loaded from image files: every pattern is
// computed per pixel from noise, so each planet is unique and tinted with its
// category colour.

/**
 * 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT licence) and fbm,
 * which layers several octaves of it: the standard way to make natural-
 * looking patterns like clouds, terrain and turbulence.
 */
const NOISE = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Fractal noise: five layers, each finer and fainter than the last.
  float fbm(vec3 p) {
    float sum = 0.0, amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amplitude * snoise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return sum;
  }
`;

// Suns ------------------------------------------------------------------------------

/** A churning, glowing surface in the category colour; bright enough to bloom. */
export function sunMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vObject;
      varying vec3 vNormal;
      void main() {
        vObject = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vObject;
      varying vec3 vNormal;
      ${NOISE}
      void main() {
        vec3 p = normalize(vObject);
        // Large slow cells plus finer, faster granulation, like a real sun's surface.
        float cells = fbm(p * 2.2 + vec3(0.0, uTime * 0.04, 0.0));
        float grain = fbm(p * 7.0 - vec3(uTime * 0.07));
        float heat = 0.5 + 0.5 * cells + 0.25 * grain;
        vec3 hot = mix(uColor, vec3(1.0, 0.97, 0.9), 0.35);
        vec3 colour = mix(uColor * 0.85, hot, clamp(heat, 0.0, 1.0));
        // Limb darkening: the edge, seen at a slant, is dimmer than the middle.
        float facing = max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
        colour *= 0.55 + 0.75 * pow(facing, 0.4);
        // Above 1.0 on purpose: the bloom pass turns the excess into glow.
        gl_FragColor = vec4(colour * 1.25, 1.0);
      }
    `,
    toneMapped: false,
  });
}

/** A soft glow around a sun: a larger sphere seen from inside, fading outwards. */
export function coronaMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      void main() {
        // We see the inside of this shell, so its normals point away from us:
        // -z is 1 straight behind the sun and 0 at the shell's outline. Raising
        // it to a power makes the glow fall off softly towards that outline.
        float glow = pow(clamp(-normalize(vNormal).z, 0.0, 1.0), 3.0);
        gl_FragColor = vec4(uColor * glow * 0.9, glow);
      }
    `,
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

// Planets ---------------------------------------------------------------------------

const KIND_CODE: Record<PlanetKind, number> = { rocky: 0, ocean: 1, gas: 2 };

/**
 * A planet lit by its own sun: a surface pattern by kind, shadow on the far
 * side, a thin atmosphere glowing at the edge. Locked and finished planets
 * lose their colour; uGlow brightens planets on today's route and on hover.
 */
export function planetMaterial({
  color,
  kind,
  seed,
  tier,
  sun,
}: {
  color: string;
  kind: PlanetKind;
  seed: number;
  tier: Tier;
  /** Where its sun is, in world space. */
  sun: [number, number, number];
}): ShaderMaterial {
  const faded = tier === "locked" || tier === "done";
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uSun: { value: new Vector3(...sun) },
      uKind: { value: KIND_CODE[kind] },
      uSeed: { value: seed },
      uFaded: { value: faded ? 1 : 0 },
      uGlow: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: tier === "parked" ? 0.6 : tier === "done" ? 0.55 : 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObject;
      varying vec3 vWorld;
      varying vec3 vNormalWorld;
      void main() {
        vObject = position;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uSun;
      uniform int uKind;
      uniform float uSeed;
      uniform float uFaded;
      uniform float uGlow;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vObject;
      varying vec3 vWorld;
      varying vec3 vNormalWorld;
      ${NOISE}
      void main() {
        // Object-space position: the pattern turns with the planet as it spins.
        vec3 dir = normalize(vObject);
        vec3 p = dir * 2.0 + uSeed;
        vec3 surface;

        if (uKind == 2) {
          // Gas giant: bands along the latitudes, stirred by turbulence.
          float turbulence = fbm(p * 1.4) * 0.3;
          float bands = sin((dir.y + turbulence) * 16.0 + uSeed) * 0.5 + 0.5;
          surface = mix(uColor * 0.5, mix(uColor, vec3(1.0), 0.4), bands);
        } else if (uKind == 1) {
          // Ocean world: dark seas, paler continents, drifting clouds.
          float height = fbm(p * 1.3);
          vec3 sea = uColor * 0.32;
          vec3 land = mix(uColor, vec3(0.86, 0.82, 0.72), 0.4);
          surface = height > 0.04 ? land * (0.8 + 0.4 * height) : sea * (1.0 + 0.6 * height);
          float clouds = smoothstep(0.2, 0.6, fbm(p * 2.4 + vec3(uTime * 0.03, 0.0, 0.0)));
          surface = mix(surface, vec3(0.95), clouds * 0.45);
        } else {
          // Rocky: rough terrain with a few darker craters.
          float height = fbm(p * 2.3);
          surface = mix(uColor * 0.38, mix(uColor, vec3(0.9), 0.3), 0.5 + 0.5 * height);
          float crater = smoothstep(0.5, 0.7, snoise(p * 5.0));
          surface *= 1.0 - crater * 0.3;
        }

        // Locked or finished: drained of colour.
        if (uFaded > 0.5) {
          float grey = dot(surface, vec3(0.3, 0.59, 0.11));
          surface = mix(surface, vec3(grey) * 0.75, 0.85);
        }

        // Lit by its own sun: bright on the near side, shadowed beyond.
        vec3 normal = normalize(vNormalWorld);
        vec3 toSun = normalize(uSun - vWorld);
        float light = max(dot(normal, toSun), 0.0);
        vec3 colour = surface * (0.1 + 1.1 * light);

        // A thin atmosphere: brightest at the edge seen against space.
        vec3 toCamera = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - max(dot(normal, toCamera), 0.0), 2.6);
        vec3 air = mix(uColor, vec3(0.8, 0.9, 1.0), 0.35);
        colour += air * rim * (0.3 + 0.7 * light) * (uFaded > 0.5 ? 0.2 : 1.0);

        // Today's route and hover make a planet glow.
        colour += uColor * uGlow * 0.4;
        gl_FragColor = vec4(colour, uOpacity);
      }
    `,
    transparent: tier === "parked" || tier === "done",
  });
}

/** Banded, semi-transparent rings for a gas giant, lit faintly. */
export function ringMaterial(color: string, inner: number, outer: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uInner: { value: inner }, uOuter: { value: outer } },
    vertexShader: /* glsl */ `
      varying float vRadius;
      void main() {
        vRadius = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInner;
      uniform float uOuter;
      varying float vRadius;
      void main() {
        float t = (vRadius - uInner) / (uOuter - uInner);
        // Many thin bands, fading in and out at the edges.
        float bands = 0.55 + 0.45 * sin(t * 60.0) * sin(t * 13.0);
        float edges = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.8, t);
        vec3 colour = mix(uColor, vec3(0.95, 0.92, 0.85), 0.5) * 0.8;
        gl_FragColor = vec4(colour, bands * edges * 0.55);
      }
    `,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}
