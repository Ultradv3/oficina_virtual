<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos/webgpu'
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  PCFShadowMap,
  SRGBColorSpace,
  type DirectionalLight,
} from 'three/webgpu'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { OfficeAgent } from '~/types/office'
import { LEGO } from '~/utils/lego'
import LegoBox from './lego/LegoBox.vue'
import LegoPlant from './lego/LegoPlant.vue'
import LegoShadow from './lego/LegoShadow.vue'
import LegoStuds from './lego/LegoStuds.vue'
import StudioEnvironment from './lego/StudioEnvironment.vue'

const props = defineProps<{
  agents: OfficeAgent[]
  selectedId: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()

const host = ref<HTMLElement>()
const keyLight = shallowRef<DirectionalLight>()
const signTexture = shallowRef<CanvasTexture>()
const baseSignTexture = shallowRef<CanvasTexture>()
const groundShadow = shallowRef<CanvasTexture>()
const size = ref({ width: 1280, height: 800 })
let observer: ResizeObserver | null = null

function measure() {
  if (!host.value) return
  const rect = host.value.getBoundingClientRect()
  size.value = { width: Math.max(320, rect.width), height: Math.max(320, rect.height) }
}

function configureKeyLight(light: DirectionalLight) {
  light.castShadow = true
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.camera.left = -13
  light.shadow.camera.right = 13
  light.shadow.camera.top = 12
  light.shadow.camera.bottom = -12
  light.shadow.camera.near = 1
  light.shadow.camera.far = 40
  light.shadow.bias = -0.00035
  light.shadow.normalBias = 0.028
  light.shadow.radius = 3
  light.shadow.camera.updateProjectionMatrix()
  // La escena es estática salvo los minifigs: el shadow map se calcula una vez
  // y no se vuelve a renderizar en cada frame.
  light.shadow.autoUpdate = false
  light.shadow.needsUpdate = true
}

watch(
  keyLight,
  (light) => {
    if (light) configureKeyLight(light)
  },
  { immediate: true },
)

onMounted(() => {
  measure()
  if (host.value) {
    observer = new ResizeObserver(measure)
    observer.observe(host.value)
  }

  if (keyLight.value) configureKeyLight(keyLight.value)

  signTexture.value = makePlateTexture('AGENT OFFICE', 'OPS FLOOR · 01', 1024, 280, true)
  baseSignTexture.value = makePlateTexture('AGENT OFFICE', 'SUPERVISIÓN DE AGENTES', 1024, 220, false)
  groundShadow.value = makeGroundShadow()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  signTexture.value?.dispose()
  baseSignTexture.value?.dispose()
  groundShadow.value?.dispose()
})

function makeGroundShadow(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(256, 256, 40, 256, 256, 250)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)')
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 512, 512)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function makePlateTexture(
  title: string,
  subtitle: string,
  width: number,
  height: number,
  bordered: boolean,
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#1a2c45'
    context.fillRect(0, 0, width, height)
    if (bordered) {
      context.strokeStyle = '#d9b98a'
      context.lineWidth = 10
      context.strokeRect(22, 22, width - 44, height - 44)
      const studs: Array<[number, number]> = [
        [44, 44],
        [width - 44, 44],
        [44, height - 44],
        [width - 44, height - 44],
      ]
      for (const [x, y] of studs) {
        context.beginPath()
        context.arc(x, y, 8, 0, Math.PI * 2)
        context.fillStyle = '#c7ccd4'
        context.fill()
      }
    }
    context.textAlign = 'center'
    context.fillStyle = '#f2cd37'
    context.font = `800 ${Math.round(height * 0.33)}px Inter, Segoe UI, sans-serif`
    context.fillText(title, width / 2, height * 0.52)
    context.fillStyle = '#c9d6e5'
    context.font = `600 ${Math.round(height * 0.12)}px Inter, Segoe UI, sans-serif`
    context.fillText(subtitle, width / 2, height * 0.72)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const cols = computed(() => (props.agents.length <= 2 ? Math.max(props.agents.length, 1) : 3))
const rows = computed(() => Math.max(1, Math.ceil(props.agents.length / cols.value)))
const aspect = computed(() => size.value.width / size.value.height)

const halfHeight = computed(() => {
  const neededHeight = (rows.value * 4.3 + 6.2) / 2
  const frameWidth = aspect.value < 0.9 ? 9.4 : 12.25
  return Math.max(8.2, neededHeight, frameWidth / aspect.value)
})
const halfWidth = computed(() => halfHeight.value * aspect.value)

const deskPositions = computed<Array<[number, number, number]>>(() =>
  props.agents.map((_, index) => {
    const col = index % cols.value
    const row = Math.floor(index / cols.value)
    return [
      (col - (cols.value - 1) / 2) * 4.9,
      0.03,
      (row - (rows.value - 1) / 2) * 4.4 + 0.2,
    ] as [number, number, number]
  }),
)

const floorTiles = (() => {
  const tiles: Array<{ x: number; z: number; color: string }> = []
  const columns = 6
  const rowsCount = 4
  const width = 2.55
  const depth = 2.42
  const gap = 0.055
  for (let row = 0; row < rowsCount; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      tiles.push({
        x: (column - (columns - 1) / 2) * (width + gap),
        z: (row - (rowsCount - 1) / 2) * (depth + gap),
        color: (row + column) % 2 === 0 ? LEGO.floor : LEGO.floorAlt,
      })
    }
  }
  return tiles
})()

