<script setup lang="ts">
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  LinearFilter,
  PCFShadowMap,
  RepeatWrapping,
  SRGBColorSpace,
  type MeshBasicNodeMaterial,
  type OrthographicCamera,
} from 'three/webgpu'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { OfficeAgent, TaskSummary } from '~/types/office'
import { prefersReducedMotion } from '~/composables/useMotionPreference'
import { LEGO } from '~/utils/lego'
import { getLegoMaterial, getLegoWear } from '~/utils/lego-materials'
import { taskStatusLabel } from '~/utils/status'
import { WALL_LAYOUT } from '~/utils/wall-layout'
import type { QualityLevel } from '~/utils/perf-budget'
import {
  clampZoom,
  computeSceneFraming,
  SCENE_ENTRANCE,
  SCENE_SAFE_AREA,
  SCENE_SELECTION_DURATION_MS,
  type FramingSafeArea,
} from '~/utils/scene-framing'
import LegoBox from './lego/LegoBox.vue'
import LegoPlant from './lego/LegoPlant.vue'
import LegoShadow from './lego/LegoShadow.vue'
import LegoStuds from './lego/LegoStuds.vue'
import StudioEnvironment from './lego/StudioEnvironment.vue'
import ScenePostProcessing from './scene/ScenePostProcessing.client.vue'
import ScenePerformance from './scene/ScenePerformance.client.vue'
import AgentPortraitBaker from './scene/AgentPortraitBaker.client.vue'
import SceneLighting from './scene/SceneLighting.client.vue'
import SceneCameraControls from './scene/SceneCameraControls.client.vue'
import SceneWallFade from './scene/SceneWallFade.client.vue'
import OfficeSurroundings from './scene/OfficeSurroundings.client.vue'

const props = defineProps<{
  agents: OfficeAgent[]
  tasks: TaskSummary[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  quality: [level: QualityLevel, fps: number]
}>()

const host = ref<HTMLElement>()
const cameraRef = shallowRef<OrthographicCamera>()
const signTexture = shallowRef<CanvasTexture>()
const baseSignTexture = shallowRef<CanvasTexture>()
const groundShadow = shallowRef<CanvasTexture>()
const groundGrid = shallowRef<CanvasTexture>()
const groundGlow = shallowRef<CanvasTexture>()
const clockTexture = shallowRef<CanvasTexture>()
const clockMaterial = shallowRef<MeshBasicNodeMaterial>()
const boardTexture = shallowRef<CanvasTexture>()
const boardMaterial = shallowRef<MeshBasicNodeMaterial>()
const clockText = ref('--:--')
let clockTimer: ReturnType<typeof setInterval> | null = null
const size = ref({ width: 1280, height: 800 })
let observer: ResizeObserver | null = null

/* ------------------------------------------------------------------ */
/* Hora de escena: control de iluminación y reloj                     */
/* ------------------------------------------------------------------ */

const realNow = ref(new Date())
const timeOverride = ref(false)
const realHour = computed(
  () => realNow.value.getHours() + realNow.value.getMinutes() / 60,
)
const sliderHour = ref(realHour.value)
const effectiveDate = computed(() => {
  if (!timeOverride.value) return realNow.value
  const date = new Date(realNow.value)
  const hours = Math.floor(sliderHour.value)
  const minutes = Math.round((sliderHour.value - hours) * 60)
  date.setHours(hours, minutes, 0, 0)
  return date
})
const effectiveHour = computed(
  () => effectiveDate.value.getHours() + effectiveDate.value.getMinutes() / 60,
)
const timeLabel = computed(() =>
  effectiveDate.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
)

function onTimeInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  timeOverride.value = true
  sliderHour.value = Math.min(24, Math.max(0, value))
  refreshClock()
}

function useRealTime() {
  timeOverride.value = false
  realNow.value = new Date()
  sliderHour.value = realHour.value
  refreshClock()
}

function resetCamera() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('agent-office:reset-camera'))
  }
}

/* ------------------------------------------------------------------ */
/* Encuadre automático (T027 / FR-017)                                 */
/* ------------------------------------------------------------------ */

/**
 * Zona segura reservada al HUD. En lienzos bajos (móvil apilado) el pie de la
 * escena se oculta, así que se reserva menos espacio inferior.
 */
const hudSafeArea = computed<Partial<FramingSafeArea>>(() =>
  size.value.height < 520
    ? { top: 56, bottom: 24, left: 0, right: 0 }
    : SCENE_SAFE_AREA,
)

/**
 * Cálculo puro del frustum objetivo, del centrado en la zona segura del HUD y
 * del zoom de foco. Se recalcula al cambiar el tamaño real del contenedor o el
 * número de agentes, y no depende del viewport del navegador.
 */
