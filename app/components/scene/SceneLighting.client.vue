<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import {
  Color,
  MathUtils,
  Vector3,
  type AmbientLight,
  type DirectionalLight,
  type HemisphereLight,
} from 'three/webgpu'
import { useLoop } from '@tresjs/core/webgpu'
import type { OfficeAgent } from '~/types/office'
import { prefersReducedMotion } from '~/composables/useMotionPreference'

/**
 * Iluminación de la escena + hora del día (T040 / FR-027 y control de hora).
 *
 * Vive DENTRO de `<TresCanvas>`: `useLoop()` y `useTresContext()` solo están
 * disponibles en componentes hijos del canvas, nunca en `OfficeScene`, que
 * renderiza el propio `<TresCanvas>`.
 *
 * El aspecto se define con una tabla de keyframes horarios (0–24) que se
 * interpola con `smoothstep`: el sol describe un arco analítico (amanecer 6 h,
 * atardecer 19:30) y, cuando se pone, la luz principal se convierte en luna
 * fría. Todos los valores (dirección, color e intensidad del sol, ambiente,
 * hemisférica, fill y rim) se suavizan además frame a frame con la misma
 * exponencial que ya usaba la reacción al estado agregado, de modo que mover el
 * control de hora se ve como un amanecer/atardecer continuo.
 *
 * La escena es estática salvo los minifigs: el shadow map se recalcula una sola
 * vez por cambio de hora, cuando la luz ya se ha asentado. Nada aquí depende de
 * APIs de navegador fuera de `onMounted`/`onRender`, así que el componente es
 * seguro en SSR (y el archivo `.client` lo mantiene fuera del servidor).
 */
const props = withDefaults(
  defineProps<{
    agents: OfficeAgent[]
    /** Hora local en formato decimal (0–24). Fuera de rango se normaliza. */
    timeOfDay?: number
  }>(),
  { timeOfDay: 17 },
)

/* ------------------------------------------------------------------ */
/* Modelo solar                                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_TIME_OF_DAY = 17
/** Distancia de la luz principal: mantiene el shadow map lejos de los planos de recorte. */
const SUN_DISTANCE = 15
const SUNRISE_HOUR = 6
const SUNSET_HOUR = 19.5
const SUN_MAX_ELEVATION = 66
/** Azimut del amanecer (grados) y barrido hacia el oeste durante el día. */
const SUNRISE_AZIMUTH = 20
const AZIMUTH_SWEEP = 170
/** Dirección de la luna (luz de relleno de la noche), en coordenadas de escena. */
const MOON_DIRECTION: [number, number, number] = [0.34, 0.84, 0.42]

/** Sesgo cálido del estado activo (mismos deltas que la T040 original a las 17 h). */
const ACTIVE_BOOST = {
  key: 0.55,
  ambient: 0.03,
  hemi: 0.06,
  fill: 0.25,
  rim: -0.3,
} as const
const WARM_KEY = new Color('#fff1d8')
const WARM_FILL = new Color('#ffe8cf')

interface LightingKeyframe {
  hour: number
  keyColor: string
  keyIntensity: number
  ambientColor: string
  ambientIntensity: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  fillColor: string
  fillIntensity: number
  rimColor: string
  rimIntensity: number
}

/**
 * Keyframes horarios. Los valores de las 17 h reproducen EXACTAMENTE la
 * iluminación aprobada en la T040 (inactiva y activa), de modo que la escena
 * por defecto conserva su aspecto y las demás horas son variaciones continuas.
 */
