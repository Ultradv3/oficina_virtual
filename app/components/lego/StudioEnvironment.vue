<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { useTresContext } from '@tresjs/core/webgpu'
import type { Texture } from 'three/webgpu'
import { createStudioEnvironmentTexture } from '~/utils/studio-environment'

const { scene } = useTresContext()
const environment = shallowRef<Texture>()
let previous: Texture | null = null

// El renderer de three (WebGPU o su fallback WebGL2) convierte la textura
// equirect en PMREM de forma perezosa, así que no dependemos de PMREMGenerator
// ni del tipo de renderer. Se aplica una sola vez al montar.
const texture = createStudioEnvironmentTexture()
previous = scene.value.environment as Texture | null
scene.value.environment = texture
scene.value.environmentIntensity = 0.2
environment.value = texture

onBeforeUnmount(() => {
  scene.value.environment = previous
  environment.value?.dispose()
  environment.value = undefined
  previous = null
})
</script>

<template>
  <slot />
</template>
