<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import {
  CanvasTexture,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

const props = withDefaults(
  defineProps<{
    position?: [number, number, number]
    size?: [number, number]
    opacity?: number
  }>(),
  {
    position: () => [0, 0.005, 0],
    size: () => [2, 2],
    opacity: 0.35,
  },
)

type ShadowGlobal = typeof globalThis & { __legoShadow?: CanvasTexture }

function getTexture(): CanvasTexture {
  const globalScope = globalThis as ShadowGlobal
  if (globalScope.__legoShadow) return globalScope.__legoShadow
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 126)
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.28)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
  }
  const created = new CanvasTexture(canvas)
  created.colorSpace = SRGBColorSpace
  globalScope.__legoShadow = created
  return created
}

const geometry = new PlaneGeometry(1, 1)
const material = new MeshBasicMaterial({
  map: getTexture(),
  transparent: true,
  opacity: props.opacity,
  depthWrite: false,
  toneMapped: false,
})
const rotation: [number, number, number] = [-Math.PI / 2, 0, 0]

onBeforeUnmount(() => {
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <TresMesh
    :geometry="geometry"
    :material="material"
    :rotation="rotation"
    :position="position"
    :scale="[size[0], size[1], 1]"
    :render-order="1"
  />
</template>