const KEYFRAMES: readonly LightingKeyframe[] = [
  {
    hour: 0,
    keyColor: '#7f9ccf',
    keyIntensity: 0.42,
    ambientColor: '#2b3f63',
    ambientIntensity: 0.14,
    hemiSky: '#2a3c60',
    hemiGround: '#0b1017',
    hemiIntensity: 0.24,
    fillColor: '#46608c',
    fillIntensity: 0.32,
    rimColor: '#7396cf',
    rimIntensity: 0.55,
  },
  {
    hour: 4.5,
    keyColor: '#6e86b8',
    keyIntensity: 0.3,
    ambientColor: '#33445f',
    ambientIntensity: 0.13,
    hemiSky: '#33456a',
    hemiGround: '#0d1118',
    hemiIntensity: 0.24,
    fillColor: '#4d6288',
    fillIntensity: 0.34,
    rimColor: '#7a9ad2',
    rimIntensity: 0.6,
  },
  {
    hour: 6,
    keyColor: '#ff9d63',
    keyIntensity: 1,
    ambientColor: '#5a5f78',
    ambientIntensity: 0.12,
    hemiSky: '#8fa6c8',
    hemiGround: '#3b2f25',
    hemiIntensity: 0.2,
    fillColor: '#ffb98a',
    fillIntensity: 0.6,
    rimColor: '#88a9dd',
    rimIntensity: 0.55,
  },
  {
    hour: 7.5,
    keyColor: '#ffc98f',
    keyIntensity: 2.4,
    ambientColor: '#6a7488',
    ambientIntensity: 0.1,
    hemiSky: '#b6cdec',
    hemiGround: '#463827',
    hemiIntensity: 0.26,
    fillColor: '#ffe0bb',
    fillIntensity: 0.8,
    rimColor: '#9cc0f2',
    rimIntensity: 0.7,
  },
  {
    hour: 10,
    keyColor: '#fff0d2',
    keyIntensity: 3.6,
    ambientColor: '#6f7e93',
    ambientIntensity: 0.085,
    hemiSky: '#cde2ff',
    hemiGround: '#463827',
    hemiIntensity: 0.3,
    fillColor: '#ffe8cf',
    fillIntensity: 0.95,
    rimColor: '#9cc4ff',
    rimIntensity: 0.9,
  },
  {
    hour: 12.5,
    keyColor: '#fffaf0',
    keyIntensity: 3.85,
    ambientColor: '#74839a',
    ambientIntensity: 0.075,
    hemiSky: '#d8eaff',
    hemiGround: '#463827',
    hemiIntensity: 0.32,
    fillColor: '#fff0de',
    fillIntensity: 1,
    rimColor: '#a8cbff',
    rimIntensity: 1,
  },
  {
    hour: 15,
    keyColor: '#ffeecd',
    keyIntensity: 3.75,
    ambientColor: '#6d7a8e',
    ambientIntensity: 0.08,
    hemiSky: '#cde0fa',
    hemiGround: '#4a3b2c',
    hemiIntensity: 0.3,
    fillColor: '#ffe6c9',
    fillIntensity: 0.95,
    rimColor: '#9fc2f5',
    rimIntensity: 1.05,
  },
  {
    // Aspecto de referencia (T040): no tocar los valores de esta fila.
    hour: 17,
    keyColor: '#fff1d8',
    keyIntensity: 3.5,
    ambientColor: '#ffffff',
    ambientIntensity: 0.04,
    hemiSky: '#cfe3ff',
    hemiGround: '#4a3b2c',
    hemiIntensity: 0.1,
    fillColor: '#ffe8cf',
    fillIntensity: 0.8,
    rimColor: '#9cc4ff',
    rimIntensity: 1.15,
  },
  {
    hour: 18.5,
    keyColor: '#ff9f5c',
    keyIntensity: 2.3,
    ambientColor: '#4e4a5c',
    ambientIntensity: 0.06,
    hemiSky: '#a3a8c8',
    hemiGround: '#3a2a1e',
    hemiIntensity: 0.12,
    fillColor: '#ffb37f',
    fillIntensity: 0.7,
    rimColor: '#8fa8da',
    rimIntensity: 1,
  },
  {
    hour: 19.75,
    keyColor: '#c96a4f',
    keyIntensity: 0.55,
    ambientColor: '#3a3f58',
    ambientIntensity: 0.09,
    hemiSky: '#5f6f94',
    hemiGround: '#211d20',
    hemiIntensity: 0.16,
    fillColor: '#98879f',
    fillIntensity: 0.45,
    rimColor: '#7589b4',
    rimIntensity: 0.75,
  },
  {
    hour: 21,
    keyColor: '#7f9ccf',
    keyIntensity: 0.4,
    ambientColor: '#2b3f63',
    ambientIntensity: 0.13,
    hemiSky: '#2b3d61',
    hemiGround: '#0b1017',
    hemiIntensity: 0.22,
    fillColor: '#46608c',
    fillIntensity: 0.32,
    rimColor: '#7396cf',
    rimIntensity: 0.55,
  },
  {
    // Cierre del ciclo: idéntico a las 0 h para que la interpolación 21 h → 24 h
    // y el salto 24 h → 0 h sean continuos.
    hour: 24,
    keyColor: '#7f9ccf',
    keyIntensity: 0.42,
    ambientColor: '#2b3f63',
    ambientIntensity: 0.14,
    hemiSky: '#2a3c60',
    hemiGround: '#0b1017',
    hemiIntensity: 0.24,
    fillColor: '#46608c',
    fillIntensity: 0.32,
    rimColor: '#7396cf',
    rimIntensity: 0.55,
  },
]

