<script setup lang="ts">
import type {
  Group,
  SpriteNodeMaterial,
} from 'three/webgpu'
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  SRGBColorSpace,
} from 'three/webgpu'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useLoop, useTres, useTresContext } from '@tresjs/core/webgpu'
import type { OfficeAgent } from '~/types/office'
import { prefersReducedMotion } from '~/composables/useMotionPreference'
import { statusMeta } from '~/utils/status'
import { LEGO, minifigTorso } from '~/utils/lego'
import { getLegoMaterial, getLegoWear } from '~/utils/lego-materials'
import { DESK_LAYOUT, getDeskProps, getMonitorPlacements } from '~/utils/desk-layout'
import DeskMonitor from './lego/DeskMonitor.vue'
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

const { renderer } = useTres()
const { isInitialized } = useTresContext().renderer

const glowMat = shallowRef<SpriteNodeMaterial>()
const labelMaterial = shallowRef<SpriteNodeMaterial>()
const screenTexture = shallowRef<CanvasTexture>()
const keyboardTexture = shallowRef<CanvasTexture>()
const hovered = ref(false)
const figure = shallowRef<Group>()
const entrance = shallowRef<Group>()
let appearStart = 0

const accent = minifigTorso(props.agent.name)
const phase = props.index * 1.37

const monitorPlacements = computed(() => getMonitorPlacements(props.agent.name))
const deskProps = computed(() => getDeskProps(props.agent.name))

// Microvariación de materiales (T030): el desgaste se deriva del agente y se
// sirve desde la caché compartida, sin crear un material por escritorio.
const wear = getLegoWear(`${props.agent.name}|desk`)
const mugMaterial = getLegoMaterial({ color: LEGO.white, roughness: 0.28, wear })
const baseMaterial = getLegoMaterial({
  color: LEGO.charcoal,
  roughness: 0.35,
  wear: getLegoWear(`${props.agent.name}|base`),
})

// Densidad 2x de las texturas (T029 / FR-022): se dibuja en un lienzo lógico
// y se renderiza al doble de resolución. La etiqueta es un chip pequeño
// (1.6 × 0.36 en el sprite), con lienzo lógico 640x144 y la misma relación de
// aspecto para no deformar el texto.
const LABEL_WIDTH = 1280
const LABEL_HEIGHT = 288
const LABEL_SCALE = 2
const SCREEN_WIDTH = 1280
const SCREEN_HEIGHT = 800
const SCREEN_SCALE = 2
/** Anisotropía máxima soportada, acotada a 8 (FR-022). */
const MAX_ANISOTROPY = 8

let glowTexture: CanvasTexture | null = null
let labelTexture: CanvasTexture | null = null
// Clave de contenido: las texturas solo se reconstruyen cuando el nombre o el
// estado cambian de verdad (no en cada refresco SSE con el mismo estado).
let labelKey = ''
let screenKey = ''

/**
 * Calidad de muestreo compartida por las texturas de canvas: anisotropía hasta 8,
 * mipmaps y filtro trilineal para que las etiquetas se lean nítidas a 1024x768.
 * Si el backend no expone anisotropía se deja en 1 sin romper nada.
 */
function textureAnisotropy(): number {
  try {
    const value = renderer.getMaxAnisotropy()
    return Number.isFinite(value) && value > 0 ? Math.min(MAX_ANISOTROPY, value) : 1
  } catch {
    return 1
  }
}

function configureTextureQuality(texture: CanvasTexture) {
  texture.anisotropy = textureAnisotropy()
  // Los canvas 1280x288 y 1280x800 no son potencias de dos; en WebGPU y en el
  // fallback WebGL2 moderno los mipmaps siguen siendo válidos. Si un backend
  // concreto no los generase, three mantiene la textura y solo pierde el
  // filtrado trilineal (no hay error visible).
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
}

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
  canvas.width = LABEL_WIDTH
  canvas.height = LABEL_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return

  // Chip discreto: fondo oscuro translúcido, nombre claro y un punto de estado
  // diminuto. Se dibuja con coordenadas lógicas 640x144 y se escala x2 en el
  // lienzo; el material del sprite aporta la opacidad global (~0.7).
  context.scale(LABEL_SCALE, LABEL_SCALE)
  context.clearRect(0, 0, 640, 144)

  rounded(context, 10, 12, 620, 120, 34)
  context.fillStyle = 'rgba(9, 14, 21, 0.9)'
  context.fill()

  context.save()
  context.globalAlpha = 0.34
  rounded(context, 10, 12, 620, 120, 34)
  context.lineWidth = 3
  context.strokeStyle = meta.color
  context.stroke()
  context.restore()

  // Punto de estado opcional, alineado con el nombre.
  context.beginPath()
  context.arc(52, 72, 12, 0, Math.PI * 2)
  context.fillStyle = meta.color
  context.fill()

  context.fillStyle = '#eef3f8'
  context.font = '600 56px Inter, Segoe UI, sans-serif'
  context.textBaseline = 'middle'
  const name = props.agent.name.length > 16 ? `${props.agent.name.slice(0, 15)}…` : props.agent.name
  context.fillText(name, 84, 74, 530)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  configureTextureQuality(texture)
  const previous = labelMaterial.value.map
  labelMaterial.value.map = texture
  labelMaterial.value.needsUpdate = true
  previous?.dispose()
  labelTexture = texture
  labelKey = key
}