const framing = computed(() =>
  computeSceneFraming({
    viewport: size.value,
    agentCount: props.agents.length,
    safeArea: hudSafeArea.value,
  }),
)
const frustum = computed(() => framing.value.frustum)
const deskPositions = computed(() => framing.value.layout.positions)
const layout = computed(() => framing.value.layout)

// La oficina se reordena según la rejilla. Los props fijos que chocarían con
// una fila o columna extra se retiran para no solapar escritorios.
const showLounge = computed(() => props.agents.length <= 3)
const showCoffee = computed(() => props.agents.length <= 5)
const showCredenza = computed(() => layout.value.rows < 3)
const showRack = computed(() => layout.value.rows < 2)
const showConsole = computed(() => layout.value.columns < 4)
const showBackRightPlant = computed(() => layout.value.columns < 4)

const rug = computed(() => {
  const width = Math.min(15.2, Math.max(9.4, (layout.value.columns - 1) * 4.9 + 3.4))
  const depth = Math.min(11.4, Math.max(5.2, (layout.value.rows - 1) * 4.4 + 3.4))
  return { width, depth, innerWidth: width - 0.42, innerDepth: depth - 0.42 }
})

/* ------------------------------------------------------------------ */
/* Entrada dolly y transición de selección (T027 / FR-018)             */
/* ------------------------------------------------------------------ */

// El zoom se anima de forma imperativa sobre la cámara (no vía prop reactiva)
// para no re-renderizar el árbol de la escena en cada frame (FR-023).
let zoomFrame = 0
let entranceActive = false
let entranceStarted = false

/**
 * Aplica el zoom al objeto de cámara ya montado. Se usa la instancia real de
 * `TresOrthographicCamera` para no provocar re-renders de Vue por frame.
 */
function applyCameraZoom(value: number) {
  const camera = cameraRef.value
  if (!camera) return
  camera.zoom = clampZoom(value)
  camera.updateProjectionMatrix()
}

/**
 * Easing `cubic-bezier(.23, 1, .32, 1)` (token de movimiento del proyecto)
 * resuelto por Newton-Raphson: la animación de cámara usa la misma curva que el
 * resto de microinteracciones.
 */
function createCubicBezierEasing(x1: number, y1: number, x2: number, y2: number) {
  const coordinate = (t: number, edge1: number, edge2: number) =>
    3 * edge1 * t * (1 - t) ** 2 + 3 * edge2 * t * t * (1 - t) + t ** 3

  return (progress: number): number => {
    const clamped = Math.min(1, Math.max(0, progress))
    let t = clamped
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const delta = coordinate(t, x1, x2) - clamped
      if (Math.abs(delta) < 1e-4) break
      const slope = 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2)
      if (Math.abs(slope) < 1e-6) break
      t = Math.min(1, Math.max(0, t - delta / slope))
    }
    return coordinate(t, y1, y2)
  }
}

const easeOut = createCubicBezierEasing(0.23, 1, 0.32, 1)

function stopZoomAnimation() {
  if (zoomFrame) {
    cancelAnimationFrame(zoomFrame)
    zoomFrame = 0
  }
  entranceActive = false
}

/** Anima el zoom de la cámara ortográfica con salto directo si hay movimiento reducido. */
function animateZoom(from: number, to: number, durationMs: number, onDone?: () => void) {
  stopZoomAnimation()
  const startValue = clampZoom(from)
  const targetValue = clampZoom(to)

  if (prefersReducedMotion() || durationMs <= 0) {
    applyCameraZoom(targetValue)
    onDone?.()
    return
  }

  const started = performance.now()
  const duration = Math.max(120, durationMs)
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / duration)
    applyCameraZoom(startValue + (targetValue - startValue) * easeOut(progress))
    if (progress < 1) {
      zoomFrame = requestAnimationFrame(step)
      return
    }
    zoomFrame = 0
    onDone?.()
  }
  zoomFrame = requestAnimationFrame(step)
}

function playEntrance() {
  if (prefersReducedMotion()) {
    stopZoomAnimation()
    applyCameraZoom(SCENE_ENTRANCE.toZoom)
    return
  }
  animateZoom(SCENE_ENTRANCE.fromZoom, SCENE_ENTRANCE.toZoom, SCENE_ENTRANCE.durationMs, () => {
    entranceActive = false
  })
  entranceActive = true
}

/** La cámara la crea TresJS al montar el árbol: la entrada arranca en cuanto existe. */
function startEntrance() {
  if (!cameraRef.value || entranceStarted) return
  entranceStarted = true
  applyCameraZoom(SCENE_ENTRANCE.fromZoom)
  playEntrance()
}

watch(
  cameraRef,
  (camera) => {
    if (camera) startEntrance()
  },
  { immediate: true },
)

/** Cancelación al interactuar: la entrada salta al encuadre final (sin salto brusco). */
function cancelEntrance() {
  if (!entranceActive) return
  stopZoomAnimation()
  applyCameraZoom(SCENE_ENTRANCE.toZoom)
}

