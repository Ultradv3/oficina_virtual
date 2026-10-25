/**
 * Presupuesto de rendimiento de la escena y escalones de calidad.
 *
 * La escena apunta a 55 fps en 1024x768 con 3 agentes. Si no los sostiene,
 * baja un escalón (DPR y sombras); si se recupera durante 8 s, sube uno.
 * Los valores viven aquí para poder probarlos y ajustarlos sin tocar el render.
 */
export type QualityLevel = 'high' | 'medium' | 'low'

export interface QualityProfile {
  level: QualityLevel
  label: string
  /** Tope de devicePixelRatio. */
  dpr: number
  shadows: boolean
  bloom: boolean
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: { level: 'high', label: 'Alta', dpr: 1.75, shadows: true, bloom: true },
  medium: { level: 'medium', label: 'Media', dpr: 1.25, shadows: true, bloom: true },
  low: { level: 'low', label: 'Baja', dpr: 1, shadows: false, bloom: false },
}

export const PERFORMANCE_BUDGET = {
  /** Objetivo de fps para mantener la calidad actual. */
  targetFps: 55,
  /** Umbral para considerar que el equipo se recuperó (histéresis). */
  recoverFps: 58,
  /** Ventana de medición. */
  sampleWindowMs: 500,
  /** Margen inicial para no medir compilación de shaders. */
  warmupMs: 1500,
  /** Tiempo por debajo del objetivo antes de bajar de nivel. */
  degradeAfterMs: 2000,
  /** Tiempo por encima de recoverFps antes de subir de nivel. */
  recoverAfterMs: 8000,
} as const

export interface QualityState {
  level: QualityLevel
  lowForMs: number
  highForMs: number
}

const NEXT_LOWER: Record<QualityLevel, QualityLevel> = {
  high: 'medium',
  medium: 'low',
  low: 'low',
}

const NEXT_HIGHER: Record<QualityLevel, QualityLevel> = {
  high: 'high',
  medium: 'high',
  low: 'medium',
}

/**
 * Avanza el estado de calidad con una muestra de FPS. Es puro: el componente
 * de render solo acumula la ventana y aplica el perfil resultante.
 */
export function advanceQuality(
  state: QualityState,
  fps: number,
  elapsedMs: number,
): QualityState {
  if (!Number.isFinite(fps) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return state

  if (fps < PERFORMANCE_BUDGET.targetFps) {
    const lowForMs = state.lowForMs + elapsedMs
    if (lowForMs >= PERFORMANCE_BUDGET.degradeAfterMs) {
      return { level: NEXT_LOWER[state.level], lowForMs: 0, highForMs: 0 }
    }
    return { level: state.level, lowForMs, highForMs: 0 }
  }

  if (fps >= PERFORMANCE_BUDGET.recoverFps) {
    const highForMs = state.highForMs + elapsedMs
    if (highForMs >= PERFORMANCE_BUDGET.recoverAfterMs) {
      return { level: NEXT_HIGHER[state.level], lowForMs: 0, highForMs: 0 }
    }
    return { level: state.level, lowForMs: 0, highForMs }
  }

  // Zona muerta entre targetFps y recoverFps: no se mueve el nivel.
  return { level: state.level, lowForMs: 0, highForMs: 0 }
}