function buildScreen() {
  const key = `${props.agent.name}|${props.agent.status}`
  if (key === screenKey) return
  const meta = statusMeta(props.agent.status)
  const canvas = document.createElement('canvas')
  canvas.width = SCREEN_WIDTH
  canvas.height = SCREEN_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return

  // Coordenadas lógicas 640x400 escaladas x2 en el lienzo (T029).
  context.scale(SCREEN_SCALE, SCREEN_SCALE)
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
  configureTextureQuality(texture)
  const previous = screenTexture.value
  screenTexture.value = texture
  previous?.dispose()
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
  configureTextureQuality(texture)
  keyboardTexture.value = texture
}

const { onRender } = useLoop()

onRender(({ elapsed }) => {
  const time = elapsed + phase
  const status = props.agent.status

  if (glowMat.value) {
    const base =
      status === 'disconnected' ? 0.05 : status === 'waiting_approval' ? 0.46 : 0.3
    const pulse = status === 'working' || status === 'waiting_approval' ? Math.sin(time * 3.6) * 0.08 : 0
    glowMat.value.opacity = base + pulse
  }

  // Escalonado de entrada de los escritorios (T041 / FR-028).
  const group = entrance.value
  if (group) {
    if (prefersReducedMotion()) {
      group.scale.setScalar(1)
      group.position.y = 0
    } else {
      const progress = Math.min(1, Math.max(0, (performance.now() - appearStart) / 420))
      const eased = 1 - (1 - progress) ** 3
      group.scale.setScalar(MathUtils.lerp(0.94, 1, eased))
      group.position.y = MathUtils.lerp(0.35, 0, eased)
    }
  }
})

onMounted(() => {
  appearStart = performance.now() + props.index * 90
  if (entrance.value && prefersReducedMotion()) {
    entrance.value.scale.setScalar(1)
    entrance.value.position.y = 0
  }
  glowTexture = makeGlowTexture()
  if (glowTexture) configureTextureQuality(glowTexture)
  if (glowMat.value) {
    glowMat.value.map = glowTexture
    // Fuerza el rebuild del grafo si el material ya se compiló sin textura.
    glowMat.value.needsUpdate = true
  }
  buildLabel()
  buildScreen()
  buildKeyboard()
})

