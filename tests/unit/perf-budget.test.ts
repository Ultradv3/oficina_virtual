import { describe, expect, it } from 'vitest'
import {
  advanceQuality,
  PERFORMANCE_BUDGET,
  QUALITY_PROFILES,
  type QualityState,
} from '~/utils/perf-budget'

const state = (level: QualityState['level'] = 'high'): QualityState => ({
  level,
  lowForMs: 0,
  highForMs: 0,
})

describe('quality profiles', () => {
  it('baja DPR, sombras y bloom con el nivel', () => {
    expect(QUALITY_PROFILES.high.dpr).toBeGreaterThan(QUALITY_PROFILES.medium.dpr)
    expect(QUALITY_PROFILES.medium.dpr).toBeGreaterThan(QUALITY_PROFILES.low.dpr)
    expect(QUALITY_PROFILES.low.shadows).toBe(false)
    expect(QUALITY_PROFILES.low.bloom).toBe(false)
  })

  it('mantiene el presupuesto explícito', () => {
    expect(PERFORMANCE_BUDGET.targetFps).toBeGreaterThan(0)
    expect(PERFORMANCE_BUDGET.recoverAfterMs).toBeGreaterThan(
      PERFORMANCE_BUDGET.degradeAfterMs,
    )
  })
})

describe('advanceQuality', () => {
  it('baja un escalón tras 2 s por debajo del objetivo', () => {
    let current = state('high')
    for (let index = 0; index < 3; index += 1) {
      current = advanceQuality(current, 40, 500)
      expect(current.level).toBe('high')
    }
    current = advanceQuality(current, 40, 500)
    expect(current.level).toBe('medium')
  })

  it('no baja de "low" y no sube por encima de "high"', () => {
    let low = state('low')
    for (let index = 0; index < 10; index += 1) low = advanceQuality(low, 30, 500)
    expect(low.level).toBe('low')

    let high = state('high')
    for (let index = 0; index < 30; index += 1) high = advanceQuality(high, 60, 500)
    expect(high.level).toBe('high')
  })

  it('sube un escalón tras 8 s de recuperación', () => {
    let current = state('low')
    for (let index = 0; index < 15; index += 1) {
      current = advanceQuality(current, 60, 500)
      expect(current.level).toBe('low')
    }
    current = advanceQuality(current, 60, 500)
    expect(current.level).toBe('medium')
  })

  it('la zona muerta no acumula ni degrada', () => {
    const current = advanceQuality(state('high'), 56, 500)
    expect(current.level).toBe('high')
    expect(current.lowForMs).toBe(0)
    expect(current.highForMs).toBe(0)
  })
})