interface LightingSample {
  keyColor: string
  keyIntensity: number
  keyPosition: [number, number, number]
  ambientColor: string
  ambientIntensity: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  fillColor: string
  fillIntensity: number
  rimColor: string
  rimIntensity: number
}

interface LightingTarget {
  keyColor: Color
  keyIntensity: number
  keyPosition: Vector3
  ambientColor: Color
  ambientIntensity: number
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  fillColor: Color
  fillIntensity: number
  rimColor: Color
  rimIntensity: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Interpolación suave con derivada nula en los extremos (sin "tirones" al pasar por cada keyframe). */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value < edge0 ? 0 : 1
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Normaliza la hora a [0, 24); valores no finitos caen al valor por defecto. */
function normalizeHour(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIME_OF_DAY
  return ((value % 24) + 24) % 24
}

/** Interpola dos colores hex en espacio lineal y devuelve un hex sRGB válido para three. */
function mixHex(from: string, to: string, t: number): string {
  if (t <= 0) return from
  if (t >= 1) return to
  const color = new Color(from).lerp(new Color(to), t)
  return `#${color.getHexString()}`
}

function findKeyframePair(hour: number): { from: LightingKeyframe; to: LightingKeyframe; t: number } {
  const first = KEYFRAMES[0] as LightingKeyframe
  if (hour <= first.hour) {
    return { from: first, to: KEYFRAMES[1] as LightingKeyframe, t: 0 }
  }

  for (let index = 1; index < KEYFRAMES.length; index += 1) {
    const previous = KEYFRAMES[index - 1] as LightingKeyframe
    const current = KEYFRAMES[index] as LightingKeyframe
    if (hour <= current.hour) {
      const span = Math.max(1e-6, current.hour - previous.hour)
      return { from: previous, to: current, t: smoothstep(0, 1, (hour - previous.hour) / span) }
    }
  }

  const last = KEYFRAMES[KEYFRAMES.length - 1] as LightingKeyframe
  return { from: last, to: last, t: 0 }
}

/**
 * Arco solar analítico: amanece a las 6 h por el sureste de la escena y se pone
 * a las 19:30 por el oeste, con la máxima altura al mediodía. Fuera de la
 * ventana diurna la elevación es negativa (el sol está bajo el horizonte).
 */
function solarDirection(hour: number): [number, number, number] {
  const progress = (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR)
  const elevation = MathUtils.degToRad(Math.sin(Math.PI * progress) * SUN_MAX_ELEVATION)
  const azimuth = MathUtils.degToRad(SUNRISE_AZIMUTH - AZIMUTH_SWEEP * progress)
  const horizontal = Math.cos(elevation)
  return [horizontal * Math.sin(azimuth), Math.sin(elevation), horizontal * Math.cos(azimuth)]
}

/**
 * Posición de la luz principal. De día sigue al sol; de noche se funde con la
 * luna (arriba y fría) para que la transición del atardecer no tenga un salto.
 * La `y` nunca baja del plano del suelo: evita sombras infinitas al ras.
 */
function keyLightPosition(hour: number): [number, number, number] {
  const [sunX, sunY, sunZ] = solarDirection(hour)
  const daylight = smoothstep(-0.05, 0.12, sunY)
  const direction = new Vector3(
    sunX * daylight + MOON_DIRECTION[0] * (1 - daylight),
    sunY * daylight + MOON_DIRECTION[1] * (1 - daylight),
    sunZ * daylight + MOON_DIRECTION[2] * (1 - daylight),
  ).normalize()
  if (direction.y < 0.08) {
    direction.y = 0.08
    direction.normalize()
  }
  direction.multiplyScalar(SUN_DISTANCE)
  return [direction.x, direction.y, direction.z]
}

/** Muestra continua de la tabla horaria: no hay saltos entre horas enteras. */
function sampleLighting(hour: number): LightingSample {
  const normalized = normalizeHour(hour)
  const { from, to, t } = findKeyframePair(normalized)
  const lerp = (a: number, b: number) => MathUtils.lerp(a, b, t)

  return {
    keyColor: mixHex(from.keyColor, to.keyColor, t),
    keyIntensity: lerp(from.keyIntensity, to.keyIntensity),
    keyPosition: keyLightPosition(normalized),
    ambientColor: mixHex(from.ambientColor, to.ambientColor, t),
    ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity),
    hemiSky: mixHex(from.hemiSky, to.hemiSky, t),
    hemiGround: mixHex(from.hemiGround, to.hemiGround, t),
    hemiIntensity: lerp(from.hemiIntensity, to.hemiIntensity),
    fillColor: mixHex(from.fillColor, to.fillColor, t),
    fillIntensity: lerp(from.fillIntensity, to.fillIntensity),
    rimColor: mixHex(from.rimColor, to.rimColor, t),
    rimIntensity: lerp(from.rimIntensity, to.rimIntensity),
  }
}