// El renderer se inicializa de forma asíncrona: cuando está listo se reaplica la
// anisotropía real a las texturas que ya se habían creado.
watch(
  () => isInitialized.value,
  (ready) => {
    if (!ready) return
    const textures = [labelTexture, screenTexture.value, keyboardTexture.value, glowTexture]
    for (const texture of textures) {
      if (texture) configureTextureQuality(texture)
    }
  },
)

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
    :rotation="[0, DESK_LAYOUT.groupRotationY, 0]"
    :scale="hovered && !selected ? 1.012 : 1"
    @click="select"
    @pointer-enter="hovered = true"
    @pointer-leave="hovered = false"
  >
    <TresGroup ref="entrance">
    <LegoShadow :position="[0.12, 0.015, 0.32]" :size="[3.4, 3.2]" :opacity="0.32" />

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

      <TresGroup
        v-for="(monitor, monitorIndex) in monitorPlacements"
        :key="`monitor-${monitorIndex}`"
        :position="monitor.position"
        :rotation="[0, monitor.rotationY, 0]"
      >
        <DeskMonitor
          :screen-texture="screenTexture"
          :status-color="statusMeta(agent.status).color"
          :vertical="monitor.vertical"
          :scale="monitor.scale"
        />
      </TresGroup>

      <TresSprite :position="[0, 1.45, -0.46]" :scale="[1.95, 1.2, 1]" :render-order="6">
        <TresSpriteNodeMaterial
          ref="glowMat"
          :color="statusMeta(agent.status).color"
          :transparent="true"
          :opacity="0.3"
          :depth-write="false"
          :blending="2"
        />
      </TresSprite>

      <TresGroup :position="DESK_LAYOUT.keyboard.position">
        <LegoBox :position="[0, 0, 0]" :size="[0.88, 0.04, 0.3]" :color="LEGO.charcoal" :radius="0.02" />
        <TresMesh :position="[0, 0.024, 0]" :rotation="[-Math.PI / 2, 0, 0]">
          <TresPlaneGeometry :args="[0.8, 0.24]" />
          <TresMeshBasicNodeMaterial :map="keyboardTexture" :tone-mapped="false" />
        </TresMesh>
      </TresGroup>
      <LegoBox :position="deskProps.notebook" :size="[0.14, 0.05, 0.2]" :color="LEGO.darkGray" :radius="0.03" />

      <TresGroup :position="deskProps.mug">
        <TresMesh :position="[0, 0.09, 0]" :cast-shadow="true" :material="mugMaterial">
          <TresCylinderGeometry :args="[0.09, 0.08, 0.18, 18]" />
        </TresMesh>
        <TresMesh
          :position="[0.1, 0.1, 0]"
          :rotation="[Math.PI / 2, 0, 0]"
          :material="mugMaterial"
        >
          <TresTorusGeometry :args="[0.06, 0.018, 8, 16, Math.PI]" />
        </TresMesh>
      </TresGroup>

      <LegoBox :position="deskProps.papers[0]?.position ?? [0.8, 0.9125, -0.4]" :size="[0.32, 0.045, 0.24]" :color="LEGO.yellow" :radius="0.015" />
      <LegoBox :position="deskProps.papers[1]?.position ?? [0.81, 0.9575, -0.39]" :size="[0.3, 0.045, 0.22]" :color="LEGO.red" :radius="0.015" />

      <TresGroup :position="deskProps.lamp">
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
          <TresMesh
            :position="[0, -0.03, 0]"
            :user-data="{ bloomContributor: 'lamp' }"
          >
            <TresSphereGeometry :args="[0.065, 14, 10]" />
            <TresMeshStandardNodeMaterial color="#ffe6bd" :emissive="'#ffd9a4'" :emissive-intensity="2.4" :tone-mapped="false" />
          </TresMesh>
        </TresGroup>
        <TresPointLight :position="[0.35, 0.58, 0.16]" :intensity="5" :distance="3.1" :decay="2" color="#ffd9a8" />
      </TresGroup>

      <TresGroup :position="DESK_LAYOUT.chair.position" :rotation="[0, DESK_LAYOUT.chair.rotationY, 0]">
        <TresMesh :position="[0, 0.035, 0]" :cast-shadow="true" :material="baseMaterial">
          <TresCylinderGeometry :args="[0.34, 0.38, 0.07, 5]" />
        </TresMesh>
        <TresMesh :position="[0, 0.2, 0]" :cast-shadow="true">
          <TresCylinderGeometry :args="[0.055, 0.055, 0.3, 12]" />
          <TresMeshStandardNodeMaterial color="#3a4756" :roughness="0.3" :metalness="0.2" />
        </TresMesh>
        <LegoBox :position="[0, 0.43, 0.04]" :size="[0.64, 0.1, 0.6]" :color="LEGO.darkGray" :radius="0.04" />
        <LegoBox :position="[0, 0.71, -0.24]" :size="[0.58, 0.56, 0.1]" :color="LEGO.navy" :radius="0.04" :rotation="[-0.12, 0, 0]" />
        <LegoBox :position="[0, 0.47, 0.25]" :size="[0.52, 0.06, 0.14]" :color="LEGO.charcoal" :radius="0.02" />
      </TresGroup>

      <TresGroup
        ref="figure"
        :position="DESK_LAYOUT.agent.position"
        :rotation="[0, DESK_LAYOUT.agent.rotationY, 0]"
        :user-data="{ agentId: agent.id, agentMinifig: true }"
      >
        <LegoMinifig :name="agent.name" :status="agent.status" :phase="index * 1.7" />
      </TresGroup>

      <!-- Etiqueta discreta: chip oscuro pequeño, sin material emisivo y
           excluido del bloom (T031). -->
      <TresSprite :position="DESK_LAYOUT.label.position" :scale="DESK_LAYOUT.label.scale" :render-order="30">
        <TresSpriteNodeMaterial
          ref="labelMaterial"
          :transparent="true"
          :opacity="0.7"
          :depth-test="false"
          :depth-write="false"
          :tone-mapped="false"
        />
      </TresSprite>
    </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