const studPositions = (() => {
  const positions: Array<[number, number, number]> = []
  const step = 0.55
  for (let x = -8.65; x <= 8.65; x += step) {
    for (let z = -5.8; z <= 5.8; z += step) {
      if (Math.abs(x) < 7.95 && Math.abs(z) < 5.1) continue
      positions.push([x, -0.055, z])
    }
  }
  return positions
})()

const stools: Array<[number, number]> = [
  [-1.35, 0.25],
  [1.3, -0.35],
]
const rackLights = [0, 1, 2, 3, 4, 5]
const mosaicColors = [
  LEGO.yellow,
  LEGO.red,
  LEGO.azure,
  LEGO.green,
  LEGO.orange,
  LEGO.white,
  LEGO.azure,
  LEGO.yellow,
  LEGO.white,
  LEGO.red,
  LEGO.lime,
  LEGO.orange,
  LEGO.white,
  LEGO.green,
  LEGO.yellow,
  LEGO.azure,
  LEGO.orange,
  LEGO.red,
]
</script>

<template>
  <div ref="host" class="office-scene">
    <TresCanvas
      :alpha="true"
      :clear-alpha="0"
      :dpr="[1, 1.75]"
      :shadows="true"
      :shadow-map-type="PCFShadowMap"
      :tone-mapping="ACESFilmicToneMapping"
      :tone-mapping-exposure="1.04"
      power-preference="high-performance"
      antialias
    >
      <TresOrthographicCamera
        :left="-halfWidth"
        :right="halfWidth"
        :top="halfHeight"
        :bottom="-halfHeight"
        :position="[14, 14, 14]"
        :near="-100"
        :far="200"
      />
      <OrbitControls
        :enable-rotate="false"
        :enable-pan="true"
        :enable-zoom="true"
        :enable-damping="true"
        :damping-factor="0.08"
        :min-zoom="0.8"
        :max-zoom="2.3"
        :target="[0, 1, 0]"
      />

      <StudioEnvironment />

      <TresAmbientLight :intensity="0.05" />
      <TresHemisphereLight :args="['#cfe3ff', '#4a3b2c', 0.12]" />
      <TresDirectionalLight
        ref="keyLight"
        :position="[-4, 7, -3]"
        :intensity="3.8"
        color="#fff1d8"
        :cast-shadow="true"
      />
      <TresDirectionalLight :position="[3, 5, 10]" :intensity="0.95" color="#ffe8cf" />
      <TresDirectionalLight :position="[8, 6, -8]" :intensity="1" color="#9cc4ff" />

      <!-- Diorama base -->
      <LegoBox :position="[0, -0.46, 0]" :size="[18.9, 0.24, 13.2]" :color="LEGO.baseEdge" :radius="0.08" />
      <LegoBox :position="[0, -0.27, 0]" :size="[18.4, 0.42, 12.7]" :color="LEGO.base" :radius="0.1" />
      <LegoBox :position="[0, -0.075, 0]" :size="[18, 0.05, 12.3]" :color="LEGO.floorEdge" :radius="0.02" />
      <LegoBox :position="[0, -0.085, 0]" :size="[18, 0.04, 12.3]" :color="LEGO.base" :radius="0.02" />

      <TresMesh :rotation="[-Math.PI / 2, 0, 0]" :position="[0, -0.61, 0]" :render-order="-1">
        <TresPlaneGeometry :args="[25, 18]" />
        <TresMeshBasicNodeMaterial
          :map="groundShadow"
          :transparent="true"
          :opacity="0.85"
          :depth-write="false"
          :tone-mapped="false"
        />
      </TresMesh>

      <LegoStuds :positions="studPositions" color="#d8d0c0" :radius="0.14" :height="0.11" />

      <!-- Floor plates -->
      <LegoBox
        v-for="(tile, index) in floorTiles"
        :key="`tile-${index}`"
        :position="[tile.x, -0.03, tile.z]"
        :size="[2.55, 0.06, 2.42]"
        :color="tile.color"
        :radius="0.02"
        :cast-shadow="false"
      />

      <!-- Rug -->
      <LegoBox :position="[0, 0.015, 0.15]" :size="[9.4, 0.03, 5.2]" :color="LEGO.tan" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[0, 0.032, 0.15]" :size="[8.98, 0.02, 4.78]" :color="'#2b4d6d'" :radius="0.02" :cast-shadow="false" />

      <!-- Base nameplate -->
      <LegoBox :position="[0, -0.32, 6.33]" :size="[7.2, 0.54, 0.1]" :color="LEGO.charcoal" :radius="0.03" />
      <TresMesh :position="[0, -0.32, 6.385]">
        <TresPlaneGeometry :args="[6.9, 0.44]" />
        <TresMeshBasicNodeMaterial :map="baseSignTexture" :tone-mapped="false" />
      </TresMesh>

      <!-- Back wall -->
      <LegoBox :position="[0, 1.6, -5.95]" :size="[17.6, 3.2, 0.34]" :color="LEGO.warmWhite" :radius="0.04" :cast-shadow="false" />
      <LegoBox :position="[0, 0.14, -5.92]" :size="[17.6, 0.28, 0.42]" :color="LEGO.navy" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[0, 3.22, -5.95]" :size="[17.75, 0.16, 0.48]" :color="LEGO.navy" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[0, 0.98, -5.76]" :size="[17.6, 0.025, 0.36]" color="#d4ccbd" :radius="0.01" :cast-shadow="false" />
      <LegoBox :position="[0, 2.02, -5.76]" :size="[17.6, 0.025, 0.36]" color="#d4ccbd" :radius="0.01" :cast-shadow="false" />
      <LegoBox
        v-for="y in [0.38, 0.68, 1.3, 1.62, 2.34, 2.68]"
        :key="`seam-back-${y}`"
        :position="[0, y, -5.765]"
        :size="[17.6, 0.012, 0.35]"
        color="#d8cfbd"
        :radius="0.008"
        :cast-shadow="false"
      />
      <LegoBox
        v-for="x in [-7.2, -3.6, 0, 3.6, 7.2]"
        :key="`pilaster-${x}`"
        :position="[x, 1.6, -5.74]"
        :size="[0.11, 3.2, 0.38]"
        :color="LEGO.cream"
        :radius="0.02"
        :cast-shadow="false"
      />

      <!-- Window -->
      <TresGroup :position="[-1.3, 1.9, -5.72]">
        <LegoBox :position="[0, 0, -0.04]" :size="[4.5, 2.02, 0.06]" color="#bfe6f5" :radius="0.02" :emissive="'#bfe6f5'" :emissive-intensity="0.45" :cast-shadow="false" />
        <LegoBox :position="[0, 1.02, 0]" :size="[4.7, 0.14, 0.22]" :color="LEGO.white" :radius="0.02" />
        <LegoBox :position="[0, -1.02, 0]" :size="[4.7, 0.14, 0.22]" :color="LEGO.white" :radius="0.02" />
        <LegoBox :position="[-2.28, 0, 0]" :size="[0.14, 2.1, 0.22]" :color="LEGO.white" :radius="0.02" />
        <LegoBox :position="[2.28, 0, 0]" :size="[0.14, 2.1, 0.22]" :color="LEGO.white" :radius="0.02" />
        <LegoBox :position="[0, 0, 0.05]" :size="[0.08, 1.9, 0.08]" :color="LEGO.white" :radius="0.01" />
        <LegoBox :position="[0, 0.1, 0.05]" :size="[4.4, 0.07, 0.08]" :color="LEGO.white" :radius="0.01" />
        <LegoBox :position="[0, -1.13, 0.14]" :size="[4.95, 0.15, 0.46]" :color="LEGO.white" :radius="0.03" />
      </TresGroup>

      <!-- Wall sign -->
      <TresGroup :position="[5.1, 2.3, -5.74]">
        <LegoBox :position="[0, 0, 0]" :size="[4.5, 1.26, 0.12]" :color="LEGO.tan" :radius="0.03" />
        <LegoBox :position="[0, 0, 0.07]" :size="[4.2, 1.02, 0.1]" :color="LEGO.navy" :radius="0.02" />
        <TresMesh :position="[0, 0, 0.13]">
          <TresPlaneGeometry :args="[3.95, 0.86]" />
          <TresMeshBasicNodeMaterial :map="signTexture" :tone-mapped="false" />
        </TresMesh>
      </TresGroup>

      <!-- Mosaic art -->
      <TresGroup :position="[-5.6, 2.15, -5.76]">
        <LegoBox :position="[0, 0, 0]" :size="[3.5, 1.66, 0.09]" :color="LEGO.charcoal" :radius="0.03" />
        <TresMesh
          v-for="(tone, index) in mosaicColors"
          :key="`mosaic-${index}`"
          :position="[
            (index % 6) * 0.46 - 1.15,
            Math.floor(index / 6) * 0.44 - 0.44,
            0.06,
          ]"
        >
          <TresBoxGeometry :args="[0.38, 0.36, 0.04]" />
          <TresMeshStandardNodeMaterial :color="tone" :roughness="0.28" />
        </TresMesh>
      </TresGroup>

      <!-- Left wall -->
      <LegoBox :position="[-8.95, 1.6, -0.35]" :size="[0.34, 3.2, 10.9]" :color="LEGO.warmWhite" :radius="0.04" :cast-shadow="false" />
      <LegoBox :position="[-8.92, 0.14, -0.35]" :size="[0.42, 0.28, 10.9]" :color="LEGO.navy" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[-8.95, 3.22, -0.35]" :size="[0.48, 0.16, 11.05]" :color="LEGO.navy" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[-8.76, 0.98, -0.35]" :size="[0.06, 0.025, 10.9]" color="#d4ccbd" :radius="0.01" :cast-shadow="false" />
      <LegoBox :position="[-8.76, 2.02, -0.35]" :size="[0.06, 0.025, 10.9]" color="#d4ccbd" :radius="0.01" :cast-shadow="false" />
      <LegoBox
        v-for="y in [0.38, 0.68, 1.3, 1.62, 2.34, 2.68]"
        :key="`seam-left-${y}`"
        :position="[-8.765, y, -0.35]"
        :size="[0.058, 0.012, 10.9]"
        color="#d8cfbd"
        :radius="0.008"
        :cast-shadow="false"
      />

      <!-- Whiteboard -->
      <TresGroup :position="[-8.72, 1.75, 0.9]" :rotation="[0, Math.PI / 2, 0]">
        <LegoBox :position="[0, 0, 0]" :size="[3.6, 2.1, 0.1]" :color="LEGO.white" :radius="0.03" />
        <LegoBox :position="[0, 1.08, 0.03]" :size="[3.7, 0.1, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[0, -1.08, 0.03]" :size="[3.7, 0.1, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[-1.78, 0, 0.03]" :size="[0.1, 2.2, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[1.78, 0, 0.03]" :size="[0.1, 2.2, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[-0.9, 0.45, 0.06]" :size="[0.5, 0.36, 0.02]" :color="LEGO.yellow" :radius="0.01" />
        <LegoBox :position="[-0.25, 0.1, 0.06]" :size="[0.5, 0.36, 0.02]" :color="LEGO.cyan" :radius="0.01" />
        <LegoBox :position="[0.8, 0.5, 0.06]" :size="[0.5, 0.36, 0.02]" :color="LEGO.orange" :radius="0.01" />
        <LegoBox :position="[-0.2, -0.5, 0.06]" :size="[0.44, 0.44, 0.02]" :color="LEGO.green" :radius="0.01" />
        <LegoBox :position="[0, -1.15, 0.14]" :size="[3.2, 0.08, 0.2]" :color="LEGO.lightGray" :radius="0.02" />
      </TresGroup>

      <!-- Door -->
      <TresGroup :position="[-8.76, 1.1, -3.5]">
        <LegoBox :position="[0, 0, 0]" :size="[0.16, 2.3, 1.6]" :color="LEGO.white" :radius="0.03" />
        <LegoBox :position="[0.06, 0, 0]" :size="[0.12, 2.1, 1.4]" :color="LEGO.blue" :radius="0.02" />
        <TresMesh :position="[0.14, 0, 0.48]">
          <TresSphereGeometry :args="[0.06, 12, 10]" />
          <TresMeshStandardNodeMaterial :color="LEGO.gold" :roughness="0.25" :metalness="0.4" />
        </TresMesh>
      </TresGroup>

      <!-- Lounge -->
      <TresGroup :position="[-6.1, 0, 2.5]" :rotation="[0, Math.PI / 2, 0]">
        <LegoBox :position="[0, 0.28, 0]" :size="[2.7, 0.36, 1.15]" :color="LEGO.azure" :radius="0.04" />
        <LegoBox :position="[0, 0.68, -0.44]" :size="[2.7, 0.78, 0.26]" :color="LEGO.azure" :radius="0.04" />
        <LegoBox :position="[1.22, 0.55, 0]" :size="[0.28, 0.52, 1.2]" :color="LEGO.navy" :radius="0.03" />
        <LegoBox :position="[-1.22, 0.55, 0]" :size="[0.28, 0.52, 1.2]" :color="LEGO.navy" :radius="0.03" />
        <LegoBox :position="[-0.6, 0.5, 0.04]" :size="[1.14, 0.18, 0.86]" :color="LEGO.warmWhite" :radius="0.04" />
        <LegoBox :position="[0.6, 0.5, 0.04]" :size="[1.14, 0.18, 0.86]" :color="LEGO.warmWhite" :radius="0.04" />
        <LegoBox :position="[-0.82, 0.72, -0.22]" :size="[0.46, 0.44, 0.16]" :color="LEGO.yellow" :radius="0.03" :rotation="[0.2, 0.2, 0.15]" />
        <LegoBox :position="[0.82, 0.7, -0.22]" :size="[0.42, 0.4, 0.16]" :color="LEGO.red" :radius="0.03" :rotation="[0.15, -0.2, -0.12]" />
        <template v-for="x in [-1.15, 1.15]" :key="`sofa-foot-${x}`">
          <LegoBox :position="[x, 0.06, 0.4]" :size="[0.22, 0.12, 0.22]" :color="LEGO.charcoal" :radius="0.02" />
          <LegoBox :position="[x, 0.06, -0.4]" :size="[0.22, 0.12, 0.22]" :color="LEGO.charcoal" :radius="0.02" />
        </template>
      </TresGroup>

      <TresGroup :position="[-4.2, 0, 2.5]">
        <LegoBox :position="[0, 0.42, 0]" :size="[1.2, 0.1, 0.8]" :color="LEGO.wood" :radius="0.04" />
        <template v-for="x in [-0.5, 0.5]" :key="`table-leg-${x}`">
          <LegoBox :position="[x, 0.2, 0.3]" :size="[0.1, 0.4, 0.1]" :color="LEGO.woodDark" :radius="0.02" />
          <LegoBox :position="[x, 0.2, -0.3]" :size="[0.1, 0.4, 0.1]" :color="LEGO.woodDark" :radius="0.02" />
        </template>
        <TresMesh :position="[0.22, 0.53, 0.08]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.08, 0.07, 0.16, 14]" />
          <TresMeshStandardNodeMaterial :color="LEGO.white" :roughness="0.28" />
        </TresMesh>
        <LegoBox :position="[-0.24, 0.5, -0.1]" :size="[0.3, 0.05, 0.22]" :color="LEGO.yellow" :radius="0.02" />
      </TresGroup>

      <OfficeDesk
        v-for="(agent, index) in agents"
        :key="agent.id"
        :agent="agent"
        :index="index"
        :position="deskPositions[index] ?? [0, 0.03, 0]"
        :selected="selectedId === agent.id"
        @select="emit('select', $event)"
      />

      <!-- Server rack -->
      <TresGroup :position="[-6.5, 0, -3.4]">
        <LegoBox :position="[0, 0.95, 0]" :size="[1.1, 1.9, 0.92]" :color="LEGO.charcoal" :radius="0.04" />
        <LegoBox :position="[0, 1.93, 0]" :size="[1.12, 0.06, 0.94]" :color="LEGO.navy" :radius="0.02" />
        <LegoBox :position="[0, 0.02, 0.46]" :size="[0.9, 1.7, 0.03]" color="#222a34" :radius="0.01" />
        <TresMesh
          v-for="light in rackLights"
          :key="`rack-light-${light}`"
          :position="[-0.3 + (light % 3) * 0.3, 1.55 - Math.floor(light / 3) * 0.42, 0.48]"
        >
          <TresBoxGeometry :args="[0.2, 0.05, 0.03]" />
          <TresMeshStandardNodeMaterial
            :color="light % 2 === 0 ? LEGO.green : LEGO.cyan"
            :emissive="light % 2 === 0 ? LEGO.green : LEGO.cyan"
            :emissive-intensity="1.6"
            :tone-mapped="false"
          />
        </TresMesh>
        <TresMesh :position="[-0.42, 2.02, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.08, 0.08, 0.06, 16]" />
          <TresMeshStandardNodeMaterial :color="LEGO.lightGray" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[0.42, 2.02, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.08, 0.08, 0.06, 16]" />
          <TresMeshStandardNodeMaterial :color="LEGO.lightGray" :roughness="0.3" />
        </TresMesh>
      </TresGroup>

      <!-- Coffee corner -->
      <TresGroup :position="[5.6, 0, 2.6]">
        <TresMesh :position="[0, 0.68, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.78, 0.78, 0.1, 28]" />
          <TresMeshStandardNodeMaterial :color="LEGO.warmWhite" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[0, 0.63, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.8, 0.8, 0.04, 28]" />
          <TresMeshStandardNodeMaterial :color="LEGO.navy" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[0, 0.3, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.07, 0.09, 0.62, 12]" />
          <TresMeshStandardNodeMaterial :color="LEGO.charcoal" :roughness="0.35" />
        </TresMesh>
        <TresMesh :position="[0, 0.04, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.38, 0.42, 0.08, 18]" />
          <TresMeshStandardNodeMaterial :color="LEGO.charcoal" :roughness="0.35" />
        </TresMesh>
        <TresMesh :position="[0.24, 0.82, 0.12]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.08, 0.07, 0.16, 14]" />
          <TresMeshStandardNodeMaterial :color="LEGO.white" :roughness="0.28" />
        </TresMesh>
        <TresMesh :position="[-0.24, 0.8, -0.16]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.07, 0.06, 0.14, 14]" />
          <TresMeshStandardNodeMaterial :color="LEGO.red" :roughness="0.3" />
        </TresMesh>
        <TresGroup
          v-for="(stool, index) in stools"
          :key="`stool-${index}`"
          :position="[stool[0], 0, stool[1]]"
        >
          <TresMesh :position="[0, 0.42, 0]" :cast-shadow="true">
            <TresCylinderGeometry :args="[0.3, 0.3, 0.1, 20]" />
            <TresMeshStandardNodeMaterial :color="index === 0 ? LEGO.red : LEGO.azure" :roughness="0.3" />
          </TresMesh>
          <TresMesh :position="[0, 0.2, 0]" :cast-shadow="true">
            <TresCylinderGeometry :args="[0.045, 0.055, 0.4, 10]" />
            <TresMeshStandardNodeMaterial :color="LEGO.charcoal" :roughness="0.3" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <!-- Plants and decor -->
      <LegoPlant :position="[-6.9, 0, -0.9]" :scale="1.05" :flower="LEGO.orange" />
      <LegoPlant :position="[7.4, 0, -3.9]" :scale="0.95" :flower="LEGO.red" />
      <LegoPlant :position="[7.2, 0, 4.3]" :scale="0.85" :flower="LEGO.yellow" />

      <TresGroup :position="[7.15, 0, 0.4]">
        <LegoBox :position="[0, 0.16, 0]" :size="[1.0, 0.32, 0.7]" :color="LEGO.azure" :radius="0.03" />
        <LegoBox :position="[0, 0.36, 0]" :size="[0.8, 0.08, 0.56]" :color="LEGO.yellow" :radius="0.02" />
        <TresMesh :position="[-0.18, 0.47, 0.1]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.08, 0.08, 0.18, 14]" />
          <TresMeshStandardNodeMaterial :color="LEGO.red" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="[0.18, 0.45, -0.08]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.08, 0.08, 0.18, 14]" />
          <TresMeshStandardNodeMaterial :color="LEGO.green" :roughness="0.3" />
        </TresMesh>
      </TresGroup>

      <!-- Credenza -->
      <TresGroup :position="[4.6, 0, -4.5]">
        <LegoBox :position="[0, 0.42, 0]" :size="[2.7, 0.72, 0.9]" :color="LEGO.warmWhite" :radius="0.04" />
        <LegoBox :position="[0, 0.82, 0]" :size="[2.82, 0.08, 0.98]" :color="LEGO.wood" :radius="0.03" />
        <LegoBox :position="[-0.62, 0.56, 0.46]" :size="[1.06, 0.22, 0.03]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[0.62, 0.56, 0.46]" :size="[1.06, 0.22, 0.03]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[-0.62, 0.56, 0.48]" :size="[0.24, 0.04, 0.03]" :color="LEGO.navy" :radius="0.015" />
        <LegoBox :position="[0.62, 0.56, 0.48]" :size="[0.24, 0.04, 0.03]" :color="LEGO.navy" :radius="0.015" />
        <LegoBox :position="[0, 0.26, 0.46]" :size="[2.3, 0.25, 0.03]" :color="LEGO.white" :radius="0.02" />
        <template v-for="x in [-1.15, 1.15]" :key="`credenza-foot-${x}`">
          <LegoBox :position="[x, 0.04, 0.35]" :size="[0.2, 0.1, 0.2]" :color="LEGO.charcoal" :radius="0.02" />
          <LegoBox :position="[x, 0.04, -0.35]" :size="[0.2, 0.1, 0.2]" :color="LEGO.charcoal" :radius="0.02" />
        </template>
        <LegoBox :position="[0.7, 0.9, 0.05]" :size="[0.3, 0.07, 0.24]" :color="LEGO.red" :radius="0.02" />
        <LegoBox :position="[0.68, 0.96, 0.04]" :size="[0.27, 0.06, 0.22]" :color="LEGO.yellow" :radius="0.02" />
        <LegoBox :position="[0.66, 1.02, 0.03]" :size="[0.24, 0.06, 0.2]" :color="LEGO.azure" :radius="0.02" />
        <TresGroup :position="[-0.75, 0.86, 0]">
          <LegoBox :position="[0, 0.14, 0]" :size="[0.58, 0.28, 0.4]" :color="LEGO.charcoal" :radius="0.03" />
          <LegoBox :position="[0, 0.3, 0]" :size="[0.5, 0.05, 0.34]" :color="LEGO.white" :radius="0.02" />
          <TresMesh :position="[0.2, 0.18, 0.21]">
            <TresBoxGeometry :args="[0.08, 0.03, 0.02]" />
            <TresMeshStandardNodeMaterial :color="LEGO.green" :emissive="LEGO.green" :emissive-intensity="1.4" :tone-mapped="false" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <!-- Loose brick -->
      <TresGroup :position="[3.4, 0, 4.5]" :rotation="[0, 0.35, 0]">
        <LegoBox :position="[0, 0.15, 0]" :size="[0.62, 0.3, 0.62]" :color="LEGO.yellow" :radius="0.04" />
        <TresMesh
          v-for="(stud, index) in [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]"
          :key="`loose-stud-${index}`"
          :position="[stud[0] ?? 0, 0.31, stud[1] ?? 0]"
          :cast-shadow="true"
        >
          <TresCylinderGeometry :args="[0.09, 0.09, 0.06, 14]" />
          <TresMeshStandardNodeMaterial :color="LEGO.yellow" :roughness="0.3" />
        </TresMesh>
      </TresGroup>

      <LegoShadow :position="[4.6, 0.008, -4.5]" :size="[3, 1.5]" :opacity="0.3" />
      <LegoShadow :position="[3.4, 0.008, 4.5]" :size="[0.9, 0.9]" :opacity="0.2" />

      <LegoShadow :position="[-6.1, 0.008, 2.5]" :size="[3.4, 2.2]" :opacity="0.28" />
      <LegoShadow :position="[-4.2, 0.008, 2.5]" :size="[1.6, 1.2]" :opacity="0.28" />
      <LegoShadow :position="[-6.5, 0.008, -3.4]" :size="[1.6, 1.4]" :opacity="0.32" />
      <LegoShadow :position="[5.6, 0.008, 2.6]" :size="[2.1, 2.1]" :opacity="0.26" />
      <LegoShadow :position="[7.15, 0.008, 0.4]" :size="[1.4, 1.1]" :opacity="0.26" />
      <LegoShadow :position="[-6.9, 0.008, -0.9]" :size="[0.9, 0.9]" :opacity="0.22" />
      <LegoShadow :position="[7.4, 0.008, -3.9]" :size="[0.85, 0.85]" :opacity="0.22" />
      <LegoShadow :position="[7.2, 0.008, 4.3]" :size="[0.8, 0.8]" :opacity="0.22" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.office-scene {
  position: absolute;
  inset: 0;
  z-index: 1;
}
</style>