/**
 * Convierte una muestra horaria en objetos de three reutilizables y aplica el
 * sesgo cálido del estado agregado (agentes trabajando o esperando aprobación).
 */
function buildTarget(sample: LightingSample, active: boolean): LightingTarget {
  const keyColor = new Color(sample.keyColor)
  const fillColor = new Color(sample.fillColor)
  let keyIntensity = sample.keyIntensity
  let ambientIntensity = sample.ambientIntensity
  let hemiIntensity = sample.hemiIntensity
  let fillIntensity = sample.fillIntensity
  let rimIntensity = sample.rimIntensity

  if (active) {
    keyIntensity += ACTIVE_BOOST.key
    ambientIntensity += ACTIVE_BOOST.ambient
    hemiIntensity += ACTIVE_BOOST.hemi
    fillIntensity += ACTIVE_BOOST.fill
    rimIntensity = Math.max(0, rimIntensity + ACTIVE_BOOST.rim)
    keyColor.lerp(WARM_KEY, 0.3)
    fillColor.lerp(WARM_FILL, 0.25)
  }

  return {
    keyColor,
    keyIntensity,
    keyPosition: new Vector3(...sample.keyPosition),
    ambientColor: new Color(sample.ambientColor),
    ambientIntensity,
    hemiSky: new Color(sample.hemiSky),
    hemiGround: new Color(sample.hemiGround),
    hemiIntensity,
    fillColor,
    fillIntensity,
    rimColor: new Color(sample.rimColor),
    rimIntensity,
  }
}

/* ------------------------------------------------------------------ */
/* Estado reactivo                                                     */
/* ------------------------------------------------------------------ */

const keyLight = shallowRef<DirectionalLight>()
const ambientLight = shallowRef<AmbientLight>()
const hemiLight = shallowRef<HemisphereLight>()
const fillLight = shallowRef<DirectionalLight>()
const rimLight = shallowRef<DirectionalLight>()

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
  // La escena es estática salvo los minifigs: el shadow map se calcula una vez.
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

// El reparto cambia con el número de agentes; el shadow map es estático y hay
// que refrescarlo cuando aparecen o desaparecen escritorios.
watch(
  () => props.agents.map((agent) => agent.id).join('|'),
  () => {
    if (keyLight.value) keyLight.value.shadow.needsUpdate = true
  },
)