function attachInteractionListeners() {
  if (!host.value) return
  host.value.addEventListener('pointerdown', cancelEntrance, { capture: true, passive: true })
  host.value.addEventListener('wheel', cancelEntrance, { capture: true, passive: true })
}

// La selección de escritorio transiciona suavemente el zoom de foco (clamp 0.8–2.3)
// sin mover el target de OrbitControls.
watch(
  () => props.selectedId,
  (selectedId) => {
    if (entranceActive) return
    const from = cameraRef.value?.zoom ?? SCENE_ENTRANCE.toZoom
    const target = selectedId ? framing.value.target.zoom : SCENE_ENTRANCE.toZoom
    animateZoom(from, target, SCENE_SELECTION_DURATION_MS)
  },
)

/* ------------------------------------------------------------------ */
/* Bloom de pantalla (T026/T031/T032)                                  */
/* ------------------------------------------------------------------ */

/**
 * T032: el pipeline de bloom se apaga solo si no puede crearse o si no sostiene
 * el umbral de FPS (medido dentro de `ScenePostProcessing`). El estado queda
 * expuesto en el DOM (`data-bloom`) para la verificación V6 y no se reintenta:
 * la capa emisiva/sprites mantiene el resplandor requerido por FR-020.
 */
const bloomState = ref<'on' | 'off'>('on')
const bloomReason = ref<string | null>(null)
const bloomFailed = ref(false)
const qualityLevel = ref<QualityLevel>('high')
const fps = ref(0)
const bloomEnabled = computed(() => qualityLevel.value !== 'low' && !bloomFailed.value)

function onBloomState(active: boolean, reason: string | null) {
  bloomState.value = active ? 'on' : 'off'
  bloomReason.value = reason
  if (!active && reason !== 'fps' && reason !== 'disabled') bloomFailed.value = true
}

function onQuality(level: QualityLevel) {
  qualityLevel.value = level
}

function onFps(value: number) {
  fps.value = value
}

watch([qualityLevel, fps], ([level, value]) => emit('quality', level, value))

/** Suelo/horizonte de la escena (T028): rejilla procedural + glow cálido. */
const groundSettings = {
  size: 160,
  glowSize: 96,
  y: -0.63,
  glowY: -0.62,
  repeat: 14,
}

function measure() {
  if (!host.value) return
  const rect = host.value.getBoundingClientRect()
  // Se usa el tamaño REAL del contenedor (no el del viewport): el encuadre no
  // depende del HUD del navegador ni del panel lateral.
  size.value = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
}

onMounted(() => {
  measure()
  if (host.value) {
    observer = new ResizeObserver(measure)
    observer.observe(host.value)
  }

  signTexture.value = makePlateTexture('AGENT OFFICE', 'OPS FLOOR · 01', 1024, 280, true)
  baseSignTexture.value = makePlateTexture('AGENT OFFICE', 'SUPERVISIÓN DE AGENTES', 1024, 220, false)
  groundShadow.value = makeGroundShadow()
  groundGrid.value = makeGroundGridTexture()
  groundGlow.value = makeGroundGlowTexture()
  realNow.value = new Date()
  sliderHour.value = realHour.value
  refreshClock()
  refreshBoard()
  clockTimer = setInterval(() => {
    realNow.value = new Date()
    if (!timeOverride.value) {
      sliderHour.value = realHour.value
      refreshClock()
    }
  }, 30_000)

  attachInteractionListeners()
})

onBeforeUnmount(() => {
  stopZoomAnimation()
  observer?.disconnect()
  observer = null
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = null
  host.value?.removeEventListener('pointerdown', cancelEntrance, { capture: true })
  host.value?.removeEventListener('wheel', cancelEntrance, { capture: true })
  signTexture.value?.dispose()
  baseSignTexture.value?.dispose()
  groundShadow.value?.dispose()
  groundGrid.value?.dispose()
  groundGlow.value?.dispose()
  clockTexture.value?.dispose()
  boardTexture.value?.dispose()
  clockMaterial.value?.dispose()
  boardMaterial.value?.dispose()
})

/* ------------------------------------------------------------------ */
/* Reloj de pared y pizarra con datos reales (T038/T039)              */
/* ------------------------------------------------------------------ */

const BOARD_STATUS_COLORS: Record<string, string> = {
  queued: '#fbbf24',
  running: '#60a5fa',
  completed: '#4ade80',
  failed: '#f87171',
  cancelled: '#7d8a9c',
}

