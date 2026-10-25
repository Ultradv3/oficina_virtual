<script setup lang="ts">
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { RenderPipeline } from 'three/webgpu'
import { emissive, mrt, output, pass } from 'three/tsl'
import { isWebGPURenderer, useLoop, useTresContext } from '@tresjs/core/webgpu'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'

/**
 * Posprocesado de la escena (T026/T031/T032).
 *
 * - `RenderPipeline` de `three/webgpu` (la vía vigente desde r183; `PostProcessing`
 *   está deprecado) con MRT `output + emissive`: el bloom es selectivo y solo
 *   recibe resplandor de los materiales con emisivo (LEDs, lámpara, pantallas).
 *   El HUD, las etiquetas y los sprites de brillo viven fuera del canvas o usan
 *   materiales sin emisivo, así que no contribuyen al glow.
 * - La cadena se sustituye con `useLoop().render()`: mientras el pipeline está
 *   activo, esta función reemplaza al `renderer.render` de TresJS. Al desmontar,
 *   desactivar o degradar se restaura el render directo.
 * - `BloomNode` ya trabaja internamente a escala 0.5 (media resolución).
 * - Degradación controlada: si el pipeline no puede crearse (backend WebGL2 o
 *   error de compilación) o si se miden menos de 55 fps sostenidos durante 2 s
 *   (referencia: 1024x768 con 3 agentes), se apaga el bloom y se conserva el
 *   resplandor emisivo/sprites existente (FR-020/FR-023/SC-006).
 */

type ScenePass = ReturnType<typeof pass>
type BloomEffect = ReturnType<typeof bloom> & { dispose?: () => void }

/**
 * Contribuyentes de bloom (T031) y exclusiones:
 *
 * - Solo aporta al canal `emissive` del MRT la geometría con material emisivo
 *   (`emissive`/`emissiveIntensity`/`emissiveMap`). En `OfficeDesk` están
 *   marcados con `userData.bloomContributor` los LEDs de estado, la bombilla de
 *   la lámpara y la pantalla del monitor (esta última usa su canvas como
 *   `emissiveMap`, así que brilla su interfaz y no el marco).
 * - El HUD vive fuera del canvas (DOM), y las etiquetas y los sprites de brillo
 *   usan `SpriteNodeMaterial` sin emisivo: no pueden contribuir al glow.
 *
 * `findBloomContributors` comprueba al activar que la escena conserva esa capa
 * marcada; si falta, el pipeline sigue funcionando y solo se avisa por consola.
 */
function findBloomContributors(target: object): number {
  let contributors = 0
  if (!('traverse' in target) || typeof target.traverse !== 'function') return contributors
  ;(target as { traverse: (callback: (object: object) => void) => void }).traverse((object) => {
    const marker = (object as { userData?: { bloomContributor?: unknown } }).userData
    if (marker && typeof marker.bloomContributor === 'string') contributors += 1
  })
  return contributors
}

const props = withDefaults(
  defineProps<{
    /** Interruptor del padre (política de rendimiento). */
    enabled?: boolean
    strength?: number
    radius?: number
    threshold?: number
    /** Umbral de FPS por debajo del cual se apaga el bloom. */
    fpsThreshold?: number
    /** Tiempo mínimo sostenido por debajo del umbral antes de apagar. */
    fpsSustainMs?: number
    /**
     * Si es false, la degradación por FPS la decide `ScenePerformance` y este
     * componente solo atiende a `enabled`.
     */
    selfManagedFps?: boolean
  }>(),
  {
    enabled: true,
    strength: 0.55,
    radius: 0.4,
    threshold: 0.18,
    fpsThreshold: 55,
    fpsSustainMs: 2000,
    selfManagedFps: true,
  },
)

const emit = defineEmits<{
  state: [active: boolean, reason: string | null]
}>()

const { renderer: rendererManager, scene, camera } = useTresContext()
const { render } = useLoop()

const pipeline = shallowRef<RenderPipeline>()
const scenePass = shallowRef<ScenePass>()
const bloomEffect = shallowRef<BloomEffect>()
const active = ref(false)

const FPS_WINDOW_MS = 500
/** Margen tras activar el pipeline para no medir la compilación de shaders. */
const FPS_WARMUP_MS = 1500

let destroyed = false
let failed = false
let lastEmitted: boolean | null = null
let fpsWindowStart = 0
let fpsFrames = 0
let lowFpsSince = 0
let warmupUntil = 0

/** El pipeline de nodos necesita el backend WebGPU; en WebGL2 se apaga. */
function hasWebGPUBackend(instance: unknown): boolean {
  const backend = (instance as { backend?: { isWebGPUBackend?: boolean } }).backend
  return backend?.isWebGPUBackend === true
}

function emitState(reason: string | null) {
  const state = active.value
  if (lastEmitted === state) return
  lastEmitted = state
  emit('state', state, reason)
}

/** Render de TresJS sin posprocesado (camino de respaldo). */
function renderDirect(notifyFrameRendered: () => void) {
  const activeCamera = camera.activeCamera.value
  if (!activeCamera) return
  rendererManager.instance.render(scene.value, activeCamera)
  notifyFrameRendered()
}