const activeAgents = computed(
  () =>
    props.agents.filter(
      (agent) => agent.status === 'working' || agent.status === 'waiting_approval',
    ).length,
)

/** Valores de arranque (17 h): primera imagen correcta, sin parpadeo de luz. */
const initial = sampleLighting(DEFAULT_TIME_OF_DAY)
const hemiArgs: [string, string, number] = [
  initial.hemiSky,
  initial.hemiGround,
  initial.hemiIntensity,
]

const baseLighting = computed(() => sampleLighting(props.timeOfDay))
const target = computed(() => buildTarget(baseLighting.value, activeAgents.value > 0))

/* ------------------------------------------------------------------ */
/* Suavizado por frame                                                 */
/* ------------------------------------------------------------------ */

/** El shadow map es estático: se refresca cuando la luz principal se asienta. */
let shadowNeedsRefresh = true

watch(
  () => props.timeOfDay,
  () => {
    shadowNeedsRefresh = true
  },
)

const { onRender } = useLoop()

onRender(({ delta }) => {
  const lighting = target.value
  const reducedMotion = prefersReducedMotion()
  const frameDelta = Math.min(delta ?? 0.016, 0.05)
  const alpha = reducedMotion ? 1 : 1 - Math.exp(-frameDelta * 4)

  const applyIntensity = (
    light: AmbientLight | HemisphereLight | DirectionalLight | undefined,
    value: number,
  ) => {
    if (!light) return
    light.intensity = reducedMotion ? value : MathUtils.lerp(light.intensity, value, alpha)
  }

  const applyColor = (light: AmbientLight | HemisphereLight | DirectionalLight | undefined, color: Color) => {
    if (!light) return
    if (reducedMotion) light.color.copy(color)
    else light.color.lerp(color, alpha)
  }

  applyIntensity(ambientLight.value, lighting.ambientIntensity)
  applyColor(ambientLight.value, lighting.ambientColor)

  const hemi = hemiLight.value
  if (hemi) {
    applyIntensity(hemi, lighting.hemiIntensity)
    applyColor(hemi, lighting.hemiSky)
    if (reducedMotion) hemi.groundColor.copy(lighting.hemiGround)
    else hemi.groundColor.lerp(lighting.hemiGround, alpha)
  }

  applyIntensity(fillLight.value, lighting.fillIntensity)
  applyColor(fillLight.value, lighting.fillColor)
  applyIntensity(rimLight.value, lighting.rimIntensity)
  applyColor(rimLight.value, lighting.rimColor)

  const key = keyLight.value
  if (!key) return

  applyIntensity(key, lighting.keyIntensity)
  applyColor(key, lighting.keyColor)

  // La dirección del sol (y por tanto la sombra) se mueve con la hora: se
  // interpola la posición y solo se recalcula el shadow map al terminar.
  if (reducedMotion) key.position.copy(lighting.keyPosition)
  else key.position.lerp(lighting.keyPosition, alpha)

  if (key.position.distanceToSquared(lighting.keyPosition) > 0.0025) {
    shadowNeedsRefresh = true
  } else if (shadowNeedsRefresh) {
    key.position.copy(lighting.keyPosition)
    key.shadow.needsUpdate = true
    shadowNeedsRefresh = false
  }
})
</script>

<template>
  <TresAmbientLight
    ref="ambientLight"
    :color="initial.ambientColor"
    :intensity="initial.ambientIntensity"
  />
  <TresHemisphereLight ref="hemiLight" :args="hemiArgs" />
  <TresDirectionalLight
    ref="keyLight"
    :position="initial.keyPosition"
    :intensity="initial.keyIntensity"
    :color="initial.keyColor"
    :cast-shadow="true"
  />
  <TresDirectionalLight
    ref="fillLight"
    :position="[3, 5, 10]"
    :intensity="initial.fillIntensity"
    :color="initial.fillColor"
  />
  <TresDirectionalLight
    ref="rimLight"
    :position="[8, 6, -8]"
    :intensity="initial.rimIntensity"
    :color="initial.rimColor"
  />
</template>