function makeClockTexture(at: Date): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, 256, 256)
    context.beginPath()
    context.arc(128, 128, 118, 0, Math.PI * 2)
    context.fillStyle = '#f4efe4'
    context.fill()
    context.lineWidth = 10
    context.strokeStyle = '#1d3350'
    context.stroke()

    for (let tick = 0; tick < 12; tick += 1) {
      const angle = (tick / 12) * Math.PI * 2
      const inner = tick % 3 === 0 ? 86 : 96
      context.beginPath()
      context.moveTo(128 + Math.sin(angle) * inner, 128 - Math.cos(angle) * inner)
      context.lineTo(128 + Math.sin(angle) * 104, 128 - Math.cos(angle) * 104)
      context.lineWidth = tick % 3 === 0 ? 6 : 3
      context.strokeStyle = tick % 3 === 0 ? '#1d3350' : '#8492a6'
      context.stroke()
    }

    const hours = at.getHours() % 12
    const minutes = at.getMinutes()
    const hourAngle = ((hours + minutes / 60) / 12) * Math.PI * 2
    const minuteAngle = ((minutes + at.getSeconds() / 60) / 60) * Math.PI * 2

    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(128, 128)
    context.lineTo(128 + Math.sin(hourAngle) * 54, 128 - Math.cos(hourAngle) * 54)
    context.lineWidth = 10
    context.strokeStyle = '#1d3350'
    context.stroke()

    context.beginPath()
    context.moveTo(128, 128)
    context.lineTo(128 + Math.sin(minuteAngle) * 82, 128 - Math.cos(minuteAngle) * 82)
    context.lineWidth = 6
    context.strokeStyle = '#2e8fb5'
    context.stroke()

    context.beginPath()
    context.arc(128, 128, 7, 0, Math.PI * 2)
    context.fillStyle = '#c4382c'
    context.fill()
  }

  clockText.value = at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function refreshClock() {
  const previous = clockTexture.value
  clockTexture.value = makeClockTexture(effectiveDate.value)
  if (clockMaterial.value) {
    clockMaterial.value.map = clockTexture.value
    clockMaterial.value.needsUpdate = true
  }
  previous?.dispose()
}

