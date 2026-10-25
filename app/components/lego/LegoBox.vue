<script lang="ts">
import { RoundedBoxGeometry } from '~/utils/rounded-box'

// Caché de geometrías a nivel de MÓDULO y no por componente: todos los bricks
// comparten las mismas pocas geometrías (una por radio redondeado) y se crean
// una única vez para toda la vida de la app. Nunca se disponen.
const geometryCache = new Map<number, RoundedBoxGeometry>()

function getBrickGeometry(radius: number): RoundedBoxGeometry {
  const key = Math.round(radius * 100)
  const cached = geometryCache.get(key)
  if (cached) return cached
  const geometry = new RoundedBoxGeometry(1, 1, 1, 3, radius)
  geometryCache.set(key, geometry)
  return geometry
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { getLegoMaterial } from '~/utils/lego-materials'

const props = withDefaults(
  defineProps<{
    size?: [number, number, number]
    color?: string
    radius?: number
    position?: [number, number, number]
    rotation?: [number, number, number]
    roughness?: number
    metalness?: number
    emissive?: string
    emissiveIntensity?: number
    opacity?: number
    castShadow?: boolean
    receiveShadow?: boolean
  }>(),
  {
    size: () => [1, 1, 1],
    color: '#ffffff',
    radius: 0.055,
    position: () => [0, 0, 0],
    rotation: () => [0, 0, 0],
    roughness: 0.32,
    metalness: 0,
    emissive: '#000000',
    emissiveIntensity: 0,
    opacity: 1,
    castShadow: true,
    receiveShadow: true,
  },
)

const geometry = computed(() => getBrickGeometry(props.radius))
// Material compartido por firma visual (color/rugosidad/metal/emisivo/opacidad):
// los bricks reutilizan la misma instancia en lugar de crear una por mesh.
const material = computed(() =>
  getLegoMaterial({
    color: props.color,
    roughness: props.roughness,
    metalness: props.metalness,
    emissive: props.emissive,
    emissiveIntensity: props.emissiveIntensity,
    opacity: props.opacity,
  }),
)
</script>

<template>
  <TresMesh
    :geometry="geometry"
    :material="material"
    :scale="size"
    :position="position"
    :rotation="rotation"
    :cast-shadow="castShadow"
    :receive-shadow="receiveShadow"
  />
</template>
