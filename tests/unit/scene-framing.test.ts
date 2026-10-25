import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  computeDeskLayout,
  computeSceneFraming,
  SCENE_ENTRANCE,
  SCENE_ZOOM_RANGE,
} from '~/utils/scene-framing'

describe('clampZoom', () => {
  it('acota al rango configurado', () => {
    expect(clampZoom(0)).toBe(SCENE_ZOOM_RANGE.min)
    expect(clampZoom(99)).toBe(SCENE_ZOOM_RANGE.max)
    expect(clampZoom(1.25)).toBe(1.25)
  })

  it('usa el zoom de entrada si el valor no es finito', () => {
    expect(clampZoom(Number.NaN)).toBe(SCENE_ENTRANCE.toZoom)
  })
})

describe('computeDeskLayout', () => {
  it('reparte 1, 2, 3, 6 y 10 agentes sin posiciones duplicadas', () => {
    for (const count of [1, 2, 3, 6, 10]) {
      const layout = computeDeskLayout(count)
      expect(layout.positions).toHaveLength(count)
      const keys = new Set(layout.positions.map(([x, , z]) => `${x}|${z}`))
      expect(keys.size).toBe(count)
      expect(layout.columns).toBeGreaterThanOrEqual(1)
      expect(layout.rows).toBeGreaterThanOrEqual(1)
    }
  })

  it('usa 1 columna para 1–2, 3 para 3–9 y 4 a partir de 10', () => {
    expect(computeDeskLayout(1).columns).toBe(1)
    expect(computeDeskLayout(2).columns).toBe(2)
    expect(computeDeskLayout(3).columns).toBe(3)
    expect(computeDeskLayout(9).columns).toBe(3)
    expect(computeDeskLayout(10).columns).toBe(4)
  })
})

describe('computeSceneFraming', () => {
  it('produce un frustum positivo en los viewports de referencia', () => {
    for (const [width, height] of [
      [1280, 800],
      [1024, 768],
      [390, 844],
    ]) {
      for (const agentCount of [1, 2, 3, 6, 10]) {
        const framing = computeSceneFraming({
          viewport: { width, height },
          agentCount,
        })
        expect(framing.frustum.left).toBeLessThan(framing.frustum.right)
        expect(framing.frustum.bottom).toBeLessThan(framing.frustum.top)
        expect(framing.target.zoom).toBeGreaterThanOrEqual(SCENE_ZOOM_RANGE.min)
        expect(framing.target.zoom).toBeLessThanOrEqual(SCENE_ZOOM_RANGE.max)
        expect(framing.layout.positions).toHaveLength(agentCount)
      }
    }
  })
})