/**
 * Un fallo a mitad del pipeline puede dejar el render target o el MRT de la pasada
 * fijados; se limpian antes de volver al render directo para no pintar la escena
 * en un buffer fuera de pantalla.
 */
function resetRendererState() {
  try {
    const instance = rendererManager.instance
    instance.setRenderTarget(null)
    if (isWebGPURenderer(instance)) instance.setMRT(null)
  } catch {
    // El renderer ya está en un estado válido (o se está destruyendo).
  }
}

function resetSampling(warmupMs = FPS_WARMUP_MS) {
  const now = performance.now()
  fpsWindowStart = 0
  fpsFrames = 0
  lowFpsSince = 0
  warmupUntil = now + warmupMs
}

/** Mide FPS por ventanas y apaga el bloom si el equipo no sostiene el umbral. */
function samplePerformance(now: number) {
  if (!props.selfManagedFps) return
  // Con la pestaña oculta el navegador limita RAF y la medición no es real.
  if (typeof document !== 'undefined' && document.hidden) {
    resetSampling(0)
    return
  }
  if (now < warmupUntil) return
  if (fpsWindowStart === 0) {
    fpsWindowStart = now
    fpsFrames = 0
    return
  }

  fpsFrames += 1
  const elapsed = now - fpsWindowStart
  if (elapsed < FPS_WINDOW_MS) return

  const fps = (fpsFrames * 1000) / elapsed
  fpsWindowStart = now
  fpsFrames = 0

  if (fps >= props.fpsThreshold) {
    lowFpsSince = 0
    return
  }

  if (lowFpsSince === 0) lowFpsSince = now
  if (now - lowFpsSince >= props.fpsSustainMs) deactivate('fps')
}

function renderWithPipeline(notifyFrameRendered: () => void) {
  const currentPipeline = pipeline.value
  const activeCamera = camera.activeCamera.value
  if (!currentPipeline || !activeCamera) {
    renderDirect(notifyFrameRendered)
    return
  }

  try {
    currentPipeline.render()
  } catch (error) {
    // Un fallo del pipeline no puede dejar la escena en negro.
    console.warn('[escena] El pipeline de bloom falló; se restaura el render directo.', error)
    resetRendererState()
    deactivate('render-error')
    renderDirect(notifyFrameRendered)
    return
  }

  notifyFrameRendered()
  samplePerformance(performance.now())
}

function disposePipelineNodes() {
  bloomEffect.value?.dispose?.()
  scenePass.value?.dispose()
  pipeline.value?.dispose()
  bloomEffect.value = undefined
  scenePass.value = undefined
  pipeline.value = undefined
}

function deactivate(reason: string | null) {
  if (!active.value && !pipeline.value) {
    emitState(reason)
    return
  }

  active.value = false
  if (!destroyed) render(renderDirect)
  disposePipelineNodes()
  emitState(reason)
}

function activate() {
  if (destroyed || failed || active.value || !props.enabled) return

  const instance = rendererManager.instance
  if (!isWebGPURenderer(instance)) {
    failed = true
    emitState('backend')
    return
  }
  if (!hasWebGPUBackend(instance)) {
    // Fallback WebGL2 (o backend sin soporte de nodos MRT): se conserva la capa
    // emisiva/sprites, que mantiene el resplandor requerido por FR-020.
    failed = true
    emitState('webgl2')
    return
  }

  const activeCamera = camera.activeCamera.value
  if (!activeCamera) return

  try {
    scenePass.value = pass(scene.value, activeCamera)
    scenePass.value.setMRT(mrt({ output, emissive }))
    const color = scenePass.value.getTextureNode('output')
    const glow = bloom(
      scenePass.value.getTextureNode('emissive'),
      props.strength,
      props.radius,
      props.threshold,
    )
    bloomEffect.value = glow

    const renderPipeline = new RenderPipeline(instance)
    renderPipeline.outputNode = color.add(glow)
    renderPipeline.needsUpdate = true
    pipeline.value = renderPipeline

    // La capa emisiva marcada es la que alimenta el bloom selectivo (T031).
    if (findBloomContributors(scene.value) === 0) {
      console.warn(
        '[escena] No hay contribuyentes de bloom marcados con userData.bloomContributor; revisa los materiales emisivos de OfficeDesk.',
      )
    }

    render(renderWithPipeline)
    active.value = true
    resetSampling()
    emitState(null)
  } catch (error) {
    failed = true
    console.warn('[escena] No se pudo crear el pipeline de bloom; se usa el render directo.', error)
    resetRendererState()
    disposePipelineNodes()
    if (!destroyed) render(renderDirect)
    active.value = false
    emitState('pipeline')
  }
}

watch(
  [
    () => rendererManager.isInitialized.value,
    () => camera.activeCamera.value,
    () => props.enabled,
  ],
  ([initialized, activeCamera, enabled]) => {
    if (!initialized || !activeCamera || !enabled) {
      if (active.value) deactivate(enabled ? null : 'disabled')
      return
    }
    if (!active.value) activate()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  destroyed = true
  active.value = false
  render(renderDirect)
  disposePipelineNodes()
})
</script>

<template>
  <!-- Componente lógico: solo orquesta el RenderPipeline; no añade geometría. -->
  <slot />
</template>
