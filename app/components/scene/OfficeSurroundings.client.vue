<script setup lang="ts">
import { computed } from 'vue'
import { LEGO } from '~/utils/lego'
import LegoBox from '../lego/LegoBox.vue'
import LegoPlant from '../lego/LegoPlant.vue'
import LegoShadow from '../lego/LegoShadow.vue'

/**
 * Entorno exterior del diorama: plaza/acera perimetral, terraza con escalones,
 * barandilla, macetas con plantas, farolas y silueta de ciudad.
 *
 * Se usa DENTRO de `<TresCanvas>`: no renderiza HTML, solo objetos TresJS. Todo
 * el componente es estático (sin `useLoop` ni trabajo por frame); las únicas
 * propiedades reactivas son el encendido de farolas y ventanas, que se resuelve
 * en `computed` con pasos cuantizados para no multiplicar materiales en la
 * caché de `getLegoMaterial`.
 *
 * Coordenadas: el diorama mide 18.9 × 13.2 (x ±9.45, z ±6.6) y su cara inferior
 * queda en y = -0.58; el suelo de la escena está en y = -0.63. La acera es una
 * plataforma de 21.6 × 16.8 con la cara superior en y = -0.56, de modo que el
 * diorama apoya sobre ella. Todo lo demás vive FUERA del perímetro del diorama
 * y se mantiene dentro del encuadre isométrico normal (cámara [14, 14, 14],
 * target [0, 1, 0]): la plaza ocupa como máximo x ±10.8 / z ±8.4 y la ciudad se
 * sitúa detrás de la pared trasera, donde solo asoma por encima de ella.
 */
const props = withDefaults(
  defineProps<{
    /**
     * Hora local 0–24 (opcional). A partir del atardecer enciende las farolas
     * y las ventanas de la ciudad. Sin valor, se asume la hora por defecto de
     * la escena (17 h), que las mantiene apagadas.
     */
    timeOfDay?: number
  }>(),
  { timeOfDay: 17 },
)

/* ------------------------------------------------------------------ */
/* Hora del día (encendido nocturno)                                   */
/* ------------------------------------------------------------------ */

const DEFAULT_TIME_OF_DAY = 17

