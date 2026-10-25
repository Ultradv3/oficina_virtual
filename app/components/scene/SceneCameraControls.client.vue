<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos/webgpu'
import { useTresContext } from '@tresjs/core/webgpu'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SCENE_ENTRANCE, SCENE_ZOOM_RANGE } from '~/utils/scene-framing'

/**
 * Controles de cámara de la escena. Vive dentro de `<TresCanvas>` para poder
 * acceder al contexto de Tres y reiniciar la cámara junto con OrbitControls.
 */
const { camera } = useTresContext()
const orbitRef = ref<{ instance?: unknown }>()

const DEFAULT_POSITION: [number, number, number] = [14, 14, 14]
const DEFAULT_TARGET: [number, number, number] = [0, 1, 0]

function resolveOrbit(): {
  reset?: () => void
  saveState?: () => void
  target?: { set: (x: number, y: number, z: number) => void }
  update?: () => void
  enableDamping?: boolean
} | null {
  const exposed = orbitRef.value?.instance as
    | { value?: unknown }
    | { reset?: () => void }
    | undefined
  if (!exposed) return null
  const candidate = 'value' in exposed ? exposed.value : exposed
  return candidate as
    | {
        reset?: () => void
        saveState?: () => void
        target?: { set: (x: number, y: number, z: number) => void }
        update?: () => void
        enableDamping?: boolean
      }
    | null
}

function reset() {
  const cam = camera.activeCamera.value
  const orbit = resolveOrbit()
  if (!cam) return

  if (!orbit) {
    cam.position.set(...DEFAULT_POSITION)
    if ('zoom' in cam) {
      cam.zoom = SCENE_ENTRANCE.toZoom
      cam.updateProjectionMatrix()
    }
    cam.lookAt(...DEFAULT_TARGET)
    return
  }

  // Un update sin damping consume y limpia el delta residual del arrastre.
  const previousDamping = orbit.enableDamping
  orbit.enableDamping = false
  orbit.update?.()

  cam.position.set(...DEFAULT_POSITION)
  if ('zoom' in cam) {
    cam.zoom = SCENE_ENTRANCE.toZoom
    cam.updateProjectionMatrix()
  }
  orbit.target?.set(...DEFAULT_TARGET)
  orbit.update?.()
  orbit.saveState?.()
  orbit.enableDamping = previousDamping
}

function onResetRequest() {
  reset()
}

onMounted(() => {
  window.addEventListener('agent-office:reset-camera', onResetRequest)
})

onBeforeUnmount(() => {
  window.removeEventListener('agent-office:reset-camera', onResetRequest)
})

defineExpose({ reset })
</script>

<template>
  <OrbitControls
    ref="orbitRef"
    :target="DEFAULT_TARGET"
    :enable-rotate="true"
    :enable-pan="true"
    :enable-zoom="true"
    :enable-damping="true"
    :damping-factor="0.08"
    :min-zoom="SCENE_ZOOM_RANGE.min"
    :max-zoom="SCENE_ZOOM_RANGE.max"
    :min-polar-angle="0.16"
    :max-polar-angle="1.45"
  />
</template>
