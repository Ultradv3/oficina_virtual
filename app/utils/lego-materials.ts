import { CanvasTexture, MeshStandardNodeMaterial, RepeatWrapping } from 'three/webgpu'

/** Nivel de desgaste cuantizado de un material LEGO (0 = nuevo, 2 = más usado). */
export type LegoWear = 0 | 1 | 2

export interface LegoMaterialOptions {
  color?: string
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  /**
   * Nivel de desgaste 0–2. Si se omite, se deriva de forma determinista de la
   * firma visual del material, de modo que la caché sigue estando acotada.
   */
  wear?: LegoWear
}

/**
 * Caché de materiales compartidos. Los bricks de la escena repiten un puñado de
 * combinaciones (color, rugosidad, metal, emisivo, opacidad, desgaste), así que
 * una única instancia de MeshStandardNodeMaterial por firma evita crear
 * cientos de materiales y recompilar sus pipelines en el renderer WebGPU.
 *
 * Los materiales son de nivel de módulo: NO se disponen nunca al desmontar.
 */
const cache = new Map<string, MeshStandardNodeMaterial>()

/** Tamaño de la textura de ruido de rugosidad (potencia de dos: admite mipmaps). */
const ROUGHNESS_NOISE_SIZE = 64
/** Incremento de rugosidad por nivel de desgaste (0.32 → 0.32/0.336/0.352). */
const WEAR_ROUGHNESS_STEP = 0.05

let roughnessNoise: CanvasTexture | null = null

/**
 * Textura de ruido de rugosidad compartida (64x64, `RepeatWrapping`).
 *
 * Es una única instancia para toda la aplicación: se aplica como `roughnessMap`
 * a todos los materiales LEGO, por lo que la microvariación de rugosidad no
 * añade texturas ni materials extra. El PRNG es determinista para que la escena
 * se vea igual en cada sesión y en cada recarga.
 */
export function getLegoRoughnessNoise(): CanvasTexture | null {
  if (roughnessNoise) return roughnessNoise
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = ROUGHNESS_NOISE_SIZE
  canvas.height = ROUGHNESS_NOISE_SIZE
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(ROUGHNESS_NOISE_SIZE, ROUGHNESS_NOISE_SIZE)
  let seed = 0x9e3779b9
  for (let index = 0; index < image.data.length; index += 4) {
    // Ruido en [150, 240] sobre 255: rugosidad multiplicada entre 0.59 y 0.94.
    seed = (seed * 1664525 + 1013904223) >>> 0
    const value = 150 + ((seed >>> 8) % 91)
    image.data[index] = value
    image.data[index + 1] = value
    image.data[index + 2] = value
    image.data[index + 3] = 255
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 2)
  texture.needsUpdate = true
  roughnessNoise = texture
  return texture
}

function hashText(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

/**
 * Nivel de desgaste determinista a partir de un índice o de la firma de un
 * material. Se cuantiza en 3 niveles (0–2) para no multiplicar compilaciones.
 */
export function getLegoWear(seed: number | string): LegoWear {
  const value = typeof seed === 'number' ? Math.abs(Math.trunc(seed)) : hashText(seed)
  return (value % 3) as LegoWear
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getLegoMaterial(options: LegoMaterialOptions = {}): MeshStandardNodeMaterial {
  const color = options.color ?? '#ffffff'
  const baseRoughness = options.roughness ?? 0.32
  const metalness = options.metalness ?? 0
  const emissive = options.emissive ?? '#000000'
  const emissiveIntensity = options.emissiveIntensity ?? 0
  const opacity = options.opacity ?? 1

  const baseKey = `${color}|${baseRoughness}|${metalness}|${emissive}|${emissiveIntensity}|${opacity}`
  const wear = options.wear ?? getLegoWear(baseKey)
  const roughnessNoiseMap = getLegoRoughnessNoise()
  // El desgaste se traduce en un pequeño desplazamiento de rugosidad: preserva
  // la identidad LEGO (mismos colores) y evita el aspecto de plástico uniforme.
  const roughness = clamp(baseRoughness * (1 + wear * WEAR_ROUGHNESS_STEP), 0.05, 0.95)

  // La clave incluye desgaste y presencia de textura, como pide T030.
  const key = `${baseKey}|wear${wear}|noise${roughnessNoiseMap ? 1 : 0}`
  const cached = cache.get(key)
  if (cached) return cached

  const material = new MeshStandardNodeMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    transparent: opacity < 1,
    opacity,
    ...(roughnessNoiseMap ? { roughnessMap: roughnessNoiseMap } : {}),
  })
  cache.set(key, material)
  return material
}
