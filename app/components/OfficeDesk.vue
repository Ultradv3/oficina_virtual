<script setup lang="ts">
import type {
  Group,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  SpriteNodeMaterial,
} from 'three/webgpu'
import { CanvasTexture, SRGBColorSpace } from 'three/webgpu'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useLoop } from '@tresjs/core/webgpu'
import type { OfficeAgent } from '~/types/office'
import { statusMeta } from '~/utils/status'
import { LEGO, minifigTorso } from '~/utils/lego'
import LegoBox from './lego/LegoBox.vue'
import LegoMinifig from './lego/LegoMinifig.vue'
import LegoShadow from './lego/LegoShadow.vue'

const props = defineProps<{
  agent: OfficeAgent
  index: number
  selected: boolean
  position: [number, number, number]
}>()

const emit = defineEmits<{ select: [id: string] }>()

const ringMat = shallowRef<MeshStandardNodeMaterial>()
const ledMat = shallowRef<MeshStandardNodeMaterial>()
const glowMat = shallowRef<SpriteNodeMaterial>()
const labelMaterial = shallowRef<SpriteNodeMaterial>()
const screenMaterial = shallowRef<MeshBasicNodeMaterial>()
const screenTexture = shallowRef<CanvasTexture>()
const keyboardTexture = shallowRef<CanvasTexture>()
const hovered = ref(false)
const figure = shallowRef<Group>()

const accent = minifigTorso(props.agent.name)
const phase = props.index * 1.37

let glowTexture: CanvasTexture | null = null
let labelTexture: CanvasTexture | null = null
// Clave de contenido: las texturas solo se reconstruyen cuando el nombre o el
// estado cambian de verdad (no en cada refresco SSE con el mismo estado).
let labelKey = ''
let screenKey = ''

function makeGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function rounded(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath()
  context.roundRect(x, y, w, h, r)
}

function buildLabel() {
  if (!labelMaterial.value) return
  const key = `${props.agent.name}|${props.agent.status}`
  if (key === labelKey) return
  const meta = statusMeta(props.agent.status)
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, 640, 160)
  context.save()
  context.shadowColor = 'rgba(5, 9, 14, 0.45)'
  context.shadowBlur = 18
  context.shadowOffsetY = 6
  rounded(context, 8, 8, 624, 142, 30)
  context.fillStyle = '#f4efe4'
  context.fill()
  context.restore()

  rounded(context, 8, 8, 624, 142, 30)
  context.lineWidth = 6
  context.strokeStyle = meta.color
  context.stroke()

  context.beginPath()
  context.arc(62, 79, 16, 0, Math.PI * 2)
  context.fillStyle = meta.color
  context.fill()
  context.beginPath()
  context.arc(62, 79, 5, 0, Math.PI * 2)
  context.fillStyle = '#f4efe4'
  context.fill()

  context.fillStyle = '#1c2531'
  context.font = '700 44px Inter, Segoe UI, sans-serif'
  const name = props.agent.name.length > 15 ? `${props.agent.name.slice(0, 14)}…` : props.agent.name
  context.fillText(name, 96, 74)

  context.fillStyle = '#5b6675'
  context.font = '600 24px Inter, Segoe UI, sans-serif'
  context.fillText(meta.label.toUpperCase().split('').join(' '), 96, 116)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const previous = labelMaterial.value.map
  labelMaterial.value.map = texture
  labelMaterial.value.needsUpdate = true
  previous?.dispose()
  labelTexture = texture
  labelKey = key
}