function makeBoardTexture(tasks: TaskSummary[]): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#f4f4f4'
    context.fillRect(0, 0, 1024, 512)
    context.fillStyle = '#1d3350'
    context.fillRect(0, 0, 1024, 84)
    context.fillStyle = '#e9eef7'
    context.font = '700 34px "Inter Variable", Inter, sans-serif'
    context.fillText('TAREAS · AGENT OFFICE', 42, 56)

    const visible = tasks.slice(0, 6)
    if (visible.length === 0) {
      context.fillStyle = '#8492a6'
      context.font = '600 30px "Inter Variable", Inter, sans-serif'
      context.fillText('Sin tareas registradas todavía', 42, 280)
    } else {
      visible.forEach((task, index) => {
        const y = 126 + index * 62
        context.fillStyle = BOARD_STATUS_COLORS[task.status] ?? '#8492a6'
        context.beginPath()
        context.arc(58, y + 10, 11, 0, Math.PI * 2)
        context.fill()

        context.fillStyle = '#1c2531'
        context.font = '600 26px "Inter Variable", Inter, sans-serif'
        const title = task.title.length > 46 ? `${task.title.slice(0, 45)}…` : task.title
        context.fillText(title, 86, y + 19)

        context.fillStyle = '#5b6675'
        context.font = '600 20px "JetBrains Mono Variable", monospace'
        context.fillText(taskStatusLabel(task.status).toUpperCase(), 760, y + 19)
      })
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function refreshBoard() {
  const previous = boardTexture.value
  boardTexture.value = makeBoardTexture(props.tasks)
  if (boardMaterial.value) {
    boardMaterial.value.map = boardTexture.value
    boardMaterial.value.needsUpdate = true
  }
  previous?.dispose()
}

watch(
  () => props.tasks.map((task) => `${task.id}:${task.status}:${task.title}`).join('|'),
  () => refreshBoard(),
)

/* ------------------------------------------------------------------ */
/* Iluminación reactiva: vive en SceneLighting, dentro del canvas.     */
/* ------------------------------------------------------------------ */

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

/**
 * Rejilla sutil del suelo (T028). El tile es repetible (`RepeatWrapping`) y se
 * estira sobre un plano grande: líneas mayores cada 256 px y menores cada 64 px
 * para dar escala sin competir con el diorama.
 */
function makeGroundGridTexture(): CanvasTexture {
  const tile = 1024
  const canvas = document.createElement('canvas')
  canvas.width = tile
  canvas.height = tile
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#070b12'
    context.fillRect(0, 0, tile, tile)

    for (let line = 0; line <= tile; line += 64) {
      const major = line % 256 === 0
      context.strokeStyle = major
        ? 'rgba(118, 158, 196, 0.14)'
        : 'rgba(108, 144, 182, 0.06)'
      context.lineWidth = major ? 2 : 1
      context.beginPath()
      context.moveTo(line + 0.5, 0)
      context.lineTo(line + 0.5, tile)
      context.stroke()
      context.beginPath()
      context.moveTo(0, line + 0.5)
      context.lineTo(tile, line + 0.5)
      context.stroke()
    }

    // Studs tenues en las intersecciones mayores: guiño a la retícula LEGO.
    context.fillStyle = 'rgba(150, 188, 224, 0.12)'
    for (let x = 0; x <= tile; x += 256) {
      for (let y = 0; y <= tile; y += 256) {
        context.beginPath()
        context.arc(x, y, 3, 0, Math.PI * 2)
        context.fill()
      }
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(groundSettings.repeat, groundSettings.repeat)
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

/** Halo cálido del suelo: refuerza el foco del diorama sin depender del CSS. */
function makeGroundGlowTexture(): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 198, 132, 0.24)')
    gradient.addColorStop(0.42, 'rgba(96, 140, 184, 0.12)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

const floorTiles = computed(() => {
  const tiles: Array<{ x: number; z: number; w: number; d: number; color: string }> = []
  const columns = layout.value.columns >= 4 ? 7 : 6
  const rowsCount = layout.value.rows >= 3 ? 5 : 4
  const width = layout.value.columns >= 4 ? 2.4 : 2.55
  const depth = layout.value.rows >= 3 ? 2.26 : 2.42
  const gap = 0.055
  for (let row = 0; row < rowsCount; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      tiles.push({
        x: (column - (columns - 1) / 2) * (width + gap),
        z: (row - (rowsCount - 1) / 2) * (depth + gap),
        w: width,
        d: depth,
        color: (row + column) % 2 === 0 ? LEGO.floor : LEGO.floorAlt,
      })
    }
  }
  return tiles
})

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

/*
 * Microvariación de materiales (T030 / FR-021): los ladrillos del mosaico, las
 * piezas sueltas y las tazas usan la caché compartida con un nivel de desgaste
 * derivado de un índice estable. Los bricks del diorama ya la reciben de forma
 * determinista desde `getLegoMaterial`, así que no se multiplican materiales.
 */
const mosaicMaterials = mosaicColors.map((tone, index) =>
  getLegoMaterial({ color: tone, roughness: 0.28, wear: getLegoWear(index) }),
)
const looseBrickMaterial = getLegoMaterial({ color: LEGO.yellow, roughness: 0.3, wear: 2 })
const cupMaterial = getLegoMaterial({ color: LEGO.white, roughness: 0.28, wear: 0 })
</script>

<template>
  <div
    ref="host"
    class="office-scene"
    :data-bloom="bloomState"
    :data-bloom-reason="bloomReason"
    :data-quality="qualityLevel"
    :data-fps="fps"
  >
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
        ref="cameraRef"
        :left="frustum.left"
        :right="frustum.right"
        :top="frustum.top"
        :bottom="frustum.bottom"
        :position="[14, 14, 14]"
        :near="-100"
        :far="200"
      />
      <SceneCameraControls />

      <!-- Presupuesto de rendimiento: DPR/sombras + bloom adaptativo. -->
      <ScenePerformance @quality="onQuality" @fps="onFps" />

      <!-- Bloom selectivo (MRT emisivo): degrada solo y restaura el render normal. -->
      <ScenePostProcessing
        :enabled="bloomEnabled"
        :self-managed-fps="false"
        @state="onBloomState"
      />

      <!-- Retratos de agente para los paneles (T034/T036). -->
      <AgentPortraitBaker :agents="agents" />

      <StudioEnvironment />

      <OfficeSurroundings :time-of-day="effectiveHour" />

      <SceneLighting :agents="agents" :time-of-day="effectiveHour" />

      <SceneWallFade />

      <!-- Diorama base -->
      <LegoBox :position="[0, -0.46, 0]" :size="[18.9, 0.24, 13.2]" :color="LEGO.baseEdge" :radius="0.08" />
      <LegoBox :position="[0, -0.27, 0]" :size="[18.4, 0.42, 12.7]" :color="LEGO.base" :radius="0.1" />
      <LegoBox :position="[0, -0.075, 0]" :size="[18, 0.05, 12.3]" :color="LEGO.floorEdge" :radius="0.02" />
      <LegoBox :position="[0, -0.085, 0]" :size="[18, 0.04, 12.3]" :color="LEGO.base" :radius="0.02" />

      <!-- Suelo/horizonte (T028): rejilla procedural + halo cálido; el diorama
           deja de parecer flotar y la viñeta asimétrica del CSS remata el encuadre. -->
      <TresMesh
        :rotation="[-Math.PI / 2, 0, 0]"
        :position="[0, groundSettings.y, 0]"
        :render-order="-4"
      >
        <TresPlaneGeometry :args="[groundSettings.size, groundSettings.size]" />
        <TresMeshBasicNodeMaterial :map="groundGrid" :tone-mapped="false" />
      </TresMesh>

      <TresMesh
        :rotation="[-Math.PI / 2, 0, 0]"
        :position="[0, groundSettings.glowY, 0]"
        :render-order="-3"
      >
        <TresPlaneGeometry :args="[groundSettings.glowSize, groundSettings.glowSize]" />
        <TresMeshBasicNodeMaterial
          :map="groundGlow"
          :transparent="true"
          :depth-write="false"
          :blending="2"
          :tone-mapped="false"
        />
      </TresMesh>

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
        :size="[tile.w, 0.06, tile.d]"
        :color="tile.color"
        :radius="0.02"
        :cast-shadow="false"
      />

      <!-- Rug -->
      <LegoBox :position="[0, 0.015, 0.15]" :size="[rug.width, 0.03, rug.depth]" :color="LEGO.tan" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[0, 0.032, 0.15]" :size="[rug.innerWidth, 0.02, rug.innerDepth]" :color="'#2b4d6d'" :radius="0.02" :cast-shadow="false" />

      <!-- Base nameplate -->
      <LegoBox :position="[0, -0.32, 6.33]" :size="[7.2, 0.54, 0.1]" :color="LEGO.charcoal" :radius="0.03" />
      <TresMesh :position="[0, -0.32, 6.385]">
        <TresPlaneGeometry :args="[6.9, 0.44]" />
        <TresMeshBasicNodeMaterial :map="baseSignTexture" :tone-mapped="false" />
      </TresMesh>

      <!-- Back wall -->
      <TresGroup :user-data="{ wallFade: 'back' }">
      <LegoBox :position="[0, 1.6, -5.95]" :size="[17.6, 3.2, 0.34]" :color="LEGO.warmWhite" :radius="0.04" :cast-shadow="false" />
      <LegoBox :position="[0, 0.14, -5.92]" :size="[17.6, 0.28, 0.42]" :color="LEGO.navy" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[0, 3.22, -5.95]" :size="[17.75, 0.16, 0.48]" :color="LEGO.navy" :radius="0.02" :cast-shadow="false" />
      <LegoBox :position="[0, 0.98, -5.77]" :size="[17.6, 0.025, 0.07]" color="#d4ccbd" :radius="0.01" :cast-shadow="false" />
      <LegoBox :position="[0, 2.02, -5.77]" :size="[17.6, 0.025, 0.07]" color="#d4ccbd" :radius="0.01" :cast-shadow="false" />
      <LegoBox
        v-for="y in [0.38, 0.68, 1.3, 1.62, 2.34, 2.68]"
        :key="`seam-back-${y}`"
        :position="[0, y, -5.77]"
        :size="[17.6, 0.012, 0.07]"
        color="#d8cfbd"
        :radius="0.008"
        :cast-shadow="false"
      />
      <LegoBox
        v-for="x in [-7.2, -3.6, 0, 3.6, 7.2]"
        :key="`pilaster-${x}`"
        :position="[x, 1.6, -5.78]"
        :size="[0.11, 3.2, 0.08]"
        :color="LEGO.cream"
        :radius="0.02"
        :cast-shadow="false"
      />

      <!-- Window -->
      <TresGroup :position="[WALL_LAYOUT.back.slots.window.center, WALL_LAYOUT.back.slots.window.y, WALL_LAYOUT.back.mount]">
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
      <TresGroup :position="[WALL_LAYOUT.back.slots.sign.center, WALL_LAYOUT.back.slots.sign.y, WALL_LAYOUT.back.mount]">
        <LegoBox :position="[0, 0, 0]" :size="[4.5, 1.26, 0.12]" :color="LEGO.tan" :radius="0.03" />
        <LegoBox :position="[0, 0, 0.07]" :size="[4.2, 1.02, 0.1]" :color="LEGO.navy" :radius="0.02" />
        <TresMesh :position="[0, 0, 0.13]">
          <TresPlaneGeometry :args="[3.95, 0.86]" />
          <TresMeshBasicNodeMaterial :map="signTexture" :tone-mapped="false" />
        </TresMesh>
      </TresGroup>

      <!-- Mosaic art -->
      <TresGroup :position="[WALL_LAYOUT.back.slots.mosaic.center, WALL_LAYOUT.back.slots.mosaic.y, WALL_LAYOUT.back.mount]">
        <LegoBox :position="[0, 0, 0]" :size="[3.5, 1.66, 0.09]" :color="LEGO.charcoal" :radius="0.03" />
        <TresMesh
          v-for="(material, index) in mosaicMaterials"
          :key="`mosaic-${index}`"
          :position="[
            (index % 6) * 0.46 - 1.15,
            Math.floor(index / 6) * 0.44 - 0.44,
            0.06,
          ]"
          :material="material"
        >
          <TresBoxGeometry :args="[0.38, 0.36, 0.04]" />
        </TresMesh>
      </TresGroup>

      </TresGroup>

      <!-- Left wall -->
      <TresGroup :user-data="{ wallFade: 'left' }">
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

      <!-- Whiteboard con tareas reales (T039 / FR-026) -->
      <TresGroup :position="[WALL_LAYOUT.left.mount, WALL_LAYOUT.left.slots.whiteboard.y, WALL_LAYOUT.left.slots.whiteboard.center]" :rotation="[0, Math.PI / 2, 0]">
        <LegoBox :position="[0, 0, 0]" :size="[3.6, 2.1, 0.1]" :color="LEGO.white" :radius="0.03" />
        <LegoBox :position="[0, 1.08, 0.03]" :size="[3.7, 0.1, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[0, -1.08, 0.03]" :size="[3.7, 0.1, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[-1.78, 0, 0.03]" :size="[0.1, 2.2, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <LegoBox :position="[1.78, 0, 0.03]" :size="[0.1, 2.2, 0.16]" :color="LEGO.azure" :radius="0.02" />
        <TresMesh :position="[0, 0, 0.065]">
          <TresPlaneGeometry :args="[3.3, 1.85]" />
          <TresMeshBasicNodeMaterial ref="boardMaterial" :map="boardTexture" :tone-mapped="false" />
        </TresMesh>
        <LegoBox :position="[0, -1.15, 0.14]" :size="[3.2, 0.08, 0.2]" :color="LEGO.lightGray" :radius="0.02" />
      </TresGroup>

      </TresGroup>

      <!-- Reloj de pared con hora real (T038 / FR-025) -->
      <TresGroup :user-data="{ wallFade: 'back' }" :position="[WALL_LAYOUT.back.slots.clock.center, WALL_LAYOUT.back.slots.clock.y, WALL_LAYOUT.back.mount]">
        <LegoBox :position="[0, 0, 0]" :size="[1.32, 1.32, 0.08]" :color="LEGO.charcoal" :radius="0.04" :cast-shadow="false" />
        <TresMesh :position="[0, 0, 0.05]">
          <TresPlaneGeometry :args="[1.14, 1.14]" />
          <TresMeshBasicNodeMaterial ref="clockMaterial" :map="clockTexture" :tone-mapped="false" />
        </TresMesh>
      </TresGroup>

      <!-- Door -->
      <TresGroup :user-data="{ wallFade: 'left' }" :position="[WALL_LAYOUT.left.mount, WALL_LAYOUT.left.slots.door.y, WALL_LAYOUT.left.slots.door.center]">
        <LegoBox :position="[0, 0, 0]" :size="[0.16, 2.3, 1.6]" :color="LEGO.white" :radius="0.03" />
        <LegoBox :position="[0.06, 0, 0]" :size="[0.12, 2.1, 1.4]" :color="LEGO.blue" :radius="0.02" />
        <TresMesh :position="[0.14, 0, 0.48]">
          <TresSphereGeometry :args="[0.06, 12, 10]" />
          <TresMeshStandardNodeMaterial :color="LEGO.gold" :roughness="0.25" :metalness="0.4" />
        </TresMesh>
      </TresGroup>

      <!-- Lounge -->
      <TresGroup v-if="showLounge" :position="[-6.1, 0, 2.5]" :rotation="[0, Math.PI / 2, 0]">
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

      <TresGroup v-if="showLounge" :position="[-4.2, 0, 2.5]">
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
      <TresGroup v-if="showRack" :position="[-6.5, 0, -3.4]">
        <LegoBox :position="[0, 0.95, 0]" :size="[1.1, 1.9, 0.92]" :color="LEGO.charcoal" :radius="0.04" />
        <LegoBox :position="[0, 1.93, 0]" :size="[1.12, 0.06, 0.94]" :color="LEGO.navy" :radius="0.02" />
        <LegoBox :position="[0, 0.02, 0.46]" :size="[0.9, 1.7, 0.03]" color="#222a34" :radius="0.01" />
        <TresMesh
          v-for="light in rackLights"
          :key="`rack-light-${light}`"
          :position="[-0.3 + (light % 3) * 0.3, 1.55 - Math.floor(light / 3) * 0.42, 0.48]"
          :user-data="{ bloomContributor: 'rack-led' }"
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
      <TresGroup v-if="showCoffee" :position="[5.6, 0, 2.6]">
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
        <TresMesh :position="[0.24, 0.82, 0.12]" :cast-shadow="true" :material="cupMaterial">
          <TresCylinderGeometry :args="[0.08, 0.07, 0.16, 14]" />
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
      <LegoPlant v-if="showBackRightPlant" :position="[7.4, 0, -3.9]" :scale="0.95" :flower="LEGO.red" />
      <LegoPlant :position="[7.2, 0, 4.3]" :scale="0.85" :flower="LEGO.yellow" />

      <TresGroup v-if="showConsole" :position="[7.15, 0, 0.4]">
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
      <TresGroup v-if="showCredenza" :position="[4.6, 0, -4.5]">
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
          :material="looseBrickMaterial"
        >
          <TresCylinderGeometry :args="[0.09, 0.09, 0.06, 14]" />
        </TresMesh>
      </TresGroup>

      <LegoShadow v-if="showCredenza" :position="[4.6, 0.008, -4.5]" :size="[3, 1.5]" :opacity="0.3" />
      <LegoShadow :position="[3.4, 0.008, 4.5]" :size="[0.9, 0.9]" :opacity="0.2" />

      <LegoShadow v-if="showLounge" :position="[-6.1, 0.008, 2.5]" :size="[3.4, 2.2]" :opacity="0.28" />
      <LegoShadow v-if="showLounge" :position="[-4.2, 0.008, 2.5]" :size="[1.6, 1.2]" :opacity="0.28" />
      <LegoShadow v-if="showRack" :position="[-6.5, 0.008, -3.4]" :size="[1.6, 1.4]" :opacity="0.32" />
      <LegoShadow v-if="showCoffee" :position="[5.6, 0.008, 2.6]" :size="[2.1, 2.1]" :opacity="0.26" />
      <LegoShadow v-if="showConsole" :position="[7.15, 0.008, 0.4]" :size="[1.4, 1.1]" :opacity="0.26" />
      <LegoShadow :position="[-6.9, 0.008, -0.9]" :size="[0.9, 0.9]" :opacity="0.22" />
      <LegoShadow v-if="showBackRightPlant" :position="[7.4, 0.008, -3.9]" :size="[0.85, 0.85]" :opacity="0.22" />
      <LegoShadow :position="[7.2, 0.008, 4.3]" :size="[0.8, 0.8]" :opacity="0.22" />
    </TresCanvas>

    <Teleport to=".stage">
      <div class="scene-tools" role="group" aria-label="Controles de la escena">
        <div class="scene-tools__time">
          <label for="scene-hour">Hora</label>
          <input
            id="scene-hour"
            class="scene-tools__range"
            type="range"
            min="0"
            max="24"
            step="0.25"
            :value="sliderHour"
            aria-label="Hora de la escena"
            @input="onTimeInput"
          >
          <output class="scene-tools__value" aria-live="polite">{{ timeLabel }}</output>
        </div>
        <button
          type="button"
          class="scene-tools__button"
          :class="{ 'is-custom': timeOverride }"
          :aria-pressed="!timeOverride"
          title="Volver a la hora real"
          @click="useRealTime"
        >
          Hora real
        </button>
        <button
          type="button"
          class="scene-tools__button"
          title="Restablecer vista"
          aria-label="Restablecer vista"
          @click="resetCamera"
        >
          ↺ Restablecer
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.office-scene {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/*
 * Viñeta asimétrica (T028 / FR-019). Se declara en el componente de escena,
 * scoped, para no tocar `main.css`: el foco visual cae arriba-derecha y el
 * borde inferior izquierdo se hunde, de modo que el diorama no parece flotar.
 */
.office-scene::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(58rem 34rem at 60% 32%, transparent 44%, rgba(4, 7, 12, 0.62) 100%),
    linear-gradient(196deg, transparent 54%, rgba(4, 7, 12, 0.52) 100%);
}

.scene-tools {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 8;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.4rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.75rem;
  background: rgba(9, 13, 19, 0.72);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 28px rgba(2, 5, 9, 0.28);
}

.scene-tools__time {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.2rem 0 0.35rem;
  color: var(--muted);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.scene-tools__range {
  width: 5.8rem;
  accent-color: var(--accent);
}

.scene-tools__value {
  min-width: 2.7rem;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.scene-tools__button {
  min-height: 1.75rem;
  padding: 0.28rem 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.55rem;
  background: rgba(16, 23, 34, 0.82);
  color: var(--muted);
  font: inherit;
  font-size: 0.64rem;
  cursor: pointer;
}

.scene-tools__button:hover,
.scene-tools__button:focus-visible {
  border-color: rgba(125, 211, 252, 0.55);
  color: var(--text);
}

.scene-tools__button.is-custom {
  color: var(--accent);
  border-color: rgba(125, 211, 252, 0.45);
}

@media (max-width: 1180px) and (min-width: 641px) {
  .scene-tools {
    top: 3.5rem;
  }
}

@media (max-width: 640px) {
  .scene-tools {
    top: 3.9rem;
    right: 0.5rem;
    bottom: auto;
    left: 0.5rem;
    justify-content: space-between;
  }

  .scene-tools__time {
    flex: 1;
    min-width: 0;
  }

  .scene-tools__range {
    width: 4.6rem;
  }

  .scene-tools__button {
    padding-inline: 0.4rem;
  }
}
</style>
