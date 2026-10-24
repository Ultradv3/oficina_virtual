<script setup lang="ts">
import { onBeforeUnmount, ref, toRaw } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import { PMREMGenerator, WebGLRenderer, type Texture } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const { scene, renderer } = useTresContext()
const applied = ref(false)
let environment: Texture | null = null

const { onRender } = useLoop()

onRender(() => {
  if (applied.value) return
  const maybeRef = renderer as unknown as { value?: WebGLRenderer; instance?: WebGLRenderer }
  const gl = toRaw(maybeRef?.instance ?? maybeRef?.value ?? renderer)
  if (!(gl instanceof WebGLRenderer)) return
  const generator = new PMREMGenerator(gl)
  const room = new RoomEnvironment()
  environment = generator.fromScene(room, 0.04).texture
  scene.value.environment = environment
  scene.value.environmentIntensity = 0.2
  room.dispose()
  generator.dispose()
  applied.value = true
})

onBeforeUnmount(() => {
  scene.value.environment = null
  environment?.dispose()
  environment = null
})
</script>

<template>
  <slot />
</template>
