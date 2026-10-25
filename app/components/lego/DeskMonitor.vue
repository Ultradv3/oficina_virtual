<script setup lang="ts">
import { computed } from 'vue'
import type { CanvasTexture } from 'three/webgpu'
import LegoBox from './LegoBox.vue'

/**
 * Monitor de escritorio parametrizable. El padre decide posición, giro y
 * escala; este componente solo modela el cuerpo, el pie y la pantalla.
 * La textura es compartida por todos los monitores del mismo agente.
 */
const props = withDefaults(
  defineProps<{
    screenTexture?: CanvasTexture | null
    statusColor: string
    vertical?: boolean
    scale?: number
  }>(),
  { vertical: false, scale: 1, screenTexture: null },
)

const bodyY = computed(() => (props.vertical ? 0.73 : 0.46))
const bodySize = computed<[number, number, number]>(() =>
  props.vertical ? [0.82, 1.34, 0.1] : [1.34, 0.8, 0.1],
)
const screenSize = computed<[number, number]>(() =>
  props.vertical ? [0.68, 1.18] : [1.2, 0.66],
)
const ledX = computed(() => (props.vertical ? 0.32 : 0.53))
const screwLeft = computed(() => (props.vertical ? -0.28 : -0.52))
const screwRight = computed(() => (props.vertical ? -0.08 : -0.22))
</script>

<template>
  <TresGroup :scale="scale">
    <LegoBox
      :position="[0, 0.03, 0]"
      :size="[0.7, 0.06, 0.38]"
      :color="'#3a3f47'"
      :radius="0.02"
      cast-shadow
    />
    <LegoBox
      :position="[0, 0.19, -0.02]"
      :size="[0.09, 0.32, 0.09]"
      :color="'#4a5058'"
      :radius="0.02"
      cast-shadow
    />
    <TresGroup :position="[0, bodyY, 0]" :rotation="[-0.05, 0, 0]">
      <LegoBox
        :position="[0, 0, 0]"
        :size="bodySize"
        :color="'#2f3540'"
        :radius="0.04"
        cast-shadow
      />
      <TresMesh
        :position="[0, 0.01, 0.056]"
        :user-data="{ bloomContributor: 'screen' }"
      >
        <TresPlaneGeometry :args="screenSize" />
        <TresMeshStandardNodeMaterial
          :map="screenTexture"
          :emissive="'#ffffff'"
          :emissive-map="screenTexture"
          :emissive-intensity="0.6"
          :roughness="0.55"
          :metalness="0"
          :tone-mapped="false"
        />
      </TresMesh>
      <TresMesh :position="[ledX, -0.3, 0.07]" :user-data="{ bloomContributor: 'led' }">
        <TresBoxGeometry :args="[0.09, 0.035, 0.02]" />
        <TresMeshStandardNodeMaterial
          :color="statusColor"
          :emissive="statusColor"
          :emissive-intensity="1.2"
          :tone-mapped="false"
        />
      </TresMesh>
      <TresMesh :position="[screwLeft, bodyY - 0.02, 0]" :cast-shadow="true">
        <TresCylinderGeometry :args="[0.07, 0.07, 0.05, 16]" />
        <TresMeshStandardNodeMaterial :color="'#c9ced6'" :roughness="0.3" />
      </TresMesh>
      <TresMesh :position="[screwRight, bodyY - 0.02, 0]" :cast-shadow="true">
        <TresCylinderGeometry :args="[0.07, 0.07, 0.05, 16]" />
        <TresMeshStandardNodeMaterial :color="'#c9ced6'" :roughness="0.3" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
