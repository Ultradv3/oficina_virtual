import {
  DataTexture,
  DataUtils,
  EquirectangularReflectionMapping,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
} from 'three/webgpu'

/**
 * Entorno de estudio procedural en formato equirectangular HDR.
 *
 * Sustituye al `RoomEnvironment` + `PMREMGenerator` de WebGL (no compatibles con
 * `WebGPURenderer`, que exige node materials). El renderer de three convierte
 * esta textura equirect a PMREM de forma perezosa, tanto en WebGPU como en el
 * fallback WebGL2, así que el componente no necesita tocar el renderer.
 */
const WIDTH = 256
const HEIGHT = 128

interface LightPanel {
  azimuth: number
  elevation: number
  spreadAzimuth: number
  spreadElevation: number
  color: [number, number, number]
  intensity: number
}

// Paneles suaves que imitan las luces de área del estudio de referencia:
// una cálida arriba a la izquierda, una fría arriba a la derecha y una banda
// cenital.
const PANELS: LightPanel[] = [
  {
    azimuth: 2.2,
    elevation: 0.72,
    spreadAzimuth: 0.55,
    spreadElevation: 0.38,
    color: [1, 0.86, 0.68],
    intensity: 5.2,
  },
  {
    azimuth: 5.5,
    elevation: 0.6,
    spreadAzimuth: 0.6,
    spreadElevation: 0.4,
    color: [0.72, 0.84, 1],
    intensity: 3.6,
  },
  {
    azimuth: 0,
    elevation: 1.45,
    spreadAzimuth: Math.PI,
    spreadElevation: 0.3,
    color: [1, 1, 1],
    intensity: 2.6,
  },
]

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function gaussian(delta: number, spread: number): number {
  const normalized = delta / spread
  return Math.exp(-normalized * normalized)
}

function wrapAngle(angle: number): number {
  let wrapped = angle % (Math.PI * 2)
  if (wrapped > Math.PI) wrapped -= Math.PI * 2
  if (wrapped < -Math.PI) wrapped += Math.PI * 2
  return wrapped
}

export function createStudioEnvironmentTexture(): DataTexture {
  const data = new Uint16Array(WIDTH * HEIGHT * 4)

  for (let y = 0; y < HEIGHT; y += 1) {
    const v = (y + 0.5) / HEIGHT
    const elevation = (0.5 - v) * Math.PI

    // Gradiente vertical: techo claro, horizonte cálido y suelo oscuro.
    const ceilingMix = smoothstep(0.5, 0, v)
    const floorMix = smoothstep(0.5, 1, v)
    const ceiling: [number, number, number] = [0.58, 0.66, 0.78]
    const horizon: [number, number, number] = [0.82, 0.72, 0.6]
    const floor: [number, number, number] = [0.055, 0.065, 0.085]

    let r = (horizon[0] + (ceiling[0] - horizon[0]) * ceilingMix) * 1.05
    let g = (horizon[1] + (ceiling[1] - horizon[1]) * ceilingMix) * 1.05
    let b = (horizon[2] + (ceiling[2] - horizon[2]) * ceilingMix) * 1.05

    r = r + (floor[0] - r) * floorMix
    g = g + (floor[1] - g) * floorMix
    b = b + (floor[2] - b) * floorMix

    for (let x = 0; x < WIDTH; x += 1) {
      const u = (x + 0.5) / WIDTH
      const azimuth = u * Math.PI * 2

      let pr = r
      let pg = g
      let pb = b

      for (const panel of PANELS) {
        const deltaAzimuth = wrapAngle(azimuth - panel.azimuth)
        const deltaElevation = elevation - panel.elevation
        const weight =
          gaussian(deltaAzimuth, panel.spreadAzimuth) * gaussian(deltaElevation, panel.spreadElevation)
        if (weight <= 0.001) continue
        pr += panel.color[0] * panel.intensity * weight
        pg += panel.color[1] * panel.intensity * weight
        pb += panel.color[2] * panel.intensity * weight
      }

      const offset = (y * WIDTH + x) * 4
      data[offset] = DataUtils.toHalfFloat(Math.min(pr, 12))
      data[offset + 1] = DataUtils.toHalfFloat(Math.min(pg, 12))
      data[offset + 2] = DataUtils.toHalfFloat(Math.min(pb, 12))
      data[offset + 3] = DataUtils.toHalfFloat(1)
    }
  }

  const texture = new DataTexture(data, WIDTH, HEIGHT, RGBAFormat, HalfFloatType)
  texture.name = 'StudioEnvironment'
  texture.colorSpace = LinearSRGBColorSpace
  texture.mapping = EquirectangularReflectionMapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}
