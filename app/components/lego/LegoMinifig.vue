<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { MathUtils, type Group } from 'three/webgpu'
import { useLoop } from '@tresjs/core'
import type { AgentStatus } from '~/types/office'
import { LEGO, minifigHair, minifigTorso, minifigVariant } from '~/utils/lego'

const props = defineProps<{
  name: string
  status: AgentStatus
  phase?: number
}>()

const torsoColor = minifigTorso(props.name)
const hairColor = minifigHair(props.name)
const variant = minifigVariant(props.name)
const pantsColor = '#2b3644'

const root = shallowRef<Group>()
const armLeft = shallowRef<Group>()
const armRight = shallowRef<Group>()
const head = shallowRef<Group>()
const chest = shallowRef<Group>()
const phase = ref(props.phase ?? 0)

const { onRender } = useLoop()

onMounted(() => {
  phase.value = props.phase ?? Math.random() * 10
})

onRender(({ elapsed }) => {
  const time = elapsed + phase.value
  const status = props.status

  if (root.value) {
    const breath = Math.sin(time * 1.5) * 0.004
    const workBob = status === 'working' ? Math.sin(time * 3.1) * 0.008 : 0
    root.value.position.y = breath + workBob
  }

  if (armLeft.value && armRight.value) {
    const typingLeft = status === 'working' ? Math.sin(time * 7.2) * 0.1 : 0
    const typingRight = status === 'working' ? Math.sin(time * 7.2 + Math.PI) * 0.1 : 0
    const leftTarget = -0.9 + typingLeft
    const rightTarget = status === 'waiting_approval' ? -2.45 : -0.9 + typingRight
    armLeft.value.rotation.x = MathUtils.lerp(armLeft.value.rotation.x, leftTarget, 0.12)
    armRight.value.rotation.x = MathUtils.lerp(armRight.value.rotation.x, rightTarget, 0.08)
  }

  if (head.value) {
    const tilt =
      status === 'error' ? 0.32 : status === 'waiting_approval' ? -0.12 : Math.sin(time * 0.9) * 0.03
    const turn =
      status === 'waiting_approval'
        ? Math.sin(time * 1.2) * 0.18
        : Math.sin(time * 0.7 + 1) * 0.05
    head.value.rotation.x = MathUtils.lerp(head.value.rotation.x, tilt, 0.08)
    head.value.rotation.y = MathUtils.lerp(head.value.rotation.y, turn, 0.08)
  }

  if (chest.value) {
    chest.value.rotation.x = MathUtils.lerp(
      chest.value.rotation.x,
      status === 'error' ? 0.08 : 0,
      0.06,
    )
  }
})
</script>