function buildScreen() {
  if (!screenMaterial.value) return
  const key = `${props.agent.name}|${props.agent.status}`
  if (key === screenKey) return
  const meta = statusMeta(props.agent.status)
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 400
  const context = canvas.getContext('2d')
  if (!context) return

  context.fillStyle = '#0b1219'
  context.fillRect(0, 0, 640, 400)
  context.fillStyle = '#111c26'
  context.fillRect(0, 0, 640, 54)
  context.fillStyle = '#1b2a36'
  context.fillRect(0, 54, 126, 346)

  context.fillStyle = meta.color
  context.fillRect(0, 0, 640, 5)
  context.fillStyle = '#26343f'
  ;[0, 1, 2].forEach((index) => {
    context.beginPath()
    context.arc(28 + index * 24, 28, 6, 0, Math.PI * 2)
    context.fillStyle = index === 0 ? '#d7665a' : index === 1 ? '#e0b15a' : '#6bae74'
    context.fill()
  })
  context.fillStyle = '#8ea3b5'
  context.font = '600 19px "JetBrains Mono", Consolas, monospace'
  context.fillText(`${props.agent.name} · session`, 110, 34)

  context.fillStyle = '#4b5d6d'
  context.font = '500 15px "JetBrains Mono", Consolas, monospace'
  ;['workspace', 'agents', 'tasks', 'events'].forEach((item, index) => {
    context.fillStyle = index === 1 ? meta.color : '#5a6c7d'
    context.fillText(item, 20, 100 + index * 34)
  })

  const lines: Array<[number, string]> = [
    [90, 'const agent = await office.connect()'],
    [40, 'agent.on("permission", approve)'],
    [150, 'await agent.run(task)'],
    [60, 'status: ' + props.agent.status],
  ]
  context.font = '500 17px "JetBrains Mono", Consolas, monospace'
  let y = 108
  for (const [width, text] of lines) {
    context.fillStyle = '#6c8296'
    context.fillText(String(y / 2 - 40).padStart(2, '0'), 150, y)
    context.fillStyle = '#9fb4c8'
    context.fillText(text, 198, y)
    const gradient = context.createLinearGradient(198, 0, 198 + width, 0)
    gradient.addColorStop(0, meta.color)
    gradient.addColorStop(1, 'rgba(125, 211, 252, 0.15)')
    context.fillStyle = gradient
    context.fillRect(198, y + 10, width, 3)
    y += 52
  }

  context.fillStyle = meta.color
  context.fillRect(150, 340, 460, 36)
  context.fillStyle = '#08121a'
  context.font = '700 17px Inter, Segoe UI, sans-serif'
  context.fillText(meta.label.toUpperCase(), 170, 364)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const previous = screenMaterial.value.map
  screenMaterial.value.map = texture
  screenMaterial.value.needsUpdate = true
  previous?.dispose()
  screenTexture.value = texture
  screenKey = key
}

function buildKeyboard() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = '#232c36'
  context.fillRect(0, 0, 256, 96)
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 11; column += 1) {
      rounded(context, 8 + column * 22, 8 + row * 27, 18, 21, 4)
      context.fillStyle = '#39434f'
      context.fill()
    }
  }
  context.fillStyle = '#39434f'
  rounded(context, 74, 68, 108, 18, 4)
  context.fill()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  keyboardTexture.value = texture
}

const { onRender } = useLoop()

onRender(({ elapsed }) => {
  const time = elapsed + phase
  const status = props.agent.status

  if (ringMat.value) {
    const base = props.selected ? 0.72 : hovered.value ? 0.5 : 0.24
    ringMat.value.opacity = base + Math.sin(time * 2) * (props.selected ? 0.1 : 0.03)
  }

  if (ledMat.value) {
    ledMat.value.emissiveIntensity =
      status === 'disconnected' ? 0.15 : 1.1 + Math.sin(time * 3.2) * 0.3
  }

  if (glowMat.value) {
    const base =
      status === 'disconnected' ? 0.05 : status === 'waiting_approval' ? 0.46 : 0.3
    const pulse = status === 'working' || status === 'waiting_approval' ? Math.sin(time * 3.6) * 0.08 : 0
    glowMat.value.opacity = base + pulse
  }
})

onMounted(() => {
  glowTexture = makeGlowTexture()
  if (glowMat.value) {
    glowMat.value.map = glowTexture
    // Fuerza el rebuild del grafo si el material ya se compiló sin textura.
    glowMat.value.needsUpdate = true
  }
  buildLabel()
  buildScreen()
  buildKeyboard()
})

watch(
  () => `${props.agent.name}|${props.agent.status}`,
  () => {
    buildLabel()
    buildScreen()
  },
)

onBeforeUnmount(() => {
  labelTexture?.dispose()
  labelMaterial.value?.dispose()
  screenTexture.value?.dispose()
  screenMaterial.value?.dispose()
  keyboardTexture.value?.dispose()
  glowTexture?.dispose()
  glowMat.value?.dispose()
})

function select() {
  emit('select', props.agent.id)
}
</script>

