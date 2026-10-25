<script setup lang="ts">
import { LEGO } from '~/utils/lego'

withDefaults(
  defineProps<{
    scale?: number
    flower?: string
    position?: [number, number, number]
  }>(),
  {
    scale: 1,
    flower: LEGO.yellow,
    position: () => [0, 0, 0],
  },
)
</script>

<template>
  <TresGroup :scale="scale" :position="position">
    <TresMesh :position="[0, 0.22, 0]" :cast-shadow="true">
      <TresCylinderGeometry :args="[0.33, 0.27, 0.44, 18]" />
      <TresMeshStandardNodeMaterial :color="LEGO.wood" :roughness="0.5" />
    </TresMesh>
    <TresMesh :position="[0, 0.44, 0]" :cast-shadow="true">
      <TresCylinderGeometry :args="[0.35, 0.35, 0.06, 18]" />
      <TresMeshStandardNodeMaterial :color="LEGO.woodDark" :roughness="0.45" />
    </TresMesh>
    <TresMesh :position="[0, 0.68, 0]" :cast-shadow="true">
      <TresCylinderGeometry :args="[0.055, 0.06, 0.55, 10]" />
      <TresMeshStandardNodeMaterial color="#3f6b47" :roughness="0.55" />
    </TresMesh>

    <TresMesh :position="[0.2, 1.02, 0.04]" :rotation="[0.2, 0.4, -0.32]" :scale="[1, 0.45, 1]" :cast-shadow="true">
      <TresSphereGeometry :args="[0.3, 16, 12]" />
      <TresMeshStandardNodeMaterial :color="LEGO.green" :roughness="0.42" />
    </TresMesh>
    <TresMesh :position="[-0.2, 1.12, -0.05]" :rotation="[0.4, -0.2, 0.28]" :scale="[1, 0.45, 1]" :cast-shadow="true">
      <TresSphereGeometry :args="[0.26, 16, 12]" />
      <TresMeshStandardNodeMaterial :color="LEGO.lime" :roughness="0.42" />
    </TresMesh>
    <TresMesh :position="[0.02, 1.3, 0.02]" :rotation="[0, 0.5, 0]" :scale="[1, 0.45, 1]" :cast-shadow="true">
      <TresSphereGeometry :args="[0.22, 16, 12]" />
      <TresMeshStandardNodeMaterial :color="LEGO.green" :roughness="0.42" />
    </TresMesh>

    <TresMesh :position="[0.06, 1.5, 0.03]" :cast-shadow="true">
      <TresCylinderGeometry :args="[0.1, 0.08, 0.1, 12]" />
      <TresMeshStandardNodeMaterial :color="flower" :roughness="0.4" />
    </TresMesh>
    <TresMesh :position="[0.06, 1.56, 0.03]" :cast-shadow="true">
      <TresCylinderGeometry :args="[0.04, 0.04, 0.04, 10]" />
      <TresMeshStandardNodeMaterial :color="LEGO.white" :roughness="0.4" />
    </TresMesh>
  </TresGroup>
</template>