<template>
  <TresGroup ref="root" :position="[0, 0, 0]">
    <LegoBox :position="[0, 0.54, 0]" :size="[0.42, 0.16, 0.3]" :color="pantsColor" />

    <TresGroup v-for="side in [-1, 1]" :key="`leg-${side}`">
      <LegoBox
        :position="[side * 0.11, 0.48, 0.17]"
        :size="[0.17, 0.16, 0.44]"
        :color="pantsColor"
      />
      <LegoBox
        :position="[side * 0.11, 0.27, 0.36]"
        :size="[0.17, 0.3, 0.17]"
        :color="pantsColor"
      />
      <LegoBox
        :position="[side * 0.11, 0.07, 0.44]"
        :size="[0.18, 0.12, 0.28]"
        :color="LEGO.charcoal"
      />
    </TresGroup>

    <TresGroup ref="chest">
      <LegoBox :position="[0, 0.78, 0]" :size="[0.4, 0.36, 0.28]" :color="torsoColor" />
      <LegoBox :position="[0, 1, 0]" :size="[0.5, 0.24, 0.3]" :color="torsoColor" />
      <LegoBox
        :position="[0, 0.98, 0.16]"
        :size="[0.13, 0.1, 0.02]"
        :color="LEGO.white"
        :emissive="LEGO.white"
        :emissive-intensity="0.08"
      />
      <LegoBox :position="[0, 0.98, 0.175]" :size="[0.05, 0.05, 0.01]" :color="LEGO.yellow" />
      <LegoBox
        :position="[0, 0.84, 0.15]"
        :size="[0.11, 0.24, 0.02]"
        :color="LEGO.navy"
      />

      <TresGroup ref="armLeft" :position="[-0.295, 1.02, 0]" :rotation="[-0.9, 0, 0]">
        <LegoBox
          :position="[0, -0.15, 0]"
          :size="[0.13, 0.32, 0.14]"
          :color="torsoColor"
        />
        <TresMesh :position="[0, -0.33, 0]" :cast-shadow="true">
          <TresSphereGeometry :args="[0.075, 16, 12]" />
          <TresMeshStandardNodeMaterial :color="LEGO.skin" :roughness="0.32" />
        </TresMesh>
      </TresGroup>
      <TresGroup ref="armRight" :position="[0.295, 1.02, 0]" :rotation="[-0.9, 0, 0]">
        <LegoBox
          :position="[0, -0.15, 0]"
          :size="[0.13, 0.32, 0.14]"
          :color="torsoColor"
        />
        <TresMesh :position="[0, -0.33, 0]" :cast-shadow="true">
          <TresSphereGeometry :args="[0.075, 16, 12]" />
          <TresMeshStandardNodeMaterial :color="LEGO.skin" :roughness="0.32" />
        </TresMesh>
      </TresGroup>

      <TresGroup ref="head" :position="[0, 1.16, 0]">
        <TresMesh :position="[0, 0.16, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.2, 0.2, 0.28, 24]" />
          <TresMeshStandardNodeMaterial :color="LEGO.skin" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[0, 0.33, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.1, 0.1, 0.055, 18]" />
          <TresMeshStandardNodeMaterial :color="LEGO.skin" :roughness="0.3" />
        </TresMesh>

        <TresMesh :position="[0.075, 0.17, 0.192]" :scale="[1, 1, 0.45]">
          <TresSphereGeometry :args="[0.034, 14, 10]" />
          <TresMeshStandardNodeMaterial color="#151515" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[-0.075, 0.17, 0.192]" :scale="[1, 1, 0.45]">
          <TresSphereGeometry :args="[0.034, 14, 10]" />
          <TresMeshStandardNodeMaterial color="#151515" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[0, 0.07, 0.195]">
          <TresBoxGeometry :args="[0.11, 0.022, 0.012]" />
          <TresMeshStandardNodeMaterial color="#151515" :roughness="0.4" />
        </TresMesh>

        <template v-if="variant === 0">
          <TresMesh :position="[0, 0.3, 0]" :cast-shadow="false">
            <TresCylinderGeometry :args="[0.27, 0.27, 0.045, 24]" />
            <TresMeshStandardNodeMaterial :color="LEGO.yellow" :roughness="0.3" />
          </TresMesh>
          <TresMesh :position="[0, 0.31, 0]" :scale="[1, 0.75, 1]" :cast-shadow="false">
            <TresSphereGeometry :args="[0.225, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]" />
            <TresMeshStandardNodeMaterial :color="LEGO.yellow" :roughness="0.3" />
          </TresMesh>
        </template>

        <template v-else-if="variant === 3">
          <TresMesh :position="[0, 0.29, 0.02]" :cast-shadow="false">
            <TresCylinderGeometry :args="[0.26, 0.26, 0.045, 24]" />
            <TresMeshStandardNodeMaterial :color="LEGO.navy" :roughness="0.35" />
          </TresMesh>
          <TresMesh :position="[0, 0.3, 0]" :scale="[1, 0.85, 1]" :cast-shadow="false">
            <TresSphereGeometry :args="[0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]" />
            <TresMeshStandardNodeMaterial :color="LEGO.navy" :roughness="0.35" />
          </TresMesh>
        </template>

        <template v-else>
          <TresMesh :position="[0, 0.215, -0.01]" :scale="[1.03, 0.9, 1.03]" :cast-shadow="false">
            <TresSphereGeometry :args="[0.215, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.6]" />
            <TresMeshStandardNodeMaterial :color="hairColor" :roughness="0.45" />
          </TresMesh>
          <LegoBox
            :position="[0, 0.17, -0.13]"
            :size="[0.38, 0.22, 0.12]"
            :color="hairColor"
            :radius="0.04"
            :cast-shadow="false"
          />
        </template>

        <template v-if="variant === 1 || variant === 3">
          <TresMesh :position="[0, 0.19, 0]" :rotation="[0, 0, 0]">
            <TresTorusGeometry :args="[0.225, 0.018, 8, 24, Math.PI]" />
            <TresMeshStandardNodeMaterial color="#232a33" :roughness="0.45" />
          </TresMesh>
          <TresMesh :position="[0.222, 0.16, 0]" :rotation="[0, 0, Math.PI / 2]">
            <TresCylinderGeometry :args="[0.058, 0.058, 0.05, 16]" />
            <TresMeshStandardNodeMaterial color="#232a33" :roughness="0.45" />
          </TresMesh>
          <TresMesh :position="[-0.222, 0.16, 0]" :rotation="[0, 0, Math.PI / 2]">
            <TresCylinderGeometry :args="[0.058, 0.058, 0.05, 16]" />
            <TresMeshStandardNodeMaterial color="#232a33" :roughness="0.45" />
          </TresMesh>
          <TresMesh :position="[-0.2, 0.09, 0.12]" :rotation="[0.3, 0, 0.5]">
            <TresCapsuleGeometry :args="[0.012, 0.12, 4, 8]" />
            <TresMeshStandardNodeMaterial color="#232a33" :roughness="0.45" />
          </TresMesh>
        </template>

      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