<template>
  <TresGroup
    :position="position"
    :scale="hovered && !selected ? 1.012 : 1"
    @click="select"
    @pointer-enter="hovered = true"
    @pointer-leave="hovered = false"
  >
    <LegoShadow :position="[0.12, 0.015, -0.34]" :size="[3.4, 2.75]" :opacity="0.32" />

    <TresMesh :rotation="[-Math.PI / 2, 0, 0]" :position="[0, 0.032, 0]">
      <TresRingGeometry :args="[1.6, 1.76, 64]" />
      <TresMeshStandardNodeMaterial
        ref="ringMat"
        :color="statusMeta(agent.status).color"
        :emissive="statusMeta(agent.status).color"
        :emissive-intensity="1.4"
        :transparent="true"
        :opacity="0.3"
        :side="2"
      />
    </TresMesh>

    <TresGroup :position="[0, 0.02, 0]">
      <LegoBox :position="[0, 0.8, 0]" :size="[2.55, 0.14, 1.18]" :color="LEGO.warmWhite" :radius="0.05" />
      <LegoBox :position="[0, 0.72, 0]" :size="[2.57, 0.055, 1.2]" :color="LEGO.navy" :radius="0.03" />
      <LegoBox :position="[0.15, 0.86, 0.28]" :size="[0.98, 0.012, 0.54]" :color="accent" :radius="0.02" />

      <template v-for="x in [-1.06, 1.06]" :key="`legs-${x}`">
        <LegoBox :position="[x, 0.36, 0.45]" :size="[0.17, 0.7, 0.17]" :color="LEGO.azure" :radius="0.03" />
        <LegoBox :position="[x, 0.36, -0.45]" :size="[0.17, 0.7, 0.17]" :color="LEGO.azure" :radius="0.03" />
        <LegoBox :position="[x, 0.4, 0.45]" :size="[0.18, 0.03, 0.18]" :color="LEGO.navy" :radius="0.015" />
        <LegoBox :position="[x, 0.4, -0.45]" :size="[0.18, 0.03, 0.18]" :color="LEGO.navy" :radius="0.015" />
      </template>
      <LegoBox :position="[0, 0.22, -0.45]" :size="[2, 0.07, 0.08]" :color="LEGO.navy" :radius="0.02" />

      <TresGroup :position="[0.8, 0, -0.02]">
        <LegoBox :position="[0, 0.4, 0]" :size="[0.64, 0.62, 0.88]" :color="LEGO.azure" :radius="0.04" />
        <LegoBox :position="[0, 0.53, 0.45]" :size="[0.56, 0.2, 0.03]" :color="LEGO.white" :radius="0.02" />
        <LegoBox :position="[0, 0.28, 0.45]" :size="[0.56, 0.2, 0.03]" :color="LEGO.white" :radius="0.02" />
        <LegoBox :position="[0, 0.53, 0.47]" :size="[0.16, 0.035, 0.03]" :color="LEGO.navy" :radius="0.015" />
        <LegoBox :position="[0, 0.28, 0.47]" :size="[0.16, 0.035, 0.03]" :color="LEGO.navy" :radius="0.015" />
      </TresGroup>

      <TresGroup :position="[-0.68, 0.9, -0.28]" :rotation="[0, 0.18, 0]">
        <LegoBox :position="[0, 0.02, 0]" :size="[0.7, 0.06, 0.38]" :color="LEGO.charcoal" :radius="0.02" />
        <LegoBox :position="[0, 0.18, -0.02]" :size="[0.09, 0.32, 0.09]" :color="LEGO.darkGray" :radius="0.02" />
        <TresGroup :position="[0, 0.46, 0]" :rotation="[-0.05, 0, 0]">
          <LegoBox :position="[0, 0, 0]" :size="[1.34, 0.8, 0.1]" :color="LEGO.charcoal" :radius="0.04" />
          <TresMesh :position="[0, 0.01, 0.056]">
            <TresPlaneGeometry :args="[1.2, 0.66]" />
            <TresMeshBasicNodeMaterial
              ref="screenMaterial"
              :map="screenTexture"
              :tone-mapped="false"
            />
          </TresMesh>
          <TresMesh :position="[0.53, -0.3, 0.07]">
            <TresBoxGeometry :args="[0.09, 0.035, 0.02]" />
            <TresMeshStandardNodeMaterial
              ref="ledMat"
              :color="statusMeta(agent.status).color"
              :emissive="statusMeta(agent.status).color"
              :emissive-intensity="1.2"
              :tone-mapped="false"
            />
          </TresMesh>
          <TresMesh :position="[-0.52, 0.44, 0]" :cast-shadow="true">
            <TresCylinderGeometry :args="[0.07, 0.07, 0.05, 16]" />
            <TresMeshStandardNodeMaterial :color="LEGO.lightGray" :roughness="0.3" />
          </TresMesh>
          <TresMesh :position="[-0.22, 0.44, 0]" :cast-shadow="true">
            <TresCylinderGeometry :args="[0.07, 0.07, 0.05, 16]" />
            <TresMeshStandardNodeMaterial :color="LEGO.lightGray" :roughness="0.3" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <TresSprite :position="[-0.68, 1.45, -0.46]" :scale="[1.95, 1.2, 1]" :render-order="6">
        <TresSpriteNodeMaterial
          ref="glowMat"
          :color="statusMeta(agent.status).color"
          :transparent="true"
          :opacity="0.3"
          :depth-write="false"
          :blending="2"
        />
      </TresSprite>

      <TresGroup :position="[0.15, 0.88, 0.3]">
        <LegoBox :position="[0, 0, 0]" :size="[0.88, 0.04, 0.3]" :color="LEGO.charcoal" :radius="0.02" />
        <TresMesh :position="[0, 0.024, 0]" :rotation="[-Math.PI / 2, 0, 0]">
          <TresPlaneGeometry :args="[0.8, 0.24]" />
          <TresMeshBasicNodeMaterial :map="keyboardTexture" :tone-mapped="false" />
        </TresMesh>
      </TresGroup>
      <LegoBox :position="[0.74, 0.9, 0.32]" :size="[0.14, 0.05, 0.2]" :color="LEGO.darkGray" :radius="0.03" />

      <TresGroup :position="[-1.02, 0.9, 0.3]">
        <TresMesh :position="[0, 0.09, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.09, 0.08, 0.18, 18]" />
          <TresMeshStandardNodeMaterial :color="LEGO.white" :roughness="0.28" />
        </TresMesh>
        <TresMesh :position="[0.1, 0.1, 0]" :rotation="[Math.PI / 2, 0, 0]">
          <TresTorusGeometry :args="[0.06, 0.018, 8, 16, Math.PI]" />
          <TresMeshStandardNodeMaterial :color="LEGO.white" :roughness="0.28" />
        </TresMesh>
      </TresGroup>

      <LegoBox :position="[0.8, 0.9, -0.4]" :size="[0.32, 0.045, 0.24]" :color="LEGO.yellow" :radius="0.015" />
      <LegoBox :position="[0.81, 0.95, -0.39]" :size="[0.3, 0.045, 0.22]" :color="LEGO.red" :radius="0.015" />

      <TresGroup :position="[-1.02, 0.86, -0.4]">
        <TresMesh :position="[0, 0.025, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.14, 0.16, 0.05, 18]" />
          <TresMeshStandardNodeMaterial :color="LEGO.charcoal" :roughness="0.32" />
        </TresMesh>
        <TresMesh :position="[0, 0.32, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.025, 0.028, 0.58, 10]" />
          <TresMeshStandardNodeMaterial :color="LEGO.darkGray" :roughness="0.3" :metalness="0.25" />
        </TresMesh>
        <TresGroup :position="[0.14, 0.6, 0.06]" :rotation="[0.65, 0.25, 0]">
          <TresMesh :cast-shadow="true">
            <TresCylinderGeometry :args="[0.06, 0.2, 0.17, 18, 1, true]" />
            <TresMeshStandardNodeMaterial :color="LEGO.navy" :roughness="0.35" :side="2" />
          </TresMesh>
          <TresMesh :position="[0, -0.03, 0]">
            <TresSphereGeometry :args="[0.065, 14, 10]" />
            <TresMeshStandardNodeMaterial color="#ffe6bd" :emissive="'#ffd9a4'" :emissive-intensity="2.4" :tone-mapped="false" />
          </TresMesh>
        </TresGroup>
        <TresPointLight :position="[0.35, 0.58, 0.16]" :intensity="5" :distance="3.1" :decay="2" color="#ffd9a8" />
      </TresGroup>

      <TresGroup :position="[0.15, 0, -1.02]">
        <TresMesh :position="[0, 0.035, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.34, 0.38, 0.07, 5]" />
          <TresMeshStandardNodeMaterial :color="LEGO.charcoal" :roughness="0.35" />
        </TresMesh>
        <TresMesh :position="[0, 0.2, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.055, 0.055, 0.3, 12]" />
          <TresMeshStandardNodeMaterial color="#3a4756" :roughness="0.3" :metalness="0.2" />
        </TresMesh>
        <LegoBox :position="[0, 0.43, 0.04]" :size="[0.64, 0.1, 0.6]" :color="LEGO.darkGray" :radius="0.04" />
        <LegoBox :position="[0, 0.71, -0.24]" :size="[0.58, 0.56, 0.1]" :color="accent" :radius="0.04" :rotation="[-0.12, 0, 0]" />
        <LegoBox :position="[0, 0.47, 0.25]" :size="[0.52, 0.06, 0.14]" :color="LEGO.charcoal" :radius="0.02" />
      </TresGroup>

      <TresGroup ref="figure" :position="[0.15, 0.02, -0.72]" :rotation="[0, 0.22, 0]">
        <LegoMinifig :name="agent.name" :status="agent.status" :phase="index * 1.7" />
      </TresGroup>

      <TresSprite :position="[0, 2.32, -0.05]" :scale="[2.55, 0.64, 1]" :render-order="30">
        <TresSpriteNodeMaterial
          ref="labelMaterial"
          :transparent="true"
          :depth-test="false"
          :depth-write="false"
          :tone-mapped="false"
        />
      </TresSprite>
    </TresGroup>
  </TresGroup>
</template>