type Vec3 = [number, number, number]
interface Box {
  position: Vec3
  size: Vec3
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value < edge0 ? 0 : 1
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function normalizeHour(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIME_OF_DAY
  return ((value % 24) + 24) % 24
}

const hour = computed(() => normalizeHour(props.timeOfDay))

/** 0 de noche → 1 pleno día, con rampas suaves en amanecer y anochecer. */
const daylight = computed(() =>
  Math.min(smoothstep(5.25, 7.5, hour.value), 1 - smoothstep(18, 20.5, hour.value)),
)

// Intensidades cuantizadas a cuartos: la caché de materiales de `LegoBox` está
// indexada por intensidad emisiva, así que el slider de hora no puede generar
// una variante nueva por cada posición intermedia.
const lampGlow = computed(() => Math.round((0.1 + (1 - daylight.value) * 1.5) * 4) / 4)
const windowGlow = computed(() => Math.round((0.05 + (1 - daylight.value) * 1.2) * 4) / 4)

/* ------------------------------------------------------------------ */
/* Geometría estática                                                  */
/* ------------------------------------------------------------------ */

const SIDEWALK_TOP = -0.56

/** Acera perimetral (una única losa) y bordillos de las caras visibles. */
const sidewalk: Box = { position: [0, -0.64, 0], size: [21.6, 0.16, 16.8] }
const curbs: Box[] = [
  { position: [0, -0.55, 8.28], size: [21.6, 0.1, 0.24] },
  { position: [10.68, -0.55, 0], size: [0.24, 0.1, 16.8] },
  { position: [-10.68, -0.55, 0], size: [0.24, 0.1, 16.8] },
]

/** Terraza de acceso (frente del diorama) y sus dos escalones hacia la acera. */
const deck: Box = { position: [3.6, -0.46, 7.075], size: [5.2, 0.2, 0.55] }
const deckSteps: Box[] = [
  { position: [3.6, -0.4935, 7.525], size: [5.2, 0.133, 0.35] },
  { position: [3.6, -0.5265, 7.875], size: [5.2, 0.067, 0.35] },
]

const RAIL_Y = -0.34
const RAIL_TOP = -0.1
const RAIL_MID = -0.32
const POST_SIZE: Vec3 = [0.09, 0.44, 0.09]
const RAIL_LATERAL_X = 10.45

const railingPosts: Vec3[] = [
  // Tramo delantero izquierdo (deja libre la terraza de acceso).
  [-10, RAIL_Y, 8.05],
  [-7.35, RAIL_Y, 8.05],
  [-4.7, RAIL_Y, 8.05],
  [-2.05, RAIL_Y, 8.05],
  [0.5, RAIL_Y, 8.05],
  // Tramo delantero derecho.
  [6.8, RAIL_Y, 8.05],
  [8.625, RAIL_Y, 8.05],
  [RAIL_LATERAL_X, RAIL_Y, 8.05],
  // Lateral derecho.
  [RAIL_LATERAL_X, RAIL_Y, 6.6],
  [RAIL_LATERAL_X, RAIL_Y, 3.3],
  [RAIL_LATERAL_X, RAIL_Y, 0],
  [RAIL_LATERAL_X, RAIL_Y, -3.3],
  [RAIL_LATERAL_X, RAIL_Y, -6.6],
]
const railingRails: Box[] = [
  // Delantero izquierdo.
  { position: [-4.75, RAIL_TOP, 8.05], size: [10.5, 0.06, 0.1] },
  { position: [-4.75, RAIL_MID, 8.05], size: [10.5, 0.045, 0.07] },
  // Delantero derecho.
  { position: [8.625, RAIL_TOP, 8.05], size: [3.65, 0.06, 0.1] },
  { position: [8.625, RAIL_MID, 8.05], size: [3.65, 0.045, 0.07] },
  // Lateral derecho.
  { position: [RAIL_LATERAL_X, RAIL_TOP, 0.725], size: [0.1, 0.06, 14.65] },
  { position: [RAIL_LATERAL_X, RAIL_MID, 0.725], size: [0.07, 0.045, 14.65] },
]

/** Macetas: fuera del perímetro, sobre la acera y sin tapar el diorama. */
const plants: Array<{ position: Vec3; scale: number; flower: string }> = [
  { position: [-8.8, SIDEWALK_TOP, 7.4], scale: 1.05, flower: LEGO.orange },
  { position: [9.5, SIDEWALK_TOP, 4.4], scale: 0.95, flower: LEGO.red },
  { position: [9.5, SIDEWALK_TOP, -7.2], scale: 0.9, flower: LEGO.yellow },
]

interface Lamp {
  base: Vec3
  post: Vec3
  lantern: Vec3
  brim: Vec3
  hat: Vec3
  shadow: Vec3
}

/** Farolas (3): base, poste, farol emisivo, brim y remate, más su sombra de contacto. */
const lampSpots: Array<[number, number]> = [
  [-10.2, 7.3],
  [9.9, 7.4],
  [9.9, -5.9],
]
const lamps: Lamp[] = lampSpots.map(([x, z]) => ({
  base: [x, SIDEWALK_TOP + 0.05, z],
  post: [x, 0.28, z],
  lantern: [x, 1.12, z],
  brim: [x, 1.26, z],
  hat: [x, 1.34, z],
  shadow: [x, SIDEWALK_TOP + 0.012, z],
}))

/**
 * Silueta de ciudad: bloques al otro lado de la pared trasera. Su base queda
 * oculta por la pared y solo asoman por encima de ella, como skyline lejano;
 * así nunca tapan escritorios, paredes ni el propio diorama.
 */
const cityBlocks: Array<{ position: Vec3; size: Vec3; color: string }> = [
  { position: [-5, 0.97, -11.4], size: [2.4, 3.2, 2], color: LEGO.navy },
  { position: [-0.8, 1.57, -12.2], size: [2.6, 4.4, 2.2], color: LEGO.charcoal },
  { position: [4.2, 0.97, -11.6], size: [2.4, 3.2, 2], color: LEGO.base },
  { position: [6.9, 0.77, -10.4], size: [2, 2.4, 1.8], color: LEGO.darkGray },
  { position: [-8.8, 0.87, -10], size: [2, 2.4, 1.8], color: LEGO.navy },
]
const cityCaps: Box[] = [
  { position: [-5, 2.63, -11.4], size: [2.56, 0.12, 2.16] },
  { position: [-0.8, 3.83, -12.2], size: [2.76, 0.12, 2.36] },
  { position: [-8.8, 2.13, -10], size: [2.16, 0.12, 1.96] },
]
/** Ventanas emisivas de la ciudad (se encienden con la hora). */
const cityWindows: Box[] = [
  { position: [-5.5, 1.8, -10.36], size: [0.5, 0.12, 0.06] },
  { position: [-4.4, 2.3, -10.36], size: [0.5, 0.12, 0.06] },
  { position: [-1.5, 2.2, -11.06], size: [0.6, 0.14, 0.06] },
  { position: [0, 3.3, -11.06], size: [0.6, 0.12, 0.06] },
  { position: [3.6, 1.7, -10.56], size: [0.6, 0.12, 0.06] },
  { position: [4.7, 2.4, -10.56], size: [0.5, 0.12, 0.06] },
]
</script>

<template>
  <TresGroup>
    <!-- Acera perimetral -->
    <LegoBox
      :position="sidewalk.position"
      :size="sidewalk.size"
      :color="LEGO.floorEdge"
      :radius="0.06"
      :cast-shadow="false"
    />
    <LegoBox
      v-for="(curb, index) in curbs"
      :key="`curb-${index}`"
      :position="curb.position"
      :size="curb.size"
      :color="LEGO.lightGray"
      :radius="0.03"
      :cast-shadow="false"
    />

