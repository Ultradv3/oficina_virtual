<script setup lang="ts">
import { computed } from 'vue'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

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

const cache = new Map<number, RoundedBoxGeometry>()

function geometryFor(radius: number): RoundedBoxGeometry {
  const key = Math.round(radius * 100)
  const existing = cache.get(key)
  if (existing) return existing
  const geometry = new RoundedBoxGeometry(1, 1, 1, 3, radius)
  cache.set(key, geometry)
  return geometry
}

const geometry = computed(() => geometryFor(props.radius))
</script>

<template>
  <TresMesh
    :geometry="geometry"
    :scale="size"
    :position="position"
    :rotation="rotation"
    :cast-shadow="castShadow"
    :receive-shadow="receiveShadow"
  >
    <TresMeshStandardMaterial
      :color="color"
      :roughness="roughness"
      :metalness="metalness"
      :emissive="emissive"
      :emissive-intensity="emissiveIntensity"
      :transparent="opacity < 1"
      :opacity="opacity"
    />
  </TresMesh>
</template>
