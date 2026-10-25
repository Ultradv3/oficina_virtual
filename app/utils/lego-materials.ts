import { MeshStandardNodeMaterial } from 'three/webgpu'

export interface LegoMaterialOptions {
  color?: string
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
}

/**
 * Caché de materiales compartidos. Los bricks de la escena repiten un puñado de
 * combinaciones (color, rugosidad, metal, emisivo, opacidad), así que una única
 * instancia de MeshStandardNodeMaterial por firma evita crear cientos de
 * materiales y recompilar sus pipelines en el renderer WebGPU.
 *
 * Los materiales son de nivel de módulo: NO se disponen nunca al desmontar.
 */
const cache = new Map<string, MeshStandardNodeMaterial>()

export function getLegoMaterial(options: LegoMaterialOptions = {}): MeshStandardNodeMaterial {
  const color = options.color ?? '#ffffff'
  const roughness = options.roughness ?? 0.32
  const metalness = options.metalness ?? 0
  const emissive = options.emissive ?? '#000000'
  const emissiveIntensity = options.emissiveIntensity ?? 0
  const opacity = options.opacity ?? 1

  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}|${opacity}`
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
  })
  cache.set(key, material)
  return material
}