    <!-- Terraza y escalones de acceso -->
    <LegoBox
      :position="deck.position"
      :size="deck.size"
      :color="LEGO.tan"
      :radius="0.03"
      :cast-shadow="false"
    />
    <LegoBox
      v-for="(step, index) in deckSteps"
      :key="`step-${index}`"
      :position="step.position"
      :size="step.size"
      :color="index === 0 ? LEGO.floorEdge : LEGO.lightGray"
      :radius="0.02"
      :cast-shadow="false"
    />

    <!-- Barandilla -->
    <LegoBox
      v-for="(post, index) in railingPosts"
      :key="`rail-post-${index}`"
      :position="post"
      :size="POST_SIZE"
      :color="LEGO.midGray"
      :radius="0.02"
      :cast-shadow="false"
    />
    <LegoBox
      v-for="(rail, index) in railingRails"
      :key="`rail-${index}`"
      :position="rail.position"
      :size="rail.size"
      :color="LEGO.tan"
      :radius="0.02"
      :cast-shadow="false"
    />

    <!-- Farolas -->
    <TresGroup v-for="(lamp, index) in lamps" :key="`lamp-${index}`">
      <LegoBox
        :position="lamp.base"
        :size="[0.46, 0.1, 0.46]"
        :color="LEGO.darkGray"
        :radius="0.02"
        :cast-shadow="false"
      />
      <LegoBox
        :position="lamp.post"
        :size="[0.14, 1.48, 0.14]"
        :color="LEGO.charcoal"
        :radius="0.02"
        :cast-shadow="false"
      />
      <LegoBox
        :position="lamp.lantern"
        :size="[0.34, 0.2, 0.34]"
        :color="LEGO.warmWhite"
        :emissive="LEGO.yellow"
        :emissive-intensity="lampGlow"
        :radius="0.02"
        :cast-shadow="false"
      />
      <LegoBox
        :position="lamp.brim"
        :size="[0.5, 0.08, 0.5]"
        :color="LEGO.navy"
        :radius="0.02"
        :cast-shadow="false"
      />
      <LegoBox
        :position="lamp.hat"
        :size="[0.38, 0.08, 0.38]"
        :color="LEGO.charcoal"
        :radius="0.02"
        :cast-shadow="false"
      />
      <LegoShadow :position="lamp.shadow" :size="[1.2, 1.2]" :opacity="0.26" />
    </TresGroup>

    <!-- Macetas con plantas -->
    <LegoPlant
      v-for="(plant, index) in plants"
      :key="`outside-plant-${index}`"
      :position="plant.position"
      :scale="plant.scale"
      :flower="plant.flower"
    />
    <LegoShadow
      v-for="(plant, index) in plants"
      :key="`outside-plant-shadow-${index}`"
      :position="[plant.position[0], SIDEWALK_TOP + 0.012, plant.position[2]]"
      :size="[1, 1]"
      :opacity="0.22"
    />

    <!-- Silueta de ciudad (detrás de la pared trasera) -->
    <LegoBox
      v-for="(block, index) in cityBlocks"
      :key="`city-${index}`"
      :position="block.position"
      :size="block.size"
      :color="block.color"
      :radius="0.04"
      :cast-shadow="false"
      :receive-shadow="false"
    />
    <LegoBox
      v-for="(cap, index) in cityCaps"
      :key="`city-cap-${index}`"
      :position="cap.position"
      :size="cap.size"
      :color="LEGO.midGray"
      :radius="0.03"
      :cast-shadow="false"
      :receive-shadow="false"
    />
    <LegoBox
      v-for="(window, index) in cityWindows"
      :key="`city-window-${index}`"
      :position="window.position"
      :size="window.size"
      :color="LEGO.warmWhite"
      :emissive="LEGO.yellow"
      :emissive-intensity="windowGlow"
      :radius="0.01"
      :cast-shadow="false"
      :receive-shadow="false"
    />
  </TresGroup>
</template>
