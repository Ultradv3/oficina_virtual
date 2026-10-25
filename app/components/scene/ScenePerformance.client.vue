<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core/webgpu'
import {
  advanceQuality,
  PERFORMANCE_BUDGET,
  QUALITY_PROFILES,
  type QualityLevel,
  type QualityState,
} from '~/utils/perf-budget'

/**
 * Medidor y controlador de calidad adaptativa.
 *
 * Se monta dentro de `<TresCanvas>`, mide FPS reales por ventanas y aplica el
 * perfil de `perf-budget.ts` al renderer: DPR y sombras. El bloom lo activa o
 * desactiva `OfficeScene` según el nivel emitido.
 */
const emit = defineEmits<{
  quality: [level: QualityLevel]
  fps: [fps: number]
}>()

const { renderer } = useTresContext()
const { onRender } = useLoop()

let fpsWindowStart = 0
let fpsFrames = 0
let warmupUntil = 0
let currentLevel: QualityLevel = 'high'
let qualityState: QualityState = { level: 'high', lowForMs: 0, highForMs: 0 }

function applyProfile(level: QualityLevel) {
  const profile = QUALITY_PROFILES[level]
  const instance = renderer.instance as
    | {
        setPixelRatio?: (ratio: number) => void
        shadowMap?: { enabled: boolean }
      }
    | undefined
  if (!instance) return
  try {
    const ratio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, profile.dpr)
    instance.setPixelRatio?.(ratio)
    if (instance.shadowMap) instance.shadowMap.enabled = profile.shadows
  } catch {
    // Un backend sin setPixelRatio conserva el tamaño que ya tiene.
  }
}

function resetSampling(now: number, warmupMs: number = PERFORMANCE_BUDGET.warmupMs) {
  fpsWindowStart = 0
  fpsFrames = 0
  warmupUntil = now + warmupMs
  qualityState = { level: currentLevel, lowForMs: 0, highForMs: 0 }
}

onMounted(() => {
  const now = performance.now()
  resetSampling(now)
  applyProfile(currentLevel)
})

onRender(() => {
  if (!renderer.isInitialized.value) return
  const now = performance.now()
  if (typeof document !== 'undefined' && document.hidden) {
    resetSampling(now, 0)
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
  if (elapsed < PERFORMANCE_BUDGET.sampleWindowMs) return

  const fps = (fpsFrames * 1000) / elapsed
  fpsWindowStart = now
  fpsFrames = 0
  qualityState = advanceQuality(qualityState, fps, elapsed)
  emit('fps', Math.round(fps))

  if (qualityState.level !== currentLevel) {
    currentLevel = qualityState.level
    applyProfile(currentLevel)
    emit('quality', currentLevel)
  }
})

onBeforeUnmount(() => {
  applyProfile('high')
})
</script>

<template>
  <!-- Componente lógico: mide y ajusta el renderer, no añade geometría. -->
  <slot />
</template>
